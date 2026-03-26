'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteUser } from '@/lib/actions/users'

export function DeleteUserButton({
  userId,
  userName,
}: {
  userId: string
  userName: string
}) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleDelete = () => {
    if (!confirm(`Delete "${userName}"? This removes all their records and cannot be undone.`)) return

    startTransition(async () => {
      const result = await deleteUser(userId)
      if (result.success) {
        toast.success(`${userName} deleted`)
        router.refresh()
      } else {
        toast.error(result.error ?? 'Delete failed')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      title={`Delete ${userName}`}
      aria-label={`Delete ${userName}`}
      className="text-red-400 hover:text-red-600 p-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Trash2 className="size-4" />
    </button>
  )
}
