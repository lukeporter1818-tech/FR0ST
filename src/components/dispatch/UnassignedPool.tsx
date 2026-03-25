'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { DraggableJobCard, type DispatchJobData } from '@/components/dispatch/DraggableJobCard'
import { Search, Inbox } from 'lucide-react'

type UnassignedPoolProps = {
  jobIds: string[]
  jobs: Record<string, DispatchJobData>
}

export function UnassignedPool({ jobIds, jobs }: UnassignedPoolProps) {
  const [filter, setFilter] = useState('')

  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
    data: { type: 'container', containerId: 'unassigned' },
  })

  const filteredIds = filter
    ? jobIds.filter((id) => {
        const job = jobs[id]
        if (!job) return false
        const q = filter.toLowerCase()
        return (
          job.customerName.toLowerCase().includes(q) ||
          job.address.toLowerCase().includes(q) ||
          job.issueDescription.toLowerCase().includes(q)
        )
      })
    : jobIds

  return (
    <div className="flex h-full w-64 shrink-0 flex-col bg-white rounded-xl border border-gray-200 m-4 mr-0">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Unassigned</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            {jobIds.length}
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Filter jobs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Job list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 overflow-y-auto p-2 transition-all',
          isOver && 'ring-2 ring-inset ring-blue-400 bg-blue-50/30'
        )}
      >
        <SortableContext
          items={filteredIds}
          strategy={verticalListSortingStrategy}
        >
          {filteredIds.length > 0 ? (
            <div className="space-y-1.5">
              {filteredIds.map((id) => {
                const job = jobs[id]
                if (!job) return null
                return <DraggableJobCard key={id} job={job} />
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Inbox className="mb-2 size-7 text-gray-300" />
              <p className="text-xs text-gray-400 font-medium">
                {filter ? 'No matching jobs' : 'All jobs assigned'}
              </p>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  )
}
