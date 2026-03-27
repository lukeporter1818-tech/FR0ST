'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireRole, requireSession, hasRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import { BoardStatus } from '@/generated/prisma'

const VALID_STATUSES: BoardStatus[] = ['ASSIGNED', 'EN_ROUTE', 'ON_SITE', 'WAITING', 'PARTS', 'DONE', 'OUT']

function parseBoardStatus(status: string | null): BoardStatus | null {
  if (!status) return null
  return VALID_STATUSES.includes(status as BoardStatus) ? (status as BoardStatus) : null
}

function parseDate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid date format')
  return new Date(date + 'T00:00:00.000Z')
}

export async function saveBoardEntries(
  date: string,
  rows: Array<{
    technicianId: string
    assignment: string
    note: string
    status: string | null
  }>
): Promise<void> {
  // Only dispatchers/admins can bulk-save the board
  const session = await requireRole('DISPATCHER')

  const parsedDate = parseDate(date)

  if (!Array.isArray(rows) || rows.length > 50) {
    throw new Error('Invalid rows array')
  }

  // Atomic: if createMany fails the delete is rolled back — no data loss
  await prisma.$transaction(async (tx) => {
    await tx.boardEntry.deleteMany({ where: { date: parsedDate } })
    if (rows.length > 0) {
      await tx.boardEntry.createMany({
        data: rows.map((row, index) => ({
          technicianId: String(row.technicianId).slice(0, 100),
          date: parsedDate,
          assignment: String(row.assignment ?? '').slice(0, 200),
          note: String(row.note ?? '').slice(0, 500),
          status: parseBoardStatus(row.status),
          orderIndex: index,
        })),
      })
    }
  })

  auditLog({
    action: 'board.save',
    userId: session.user.id,
    userRole: session.user.role,
    meta: { date, rowCount: rows.length },
  })

  revalidatePath('/schedule')
}

/**
 * Non-destructive single-entry upsert for the Schedule board.
 * Used by the Frost work order intake flow after dispatcher confirmation.
 *
 * - On update: replaces assignment + note, preserves existing status and orderIndex
 * - On create: sets status ASSIGNED, orderIndex = current row count for that date
 *
 * Unlike saveBoardEntries (which deletes and rewrites the whole day), this
 * touches exactly one row so it is safe to call at any time.
 */
export async function addWorkOrderToBoard(
  technicianId: string,
  assignment: string,
  note: string,
  date: string, // YYYY-MM-DD
  workOrderNumber?: string | null
): Promise<void> {
  const session = await requireRole('DISPATCHER')

  if (!technicianId || typeof technicianId !== 'string' || technicianId.length > 100) {
    throw new Error('Invalid technicianId')
  }

  const parsedDate = parseDate(date)

  const sanitizedAssignment = String(assignment ?? '').trim().slice(0, 200)
  const sanitizedNote = String(note ?? '').trim().slice(0, 500)

  // ── Duplicate detection by WO number ────────────────────────────────────
  // If a WO number was extracted, look for an existing row on this date with
  // the same assignment value. This catches: rapid double-drops, network
  // retries, and two dispatchers assigning the same WO simultaneously.
  // - If found: update the existing row (re-assign tech, refresh assignment
  //   and note) but leave status and orderIndex untouched.
  // - If not found: fall through to the normal upsert by technicianId+date.
  // - If no WO number: cannot deduplicate safely — use normal upsert path.

  const sanitizedWO = workOrderNumber ? String(workOrderNumber).trim().slice(0, 200) : null

  if (sanitizedWO) {
    const existingByWO = await prisma.boardEntry.findFirst({
      where: { date: parsedDate, assignment: sanitizedWO },
      orderBy: { orderIndex: 'asc' },
      select: { id: true },
    })

    if (existingByWO) {
      // Re-assign to the selected tech; preserve status and orderIndex
      await prisma.boardEntry.update({
        where: { id: existingByWO.id },
        data: { technicianId, assignment: sanitizedAssignment, note: sanitizedNote },
      })

      auditLog({
        action: 'board.assign_from_screenshot',
        userId: session.user.id,
        userRole: session.user.role,
        targetId: technicianId,
        targetType: 'Technician',
        meta: { date, assignment: sanitizedAssignment, deduped: true },
      })

      revalidatePath('/schedule')
      return
    }
  }

  // No WO-based duplicate found — upsert by technicianId+date (original path)
  // Determine orderIndex for a new row: append after existing rows for this date
  const rowCount = await prisma.boardEntry.count({ where: { date: parsedDate } })

  await prisma.boardEntry.upsert({
    where: { technicianId_date: { technicianId, date: parsedDate } },
    update: {
      assignment: sanitizedAssignment,
      note: sanitizedNote,
      // Intentionally not touching status or orderIndex on update —
      // the tech may already be en-route; preserve their current state.
    },
    create: {
      technicianId,
      date: parsedDate,
      assignment: sanitizedAssignment,
      note: sanitizedNote,
      status: 'ASSIGNED',
      orderIndex: rowCount,
    },
  })

  auditLog({
    action: 'board.assign_from_screenshot',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: technicianId,
    targetType: 'Technician',
    meta: { date, assignment: sanitizedAssignment },
  })

  revalidatePath('/schedule')
}

export async function updateMyRow(
  technicianId: string,
  date: string,
  status: string | null,
  note: string
): Promise<void> {
  const session = await requireSession()

  const parsedDate = parseDate(date)

  // IDOR protection: technicians can only update their own row.
  // Dispatchers and admins can update any row.
  if (!hasRole(session.user.role, 'DISPATCHER')) {
    if (session.user.technicianId !== technicianId) {
      throw new Error('Forbidden: you can only update your own row')
    }
  }

  const sanitizedNote = String(note ?? '').slice(0, 500)

  await prisma.boardEntry.upsert({
    where: { technicianId_date: { technicianId, date: parsedDate } },
    update: {
      status: parseBoardStatus(status),
      note: sanitizedNote,
    },
    create: {
      technicianId,
      date: parsedDate,
      assignment: '',
      status: parseBoardStatus(status),
      note: sanitizedNote,
      orderIndex: 0,
    },
  })

  auditLog({
    action: 'board.update_own_row',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: technicianId,
    meta: { date, status },
  })

  revalidatePath('/schedule')
}
