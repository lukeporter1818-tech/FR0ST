'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { deleteStore } from '@/lib/actions/stores'

export type StoreRow = {
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

export function StoreTable({
  stores,
  canManage,
}: {
  stores: StoreRow[]
  canManage: boolean
}) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {stores.map((store, i) => {
        const geocoded = store.lat !== null && store.lng !== null
        const deleteAction = deleteStore.bind(null, store.id)

        return (
          <div
            key={store.id}
            role="button"
            tabIndex={0}
            onClick={() => router.push(`/stores/${store.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                router.push(`/stores/${store.id}`)
              }
            }}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03] ${
              i !== 0 ? 'border-t border-white/8' : ''
            }`}
          >
            {/* Code badge */}
            <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-cyan-500/15 px-2 py-0.5 text-xs font-bold tracking-wider text-cyan-300 ring-1 ring-inset ring-cyan-500/25 min-w-[3rem] text-center">
              {store.code}
            </span>

            {/* Name + address */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-200">{store.name}</p>
              <p className="truncate text-xs text-gray-500">
                {store.address}
                {store.city ? `, ${store.city}` : ''}
                {store.state ? ` ${store.state}` : ''}
              </p>
            </div>

            {/* Geocode warning */}
            {!geocoded && (
              <span
                className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20"
                title="No coordinates — check the address"
              >
                <AlertTriangle className="size-3" />
                Not geocoded
              </span>
            )}

            {/* Delete — stopPropagation prevents row onClick from firing */}
            {canManage && (
              <form
                action={deleteAction}
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium leading-none text-red-500 hover:text-red-300 transition-colors rounded"
                >
                  Delete
                </button>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
