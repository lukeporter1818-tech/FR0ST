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
  OPEN:        'bg-gray-700/60 text-gray-300',
  IN_PROGRESS: 'bg-amber-500/20 text-amber-300',
  DONE:        'bg-green-500/20 text-green-300',
}

type ManagementUser = { id: string; name: string }
type EditDraft = {
  title: string
  notes: string
  location: string
  dueDate: string
  assignedToId: string
}

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
  const [location, setLocation] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [pending, startTransition] = useTransition()

  const reset = useCallback(() => {
    setTitle('')
    setLocation('')
    setDueDate('')
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
        location: location || undefined,
        dueDate: dueDate || undefined,
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-3 pb-4 overflow-hidden"
      onClick={handleClose}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Panel — stopPropagation prevents backdrop-close when clicking inside */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden"
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
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
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
            <div className="min-w-0">
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
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={pending}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50 appearance-none"
              />
            </div>
          </div>

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

// ─── Desktop inline edit (rendered inside the task list in place of the row) ──

function TaskRowInlineEdit({
  managementUsers,
  draft,
  onDraftChange,
  onSave,
  onCancel,
  pending,
}: {
  managementUsers: ManagementUser[]
  draft: EditDraft
  onDraftChange: (d: EditDraft) => void
  onSave: () => void
  onCancel: () => void
  pending: boolean
}) {
  return (
    <div className="border border-white/15 rounded-xl p-4 space-y-3 bg-white/[0.05]">
      {/* Title */}
      <input
        type="text"
        value={draft.title}
        onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
        autoFocus
        disabled={pending}
        placeholder="Task title"
        className="w-full bg-transparent border-b border-white/30 pb-1 text-sm font-semibold text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Location / Store</label>
          <input
            type="text"
            value={draft.location}
            onChange={(e) => onDraftChange({ ...draft, location: e.target.value })}
            disabled={pending}
            placeholder="e.g. Store #14"
            className="w-full bg-transparent border-b border-white/20 pb-1 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Due Date</label>
          <input
            type="date"
            value={draft.dueDate}
            onChange={(e) => onDraftChange({ ...draft, dueDate: e.target.value })}
            disabled={pending}
            className="w-full bg-transparent border-b border-white/20 pb-1 text-sm text-gray-200 focus:outline-none focus:border-amber-400/60 transition-colors disabled:opacity-50"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <textarea
            value={draft.notes}
            onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
            rows={2}
            disabled={pending}
            placeholder="Optional details…"
            className="w-full bg-transparent border-b border-white/20 pb-1 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-amber-400/60 transition-colors resize-none disabled:opacity-50"
          />
        </div>
        {managementUsers.length > 0 && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Assign to</label>
            <select
              value={draft.assignedToId}
              onChange={(e) => onDraftChange({ ...draft, assignedToId: e.target.value })}
              disabled={pending}
              className="w-full bg-gray-800 border border-white/15 rounded-lg px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400/50 disabled:opacity-50"
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
          onClick={onSave}
          disabled={pending || !draft.title.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 text-gray-900 text-xs font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 text-gray-400 text-xs rounded-lg hover:bg-white/5 hover:text-gray-200 transition-colors disabled:opacity-40"
        >
          <X className="size-3" />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Mobile bottom edit panel ─────────────────────────────────────────────────

function MobileEditPanel({
  task,
  draft,
  onDraftChange,
  onSave,
  onClose,
  pending,
}: {
  task: TaskData
  draft: EditDraft
  onDraftChange: (d: EditDraft) => void
  onSave: () => void
  onClose: () => void
  pending: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-3 pb-4 overflow-hidden"
      onClick={() => { if (!pending) onClose() }}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md rounded-2xl bg-gray-900 border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <p className="text-sm font-semibold text-gray-100 truncate pr-4">{task.title}</p>
          <button
            onClick={() => { if (!pending) onClose() }}
            disabled={pending}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Task</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
              disabled={pending}
              autoFocus
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Location / Store</label>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => onDraftChange({ ...draft, location: e.target.value })}
                disabled={pending}
                placeholder="e.g. Store #14"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50"
              />
            </div>
            <div className="min-w-0">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Due Date</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => onDraftChange({ ...draft, dueDate: e.target.value })}
                disabled={pending}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 disabled:opacity-50 appearance-none"
              />
            </div>
          </div>

          <button
            onClick={onSave}
            disabled={pending || !draft.title.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-400 text-gray-900 text-sm font-semibold rounded-lg hover:bg-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending
              ? <><Loader2 className="size-3.5 animate-spin" /> Saving…</>
              : <><Plus className="size-3.5" /> Save Changes</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  isEditing,
  isMobileView,
  editDraft,
  updatePending,
  managementUsers,
  onDraftChange,
  onSave,
  onCancelEdit,
  onStartEdit,
  onUpdate,
  onDelete,
}: {
  task: TaskData
  isEditing: boolean
  isMobileView: boolean
  editDraft: EditDraft
  updatePending: boolean
  managementUsers: ManagementUser[]
  onDraftChange: (d: EditDraft) => void
  onSave: () => void
  onCancelEdit: () => void
  onStartEdit: () => void
  onUpdate: (updated: TaskData) => void
  onDelete: (id: string) => void
}) {
  const [statusPending, startStatusTransition] = useTransition()
  const [deletePending, startDeleteTransition] = useTransition()
  const anyPending = updatePending || statusPending || deletePending

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation()
    if (anyPending) return
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]
    startStatusTransition(async () => {
      const result = await updateManagementTask(task.id, { status: next })
      if (result.success) onUpdate(result.task)
      else toast.error(result.error)
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (anyPending) return
    if (!window.confirm(`Delete "${task.title}"?`)) return
    startDeleteTransition(async () => {
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

  // Desktop inline edit replaces the row
  if (isEditing && !isMobileView) {
    return (
      <TaskRowInlineEdit
        managementUsers={managementUsers}
        draft={editDraft}
        onDraftChange={onDraftChange}
        onSave={onSave}
        onCancel={onCancelEdit}
        pending={updatePending}
      />
    )
  }

  return (
    <div
      className={cn(
        'group flex gap-3 items-start border border-white/10 rounded-xl p-4',
        'bg-white/[0.02] transition-colors cursor-pointer',
        'hover:border-white/20 hover:bg-white/[0.04]',
        isDone && 'opacity-60',
        anyPending && 'opacity-50 pointer-events-none',
      )}
      onClick={() => { if (!anyPending) onStartEdit() }}
    >
      {/* Status badge — click to cycle */}
      <button
        onClick={cycleStatus}
        disabled={anyPending}
        title="Click to change status"
        className={cn(
          'mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full transition-all hover:opacity-80 disabled:cursor-not-allowed',
          STATUS_STYLE[task.status],
        )}
      >
        {statusPending ? '…' : STATUS_LABEL[task.status]}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold text-gray-100 leading-snug', isDone && 'line-through text-gray-500')}>
          {task.title}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
          {task.location && (
            <span className="text-xs text-gray-500">📍 {task.location}</span>
          )}
          {task.dueDate && (
            <span className="text-xs text-gray-500">
              🗓️ {new Date(task.dueDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
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
      <div className="shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); if (!anyPending) onStartEdit() }}
          title="Edit"
          className="p-1.5 text-gray-500 hover:text-gray-200 rounded-md hover:bg-white/10 transition-colors"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={handleDelete}
          disabled={anyPending}
          title="Delete"
          className="p-1.5 text-gray-500 hover:text-red-400 rounded-md hover:bg-red-500/10 transition-colors disabled:opacity-40"
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({
    title: '', notes: '', location: '', dueDate: '', assignedToId: '',
  })
  const [isMobileView, setIsMobileView] = useState(false)
  const [updatePending, startUpdateTransition] = useTransition()

  // Derive the task object being edited (needed for mobile panel header)
  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingId) ?? null,
    [tasks, editingId],
  )

  const ordered = useMemo(() => {
    const open       = tasks.filter((t) => t.status === 'OPEN')
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS')
    const done       = tasks.filter((t) => t.status === 'DONE')
    return [...open, ...inProgress, ...done]
  }, [tasks])

  // ── Mobile viewport detection ──────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    setIsMobileView(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Escape key closes edit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!editingId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !updatePending) closeEdit()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editingId, updatePending])

  // ── Mobile: scroll lock while panel is open ────────────────────────────────
  useEffect(() => {
    if (!editingId || !isMobileView) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [editingId, isMobileView])

  // ── Edit helpers ───────────────────────────────────────────────────────────

  function openEdit(task: TaskData) {
    setEditingId(task.id)
    setEditDraft({
      title: task.title,
      notes: task.notes ?? '',
      location: task.location ?? '',
      dueDate: task.dueDate ?? '',
      assignedToId: task.assignedToId ?? '',
    })
  }

  function closeEdit() {
    setEditingId(null)
  }

  function handleSaveEdit() {
    if (!editDraft.title.trim() || !editingId) return
    startUpdateTransition(async () => {
      const result = await updateManagementTask(editingId, {
        title: editDraft.title.trim(),
        notes: editDraft.notes || null,
        location: editDraft.location || null,
        dueDate: editDraft.dueDate || null,
        assignedToId: editDraft.assignedToId || null,
      })
      if (result.success) {
        handleUpdate(result.task)
        closeEdit()
        toast.success('Task updated')
      } else {
        toast.error(result.error)
      }
    })
  }

  // ── Task list mutations ────────────────────────────────────────────────────

  function handleAdd(task: TaskData) {
    setTasks((prev) => [task, ...prev])
  }

  function handleUpdate(updated: TaskData) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    // Close edit panel if the deleted task was being edited
    if (editingId === id) closeEdit()
  }

  return (
    <>
      {/* New-task modal */}
      <AddTaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        managementUsers={managementUsers}
        onAdd={handleAdd}
      />

      {/* Mobile edit panel — rendered outside the list so it can be fixed */}
      {editingId && isMobileView && editingTask && (
        <MobileEditPanel
          task={editingTask}
          draft={editDraft}
          onDraftChange={setEditDraft}
          onSave={handleSaveEdit}
          onClose={closeEdit}
          pending={updatePending}
        />
      )}

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
                isEditing={editingId === task.id}
                isMobileView={isMobileView}
                editDraft={editDraft}
                updatePending={updatePending}
                managementUsers={managementUsers}
                onDraftChange={setEditDraft}
                onSave={handleSaveEdit}
                onCancelEdit={closeEdit}
                onStartEdit={() => openEdit(task)}
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
