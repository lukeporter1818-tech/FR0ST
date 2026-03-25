'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'
import { updateJobStatus } from '@/lib/actions/jobs'
import { applyTriageToJob } from '@/lib/actions/ai'

const STATUS_OPTIONS = [
  { value: 'NEW', label: 'New', color: 'text-gray-600 bg-gray-100' },
  { value: 'SCHEDULED', label: 'Scheduled', color: 'text-blue-700 bg-blue-50' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'text-amber-700 bg-amber-50' },
  { value: 'COMPLETED', label: 'Completed', color: 'text-green-700 bg-green-50' },
  { value: 'ON_HOLD', label: 'On Hold', color: 'text-orange-700 bg-orange-50' },
  { value: 'CANCELLED', label: 'Cancelled', color: 'text-red-700 bg-red-50' },
]

interface Props {
  jobId: string
  currentStatus: string
  issueDescription: string
  customerName: string
  address: string
  hasAiAnalysis: boolean
}

export function JobDetailActions({
  jobId,
  currentStatus,
  issueDescription,
  customerName,
  address,
  hasAiAnalysis,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStatus = e.target.value
    startTransition(async () => {
      await updateJobStatus(jobId, newStatus as any)
      router.refresh()
    })
  }

  async function handleRunAI() {
    setAiError(null)
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueDescription, customerName, address }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'AI analysis failed')
      }
      const triage = await res.json()
      await applyTriageToJob(jobId, triage)
      router.refresh()
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI analysis failed')
    } finally {
      setAiLoading(false)
    }
  }

  const currentOption = STATUS_OPTIONS.find((s) => s.value === currentStatus)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status selector */}
      <div className="relative">
        <select
          value={currentStatus}
          onChange={handleStatusChange}
          disabled={isPending}
          className={`rounded-full border-0 py-1 pl-3 pr-7 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-900 appearance-none cursor-pointer disabled:opacity-50 ${currentOption?.color ?? 'text-gray-600 bg-gray-100'}`}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg className="size-3 text-current opacity-60" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 8L1 3h10L6 8z" />
          </svg>
        </span>
      </div>

      {/* AI analysis button */}
      <button
        onClick={handleRunAI}
        disabled={aiLoading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
      >
        {aiLoading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        {aiLoading ? 'Analyzing…' : hasAiAnalysis ? 'Re-analyze' : 'Run AI Analysis'}
      </button>

      {aiError && (
        <p className="w-full text-xs text-red-600">{aiError}</p>
      )}
    </div>
  )
}
