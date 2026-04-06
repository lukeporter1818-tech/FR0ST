import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { MapLoader } from '@/components/map/MapLoader'
import type { JobPin } from '@/components/map/ServiceMap'

export const metadata = { title: 'Service Map — Frost' }

export default async function MapPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Active jobs with confirmed coordinates only
  const raw = await prisma.job.findMany({
    where: {
      lat: { not: null },
      lng: { not: null },
      status: { in: ['NEW', 'SCHEDULED', 'IN_PROGRESS'] },
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
      assignedTech: { select: { name: true } },
      scheduleEntry: { select: { status: true } },
    },
    orderBy: { scheduledDate: 'asc' },
    take: 300,
  })

  // lat/lng are confirmed non-null from the query filter
  const jobs = raw as JobPin[]

  return <MapLoader jobs={jobs} />
}
