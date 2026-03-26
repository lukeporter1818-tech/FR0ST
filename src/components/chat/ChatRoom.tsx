'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, Sparkles, X, MessageSquare } from 'lucide-react'
import { ChatMessage, type ChatMessageData } from '@/components/chat/ChatMessage'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type ChatRoomProps = {
  initialMessages: ChatMessageData[]
  userId: string
  userName: string
}

export function ChatRoom({ initialMessages, userId, userName }: ChatRoomProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const channelReadyRef = useRef(false)
  // Stable ref for last-seen createdAt — used by fallback poll without
  // needing messages in its dependency array (avoids re-creating interval).
  const lastSeenAtRef = useRef<string | undefined>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : undefined
  )

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  // Scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // ── Real-time: Supabase Broadcast ─────────────────────────────────────────
  // When this client successfully saves a message it broadcasts the full
  // ChatMessageData object to the 'chat:general' channel.  All *other*
  // connected clients receive it immediately and append it to their list.
  // Supabase does NOT echo broadcasts back to the sender, so there is no
  // duplicate — the sender already has the message via optimistic update.
  useEffect(() => {
    const channel = supabase
      .channel('chat:general')
      .on(
        'broadcast',
        { event: 'new_message' },
        ({ payload }: { payload: ChatMessageData }) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.id)) return prev
            lastSeenAtRef.current = payload.createdAt
            return [...prev, payload]
          })
        }
      )
      .subscribe((status) => {
        channelReadyRef.current = status === 'SUBSCRIBED'
      })

    channelRef.current = channel

    return () => {
      channelReadyRef.current = false
      supabase.removeChannel(channel)
    }
  }, []) // stable – no deps

  // ── Fallback poll (30 s) ───────────────────────────────────────────────────
  // Catches any messages missed while the realtime connection was down
  // (e.g. background tab, brief network blip).  Uses a ref for the last-seen
  // timestamp so this interval never needs to be re-created.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const since = lastSeenAtRef.current
        const url = since
          ? `/api/chat?since=${encodeURIComponent(since)}`
          : '/api/chat'
        const res = await fetch(url)
        if (!res.ok) return
        const data: ChatMessageData[] = await res.json()
        if (data.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id))
            const newOnes = data.filter((m) => !existingIds.has(m.id))
            if (newOnes.length === 0) return prev
            lastSeenAtRef.current = newOnes[newOnes.length - 1].createdAt
            return [...prev, ...newOnes]
          })
        }
      } catch {
        // silently ignore fallback poll failures
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, []) // stable – uses ref, no messages dep

  async function handleSend() {
    const body = input.trim()
    if (!body) return

    setSending(true)
    setInput('')

    // Optimistic add
    const optimisticMsg: ChatMessageData = {
      id: `temp-${Date.now()}`,
      userId,
      userName,
      body,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body,
          channel: 'general',
        }),
      })

      if (!res.ok) throw new Error('Send failed')
      const saved: ChatMessageData = await res.json()

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMsg.id ? saved : m))
      )
      lastSeenAtRef.current = saved.createdAt

      // Broadcast to all other connected clients in real-time.
      // Supabase does not echo back to the sender, so no duplicate on our end.
      if (channelRef.current && channelReadyRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: saved,
        })
      }
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      toast.error('Failed to send message')
      setInput(body) // restore input
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSummary() {
    setSummarizing(true)
    setSummary(null)
    try {
      const res = await fetch('/api/ai/chat-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-50).map((m) => ({
            name: m.userName,
            body: m.body,
            time: m.createdAt,
          })),
        }),
      })
      if (!res.ok) throw new Error('Summary failed')
      const data = await res.json()
      setSummary(data.summary ?? 'No summary available.')
    } catch {
      toast.error('Could not generate summary. Try again later.')
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-gray-400" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900"># general</h2>
            <p className="text-xs text-gray-500">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleSummary}
          disabled={summarizing || messages.length === 0}
          className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {summarizing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5 text-violet-500" />
          )}
          {summarizing ? 'Summarizing...' : 'AI Summary'}
        </button>
      </div>

      {/* AI Summary banner */}
      {summary && (
        <div className="border-b border-violet-100 bg-violet-50 px-5 py-3">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-violet-700 mb-0.5">AI Summary</p>
              <p className="text-sm text-violet-900 leading-relaxed">{summary}</p>
            </div>
            <button
              onClick={() => setSummary(null)}
              className="text-violet-400 hover:text-violet-600 transition-colors ml-2 mt-0.5"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-white"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="size-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No messages yet</p>
              <p className="text-xs text-gray-300 mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === userId
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {!isOwn && (
                  <span className="text-xs text-gray-500 font-medium mb-1 px-1">
                    {msg.userName}
                  </span>
                )}
                <div
                  className={
                    isOwn
                      ? 'bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2 max-w-[75%]'
                      : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-md px-4 py-2 max-w-[75%]'
                  }
                >
                  <p className="text-sm leading-relaxed break-words">{msg.body}</p>
                </div>
                <span className={`text-[10px] text-gray-400 mt-1 px-1 ${isOwn ? 'text-right' : 'text-left'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Input bar */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
