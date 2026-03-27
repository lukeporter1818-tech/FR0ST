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

  // ── Mode detection (deterministic, zero extra API cost) ──────────────────────
  //
  // PHOTO PART mode:  imageBase64 present → the client already tried work-order
  //   extraction before calling us and it failed, so this is a physical component
  //   photo. Inject [PHOTO PART] so the system prompt routes to part-recognition.
  //
  // PARTS QUERY mode: text-only query with model numbers / part keywords. Only
  //   active when there is no image (image takes priority).
  const photoMode = !!imageBase64
  const lastUserMsg = [...trimmedMessages].reverse().find((m) => m.role === 'user')
  const textPartsMode = !photoMode && (lastUserMsg ? isPartsQuery(lastUserMsg.content) : false)
  const modePrefix = photoMode ? '[PHOTO PART]' : textPartsMode ? '[PARTS QUERY]' : ''

  const claudeMessages: Anthropic.MessageParam[] = trimmedMessages.map(
    (m, index) => {
      const isLastUserMessage = index === trimmedMessages.length - 1 && m.role === 'user'

      // Prepend mode marker to the last user message text (skip if already prefixed)
      const userText = m.content.trim()
      const alreadyPrefixed = userText.startsWith('[PHOTO PART]') || userText.startsWith('[PARTS QUERY]')
      const resolvedText = (isLastUserMessage && modePrefix && !alreadyPrefixed)
        ? (userText ? `${modePrefix} ${userText}` : modePrefix)
        : m.content

      if (isLastUserMessage && imageBase64) {
        const match = imageBase64.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/)
        if (match) {
          const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
          const base64Data = match[3]

          const content: Anthropic.ContentBlockParam[] = [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          ]

          // Use a rich default prompt when user sent no text — gives Frost
          // enough instruction to return a fully structured part-recognition response
          const stripped = resolvedText.trim()
          const imgText = (stripped && stripped !== '[PHOTO PART]' && stripped !== '[PARTS QUERY]')
            ? stripped
            : '[PHOTO PART] Identify this commercial component. Read any visible nameplates, model numbers, and labels.'

          content.push({ type: 'text', text: imgText })
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
      meta: { endpoint: 'assistant', hasImage: photoMode, turns: messages.length, mode: modePrefix || 'normal' },
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
