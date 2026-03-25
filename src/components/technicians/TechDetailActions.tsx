'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TechForm } from '@/components/technicians/TechForm'
import { deleteTechnician } from '@/lib/actions/technicians'
import type { Technician } from '@/generated/prisma'

type TechDetailActionsProps = {
  technician: Technician
}

export function TechDetailActions({ technician }: TechDetailActionsProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      await deleteTechnician(technician.id)
    })
  }

  if (editing) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-20">
        <div className="w-full max-w-2xl">
          <TechForm technician={technician} onCancel={() => setEditing(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" data-icon="inline-start" />
        Edit
      </Button>

      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? 'Deleting...' : 'Confirm Delete'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
