import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayUTCRange(): { start: Date; end: Date } {
  const dateStr = new Date().toISOString().slice(0, 10)
  return {
    start: new Date(dateStr + 'T00:00:00.000Z'),
    end:   new Date(dateStr + 'T23:59:59.999Z'),
  }
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({
  label, value, accent,
}: {
  label: string
  value: number
  accent?: 'red' | 'green' | 'amber'
}) {
  const valueColor = accent === 'red'   ? 'text-red-400'
                   : accent === 'green' ? 'text-green-400'
                   : accent === 'amber' ? 'text-amber-400'
                   : 'text-white'
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <p className={cn('text-3xl font-bold leading-none tabular-nums', valueColor)}>{value}</p>
    </div>
  )
}

function ActivityStat({
  label, value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <span className="text-lg font-bold text-gray-300 tabular-nums leading-none">{value}</span>
      <span className="text-xs text-gray-500 leading-tight">{label}</span>
    </div>
  )
}

const STATUS_BADGE: Record<string, string> = {
  ASSIGNED: 'bg-blue-500/15   text-blue-300   ring-blue-500/30',
  EN_ROUTE: 'bg-amber-500/15  text-amber-300  ring-amber-500/30',
  ON_SITE:  'bg-green-500/15  text-green-300  ring-green-500/30',
  WAITING:  'bg-yellow-500/15 text-yellow-300 ring-yellow-500/30',
  PARTS:    'bg-orange-500/15 text-orange-300 ring-orange-500/30',
  PM:       'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  DONE:     'bg-gray-500/10   text-gray-500   ring-gray-500/20',
  OUT:      'bg-red-500/15    text-red-300    ring-red-500/30',
}
const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'WO', EN_ROUTE: 'En Route', ON_SITE: 'On Site',
  WAITING: 'Waiting', PARTS: 'Parts', PM: 'PM', DONE: 'Done', OUT: 'Out',
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn(
      'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
      STATUS_BADGE[status] ?? 'bg-gray-500/10 text-gray-500 ring-gray-500/20'
    )}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

const TASK_BADGE: Record<string, string> = {
  OPEN:        'bg-gray-500/10  text-gray-400  ring-gray-500/20',
  IN_PROGRESS: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
}
const TASK_LABELS: Record<string, string> = {
  OPEN: 'Open', IN_PROGRESS: 'In Progress',
}

// "Busyness" score for sorting active techs — emergency always floats first
const STATUS_WEIGHT: Record<string, number> = {
  ON_SITE: 6, EN_ROUTE: 5, WAITING: 4, PARTS: 3, ASSIGNED: 2, OUT: 1,
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OverviewPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/')

  const { start, end } = todayUTCRange()

  // Single parallel round-trip for all data
  const [boardEntries, openTasks, frostCount, chatCount] = await Promise.all([
    prisma.boardEntry.findMany({
      where: { date: { gte: start, lte: end } },
      select: {
        id: true,
        technicianId: true,
        manualName: true,
        assignment: true,
        status: true,
        isEmergency: true,
        technician: { select: { name: true } },
      },
    }),
    prisma.managementTask.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'asc' },
    }).catch(() => [] as Array<{ id: string; title: string; status: string }>),
    prisma.aIInteraction.count({
      where: { createdAt: { gte: start, lte: end } },
    }).catch(() => 0),
    prisma.chatMessage.count({
      where: { createdAt: { gte: start, lte: end } },
    }).catch(() => 0),
  ])

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const totalRows = boardEntries.length

  // Single pass over entries — avoids multiple array iterations
  const emergencyRows: typeof boardEntries = []
  let completedCount = 0
  let activeCount = 0
  let assignedCount = 0
  for (const e of boardEntries) {
    if (e.isEmergency) emergencyRows.push(e)
    if (e.status === 'DONE') completedCount++
    else if (e.status !== 'OUT') activeCount++
    if (e.assignment && e.assignment.trim()) assignedCount++
  }

  const unassignedCount = totalRows - assignedCount
  const assignedPercent = totalRows > 0 ? Math.round((assignedCount / totalRows) * 100) : 0

  // Most active techs: non-DONE rows with an assignment, sorted by busyness
  const activeTechs = boardEntries
    .filter((e) => e.status !== 'DONE' && e.assignment)
    .sort((a, b) => {
      const aScore = (a.isEmergency ? 100 : 0) + (STATUS_WEIGHT[a.status ?? ''] ?? 0)
      const bScore = (b.isEmergency ? 100 : 0) + (STATUS_WEIGHT[b.status ?? ''] ?? 0)
      return bScore - aScore
    })
    .slice(0, 3)

  const emergencyList = emergencyRows.slice(0, 8)

  const hasAnyData = totalRows > 0 || openTasks.length > 0

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Daily Snapshot</h1>
        <p className="text-sm text-gray-500 mt-0.5">{todayLabel()}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="Today's Board" value={totalRows} />
        <MetricCard label="Emergency"     value={emergencyRows.length} accent="red" />
        <MetricCard label="Completed"     value={completedCount}       accent="green" />
        <MetricCard label="Active"        value={activeCount}           accent="amber" />
        <MetricCard label="Open Tasks"    value={openTasks.length} />
      </div>

      {/* Assignment breakdown */}
      {totalRows > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span>
            <span className="font-bold text-white tabular-nums">{assignedCount}</span>
            <span className="text-gray-500 ml-1">assigned</span>
          </span>
          <span className="text-gray-700 hidden sm:inline">·</span>
          {unassignedCount > 0 ? (
            <span>
              <span className="font-bold text-amber-400 tabular-nums">{unassignedCount}</span>
              <span className="text-gray-500 ml-1">unassigned</span>
            </span>
          ) : (
            <span className="text-green-400 font-medium text-xs">All techs assigned ✓</span>
          )}
          <span className="text-gray-700 hidden sm:inline">·</span>
          <span className="text-gray-500">{assignedPercent}% fill rate</span>
        </div>
      )}

      {/* Today's activity */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2.5">
          Today&apos;s Activity
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <ActivityStat label="Frost queries" value={frostCount} />
          <ActivityStat label="Chat messages" value={chatCount} />
          <ActivityStat label="Board entries" value={assignedCount} />
        </div>
      </div>

      {!hasAnyData ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
          <p className="text-sm font-medium text-gray-400">No board entries yet today.</p>
          <p className="text-xs text-gray-600 mt-1">Add technicians to the schedule to start tracking.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Most active techs */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Most Active Today
            </h2>
            {activeTechs.length === 0 ? (
              <p className="text-sm text-gray-600 italic">No active assignments yet.</p>
            ) : (
              <ul className="space-y-2">
                {activeTechs.map((entry, i) => {
                  const name = entry.technician?.name ?? entry.manualName ?? 'Unknown'
                  return (
                    <li
                      key={entry.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                        entry.isEmergency
                          ? 'border-red-500/30 bg-red-500/5'
                          : 'border-white/10 bg-white/[0.03]'
                      )}
                    >
                      <span className="text-xs font-bold text-gray-600 w-4 shrink-0">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-200 truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{entry.assignment}</p>
                      </div>
                      {entry.status && <StatusPill status={entry.status} />}
                      {entry.isEmergency && (
                        <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 rounded px-1.5 leading-5 shrink-0">
                          EMRG
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Emergency items */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
              Emergency Items
            </h2>
            {emergencyList.length === 0 ? (
              <p className="text-sm text-gray-600 italic">No emergency items today.</p>
            ) : (
              <ul className="space-y-2">
                {emergencyList.map((entry) => {
                  const name = entry.technician?.name ?? entry.manualName ?? 'Unknown'
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5"
                    >
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-200 truncate">{name}</p>
                        <p className="text-xs text-gray-500 truncate">{entry.assignment || '—'}</p>
                      </div>
                      {entry.status && <StatusPill status={entry.status} />}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Open tasks list */}
          {openTasks.length > 0 && (
            <section className="sm:col-span-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Open Tasks
              </h2>
              <ul className="space-y-1.5">
                {openTasks.slice(0, 6).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
                  >
                    <span className={cn(
                      'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
                      TASK_BADGE[task.status] ?? 'bg-gray-500/10 text-gray-400 ring-gray-500/20'
                    )}>
                      {TASK_LABELS[task.status] ?? task.status}
                    </span>
                    <p className="text-sm text-gray-300 truncate">{task.title}</p>
                  </li>
                ))}
                {openTasks.length > 6 && (
                  <p className="text-xs text-gray-600 pl-1">
                    +{openTasks.length - 6} more — see Management for full list
                  </p>
                )}
              </ul>
            </section>
          )}

        </div>
      )}
    </div>
  )
}
