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

  const assignedJobIds = assignments.map((a) => String(a.jobId).slice(0, 100))

  await prisma.scheduleEntry.deleteMany({ where: { date: scheduleDate } })

  const previouslyScheduledJobs = await prisma.job.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledDate: scheduleDate,
      id: { notIn: assignedJobIds },
    },
    select: { id: true },
  })

  if (previouslyScheduledJobs.length > 0) {
    await prisma.job.updateMany({
      where: { id: { in: previouslyScheduledJobs.map((j) => j.id) } },
      data: { status: 'NEW', assignedTechId: null, scheduledDate: null },
    })
  }

  if (assignments.length > 0) {
    await prisma.$transaction(
      assignments.map((a) =>
        prisma.scheduleEntry.create({
          data: {
            technicianId: String(a.technicianId).slice(0, 100),
            jobId: String(a.jobId).slice(0, 100),
            date: scheduleDate,
            orderIndex: Number(a.orderIndex) || 0,
            arrivalWindow: a.arrivalWindow ? String(a.arrivalWindow).slice(0, 50) : null,
            notes: a.notes ? String(a.notes).slice(0, 500) : null,
          },
        })
      )
    )

    await prisma.$transaction(
      assignments.map((a) =>
        prisma.job.update({
          where: { id: String(a.jobId).slice(0, 100) },
          data: {
            status: 'SCHEDULED',
            assignedTechId: String(a.technicianId).slice(0, 100),
            scheduledDate: scheduleDate,
          },
        })
      )
    )
  }

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
