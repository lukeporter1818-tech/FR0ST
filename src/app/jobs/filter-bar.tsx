'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Search, X } from 'lucide-react'

type FilterBarProps = {
  technicians: { id: string; name: string }[]
  currentStatus?: string
  currentPriority?: string
  currentTrade?: string
  currentTechId?: string
  currentSearch?: string
}

const statusOptions = ['NEW', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED']
const priorityOptions = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']
const tradeOptions = ['HVAC', 'REFRIGERATION', 'PLUMBING', 'ELECTRICAL', 'MULTI', 'UNKNOWN']

function formatEnum(val: string) {
  return val
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function JobsFilterBar({
  technicians,
  currentStatus,
  currentPriority,
  currentTrade,
  currentTechId,
  currentSearch,
}: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`/jobs?${params.toString()}`)
    },
    [router, searchParams]
  )

  const clearAll = useCallback(() => {
    router.push('/jobs')
  }, [router])

  const hasFilters =
    currentStatus || currentPriority || currentTrade || currentTechId || currentSearch

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search customer or address..."
          defaultValue={currentSearch ?? ''}
          onChange={(e) => {
            const value = e.target.value
            const timeout = setTimeout(() => updateFilter('search', value), 300)
            return () => clearTimeout(timeout)
          }}
          className="h-9 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 w-56"
        />
      </div>

      {/* Status filter */}
      <select
        value={currentStatus ?? ''}
        onChange={(e) => updateFilter('status', e.target.value)}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
      >
        <option value="">All Statuses</option>
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {formatEnum(s)}
          </option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={currentPriority ?? ''}
        onChange={(e) => updateFilter('priority', e.target.value)}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
      >
        <option value="">All Priorities</option>
        {priorityOptions.map((p) => (
          <option key={p} value={p}>
            {formatEnum(p)}
          </option>
        ))}
      </select>

      {/* Trade filter */}
      <select
        value={currentTrade ?? ''}
        onChange={(e) => updateFilter('trade', e.target.value)}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
      >
        <option value="">All Trades</option>
        {tradeOptions.map((t) => (
          <option key={t} value={t}>
            {formatEnum(t)}
          </option>
        ))}
      </select>

      {/* Tech filter */}
      <select
        value={currentTechId ?? ''}
        onChange={(e) => updateFilter('techId', e.target.value)}
        className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
      >
        <option value="">All Technicians</option>
        {technicians.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <X className="size-3.5" />
          Clear filters
        </button>
      )}
    </div>
  )
}
