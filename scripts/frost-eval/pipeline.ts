// -----------------------------------------------------------------------------
// COPIED-FROM-ROUTE NOTICE
//
// The parts-query prefixing, excerpt block formatting, operational-context
// assembly, Anthropic call parameters, and the post-stream pinned-procedure
// append in this file are exact copies of the logic in
// src/app/api/ai/assistant/route.ts. These sections are not exported as shared
// helpers in the app, so this harness duplicates them. If
// src/app/api/ai/assistant/route.ts changes any of those sections, THIS FILE
// MUST BE UPDATED to match. The harness prints an mtime comparison line on
// each invocation so drift is visible.
//
// The pinned procedure text itself is built via the shared exported function
// buildPinnedProcedureText in src/lib/ai/retrieve-knowledge.ts, so the block
// contents (safety-marker detection, boilerplate stripping, MAX_PINNED_PROCEDURES)
// cannot drift between route and harness even when this file is edited by hand.
// The terse per-request instruction that fires alongside the pinned block is
// built by buildPinnedProcedureInstruction in the same file — same relevance
// gate, same guards. The block and the instruction always fire together or
// not at all.
//
// This file is invocation-only. It performs no database writes. No
// AIInteraction rows are created. No audit log entries are written.
// -----------------------------------------------------------------------------

import fs from 'node:fs'
import path from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { FROST_SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { isPartsQuery } from '@/lib/ai/parts-detector'
import { retrieveApprovedFixes } from '@/lib/ai/retrieve-fixes'
import { retrieveKnowledge, buildPinnedProcedureText, buildPinnedProcedureInstruction } from '@/lib/ai/retrieve-knowledge'
import { prisma } from '@/lib/db'

const ROUTE_REL_PATH = 'src/app/api/ai/assistant/route.ts'
const PIPELINE_REL_PATH = 'scripts/frost-eval/pipeline.ts'

export function printMtimeWarning(projectRoot: string): void {
  try {
    const routeStat = fs.statSync(path.join(projectRoot, ROUTE_REL_PATH))
    const pipelineStat = fs.statSync(path.join(projectRoot, PIPELINE_REL_PATH))
    const routeAt = routeStat.mtime.toISOString()
    const pipelineAt = pipelineStat.mtime.toISOString()
    const stale = routeStat.mtime.getTime() > pipelineStat.mtime.getTime()
    const marker = stale ? '⚠ STALE — route.ts is newer than pipeline.ts' : 'ok'
    console.log(
      `[pipeline drift check] route.ts modified ${routeAt} | pipeline.ts modified ${pipelineAt} | ${marker}`,
    )
    if (stale) {
      console.log(
        '[pipeline drift check] The copied sections (parts-query prefixing, excerpt block, operational context, Anthropic call) may be out of date. Compare pipeline.ts against src/app/api/ai/assistant/route.ts before trusting results.',
      )
    }
  } catch (err) {
    console.log(
      `[pipeline drift check] could not read mtimes: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RunResult {
  answer: string
  knowledgeSearchRan: boolean
  knowledgeMatchCount: number
  mode: 'parts' | 'normal'
}

export async function runQuestion(question: string): Promise<RunResult> {
  const userText = question.trim()

  // COPIED — mode detection (photo mode always false in the harness).
  const photoMode = false
  const textPartsMode = !photoMode && isPartsQuery(userText)
  const modePrefix = textPartsMode ? '[PARTS QUERY]' : ''

  // COPIED — user message prefixing (single-turn in the harness).
  const alreadyPrefixed =
    userText.startsWith('[PHOTO PART]') || userText.startsWith('[PARTS QUERY]')
  const resolvedText =
    modePrefix && !alreadyPrefixed
      ? userText
        ? `${modePrefix} ${userText}`
        : modePrefix
      : userText

  // COPIED — fix context (skipped for parts mode, as the route does).
  const fixContext =
    !photoMode && !textPartsMode && userText.length >= 5
      ? await retrieveApprovedFixes(userText).catch(() => '')
      : ''

  // Real retrieval — exercises the reranker path in retrieve-knowledge.ts.
  let knowledgeMatches: Awaited<ReturnType<typeof retrieveKnowledge>> = []
  let knowledgeSearchRan = false
  if (!photoMode && userText.length >= 5) {
    try {
      knowledgeMatches = await retrieveKnowledge(userText)
      knowledgeSearchRan = true
    } catch (err) {
      console.error('[harness] retrieval failed:', err)
    }
  }

  // COPIED — operational context (schedule + stores + known store issues).
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
        select: {
          id: true,
          code: true,
          name: true,
          city: true,
          state: true,
          zone: true,
          equipment: true,
        },
        take: 60,
      }),
    ])

    const scheduleLines = boardEntries
      .filter((e) => e.assignment)
      .map((e) => {
        const name = e.technician?.name ?? e.manualName ?? 'Unknown'
        const firstName = name.split(' ')[0]
        return `- ${firstName}: ${e.assignment}${e.note ? ` (${e.note})` : ''}${e.status ? ` [${e.status}]` : ''}`
      })

    const storeLines = stores.map(
      (s) =>
        `- ${s.code}: ${s.name}${s.city ? `, ${s.city}` : ''}${s.state ? ` ${s.state}` : ''}${s.zone ? ` | Zone: ${s.zone}` : ''}${s.equipment ? ` | Equipment: ${s.equipment}` : ''}`,
    )

    const storeIdsByCode = stores
      .filter((s) => userText.toUpperCase().includes(s.code))
      .map((s) => s.id)

    const ZONES = ['North', 'South', 'East', 'West'] as const
    const mentionedZones = ZONES.filter((z) =>
      new RegExp(`\\b${z}\\b`, 'i').test(userText),
    )
    const storeIdsByZone =
      mentionedZones.length > 0
        ? stores
            .filter(
              (s) =>
                s.zone !== null && mentionedZones.some((z) => z === s.zone),
            )
            .map((s) => s.id)
        : []

    const relevantStoreIds = Array.from(
      new Set([...storeIdsByCode, ...storeIdsByZone]),
    )

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
        const issueLines = issues.map(
          (i) =>
            `- [${i.store.code}] ${i.systemType}: ${i.description}${i.resolution ? ` → Fixed: ${i.resolution}` : ' (unresolved)'}  (logged by ${i.reportedBy.name.split(' ')[0]}, ${i.createdAt.toLocaleDateString()})`,
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
    console.error('[harness] operational context failed:', err)
  }

  // COPIED — excerpt context assembly.
  const excerptContext =
    knowledgeMatches.length > 0
      ? '\n\nMANUAL EXCERPTS (from indexed service documents — use when relevant):\n\n' +
        knowledgeMatches
          .map(
            (m, i) =>
              `[${i + 1}] ${m.title}${m.page != null ? `, p. ${m.page}` : ''}\n${m.text}`,
          )
          .join('\n\n')
      : knowledgeSearchRan
        ? '\n\nMANUAL EXCERPTS: No relevant excerpts found.'
        : ''

  // COPIED — per-request instruction, same guards as the pinned block below.
  const pinnedInstructionContext =
    !photoMode && !textPartsMode
      ? buildPinnedProcedureInstruction(userText, knowledgeMatches)
      : ''

  // COPIED — Anthropic call parameters (model, max_tokens, temperature, system).
  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    temperature: 0.3,
    system: FROST_SYSTEM_PROMPT + operationalContext + excerptContext + pinnedInstructionContext + fixContext,
    messages: [{ role: 'user', content: resolvedText }],
  })

  let fullText = ''
  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      fullText += chunk.delta.text
    }
  }

  // COPIED — pinned procedure text, same guards as the route
  // (skip in parts mode and photo mode; the shared helper builds the block
  // from retrieve-knowledge.ts so route and harness cannot drift).
  try {
    if (!photoMode && !textPartsMode) {
      const pinned = buildPinnedProcedureText(userText, knowledgeMatches)
      if (pinned) fullText += pinned
    }
  } catch (err) {
    console.error('[harness] failed to append pinned procedure text:', err)
  }

  return {
    answer: fullText,
    knowledgeSearchRan,
    knowledgeMatchCount: knowledgeMatches.length,
    mode: textPartsMode ? 'parts' : 'normal',
  }
}

export async function shutdown(): Promise<void> {
  try {
    await prisma.$disconnect()
  } catch {
    // Non-fatal.
  }
}
