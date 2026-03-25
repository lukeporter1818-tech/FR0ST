'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createJob } from '@/lib/actions/jobs'

function formatEnum(val: string) {
  return val
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const jobTypeOptions = [
  'SERVICE',
  'INSTALL',
  'MAINTENANCE',
  'CALLBACK',
  'EMERGENCY',
  'INSPECTION',
  'ESTIMATE',
]
const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']
const tradeOptions = [
  'HVAC',
  'REFRIGERATION',
  'PLUMBING',
  'ELECTRICAL',
  'MULTI',
  'UNKNOWN',
]
const timeWindowOptions = [
  'First Call',
  '8am-10am',
  '10am-12pm',
  'Afternoon',
  '1pm-3pm',
  '3pm-5pm',
  'End of Day',
]

type TechOption = { id: string; name: string }

const inputClass =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 placeholder:text-gray-400'
const selectClass =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 h-9'
const labelClass = 'block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5'

export default function NewJobPage() {
  const [technicians, setTechnicians] = useState<TechOption[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/technicians')
      .then((res) => res.json())
      .then((data) => setTechnicians(data))
      .catch(() => {})
  }, [])

  async function handleSubmit(formData: FormData) {
    setSubmitting(true)
    try {
      await createJob(formData)
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/jobs"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">New Job</h1>
          <p className="text-sm text-gray-500">Create a new service job</p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-4">
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
                  className={inputClass}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label htmlFor="customerPhone" className={labelClass}>
                  Phone
                </label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  type="tel"
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
                className={inputClass}
                placeholder="123 Main St"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="city" className={labelClass}>
                  City
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  className={inputClass}
                  placeholder="Springfield"
                />
              </div>
              <div>
                <label htmlFor="state" className={labelClass}>
                  State
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  maxLength={2}
                  className={inputClass + ' uppercase'}
                  placeholder="IL"
                />
              </div>
              <div>
                <label htmlFor="zip" className={labelClass}>
                  ZIP
                </label>
                <input
                  id="zip"
                  name="zip"
                  type="text"
                  maxLength={10}
                  className={inputClass}
                  placeholder="62701"
                />
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
                className={inputClass}
                placeholder="Describe the issue the customer is experiencing..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="jobType" className={labelClass}>
                  Job Type
                </label>
                <select id="jobType" name="jobType" defaultValue="SERVICE" className={selectClass}>
                  {jobTypeOptions.map((jt) => (
                    <option key={jt} value={jt}>
                      {formatEnum(jt)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="priority" className={labelClass}>
                  Priority
                </label>
                <select id="priority" name="priority" defaultValue="NORMAL" className={selectClass}>
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>
                      {formatEnum(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tradeClassification" className={labelClass}>
                  Trade
                </label>
                <select
                  id="tradeClassification"
                  name="tradeClassification"
                  defaultValue=""
                  className={selectClass}
                >
                  <option value="">Auto-detect</option>
                  {tradeOptions.map((t) => (
                    <option key={t} value={t}>
                      {formatEnum(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tags" className={labelClass}>
                Tags
              </label>
              <input
                id="tags"
                name="tags"
                type="text"
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
                <label htmlFor="scheduledDate" className={labelClass}>
                  Scheduled Date
                </label>
                <input
                  id="scheduledDate"
                  name="scheduledDate"
                  type="date"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="timeWindow" className={labelClass}>
                  Time Window
                </label>
                <select
                  id="timeWindow"
                  name="timeWindow"
                  defaultValue=""
                  className={selectClass}
                >
                  <option value="">Select window</option>
                  {timeWindowOptions.map((tw) => (
                    <option key={tw} value={tw}>
                      {tw}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="assignedTechId" className={labelClass}>
                  Assign Technician
                </label>
                <select
                  id="assignedTechId"
                  name="assignedTechId"
                  defaultValue=""
                  className={selectClass}
                >
                  <option value="">Unassigned</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name}
                    </option>
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
              <label htmlFor="dispatcherNotes" className={labelClass}>
                Dispatcher Notes
              </label>
              <textarea
                id="dispatcherNotes"
                name="dispatcherNotes"
                rows={3}
                className={inputClass}
                placeholder="Notes visible to dispatchers..."
              />
            </div>
            <div>
              <label htmlFor="internalNotes" className={labelClass}>
                Internal Notes
              </label>
              <textarea
                id="internalNotes"
                name="internalNotes"
                rows={3}
                className={inputClass}
                placeholder="Internal notes (not shared with customer)..."
              />
            </div>
          </div>
        </div>

        {/* Form actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </form>
    </div>
  )
}
