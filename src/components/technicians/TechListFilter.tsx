'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

type TechListFilterProps = {
  currentFilter: string
  activeCount: number
  inactiveCount: number
}

export function TechListFilter({
  currentFilter,
  activeCount,
  inactiveCount,
}: TechListFilterProps) {
  const tabs = [
    { key: 'active', label: 'Active', count: activeCount, href: '/technicians' },
    {
      key: 'inactive',
      label: 'Inactive',
      count: inactiveCount,
      href: '/technicians?filter=inactive',
    },
  ]

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            currentFilter === tab.key
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
          <span
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs',
              currentFilter === tab.key
                ? 'bg-primary/10 text-primary'
                : 'bg-muted-foreground/10 text-muted-foreground'
            )}
          >
            {tab.count}
          </span>
        </Link>
      ))}
    </div>
  )
}
