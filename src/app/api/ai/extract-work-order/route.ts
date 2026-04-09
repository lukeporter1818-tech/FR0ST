import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, LIMITS } from '@/lib/rate-limit'
import { extractWorkOrderSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'
import type { WorkOrderExtraction } from '@/types/work-order'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_SYSTEM_PROMPT = `You are a work order extraction engine for a field service dispatch platform.

When given an image, extract work order information and return ONLY a valid JSON object with this exact schema — no markdown fences, no explanation, no prose:

{
  "detected": true,
  "workOrderNumber": "string or null",
  "shortDescription": "string or null",
  "siteName": "string or null",
  "callType": "string or null",
  "priority": "string or null",
  "confidence": "high"
}

Field rules:
- detected: true if the image shows a work order, service ticket, dispatch sheet, or similar document; false otherwise
- workOrderNumber: the WO/ticket/job number if visible (e.g. "WO-1042", "TKT-8823")
- shortDescription: the issue or work description — 1–2 sentences max, plain text only
- siteName: site name, customer name, or address
- callType: the type of call as shown (e.g. "Service", "PM", "Install", "Emergency")
- priority: urgency/priority as shown (e.g. "High", "P1", "Normal", "Emergency")
- confidence: "high" if text is clearly legible; "medium" if partially legible or some fields inferred; "low" if the image is blurry, skewed, or fields are mostly guessed

If detected is false, all other fields must be null and confidence must be "low".
Return ONLY the JSON object. No other text.`

export async function POST(req: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  // Per-user bucket (same pool as assistant) — avoids corporate-NAT IP-sharing issues
  if (!rateLimit(`ai:${session.user.id}`, LIMITS.AI.limit, LIMITS.AI.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = extractWorkOrderSchema.safeParse(raw)
  if (!result.success) {
    return Response.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { imageBase64 } = result.data

  // Parse the data URL — must be a supported image type
  const match = imageBase64.match(/^data:(image\/(jpeg|png|gif|webp));base64,(.+)$/)
  if (!match) {
    return Response.json({ error: 'imageBase64 must be a valid image data URL (jpeg, png, gif, or webp)' }, { status: 400 })
  }

  const mediaType = match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  const base64Data = match[3]

  // 20 s hard timeout — extraction is faster than general chat;
  // if it hasn't responded by 20 s it's safe to surface an error.
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error('AI_TIMEOUT')), 20_000)
  })

  try {
    const response = await Promise.race([
      anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512, // Extraction output is small — cap tightly
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: 'Extract the work order information from this image.' },
            ],
          },
        ],
      }),
      timeoutPromise,
    ])
    clearTimeout(timeoutHandle)

    const block = response.content[0]
    if (block.type !== 'text') {
      return Response.json({ error: 'Unexpected response from extraction model' }, { status: 500 })
    }

    // Parse the JSON response — Claude is instructed to return only JSON
    let extraction: WorkOrderExtraction
    try {
      extraction = JSON.parse(block.text.trim()) as WorkOrderExtraction
    } catch {
      // Model returned non-JSON — treat as undetected rather than crashing
      extraction = {
        detected: false,
        workOrderNumber: null,
        shortDescription: null,
        siteName: null,
        callType: null,
        priority: null,
        confidence: 'low',
      }
    }

    // Validate the shape Claude returned — coerce any unexpected values safely
    const sanitized: WorkOrderExtraction = {
      detected: extraction.detected === true,
      workOrderNumber: typeof extraction.workOrderNumber === 'string' ? extraction.workOrderNumber.slice(0, 100) : null,
      shortDescription: typeof extraction.shortDescription === 'string' ? extraction.shortDescription.slice(0, 300) : null,
      siteName: typeof extraction.siteName === 'string' ? extraction.siteName.slice(0, 200) : null,
      callType: typeof extraction.callType === 'string' ? extraction.callType.slice(0, 50) : null,
      priority: typeof extraction.priority === 'string' ? extraction.priority.slice(0, 50) : null,
      confidence: ['high', 'medium', 'low'].includes(extraction.confidence) ? extraction.confidence : 'low',
    }

    auditLog({
      action: 'ai.query',
      userId: session.user.id,
      meta: { endpoint: 'extract-work-order', detected: sanitized.detected, confidence: sanitized.confidence },
    })

    return Response.json(sanitized)
  } catch (error) {
    clearTimeout(timeoutHandle)
    if (error instanceof Error && error.message === 'AI_TIMEOUT') {
      return Response.json({ error: 'Extraction timed out. Please try again.' }, { status: 504 })
    }
    console.error('Work order extraction error:', error)
    return Response.json({ error: 'Extraction failed. Please try again.' }, { status: 500 })
  }
}
