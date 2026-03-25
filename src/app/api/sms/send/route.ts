import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireApiRole, forbidden, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { smsSendSchema } from '@/lib/validations'
import { sendSms } from '@/lib/actions/sms'
import { auditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  // Only dispatchers and admins can send SMS
  const session = await requireApiRole('DISPATCHER')
  if (!session) return forbidden()

  const ip = getClientIp(request)
  if (!rateLimit(`sms:${ip}`, LIMITS.SMS_SEND.limit, LIMITS.SMS_SEND.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = smsSendSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { technicianId, message, jobId, aiDrafted } = result.data

  try {
    const smsResult = await sendSms(technicianId, message, jobId ?? undefined, aiDrafted)

    auditLog({
      action: 'sms.send',
      userId: session.user.id,
      userRole: session.user.role,
      targetId: technicianId,
      targetType: 'Technician',
      meta: { jobId, aiDrafted, messageLength: message.length },
    })

    return NextResponse.json(smsResult, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send SMS'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
