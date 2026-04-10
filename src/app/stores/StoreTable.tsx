'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
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

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition()

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${name}"?\n\nThis removes the store and its map pin. Cannot be undone.`)) return
    start(async () => {
      await deleteStore(id)
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      onMouseDown={(e) => e.stopPropagation()}
      disabled={pending}
      className="shrink-0 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : 'Delete'}
    </button>
  )
}

export function StoreTable({
  stores,
  canManage: _canManage,
}: {
  stores: StoreRow[]
  canManage: boolean
}) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {stores.map((store, i) => {
        const geocoded = store.lat !== null && store.lng !== null

        return (
          <div
            key={store.id}
            className={[
              'flex items-center gap-3 px-4 py-3 transition-colors',
              i !== 0 ? 'border-t border-white/8' : '',
            ].join(' ')}
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

            {/* Always-visible action buttons */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); router.push(`/stores/${store.id}`) }}
                onMouseDown={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 border border-white/15 hover:bg-white/[0.06] hover:text-white transition-colors touch-manipulation"
              >
                Edit
              </button>
              <DeleteButton id={store.id} name={store.name} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
