'use client'

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Camera, MapPin, Phone, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addWorkOrderToBoard } from '@/lib/actions/board'
import { findSupplier } from '@/lib/suppliers'
import type { SupplierInfo } from '@/lib/suppliers'
import type { WorkOrderExtraction } from '@/types/work-order'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  timestamp: Date
  workOrder?: WorkOrderExtraction // present when this message displays a WO card
  interactionId?: string          // present on assistant messages with a learning log entry
}

interface TechMatch {
  id: string
  name: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Detects the "Availability (likely):" section header that Frost emits in
// Parts Finder and Photo Part responses.
const AVAILABILITY_HEADER_RE = /^availability\s*\(likely\)\s*:/i

const AssistantContent = memo(function AssistantContent({ content }: { content: string }) {
  const lines = content.split('\n')
  // Mutable flag — safe because map() is synchronous and renders once per call
  let inAvailability = false

  return (
    <div className="space-y-2 text-sm leading-relaxed text-gray-100">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // ── Detect availability section header ─────────────────────────────
        if (AVAILABILITY_HEADER_RE.test(trimmed)) {
          inAvailability = true
          return <p key={i} className="text-sm">{renderInline(line)}</p>
        }

        // ── Exit availability when we hit the next named section header ────
        // A named header is a non-bullet, non-empty line ending with ":"
        if (
          inAvailability &&
          trimmed !== '' &&
          !trimmed.startsWith('-') &&
          !trimmed.startsWith('•') &&
          trimmed.endsWith(':')
        ) {
          inAvailability = false
        }

        // ── Supplier bullet inside availability section ─────────────────────
        if (inAvailability && (line.startsWith('- ') || line.startsWith('• '))) {
          const name = line.slice(2).trim()
          const info = findSupplier(name)
          if (info) {
            return <SupplierActions key={i} name={name} info={info} />
          }
          // Unknown supplier — fall through to normal bullet render
        }

        // ── Standard bullet ────────────────────────────────────────────────
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="mt-1.5 shrink-0 text-gray-500 text-xs">▸</span>
              <span className="flex-1">{renderInline(line.slice(2))}</span>
            </div>
          )
        }

        // ── Numbered list ──────────────────────────────────────────────────
        if (line.match(/^\d+\.\s/)) {
          return (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="mt-1.5 shrink-0 text-gray-500 text-xs font-medium">
                {line.match(/^\d+/)?.[0]}
              </span>
              <span className="flex-1">{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
            </div>
          )
        }

        if (line === '') return <div key={i} className="h-0.5" />
        return <p key={i} className="text-sm">{renderInline(line)}</p>
      })}
    </div>
  )
})

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const styles: Record<string, string> = {
    high: 'bg-green-500/15 text-green-300 border-green-500/30',
    medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    low: 'bg-red-500/15 text-red-300 border-red-500/30',
  }
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', styles[confidence])}>
      {confidence} confidence
    </span>
  )
}

function WorkOrderCard({ wo }: { wo: WorkOrderExtraction }) {
  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Work Order</span>
        <ConfidenceBadge confidence={wo.confidence} />
      </div>

      {/* Card body */}
      <div className="px-3 py-2.5 space-y-1.5">
        {wo.workOrderNumber && (
          <p className="text-sm font-semibold text-gray-100">{wo.workOrderNumber}</p>
        )}
        {wo.shortDescription && (
          <p className="text-sm text-gray-300">{wo.shortDescription}</p>
        )}
        {(wo.siteName || wo.callType || wo.priority) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-400 pt-0.5">
            {wo.siteName && (
              <span><span className="font-medium">Site:</span> {wo.siteName}</span>
            )}
            {wo.callType && (
              <span><span className="font-medium">Type:</span> {wo.callType}</span>
            )}
            {wo.priority && (
              <span><span className="font-medium">Priority:</span> {wo.priority}</span>
            )}
          </div>
        )}
        {wo.confidence === 'low' && (
          <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded px-2 py-1 mt-1">
            ⚠ Low confidence — verify the details above before assigning.
          </p>
        )}
      </div>
    </div>
  )
}

function SupplierActions({ name, info }: { name: string; info: SupplierInfo }) {
  const mapsUrl = info.onlineOnly
    ? null
    : `https://www.google.com/maps/search/${info.mapsQuery}`

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-gray-200 font-medium leading-snug">{name}</span>
      <div className="flex gap-1.5 shrink-0">
        {info.phone && (
          <a
            href={`tel:${info.phone}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 border border-white/15 text-xs font-medium text-gray-300 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 active:bg-amber-500/30 transition-colors"
          >
            <Phone size={11} strokeWidth={2.5} />
            Call
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/8 border border-white/15 text-xs font-medium text-gray-300 hover:bg-amber-500/20 hover:text-amber-300 hover:border-amber-500/40 active:bg-amber-500/30 transition-colors"
          >
            <MapPin size={11} strokeWidth={2.5} />
            Directions
          </a>
        )}
      </div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <span className="h-2 w-2 rounded-full bg-gray-600 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-gray-600 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-gray-600 animate-bounce" />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AIAssistant() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Work order intake state machine
  // null      → normal chat mode
  // 'awaiting-tech' → WO extracted, waiting for dispatcher to name a tech
  // 'confirming'    → tech matched, waiting for dispatcher to confirm schedule write
  const [intakeStep, setIntakeStep] = useState<'awaiting-tech' | 'confirming' | null>(null)
  const [pendingExtraction, setPendingExtraction] = useState<WorkOrderExtraction | null>(null)
  const [pendingTechMatch, setPendingTechMatch] = useState<TechMatch | null>(null)
  const [techList, setTechList] = useState<TechMatch[]>([])

  // Upload source menu + its fixed screen coordinates (computed on open)
  const [showUploadMenu, setShowUploadMenu] = useState(false)
  const [menuPos, setMenuPos] = useState<{ bottom: number; left: number } | null>(null)
  const cameraButtonRef = useRef<HTMLButtonElement>(null)

  // Frost learning: feedback given per message id, and log-fix form open state
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'helpful' | 'not_helpful'>>({})
  const [logFixOpen, setLogFixOpen] = useState<string | null>(null) // message id
  const [fixForm, setFixForm] = useState({ issueSummary: '', actualFix: '', systemType: '' })
  const [fixSubmitting, setFixSubmitting] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Single file input — accept/capture are set dynamically before .click()
  // so there is never a `capture` input sitting in the DOM near the camera button
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll to bottom when messages update
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, loading, scrollToBottom])

  // Load technician list once on mount for name-matching
  useEffect(() => {
    fetch('/api/technicians')
      .then((r) => (r.ok ? r.json() : []))
      .then((techs: TechMatch[]) => setTechList(techs))
      .catch(() => {}) // silent — tech matching degrades gracefully
  }, [])

  // ── Image handling ──────────────────────────────────────────────────────────

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = '' // allow re-selecting same file
  }, [])

  const removeImage = useCallback(() => {
    setImageFile(null)
    setImagePreview(null)
  }, [])

  // Open the upload menu: compute fixed screen position from the button's rect
  // so the menu card uses position:fixed and is immune to ancestor overflow clipping.
  const openUploadMenu = useCallback(() => {
    const btn = cameraButtonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({
      bottom: window.innerHeight - rect.top + 8, // 8px gap above the button
      left: rect.left,
    })
    setShowUploadMenu(true)
  }, [])

  // Trigger the shared hidden file input. capture is only set on genuine touch
  // devices (iOS / Android). On desktop, capture="environment" opens the Chrome
  // webcam UI instead of a normal image picker — which is not the intended UX.
  const triggerFileInput = useCallback((accept: string, capture?: 'environment') => {
    setShowUploadMenu(false)
    setMenuPos(null)
    const input = fileInputRef.current
    if (!input) return
    input.accept = accept
    const isTouchDevice = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
    if (capture && isTouchDevice) {
      input.setAttribute('capture', capture)
    } else {
      input.removeAttribute('capture')
    }
    input.click()
  }, [])

  // Close the menu on Escape key (desktop keyboard UX)
  useEffect(() => {
    if (!showUploadMenu) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowUploadMenu(false); setMenuPos(null) }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showUploadMenu])

  // ── Intake confirmation handlers ────────────────────────────────────────────

  const resetIntake = useCallback(() => {
    setIntakeStep(null)
    setPendingExtraction(null)
    setPendingTechMatch(null)
  }, [])

  // ── Auto-send path for dropped images ────────────────────────────────────────
  // Runs the full extraction → assign flow without requiring a manual send click.
  // Does NOT send conversation history — dropped images are standalone intake items.
  const autoSendImage = useCallback(async (dataUrl: string) => {
    if (loading) return
    resetIntake()
    setInput('')
    setImageFile(null)
    setImagePreview(null)

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: '',
      imageUrl: dataUrl,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setLoading(true)

    try {
      const extractRes = await fetch('/api/ai/extract-work-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
        signal: AbortSignal.timeout(22_000),
      })

      if (extractRes.ok) {
        const extraction: WorkOrderExtraction = await extractRes.json()
        if (extraction.detected) {
          setPendingExtraction(extraction)
          setIntakeStep('awaiting-tech')
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: 'Work order detected — select a technician below to assign.',
              timestamp: new Date(),
              workOrder: extraction,
            },
          ])
          setLoading(false)
          return
        }
      }

      // Not a work order — pass to general assistant for image analysis
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: '' }],
          imageBase64: dataUrl,
        }),
        signal: AbortSignal.timeout(28_000),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json()
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          interactionId: data.interactionId as string | undefined,
        },
      ])
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'TimeoutError'
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: isTimeout
            ? 'Frost is taking too long to respond — try again in a moment.'
            : 'Something went wrong reaching the assistant. Check your connection and try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [loading, resetIntake])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    if (loading || intakeStep === 'confirming') return

    // ── 1. Real file drop (local files, screenshots, Photos app) ────────────
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        if (dataUrl) autoSendImage(dataUrl)
      }
      reader.readAsDataURL(file)
      return
    }

    // ── 2. Items API fallback (some browsers surface files here, not in .files) ─
    const imageItem = Array.from(e.dataTransfer.items).find(
      (item) => item.kind === 'file' && item.type.startsWith('image/')
    )
    if (imageItem) {
      const f = imageItem.getAsFile()
      if (f) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string
          if (dataUrl) autoSendImage(dataUrl)
        }
        reader.readAsDataURL(f)
        return
      }
    }

    // ── 3. Browser image drag (URL/HTML — no real file due to browser security) ─
    // Dragging from Google Images or any website gives text/uri-list or text/html
    // instead of a file. CORS blocks fetching these URLs. Tell the user clearly.
    const types = Array.from(e.dataTransfer.types)
    if (types.includes('text/uri-list') || types.includes('text/html')) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: "Browser security blocked that image — web images can't be dragged directly. Right-click the image → **Save image**, then drag the saved file here or use the upload button.",
          timestamp: new Date(),
        },
      ])
      return
    }

    // ── 4. Unrecognized drop — surface clearly, never silently fail ──────────
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: "That drop didn't include a usable image. Try dragging a saved image file or use the upload button.",
        timestamp: new Date(),
      },
    ])
  }, [loading, intakeStep, autoSendImage])

  // ── Frost learning handlers ──────────────────────────────────────────────────

  const submitFeedback = useCallback(async (msg: Message, feedback: 'helpful' | 'not_helpful') => {
    if (!msg.interactionId || feedbackGiven[msg.id]) return
    setFeedbackGiven((prev) => ({ ...prev, [msg.id]: feedback }))
    await fetch(`/api/ai/interactions/${msg.interactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedback }),
    }).catch(() => {}) // non-fatal
  }, [feedbackGiven])

  const submitFix = useCallback(async (msg: Message) => {
    if (!msg.interactionId) return
    setFixSubmitting(true)
    await fetch(`/api/ai/interactions/${msg.interactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issueSummary: fixForm.issueSummary || undefined,
        actualFix: fixForm.actualFix || undefined,
        systemType: fixForm.systemType || undefined,
      }),
    }).catch(() => {})
    setFixSubmitting(false)
    setLogFixOpen(null)
    setFixForm({ issueSummary: '', actualFix: '', systemType: '' })
  }, [fixForm])

  const handleConfirmAssign = useCallback(async () => {
    if (!pendingExtraction || !pendingTechMatch) return
    setLoading(true)

    try {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD in UTC
      // assignment = WO number (preferred) or description as fallback
      // note = description, but omit when it would duplicate assignment
      const assignment = pendingExtraction.workOrderNumber ?? pendingExtraction.shortDescription ?? ''
      const note =
        pendingExtraction.workOrderNumber && pendingExtraction.shortDescription
          ? pendingExtraction.shortDescription
          : ''
      await addWorkOrderToBoard(pendingTechMatch.id, assignment, note, today, pendingExtraction.workOrderNumber ?? null, false)
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Done ✓ **${pendingTechMatch.name}** — **${pendingExtraction.workOrderNumber ?? 'Work order'}** added to today's Schedule.`,
          timestamp: new Date(),
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Failed to add to Schedule: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
      resetIntake()
    }
  }, [pendingExtraction, pendingTechMatch, resetIntake])

  const handleCancelAssign = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Assignment cancelled.',
        timestamp: new Date(),
      },
    ])
    resetIntake()
  }, [resetIntake])

  // ── Main send handler ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text && !imageFile) return
    if (loading) return

    // ── State: awaiting technician name ────────────────────────────────────
    // Intercept text replies when we're in intake mode (no image — a new image
    // restarts the extraction flow below instead)
    if (intakeStep === 'awaiting-tech' && !imageFile && pendingExtraction) {
      if (!text) return

      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() },
      ])
      setInput('')

      // Match tech by name — prioritized tiers to avoid false positives.
      // Tier 1: exact full name. Tier 2: exact first name. Tier 3: first or
      // last name starts with input (minimum 2 chars to reduce noise).
      const lower = text.toLowerCase()
      const match =
        techList.find((t) => t.name.toLowerCase() === lower) ??
        techList.find((t) => t.name.toLowerCase().split(' ')[0] === lower) ??
        (lower.length >= 2
          ? techList.find((t) => {
              const parts = t.name.toLowerCase().split(' ')
              return parts.some((p) => p.startsWith(lower))
            })
          : undefined) ??
        null

      if (match) {
        setPendingTechMatch(match)
        setIntakeStep('confirming')
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Got it — assign **${pendingExtraction.workOrderNumber ?? pendingExtraction.shortDescription ?? 'this work order'}** to **${match.name}** and add to today's Schedule?`,
            timestamp: new Date(),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Couldn't find a technician matching "${text}". Try their first name or full name.`,
            timestamp: new Date(),
          },
        ])
      }
      return
    }

    // ── New image upload resets any in-progress intake ──────────────────────
    if (imageFile) resetIntake()

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      imageUrl: imagePreview ?? undefined,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setImageFile(null)
    setImagePreview(null)
    setLoading(true)

    try {
      // ── Work order extraction path ────────────────────────────────────────
      // When an image is attached, try extraction first. If a work order is
      // detected we enter intake mode and skip the general assistant call.
      if (userMessage.imageUrl) {
        const extractRes = await fetch('/api/ai/extract-work-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: userMessage.imageUrl }),
          signal: AbortSignal.timeout(22_000),
        })

        if (extractRes.ok) {
          const extraction: WorkOrderExtraction = await extractRes.json()

          if (extraction.detected) {
            setPendingExtraction(extraction)
            setIntakeStep('awaiting-tech')

            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: 'Which tech should I assign this to?',
                timestamp: new Date(),
                workOrder: extraction,
              },
            ])
            return // intake mode started — don't call assistant
          }
          // detected: false → fall through to normal assistant below
        }
        // extraction request failed → fall through gracefully
      }

      // ── General assistant path ────────────────────────────────────────────
      // Trim to last 9 messages before appending the new one — server also trims
      // to 10, but trimming here avoids sending the full conversation across the
      // wire on every turn in a long session.
      const history = messages.slice(-9).map((m) => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: text })

      const body: { messages: typeof history; imageBase64?: string } = { messages: history }
      if (userMessage.imageUrl) body.imageBase64 = userMessage.imageUrl

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(28_000),
      })

      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      const data = await res.json()

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          interactionId: data.interactionId as string | undefined,
        },
      ])
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'TimeoutError'
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: isTimeout
            ? 'Frost is taking too long to respond — try again in a moment.'
            : 'Something went wrong reaching the assistant. Check your connection and try again.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, imageFile, imagePreview, loading, messages, intakeStep, pendingExtraction, techList, resetIntake])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  // Disable send while confirming — the banner handles that step
  const canSend =
    (input.trim().length > 0 || imageFile !== null) &&
    !loading &&
    intakeStep !== 'confirming'

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] -m-6">
      {/*
        Hidden file input — lives at the component root, completely outside the
        camera button and its wrapper. accept/capture are set dynamically by
        triggerFileInput() so a `capture` element never sits dormant near the
        button (which triggers iOS to activate the camera before JS can run).
      */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Header */}
      <div className="shrink-0 border-b border-white/10 bg-gray-950 px-4 py-3 sm:px-6">
        <h1 className="text-base font-semibold text-gray-100">Frost Field Helper</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Get answers about HVAC, refrigeration, electrical, plumbing
        </p>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="relative flex-1 overflow-y-auto bg-[#0f1117] px-4 py-4 sm:px-6"
        onDragOver={(e) => { e.preventDefault(); if (!isDragOver) setIsDragOver(true) }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
        }}
        onDrop={handleDrop}
      >
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-amber-400 bg-amber-500/10">
            <div className="text-center">
              <p className="text-sm font-semibold text-amber-300">Drop to scan or identify component</p>
              <p className="text-xs text-amber-400/70 mt-1">Work orders · Part photos · Nameplates</p>
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 pb-8 px-2">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                <Bot size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-100">Frost Field Helper</p>
                <p className="mt-0.5 max-w-sm text-xs text-gray-500 leading-relaxed">
                  Describe a problem or upload a part photo for identification.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex flex-col gap-1',
                  message.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                {message.role === 'user' ? (
                  <div className="bg-amber-500 text-gray-950 rounded-2xl rounded-br-sm px-4 py-3 max-w-[80%]">
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt="Attached photo"
                        className="mb-2 rounded-lg max-h-48 w-auto object-contain"
                      />
                    )}
                    {message.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{message.content}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="bg-gray-800 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                      {/* Work order card appears above the text when present */}
                      {message.workOrder && <WorkOrderCard wo={message.workOrder} />}
                      {message.content && <AssistantContent content={message.content} />}
                    </div>

                    {/* Feedback + log fix — only shown when interaction was logged */}
                    {message.interactionId && (
                      <div className="flex items-center gap-2 px-1 mt-0.5">
                        <button
                          onClick={() => submitFeedback(message, 'helpful')}
                          disabled={!!feedbackGiven[message.id]}
                          title="Helpful"
                          className={cn(
                            'text-sm transition-colors',
                            feedbackGiven[message.id] === 'helpful'
                              ? 'opacity-100'
                              : feedbackGiven[message.id]
                                ? 'opacity-30'
                                : 'opacity-40 hover:opacity-80'
                          )}
                        >
                          👍
                        </button>
                        <button
                          onClick={() => submitFeedback(message, 'not_helpful')}
                          disabled={!!feedbackGiven[message.id]}
                          title="Not helpful"
                          className={cn(
                            'text-sm transition-colors',
                            feedbackGiven[message.id] === 'not_helpful'
                              ? 'opacity-100'
                              : feedbackGiven[message.id]
                                ? 'opacity-30'
                                : 'opacity-40 hover:opacity-80'
                          )}
                        >
                          👎
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(message.content).then(() => {
                              setCopiedId(message.id)
                              setTimeout(() => setCopiedId((prev) => prev === message.id ? null : prev), 2000)
                            }).catch(() => {})
                          }}
                          title="Copy response"
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
                        >
                          {copiedId === message.id ? '✓ Copied' : 'Copy'}
                        </button>
                        <button
                          onClick={() => {
                            setLogFixOpen(logFixOpen === message.id ? null : message.id)
                            setFixForm({ issueSummary: '', actualFix: '', systemType: '' })
                          }}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
                        >
                          Log fix
                        </button>
                      </div>
                    )}

                    {/* Inline log fix form */}
                    {logFixOpen === message.id && (
                      <div className="bg-gray-800/80 border border-white/10 rounded-xl p-3 max-w-[85%] space-y-2">
                        <input
                          type="text"
                          placeholder="Issue summary (optional)"
                          value={fixForm.issueSummary}
                          onChange={(e) => setFixForm((f) => ({ ...f, issueSummary: e.target.value }))}
                          className="w-full text-xs border border-white/15 bg-white/5 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/50 text-gray-100 placeholder:text-gray-600"
                        />
                        <textarea
                          placeholder="What fixed it *"
                          value={fixForm.actualFix}
                          onChange={(e) => setFixForm((f) => ({ ...f, actualFix: e.target.value }))}
                          rows={2}
                          className="w-full text-xs border border-white/15 bg-white/5 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/50 text-gray-100 placeholder:text-gray-600 resize-none"
                        />
                        <select
                          value={fixForm.systemType}
                          onChange={(e) => setFixForm((f) => ({ ...f, systemType: e.target.value }))}
                          className="w-full text-xs border border-white/15 bg-gray-800 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500/50 text-gray-300"
                        >
                          <option value="">System type (optional)</option>
                          <option value="Rack">Rack</option>
                          <option value="Display Case">Display Case</option>
                          <option value="Defrost">Defrost</option>
                          <option value="Electrical">Electrical</option>
                          <option value="HVAC">HVAC</option>
                          <option value="Plumbing">Plumbing</option>
                          <option value="Controls">Controls</option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => submitFix(message)}
                            disabled={fixSubmitting || !fixForm.actualFix.trim()}
                            className="flex-1 rounded-lg bg-amber-500 py-1.5 text-xs font-semibold text-gray-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                          >
                            {fixSubmitting ? 'Saving…' : 'Save fix'}
                          </button>
                          <button
                            onClick={() => setLogFixOpen(null)}
                            className="px-3 rounded-lg border border-white/15 text-xs text-gray-400 hover:bg-white/5 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <span className="text-xs text-gray-600 px-1">{formatTime(message.timestamp)}</span>
              </div>
            ))}

            {loading && (
              <div className="flex flex-col items-start gap-1">
                <div className="bg-gray-800 border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                  <LoadingDots />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image preview strip */}
      {imagePreview && (
        <div className="shrink-0 border-t border-white/10 bg-gray-950 px-4 py-2 sm:px-6">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Photo preview"
              className="h-16 w-auto rounded-lg object-cover border border-white/15"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-gray-100 hover:bg-gray-600 transition-colors"
              aria-label="Remove photo"
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* Tech picker — shown when WO detected, replaces freeform name typing */}
      {intakeStep === 'awaiting-tech' && pendingExtraction && (
        <div className="shrink-0 border-t border-white/10 bg-amber-500/10 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              Assign to technician
            </p>
            <button
              type="button"
              onClick={() => {
                resetIntake()
                setMessages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), role: 'assistant', content: 'Work order intake cancelled.', timestamp: new Date() },
                ])
              }}
              className="text-xs text-gray-500 hover:text-gray-300 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
          {techList.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No technicians available — type a name in the box below.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {techList.map((tech) => (
                <button
                  key={tech.id}
                  type="button"
                  onClick={() => {
                    setPendingTechMatch(tech)
                    setIntakeStep('confirming')
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: `Assign **${pendingExtraction.workOrderNumber ?? pendingExtraction.shortDescription ?? 'this work order'}** to **${tech.name}** and add to today's Schedule?`,
                        timestamp: new Date(),
                      },
                    ])
                  }}
                  className="px-3 py-1.5 rounded-lg border border-white/15 bg-white/5 text-sm font-medium text-gray-200 hover:bg-amber-500 hover:text-gray-950 hover:border-amber-500 active:bg-amber-600 transition-colors"
                >
                  {tech.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule confirm banner — shown when tech is matched and awaiting confirmation */}
      {intakeStep === 'confirming' && pendingExtraction && pendingTechMatch && (
        <div className="shrink-0 border-t border-amber-500/25 bg-amber-500/10 px-4 py-3 sm:px-6">
          <p className="text-sm font-medium text-gray-100 mb-2.5">
            Assign{' '}
            <strong>
              {pendingExtraction.workOrderNumber ?? pendingExtraction.shortDescription ?? 'work order'}
            </strong>{' '}
            to <strong>{pendingTechMatch.name}</strong> today?
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirmAssign}
              disabled={loading}
              className="flex-1 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Confirm'}
            </button>
            <button
              onClick={handleCancelAssign}
              disabled={loading}
              className="flex-1 rounded-lg border border-white/15 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div
        className="shrink-0 border-t border-white/10 bg-gray-950 px-4 pt-3 sm:px-6"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-end gap-2">
          {/* Camera button — no file inputs anywhere in this subtree */}
          <div className="shrink-0">
            <button
              ref={cameraButtonRef}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                showUploadMenu ? (setShowUploadMenu(false), setMenuPos(null)) : openUploadMenu()
              }}
              disabled={intakeStep === 'confirming'}
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 transition-colors',
                intakeStep === 'confirming'
                  ? 'text-gray-700 cursor-not-allowed'
                  : 'text-gray-400 hover:bg-white/10 hover:text-gray-200 active:bg-white/15',
              )}
              title="Add photo"
              aria-label="Add photo"
            >
              <Camera size={18} />
            </button>
          </div>

          {/* Upload source menu — rendered as fixed so it escapes ancestor overflow:hidden.
              Coordinates are computed from the button's getBoundingClientRect() on open. */}
          {showUploadMenu && menuPos && (
            <>
              {/* Backdrop — captures outside clicks and keyboard Escape (handled by effect) */}
              <div
                className="fixed inset-0 z-[998]"
                onClick={() => { setShowUploadMenu(false); setMenuPos(null) }}
              />

              {/* Menu card — fixed, positioned above the camera button */}
              <div
                className="fixed z-[999] w-48 overflow-hidden rounded-xl border border-white/15 bg-gray-900 shadow-2xl"
                style={{ bottom: menuPos.bottom, left: menuPos.left }}
              >
                <button
                  type="button"
                  onClick={() => triggerFileInput('image/*', 'environment')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/8 active:bg-white/12 transition-colors"
                >
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileInput('image/*')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/8 active:bg-white/12 transition-colors"
                >
                  Photos
                </button>
                <button
                  type="button"
                  onClick={() => triggerFileInput('*/*')}
                  className="w-full px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/8 active:bg-white/12 transition-colors"
                >
                  Files
                </button>
                <div className="border-t border-white/10" />
                <button
                  type="button"
                  onClick={() => { setShowUploadMenu(false); setMenuPos(null) }}
                  className="w-full px-4 py-3 text-left text-sm font-medium text-gray-500 hover:bg-white/8 active:bg-white/12 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* Text input — locked during confirmation (banner takes over) */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              intakeStep === 'awaiting-tech'
                ? 'Type a technician name…'
                : intakeStep === 'confirming'
                  ? 'Use the buttons above to confirm or cancel…'
                  : 'Describe the problem…'
            }
            rows={1}
            disabled={loading || intakeStep === 'confirming'}
            className={cn(
              'flex-1 resize-none rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-100',
              'placeholder:text-gray-600 outline-none',
              'focus:bg-white/8 focus:ring-2 focus:ring-amber-500/50',
              'transition-colors max-h-32 leading-relaxed',
              (loading || intakeStep === 'confirming') && 'opacity-50 cursor-not-allowed',
            )}
            style={{ overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 128) + 'px'
            }}
          />

          {/* Send button */}
          <button
            onClick={sendMessage}
            disabled={!canSend}
            className={cn(
              'shrink-0 flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
              canSend
                ? 'bg-amber-500 text-gray-950 hover:bg-amber-400 active:bg-amber-600'
                : 'bg-white/5 text-gray-700 cursor-not-allowed',
            )}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
