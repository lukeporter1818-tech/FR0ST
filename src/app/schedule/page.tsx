import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { BoardClient } from '@/components/board/BoardClient'

function getLocalTodayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [params, session] = await Promise.all([
    searchParams,
    auth(),
  ])

  const date =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : getLocalTodayStr()

  // Use exact UTC midnight for @db.Date field — avoids timezone-dependent range comparisons
  const exactDate = new Date(date + 'T00:00:00.000Z')

  // rosterTechs  = active + onSchedule → these always appear on every date
  // availableTechs = active + !onSchedule → shown in "Add Tech" picker to re-add to roster
  const [rosterTechs, availableTechs, entries] = await Promise.all([
    prisma.technician.findMany({
      where: { active: true, onSchedule: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.technician.findMany({
      where: { active: true, onSchedule: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.boardEntry.findMany({
      where: { date: exactDate },
      select: {
        id: true,
        technicianId: true,
        manualName: true,
        assignment: true,
        note: true,
        status: true,
        orderIndex: true,
        isEmergency: true,
      },
    }),
  ])

  // Build the board rows by merging the persistent roster with date-specific board data.
  // rosterTechs are always shown. Only the assignment/note/status/emergency changes per date.

  const entryByTechId = new Map<string, typeof entries[number]>()
  const manualEntries: typeof entries = []
  for (const entry of entries) {
    if (entry.technicianId) entryByTechId.set(entry.technicianId, entry)
    else if (entry.manualName) manualEntries.push(entry)
  }

  // Real tech rows: roster techs that have a saved entry for this date — use saved data
  const realTechRows = rosterTechs
    .filter((tech) => entryByTechId.has(tech.id))
    .map((tech) => {
      const entry = entryByTechId.get(tech.id)!
      return {
        id: entry.id,
        technicianId: tech.id,
        manualName: null as null,
        name: tech.name,
        assignment: entry.assignment ?? '',
        note: entry.note ?? '',
        status: entry.status,
        orderIndex: entry.orderIndex,
        isEmergency: entry.isEmergency,
      }
    })
    .sort((a, b) => a.orderIndex - b.orderIndex)

  // Virtual rows: roster techs with no board entry for this date — blank, in-memory only
  const virtualTechRows = rosterTechs
    .filter((tech) => !entryByTechId.has(tech.id))
    .map((tech) => ({
      id: `virtual:${tech.id}`,
      technicianId: tech.id,
      manualName: null as null,
      name: tech.name,
      assignment: '',
      note: '',
      status: null as null,
      orderIndex: 9999,
      isEmergency: false,
    }))

  // Manual rows: date-specific only (contractors, temp names)
  const manualRows = manualEntries
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((entry) => ({
      id: entry.id,
      technicianId: null as null,
      manualName: entry.manualName,
      name: entry.manualName ?? '',
      assignment: entry.assignment ?? '',
      note: entry.note ?? '',
      status: entry.status,
      orderIndex: entry.orderIndex,
      isEmergency: entry.isEmergency,
    }))

  const rows = [...realTechRows, ...virtualTechRows, ...manualRows]

  return (
    <div className="max-w-2xl">
      <BoardClient
        rows={rows}
        allTechs={availableTechs}
        date={date}
        currentUserId={session?.user?.id ?? ''}
        currentUserRole={session?.user?.role ?? 'DISPATCHER'}
        currentTechnicianId={session?.user?.technicianId ?? null}
      />
    </div>
  )
}
