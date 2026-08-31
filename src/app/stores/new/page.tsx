import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { hasRole, isStoreManager } from '@/lib/auth-guard'
import { createStore } from '@/lib/actions/stores'

export const metadata = { title: 'Add Location — Frost' }

export default async function NewStorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/ai')
  if (!isStoreManager(session.user.canManageStores)) redirect('/stores')

  const { error } = await searchParams

  return (
    <div className="max-w-lg space-y-6">
      {error === 'failed' && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Could not save. Check your input — the location code must be unique — and try again.
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-gray-100">Add Service Location</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          The code is the schedule abbreviation (e.g. WFM, TGT). The address is
          geocoded automatically so the store pin appears on the Service Map.
        </p>
      </div>

      <form action={createStore} className="space-y-5">
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
              placeholder="WFM"
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
              placeholder="Whole Foods Market – Tyson's Corner"
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
            placeholder="1961 Chain Bridge Rd"
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
              placeholder="McLean"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="state">State</label>
            <input
              id="state"
              name="state"
              maxLength={2}
              placeholder="VA"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-400" htmlFor="zip">ZIP</label>
            <input
              id="zip"
              name="zip"
              maxLength={10}
              placeholder="22102"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
            />
          </div>
        </div>

        {/* Zone */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400" htmlFor="zone">
            Zone <span className="text-gray-600">(optional)</span>
          </label>
          <select
            id="zone"
            name="zone"
            defaultValue=""
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
          >
            <option value="">Unassigned</option>
            <option value="North">North</option>
            <option value="South">South</option>
            <option value="East">East</option>
            <option value="West">West</option>
          </select>
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
            placeholder="Loading dock is on the south side, etc."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-none"
          />
        </div>

        {/* Equipment */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400" htmlFor="equipment">
            Equipment on Site <span className="text-gray-600">(optional)</span>
          </label>
          <textarea
            id="equipment"
            name="equipment"
            rows={2}
            maxLength={500}
            placeholder="e.g. 2x scissor lifts, 1x pump table, 1x forklift"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-amber-500 transition-colors"
          >
            Save Location
          </button>
          <Link
            href="/stores"
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
