import Link from 'next/link'
import { Phone, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Technician } from '@/generated/prisma'

type TechCardProps = {
  technician: Technician & {
    jobs: { id: string }[]  // only id fetched — component uses jobs.length only
  }
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ACTIVE: {
    label: 'Active',
    className: 'bg-emerald-100 text-emerald-700',
  },
  OFF: {
    label: 'Off',
    className: 'bg-gray-100 text-gray-600',
  },
  VACATION: {
    label: 'Vacation',
    className: 'bg-blue-100 text-blue-700',
  },
  SICK: {
    label: 'Sick',
    className: 'bg-red-100 text-red-700',
  },
}

const tradeLabels: Record<string, string> = {
  HVAC: 'HVAC',
  REFRIGERATION: 'Refrigeration',
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  MULTI: 'Multi-Trade',
  UNKNOWN: 'Unknown',
}

// Avatar background colors cycled by first character
const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

function getAvatarColor(name: string) {
  const code = name.charCodeAt(0) ?? 0
  return avatarColors[code % avatarColors.length]
}

export function TechCard({ technician }: TechCardProps) {
  const status = statusConfig[technician.status] ?? statusConfig.OFF
  const activeJobCount = technician.jobs.length
  const initials = getInitials(technician.name)
  const avatarColor = getAvatarColor(technician.name)

  return (
    <Link href={`/technicians/${technician.id}`} className="block">
      <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
        {/* Top row: avatar + name + status */}
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              avatarColor
            )}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-gray-900 truncate">
                {technician.name}
              </span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0',
                  status.className
                )}
              >
                {status.label}
              </span>
            </div>
            {technician.tradeType && (
              <p className="text-sm text-gray-500 mt-0.5">
                {tradeLabels[technician.tradeType] ?? technician.tradeType}
              </p>
            )}
          </div>
        </div>

        {/* Skill tags */}
        {technician.skillTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {technician.skillTags.map((tag) => (
              <span
                key={tag}
                className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom row: phone + job count */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Phone className="size-3.5 shrink-0" />
            <span className="truncate">{technician.phone}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Briefcase className="size-3.5 text-gray-400 shrink-0" />
            <span
              className={cn(
                'font-medium',
                activeJobCount > 0 ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              {activeJobCount} {activeJobCount === 1 ? 'job' : 'jobs'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
