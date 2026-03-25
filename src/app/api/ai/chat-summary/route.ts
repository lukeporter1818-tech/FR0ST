import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { askAI } from '@/lib/ai'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiRole, forbidden, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { aiChatSummarySchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  const session = await requireApiRole('DISPATCHER')
  if (!session) return forbidden()

  if (!rateLimit(`ai:${getClientIp(request)}`, LIMITS.AI.limit, LIMITS.AI.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = aiChatSummarySchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const chatThread = result.data.messages
    .map((m) => `[${m.timestamp}] ${m.userName}: ${m.body}`)
    .join('\n')

  const userMessage = `Summarize the following team chat thread. Return your response as JSON ONLY — no markdown, no explanation.

**Chat Thread:**
${chatThread}

Return this exact JSON structure:
{
  "summary": "Brief summary of the conversation — what was discussed?",
  "actionItems": ["any tasks or action items mentioned in the chat"],
  "importantUpdates": ["any important status updates or decisions made"]
}`

  try {
    const raw = await askAI(SYSTEM_PROMPT, userMessage, 1024)
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI chat-summary error:', error)
    return NextResponse.json({ error: 'Failed to summarize chat. Please try again.' }, { status: 500 })
  }
}
