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
      /** The email address used to log in (may be a generated placeholder for phone-only invites) */
      loginEmail: string
      /**
       * True when the loginEmail was generated from the phone number rather than
       * supplied by the admin. The tech uses this placeholder email to log in;
       * it is communicated to them via SMS.
       */
      isPlaceholderEmail: boolean
      tempPassword: string
      technicianId: string
      userId: string
      inviteMethod: 'email' | 'phone' | 'both'
      emailStatus?: 'sent' | 'simulated' | 'failed'
      emailStatusMessage?: string
      smsStatus?: 'sent' | 'simulated' | 'failed'
      smsStatusMessage?: string
    }
  | { success: false; error: string }

/**
 * Invite a technician: creates user account + technician profile, then
 * delivers credentials via the chosen method (email, SMS, or both).
 *
 * Phone-only invites: because the auth system requires an email to log in,
 * a deterministic placeholder is generated: tech.{digits}@invite.local.
 * The technician receives this placeholder + temp password in the SMS so
 * they can log in immediately.
 *
 * Requires ADMIN role.
 */
export async function inviteTechnician(
  name: string,
  email: string | undefined,
  phone: string | undefined,
  inviteMethod: 'email' | 'phone' | 'both'
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
    let loginEmail: string
    let isPlaceholderEmail: boolean

    if (validMethod === 'email' || validMethod === 'both') {
      loginEmail = parsed.data.email!.toLowerCase()
      isPlaceholderEmail = false
    } else {
      // Phone-only: generate a deterministic placeholder so the tech can still log in.
      // Format: tech.{digits}@invite.local — communicated in the SMS.
      const digits = validPhone!.replace(/\D/g, '')
      loginEmail = `tech.${digits}@invite.local`
      isPlaceholderEmail = true
    }

    // Duplicate check
    const existing = await prisma.user.findUnique({ where: { email: loginEmail } })
    if (existing) {
      const msg = isPlaceholderEmail
        ? `A technician with phone ${validPhone} already has an account`
        : `A user with email ${loginEmail} already exists`
      return { success: false, error: msg }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hash(tempPassword, 12)

    // Atomic transaction — rolls back both records if either fails
    const { user, technician } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validName,
          email: loginEmail,
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
      const redactedLog = `Login: ${loginEmail} / Password: [redacted - delivered via email only]`
      const emailResult = await sendInviteEmail(
        loginEmail,
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
        loginEmail,
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
