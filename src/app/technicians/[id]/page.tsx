import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  MessageSquare,
  Phone,
  Wrench,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import { cn } from '@/lib/utils'
import { TechDetailActions } from '@/components/technicians/TechDetailActions'

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

function getDateRange(daysFromNow: number) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(0, 0, 0, 0)
  const start = new Date(d)
  d.setDate(d.getDate() + 1)
  const end = new Date(d)
  return { start, end }
}

function getInitials(name: string) {
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

export default async function TechnicianDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const technician = await prisma.technician.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { scheduledDate: 'asc' },
      },
      scheduleEntries: {
        include: { job: true },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!technician) notFound()

  const status = statusConfig[technician.status] ?? statusConfig.OFF

  const today = getDateRange(0)
  const tomorrow = getDateRange(1)

  const todayEntries = technician.scheduleEntries.filter(
    (e) => e.date >= today.start && e.date < today.end
  )
  const tomorrowEntries = technician.scheduleEntries.filter(
    (e) => e.date >= tomorrow.start && e.date < tomorrow.end
  )

  const activeJobs = technician.jobs.filter(
    (j) => j.status !== 'COMPLETED' && j.status !== 'CANCELLED'
  )

  const initials = getInitials(technician.name)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/technicians"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{technician.name}</h1>
            <p className="text-sm text-gray-500">Technician Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            className="bg-white border border-gray-200 text-gray-400 rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 cursor-not-allowed"
          >
            <MessageSquare className="size-3.5" />
            Text This Tech
          </button>
          <TechDetailActions technician={technician} />
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Left column: schedule */}
        <div className="space-y-5">
          {/* Today's Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Today&apos;s Schedule</h2>
                <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {todayEntries.length} {todayEntries.length === 1 ? 'stop' : 'stops'}
                </span>
              </div>
            </div>
            <div className="p-5">
              {todayEntries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No stops scheduled for today</p>
              ) : (
                <div className="space-y-2">
                  {todayEntries.map((entry, index) => (
                    <ScheduleJobCard key={entry.id} entry={entry} stopNumber={index + 1} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tomorrow's Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CalendarDays className="size-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">Tomorrow&apos;s Schedule</h2>
                <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {tomorrowEntries.length} {tomorrowEntries.length === 1 ? 'stop' : 'stops'}
                </span>
              </div>
            </div>
            <div className="p-5">
              {tomorrowEntries.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No stops scheduled for tomorrow</p>
              ) : (
                <div className="space-y-2">
                  {tomorrowEntries.map((entry, index) => (
                    <ScheduleJobCard key={entry.id} entry={entry} stopNumber={index + 1} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* All Assigned Jobs */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Briefcase className="size-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900">All Assigned Jobs</h2>
                <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                  {activeJobs.length} active
                </span>
              </div>
            </div>
            <div className="p-5">
              {activeJobs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No active jobs</p>
              ) : (
                <div className="space-y-2">
                  {activeJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">
                          {job.customerName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {job.address}
                          {job.city ? `, ${job.city}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 ml-3">
                        <JobStatusBadge status={job.status} />
                        <PriorityIndicator priority={job.priority} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: profile info */}
        <div className="space-y-5">
          {/* Profile card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center pb-5 border-b border-gray-100 mb-5">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold mb-3">
                {initials}
              </div>
              <h2 className="text-base font-semibold text-gray-900">{technician.name}</h2>
              {technician.tradeType && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {tradeLabels[technician.tradeType] ?? technician.tradeType}
                </p>
              )}
              <span
                className={cn(
                  'mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                  status.className
                )}
              >
                {status.label}
              </span>
            </div>

            {/* Details */}
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Phone</dt>
                <dd className="flex items-center gap-1.5 text-sm text-gray-900">
                  <Phone className="size-3.5 text-gray-400" />
                  {technician.phone}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Trade</dt>
                <dd className="flex items-center gap-1.5 text-sm text-gray-900">
                  <Wrench className="size-3.5 text-gray-400" />
                  {technician.tradeType
                    ? tradeLabels[technician.tradeType] ?? technician.tradeType
                    : 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Skills</dt>
                <dd className="flex flex-wrap gap-1 mt-1">
                  {technician.skillTags.length > 0 ? (
                    technician.skillTags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">No skills listed</span>
                  )}
                </dd>
              </div>
              {technician.notes && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</dt>
                  <dd className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {technician.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Helper components ---------- */

function ScheduleJobCard({
  entry,
  stopNumber,
}: {
  entry: {
    id: string
    arrivalWindow: string | null
    status: string
    notes: string | null
    job: {
      id: string
      customerName: string
      address: string
      city: string | null
      status: string
      priority: string
      issueDescription: string
    }
  }
  stopNumber: number
}) {
  const scheduleStatusLabels: Record<string, string> = {
    SCHEDULED: 'Scheduled',
    EN_ROUTE: 'En Route',
    ON_SITE: 'On Site',
    COMPLETED: 'Completed',
    SKIPPED: 'Skipped',
  }

  return (
    <Link
      href={`/jobs/${entry.job.id}`}
      className="flex items-start gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
    >
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-xs text-gray-500 flex items-center justify-center font-medium mt-0.5">
        {stopNumber}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium text-gray-900">{entry.job.customerName}</p>
        <p className="text-xs text-gray-500">
          {entry.job.address}
          {entry.job.city ? `, ${entry.job.city}` : ''}
        </p>
        {entry.arrivalWindow && (
          <p className="text-xs text-gray-400">Window: {entry.arrivalWindow}</p>
        )}
      </div>
      <span className="shrink-0 inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
        {scheduleStatusLabels[entry.status] ?? entry.status}
      </span>
    </Link>
  )
}

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    NEW: 'bg-blue-100 text-blue-700',
    SCHEDULED: 'bg-violet-100 text-violet-700',
    IN_PROGRESS: 'bg-amber-100 text-amber-700',
    ON_HOLD: 'bg-orange-100 text-orange-700',
  }

  const labels: Record<string, string> = {
    NEW: 'New',
    SCHEDULED: 'Scheduled',
    IN_PROGRESS: 'In Progress',
    ON_HOLD: 'On Hold',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.7rem] font-medium',
        config[status] ?? 'bg-gray-100 text-gray-600'
      )}
    >
      {labels[status] ?? status}
    </span>
  )
}

function PriorityIndicator({ priority }: { priority: string }) {
  const config: Record<string, string> = {
    LOW: 'text-gray-400',
    NORMAL: 'text-blue-500',
    HIGH: 'text-amber-500',
    EMERGENCY: 'text-red-500',
  }

  if (priority === 'LOW' || priority === 'NORMAL') return null

  return (
    <span
      className={cn('text-xs font-bold', config[priority])}
      title={`${priority} priority`}
    >
      {priority === 'EMERGENCY' ? '!!!' : '!'}
    </span>
  )
}
