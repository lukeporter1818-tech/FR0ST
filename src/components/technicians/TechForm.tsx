'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createTechnician, updateTechnician } from '@/lib/actions/technicians'
import type { Technician } from '@/generated/prisma'

type TechFormProps = {
  technician?: Technician
  onCancel?: () => void
}

const statusOptions = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OFF', label: 'Off' },
  { value: 'VACATION', label: 'Vacation' },
  { value: 'SICK', label: 'Sick' },
]

const tradeOptions = [
  { value: '', label: 'Select trade...' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'REFRIGERATION', label: 'Refrigeration' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'MULTI', label: 'Multi-Trade' },
]

const inputClass =
  'flex h-9 w-full rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

const labelClass = 'text-sm font-medium leading-none'

export function TechForm({ technician, onCancel }: TechFormProps) {
  const [isPending, startTransition] = useTransition()
  const isEditing = !!technician

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (isEditing) {
        await updateTechnician(technician.id, formData)
      } else {
        await createTechnician(formData)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Technician' : 'Add Technician'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              defaultValue={technician?.name ?? ''}
              placeholder="Full name"
              className={inputClass}
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label htmlFor="phone" className={labelClass}>
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              defaultValue={technician?.phone ?? ''}
              placeholder="(555) 123-4567"
              className={inputClass}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={technician?.status ?? 'ACTIVE'}
              className={inputClass}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Trade Type */}
          <div className="space-y-1.5">
            <label htmlFor="tradeType" className={labelClass}>
              Trade Type
            </label>
            <select
              id="tradeType"
              name="tradeType"
              defaultValue={technician?.tradeType ?? ''}
              className={inputClass}
            >
              {tradeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Skill Tags */}
          <div className="space-y-1.5">
            <label htmlFor="skillTags" className={labelClass}>
              Skill Tags
            </label>
            <input
              id="skillTags"
              name="skillTags"
              type="text"
              defaultValue={technician?.skillTags?.join(', ') ?? ''}
              placeholder="e.g. Rooftop Units, Chillers, Walk-In Coolers"
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes" className={labelClass}>
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={technician?.notes ?? ''}
              placeholder="Any relevant notes about this technician..."
              className="flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? 'Saving...'
                  : 'Creating...'
                : isEditing
                  ? 'Save Changes'
                  : 'Add Technician'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
