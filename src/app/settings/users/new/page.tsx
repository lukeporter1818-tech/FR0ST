import { prisma } from '@/lib/db'
import { requireAdminSession } from '@/lib/actions/users'
import { createUser } from '@/lib/actions/users'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewUserPage() {
  await requireAdminSession()

  // Unlinked technicians (no user account yet)
  const unlinkedTechs = await prisma.technician.findMany({
    where: { active: true, userId: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, tradeType: true },
  })

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link
          href="/settings/users"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="size-4" />
          Back to users
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">Add User</h1>
        <p className="text-sm text-gray-500 mt-0.5">Create a login account for a dispatcher, technician, or admin.</p>
      </div>

      <form action={createUser} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
            <input
              name="name"
              required
              maxLength={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Mike Johnson"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              required
              maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="mike@company.com"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
            <select
              name="role"
              defaultValue="TECHNICIAN"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="TECHNICIAN">Technician</option>
              <option value="DISPATCHER">Dispatcher</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone (optional)</label>
            <input
              name="phone"
              type="tel"
              maxLength={20}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="(555) 123-4567"
            />
          </div>

          {unlinkedTechs.length > 0 && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Link to Technician Profile (optional)
              </label>
              <select
                name="technicianId"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">— None —</option>
                {unlinkedTechs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.tradeType ? ` (${t.tradeType})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            className="flex-1 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            Create User
          </button>
          <Link
            href="/settings/users"
            className="flex-1 text-center border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
