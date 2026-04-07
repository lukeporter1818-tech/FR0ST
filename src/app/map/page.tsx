import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { JobStatus } from '@/generated/prisma'
import { MapLoader } from '@/components/map/MapLoader'
import type { JobPin, StorePin } from '@/components/map/ServiceMap'

export const metadata = { title: 'Service Map — Frost' }

export default async function MapPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const ACTIVE_STATUSES: JobStatus[] = [JobStatus.NEW, JobStatus.SCHEDULED, JobStatus.IN_PROGRESS]

  // Parallel fetch: mapped jobs + unmapped count + active store pins
  const [raw, unmappedCount, stores] = await Promise.all([
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
    }),
  ])

  // lat/lng confirmed non-null by query filters
  const jobs = raw as JobPin[]
  const storePins = stores as StorePin[]

  return <MapLoader jobs={jobs} unmappedCount={unmappedCount} stores={storePins} />
}
