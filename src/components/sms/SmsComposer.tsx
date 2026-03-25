'use client'

import { useState, useTransition } from 'react'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sendSms } from '@/lib/actions/sms'
import { toast } from 'sonner'

type SmsComposerProps = {
  technicianId: string
  technicianName: string
  technicianPhone: string
  jobContext?: {
    jobId: string
    customerName: string
    issueDescription: string
  }
  onSent?: () => void
}

const templates = [
  "You're starting here tomorrow",
  'Call office when done',
  'Customer confirmed',
  'Need status update',
  'Running late?',
  'New stop added',
] as const

const inputClass =
  'flex min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none'

export function SmsComposer({
  technicianId,
  technicianName,
  technicianPhone,
  jobContext,
  onSent,
}: SmsComposerProps) {
  const [message, setMessage] = useState('')
  const [aiDrafted, setAiDrafted] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const characterCount = message.length
  const maxChars = 1600

  async function handleAiDraft() {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/draft-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientName: technicianName,
          recipientPhone: technicianPhone,
          context: jobContext
            ? `Job for ${jobContext.customerName}: ${jobContext.issueDescription}`
            : 'General dispatch communication',
          purpose: 'custom',
        }),
      })
      if (!res.ok) throw new Error('AI draft failed')
      const data = await res.json()
      setMessage(data.draftMessage ?? data.draft ?? '')
      setAiDrafted(true)
    } catch {
      toast.error('Could not generate AI draft. Try again or type manually.')
    } finally {
      setAiLoading(false)
    }
  }

  function handleSend() {
    if (!message.trim()) return
    startTransition(async () => {
      try {
        await sendSms(technicianId, message.trim(), jobContext?.jobId, aiDrafted)
        toast.success('Message sent')
        setMessage('')
        setAiDrafted(false)
        onSent?.()
      } catch {
        toast.error('Failed to send message')
      }
    })
  }

  function selectTemplate(tpl: string) {
    setMessage(tpl)
    setAiDrafted(false)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="space-y-0.5">
        <p className="text-sm font-medium">
          To: {technicianName}{' '}
          <span className="text-muted-foreground">({technicianPhone})</span>
        </p>
        {jobContext && (
          <p className="text-xs text-muted-foreground">
            Re: {jobContext.customerName} &mdash;{' '}
            {jobContext.issueDescription.length > 60
              ? jobContext.issueDescription.slice(0, 60) + '...'
              : jobContext.issueDescription}
          </p>
        )}
      </div>

      {/* Templates */}
      <div className="flex flex-wrap gap-1.5">
        {templates.map((tpl) => (
          <button
            key={tpl}
            type="button"
            onClick={() => selectTemplate(tpl)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              message === tpl
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            )}
          >
            {tpl}
          </button>
        ))}
      </div>

      {/* AI Draft button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAiDraft}
        disabled={aiLoading}
      >
        {aiLoading ? (
          <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
        ) : (
          <Sparkles className="size-3.5" data-icon="inline-start" />
        )}
        {aiLoading ? 'Drafting...' : 'AI Draft'}
      </Button>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (aiDrafted) setAiDrafted(false)
          }}
          placeholder="Type your message..."
          rows={3}
          maxLength={maxChars}
          className={inputClass}
        />
        {aiDrafted && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            <Sparkles className="size-2.5" />
            AI drafted
          </span>
        )}
      </div>

      {/* Footer: char count + send */}
      <div className="flex items-center justify-between">
        <p
          className={cn(
            'text-xs',
            characterCount > maxChars * 0.9
              ? 'text-amber-600'
              : 'text-muted-foreground'
          )}
        >
          {characterCount} / {maxChars}
        </p>
        <Button
          onClick={handleSend}
          disabled={isPending || !message.trim()}
          size="sm"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <Send className="size-3.5" data-icon="inline-start" />
          )}
          {isPending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  )
}
