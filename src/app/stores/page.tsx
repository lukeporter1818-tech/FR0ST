import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, MapPin } from 'lucide-react'
import { auth } from '@/lib/auth'
import { hasRole, isStoreManager } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'

export const revalidate = 60 // revalidate every 60 seconds
import { StoreTable } from './StoreTable'

export const metadata = { title: 'Service Locations — Frost' }

export default async function StoresPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/ai')

  const canManage = isStoreManager(session.user.canManageStores)

  let stores
  try {
    stores = await prisma.store.findMany({
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    })
  } catch (err) {
    console.error('[stores page] failed to fetch stores:', err)
    throw err
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Service Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stores.length} {stores.length === 1 ? 'location' : 'locations'}
          </p>
        </div>
        {canManage && (
          <Link
            href="/stores/new"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 text-gray-900 px-4 py-2 text-sm font-medium hover:bg-amber-500 transition-colors sm:shrink-0"
          >
            <Plus className="size-4" />
            Add Location
          </Link>
        )}
      </div>

      {stores.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
          <MapPin className="mx-auto size-6 text-gray-600 mb-2" />
          <p className="text-sm text-gray-500">No service locations yet.</p>
          {canManage && (
            <p className="text-xs text-gray-600 mt-1">
              Add a location to show store pins on the Service Map.
            </p>
          )}
        </div>
      ) : (
        <StoreTable stores={stores} canManage={canManage} />
      )}
    </div>
  )
}
