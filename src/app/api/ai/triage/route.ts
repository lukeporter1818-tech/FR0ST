import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { askAI } from '@/lib/ai'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { prisma } from '@/lib/db'
import { requireApiRole, forbidden, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { aiTriageSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'

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

  const result = aiTriageSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { issueDescription, customerName, address, existingNotes } = result.data

  const userMessage = `Triage the following incoming service call and return your analysis as JSON ONLY. No markdown, no explanation — just a valid JSON object.

**Issue Description:** ${issueDescription}
${customerName ? `**Customer:** ${customerName}` : ''}
${address ? `**Address:** ${address}` : ''}
${existingNotes ? `**Existing Notes:** ${existingNotes}` : ''}

Return this exact JSON structure:
{
  "summary": "2-3 sentence summary of the issue and recommended approach",
  "tradeClassification": "HVAC | REFRIGERATION | PLUMBING | ELECTRICAL | MULTI | UNKNOWN",
  "urgency": "LOW | NORMAL | HIGH | EMERGENCY",
  "followUpQuestions": ["questions the dispatcher should ask the customer"],
  "riskFlags": ["any safety or operational risks identified"],
  "safetyNotes": "any safety considerations for the technician, or null if none"
}`

  try {
    const rawResponse = await askAI(SYSTEM_PROMPT, userMessage, 1024)

    let parsed
    try {
      parsed = JSON.parse(rawResponse)
    } catch {
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse AI response')
      }
    }

    // Log with real userId
    try {
      await prisma.aIInteraction.create({
        data: {
          userId: session.user.id,
          actionType: 'triage',
          prompt: userMessage,
          response: JSON.stringify(parsed),
        },
      })
    } catch {
      // Non-critical
    }

    auditLog({
      action: 'ai.query',
      userId: session.user.id,
      userRole: session.user.role,
      meta: { endpoint: 'triage', urgency: parsed?.urgency },
    })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('AI triage error:', error)
    return NextResponse.json({ error: 'Failed to triage issue. Please try again.' }, { status: 500 })
  }
}
