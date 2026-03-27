import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'
import { FROST_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { isPartsQuery } from '@/lib/ai/parts-detector'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { aiAssistantSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'
import { prisma } from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  if (!rateLimit(`ai:${getClientIp(req)}`, LIMITS.AI.limit, LIMITS.AI.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = aiAssistantSchema.safeParse(raw)
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { messages, imageBase64 } = result.data

  // Trim to last 10 messages before sending — keeps payloads small
  const trimmedMessages = messages.slice(-10)

  // Deterministic parts-query detection on the last user message — zero extra API cost.
  // When triggered, we prefix the text with [PARTS QUERY] so the system prompt
  // routes Frost into Parts Finder mode with the correct response format.
  const lastUserMsg = [...trimmedMessages].reverse().find((m) => m.role === 'user')
  const partsMode = lastUserMsg ? isPartsQuery(lastUserMsg.content) : false

  const claudeMessages: Anthropic.MessageParam[] = trimmedMessages.map(
    (m, index) => {
      const isLastUserMessage = index === trimmedMessages.length - 1 && m.role === 'user'

      // Prepend parts-mode marker to the last user message text
      const resolvedText = (isLastUserMessage && partsMode && !m.content.startsWith('[PARTS QUERY]'))
        ? `[PARTS QUERY] ${m.content}`
        : m.content

      if (isLastUserMessage && imageBase64) {
        const match = imageBase64.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/)
        if (match) {
          const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
          const base64Data = match[3]

          const content: Anthropic.ContentBlockParam[] = [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          ]

          content.push({
            type: 'text',
            text: resolvedText.trim() || 'What can you tell me about this? Please describe what you see and any relevant technical findings.',
          })

          return { role: 'user', content }
        }
      }

      return { role: m.role, content: isLastUserMessage ? resolvedText : m.content }
    }
  )

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      temperature: 0.3,
      system: FROST_SYSTEM_PROMPT,
      messages: claudeMessages,
    })

    const block = response.content[0]
    const text = block.type === 'text' ? block.text : ''

    auditLog({
      action: 'ai.query',
      userId: session.user.id,
      meta: { endpoint: 'assistant', hasImage: !!imageBase64, turns: messages.length, partsMode },
    })

    // Log interaction for Frost learning system — non-fatal if DB write fails
    let interactionId: string | undefined
    try {
      const lastUserMessage = trimmedMessages.filter((m) => m.role === 'user').pop()
      const interaction = await prisma.aIInteraction.create({
        data: {
          userId: session.user.id,
          actionType: 'frost.chat',
          prompt: lastUserMessage?.content ?? '',
          response: text,
        },
        select: { id: true },
      })
      interactionId = interaction.id
    } catch {
      // Non-fatal: learning log unavailable, response still delivered
    }

    return Response.json({ response: text, interactionId })
  } catch (error) {
    console.error('AI assistant error:', error)
    return Response.json({ error: 'Failed to get a response. Please try again.' }, { status: 500 })
  }
}
