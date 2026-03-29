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

  // Only show techs that have a board entry for this date (roster-based)
  const rows = entries
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((entry) => ({
      id: entry.id,
      technicianId: entry.technicianId,
      manualName: entry.manualName,
      name: entry.technician?.name ?? entry.manualName ?? '',
      assignment: entry.assignment ?? '',
      note: entry.note ?? '',
      status: entry.status,
      orderIndex: entry.orderIndex,
    }))

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
