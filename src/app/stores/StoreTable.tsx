'use client'

import { useRouter } from 'next/navigation'
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
  canManage: _canManage,
}: {
  stores: StoreRow[]
  canManage: boolean
}) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {stores.map((store, i) => (
        <div
          key={store.id}
          className={`flex items-center justify-between px-4 py-3 ${i !== 0 ? 'border-t border-white/10' : ''}`}
        >
          {/* Store info */}
          <div>
            <p className="text-sm font-medium text-gray-200">{store.name}</p>
            <p className="text-xs text-gray-500">{store.code} · {store.address}{store.city ? `, ${store.city}` : ''}{store.state ? ` ${store.state}` : ''}</p>
          </div>

          {/* Action buttons — always visible, no permission check */}
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/stores/${store.id}`)
              }}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Edit
            </button>

            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (!confirm('Delete this store?')) return
                await deleteStore(store.id)
              }}
              className="px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
