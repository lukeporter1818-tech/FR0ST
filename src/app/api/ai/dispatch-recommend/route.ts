import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiRole, forbidden, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { auditLog } from '@/lib/audit'
import { cuidSchema } from '@/lib/validations'
import { z } from 'zod'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const schema = z.object({ jobId: cuidSchema })

// Techs with these statuses are never recommended
const UNAVAILABLE = new Set(['OFF', 'VACATION', 'SICK'])

// Which tech tradeTypes can work each job trade
const TRADE_COMPAT: Record<string, string[]> = {
  HVAC:          ['HVAC', 'MULTI'],
  REFRIGERATION: ['REFRIGERATION', 'MULTI'],
  PLUMBING:      ['PLUMBING', 'MULTI'],
  ELECTRICAL:    ['ELECTRICAL', 'MULTI'],
  MULTI:         ['HVAC', 'REFRIGERATION', 'PLUMBING', 'ELECTRICAL', 'MULTI'],
}

type ScoredTech = {
  id: string
  name: string
  tradeType: string | null
  openJobs: number
  score: number
}

// Builds 2–4 plain-language reason strings from already-computed scoring context.
// No AI call — purely derived from data already in memory.
function buildReasons(
  rec: ScoredTech,
  second: ScoredTech | undefined,
  scoreDiff: number,
  jobTrade: string | null,
  eligibleCount: number
): string[] {
  const r: string[] = []

  // Trade match or mismatch
  if (jobTrade && jobTrade !== 'UNKNOWN') {
    const techTrade = rec.tradeType?.toUpperCase() ?? ''
    const compat = TRADE_COMPAT[jobTrade] ?? []
    if (compat.includes(techTrade)) {
      r.push(`Trade match — ${rec.tradeType} for ${jobTrade} job`)
    } else if (!rec.tradeType) {
      r.push(`Trade unset — selected by workload only`)
    } else {
      r.push(`No ${jobTrade} tech available — best fit by workload`)
    }
  }

  // Workload
  if (rec.openJobs === 0) {
    r.push('No open jobs — fully available')
  } else {
    r.push(`${rec.openJobs} open job${rec.openJobs > 1 ? 's' : ''} — lowest current workload`)
  }

  // Score gap or only tech
  if (eligibleCount === 1) {
    r.push('Only available technician')
  } else if (second && scoreDiff >= 35) {
    r.push(`Clear lead — ${scoreDiff} points ahead of ${second.name}`)
  }

  return r.slice(0, 4)
}

function scoreAndRank(
  techs: Array<{ id: string; name: string; tradeType: string | null; status: string; _count: { jobs: number } }>,
  jobTrade: string | null
): ScoredTech[] {
  return techs
    .map((tech): ScoredTech => {
      if (UNAVAILABLE.has(tech.status)) {
        return { id: tech.id, name: tech.name, tradeType: tech.tradeType, openJobs: tech._count.jobs, score: -999 }
      }

      let score = 100
      score -= tech._count.jobs * 15 // workload: fewer open jobs = higher score

      if (jobTrade && jobTrade !== 'UNKNOWN') {
        const techTrade = tech.tradeType?.toUpperCase() ?? ''
        const compat = TRADE_COMPAT[jobTrade] ?? []
        if (compat.includes(techTrade)) {
          score += 40 // trade match
        } else if (techTrade === 'MULTI') {
          score += 15 // multi-trade partial match
        } else if (techTrade) {
          score -= 30 // clear trade mismatch
        }
        // no tradeType set on tech → neutral
      }

      return { id: tech.id, name: tech.name, tradeType: tech.tradeType, openJobs: tech._count.jobs, score }
    })
    .sort((a, b) => b.score - a.score)
}

export async function POST(req: NextRequest) {
  const session = await requireApiRole('DISPATCHER')
  if (!session) return forbidden()

  if (!rateLimit(`ai:${getClientIp(req)}`, LIMITS.AI.limit, LIMITS.AI.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { jobId } = parsed.data

  // Lean job fetch — only fields needed for dispatch context
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      tradeClassification: true,
      priority: true,
      jobType: true,
      issueDescription: true,
      city: true,
      state: true,
      status: true,
      assignedTechId: true,
    },
  })

  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 })

  // Lean technician fetch — name, trade, status, and open-job count only
  const techs = await prisma.technician.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      tradeType: true,
      status: true,
      _count: {
        select: {
          jobs: { where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // ── Missing info flags ────────────────────────────────────────────────────────
  const missingInfo: string[] = []
  if (!job.tradeClassification || job.tradeClassification === 'UNKNOWN') {
    missingInfo.push('No trade set — run AI Analysis or set trade manually for better matching')
  }

  // ── No techs available at all ─────────────────────────────────────────────────
  const anyAvailable = techs.some((t) => !UNAVAILABLE.has(t.status))
  if (!anyAvailable) {
    return Response.json({
      source: 'deterministic',
      recommended: null,
      backups: [],
      reasoning: 'No technicians are currently available.',
      riskFlags: ['All technicians are unavailable (OFF / VACATION / SICK)'],
      missingInfo,
      confidence: 'low',
    })
  }

  // ── Deterministic scoring pass ─────────────────────────────────────────────────
  const ranked = scoreAndRank(techs, job.tradeClassification)
  const eligible = ranked.filter((t) => t.score > -900) // exclude unavailable

  if (eligible.length === 0) {
    return Response.json({
      source: 'deterministic',
      recommended: null,
      backups: [],
      reasoning: 'No eligible technicians found for this trade.',
      riskFlags: ['No qualified technicians available'],
      missingInfo,
      confidence: 'low',
    })
  }

  const [best, second] = eligible
  const scoreDiff = second ? best.score - second.score : 999
  // Clear winner: one tech OR best is ≥35 points ahead
  const isObviousWinner = eligible.length === 1 || scoreDiff >= 35

  if (isObviousWinner) {
    const backups = eligible
      .slice(1, 3)
      .map(({ id, name, tradeType, openJobs }) => ({ id, name, tradeType, openJobs }))

    let reasoning = `${best.name} is the best match`
    if (job.tradeClassification && job.tradeClassification !== 'UNKNOWN') {
      reasoning += ` for ${job.tradeClassification} work`
    }
    reasoning +=
      best.openJobs === 0
        ? ' with no current open jobs'
        : ` with ${best.openJobs} open job${best.openJobs > 1 ? 's' : ''}`
    if (second && scoreDiff >= 35) {
      reasoning += `. Clear lead over ${second.name}.`
    } else {
      reasoning += '.'
    }

    const riskFlags: string[] = []
    if (best.openJobs >= 3) riskFlags.push(`${best.name} has ${best.openJobs} open jobs — high workload`)
    if (missingInfo.length > 0) riskFlags.push('Trade missing — matched by workload only')

    auditLog({
      action: 'ai.query',
      userId: session.user.id,
      meta: { endpoint: 'dispatch-recommend', source: 'deterministic', jobId },
    })

    return Response.json({
      source: 'deterministic',
      recommended: { id: best.id, name: best.name, tradeType: best.tradeType, openJobs: best.openJobs },
      backups,
      reasoning,
      reasons: buildReasons(best, second, scoreDiff, job.tradeClassification, eligible.length),
      riskFlags,
      missingInfo,
      confidence: scoreDiff >= 60 ? 'high' : 'medium',
    })
  }

  // ── AI-assisted pass (ambiguous — multiple plausible techs) ───────────────────
  // Only called when deterministic scoring leaves genuine ambiguity.
  const techLines = eligible
    .slice(0, 6)
    .map((t) => `- ${t.name} | trade: ${t.tradeType ?? 'unset'} | open jobs: ${t.openJobs}`)
    .join('\n')

  const prompt = `Dispatch recommendation. Return JSON only — no markdown, no explanation.

Job:
- Trade: ${job.tradeClassification ?? 'unknown'}
- Priority: ${job.priority}
- Type: ${job.jobType}
- Issue: ${job.issueDescription.slice(0, 150)}${job.issueDescription.length > 150 ? '…' : ''}
${job.city ? `- Location: ${[job.city, job.state].filter(Boolean).join(', ')}` : ''}

Available technicians:
${techLines}

Return exactly:
{"recommended":"<name>","backups":["<name>"],"reasoning":"<2 sentences max>","riskFlags":["<flag>"],"confidence":"high|medium|low"}`

  try {
    const aiRes = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      temperature: 0.1,
      system: 'You are a dispatch assistant. Return concise JSON only. No markdown. Pick the best technician for the job based on trade match and workload.',
      messages: [{ role: 'user', content: prompt }],
    })

    const block = aiRes.content[0]
    const text = block.type === 'text' ? block.text.trim() : ''

    let aiData: {
      recommended?: string
      backups?: string[]
      reasoning?: string
      riskFlags?: string[]
      confidence?: string
    }
    try {
      aiData = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      aiData = match ? JSON.parse(match[0]) : {}
    }

    // Map AI name strings back to tech objects safely
    const techByName = new Map(eligible.map((t) => [t.name.toLowerCase(), t]))
    const recTech = aiData.recommended
      ? (techByName.get(aiData.recommended.toLowerCase()) ?? eligible[0])
      : eligible[0]

    const backupTechs = (aiData.backups ?? [])
      .map((n: string) => techByName.get(n.toLowerCase()))
      .filter((t): t is ScoredTech => !!t && t.id !== recTech.id)
      .slice(0, 2)
      .map(({ id, name, tradeType, openJobs }) => ({ id, name, tradeType, openJobs }))

    const allRiskFlags = Array.isArray(aiData.riskFlags) ? aiData.riskFlags : []
    if (recTech.openJobs >= 3) allRiskFlags.push(`${recTech.name} has ${recTech.openJobs} open jobs`)

    auditLog({
      action: 'ai.query',
      userId: session.user.id,
      meta: { endpoint: 'dispatch-recommend', source: 'ai', jobId },
    })

    // Build reasons from scoring context (already computed) — no extra AI call
    const recScore = eligible.find((t) => t.id === recTech.id) ?? recTech
    const recSecond = eligible.find((t) => t.id !== recTech.id)
    const recDiff = recSecond ? recTech.score - recSecond.score : 999

    return Response.json({
      source: 'ai',
      recommended: { id: recTech.id, name: recTech.name, tradeType: recTech.tradeType, openJobs: recTech.openJobs },
      backups: backupTechs,
      reasoning: aiData.reasoning ?? '',
      reasons: buildReasons(recScore, recSecond, recDiff, job.tradeClassification, eligible.length),
      riskFlags: allRiskFlags,
      missingInfo,
      confidence: (aiData.confidence as 'high' | 'medium' | 'low') ?? 'medium',
    })
  } catch (err) {
    console.error('[dispatch-recommend] AI error:', err)
    // Graceful fallback to deterministic result — never surface a raw error
    const backups = eligible
      .slice(1, 3)
      .map(({ id, name, tradeType, openJobs }) => ({ id, name, tradeType, openJobs }))

    return Response.json({
      source: 'deterministic',
      recommended: { id: best.id, name: best.name, tradeType: best.tradeType, openJobs: best.openJobs },
      backups,
      reasoning: `${best.name} ranked highest by trade match and workload.`,
      reasons: buildReasons(best, second, scoreDiff, job.tradeClassification, eligible.length),
      riskFlags: ['AI analysis unavailable — result is rule-based'],
      missingInfo,
      confidence: 'medium',
    })
  }
}
