'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { updateJob } from '@/lib/actions/jobs'

const jobTypeOptions = [
  'SERVICE', 'INSTALL', 'MAINTENANCE', 'CALLBACK', 'EMERGENCY', 'INSPECTION', 'ESTIMATE',
]
const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']
const tradeOptions = ['HVAC', 'REFRIGERATION', 'PLUMBING', 'ELECTRICAL', 'MULTI', 'UNKNOWN']
const timeWindowOptions = [
  'First Call', '8am-10am', '10am-12pm', 'Afternoon', '1pm-3pm', '3pm-5pm', 'End of Day',
]

function formatEnum(val: string) {
  return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

interface JobData {
  id: string
  customerName: string
  customerPhone: string
  address: string
  city: string
  state: string
  zip: string
  issueDescription: string
  jobType: string
  priority: string
  tradeClassification: string
  scheduledDate: string
  timeWindow: string
  assignedTechId: string
  dispatcherNotes: string
  internalNotes: string
  tags: string
}

interface Props {
  job: JobData
  technicians: { id: string; name: string }[]
}

const inputClass =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-400'
const selectClass =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 h-9'
const labelClass = 'block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5'

export function EditJobForm({ job, technicians }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateJob(job.id, formData)
        router.push(`/jobs/${job.id}`)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save changes')
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Edit Job</h1>
          <p className="text-sm text-gray-500">{job.customerName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Customer Information</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="customerName" className={labelClass}>
                  Customer Name <span className="text-red-500 normal-case">*</span>
                </label>
                <input
                  id="customerName"
                  name="customerName"
                  type="text"
                  required
                  defaultValue={job.customerName}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className={labelClass}>Phone</label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
                  defaultValue={job.customerPhone}
                  className={inputClass}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div>
              <label htmlFor="address" className={labelClass}>
                Address <span className="text-red-500 normal-case">*</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                defaultValue={job.address}
                className={inputClass}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="city" className={labelClass}>City</label>
                <input id="city" name="city" type="text" defaultValue={job.city} className={inputClass} />
              </div>
              <div>
                <label htmlFor="state" className={labelClass}>State</label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  maxLength={2}
                  defaultValue={job.state}
                  className={inputClass + ' uppercase'}
                />
              </div>
              <div>
                <label htmlFor="zip" className={labelClass}>ZIP</label>
                <input id="zip" name="zip" type="text" maxLength={10} defaultValue={job.zip} className={inputClass} />
              </div>
            </div>
          </div>
        </div>

        {/* Job details section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Job Details</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="issueDescription" className={labelClass}>
                Issue Description <span className="text-red-500 normal-case">*</span>
              </label>
              <textarea
                id="issueDescription"
                name="issueDescription"
                required
                rows={4}
                defaultValue={job.issueDescription}
                className={inputClass}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="jobType" className={labelClass}>Job Type</label>
                <select id="jobType" name="jobType" defaultValue={job.jobType} className={selectClass}>
                  {jobTypeOptions.map((jt) => (
                    <option key={jt} value={jt}>{formatEnum(jt)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className={labelClass}>Priority</label>
                <select id="priority" name="priority" defaultValue={job.priority} className={selectClass}>
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>{formatEnum(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tradeClassification" className={labelClass}>Trade</label>
                <select
                  id="tradeClassification"
                  name="tradeClassification"
                  defaultValue={job.tradeClassification}
                  className={selectClass}
                >
                  <option value="">Auto-detect</option>
                  {tradeOptions.map((t) => (
                    <option key={t} value={t}>{formatEnum(t)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="tags" className={labelClass}>Tags</label>
              <input
                id="tags"
                name="tags"
                type="text"
                defaultValue={job.tags}
                className={inputClass}
                placeholder="warranty, callback, commercial (comma-separated)"
              />
            </div>
          </div>
        </div>

        {/* Schedule section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Schedule</h2>
          </div>
          <div className="px-6 py-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="scheduledDate" className={labelClass}>Scheduled Date</label>
                <input
                  id="scheduledDate"
                  name="scheduledDate"
                  type="date"
                  defaultValue={job.scheduledDate}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="timeWindow" className={labelClass}>Time Window</label>
                <select id="timeWindow" name="timeWindow" defaultValue={job.timeWindow} className={selectClass}>
                  <option value="">Select window</option>
                  {timeWindowOptions.map((tw) => (
                    <option key={tw} value={tw}>{tw}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assignedTechId" className={labelClass}>Assign Technician</label>
                <select
                  id="assignedTechId"
                  name="assignedTechId"
                  defaultValue={job.assignedTechId}
                  className={selectClass}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Notes section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div>
              <label htmlFor="dispatcherNotes" className={labelClass}>Dispatcher Notes</label>
              <textarea
                id="dispatcherNotes"
                name="dispatcherNotes"
                rows={3}
                defaultValue={job.dispatcherNotes}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="internalNotes" className={labelClass}>Internal Notes</label>
              <textarea
                id="internalNotes"
                name="internalNotes"
                rows={3}
                defaultValue={job.internalNotes}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pb-6">
          <Link
            href={`/jobs/${job.id}`}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
