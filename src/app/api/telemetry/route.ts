/**
 * Client → server telemetry bridge.
 *
 * Client-side events (page views, React errors) cannot write directly to
 * Vercel logs. This endpoint accepts them from the browser, validates the
 * shape, and logs them server-side so they appear in Vercel's log explorer.
 *
 * Auth required — only authenticated users can submit events.
 * Rate-limited — prevents accidental log floods.
 * No sensitive data accepted or stored.
 */
import type { NextRequest } from 'next/server'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { telemetryLog } from '@/lib/telemetry'
import { z } from 'zod'

// 60 events/min per IP — generous for legitimate usage, blocks accidental loops
const LIMIT = { limit: 60, windowMs: 60_000 }

const eventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('page.view'),
    screen: z.string().trim().min(1).max(50),
  }),
  z.object({
    event: z.literal('error.client'),
    message: z.string().trim().max(200),
    component: z.string().trim().max(100).optional(),
  }),
])

export async function POST(req: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  if (!rateLimit(`telemetry:${getClientIp(req)}`, LIMIT.limit, LIMIT.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  const result = eventSchema.safeParse(raw)
  if (!result.success) {
    return Response.json({ ok: false }, { status: 400 })
  }

  // Log with role (not user ID) — sufficient for usage analysis, no PII needed
  telemetryLog({ ...result.data, role: session.user.role })

  return Response.json({ ok: true })
}
