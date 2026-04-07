import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, MapPin, AlertTriangle } from 'lucide-react'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'
import { toggleStoreActive } from '@/lib/actions/stores'

export const metadata = { title: 'Service Locations — Frost' }

export default async function StoresPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/ai')

  const stores = await prisma.store.findMany({
    orderBy: [{ active: 'desc' }, { code: 'asc' }],
  }).catch(() => [])

  const active   = stores.filter((s) => s.active)
  const inactive = stores.filter((s) => !s.active)

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Service Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>
        <Link
          href="/stores/new"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 text-gray-900 px-4 py-2 text-sm font-medium hover:bg-amber-500 transition-colors sm:shrink-0"
        >
          <Plus className="size-4" />
          Add Location
        </Link>
      </div>

      {/* Active stores */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Active
        </p>
        {active.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
            <MapPin className="mx-auto size-6 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No service locations yet.</p>
            <p className="text-xs text-gray-600 mt-1">
              Add a location to show store pins on the Service Map.
            </p>
          </div>
        ) : (
          <StoreTable stores={active} />
        )}
      </section>

      {/* Inactive stores */}
      {inactive.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Inactive
          </p>
          <StoreTable stores={inactive} dimmed />
        </section>
      )}
    </div>
  )
}

type StoreRow = {
  id: string
  code: string
  name: string
  address: string
  city: string | null
  state: string | null
  active: boolean
  lat: number | null
  lng: number | null
}

function StoreTable({ stores, dimmed = false }: { stores: StoreRow[]; dimmed?: boolean }) {
  return (
    <div className={`rounded-xl border border-white/10 overflow-hidden ${dimmed ? 'opacity-50' : ''}`}>
      {stores.map((store, i) => {
        const geocoded = store.lat !== null && store.lng !== null
        const toggleAction = toggleStoreActive.bind(null, store.id)
        return (
          <div
            key={store.id}
            className={`flex items-center gap-3 px-4 py-3 ${i !== 0 ? 'border-t border-white/8' : ''} hover:bg-white/[0.03]`}
          >
            {/* Code badge */}
            <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-bold tracking-wider text-cyan-300 ring-1 ring-inset ring-cyan-500/25 min-w-[3rem] text-center">
              {store.code}
            </span>

            {/* Name + address */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-200">{store.name}</p>
              <p className="truncate text-xs text-gray-500">
                {store.address}{store.city ? `, ${store.city}` : ''}
                {store.state ? ` ${store.state}` : ''}
              </p>
            </div>

            {/* Geocode status */}
            {!geocoded && (
              <span
                className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20"
                title="No coordinates — check the address"
              >
                <AlertTriangle className="size-3" />
                Not geocoded
              </span>
            )}

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/stores/${store.id}`}
                className="text-xs text-gray-500 hover:text-gray-200 font-medium transition-colors"
              >
                Edit
              </Link>
              <form action={toggleAction}>
                <button
                  type="submit"
                  className="text-xs text-gray-600 hover:text-gray-400 font-medium transition-colors"
                >
                  {store.active ? 'Deactivate' : 'Activate'}
                </button>
              </form>
            </div>
          </div>
        )
      })}
    </div>
  )
}
