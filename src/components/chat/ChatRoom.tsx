'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, MessageSquare, Trash2 } from 'lucide-react'
import { ChatMessage, type ChatMessageData } from '@/components/chat/ChatMessage'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type ChatRoomProps = {
  initialMessages: ChatMessageData[]
  userId: string
  userName: string
  userRole?: string
  channel?: string
}

export function ChatRoom({ initialMessages, userId, userName, userRole, channel = 'general' }: ChatRoomProps) {
  const isAdmin = userRole === 'ADMIN'
  const [messages, setMessages] = useState<ChatMessageData[]>(initialMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // containerRef: used by the visualViewport useEffect to directly set the
  // ChatRoom's height via DOM style mutation (bypassing React state so there
  // is no re-render cascade during the keyboard-open animation).
  const containerRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const channelReadyRef = useRef(false)
  // Synchronous in-flight guard — prevents double-send race where two rapid
  // taps both read `sending === false` before the first setState re-renders.
  const sendingRef = useRef(false)
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

  // ── Visual viewport: keep ChatRoom height = real visible area above keyboard ─
  //
  // Problem: On iOS < 15.4, position:fixed uses the layout viewport (full screen).
  // When the keyboard opens the layout viewport does NOT shrink, so the ChatRoom
  // remains full-screen tall and the composer sits behind the keyboard.
  // On Android, the visual viewport shrinks correctly but we still need an
  // explicit height so the composer stays pinned above the keyboard rather than
  // relying on a flex chain that may not receive the updated height signal.
  //
  // Fix: read window.visualViewport.height (the only reliable cross-platform
  // measurement of the visible area above the keyboard) and set the ChatRoom's
  // height directly via DOM style mutation.
  //
  // Why DOM mutation (not React setState):
  //   vv.resize fires on every animation frame during the keyboard slide
  //   (~60 fps). React setState → re-render → reconcile → commit each frame
  //   creates a cascade that causes jank and intermediate layout flashes.
  //   Direct el.style mutation is synchronous and paint-safe.
  //
  // Why topOffset is snapshotted at mount (not re-read on each event):
  //   topOffset = TopBar height — it never changes. Re-measuring during
  //   animation risks a stale getBoundingClientRect mid-repaint where the
  //   previously committed height is still in-progress, producing jitter.
  //
  // Android safety: on Android, vv.height already reflects available space.
  //   height = vv.height - topOffset is identical to what a correct flex chain
  //   would produce. No double-correction, no overcorrection.
  useEffect(() => {
    const vv = window.visualViewport
    const el = containerRef.current
    if (!vv || !el) return

    // Snapshot TopBar height once at mount — stable, never changes.
    const topOffset = el.getBoundingClientRect().top

    const update = () => {
      if (!containerRef.current) return
      const height = Math.max(0, Math.round(vv.height - topOffset))
      containerRef.current.style.height = `${height}px`
      containerRef.current.style.flex = 'none'
    }

    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  // ── Real-time: Supabase Broadcast ─────────────────────────────────────────
  // When this client successfully saves a message it broadcasts the full
  // ChatMessageData object to the 'chat:general' channel.  All *other*
  // connected clients receive it immediately and append it to their list.
  // Supabase does NOT echo broadcasts back to the sender, so there is no
  // duplicate — the sender already has the message via optimistic update.
  useEffect(() => {
    const supaChannel = supabase
      .channel(`chat:${channel}`)
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

    channelRef.current = supaChannel

    return () => {
      channelReadyRef.current = false
      supabase.removeChannel(supaChannel)
    }
  }, [channel]) // re-subscribe if channel changes

  // ── Fallback poll (30 s) ───────────────────────────────────────────────────
  // Catches any messages missed while the realtime connection was down
  // (e.g. background tab, brief network blip).  Uses a ref for the last-seen
  // timestamp so this interval never needs to be re-created.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const since = lastSeenAtRef.current
        const url = since
          ? `/api/chat?channel=${encodeURIComponent(channel)}&since=${encodeURIComponent(since)}`
          : `/api/chat?channel=${encodeURIComponent(channel)}`
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

  async function handleDeleteMessage(id: string) {
    if (!confirm('Delete this message?')) return
    const res = await fetch(`/api/chat?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== id))
    }
  }

  async function handleSend() {
    const body = input.trim()
    if (!body || sendingRef.current) return
    sendingRef.current = true

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
          channel,
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
      sendingRef.current = false
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


  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col min-h-0 bg-[#0f1117]"
    >
      {/* Messages area — flex-1 min-h-0 so it can shrink when keyboard opens */}
      <div
        ref={scrollRef}
        className="min-h-0 overflow-y-auto px-5 py-4 space-y-4 bg-[#0f1117]"
        style={{ flex: '1 1 0' }}
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MessageSquare className="size-10 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500 font-medium">No messages yet</p>
              <p className="text-xs text-gray-600 mt-1">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.userId === userId
            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {!isOwn && (
                  <span className="text-xs text-gray-500 font-medium mb-1 px-1">
                    {msg.userName}
                  </span>
                )}
                <div
                  className={
                    isOwn
                      ? 'bg-amber-500 text-gray-950 rounded-2xl rounded-br-md px-4 py-2 max-w-[75%]'
                      : 'bg-gray-800 text-gray-100 rounded-2xl rounded-bl-md px-4 py-2 max-w-[75%] ring-1 ring-white/8'
                  }
                >
                  <p className="text-sm leading-relaxed break-words">{msg.body}</p>
                </div>
                <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  <span className={`text-[10px] text-gray-600 ${isOwn ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input bar — shrink-0 so it is never compressed regardless of message volume */}
      <div
        className="shrink-0 bg-gray-950 border-t border-white/10 px-4 pt-3"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-base md:text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="flex items-center justify-center w-11 h-11 bg-amber-500 hover:bg-amber-400 text-gray-950 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
