'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { PriorityBadge } from '@/components/jobs/PriorityBadge'
import { TradeBadge } from '@/components/jobs/TradeBadge'
import { GripVertical, Clock, MapPin, ChevronDown, ChevronUp } from 'lucide-react'
import type { Priority, Trade } from '@/generated/prisma'

export type DispatchJobData = {
  id: string
  customerName: string
  address: string
  city: string | null
  issueDescription: string
  priority: Priority
  tradeClassification: Trade | null
  timeWindow: string | null
  customerPhone: string | null
  scheduledDate: string | null
  notes?: string
}

type DraggableJobCardProps = {
  job: DispatchJobData
  overlay?: boolean
}

export function DraggableJobCard({ job, overlay }: DraggableJobCardProps) {
  const [expanded, setExpanded] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: job.id,
    data: { type: 'job', job },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const shortAddress = job.city
    ? `${job.address.split(',')[0]}, ${job.city}`
    : job.address.split(',')[0]

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={cn(
        'bg-white border border-gray-200 rounded-lg p-3 transition-all cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-50 ring-2 ring-blue-400',
        overlay && 'shadow-lg ring-2 ring-blue-400 rotate-1',
        !isDragging && !overlay && 'hover:border-gray-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-start gap-1.5">
        {/* Drag handle */}
        <button
          className="mt-0.5 shrink-0 touch-none text-gray-300 hover:text-gray-400 transition-colors"
          {...(overlay ? {} : { ...attributes, ...listeners })}
        >
          <GripVertical className="size-4" />
        </button>

        {/* Card content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate leading-tight">
            {job.customerName}
          </p>

          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{shortAddress}</span>
          </div>

          <p className="text-xs text-gray-600 mt-1 line-clamp-1">
            {job.issueDescription}
          </p>

          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-1 mt-2">
            <PriorityBadge
              priority={job.priority}
              className="text-[10px] px-1.5 py-0"
            />
            {job.tradeClassification && (
              <TradeBadge
                trade={job.tradeClassification}
                className="text-[10px] px-1.5 py-0"
              />
            )}
            {job.timeWindow && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0 text-[10px] font-medium text-gray-500">
                <Clock className="size-2.5" />
                {job.timeWindow}
              </span>
            )}
          </div>

          {/* Expandable notes */}
          {expanded && (
            <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 p-2">
              <p className="text-[11px] text-gray-500">
                {job.notes || 'No dispatch notes'}
              </p>
            </div>
          )}
        </div>

        {/* Expand toggle */}
        <button
          className="mt-0.5 shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          {expanded ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}
