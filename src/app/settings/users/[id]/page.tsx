import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireAdminSession } from '@/lib/actions/users'
import { UpdateUserForm } from '@/components/users/UpdateUserForm'
import { UserDangerZone } from '@/components/users/UserDangerZone'

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAdminSession()
  const { id } = await params

  const [user, unlinkedTechs] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      include: {
        technician: { select: { id: true, name: true, tradeType: true, status: true } },
      },
    }),
    prisma.technician.findMany({
      where: { active: true, OR: [{ userId: null }, { userId: id }] },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, tradeType: true },
    }),
  ])

  if (!user) notFound()

  const isSelf = user.id === session.user.id

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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{user.name}</h1>
          {!user.active && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              Inactive
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
      </div>

      {/* Linked tech profile */}
      {user.technician && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Linked Technician</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{user.technician.name}</p>
            {user.technician.tradeType && (
              <p className="text-xs text-gray-500">{user.technician.tradeType}</p>
            )}
          </div>
          <Link
            href={`/technicians/${user.technician.id}`}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            View profile
            <ExternalLink className="size-3" />
          </Link>
        </div>
      )}

      {/* Edit form */}
      <UpdateUserForm user={user} unlinkedTechs={unlinkedTechs} isSelf={isSelf} />

      {/* Danger zone */}
      <UserDangerZone userId={user.id} isActive={user.active} isSelf={isSelf} />
    </div>
  )
}
