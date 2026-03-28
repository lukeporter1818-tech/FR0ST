'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Brain,
  ClipboardCheck,
  Copy,
  FileText,
  CalendarDays,
  Loader2,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AiJobTriage, type TriageResult } from '@/components/ai/AiJobTriage'
import { applyTriageToJob } from '@/lib/actions/ai'

// ── Types ──

type Mode =
  | 'home'
  | 'triage'
  | 'schedule'
  | 'clean-notes'
  | 'ask'

interface QAPair {
  question: string
  answer: string
}

interface CleanNotesResult {
  cleanedNotes: string
  keyPoints: string[]
}

// ── Component ──

interface AiPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function AiPanel({ isOpen, onClose }: AiPanelProps) {
  const [mode, setMode] = useState<Mode>('home')
  const [loading, setLoading] = useState(false)
  const [applyLoading, setApplyLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Triage state
  const [triageInput, setTriageInput] = useState('')
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null)

  const [copied, setCopied] = useState(false)

  // Schedule chat state
  const [scheduleContext, setScheduleContext] = useState<string | null>(null)
  const [scheduleHistory, setScheduleHistory] = useState<QAPair[]>([])
  const [scheduleInput, setScheduleInput] = useState('')

  // Clean notes state
  const [cleanInput, setCleanInput] = useState('')
  const [cleanResult, setCleanResult] = useState<CleanNotesResult | null>(null)

  // Ask state
  const [askHistory, setAskHistory] = useState<QAPair[]>([])
  const [askInput, setAskInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const resetAll = useCallback(() => {
    setError(null)
    setTriageInput('')
    setTriageResult(null)
    setCopied(false)
    setScheduleContext(null)
    setScheduleHistory([])
    setScheduleInput('')
    setCleanInput('')
    setCleanResult(null)
    setAskHistory([])
    setAskInput('')
  }, [])

  const switchMode = useCallback(
    (next: Mode) => {
      resetAll()
      setMode(next)
    },
    [resetAll]
  )

  // Load schedule data when entering schedule mode
  useEffect(() => {
    if (mode !== 'schedule' || scheduleContext !== null) return

    async function loadSchedule() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/technicians')
        if (!res.ok) throw new Error('Failed to load schedule')
        const techs: Array<{
          id: string
          name: string
          status: string
          tradeType: string | null
          jobs: Array<{
            id: string
            customerName: string
            issueDescription: string
            status: string
            priority: string
            address: string | null
          }>
        }> = await res.json()

        const today = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })

        const lines = [`Today is ${today}. Current field schedule:\n`]

        for (const tech of techs) {
          const statusNote = tech.status !== 'ACTIVE' ? ` (${tech.status})` : ''
          if (tech.jobs.length === 0) {
            lines.push(`• ${tech.name}${statusNote}: No active work orders`)
          } else {
            lines.push(`• ${tech.name}${statusNote}:`)
            for (const job of tech.jobs) {
              lines.push(
                `  - WO: ${job.customerName}${job.address ? ` at ${job.address}` : ''} | ${job.issueDescription} | Priority: ${job.priority} | Status: ${job.status}`
              )
            }
          }
        }

        setScheduleContext(lines.join('\n'))
      } catch {
        setError('Could not load schedule data.')
      } finally {
        setLoading(false)
      }
    }

    loadSchedule()
  }, [mode, scheduleContext])

  // ── API helpers ──

  async function handleTriage() {
    if (!triageInput.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueDescription: triageInput }),
      })
      if (!res.ok) throw new Error('Triage request failed')
      const data = await res.json()
      setTriageResult(data)
    } catch {
      setError('Failed to triage. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleScheduleAsk() {
    if (!scheduleInput.trim() || !scheduleContext || loading) return
    const question = scheduleInput.trim()
    setScheduleInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: scheduleContext,
        }),
      })
      if (!res.ok) throw new Error('Ask request failed')
      const data = await res.json()
      setScheduleHistory((prev) => [...prev, { question, answer: data.answer }])
      setTimeout(
        () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
        100
      )
    } catch {
      setError('Failed to get answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCleanNotes() {
    if (!cleanInput.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/clean-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawNotes: cleanInput }),
      })
      if (!res.ok) throw new Error('Clean notes request failed')
      const data = await res.json()
      setCleanResult(data)
    } catch {
      setError('Failed to clean notes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAsk() {
    if (!askInput.trim() || loading) return
    const question = askInput.trim()
    setAskInput('')
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) throw new Error('Ask request failed')
      const data = await res.json()
      setAskHistory((prev) => [...prev, { question, answer: data.answer }])
      setTimeout(
        () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
        100
      )
    } catch {
      setError('Failed to get answer. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleApplyTriage(jobId: string, triage: TriageResult) {
    setApplyLoading(true)
    try {
      await applyTriageToJob(jobId, {
        summary: triage.summary,
        tradeClassification: triage.tradeClassification,
        urgency: triage.urgency,
        followUpQuestions: triage.followUpQuestions,
        riskFlags: triage.riskFlags,
      })
    } catch {
      setError('Failed to apply triage to job.')
    } finally {
      setApplyLoading(false)
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ──

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Brain className="size-4 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Frost</h2>
              {mode === 'home' ? (
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Commercial refrigeration, HVAC, electrical, and plumbing support
                </p>
              ) : (
                <button
                  onClick={() => switchMode('home')}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Back to menu
                </button>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Home */}
          {mode === 'home' && (
            <div className="space-y-2">
              <p className="mb-3 text-sm text-muted-foreground">What can I help you with?</p>
              <QuickAction
                icon={<Sparkles className="size-4" />}
                label="Triage Job"
                description="Analyze a service call for urgency, trade, and risks"
                onClick={() => switchMode('triage')}
              />
              <QuickAction
                icon={<CalendarDays className="size-4" />}
                label="Work Orders"
                description="Ask Frost who's on what job and what the WO is about"
                onClick={() => switchMode('schedule')}
              />
              <QuickAction
                icon={<FileText className="size-4" />}
                label="Clean Notes"
                description="Turn messy field notes into professional write-ups"
                onClick={() => switchMode('clean-notes')}
              />
              <QuickAction
                icon={<Brain className="size-4" />}
                label="Ask Frost"
                description="Ask about HVAC, plumbing, electrical, or operations"
                onClick={() => switchMode('ask')}
              />
            </div>
          )}

          {/* Triage mode */}
          {mode === 'triage' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Triage a Service Call</p>
              <textarea
                value={triageInput}
                onChange={(e) => setTriageInput(e.target.value)}
                placeholder="Paste or type the job description... e.g. 'Customer says AC unit is making loud banging noise and not cooling. Unit is a Carrier rooftop unit, about 15 years old.'"
                className="min-h-[120px] w-full resize-none rounded-lg border bg-muted/30 p-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
              <Button className="w-full" onClick={handleTriage} disabled={loading || !triageInput.trim()}>
                {loading ? (
                  <><Loader2 className="size-4 animate-spin" />Analyzing...</>
                ) : (
                  <><Sparkles className="size-4" />Triage This Job</>
                )}
              </Button>
              {triageResult && (
                <AiJobTriage
                  result={triageResult}
                  onApplyToJob={handleApplyTriage}
                  applyLoading={applyLoading}
                />
              )}
            </div>
          )}

          {/* Scheduled Work Orders mode */}
          {mode === 'schedule' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Work Orders</p>
              {loading && scheduleHistory.length === 0 && (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading today&apos;s schedule...
                </div>
              )}
              {scheduleContext && scheduleHistory.length === 0 && !loading && (
                <p className="py-2 text-sm text-muted-foreground">
                  Ask me anything about today&apos;s work orders — who&apos;s on what job, what a WO is about, or which tech to contact.
                </p>
              )}
              {scheduleHistory.map((pair, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {pair.question}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                      {pair.answer}
                    </div>
                  </div>
                </div>
              ))}
              {loading && scheduleHistory.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          )}

          {/* Clean notes mode */}
          {mode === 'clean-notes' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Clean Field Notes</p>
              <textarea
                value={cleanInput}
                onChange={(e) => setCleanInput(e.target.value)}
                placeholder="Paste raw technician notes... e.g. 'got onsite checked compresser not runing. checked volts ok. cap bad 45/5 uf replaced w new. unit running good now'"
                className="min-h-[120px] w-full resize-none rounded-lg border bg-muted/30 p-3 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
              <Button className="w-full" onClick={handleCleanNotes} disabled={loading || !cleanInput.trim()}>
                {loading ? (
                  <><Loader2 className="size-4 animate-spin" />Cleaning...</>
                ) : (
                  <><FileText className="size-4" />Clean Up Notes</>
                )}
              </Button>
              {cleanResult && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Cleaned Notes
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{cleanResult.cleanedNotes}</p>
                  </div>
                  {cleanResult.keyPoints.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Key Points
                      </p>
                      <ul className="space-y-1">
                        {cleanResult.keyPoints.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => copyToClipboard(cleanResult.cleanedNotes)}>
                    {copied ? (
                      <><ClipboardCheck className="size-3.5" />Copied!</>
                    ) : (
                      <><Copy className="size-3.5" />Copy Cleaned Notes</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Ask anything mode */}
          {mode === 'ask' && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Ask Frost</p>
              {askHistory.length === 0 && !loading && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Ask me anything about HVAC, plumbing, electrical, refrigeration, or dispatch operations.
                </p>
              )}
              {askHistory.map((pair, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                      {pair.question}
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                      {pair.answer}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom input for schedule and ask modes */}
        {(mode === 'ask' || mode === 'schedule') && (
          <div className="shrink-0 border-t p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                mode === 'schedule' ? handleScheduleAsk() : handleAsk()
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={mode === 'schedule' ? scheduleInput : askInput}
                onChange={(e) =>
                  mode === 'schedule' ? setScheduleInput(e.target.value) : setAskInput(e.target.value)
                }
                placeholder={
                  mode === 'schedule'
                    ? "e.g. What's Mike working on today?"
                    : 'Ask a question...'
                }
                className="flex-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading || (mode === 'schedule' && !scheduleContext)}
              />
              <Button
                type="submit"
                size="icon"
                disabled={
                  loading ||
                  (mode === 'schedule' ? !scheduleInput.trim() || !scheduleContext : !askInput.trim())
                }
              >
                <Send className="size-4" />
              </Button>
            </form>
          </div>
        )}
      </aside>
    </>
  )
}

// ── Quick action button ──

function QuickAction({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  )
}
