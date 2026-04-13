import Link from 'next/link'
import { Plus, UserX, Shield, Truck, Headphones, User } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireAdminSession } from '@/lib/actions/users'
import { DeleteUserButton } from '@/components/users/DeleteUserButton'

/** Strip internal placeholder domains so the UI shows only the visible login. */
function formatLogin(email: string): { display: string; isInternal: boolean } {
  if (email.endsWith('@users.local'))
    return { display: email.replace('@users.local', ''), isInternal: true }
  if (email.endsWith('@invite.local'))
    return { display: email.replace('@invite.local', ''), isInternal: true }
  return { display: email, isInternal: false }
}

const ROLE_STYLES: Record<string, { label: string; badgeClass: string; icon: React.ElementType }> = {
  ADMIN:      { label: 'Admin',      badgeClass: 'bg-red-500/15  text-red-300  ring-red-500/30',   icon: Shield    },
  DISPATCHER: { label: 'Dispatcher', badgeClass: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',  icon: Headphones },
  TECHNICIAN: { label: 'Technician', badgeClass: 'bg-gray-500/10 text-gray-400 ring-gray-500/25',  icon: Truck     },
}

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  active: boolean
  createdAt: Date
  technician: { id: string; name: string; tradeType: string | null } | null
}

export default async function UsersPage() {
  const session = await requireAdminSession()
  const currentUserId = session.user.id

  const users = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      technician: { select: { id: true, name: true, tradeType: true } },
    },
  })

  const active   = users.filter((u) => u.active)
  const inactive = users.filter((u) => !u.active)

  const techUsers   = active.filter((u) => u.role === 'TECHNICIAN')
  const officeUsers = active.filter((u) => u.role !== 'TECHNICIAN')

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">{active.length} active · {inactive.length} inactive</p>
        </div>
        <Link
          href="/settings/users/new"
          className="inline-flex items-center gap-2 rounded-lg bg-amber-400 text-gray-900 px-4 py-2 text-sm font-medium hover:bg-amber-500 transition-colors sm:shrink-0"
        >
          <Plus className="size-4" />
          Add User
        </Link>
      </div>

      {/* Office Users — Admins & Dispatchers */}
      {officeUsers.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Admins &amp; Dispatchers
          </p>
          <UserTable users={officeUsers} currentUserId={currentUserId} />
        </section>
      )}

      {/* Technicians */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Technicians
        </p>
        {techUsers.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center">
            <p className="text-sm text-gray-500">No technician accounts yet.</p>
            <p className="text-xs text-gray-600 mt-1">Use <strong className="text-gray-400">Invite Technician</strong> to create one.</p>
          </div>
        ) : (
          <UserTable users={techUsers} currentUserId={currentUserId} />
        )}
      </section>

      {/* Inactive */}
      {inactive.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Inactive</p>
          <UserTable users={inactive} currentUserId={currentUserId} dimmed />
        </section>
      )}
    </div>
  )
}

function UserTable({
  users,
  currentUserId,
  dimmed = false,
}: {
  users: UserRow[]
  currentUserId: string
  dimmed?: boolean
}) {
  if (users.length === 0) return null

  return (
    <>
      {/* ── Mobile card list ── */}
      <div className={`sm:hidden rounded-xl border border-white/10 divide-y divide-white/8 overflow-hidden ${dimmed ? 'opacity-40' : ''}`}>
        {users.map((user) => {
          const role = ROLE_STYLES[user.role] ?? ROLE_STYLES.TECHNICIAN
          const RoleIcon = role.icon
          const { display, isInternal } = formatLogin(user.email)
          return (
            <div key={user.id} className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-200 truncate flex items-center gap-1.5">
                    {!user.active && <UserX className="size-3.5 text-gray-500 shrink-0" />}
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                    {isInternal && <User className="size-3 text-gray-600 shrink-0" />}
                    {display}
                  </p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${role.badgeClass}`}>
                  <RoleIcon className="size-3" />
                  {role.label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                {user.technician ? (
                  <Link href={`/technicians/${user.technician.id}`} className="text-xs text-amber-400 hover:underline truncate">
                    → {user.technician.name}
                  </Link>
                ) : (
                  <span className="text-xs text-gray-700">No linked tech</span>
                )}
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/settings/users/${user.id}`}
                    className="text-xs text-gray-500 hover:text-gray-200 font-medium transition-colors"
                  >
                    Edit
                  </Link>
                  {user.id !== currentUserId && (
                    <DeleteUserButton userId={user.id} userName={user.name} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop table ── */}
      <div className={`hidden sm:block rounded-xl border border-white/10 overflow-x-auto`}>
        <table className={`w-full min-w-[560px] text-sm ${dimmed ? 'opacity-40' : ''}`}>
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Login</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Role</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Linked Tech</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {users.map((user) => {
              const role = ROLE_STYLES[user.role] ?? ROLE_STYLES.TECHNICIAN
              const RoleIcon = role.icon
              return (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-gray-200">
                    <div className="flex items-center gap-2">
                      {!user.active && <UserX className="size-3.5 text-gray-500" />}
                      {user.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {(() => {
                      const { display, isInternal } = formatLogin(user.email)
                      return isInternal ? (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <User className="size-3 text-gray-600" />
                          {display}
                        </span>
                      ) : display
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${role.badgeClass}`}>
                      <RoleIcon className="size-3" />
                      {role.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {user.technician ? (
                      <Link href={`/technicians/${user.technician.id}`} className="hover:underline text-amber-400">
                        {user.technician.name}
                      </Link>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/settings/users/${user.id}`}
                        className="text-xs text-gray-500 hover:text-gray-200 font-medium transition-colors"
                      >
                        Edit
                      </Link>
                      {user.id !== currentUserId && (
                        <DeleteUserButton userId={user.id} userName={user.name} />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
