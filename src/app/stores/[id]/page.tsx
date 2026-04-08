import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { hasRole, isStoreManager } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'
import { updateStore, deleteStore } from '@/lib/actions/stores'

export const metadata = { title: 'Edit Location — Frost' }

export default async function EditStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/ai')
  if (!isStoreManager(session.user.email)) redirect('/stores')
  const isAdmin = hasRole(session.user.role, 'ADMIN')

  const { id } = await params
  const { error } = await searchParams

  const store = await prisma.store.findUnique({ where: { id } }).catch(() => null)
  if (!store) notFound()

  const geocoded = store.lat !== null && store.lng !== null

  return (
    <div className="max-w-lg space-y-6">
      {error === 'failed' && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not save. Check your input — the location code must be unique — and try again.
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-gray-100">Edit Service Location</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Saving re-geocodes the address and updates the Service Map pin.
        </p>
        {!geocoded && (
          <p className="mt-2 text-xs text-amber-400">
            ⚠ This location has no coordinates — the address may not have geocoded. Saving will retry geocoding.
          </p>
        )}
      </div>

      <form action={updateStore} className="space-y-5">
        {/* Hidden ID */}
        <input type="hidden" name="id" value={store.id} />

        {/* Code + Name */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[5rem_1fr]">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="code">
              Code <span className="text-red-400">*</span>
            </label>
            <input
              id="code"
              name="code"
              required
              maxLength={5}
              defaultValue={store.code}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono font-bold uppercase tracking-widest text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="name">
              Location Name <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={120}
              defaultValue={store.name}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400" htmlFor="address">
            Street Address <span className="text-red-400">*</span>
          </label>
          <input
            id="address"
            name="address"
            required
            maxLength={200}
            defaultValue={store.address}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
          />
        </div>

        {/* City / State / ZIP */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_5rem_6rem]">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="city">City</label>
            <input
              id="city"
              name="city"
              maxLength={80}
              defaultValue={store.city ?? ''}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="state">State</label>
            <input
              id="state"
              name="state"
              maxLength={2}
              defaultValue={store.state ?? ''}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="zip">ZIP</label>
            <input
              id="zip"
              name="zip"
              maxLength={10}
              defaultValue={store.zip ?? ''}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400" htmlFor="notes">
            Notes <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            maxLength={500}
            defaultValue={store.notes ?? ''}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-amber-500 transition-colors"
          >
            Save Changes
          </button>
          <Link
            href="/stores"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>

      {/* Admin-only: permanent delete */}
      {isAdmin && (
        <div className="border-t border-white/10 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">Danger Zone</p>
          <form action={deleteStore.bind(null, store.id)}>
            <button
              type="submit"
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Delete this location permanently
            </button>
          </form>
          <p className="mt-2 text-xs text-gray-600">
            Removes this store from Frost and the Service Map. Cannot be undone.
          </p>
        </div>
      )}
    </div>
  )
}
