'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, ImageDown, UserPlus, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DateNav } from './DateNav'
import { saveBoardEntries, updateMyRow, addWorkOrderToBoard, addTechToBoard, removeTechFromBoard } from '@/lib/actions/board'
import type { WorkOrderExtraction } from '@/types/work-order'

// ─── Drop state machine ───────────────────────────────────────────────────────
type DropState =
  | { phase: 'extracting'; techId: string; techName: string }
  | { phase: 'confirm';    techId: string; techName: string; extraction: WorkOrderExtraction }
  | { phase: 'error';      techId: string; techName: string; message: string }
  | null

// ─── Confidence badge ─────────────────────────────────────────────────────────
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const styles = {
    high:   'bg-green-500/15  text-green-300  border-green-500/30',
    medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    low:    'bg-red-500/15    text-red-300    border-red-500/30',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', styles[confidence])}>
      {confidence} confidence
    </span>
  )
}

export interface BoardRow {
  technicianId: string
  name: string
  assignment: string
  note: string
  status: string | null
  orderIndex: number
}

interface BoardClientProps {
  rows: BoardRow[]
  allTechs: { id: string; name: string }[]
  date: string
  currentUserId: string
  currentUserRole: string
  currentTechnicianId: string | null
}

const STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'EN_ROUTE', label: 'En Route' },
  { value: 'ON_SITE', label: 'On Site' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'PARTS', label: 'Parts' },
  { value: 'DONE', label: 'Done' },
  { value: 'OUT', label: 'Out' },
]

// ─── Status badge pills ────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  ASSIGNED:  'bg-blue-500/15  text-blue-300  ring-blue-500/30',
  EN_ROUTE:  'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  ON_SITE:   'bg-green-500/15 text-green-300 ring-green-500/30',
  WAITING:   'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30',
  PARTS:     'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  DONE:      'bg-gray-500/10  text-gray-500  ring-gray-500/20',
  OUT:       'bg-red-500/15   text-red-300   ring-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assigned',
  EN_ROUTE: 'En Route',
  ON_SITE:  'On Site',
  WAITING:  'Waiting',
  PARTS:    'Parts',
  DONE:     'Done',
  OUT:      'Out',
}

function StatusText({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset shrink-0',
      STATUS_BADGE[status] ?? 'bg-gray-500/10 text-gray-500 ring-gray-500/20'
    )}>
      {STATUS_LABELS[status]}
    </span>
  )
}

interface LocalRow extends BoardRow { dirty: boolean }

export function BoardClient({
  rows: initialRows,
  allTechs,
  date,
  currentUserId,
  currentUserRole,
  currentTechnicianId,
}: BoardClientProps) {
  const [rows, setRows] = useState<LocalRow[]>(() =>
    initialRows.map((r) => ({ ...r, dirty: false }))
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ assignment: string; note: string; status: string | null }>({
    assignment: '', note: '', status: null,
  })
  const [saving, setSaving] = useState(false)
  const assignmentRef = useRef<HTMLInputElement>(null)

  // ── Roster management state ────────────────────────────────────────────────
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [addingTechId, setAddingTechId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const addPickerRef = useRef<HTMLDivElement>(null)

  // ── Drag-and-drop WO intake ────────────────────────────────────────────────
  const [dragOverTechId, setDragOverTechId] = useState<string | null>(null)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const dragEnterCount = useRef(0)
  const [dropState, setDropState] = useState<DropState>(null)

  const isTechnician = currentUserRole === 'TECHNICIAN'
  const canManageRoster = !isTechnician

  useEffect(() => {
    setRows(initialRows.map((r) => ({ ...r, dirty: false })))
    setEditingId(null)
    setShowAddPicker(false)
    setConfirmRemoveId(null)
  }, [date, initialRows])

  useEffect(() => {
    if (editingId) assignmentRef.current?.focus()
  }, [editingId])

  const dirtyCount = rows.filter((r) => r.dirty).length

  function canEditRow(row: LocalRow): boolean {
    if (!isTechnician) return true
    return row.technicianId === currentTechnicianId
  }

  function startEdit(row: LocalRow) {
    if (!canEditRow(row)) return
    if (editingId && editingId !== row.technicianId) commitEdit(editingId)
    setEditingId(row.technicianId)
    setEditDraft({ assignment: row.assignment, note: row.note, status: row.status })
  }

  const commitEdit = useCallback((technicianId: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.technicianId !== technicianId) return r
        const changed = r.assignment !== editDraft.assignment || r.note !== editDraft.note || r.status !== editDraft.status
        return { ...r, assignment: editDraft.assignment, note: editDraft.note, status: editDraft.status, dirty: r.dirty || changed }
      })
    )
    setEditingId(null)
  }, [editDraft])

  function handleRowKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(id) }
    if (e.key === 'Escape') setEditingId(null)
  }

  const handleDrop = useCallback(async (e: React.DragEvent, tech: { id: string; name: string }) => {
    e.preventDefault()
    setDragOverTechId(null)
    // Prevent a second drop while extraction/confirmation is already in progress
    if (dropState) return
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (!file) return

    setDropState({ phase: 'extracting', techId: tech.id, techName: tech.name })

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (ev) => resolve(ev.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    }).catch(() => '')

    if (!dataUrl) {
      setDropState({ phase: 'error', techId: tech.id, techName: tech.name, message: 'Could not read the image file.' })
      return
    }

    try {
      const res = await fetch('/api/ai/extract-work-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      })
      if (!res.ok) throw new Error(`Extraction failed (${res.status})`)
      const extraction: WorkOrderExtraction = await res.json()
      if (!extraction.detected) {
        setDropState({ phase: 'error', techId: tech.id, techName: tech.name, message: 'No work order found in this image.' })
        return
      }
      setDropState({ phase: 'confirm', techId: tech.id, techName: tech.name, extraction })
    } catch (err) {
      setDropState({
        phase: 'error',
        techId: tech.id,
        techName: tech.name,
        message: err instanceof Error ? err.message : 'Extraction failed. Please try again.',
      })
    }
  }, [dropState])

  const handleConfirmWO = useCallback(async () => {
    if (!dropState || dropState.phase !== 'confirm') return
    const { techId, techName, extraction } = dropState

    const assignment = extraction.workOrderNumber ?? extraction.shortDescription ?? ''
    const note = extraction.workOrderNumber && extraction.shortDescription ? extraction.shortDescription : ''

    // Reuse extracting phase as the saving loading state
    setDropState({ phase: 'extracting', techId, techName })

    try {
      await addWorkOrderToBoard(techId, assignment, note, date, extraction.workOrderNumber ?? null)

      // Optimistically apply to local row so no full page reload is needed
      setRows((prev) =>
        prev.map((r) =>
          r.technicianId === techId
            ? { ...r, assignment, note, status: r.status ?? 'ASSIGNED' }
            : r
        )
      )
      setDropState(null)
      toast.success('Added to Schedule')
    } catch (err) {
      setDropState({
        phase: 'error',
        techId,
        techName,
        message: err instanceof Error ? err.message : 'Failed to save. Please try again.',
      })
    }
  }, [dropState, date])

  // Close add picker when clicking outside
  useEffect(() => {
    if (!showAddPicker) return
    function handleOutside(e: MouseEvent) {
      if (addPickerRef.current && !addPickerRef.current.contains(e.target as Node)) {
        setShowAddPicker(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAddPicker])

  async function handleAddTech(techId: string) {
    if (addingTechId) return
    setAddingTechId(techId)
    setShowAddPicker(false)
    try {
      await addTechToBoard(techId, date)
      // optimistic: add row locally
      const tech = allTechs.find((t) => t.id === techId)
      if (tech) {
        setRows((prev) => [...prev, { technicianId: tech.id, name: tech.name, assignment: '', note: '', status: null, orderIndex: prev.length, dirty: false }])
      }
    } catch {
      toast.error('Failed to add technician.')
    } finally {
      setAddingTechId(null)
    }
  }

  async function handleRemoveTech(techId: string) {
    if (removingId) return
    setRemovingId(techId)
    setConfirmRemoveId(null)
    try {
      await removeTechFromBoard(techId, date)
      setRows((prev) => prev.filter((r) => r.technicianId !== techId))
    } catch {
      toast.error('Failed to remove technician.')
    } finally {
      setRemovingId(null)
    }
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      if (isTechnician && currentTechnicianId) {
        // Technicians update only their own row — saveBoardEntries requires DISPATCHER
        const myRow = rows.find((r) => r.technicianId === currentTechnicianId)
        if (!myRow) return
        // Use live editDraft if their row is currently open in the editor
        const note = editingId === currentTechnicianId ? editDraft.note : myRow.note
        const status = editingId === currentTechnicianId ? editDraft.status : myRow.status
        if (editingId) setEditingId(null)
        await updateMyRow(currentTechnicianId, date, status, note)
      } else {
        if (editingId) commitEdit(editingId)
        await saveBoardEntries(date, rows.map((r) => ({
          technicianId: r.technicianId,
          assignment: r.assignment,
          note: r.note,
          status: r.status,
        })))
      }
      setRows((prev) => prev.map((r) => ({ ...r, dirty: false })))
    } catch {
      toast.error('Save failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <DateNav date={date} />
        <div className="flex items-center gap-2 shrink-0">
          {dirtyCount > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-400 text-gray-900 hover:bg-amber-500 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Save${dirtyCount > 1 ? ` (${dirtyCount})` : ''}`}
            </button>
          )}
          {canManageRoster && (() => {
            const available = allTechs.filter((t) => !rows.some((r) => r.technicianId === t.id))
            return (
              <div className="relative" ref={addPickerRef}>
                <button
                  onClick={() => setShowAddPicker((v) => !v)}
                  disabled={available.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 text-xs font-medium text-gray-400 hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Add technician to schedule"
                >
                  {addingTechId ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  Add Tech
                </button>
                {showAddPicker && available.length > 0 && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-white/15 bg-gray-900 shadow-2xl py-1 overflow-hidden">
                    {available.map((tech) => (
                      <button
                        key={tech.id}
                        onClick={() => handleAddTech(tech.id)}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/8 transition-colors"
                      >
                        {tech.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* WO drop confirmation modal */}
      {dropState && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => dropState.phase !== 'extracting' && setDropState(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl ring-1 ring-white/10 p-6 space-y-4">

              {dropState.phase === 'extracting' && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 className="size-6 animate-spin text-gray-500" />
                  <p className="text-sm text-gray-400">Scanning work order…</p>
                </div>
              )}

              {dropState.phase === 'error' && (
                <>
                  <p className="text-sm font-semibold text-red-400">Could not extract work order</p>
                  <p className="text-sm text-gray-400">{dropState.message}</p>
                  <button
                    onClick={() => setDropState(null)}
                    className="w-full rounded-lg border border-white/15 py-2.5 text-sm text-gray-400 hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}

              {dropState.phase === 'confirm' && (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-white">Add to Schedule</h2>
                    <ConfidenceBadge confidence={dropState.extraction.confidence} />
                  </div>

                  {/* Extracted WO info */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Work Order</p>
                    {dropState.extraction.workOrderNumber && (
                      <p className="text-sm font-bold text-white">{dropState.extraction.workOrderNumber}</p>
                    )}
                    {dropState.extraction.shortDescription && (
                      <p className="text-sm text-gray-300">{dropState.extraction.shortDescription}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500 pt-0.5">
                      {dropState.extraction.siteName  && <span><span className="font-medium">Site:</span> {dropState.extraction.siteName}</span>}
                      {dropState.extraction.callType  && <span><span className="font-medium">Type:</span> {dropState.extraction.callType}</span>}
                      {dropState.extraction.priority  && <span><span className="font-medium">Priority:</span> {dropState.extraction.priority}</span>}
                    </div>
                    {dropState.extraction.confidence === 'low' && (
                      <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1 mt-1">
                        ⚠ Low confidence — verify details before confirming.
                      </p>
                    )}
                  </div>

                  {/* Target technician */}
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Assign to</p>
                    <p className="text-sm font-semibold text-white">{dropState.techName}</p>
                  </div>

                  {/* Schedule mapping preview */}
                  <div className="border-t border-white/10 pt-3 space-y-0.5 text-xs text-gray-500">
                    <p>
                      <span className="font-medium text-gray-400">Assignment: </span>
                      {dropState.extraction.workOrderNumber ?? dropState.extraction.shortDescription ?? '—'}
                    </p>
                    {dropState.extraction.workOrderNumber && dropState.extraction.shortDescription && (
                      <p>
                        <span className="font-medium text-gray-400">Note: </span>
                        {dropState.extraction.shortDescription}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleConfirmWO}
                      className="flex-1 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-gray-900 hover:bg-amber-400 transition-colors"
                    >
                      Add to Schedule
                    </button>
                    <button
                      onClick={() => setDropState(null)}
                      className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm text-gray-400 hover:bg-white/5 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </>
      )}

      {/* Board */}
      <div
        className="divide-y divide-white/8"
        onDragEnter={!isTechnician ? (e) => {
          if (Array.from(e.dataTransfer.types).includes('Files')) {
            dragEnterCount.current += 1
            setIsDraggingFile(true)
          }
        } : undefined}
        onDragLeave={!isTechnician ? () => {
          dragEnterCount.current -= 1
          if (dragEnterCount.current <= 0) {
            dragEnterCount.current = 0
            setIsDraggingFile(false)
            setDragOverTechId(null)
          }
        } : undefined}
        onDrop={!isTechnician ? () => {
          dragEnterCount.current = 0
          setIsDraggingFile(false)
        } : undefined}
      >
        {rows.map((row) => {
          const isEditing = editingId === row.technicianId
          const isOwnRow = isTechnician && row.technicianId === currentTechnicianId
          const clickable = canEditRow(row)

          // Drag-and-drop is available to dispatchers/admins on all rows.
          // Technicians see no drag targets (server action enforces DISPATCHER role anyway).
          const canDropWO = !isTechnician
          const isDragTarget = dragOverTechId === row.technicianId
          const isDropZone = isDraggingFile && canDropWO && !isDragTarget

          return (
            <div
              key={row.technicianId}
              onClick={() => { if (!isEditing) startEdit(row) }}
              onKeyDown={(e) => isEditing && handleRowKeyDown(e, row.technicianId)}
              onDragOver={canDropWO ? (e) => { e.preventDefault(); if (dragOverTechId !== row.technicianId) setDragOverTechId(row.technicianId) } : undefined}
              onDragLeave={canDropWO ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverTechId(null) } : undefined}
              onDrop={canDropWO ? (e) => handleDrop(e, { id: row.technicianId, name: row.name }) : undefined}
              className={cn(
                'flex items-baseline gap-5 py-4 px-1 rounded-md transition-all duration-150 group',
                clickable
                  ? 'cursor-pointer hover:bg-white/5'
                  : 'cursor-default opacity-40',
                isOwnRow && 'border-l-2 border-amber-400 pl-2',
                isDropZone && 'bg-amber-500/5 outline outline-1 outline-amber-500/25 outline-offset-[-1px]',
                isDragTarget && 'bg-amber-500/15 outline outline-2 outline-amber-400 outline-offset-[-2px] scale-[1.005]',
              )}
            >
              {/* Name */}
              <span className={cn(
                'w-24 shrink-0 text-[15px] leading-none',
                isOwnRow ? 'font-bold text-white' : 'font-semibold text-gray-200'
              )}>
                {row.name.split(' ')[0]}
              </span>

              {isEditing ? (
                <>
                  {/* Technicians editing their own row: no assignment field */}
                  {!isTechnician && (
                    <input
                      ref={assignmentRef}
                      type="text"
                      value={editDraft.assignment}
                      onChange={(e) => setEditDraft((d) => ({ ...d, assignment: e.target.value }))}
                      placeholder="Assignment"
                      className="text-base font-bold text-gray-100 bg-transparent border-b border-white/30 outline-none w-32 placeholder:text-gray-600 placeholder:font-normal"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <input
                    ref={isTechnician ? assignmentRef : undefined}
                    type="text"
                    value={editDraft.note}
                    onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                    placeholder="Note"
                    className="flex-1 text-sm text-gray-400 bg-transparent border-b border-white/15 outline-none placeholder:text-gray-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <select
                    value={editDraft.status ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value || null }))}
                    className="text-xs text-gray-400 bg-transparent outline-none border-b border-white/15 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <span className={cn('text-base font-bold leading-none tracking-wide', row.assignment ? 'text-gray-100' : 'text-gray-600')}>
                    {row.assignment || '—'}
                  </span>
                  {row.note && (
                    <span className="flex-1 text-sm text-gray-500 leading-none truncate italic">
                      {row.note}
                    </span>
                  )}
                  <div className="ml-auto">
                    <StatusText status={row.status} />
                  </div>
                  {row.dirty && (
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0 self-center" />
                  )}
                  {canDropWO && !isDragTarget && !isDraggingFile && (
                    <ImageDown
                      className="size-3.5 text-gray-700 opacity-0 group-hover:opacity-60 shrink-0 self-center transition-opacity"
                      aria-label="Drop work order screenshot here"
                    />
                  )}
                  {canDropWO && isDragTarget && (
                    <span className="text-xs font-semibold text-amber-400 shrink-0 self-center">Drop here</span>
                  )}
                  {canDropWO && isDropZone && (
                    <ImageDown className="size-3.5 text-amber-400 shrink-0 self-center animate-pulse" />
                  )}
                  {canManageRoster && !isDragTarget && (
                    removingId === row.technicianId ? (
                      <Loader2 className="size-3.5 animate-spin text-gray-600 shrink-0 self-center" />
                    ) : confirmRemoveId === row.technicianId ? (
                      <span className="flex items-center gap-1 shrink-0 self-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleRemoveTech(row.technicianId)}
                          className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="text-gray-600 hover:text-gray-400 transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmRemoveId(row.technicianId) }}
                        className="opacity-0 group-hover:opacity-40 hover:!opacity-100 text-gray-500 hover:text-red-400 shrink-0 self-center transition-all"
                        aria-label={`Remove ${row.name} from schedule`}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
