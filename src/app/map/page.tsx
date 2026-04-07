import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { JobStatus } from '@/generated/prisma'
import { MapLoader } from '@/components/map/MapLoader'
import type { JobPin, StorePin, TechAssignment } from '@/components/map/ServiceMap'

export const metadata = { title: 'Service Map — Frost' }

/** Derive up-to-2-letter initials from a full name. */
function getInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

export default async function MapPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const ACTIVE_STATUSES: JobStatus[] = [JobStatus.NEW, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS]

  // Today at UTC midnight — matches BoardEntry @db.Date storage used by the schedule.
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayDate = new Date(todayIso + 'T00:00:00.000Z')

  // Parallel fetch: mapped jobs + unmapped count + active store pins + today's assignments
  const [raw, unmappedCount, stores, boardEntries] = await Promise.all([
    prisma.job.findMany({
      where: {
        lat: { not: null },
        lng: { not: null },
        status: { in: ACTIVE_STATUSES },
      },
      select: {
        id:           true,
        customerName: true,
        address:      true,
        city:         true,
        state:        true,
        priority:     true,
        status:       true,
        lat:          true,
        lng:          true,
        assignedTech:  { select: { name: true } },
        scheduleEntry: { select: { status: true } },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 300,
    }),
    prisma.job.count({
      where: {
        OR: [{ lat: null }, { lng: null }],
        status: { in: ACTIVE_STATUSES },
      },
    }),
    prisma.store.findMany({
      where: { active: true, lat: { not: null }, lng: { not: null } },
      select: { id: true, code: true, name: true, address: true, city: true, state: true, lat: true, lng: true, notes: true },
    }).catch(() => []),
    // Today's board entries that have a non-empty assignment (the store code).
    // Exact single-code match: assignment is the raw store code entered by the dispatcher.
    prisma.boardEntry.findMany({
      where: { date: todayDate, NOT: { assignment: '' } },
      select: {
        assignment: true,
        technician: { select: { name: true } },
        manualName: true,
      },
    }).catch(() => []),
  ])

  // lat/lng confirmed non-null by query filters
  const jobs = raw as JobPin[]
  const storePins = stores as StorePin[]

  // Build tech assignments: normalize code to UPPERCASE for case-insensitive matching.
  // Only entries where a tech name (or manual name) is available produce an assignment.
  const techAssignments: TechAssignment[] = boardEntries
    .map(e => {
      const code = e.assignment?.trim()
      const name = e.technician?.name ?? e.manualName ?? ''
      if (!code || !name) return null
      return { storeCode: code.toUpperCase(), initials: getInitials(name) }
    })
    .filter((x): x is TechAssignment => x !== null)

  return <MapLoader jobs={jobs} unmappedCount={unmappedCount} stores={storePins} techAssignments={techAssignments} />
}
