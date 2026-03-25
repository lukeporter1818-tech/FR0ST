import { cn } from '@/lib/utils'
import { Priority } from '@/generated/prisma'

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  EMERGENCY: {
    label: 'Emergency',
    className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  },
  HIGH: {
    label: 'High',
    className: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  },
  NORMAL: {
    label: 'Normal',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  },
  LOW: {
    label: 'Low',
    className: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  },
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority
  className?: string
}) {
  const config = priorityConfig[priority]
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
