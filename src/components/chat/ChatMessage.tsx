'use client'

import { cn } from '@/lib/utils'

export type ChatMessageData = {
  id: string
  userId: string
  userName: string
  body: string
  createdAt: string
}

type ChatMessageProps = {
  message: ChatMessageData
  isOwn: boolean
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)

  if (diffSec < 10) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function ChatMessage({ message, isOwn }: ChatMessageProps) {
  return (
    <div
      className={cn('flex flex-col', isOwn ? 'items-end' : 'items-start')}
    >
      {/* Sender name (only for other users) */}
      {!isOwn && (
        <p className="mb-0.5 px-1 text-[11px] font-medium text-muted-foreground">
          {message.userName}
        </p>
      )}

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 text-sm',
          isOwn
            ? 'rounded-br-md bg-blue-600 text-white'
            : 'rounded-bl-md bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      </div>

      {/* Timestamp */}
      <p className="mt-0.5 px-1 text-[10px] text-muted-foreground">
        {relativeTime(message.createdAt)}
      </p>
    </div>
  )
}
