'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

type DateSelectorProps = {
  currentDate: string // YYYY-MM-DD
}

function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function isToday(dateStr: string): boolean {
  return dateStr === getToday()
}

function isTomorrow(dateStr: string): boolean {
  return dateStr === getTomorrow()
}

export function DateSelector({ currentDate }: DateSelectorProps) {
  const router = useRouter()

  function navigateToDate(date: string) {
    router.push(`/dispatch?date=${date}`)
  }

  const label = isToday(currentDate)
    ? 'Today'
    : isTomorrow(currentDate)
      ? 'Tomorrow'
      : null

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => navigateToDate(addDays(currentDate, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <div className="flex items-center gap-2 px-2">
        <Calendar className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">
          {label && (
            <span className="mr-1.5 text-primary">{label} &mdash;</span>
          )}
          {formatDisplayDate(currentDate)}
        </span>
      </div>

      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => navigateToDate(addDays(currentDate, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>

      <div className="ml-2 flex gap-1">
        <Button
          variant={isToday(currentDate) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigateToDate(getToday())}
        >
          Today
        </Button>
        <Button
          variant={isTomorrow(currentDate) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => navigateToDate(getTomorrow())}
        >
          Tomorrow
        </Button>
      </div>
    </div>
  )
}
