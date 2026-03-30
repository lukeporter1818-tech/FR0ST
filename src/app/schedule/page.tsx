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

  const startOfDay = new Date(date + 'T00:00:00.000Z')
  const endOfDay = new Date(date + 'T23:59:59.999Z')

  const [allTechs, entries] = await Promise.all([
    prisma.technician.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.boardEntry.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: { technician: true },
    }),
  ])

  // Build a merged roster: all active techs always appear; row content is date-specific.
  // Techs with a saved entry for this date get that entry's data.
  // Techs with no entry for this date appear as virtual rows with blank/default data.
  // Manual name entries are always date-specific (no virtual fallback).

  const entryByTechId = new Map<string, typeof entries[number]>()
  const manualEntries: typeof entries = []
  for (const entry of entries) {
    if (entry.technicianId) entryByTechId.set(entry.technicianId, entry)
    else if (entry.manualName) manualEntries.push(entry)
  }

  // Real tech rows: active techs that have a saved entry — preserve saved orderIndex
  const realTechRows = allTechs
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

  // Virtual rows: active techs with no entry for this date — blank data, float after real rows
  const virtualTechRows = allTechs
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

  // Manual rows: date-specific only
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
        allTechs={allTechs}
        date={date}
        currentUserId={session?.user?.id ?? ''}
        currentUserRole={session?.user?.role ?? 'DISPATCHER'}
        currentTechnicianId={session?.user?.technicianId ?? null}
      />
    </div>
  )
}
