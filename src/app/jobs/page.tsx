import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Inbox } from 'lucide-react'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { Prisma } from '@/generated/prisma'
import { JobStatus, Priority, Trade } from '@/generated/prisma'
import { StatusBadge } from '@/components/jobs/StatusBadge'
import { PriorityBadge } from '@/components/jobs/PriorityBadge'
import { TradeBadge } from '@/components/jobs/TradeBadge'
import { JobsFilterBar } from './filter-bar'

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [params, session] = await Promise.all([searchParams, auth()])
  if (!session?.user?.id) redirect('/login')

  const statusFilter = typeof params.status === 'string' ? params.status : undefined
  const priorityFilter = typeof params.priority === 'string' ? params.priority : undefined
  const tradeFilter = typeof params.trade === 'string' ? params.trade : undefined
  const techIdFilter = typeof params.techId === 'string' ? params.techId : undefined
  const searchQuery = typeof params.search === 'string' ? params.search : undefined

  const where: Prisma.JobWhereInput = {}

  if (statusFilter && Object.values(JobStatus).includes(statusFilter as JobStatus)) {
    where.status = statusFilter as JobStatus
  }
  if (priorityFilter && Object.values(Priority).includes(priorityFilter as Priority)) {
    where.priority = priorityFilter as Priority
  }
  if (tradeFilter && Object.values(Trade).includes(tradeFilter as Trade)) {
    where.tradeClassification = tradeFilter as Trade
  }
  if (techIdFilter) {
    where.assignedTechId = techIdFilter
  }
  if (searchQuery) {
    where.OR = [
      { customerName: { contains: searchQuery, mode: 'insensitive' } },
      { address: { contains: searchQuery, mode: 'insensitive' } },
    ]
  }

  const [jobs, technicians] = await Promise.all([
    prisma.job.findMany({
      where,
      include: { assignedTech: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.technician.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'} found
          </p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="size-4" />
          New Job
        </Link>
      </div>

      {/* Filter bar */}
      <JobsFilterBar
        technicians={technicians.map((t) => ({ id: t.id, name: t.name }))}
        currentStatus={statusFilter}
        currentPriority={priorityFilter}
        currentTrade={tradeFilter}
        currentTechId={techIdFilter}
        currentSearch={searchQuery}
      />

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Inbox className="size-5 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No jobs found</p>
            <p className="text-sm text-gray-500">
              Try adjusting your filters or{' '}
              <Link href="/jobs/new" className="text-blue-600 hover:underline">
                create a new job
              </Link>
              .
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Customer
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide md:table-cell">
                  Issue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide lg:table-cell">
                  Trade
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide lg:table-cell">
                  Assigned
                </th>
                <th className="hidden px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide md:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <Link href={`/jobs/${job.id}`} className="block">
                      <p className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {job.customerName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                        {job.address}
                        {job.city ? `, ${job.city}` : ''}
                      </p>
                    </Link>
                  </td>
                  <td className="hidden px-6 py-4 md:table-cell">
                    <Link href={`/jobs/${job.id}`} className="block">
                      <p className="text-gray-600 truncate max-w-sm">
                        {job.issueDescription}
                      </p>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <PriorityBadge priority={job.priority} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="hidden px-6 py-4 lg:table-cell">
                    {job.tradeClassification ? (
                      <TradeBadge trade={job.tradeClassification} />
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="hidden px-6 py-4 lg:table-cell">
                    {job.assignedTech ? (
                      <span className="text-sm text-gray-700">
                        {job.assignedTech.name}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="hidden px-6 py-4 md:table-cell">
                    {job.scheduledDate ? (
                      <span className="text-sm text-gray-700">
                        {new Date(job.scheduledDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
