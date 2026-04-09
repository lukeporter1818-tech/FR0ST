import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { TechCard } from '@/components/technicians/TechCard'
import { TechListFilter } from '@/components/technicians/TechListFilter'

export default async function TechniciansPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const [{ filter }, session] = await Promise.all([searchParams, auth()])
  if (!session?.user?.id) redirect('/login')

  const technicians = await prisma.technician.findMany({
    where: filter === 'inactive' ? { active: false } : { active: true },
    include: {
      jobs: {
        where: {
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        // Only the ID is needed — TechCard uses jobs.length for the active count
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  const activeCount = await prisma.technician.count({ where: { active: true } })
  const inactiveCount = await prisma.technician.count({ where: { active: false } })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Technicians</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your field team
          </p>
        </div>
        <Link href="/technicians/new">
          <button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors">
            <Plus className="size-4" />
            Add Technician
          </button>
        </Link>
      </div>

      {/* Filter tabs */}
      <TechListFilter
        currentFilter={filter ?? 'active'}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
      />

      {/* Grid */}
      {technicians.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center bg-white">
          <Users className="size-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600">
            {filter === 'inactive' ? 'No inactive technicians' : 'No technicians yet'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {filter !== 'inactive' ? 'Add your first technician to get started' : ''}
          </p>
          {filter !== 'inactive' && (
            <Link href="/technicians/new" className="mt-4">
              <button className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 transition-colors">
                <Plus className="size-3.5" />
                Add your first technician
              </button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {technicians.map((tech) => (
            <TechCard key={tech.id} technician={tech} />
          ))}
        </div>
      )}
    </div>
  )
}
