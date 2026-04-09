import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { askAI } from '@/lib/ai'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { aiCleanNotesSchema } from '@/lib/validations'

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

  const result = aiCleanNotesSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { rawNotes, context } = result.data

  const userMessage = `Clean up the following messy field technician notes into professional, structured office notes. Return your response as JSON ONLY — no markdown, no explanation.

**Raw Notes:**
${rawNotes}
${context ? `\n**Additional Context:** ${context}` : ''}

Return this exact JSON structure:
{
  "cleanedNotes": "The cleaned, professional version of the notes",
  "keyPoints": ["array", "of", "key", "takeaways"]
}`

  try {
    const aiResponse = await askAI(SYSTEM_PROMPT, userMessage, 1024)
    let parsed
    try {
      parsed = JSON.parse(aiResponse)
    } catch {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }
    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI clean-notes error:', error)
    return NextResponse.json({ error: 'Failed to clean notes. Please try again.' }, { status: 500 })
  }
}
