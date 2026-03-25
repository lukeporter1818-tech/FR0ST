'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { DraggableJobCard, type DispatchJobData } from '@/components/dispatch/DraggableJobCard'
import { MapPin } from 'lucide-react'

export type TechData = {
  id: string
  name: string
  phone: string
  tradeType: string | null
  status: string
}

type TechColumnProps = {
  tech: TechData
  jobIds: string[]
  jobs: Record<string, DispatchJobData>
}

const tradeColors: Record<string, string> = {
  HVAC: 'bg-blue-500',
  REFRIGERATION: 'bg-cyan-500',
  PLUMBING: 'bg-emerald-500',
  ELECTRICAL: 'bg-amber-500',
  MULTI: 'bg-violet-500',
  UNKNOWN: 'bg-gray-400',
}

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getAvatarColor(name: string) {
  const code = name.charCodeAt(0) ?? 0
  return avatarColors[code % avatarColors.length]
}

export function TechColumn({ tech, jobIds, jobs }: TechColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: tech.id,
    data: { type: 'container', containerId: tech.id },
  })

  const initials = getInitials(tech.name)
  const avatarColor = getAvatarColor(tech.name)
  const tradeColor = tech.tradeType ? (tradeColors[tech.tradeType] ?? 'bg-gray-400') : 'bg-gray-400'

  return (
    <div className="flex h-full min-w-[240px] w-[240px] shrink-0 flex-col bg-white rounded-xl border border-gray-200">
      {/* Tech header */}
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
              avatarColor
            )}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={cn('w-2 h-2 rounded-full shrink-0', tradeColor)}
              />
              <p className="truncate text-sm font-semibold text-gray-900">{tech.name}</p>
            </div>
            {tech.tradeType && (
              <p className="truncate text-[11px] text-gray-500 mt-0.5">
                {tech.tradeType}
              </p>
            )}
          </div>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 shrink-0">
            {jobIds.length}
          </span>
        </div>
      </div>

      {/* Jobs list - droppable area */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto p-2 transition-all',
          isOver && 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
        )}
      >
        <SortableContext
          items={jobIds}
          strategy={verticalListSortingStrategy}
        >
          {jobIds.length > 0 ? (
            <div className="space-y-1.5">
              {jobIds.map((id, index) => {
                const job = jobs[id]
                if (!job) return null
                return (
                  <div key={id} className="relative">
                    {/* Stop number */}
                    <div className="absolute -left-0.5 top-2 z-10 flex w-5 h-5 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 font-medium">
                      {index + 1}
                    </div>
                    <div className="pl-4">
                      <DraggableJobCard job={job} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 py-8 text-center h-full min-h-[100px]">
              <MapPin className="mb-2 size-5 text-gray-300" />
              <p className="text-xs text-gray-400 font-medium">No stops scheduled</p>
              <p className="mt-0.5 text-[10px] text-gray-300">Drag jobs here to assign</p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
