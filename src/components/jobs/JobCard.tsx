import Link from 'next/link'
import type { Job, Technician } from '@/generated/prisma'
import { StatusBadge } from '@/components/jobs/StatusBadge'
import { PriorityBadge } from '@/components/jobs/PriorityBadge'
import { TradeBadge } from '@/components/jobs/TradeBadge'
import { cn } from '@/lib/utils'

type JobCardProps = {
  job: Job & { assignedTech: Technician | null }
  className?: string
}

export function JobCard({ job, className }: JobCardProps) {
  const shortAddress = job.city
    ? `${job.address}, ${job.city}`
    : job.address

  return (
    <Link href={`/jobs/${job.id}`} className="block">
      <div
        className={cn(
          'bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all',
          className
        )}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">
              {job.customerName}
            </p>
            <p className="truncate text-xs text-gray-500 mt-0.5">
              {shortAddress}
            </p>
          </div>
          <PriorityBadge priority={job.priority} />
        </div>

        <p className="line-clamp-1 text-xs text-gray-500 mb-3">
          {job.issueDescription}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={job.status} />
          {job.tradeClassification && (
            <TradeBadge trade={job.tradeClassification} />
          )}
          {job.assignedTech && (
            <span className="text-xs text-gray-400 ml-auto">
              {job.assignedTech.name}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
