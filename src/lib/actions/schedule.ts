'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'

type ScheduleAssignment = {
  jobId: string
  technicianId: string
  orderIndex: number
  arrivalWindow?: string
  notes?: string
}

function parseDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format')
  return new Date(date + 'T00:00:00.000Z')
}

export async function saveSchedule(date: string, assignments: ScheduleAssignment[]) {
  const session = await requireRole('DISPATCHER')

  const scheduleDate = parseDate(date)

  if (!Array.isArray(assignments) || assignments.length > 100) {
    throw new Error('Invalid assignments array')
  }

  // Sanitize inputs before entering the transaction (CPU only, no DB work).
  const sanitized = assignments.map((a) => ({
    jobId:        String(a.jobId).slice(0, 100),
    technicianId: String(a.technicianId).slice(0, 100),
    orderIndex:   Number(a.orderIndex) || 0,
    arrivalWindow: a.arrivalWindow ? String(a.arrivalWindow).slice(0, 50) : null,
    notes:        a.notes ? String(a.notes).slice(0, 500) : null,
  }))
  const assignedJobIds = sanitized.map((a) => a.jobId)

  // Single interactive transaction — the entire schedule save is atomic.
  // If any step throws, Postgres rolls back all changes and the DB is left
  // exactly as it was before the call. No partial-delete or partial-rebuild
  // state is possible.
  await prisma.$transaction(async (tx) => {
    // Step 1: clear all existing entries for this date.
    await tx.scheduleEntry.deleteMany({ where: { date: scheduleDate } })

    // Step 2: find jobs that were scheduled for this date but are NOT in the
    // new assignment list — they need to revert to NEW status.
    // This read runs inside the transaction so it sees the just-deleted state
    // and is consistent with the writes that follow.
    const dropped = await tx.job.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: scheduleDate,
        id: { notIn: assignedJobIds },
      },
      select: { id: true },
    })

    // Step 3: reset dropped jobs.
    if (dropped.length > 0) {
      await tx.job.updateMany({
        where: { id: { in: dropped.map((j) => j.id) } },
        data: { status: 'NEW', assignedTechId: null, scheduledDate: null },
      })
    }

    if (sanitized.length > 0) {
      // Step 4: create all new schedule entries in one bulk insert.
      await tx.scheduleEntry.createMany({
        data: sanitized.map((a) => ({
          technicianId: a.technicianId,
          jobId:        a.jobId,
          date:         scheduleDate,
          orderIndex:   a.orderIndex,
          arrivalWindow: a.arrivalWindow,
          notes:        a.notes,
        })),
      })

      // Step 5: sync job statuses. Each job may have a different assigned tech
      // so this cannot be collapsed into a single updateMany.
      for (const a of sanitized) {
        await tx.job.update({
          where: { id: a.jobId },
          data: {
            status:        'SCHEDULED',
            assignedTechId: a.technicianId,
            scheduledDate:  scheduleDate,
          },
        })
      }
    }
  })

  auditLog({
    action: 'board.save',
    userId: session.user.id,
    userRole: session.user.role,
    meta: { date, assignmentCount: assignments.length },
  })

  revalidatePath('/schedule')
}

export async function removeFromSchedule(jobId: string) {
  const session = await requireRole('DISPATCHER')

  const existing = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true } })
  if (!existing) throw new Error('Job not found')

  await prisma.scheduleEntry.deleteMany({ where: { jobId } })
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'NEW', assignedTechId: null, scheduledDate: null },
  })

  auditLog({
    action: 'job.update',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: jobId,
    targetType: 'Job',
    meta: { action: 'removed_from_schedule' },
  })

  revalidatePath('/schedule')
}

export async function updateScheduleEntryNotes(entryId: string, notes: string) {
  const session = await requireRole('DISPATCHER')

  const existing = await prisma.scheduleEntry.findUnique({ where: { id: entryId }, select: { id: true } })
  if (!existing) throw new Error('Schedule entry not found')

  await prisma.scheduleEntry.update({
    where: { id: entryId },
    data: { notes: String(notes).slice(0, 500) },
  })

  auditLog({
    action: 'board.save',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: entryId,
    meta: { action: 'update_notes' },
  })

  revalidatePath('/schedule')
}
