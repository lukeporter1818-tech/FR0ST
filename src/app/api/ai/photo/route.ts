import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'
import { FROST_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { requireApiSession, unauthorized } from '@/lib/auth-guard'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { imageBase64 } = raw as { imageBase64?: string }
  if (!imageBase64) {
    return Response.json({ error: 'No image provided' }, { status: 400 })
  }

  const match = imageBase64.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/)
  if (!match) {
    return Response.json({ error: 'Invalid image format. Use JPEG or PNG.' }, { status: 400 })
  }

  const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  const base64Data = match[3]

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: FROST_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
            { type: 'text', text: '[PHOTO PART] Identify this commercial refrigeration component. Read any visible nameplates, model numbers, and labels.' },
          ],
        },
      ],
    })

    const encoder = new TextEncoder()

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          controller.close()
        } catch (err) {
          console.error('[photo route] stream error:', err)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[photo route] error:', error)
    return Response.json({ error: 'Failed to analyze image.' }, { status: 500 })
  }
}
