'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'

export async function sendSms(
  technicianId: string,
  body: string,
  jobId?: string,
  aiDrafted?: boolean,
  /**
   * When provided, this value is persisted to `smsMessages.body` instead of
   * `body`. Use it to store a redacted version when the outbound message
   * contains a credential (e.g. a temporary password). The actual SMS sent
   * to the technician is always `body` — this only affects what lands in the
   * database log.
   */
  bodyForLog?: string
) {
  const session = await requireRole('DISPATCHER')

  // Validate inputs
  if (!technicianId || typeof technicianId !== 'string' || technicianId.length > 100) {
    throw new Error('Invalid technicianId')
  }
  if (!body || typeof body !== 'string' || body.length > 1600) {
    throw new Error('Invalid message body')
  }

  const technician = await prisma.technician.findUnique({ where: { id: technicianId } })
  if (!technician) throw new Error('Technician not found')

  let twilioSid: string | null = null
  let status = 'simulated'

  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    try {
      const twilio = await import('twilio')
      const client = twilio.default(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
      const message = await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: technician.phone,
      })
      twilioSid = message.sid
      status = message.status
    } catch (err) {
      console.error('Twilio send failed:', err)
      status = 'failed'
    }
  } else {
    console.log(`[SMS SIMULATED] To: ${technician.name} (${technician.phone})\n  Body: ${bodyForLog ?? body}`)
  }

  const smsMessage = await prisma.smsMessage.create({
    data: {
      technicianId,
      jobId: jobId || null,
      direction: 'OUTBOUND',
      body: bodyForLog ?? body, // bodyForLog lets callers persist a redacted version
      aiDrafted: aiDrafted ?? false,
      twilioSid,
      status,
      sentAt: new Date(),
    },
  })

  auditLog({
    action: 'sms.send',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: technicianId,
    targetType: 'Technician',
    meta: { jobId, aiDrafted, status },
  })

  revalidatePath(`/technicians/${technicianId}`)
  return { id: smsMessage.id, status }
}
