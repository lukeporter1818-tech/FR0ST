import { cn } from '@/lib/utils'
import { Trade } from '@/generated/prisma'

const tradeConfig: Record<Trade, { label: string; className: string }> = {
  HVAC: {
    label: 'HVAC',
    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  },
  REFRIGERATION: {
    label: 'Refrigeration',
    className: 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200',
  },
  PLUMBING: {
    label: 'Plumbing',
    className: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  },
  ELECTRICAL: {
    label: 'Electrical',
    className: 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200',
  },
  MULTI: {
    label: 'Multi-Trade',
    className: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  },
  UNKNOWN: {
    label: 'Unknown',
    className: 'bg-gray-100 text-gray-500 ring-1 ring-gray-200',
  },
}

export function TradeBadge({
  trade,
  className,
}: {
  trade: Trade
  className?: string
}) {
  const config = tradeConfig[trade]
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
