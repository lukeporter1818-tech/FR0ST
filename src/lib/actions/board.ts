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

  await prisma.boardEntry.deleteMany({ where: { date: parsedDate } })

  if (rows.length > 0) {
    await prisma.boardEntry.createMany({
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

  auditLog({
    action: 'board.save',
    userId: session.user.id,
    userRole: session.user.role,
    meta: { date, rowCount: rows.length },
  })

  revalidatePath('/')
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

  revalidatePath('/')
}
