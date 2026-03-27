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

  const [techs, entries] = await Promise.all([
    prisma.technician.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.boardEntry.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
      include: { technician: true },
    }),
  ])

  const rows = techs.map((tech) => {
    const entry = entries.find((e) => e.technicianId === tech.id)
    return {
      technicianId: tech.id,
      name: tech.name,
      assignment: entry?.assignment ?? '',
      note: entry?.note ?? '',
      status: entry?.status ?? null,
      orderIndex: entry?.orderIndex ?? 0,
    }
  })

  return (
    <div className="max-w-2xl">
      <BoardClient
        rows={rows}
        date={date}
        currentUserId={session?.user?.id ?? ''}
        currentUserRole={session?.user?.role ?? 'DISPATCHER'}
        currentTechnicianId={session?.user?.technicianId ?? null}
      />
    </div>
  )
}
