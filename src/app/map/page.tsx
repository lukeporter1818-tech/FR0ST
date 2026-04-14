import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { MapLoader } from '@/components/map/MapLoader'
import type { StorePin, TechAssignment } from '@/components/map/ServiceMap'

export const metadata = { title: 'Service Map — Frost' }

/** Derive up-to-2-letter initials from a full name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function MapPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  // Today at UTC midnight — matches BoardEntry @db.Date storage used by the schedule.
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayDate = new Date(todayIso + 'T00:00:00.000Z')

  // Parallel fetch: active store pins + today's assignments
  const [stores, boardEntries] = await Promise.all([
    prisma.store.findMany({
      where: { active: true, lat: { not: null }, lng: { not: null } },
      select: { id: true, code: true, name: true, address: true, city: true, state: true, lat: true, lng: true, notes: true },
    }).catch(() => []),
    // Today's board entries that have a non-empty assignment (the store code).
    prisma.boardEntry.findMany({
      where: { date: todayDate, NOT: { assignment: '' } },
      select: {
        assignment: true,
        technician: { select: { name: true } },
        manualName: true,
      },
    }).catch(() => []),
  ])

  const storePins = stores as StorePin[]

  // Build tech assignments: normalize code to UPPERCASE for case-insensitive matching.
  const techAssignments: TechAssignment[] = boardEntries
    .map(e => {
      const code = e.assignment?.trim()
      const name = e.technician?.name ?? e.manualName ?? ''
      if (!code || !name) return null
      return { storeCode: code.toUpperCase(), initials: getInitials(name) }
    })
    .filter((x): x is TechAssignment => x !== null)

  return <MapLoader stores={storePins} techAssignments={techAssignments} />
}
