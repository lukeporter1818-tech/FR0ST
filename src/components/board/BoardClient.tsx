'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { DateNav } from './DateNav'
import { saveBoardEntries, updateMyRow } from '@/lib/actions/board'

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

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED:  'text-blue-600',
  EN_ROUTE:  'text-amber-600',
  ON_SITE:   'text-green-600',
  WAITING:   'text-yellow-600',
  PARTS:     'text-orange-600',
  DONE:      'text-gray-400',
  OUT:       'text-red-500',
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
    <span className={cn('flex items-center gap-1 text-xs font-semibold shrink-0', STATUS_COLORS[status])}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {STATUS_LABELS[status]}
    </span>
  )
}

interface LocalRow extends BoardRow { dirty: boolean }

export function BoardClient({
  rows: initialRows,
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

  const isTechnician = currentUserRole === 'TECHNICIAN'

  useEffect(() => {
    setRows(initialRows.map((r) => ({ ...r, dirty: false })))
    setEditingId(null)
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

  async function handleSave() {
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
        {dirtyCount > 0 && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-400 text-gray-900 hover:bg-amber-500 transition-colors disabled:opacity-40 shrink-0"
          >
            {saving ? 'Saving…' : `Save${dirtyCount > 1 ? ` (${dirtyCount})` : ''}`}
          </button>
        )}
      </div>

      {/* Board */}
      <div className="divide-y divide-gray-100">
        {rows.map((row) => {
          const isEditing = editingId === row.technicianId
          const isOwnRow = isTechnician && row.technicianId === currentTechnicianId
          const clickable = canEditRow(row)

          return (
            <div
              key={row.technicianId}
              onClick={() => { if (!isEditing) startEdit(row) }}
              onKeyDown={(e) => isEditing && handleRowKeyDown(e, row.technicianId)}
              className={cn(
                'flex items-baseline gap-5 py-4 px-1 rounded-md transition-colors group',
                clickable
                  ? 'cursor-pointer hover:bg-gray-50/70'
                  : 'cursor-default opacity-60',
                isOwnRow && 'border-l-2 border-blue-400 pl-2 font-semibold'
              )}
            >
              {/* Name */}
              <span className={cn(
                'w-24 shrink-0 text-[15px] leading-none',
                isOwnRow ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
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
                      className="text-base font-bold text-gray-900 bg-transparent border-b border-gray-400 outline-none w-32 placeholder:text-gray-300 placeholder:font-normal"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <input
                    ref={isTechnician ? assignmentRef : undefined}
                    type="text"
                    value={editDraft.note}
                    onChange={(e) => setEditDraft((d) => ({ ...d, note: e.target.value }))}
                    placeholder="Note"
                    className="flex-1 text-sm text-gray-500 bg-transparent border-b border-gray-200 outline-none placeholder:text-gray-300"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <select
                    value={editDraft.status ?? ''}
                    onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value || null }))}
                    className="text-xs text-gray-500 bg-transparent outline-none border-b border-gray-200 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </>
              ) : (
                <>
                  <span className={cn('text-base font-bold leading-none tracking-wide', row.assignment ? 'text-gray-900' : 'text-gray-300')}>
                    {row.assignment || '—'}
                  </span>
                  {row.note && (
                    <span className="flex-1 text-sm text-gray-400 leading-none truncate italic">
                      {row.note}
                    </span>
                  )}
                  <div className="ml-auto">
                    <StatusText status={row.status} />
                  </div>
                  {row.dirty && (
                    <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0 self-center" />
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
