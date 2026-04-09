import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { askAI } from '@/lib/ai'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiRole, forbidden, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { aiDraftTextSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  const session = await requireApiRole('DISPATCHER')
  if (!session) return forbidden()

  if (!rateLimit(`ai:${session.user.id}`, LIMITS.AI.limit, LIMITS.AI.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = aiDraftTextSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { technicianName, jobSummary, intent, tone } = result.data

  const toneInstruction =
    tone === 'casual'
      ? 'Use a casual, friendly tone.'
      : tone === 'direct'
        ? 'Use a direct, no-nonsense tone.'
        : 'Use a professional but friendly tone.'

  const userMessage = `Draft a short SMS text message. Keep it under 160 characters if possible. Return ONLY the message text, nothing else.

**Technician Name:** ${technicianName}
**Intent:** ${intent}
${jobSummary ? `**Job Context:** ${jobSummary}` : ''}
**Tone:** ${toneInstruction}

Return just the SMS text, no quotes, no explanation.`

  try {
    const draft = await askAI(SYSTEM_PROMPT, userMessage, 256)
    return NextResponse.json({ draft: draft.trim() })
  } catch (error) {
    console.error('AI draft-text error:', error)
    return NextResponse.json({ error: 'Failed to draft text. Please try again.' }, { status: 500 })
  }
}
