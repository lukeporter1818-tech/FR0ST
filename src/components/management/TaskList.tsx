'use client'

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  createManagementTask,
  updateManagementTask,
  deleteManagementTask,
  type TaskData,
  type MgmtTaskStatus,
} from '@/lib/actions/managementTasks'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CYCLE: MgmtTaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE']
const STATUS_LABEL: Record<MgmtTaskStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}
const STATUS_STYLE: Record<MgmtTaskStatus, string> = {
  OPEN:        'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  DONE:        'bg-green-100 text-green-700',
}

type ManagementUser = { id: string; name: string }

interface TaskListProps {
  initialTasks: TaskData[]
  currentUserId: string
  managementUsers: ManagementUser[]
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

function AddTaskModal({
  isOpen,
  onClose,
  managementUsers,
  onAdd,
}: {
  isOpen: boolean
  onClose: () => void
  managementUsers: ManagementUser[]
  onAdd: (task: TaskData) => void
}) {
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignedToId, setAssignedToId] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = useCallback(() => {
    setTitle('')
    setNotes('')
    setLocation('')
    setDueDate('')
    setAssignedToId('')
  }, [])

  const handleClose = useCallback(() => {
    if (pending) return
    reset()
    onClose()
  }, [pending, reset, onClose])

  // Escape key
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  if (!isOpen) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed || pending) return

    startTransition(async () => {
      const result = await createManagementTask({
        title: trimmed,
        notes: notes || undefined,
        location: location || undefined,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId || undefined,
      })
      if (result.success) {
        onAdd(result.task)
        reset()
        onClose()
        toast.success('Task added')
      } else {
        // Keep modal open so user can fix the error and retry
        toast.error(result.error)
      }
    })
  }

  return (
    // Backdrop — click outside closes
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Panel — stopPropagation prevents backdrop-close when clicking inside */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 id="task-modal-title" className="text-sm font-semibold text-gray-100">
            New Task
          </h2>
          <button
            onClick={handleClose}
            disabled={pending}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Task <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              disabled={pending}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Location / Store
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Store #14"
                disabled={pending}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50"
              />
            </div>

            {/* Due date */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={pending}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details…"
              rows={2}
              disabled={pending}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Assign to */}
          {managementUsers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Assign to
              </label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                disabled={pending}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50"
              >
                <option value="">— Unassigned —</option>
                {managementUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={pending || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-400 text-gray-900 text-sm font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending
                ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
                : <><Plus className="size-3.5" /> Add Task</>
              }
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 hover:text-gray-200 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  managementUsers,
  onUpdate,
  onDelete,
}: {
  task: TaskData
  managementUsers: ManagementUser[]
  onUpdate: (updated: TaskData) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: task.title, notes: task.notes ?? '', location: task.location ?? '', dueDate: task.dueDate ?? '', assignedToId: task.assignedToId ?? '' })
  const [pending, startTransition] = useTransition()

  function cycleStatus() {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]
    startTransition(async () => {
      const result = await updateManagementTask(task.id, { status: next })
      if (result.success) onUpdate(result.task)
      else toast.error(result.error)
    })
  }

  function handleSaveEdit() {
    if (!draft.title.trim()) return
    startTransition(async () => {
      const result = await updateManagementTask(task.id, {
        title: draft.title,
        notes: draft.notes || null,
        location: draft.location || null,
        dueDate: draft.dueDate || null,
        assignedToId: draft.assignedToId || null,
      })
      if (result.success) {
        onUpdate(result.task)
        setEditing(false)
        toast.success('Task updated')
      } else {
        toast.error(result.error)
      }
    })
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${task.title}"?`)) return
    startTransition(async () => {
      const result = await deleteManagementTask(task.id)
      if (result.success) {
        onDelete(task.id)
        toast.success('Task deleted')
      } else {
        toast.error(result.error)
      }
    })
  }

  const isDone = task.status === 'DONE'

  if (editing) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white shadow-sm">
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base md:text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Location / Store</label>
            <input
              type="text"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>
          {managementUsers.length > 0 && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Assign to</label>
              <select
                value={draft.assignedToId}
                onChange={(e) => setDraft((d) => ({ ...d, assignedToId: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">— Unassigned —</option>
                {managementUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSaveEdit}
            disabled={pending || !draft.title.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            Save
          </button>
          <button
            onClick={() => { setEditing(false); setDraft({ title: task.title, notes: task.notes ?? '', location: task.location ?? '', dueDate: task.dueDate ?? '', assignedToId: task.assignedToId ?? '' }) }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="size-3" />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('group flex gap-3 items-start border border-gray-200 rounded-xl p-4 bg-white transition-colors hover:border-gray-300', isDone && 'opacity-60')}>
      {/* Status badge — click to cycle */}
      <button
        onClick={cycleStatus}
        disabled={pending}
        title="Click to change status"
        className={cn(
          'mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full transition-all hover:opacity-80 disabled:cursor-not-allowed',
          STATUS_STYLE[task.status]
        )}
      >
        {pending ? '…' : STATUS_LABEL[task.status]}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold text-gray-900 leading-snug', isDone && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {task.location && (
            <span className="text-xs text-gray-500">📍 {task.location}</span>
          )}
          {task.dueDate && (
            <span className="text-xs text-gray-500">
              📅 {new Date(task.dueDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.assignedToName && (
            <span className="text-xs text-gray-500">→ {task.assignedToName}</span>
          )}
        </div>
        {task.notes && (
          <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{task.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          title="Edit"
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={pending}
          title="Delete"
          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Main TaskList ────────────────────────────────────────────────────────────

export function TaskList({ initialTasks, currentUserId, managementUsers }: TaskListProps) {
  const [tasks, setTasks] = useState<TaskData[]>(initialTasks)
  const [modalOpen, setModalOpen] = useState(false)

  const ordered = useMemo(() => {
    const open       = tasks.filter((t) => t.status === 'OPEN')
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS')
    const done       = tasks.filter((t) => t.status === 'DONE')
    return [...open, ...inProgress, ...done]
  }, [tasks])

  function handleAdd(task: TaskData) {
    setTasks((prev) => [task, ...prev])
  }

  function handleUpdate(updated: TaskData) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <>
      <AddTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        managementUsers={managementUsers}
        onAdd={handleAdd}
      />

      <div className="space-y-4">
        {/* New Task button */}
        <button
          onClick={() => setModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-gray-400 hover:bg-white/[0.06] hover:text-gray-200 hover:border-white/20 transition-colors"
        >
          <Plus className="size-4" />
          New Task
        </button>

        {ordered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400 font-medium">No tasks yet</p>
            <p className="text-xs text-gray-600 mt-1">Add one to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ordered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                managementUsers={managementUsers}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
