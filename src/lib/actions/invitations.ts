'use server'

import { revalidatePath } from 'next/cache'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import { technicianInviteSchema } from '@/lib/validations'
import { generateTempPassword } from '@/lib/utils'
import { sendSms } from './sms'

export type InviteResult =
  | {
      success: true
      email: string
      tempPassword: string
      technicianId: string
      userId: string
      smsStatus: 'sent' | 'simulated' | 'failed'
      smsStatusMessage: string
    }
  | {
      success: false
      error: string
    }

/**
 * Invite a technician: creates user account + technician profile + sends SMS welcome
 * Requires ADMIN role (dispatchers cannot create accounts)
 * Generates temporary password (must change on first login)
 * Sends SMS with email and temp password
 */
export async function inviteTechnician(
  name: string,
  email: string,
  phone: string
): Promise<InviteResult> {
  // Auth must run outside the try/catch — Next.js redirect() throws a special
  // internal signal that must NOT be swallowed by a generic catch block.
  const session = await requireRole('ADMIN')

  try {
    // Validate inputs — safeParse never throws; errors returned structurally.
    const parsed = technicianInviteSchema.safeParse({ name, email, phone })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return { success: false, error: `${issue.path.join('.') || 'input'}: ${issue.message}` }
    }

    // Normalize email to lowercase — PostgreSQL UNIQUE constraints are
    // case-sensitive; Jane@co.com and jane@co.com would otherwise create two accounts.
    const { name: validName, phone: validPhone } = parsed.data
    const validEmail = parsed.data.email.toLowerCase()

    // Duplicate-email guard
    const existing = await prisma.user.findUnique({ where: { email: validEmail } })
    if (existing) {
      return { success: false, error: `A user with email ${validEmail} already exists` }
    }

    // Generate secure temporary password
    const tempPassword = generateTempPassword()
    const passwordHash = await hash(tempPassword, 12)

    // Create user + technician atomically.
    const { user, technician } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validName,
          email: validEmail,
          passwordHash,
          role: 'TECHNICIAN',
          phone: validPhone,
          active: true,
        },
      })

      const technician = await tx.technician.create({
        data: {
          userId: user.id,
          name: validName,
          phone: validPhone,
          status: 'ACTIVE',
          active: true,
        },
      })

      return { user, technician }
    })

    // Send SMS invitation with credentials — failure here must not abort the invite.
    let smsStatus: 'sent' | 'simulated' | 'failed' = 'failed'
    let smsStatusMessage = 'SMS could not be sent'

    try {
      const inviteMessage = `Welcome to FieldCommand! Your account has been created.\nEmail: ${validEmail}\nPassword: ${tempPassword}\n\nLog in at your site URL to get started.`
      const redactedInviteMessage = `Welcome to FieldCommand! Your account has been created.\nEmail: ${validEmail}\nPassword: [redacted - delivered via SMS only]\n\nLog in at your site URL to get started.`

      const smsResult = await sendSms(technician.id, inviteMessage, undefined, false, redactedInviteMessage)

      const TWILIO_SENT_STATUSES = new Set(['accepted', 'queued', 'sending', 'sent', 'delivered'])

      if (smsResult.status === 'simulated') {
        smsStatus = 'simulated'
        smsStatusMessage = 'SMS not configured; share credentials manually'
      } else if (TWILIO_SENT_STATUSES.has(smsResult.status)) {
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

    auditLog({
      action: 'tech.create',
      userId: session.user.id,
      userRole: session.user.role,
      targetId: user.id,
      targetType: 'User',
      meta: {
        inviteMethod: 'email',
        technicianId: technician.id,
        smsStatus,
        name: validName,
        email: validEmail,
      },
    })

    revalidatePath('/settings/users')

    return {
      success: true,
      email: validEmail,
      tempPassword,
      technicianId: technician.id,
      userId: user.id,
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
