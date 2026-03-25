import { cn } from '@/lib/utils'
import { JobStatus } from '@/generated/prisma'

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  NEW: {
    label: 'New',
    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  SCHEDULED: {
    label: 'Scheduled',
    className: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  },
  ON_HOLD: {
    label: 'On Hold',
    className: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: JobStatus
  className?: string
}) {
  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
