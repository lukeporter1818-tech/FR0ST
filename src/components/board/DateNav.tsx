'use client'

import { useRouter } from 'next/navigation'

interface DateNavProps {
  date: string
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + n)
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

function getLocalTodayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatShort(dateStr: string): string {
  const today = getLocalTodayStr()
  const yesterday = addDays(today, -1)
  const tomorrow = addDays(today, 1)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  if (dateStr === tomorrow) return 'Tomorrow'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function DateNav({ date }: DateNavProps) {
  const router = useRouter()
  const today = getLocalTodayStr()
  const yesterday = addDays(today, -1)
  const tomorrow = addDays(today, 1)

  function go(d: string) { router.push(`/schedule?date=${d}`) }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => go(addDays(date, -1))}
        className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
        aria-label="Previous day"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="flex items-center rounded-lg overflow-hidden border border-white/15">
        <button
          onClick={() => go(yesterday)}
          className={`px-2 py-1.5 text-sm font-medium transition-colors ${
            date === yesterday ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          <span className="sm:hidden">Yest</span>
          <span className="hidden sm:inline">Yesterday</span>
        </button>
        <button
          onClick={() => go(today)}
          className={`px-2 py-1.5 text-sm font-medium transition-colors border-l border-white/15 ${
            date === today ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          Today
        </button>
        <button
          onClick={() => go(tomorrow)}
          className={`px-2 py-1.5 text-sm font-medium transition-colors border-l border-white/15 ${
            date === tomorrow ? 'bg-amber-500 text-gray-950' : 'text-gray-400 hover:bg-white/5'
          }`}
        >
          <span className="sm:hidden">Tom</span>
          <span className="hidden sm:inline">Tomorrow</span>
        </button>
      </div>

      <button
        onClick={() => go(addDays(date, 1))}
        className="p-1 text-gray-600 hover:text-gray-300 transition-colors"
        aria-label="Next day"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {date !== yesterday && date !== today && date !== tomorrow && (
        <span className="ml-2 text-sm text-gray-500 hidden sm:inline">{formatShort(date)}</span>
      )}
    </div>
  )
}
