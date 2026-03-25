import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { aiAssistantSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'

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

  const claudeMessages: Anthropic.MessageParam[] = messages.map(
    (m, index) => {
      const isLastUserMessage = index === messages.length - 1 && m.role === 'user'

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
            text: m.content.trim() || 'What can you tell me about this? Please describe what you see and any relevant technical findings.',
          })

          return { role: 'user', content }
        }
      }

      return { role: m.role, content: m.content }
    }
  )

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: claudeMessages,
    })

    const block = response.content[0]
    const text = block.type === 'text' ? block.text : ''

    auditLog({
      action: 'ai.query',
      userId: session.user.id,
      meta: { endpoint: 'assistant', hasImage: !!imageBase64, turns: messages.length },
    })

    return Response.json({ response: text })
  } catch (error) {
    console.error('AI assistant error:', error)
    return Response.json({ error: 'Failed to get a response. Please try again.' }, { status: 500 })
  }
}
