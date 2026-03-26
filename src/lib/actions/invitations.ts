'use server'

import { revalidatePath } from 'next/cache'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import { technicianInviteSchema } from '@/lib/validations'
import { generateTempPassword } from '@/lib/utils'
import { sendSms } from './sms'
import { sendInviteEmail } from './email'

export type InviteResult =
  | {
      success: true
      /**
       * The login identifier shown to the admin/technician.
       * - email/both:  the real email address
       * - phone:       the placeholder email (tech.{digits}@invite.local)
       * - manual:      the username slug (e.g. "john.smith") — auth normalises to @users.local
       */
      loginEmail: string
      /**
       * True when the loginEmail was generated rather than supplied by the admin.
       * phone-only: placeholder derived from phone digits
       * manual:     username slug derived from name
       */
      isPlaceholderEmail: boolean
      tempPassword: string
      technicianId: string
      userId: string
      inviteMethod: 'email' | 'phone' | 'both' | 'manual'
      emailStatus?: 'sent' | 'simulated' | 'failed'
      emailStatusMessage?: string
      smsStatus?: 'sent' | 'simulated' | 'failed'
      smsStatusMessage?: string
    }
  | { success: false; error: string }

/**
 * Generates a unique username slug from a full name.
 * Format: firstname.lastname (e.g. "John Smith" → "john.smith")
 * Duplicates get an incrementing suffix: john.smith2, john.smith3, …
 * The slug is stored as {slug}@users.local in User.email.
 */
/**
 * Returns the slug string, or null if the name yields no usable ASCII characters.
 */
async function generateUniqueUsername(name: string): Promise<string | null> {
  const parts = name.trim().toLowerCase().split(/\s+/)
  const first = parts[0].replace(/[^a-z0-9]/g, '')
  const last = parts.length > 1 ? parts[parts.length - 1].replace(/[^a-z0-9]/g, '') : ''
  const base = last ? `${first}.${last}` : first

  // Guard: name must produce at least one ASCII character
  if (!base || base === '.') return null

  const taken = await prisma.user.findUnique({ where: { email: `${base}@users.local` } })
  if (!taken) return base

  let i = 2
  while (true) {
    const candidate = `${base}${i}`
    const exists = await prisma.user.findUnique({ where: { email: `${candidate}@users.local` } })
    if (!exists) return candidate
    i++
  }
}

/**
 * Invite a technician: creates user account + technician profile, then
 * delivers credentials via the chosen method.
 *
 * - email / both:  real email required; credentials sent via email
 * - phone / both:  phone required; placeholder email generated (tech.{digits}@invite.local);
 *                  credentials sent via SMS
 * - manual:        no contact info required; username slug generated from name
 *                  (john.smith → stored as john.smith@users.local); admin shares manually
 *
 * Requires ADMIN role.
 */
export async function inviteTechnician(
  name: string,
  email: string | undefined,
  phone: string | undefined,
  inviteMethod: 'email' | 'phone' | 'both' | 'manual'
): Promise<InviteResult> {
  // Auth runs outside the try/catch — Next.js redirect() signals must propagate.
  const session = await requireRole('ADMIN')

  try {
    // Validate all inputs server-side
    const parsed = technicianInviteSchema.safeParse({ name, email, phone, inviteMethod })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return {
        success: false,
        error: `${issue.path.join('.') || 'input'}: ${issue.message}`,
      }
    }

    const validName = parsed.data.name
    const validMethod = parsed.data.inviteMethod
    const validPhone = parsed.data.phone

    // Determine login email identity
    let loginEmail: string       // displayed credential (username slug for manual, email otherwise)
    let internalEmail: string    // stored in User.email
    let isPlaceholderEmail: boolean

    if (validMethod === 'email' || validMethod === 'both') {
      loginEmail = parsed.data.email!.toLowerCase()
      internalEmail = loginEmail
      isPlaceholderEmail = false
    } else if (validMethod === 'manual') {
      // Generate username slug; auth normalises slug → slug@users.local for DB lookup
      const slug = await generateUniqueUsername(validName)
      if (!slug) {
        return {
          success: false,
          error: 'Could not generate a username from this name. Please use letters and numbers.',
        }
      }
      loginEmail = slug                        // shown to admin: "john.smith"
      internalEmail = `${slug}@users.local`   // stored in DB
      isPlaceholderEmail = true
    } else {
      // Phone-only: generate a deterministic placeholder so the tech can still log in.
      // Format: tech.{digits}@invite.local — communicated in the SMS.
      const digits = validPhone!.replace(/\D/g, '')
      loginEmail = `tech.${digits}@invite.local`
      internalEmail = loginEmail
      isPlaceholderEmail = true
    }

    // Duplicate check (manual already guaranteed unique by generateUniqueUsername)
    const existing = validMethod === 'manual'
      ? null
      : await prisma.user.findUnique({ where: { email: internalEmail } })
    if (existing) {
      const msg = isPlaceholderEmail
        ? `A technician with phone ${validPhone} already has an account`
        : `A user with email ${internalEmail} already exists`
      return { success: false, error: msg }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hash(tempPassword, 12)

    // Atomic transaction — rolls back both records if either fails
    const { user, technician } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validName,
          email: internalEmail,
          passwordHash,
          role: 'TECHNICIAN',
          // Phone stored on User when provided; empty string when email-only
          // (Technician.phone is the authoritative field for SMS)
          phone: validPhone ?? null,
          active: true,
        },
      })

      const technician = await tx.technician.create({
        data: {
          userId: user.id,
          name: validName,
          // Technician.phone is required by the schema; empty string is a safe
          // placeholder for email-only invites — the dispatcher can update it later.
          phone: validPhone ?? '',
          status: 'ACTIVE',
          active: true,
        },
      })

      return { user, technician }
    })

    // ── Email delivery ────────────────────────────────────────────────────────

    let emailStatus: 'sent' | 'simulated' | 'failed' | undefined
    let emailStatusMessage: string | undefined

    if (validMethod === 'email' || validMethod === 'both') {
      const redactedLog = `Login: ${internalEmail} / Password: [redacted - delivered via email only]`
      const emailResult = await sendInviteEmail(
        internalEmail,
        validName,
        loginEmail,
        tempPassword,
        redactedLog
      )
      emailStatus = emailResult.status
      emailStatusMessage = emailResult.message
    }

    // ── SMS delivery ──────────────────────────────────────────────────────────

    let smsStatus: 'sent' | 'simulated' | 'failed' | undefined
    let smsStatusMessage: string | undefined

    if (validMethod === 'phone' || validMethod === 'both') {
      try {
        const smsBody =
          `Welcome to FieldCommand! Your account:\n` +
          `Login: ${loginEmail}\n` +
          `Password: ${tempPassword}\n\n` +
          `Log in at your site URL to get started.`

        const redactedSmsBody =
          `Welcome to FieldCommand! Your account:\n` +
          `Login: ${loginEmail}\n` +
          `Password: [redacted - delivered via SMS only]\n\n` +
          `Log in at your site URL to get started.`

        const smsResult = await sendSms(
          technician.id,
          smsBody,
          undefined,
          false,
          redactedSmsBody
        )

        const TWILIO_SENT = new Set(['accepted', 'queued', 'sending', 'sent', 'delivered'])

        if (smsResult.status === 'simulated') {
          smsStatus = 'simulated'
          smsStatusMessage = 'SMS not configured; share credentials manually'
        } else if (TWILIO_SENT.has(smsResult.status)) {
          smsStatus = 'sent'
          smsStatusMessage = 'SMS sent successfully'
        } else {
          smsStatus = 'failed'
          smsStatusMessage = `SMS status: ${smsResult.status}`
        }
      } catch (smsErr) {
        smsStatus = 'failed'
        smsStatusMessage = `SMS error: ${smsErr instanceof Error ? smsErr.message : 'Unknown error'}`
        console.error('[inviteTechnician] SMS error (invite still succeeded):', smsErr)
      }
    }

    auditLog({
      action: 'tech.create',
      userId: session.user.id,
      userRole: session.user.role,
      targetId: user.id,
      targetType: 'User',
      meta: {
        inviteMethod: validMethod,
        technicianId: technician.id,
        emailStatus: emailStatus ?? 'skipped',
        smsStatus: smsStatus ?? 'skipped',
        name: validName,
        loginEmail: internalEmail,
        displayLogin: loginEmail,
        isPlaceholderEmail,
      },
    })

    revalidatePath('/settings/users')

    return {
      success: true,
      loginEmail,
      isPlaceholderEmail,
      tempPassword,
      technicianId: technician.id,
      userId: user.id,
      inviteMethod: validMethod,
      emailStatus,
      emailStatusMessage,
      smsStatus,
      smsStatusMessage,
    }
  } catch (err) {
    console.error('[inviteTechnician] Unexpected error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.',
    }
  }
}

// ─── Resend invite SMS (from success screen) ─────────────────────────────────

export async function resendInviteSms(
  technicianId: string,
  loginEmail: string,
  tempPassword: string
): Promise<{ status: 'sent' | 'simulated' | 'failed'; message: string }> {
  await requireRole('ADMIN')

  // Validate server-side — inputs come from client state even though they
  // originated from a previous server response.
  if (!technicianId || technicianId.length > 128) {
    return { status: 'failed', message: 'Invalid technician ID' }
  }
  if (!loginEmail || loginEmail.length > 200) {
    return { status: 'failed', message: 'Invalid login email' }
  }
  if (!tempPassword || tempPassword.length > 100) {
    return { status: 'failed', message: 'Invalid password' }
  }

  try {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

    const smsBody =
      `FieldCommand Login\n` +
      `Login: ${loginEmail}\n` +
      `Password: ${tempPassword}` +
      (appUrl ? `\n\nSign in: ${appUrl}/login` : '')

    const redactedBody =
      `FieldCommand Login\n` +
      `Login: ${loginEmail}\n` +
      `Password: [redacted]` +
      (appUrl ? `\n\nSign in: ${appUrl}/login` : '')

    const result = await sendSms(technicianId, smsBody, undefined, false, redactedBody)

    const SENT = new Set(['accepted', 'queued', 'sending', 'sent', 'delivered'])
    if (result.status === 'simulated') return { status: 'simulated', message: 'SMS not configured; share manually' }
    if (SENT.has(result.status)) return { status: 'sent', message: 'SMS sent' }
    return { status: 'failed', message: `SMS status: ${result.status}` }
  } catch (err) {
    console.error('[resendInviteSms] Error:', err)
    return { status: 'failed', message: err instanceof Error ? err.message : 'Unknown error' }
  }
}
