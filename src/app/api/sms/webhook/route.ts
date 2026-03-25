import { prisma } from '@/lib/db'

/**
 * Twilio inbound SMS webhook.
 * Verifies the Twilio signature to reject spoofed requests.
 * Configure your Twilio phone number webhook to POST to /api/sms/webhook
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text()

    // ── Twilio Signature Verification ──────────────────────────────────────
    // Skip in dev/test when no Twilio credentials are configured.
    if (process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WEBHOOK_URL) {
      const signature = request.headers.get('X-Twilio-Signature') ?? ''

      try {
        const twilio = await import('twilio')
        const isValid = twilio.default.validateRequest(
          process.env.TWILIO_AUTH_TOKEN,
          signature,
          process.env.TWILIO_WEBHOOK_URL,
          Object.fromEntries(new URLSearchParams(rawBody))
        )

        if (!isValid) {
          console.warn('[SMS WEBHOOK] Invalid Twilio signature — request rejected')
          return new Response(null, { status: 403 })
        }
      } catch (err) {
        console.error('[SMS WEBHOOK] Signature validation error:', err)
        return new Response(null, { status: 403 })
      }
    }

    const formData = new URLSearchParams(rawBody)
    const from = formData.get('From')
    const body = formData.get('Body')
    const messageSid = formData.get('MessageSid')

    if (!from || !body) {
      return twiml(400)
    }

    // Sanitize inputs
    const sanitizedFrom = from.slice(0, 30)
    const sanitizedBody = body.slice(0, 1600)
    const sanitizedSid = messageSid ? messageSid.slice(0, 100) : null

    const normalizedFrom = sanitizedFrom.replace(/[^\d+]/g, '')

    const technician = await prisma.technician.findFirst({
      where: {
        OR: [
          { phone: sanitizedFrom },
          { phone: normalizedFrom },
          ...(normalizedFrom.startsWith('+1') ? [{ phone: normalizedFrom.slice(2) }] : []),
        ],
      },
    })

    await prisma.smsMessage.create({
      data: {
        technicianId: technician?.id ?? null,
        direction: 'INBOUND',
        body: sanitizedBody,
        twilioSid: sanitizedSid,
        status: 'received',
        sentAt: new Date(),
      },
    })

    if (!technician) {
      console.warn(`[SMS WEBHOOK] Inbound from unknown number: ${sanitizedFrom}`)
    }

    return twiml(200)
  } catch (err) {
    console.error('[SMS WEBHOOK] Error:', err)
    return twiml(500)
  }
}

function twiml(status: number) {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status,
    headers: { 'Content-Type': 'text/xml' },
  })
}
