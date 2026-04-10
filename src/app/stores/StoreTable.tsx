'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
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

// ─── Edit button ──────────────────────────────────────────────────────────────
// Isolated so the router hook is bound once per button, not in a map callback.

function EditButton({ id }: { id: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        router.push(`/stores/${id}`)
      }}
      className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors"
    >
      Edit
    </button>
  )
}

// ─── Delete button ────────────────────────────────────────────────────────────
// useTransition is required when calling a server action that ends with
// redirect(). Without it the NEXT_REDIRECT throw propagates as an unhandled
// promise rejection and navigation never fires — the button appears to do nothing.

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition()

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    start(() => deleteStore(id))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
    >
      {pending ? 'Deleting…' : 'Delete'}
    </button>
  )
}

// ─── Store table ──────────────────────────────────────────────────────────────

export function StoreTable({
  stores,
  canManage: _canManage,
}: {
  stores: StoreRow[]
  canManage: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      {stores.map((store, i) => (
        <div
          key={store.id}
          className={`flex items-center justify-between px-4 py-3 ${
            i !== 0 ? 'border-t border-white/10' : ''
          }`}
        >
          {/* Store info */}
          <div className="min-w-0 flex-1 pr-4">
            <p className="truncate text-sm font-medium text-gray-200">{store.name}</p>
            <p className="truncate text-xs text-gray-500">
              {store.code} · {store.address}
              {store.city ? `, ${store.city}` : ''}
              {store.state ? ` ${store.state}` : ''}
            </p>
          </div>

          {/* Action buttons — always visible, no permission check */}
          <div className="flex shrink-0 gap-2">
            <EditButton id={store.id} />
            <DeleteButton id={store.id} name={store.name} />
          </div>
        </div>
      ))}
    </div>
  )
}
