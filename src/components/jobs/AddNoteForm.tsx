'use client'

import { useRef, useState, useTransition } from 'react'
import { createJobNote } from '@/lib/actions/notes'
import { Loader2, MessageSquarePlus } from 'lucide-react'

export function AddNoteForm({ jobId }: { jobId: string }) {
  const [body, setBody]         = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef             = useRef<HTMLTextAreaElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || isPending) return
    setError(null)

    startTransition(async () => {
      try {
        await createJobNote(jobId, body)
        setBody('')
        textareaRef.current?.focus()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save note')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="px-6 py-4 border-t border-gray-100">
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Add Note
      </label>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Log an update, observation, or action taken…"
        rows={3}
        disabled={isPending}
        className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
      />
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}
      <div className="mt-2.5 flex justify-end">
        <button
          type="submit"
          disabled={!body.trim() || isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending
            ? <Loader2 className="size-3 animate-spin" />
            : <MessageSquarePlus className="size-3" />
          }
          {isPending ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </form>
  )
}
