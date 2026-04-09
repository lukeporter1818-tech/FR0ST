import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { askAI } from '@/lib/ai'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiRole, forbidden, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { aiSummarizeBoardSchema } from '@/lib/validations'

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

  const result = aiSummarizeBoardSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { date, scheduleData } = result.data

  const boardDescription = scheduleData
    .map(
      (tech) =>
        `**${tech.techName}** (${tech.jobs.length} jobs):\n${tech.jobs.map((j, i) => `  ${i + 1}. ${j.customer} — ${j.issue} [${j.priority}]`).join('\n')}`
    )
    .join('\n\n')

  const userMessage = `Summarize the dispatch board for ${date}. Return your response as JSON ONLY — no markdown, no explanation.

**Schedule:**
${boardDescription}

Return this exact JSON structure:
{
  "summary": "Brief narrative summary of the day",
  "warnings": ["any concerns: overloaded techs, unassigned urgents, etc."],
  "suggestions": ["actionable suggestions to improve the schedule"]
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
    console.error('AI summarize-board error:', error)
    return NextResponse.json({ error: 'Failed to summarize board. Please try again.' }, { status: 500 })
  }
}
