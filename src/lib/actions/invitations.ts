'use server'

import { revalidatePath } from 'next/cache'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import { technicianInviteSchema } from '@/lib/validations'
import { generateTempPassword } from '@/lib/utils'
import { sendSms } from './sms'

export interface InviteResult {
  success: boolean
  email: string
  tempPassword: string
  technicianId: string
  userId: string
  smsStatus: 'sent' | 'simulated' | 'failed'
  smsStatusMessage: string
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
  // Only admins can create user accounts via invite
  const session = await requireRole('ADMIN')

  // Validate inputs
  const result = technicianInviteSchema.safeParse({ name, email, phone })
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new Error(`Validation error: ${issue.path.join('.')} - ${issue.message}`)
  }

  // Normalize email to lowercase — Zod validates format but does not normalize case.
  // PostgreSQL UNIQUE constraints are case-sensitive; without this, Jane@co.com and
  // jane@co.com would pass the duplicate check and create two separate accounts.
  const { name: validName, phone: validPhone } = result.data
  const validEmail = result.data.email.toLowerCase()

  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email: validEmail } })
  if (existing) {
    throw new Error(`A user with email ${validEmail} already exists`)
  }

  // Generate secure temporary password
  const tempPassword = generateTempPassword()
  const passwordHash = await hash(tempPassword, 12)

  // Create user + technician atomically. If either write fails the entire
  // transaction rolls back — no orphaned User records that block re-invite.
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

  // Send SMS invitation with credentials
  let smsStatus: 'sent' | 'simulated' | 'failed' = 'failed'
  let smsStatusMessage = 'SMS could not be sent'

  try {
    // Full message — sent to Twilio, never written to the DB.
    const inviteMessage = `Welcome to FieldCommand! Your account has been created.
Email: ${validEmail}
Password: ${tempPassword}

Log in at your site URL to get started.`

    // Redacted version stored in smsMessages.body. The temp password is kept
    // out of the database log; delivery to the technician is unaffected.
    const redactedInviteMessage = `Welcome to FieldCommand! Your account has been created.
Email: ${validEmail}
Password: [redacted - delivered via SMS only]

Log in at your site URL to get started.`

    const smsResult = await sendSms(technician.id, inviteMessage, undefined, false, redactedInviteMessage)

    // Twilio lifecycle: accepted → queued → sending → sent → delivered
    // 'simulated' is our internal fallback when Twilio is not configured.
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
  } catch (err) {
    smsStatus = 'failed'
    smsStatusMessage = `SMS error: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('Invite SMS error:', err)
  }

  // Audit log the invitation
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
}
