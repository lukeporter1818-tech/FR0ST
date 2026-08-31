import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'
import { FROST_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { isPartsQuery } from '@/lib/ai/parts-detector'
import { retrieveApprovedFixes } from '@/lib/ai/retrieve-fixes'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimitDb, LIMITS } from '@/lib/rate-limit'
import { aiAssistantSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'
import { prisma } from '@/lib/db'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  // Rate limit per user, not per IP — multiple users behind a corporate NAT
  // would otherwise share a single bucket and exhaust it immediately.
  const allowed = await rateLimitDb(session.user.id, LIMITS.AI.limit, LIMITS.AI.windowMs)
  if (!allowed) {
    return tooManyRequests()
  }

  // Daily cap: 50 FR0ST messages per user per day
  const today = new Date().toISOString().slice(0, 10)
  const dailyCount = await prisma.aIInteraction.count({
    where: {
      userId: session.user.id,
      actionType: 'frost.chat',
      createdAt: {
        gte: new Date(today),
        lt: new Date(new Date(today).getTime() + 86_400_000),
      },
    },
  }).catch(() => 0)

  if (dailyCount >= 50) {
    return Response.json(
      { error: "You've reached your 50 message daily limit for FR0ST. Resets at midnight." },
      { status: 429 }
    )
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
  const trimmedMessages = messages.slice(-10).filter((m, index, arr) => {
    const isLast = index === arr.length - 1
    return m.content.trim().length > 0 || isLast
  })

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

  // Retrieve relevant approved company fixes (keyword match, no AI call).
  // Skip for photo mode (no useful text to match against) and parts-query mode
  // (parts questions need OEM specs, not company fix history — the DB round-trip
  // adds latency with no benefit for that mode).
  const queryText = lastUserMsg?.content ?? ''
  const fixContext = (!photoMode && !textPartsMode && queryText.length >= 5)
    ? await retrieveApprovedFixes(queryText).catch(() => '')
    : ''

  // ── Operational context ───────────────────────────────────────────────────────
  // Fetch today's board + store list to inject into FR0ST's system prompt.
  // Non-fatal — if DB is unavailable, FR0ST still responds without context.

  let operationalContext = ''
  try {
    const today = new Date().toISOString().slice(0, 10)

    const [boardEntries, stores] = await Promise.all([
      prisma.boardEntry.findMany({
        where: { date: new Date(today) },
        include: { technician: { select: { name: true } } },
        orderBy: { orderIndex: 'asc' },
        take: 30,
      }),
      prisma.store.findMany({
        where: { active: true },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, city: true, state: true, zone: true, equipment: true },
        take: 60,
      }),
    ])

    // Build schedule summary
    const scheduleLines = boardEntries
      .filter((e) => e.assignment)
      .map((e) => {
        const name = e.technician?.name ?? e.manualName ?? 'Unknown'
        const firstName = name.split(' ')[0]
        return `- ${firstName}: ${e.assignment}${e.note ? ` (${e.note})` : ''}${e.status ? ` [${e.status}]` : ''}`
      })

    // Build store list
    const storeLines = stores.map((s) =>
      `- ${s.code}: ${s.name}${s.city ? `, ${s.city}` : ''}${s.state ? ` ${s.state}` : ''}${s.zone ? ` | Zone: ${s.zone}` : ''}${s.equipment ? ` | Equipment: ${s.equipment}` : ''}`
    )

    // Check if query mentions a specific store code
    const storeIdsByCode = stores
      .filter((s) => queryText.toUpperCase().includes(s.code))
      .map((s) => s.id)

    // Check if query mentions a zone name (word-bounded, case-insensitive)
    const ZONES = ['North', 'South', 'East', 'West'] as const
    const mentionedZones = ZONES.filter((z) =>
      new RegExp(`\\b${z}\\b`, 'i').test(queryText)
    )
    const storeIdsByZone = mentionedZones.length > 0
      ? stores
          .filter((s) => s.zone !== null && mentionedZones.some((z) => z === s.zone))
          .map((s) => s.id)
      : []

    const relevantStoreIds = Array.from(new Set([...storeIdsByCode, ...storeIdsByZone]))

    let issueContext = ''
    if (relevantStoreIds.length > 0) {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const issues = await prisma.storeIssueLog.findMany({
        where: {
          storeId: { in: relevantStoreIds },
          resolvedAt: null,
          createdAt: { gte: ninetyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          store: { select: { code: true, name: true } },
          reportedBy: { select: { name: true } },
        },
      })

      if (issues.length > 0) {
        const issueLines = issues.map((i) =>
          `- [${i.store.code}] ${i.systemType}: ${i.description}${i.resolution ? ` → Fixed: ${i.resolution}` : ' (unresolved)'}  (logged by ${i.reportedBy.name.split(' ')[0]}, ${i.createdAt.toLocaleDateString()})`
        )
        issueContext = `\n\nKNOWN STORE ISSUES:\n${issueLines.join('\n')}`
      }
    }

    operationalContext = `

---
LIVE OPERATIONAL CONTEXT (today: ${today}):

TODAY'S SCHEDULE:
${scheduleLines.length > 0 ? scheduleLines.join('\n') : '- No assignments yet today'}

ACTIVE STORES:
${storeLines.join('\n')}${issueContext}
---`
  } catch (err) {
    // Non-fatal — operational context unavailable
    console.error('[assistant route] failed to load operational context:', err)
  }

  auditLog({
    action: 'ai.query',
    userId: session.user.id,
    meta: { endpoint: 'assistant', hasImage: photoMode, turns: messages.length, mode: modePrefix || 'normal' },
  })

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      temperature: 0.3,
      system: FROST_SYSTEM_PROMPT + operationalContext + fixContext,
      messages: claudeMessages,
    })

    const encoder = new TextEncoder()
    let fullText = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              fullText += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          // Log interaction for Frost learning system — non-fatal if DB write fails
          let interactionId: string | undefined
          try {
            const lastUserMessage = trimmedMessages.filter((m) => m.role === 'user').pop()
            const interaction = await prisma.aIInteraction.create({
              data: {
                userId: session.user.id,
                actionType: 'frost.chat',
                prompt: lastUserMessage?.content ?? '',
                response: fullText,
              },
              select: { id: true },
            })
            interactionId = interaction.id
          } catch {
            // Non-fatal: learning log unavailable, response still delivered
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, interactionId })}\n\n`))
          controller.close()
        } catch (err) {
          console.error('AI assistant stream error:', err)
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
    console.error('AI assistant error:', error)
    return Response.json({ error: 'Failed to get a response. Please try again.' }, { status: 500 })
  }
}
