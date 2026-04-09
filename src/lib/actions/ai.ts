'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import type { Trade, Priority } from '@/generated/prisma'

interface TriageData {
  summary: string
  tradeClassification: string
  urgency: string
  followUpQuestions: string[]
  riskFlags: string[]
}

const VALID_TRADES: Record<string, Trade> = {
  HVAC: 'HVAC',
  REFRIGERATION: 'REFRIGERATION',
  PLUMBING: 'PLUMBING',
  ELECTRICAL: 'ELECTRICAL',
  MULTI: 'MULTI',
  UNKNOWN: 'UNKNOWN',
}

const VALID_PRIORITIES: Record<string, Priority> = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  EMERGENCY: 'EMERGENCY',
}

export async function applyTriageToJob(jobId: string, triage: TriageData) {
  const session = await requireRole('DISPATCHER')

  // IDOR protection: verify job exists
  const existing = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } })
  if (!existing) throw new Error('Job not found')

  const trade = VALID_TRADES[triage.tradeClassification] ?? 'UNKNOWN'
  const priority = VALID_PRIORITIES[triage.urgency] ?? 'NORMAL'

  await prisma.job.update({
    where: { id: jobId },
    data: {
      aiSummary: String(triage.summary).slice(0, 2000),
      aiUrgency: triage.urgency,
      aiTradeGuess: trade,
      aiFollowUpQuestions: Array.isArray(triage.followUpQuestions)
        ? triage.followUpQuestions.slice(0, 10).map((q) => String(q).slice(0, 500))
        : [],
      aiRiskFlags: Array.isArray(triage.riskFlags)
        ? triage.riskFlags.slice(0, 10).map((f) => String(f).slice(0, 500))
        : [],
      tradeClassification: trade,
      priority,
    },
  })

  auditLog({
    action: 'ai.triage_applied',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: jobId,
    targetType: 'Job',
    meta: { trade, priority },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
}
