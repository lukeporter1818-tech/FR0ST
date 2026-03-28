'use server'

import { requireRole } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'
import { auditLog } from '@/lib/audit'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MgmtTaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE'

export type TaskData = {
  id: string
  title: string
  notes: string | null
  location: string | null
  dueDate: string | null       // YYYY-MM-DD or null
  status: MgmtTaskStatus
  createdById: string
  createdByName: string
  assignedToId: string | null
  assignedToName: string | null
  createdAt: string
  updatedAt: string
}

type TaskResult =
  | { success: true; task: TaskData }
  | { success: false; error: string }

type DeleteResult =
  | { success: true }
  | { success: false; error: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapTask(t: {
  id: string
  title: string
  notes: string | null
  location: string | null
  dueDate: Date | null
  status: string
  createdById: string
  assignedToId: string | null
  createdAt: Date
  updatedAt: Date
  createdBy: { name: string }
  assignedTo: { name: string } | null
}): TaskData {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    location: t.location,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    status: t.status as MgmtTaskStatus,
    createdById: t.createdById,
    createdByName: t.createdBy.name,
    assignedToId: t.assignedToId,
    assignedToName: t.assignedTo?.name ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

const taskSelect = {
  id: true,
  title: true,
  notes: true,
  location: true,
  dueDate: true,
  status: true,
  createdById: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { name: true } },
  assignedTo: { select: { name: true } },
} as const

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createManagementTask(data: {
  title: string
  notes?: string
  location?: string
  dueDate?: string
  assignedToId?: string
}): Promise<TaskResult> {
  const session = await requireRole('DISPATCHER')

  const title = data.title.trim()
  if (!title || title.length > 200) {
    return { success: false, error: 'Title is required (max 200 chars)' }
  }

  try {
    const task = await prisma.managementTask.create({
      data: {
        title,
        notes: data.notes?.trim() || null,
        location: data.location?.trim() || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        assignedToId: data.assignedToId || null,
        createdById: session.user.id,
        status: 'OPEN',
      },
      select: taskSelect,
    })

    auditLog({ action: 'mgmt_task.create', userId: session.user.id, meta: { taskId: task.id, title } })
    return { success: true, task: mapTask(task) }
  } catch {
    return { success: false, error: 'Failed to create task' }
  }
}

export async function updateManagementTask(
  id: string,
  data: {
    title?: string
    notes?: string | null
    location?: string | null
    dueDate?: string | null
    status?: MgmtTaskStatus
    assignedToId?: string | null
  }
): Promise<TaskResult> {
  const session = await requireRole('DISPATCHER')

  if (!id || id.length > 128) {
    return { success: false, error: 'Invalid task id' }
  }

  try {
    const task = await prisma.managementTask.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.notes !== undefined && { notes: data.notes?.trim() || null }),
        ...(data.location !== undefined && { location: data.location?.trim() || null }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
      },
      select: taskSelect,
    })

    auditLog({ action: 'mgmt_task.update', userId: session.user.id, meta: { taskId: id } })
    return { success: true, task: mapTask(task) }
  } catch {
    return { success: false, error: 'Failed to update task' }
  }
}

export async function deleteManagementTask(id: string): Promise<DeleteResult> {
  const session = await requireRole('DISPATCHER')

  if (!id || id.length > 128) {
    return { success: false, error: 'Invalid task id' }
  }

  try {
    await prisma.managementTask.delete({ where: { id } })
    auditLog({ action: 'mgmt_task.delete', userId: session.user.id, meta: { taskId: id } })
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to delete task' }
  }
}
