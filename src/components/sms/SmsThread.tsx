'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SmsMessageItem = {
  id: string
  direction: 'OUTBOUND' | 'INBOUND'
  body: string
  aiDrafted: boolean
  status: string | null
  sentAt: string | null
  createdAt: string
}

type SmsThreadProps = {
  technicianId: string
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function SmsThread({ technicianId }: SmsThreadProps) {
  const [messages, setMessages] = useState<SmsMessageItem[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/sms/history?technicianId=${encodeURIComponent(technicianId)}`
      )
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setMessages(data)
    } catch {
      // silently fail on refresh
    } finally {
      setLoading(false)
    }
  }, [technicianId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Group messages by date
  const grouped: { date: string; messages: SmsMessageItem[] }[] = []
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString()
    const last = grouped[grouped.length - 1]
    if (last && last.date === dateKey) {
      last.messages.push(msg)
    } else {
      grouped.push({ date: dateKey, messages: [msg] })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Refresh bar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <p className="text-xs text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </p>
        <Button variant="ghost" size="icon-xs" onClick={fetchMessages}>
          <RefreshCw className="size-3" />
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-3 py-3"
        style={{ maxHeight: '320px' }}
      >
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.date} className="space-y-2">
              {/* Date separator */}
              <div className="flex items-center gap-2 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {formatDate(group.messages[0].createdAt)}
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Messages for this date */}
              {group.messages.map((msg) => {
                const isOutbound = msg.direction === 'OUTBOUND'
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex flex-col',
                      isOutbound ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                        isOutbound
                          ? 'rounded-br-md bg-blue-600 text-white'
                          : 'rounded-bl-md bg-muted text-foreground'
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {msg.body}
                      </p>
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground',
                        isOutbound ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      <span>{formatTime(msg.createdAt)}</span>
                      {msg.aiDrafted && (
                        <Sparkles className="size-2.5 text-violet-500" />
                      )}
                      {msg.status === 'simulated' && (
                        <span className="rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          SIM
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
