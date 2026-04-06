import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  User,
  AlertTriangle,
  HelpCircle,
  Tag,
  Edit,
} from 'lucide-react'
import { prisma } from '@/lib/db'
import type { Note, User as UserModel } from '@/generated/prisma'
import { PriorityBadge } from '@/components/jobs/PriorityBadge'
import { TradeBadge } from '@/components/jobs/TradeBadge'
import { JobDetailActions } from '@/components/jobs/JobDetailActions'
import { DispatchRecommend } from '@/components/jobs/DispatchRecommend'
import { AddNoteForm } from '@/components/jobs/AddNoteForm'

function formatEnum(val: string) {
  return val
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      assignedTech: true,
      scheduleEntry: true,
      notes: {
        include: { createdBy: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!job) notFound()

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{job.customerName}</h1>
            <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
              <MapPin className="size-3 shrink-0" />
              {[job.address, job.city, job.state].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <JobDetailActions
            jobId={job.id}
            currentStatus={job.status}
            issueDescription={job.issueDescription}
            customerName={job.customerName}
            address={job.address}
            hasAiAnalysis={!!job.aiSummary}
          />
          <Link
            href={`/jobs/${job.id}/edit`}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Edit className="size-3.5" />
            Edit Job
          </Link>
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left column */}
        <div className="space-y-4">
          {/* Customer info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <User className="size-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Customer Information</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Name
                  </p>
                  <p className="text-sm font-medium text-gray-900">{job.customerName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Phone
                  </p>
                  {job.customerPhone ? (
                    <a
                      href={`tel:${job.customerPhone}`}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                    >
                      <Phone className="size-3" />
                      {job.customerPhone}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Address
                </p>
                <p className="text-sm text-gray-700">
                  {[job.address, job.city, job.state, job.zip].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          </div>

          {/* Issue description */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Issue Description</h2>
            </div>
            <div className="px-6 py-4">
              <p className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {job.issueDescription}
              </p>
            </div>
          </div>

          {/* Dispatcher notes */}
          {job.dispatcherNotes && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Dispatcher Notes</h2>
              </div>
              <div className="px-6 py-4">
                <p className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed">
                  {job.dispatcherNotes}
                </p>
              </div>
            </div>
          )}

          {/* Internal notes */}
          {job.internalNotes && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Internal Notes</h2>
              </div>
              <div className="px-6 py-4">
                <p className="whitespace-pre-wrap text-sm text-gray-600 leading-relaxed">
                  {job.internalNotes}
                </p>
              </div>
            </div>
          )}

          {/* Activity log + add note */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
            </div>
            {job.notes.length > 0 ? (
              <div className="px-6 py-2 divide-y divide-gray-100">
                {job.notes.map((note: Note & { createdBy: UserModel }) => (
                  <div key={note.id} className="py-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-gray-900">
                        {note.createdBy.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(note.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{note.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-6 text-center">
                <p className="text-sm text-gray-400">No notes yet.</p>
              </div>
            )}
            <AddNoteForm jobId={job.id} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Job details */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Job Details</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Status
                </p>
                <span className="text-sm text-gray-700">
                  {job.status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Priority
                </p>
                <PriorityBadge priority={job.priority} />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Type
                </p>
                <span className="text-sm text-gray-700">{formatEnum(job.jobType)}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Trade
                </p>
                {job.tradeClassification ? (
                  <TradeBadge trade={job.tradeClassification} />
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
              {job.tags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Tags
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {job.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                      >
                        <Tag className="size-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100 space-y-1">
                <p className="text-xs text-gray-400">
                  Created {new Date(job.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-gray-400">
                  Updated {new Date(job.updatedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="font-mono text-xs text-gray-300">{job.id}</p>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Calendar className="size-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Schedule</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Scheduled Date
                </p>
                {job.scheduledDate ? (
                  <p className="text-sm text-gray-900">
                    {new Date(job.scheduledDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Not scheduled</p>
                )}
              </div>
              {job.timeWindow && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Time Window
                  </p>
                  <p className="flex items-center gap-1.5 text-sm text-gray-700">
                    <Clock className="size-3.5 text-gray-400" />
                    {job.timeWindow}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Technician
                </p>
                {job.assignedTech ? (
                  <Link
                    href={`/technicians/${job.assignedTech.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {job.assignedTech.name}
                  </Link>
                ) : (
                  <p className="text-sm text-gray-400">Unassigned</p>
                )}
              </div>
            </div>
          </div>

          {/* Dispatch recommendation */}
          <DispatchRecommend jobId={job.id} />

          {/* AI analysis */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <Sparkles className="size-4 text-violet-500" />
              <h2 className="text-sm font-semibold text-gray-900">AI Analysis</h2>
            </div>
            <div className="px-6 py-4">
              {job.aiSummary ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Summary
                    </p>
                    <p className="text-sm text-gray-700">{job.aiSummary}</p>
                  </div>
                  {job.aiUrgency && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Urgency
                      </p>
                      <p className="text-sm text-gray-700 capitalize">{job.aiUrgency}</p>
                    </div>
                  )}
                  {job.aiTradeGuess && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Trade Guess
                      </p>
                      <TradeBadge trade={job.aiTradeGuess} />
                    </div>
                  )}
                  {job.aiFollowUpQuestions.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <HelpCircle className="size-3" />
                        Follow-up Questions
                      </p>
                      <ul className="space-y-1.5">
                        {job.aiFollowUpQuestions.map((q: string, i: number) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                            <span className="text-gray-300 mt-0.5">•</span>
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {job.aiRiskFlags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                        <AlertTriangle className="size-3 text-amber-500" />
                        Risk Flags
                      </p>
                      <ul className="space-y-1.5">
                        {job.aiRiskFlags.map((flag: string, i: number) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-sm text-amber-700"
                          >
                            <AlertTriangle className="size-3 shrink-0 mt-0.5" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-violet-50 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="size-5 text-violet-400" />
                  </div>
                  <p className="text-sm text-gray-500">
                    Use the <span className="font-medium text-violet-700">Run AI Analysis</span> button above to generate a triage summary.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
