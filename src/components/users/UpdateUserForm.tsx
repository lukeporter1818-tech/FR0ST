'use client'

import { useActionState } from 'react'
import { updateUser } from '@/lib/actions/users'

interface Props {
  user: {
    id: string
    name: string
    email: string
    role: string
    phone: string | null
    canManageStores: boolean
    technician: { id: string; name: string } | null
  }
  unlinkedTechs: { id: string; name: string; tradeType: string | null }[]
  isSelf: boolean
}

export function UpdateUserForm({ user, unlinkedTechs, isSelf }: Props) {
  const updateWithId = updateUser.bind(null, user.id)
  const [error, action, pending] = useActionState(
    async (_prev: string | null, formData: FormData) => {
      try {
        await updateWithId(formData)
        return null
      } catch (e) {
        return e instanceof Error ? e.message : 'Failed to update user'
      }
    },
    null
  )

  return (
    <form action={action} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
      <p className="text-sm font-medium text-gray-900">Edit User</p>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={user.name}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            defaultValue={user.email}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
          <select
            name="role"
            defaultValue={user.role}
            disabled={isSelf}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white disabled:opacity-50"
          >
            <option value="TECHNICIAN">Technician</option>
            <option value="DISPATCHER">Dispatcher</option>
            <option value="ADMIN">Admin</option>
          </select>
          {isSelf && (
            <p className="mt-1 text-xs text-gray-400">You cannot change your own role</p>
          )}
          {/* Always submit role even when disabled */}
          {isSelf && <input type="hidden" name="role" value={user.role} />}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
          <input
            name="phone"
            type="tel"
            maxLength={20}
            defaultValue={user.phone ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>

        <div className="col-span-2">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              name="canManageStores"
              defaultChecked={user.canManageStores}
              className="size-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
            />
            <span className="text-sm font-medium text-gray-700">Can manage service locations</span>
          </label>
          <p className="mt-1 text-xs text-gray-400 ml-6.5">
            Allows creating, editing, and deleting stores
          </p>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Linked Technician Profile</label>
          <select
            name="technicianId"
            defaultValue={user.technician?.id ?? ''}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          >
            <option value="">— None —</option>
            {user.technician && (
              <option value={user.technician.id}>{user.technician.name} (current)</option>
            )}
            {unlinkedTechs
              .filter((t) => t.id !== user.technician?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.tradeType ? ` (${t.tradeType})` : ''}
                </option>
              ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}
