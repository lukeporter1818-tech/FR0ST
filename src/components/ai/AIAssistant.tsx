'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, Camera, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  timestamp: Date
}

const EXAMPLE_PROMPTS = [
  'Walk-in freezer at 28°F, fans running, what should I check?',
  'RTU no heat, board not sending 24v to gas valve',
  'Water heater not lighting, standing pilot keeps going out',
  'Panel buzzing and lights flickering on one circuit',
]

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function AssistantContent({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-900">
      {lines.map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const text = line.slice(2)
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-gray-400">•</span>
              <span>{renderInline(text)}</span>
            </div>
          )
        }
        if (line === '') {
          return <div key={i} className="h-1" />
        }
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
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

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
    </div>
  )
}

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [])

  const removeImage = useCallback(() => {
    setImageFile(null)
    setImagePreview(null)
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text && !imageFile) return
    if (loading) return

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
      // Build conversation history for the API (exclude image data URLs — we send imageBase64 separately)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      // Add the current user message to history
      history.push({ role: 'user', content: text })

      const body: { messages: typeof history; imageBase64?: string } = {
        messages: history,
      }

      if (userMessage.imageUrl) {
        body.imageBase64 = userMessage.imageUrl
      }

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`)
      }

      const data = await res.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Something went wrong reaching the assistant. Check your connection and try again.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }, [input, imageFile, imagePreview, loading, messages])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const handlePromptChip = useCallback((prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }, [])

  const canSend = (input.trim().length > 0 || imageFile !== null) && !loading

  return (
    // Break out of the parent <main>'s p-6 padding using -m-6, match full height
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-base font-semibold text-gray-900">Frost</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Ask about HVAC, refrigeration, electrical, or plumbing
        </p>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-gray-50 px-4 py-4 sm:px-6"
      >
        {messages.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white">
                <Bot size={28} />
              </div>
              <div>
                <p className="text-base font-semibold text-gray-900">Frost</p>
                <p className="mt-1 max-w-xs text-sm text-gray-500 leading-relaxed">
                  Ask anything about HVAC, refrigeration, electrical, or plumbing. Describe
                  symptoms, upload photos, get practical help.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full max-w-sm">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptChip(prompt)}
                  className="w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors active:bg-gray-100"
                >
                  {prompt}
                </button>
              ))}
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
                  <div className="bg-gray-900 text-white rounded-2xl rounded-br-sm px-4 py-3 max-w-[80%]">
                    {message.imageUrl && (
                      <img
                        src={message.imageUrl}
                        alt="Attached photo"
                        className="mb-2 rounded-lg max-h-48 w-auto object-contain"
                      />
                    )}
                    {message.content && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                    <AssistantContent content={message.content} />
                  </div>
                )}
                <span className="text-xs text-gray-400 px-1">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            ))}

            {loading && (
              <div className="flex flex-col items-start gap-1">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                  <LoadingDots />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-2 sm:px-6">
          <div className="relative inline-block">
            <img
              src={imagePreview}
              alt="Photo preview"
              className="h-16 w-auto rounded-lg object-cover border border-gray-200"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700 transition-colors"
              aria-label="Remove photo"
            >
              <X size={10} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-end gap-2">
          {/* Camera button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors active:bg-gray-100"
            aria-label="Attach photo"
          >
            <Camera size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />

          {/* Text input */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about any trade issue..."
            rows={1}
            className={cn(
              'flex-1 resize-none rounded-xl bg-gray-100 px-4 py-3 text-sm text-gray-900',
              'placeholder:text-gray-400 outline-none',
              'focus:bg-white focus:ring-2 focus:ring-gray-900',
              'transition-colors max-h-32 leading-relaxed',
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
              'shrink-0 flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              canSend
                ? 'bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-800'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed',
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
