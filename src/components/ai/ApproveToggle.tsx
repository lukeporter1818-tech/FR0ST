'use client'

import { useState, useTransition } from 'react'

export function ApproveToggle({ id, approved }: { id: string; approved: boolean }) {
  const [isApproved, setIsApproved] = useState(approved)
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const res = await fetch(`/api/ai/interactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: !isApproved }),
      })
      if (res.ok) setIsApproved((v) => !v)
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
        isApproved
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      } disabled:opacity-50`}
    >
      {isApproved ? '✓ Approved' : 'Approve'}
    </button>
  )
}
