import Link from 'next/link'
import { Plus, UserX, Shield, Truck, Headphones, Mail, User } from 'lucide-react'

/** Strip internal placeholder domains so the UI shows only the visible login. */
function formatLogin(email: string): { display: string; isInternal: boolean } {
  if (email.endsWith('@users.local'))
    return { display: email.replace('@users.local', ''), isInternal: true }
  if (email.endsWith('@invite.local'))
    return { display: email.replace('@invite.local', ''), isInternal: true }
  return { display: email, isInternal: false }
}
import { prisma } from '@/lib/db'
import { requireAdminSession } from '@/lib/actions/users'
import { InviteModalWrapper, InviteModalTriggerButton } from '@/components/invite-modal/InviteModalWrapper'
import { DeleteUserButton } from '@/components/users/DeleteUserButton'

const ROLE_STYLES: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  ADMIN: { label: 'Admin', className: 'bg-red-50 text-red-700 border-red-200', icon: Shield },
  DISPATCHER: { label: 'Dispatcher', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: Headphones },
  TECHNICIAN: { label: 'Technician', className: 'bg-gray-100 text-gray-700 border-gray-200', icon: Truck },
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

  const active = users.filter((u) => u.active)
  const inactive = users.filter((u) => !u.active)

  return (
    <div className="space-y-6">
      <InviteModalWrapper>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">{active.length} active · {inactive.length} inactive</p>
          </div>
          <div className="flex gap-2">
            <InviteModalTriggerButton>
              <Mail className="size-4" />
              Invite Technician
            </InviteModalTriggerButton>
            <Link
              href="/settings/users/new"
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              <Plus className="size-4" />
              Add User
            </Link>
          </div>
        </div>
      </InviteModalWrapper>

      <UserTable users={active} currentUserId={currentUserId} />

      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Inactive</p>
          <UserTable users={inactive} currentUserId={currentUserId} dimmed />
        </div>
      )}
    </div>
  )
}

function UserTable({
  users,
  currentUserId,
  dimmed = false,
}: {
  users: Array<{
    id: string
    name: string
    email: string
    role: string
    phone: string | null
    active: boolean
    createdAt: Date
    technician: { id: string; name: string; tradeType: string | null } | null
  }>
  currentUserId: string
  dimmed?: boolean
}) {
  if (users.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Name</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Login</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Role</th>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Linked Tech</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((user) => {
            const role = ROLE_STYLES[user.role] ?? ROLE_STYLES.TECHNICIAN
            const RoleIcon = role.icon
            return (
              <tr key={user.id} className={dimmed ? 'opacity-50' : ''}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <div className="flex items-center gap-2">
                    {!user.active && <UserX className="size-3.5 text-gray-400" />}
                    {user.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {(() => {
                    const { display, isInternal } = formatLogin(user.email)
                    return isInternal ? (
                      <span className="inline-flex items-center gap-1 text-gray-600">
                        <User className="size-3 text-gray-400" />
                        {display}
                      </span>
                    ) : display
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${role.className}`}>
                    <RoleIcon className="size-3" />
                    {role.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {user.technician ? (
                    <Link href={`/technicians/${user.technician.id}`} className="hover:underline text-blue-600">
                      {user.technician.name}
                    </Link>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/settings/users/${user.id}`}
                      className="text-xs text-gray-500 hover:text-gray-900 font-medium"
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
  )
}
