import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { askAI } from '@/lib/ai'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { aiAskSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  if (!rateLimit(`ai:${session.user.id}`, LIMITS.AI.limit, LIMITS.AI.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = aiAskSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { question, context } = result.data

  const userMessage = context
    ? `${question}\n\n**Additional Context:**\n${context}`
    : question

  try {
    const answer = await askAI(SYSTEM_PROMPT, userMessage, 1024)
    auditLog({ action: 'ai.query', userId: session.user.id, meta: { endpoint: 'ask' } })
    return NextResponse.json({ answer: answer.trim() })
  } catch (error) {
    console.error('AI ask error:', error)
    return NextResponse.json({ error: 'Failed to get answer. Please try again.' }, { status: 500 })
  }
}
