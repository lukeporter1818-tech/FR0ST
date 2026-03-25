'use client'

import { useState, useCallback, useMemo, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { DateSelector } from '@/components/dispatch/DateSelector'
import { UnassignedPool } from '@/components/dispatch/UnassignedPool'
import { TechColumn, type TechData } from '@/components/dispatch/TechColumn'
import { DraggableJobCard, type DispatchJobData } from '@/components/dispatch/DraggableJobCard'
import { saveSchedule } from '@/lib/actions/schedule'
import { Save, Loader2, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type DispatchBoardProps = {
  date: string
  technicians: TechData[]
  initialColumns: Record<string, string[]>
  initialUnassigned: string[]
  jobs: Record<string, DispatchJobData>
}

export function DispatchBoard({
  date,
  technicians,
  initialColumns,
  initialUnassigned,
  jobs: initialJobs,
}: DispatchBoardProps) {
  const [columns, setColumns] = useState<Record<string, string[]>>(initialColumns)
  const [unassigned, setUnassigned] = useState<string[]>(initialUnassigned)
  const [jobs] = useState<Record<string, DispatchJobData>>(initialJobs)
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const [hasChanges, setHasChanges] = useState(false)

  // Find which container an item belongs to
  const findContainer = useCallback(
    (id: UniqueIdentifier): string | null => {
      // Check if it's a container ID itself
      if (id === 'unassigned') return 'unassigned'
      if (columns[id as string]) return id as string

      // Check unassigned pool
      if (unassigned.includes(id as string)) return 'unassigned'

      // Check tech columns
      for (const [techId, jobIds] of Object.entries(columns)) {
        if (jobIds.includes(id as string)) return techId
      }

      return null
    },
    [columns, unassigned]
  )

  // Get items for a container
  const getContainerItems = useCallback(
    (containerId: string): string[] => {
      if (containerId === 'unassigned') return unassigned
      return columns[containerId] ?? []
    },
    [columns, unassigned]
  )

  // Set items for a container
  const setContainerItems = useCallback(
    (containerId: string, items: string[]) => {
      if (containerId === 'unassigned') {
        setUnassigned(items)
      } else {
        setColumns((prev) => ({ ...prev, [containerId]: items }))
      }
      setHasChanges(true)
    },
    []
  )

  // Custom collision detection that works with multiple containers
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      // First, check for pointer within droppable containers
      const pointerCollisions = pointerWithin(args)

      if (pointerCollisions.length > 0) {
        // If pointer is within a container, use closestCenter for items within it
        const overId = getFirstCollision(pointerCollisions, 'id')
        if (overId != null) {
          // Check if we're over a container
          if (overId === 'unassigned' || columns[overId as string]) {
            const containerItems = getContainerItems(overId as string)
            if (containerItems.length > 0) {
              const closestInContainer = closestCenter({
                ...args,
                droppableContainers: args.droppableContainers.filter(
                  (c) =>
                    c.id === overId ||
                    containerItems.includes(c.id as string)
                ),
              })
              if (closestInContainer.length > 0) {
                return closestInContainer
              }
            }
            return pointerCollisions
          }
        }
        return pointerCollisions
      }

      // Fallback to rect intersection
      return rectIntersection(args)
    },
    [columns, getContainerItems]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeContainer = findContainer(active.id)
      let overContainer = findContainer(over.id)

      // If over.id is a container itself, use it directly
      if (over.id === 'unassigned' || columns[over.id as string]) {
        overContainer = over.id as string
      }

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return
      }

      // Moving between containers
      const activeItems = getContainerItems(activeContainer)
      const overItems = getContainerItems(overContainer)
      const activeIndex = activeItems.indexOf(active.id as string)
      const overIndex = overItems.indexOf(over.id as string)

      let newIndex: number
      if (over.id === overContainer) {
        // Dropped on the container itself -- add to end
        newIndex = overItems.length
      } else {
        const isBelowOverItem =
          over &&
          active.rect.current.translated &&
          active.rect.current.translated.top >
            over.rect.top + over.rect.height

        const modifier = isBelowOverItem ? 1 : 0
        newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length
      }

      // Remove from active container, add to over container
      const newActiveItems = activeItems.filter((id) => id !== active.id)
      const newOverItems = [
        ...overItems.slice(0, newIndex),
        active.id as string,
        ...overItems.slice(newIndex),
      ]

      setContainerItems(activeContainer, newActiveItems)
      setContainerItems(overContainer, newOverItems)
    },
    [findContainer, getContainerItems, setContainerItems, columns]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const activeContainer = findContainer(active.id)
      let overContainer = findContainer(over.id)

      if (over.id === 'unassigned' || columns[over.id as string]) {
        overContainer = over.id as string
      }

      if (!activeContainer || !overContainer) return

      if (activeContainer === overContainer) {
        // Reordering within the same container
        const items = getContainerItems(activeContainer)
        const activeIndex = items.indexOf(active.id as string)
        const overIndex = items.indexOf(over.id as string)

        if (activeIndex !== overIndex && overIndex >= 0) {
          setContainerItems(
            activeContainer,
            arrayMove(items, activeIndex, overIndex)
          )
        }
      }
      // Cross-container moves are already handled in handleDragOver
    },
    [findContainer, getContainerItems, setContainerItems, columns]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleSave = useCallback(() => {
    const assignments: Array<{
      jobId: string
      technicianId: string
      orderIndex: number
    }> = []

    for (const [techId, jobIds] of Object.entries(columns)) {
      jobIds.forEach((jobId, index) => {
        assignments.push({
          jobId,
          technicianId: techId,
          orderIndex: index,
        })
      })
    }

    startTransition(async () => {
      await saveSchedule(date, assignments)
      setHasChanges(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    })
  }, [columns, date])

  const activeJob = activeId ? jobs[activeId as string] : null

  const totalAssigned = useMemo(
    () => Object.values(columns).reduce((sum, ids) => sum + ids.length, 0),
    [columns]
  )

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-gray-900">Dispatch Board</h1>
          <DateSelector currentDate={date} />
        </div>

        <div className="flex items-center gap-3">
          {/* Counts row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mr-2">
            <span>
              <span className="font-semibold text-gray-900">{totalAssigned}</span> assigned
            </span>
            <span className="text-gray-300">·</span>
            <span>
              <span className="font-semibold text-gray-900">{unassigned.length}</span> unassigned
            </span>
          </div>

          <button
            onClick={handleSave}
            disabled={isPending || !hasChanges}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              saveStatus === 'saved'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white',
              (isPending || !hasChanges) && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle className="size-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="size-4" />
                Save Schedule
              </>
            )}
          </button>
        </div>
      </div>

      {/* Board area */}
      <div className="flex flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Unassigned pool - left sidebar */}
          <UnassignedPool jobIds={unassigned} jobs={jobs} />

          {/* Tech columns - horizontal scroll */}
          <div className="flex flex-1 gap-4 overflow-x-auto p-4 pb-4">
            {technicians.map((tech) => (
              <TechColumn
                key={tech.id}
                tech={tech}
                jobIds={columns[tech.id] ?? []}
                jobs={jobs}
              />
            ))}

            {technicians.length === 0 && (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-gray-400">
                  No active technicians found
                </p>
              </div>
            )}
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeJob ? (
              <div className="w-[220px]">
                <DraggableJobCard job={activeJob} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
