'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setUserActive, generatePasswordResetToken, adminSetPassword } from '@/lib/actions/users'
import { Copy, Check, KeyRound, UserX, UserCheck } from 'lucide-react'

interface Props {
  userId: string
  isActive: boolean
  isSelf: boolean
}

export function UserDangerZone({ userId, isActive, isSelf }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState(false)

  function handleToggleActive() {
    if (!confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'reactivate'} this user?`)) return
    startTransition(async () => {
      await setUserActive(userId, !isActive)
      router.refresh()
    })
  }

  async function handleGenerateReset() {
    startTransition(async () => {
      try {
        const token = await generatePasswordResetToken(userId)
        const url = `${window.location.origin}/reset-password/${token}`
        setResetUrl(url)
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Failed to generate reset link')
      }
    })
  }

  function copyResetUrl() {
    if (!resetUrl) return
    navigator.clipboard.writeText(resetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError(null)
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters')
      return
    }
    startTransition(async () => {
      try {
        await adminSetPassword(userId, newPassword)
        setNewPassword('')
        setShowPasswordForm(false)
        setPwSuccess(true)
        setTimeout(() => setPwSuccess(false), 3000)
      } catch (e) {
        setPwError(e instanceof Error ? e.message : 'Failed to set password')
      }
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <p className="text-sm font-medium text-gray-900">Password & Access</p>

      {/* Generate reset link */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">Send reset link</p>
            <p className="text-xs text-gray-400">Generates a 24-hour link the user can use to set their own password</p>
          </div>
          <button
            onClick={handleGenerateReset}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <KeyRound className="size-3.5" />
            Generate Link
          </button>
        </div>

        {resetUrl && (
          <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
            <p className="flex-1 text-xs text-gray-600 font-mono truncate">{resetUrl}</p>
            <button onClick={copyResetUrl} className="shrink-0 text-gray-500 hover:text-gray-900">
              {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-gray-100" />

      {/* Admin direct set password */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-700">Set password directly</p>
            <p className="text-xs text-gray-400">Override the password without a reset link</p>
          </div>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <KeyRound className="size-3.5" />
            Set Password
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handleSetPassword} className="flex gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min. 8 chars)"
              minLength={8}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {isPending ? '…' : 'Set'}
            </button>
          </form>
        )}
        {pwError && <p className="text-xs text-red-600">{pwError}</p>}
        {pwSuccess && <p className="text-xs text-green-600">Password updated.</p>}
      </div>

      {/* Deactivate / Reactivate */}
      {!isSelf && (
        <>
          <div className="border-t border-gray-100" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700">{isActive ? 'Deactivate user' : 'Reactivate user'}</p>
              <p className="text-xs text-gray-400">
                {isActive
                  ? 'Blocks login immediately on next session expiry'
                  : 'Restores login access for this user'}
              </p>
            </div>
            <button
              onClick={handleToggleActive}
              disabled={isPending}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                isActive
                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                  : 'border-green-200 text-green-700 hover:bg-green-50'
              }`}
            >
              {isActive ? (
                <><UserX className="size-3.5" />Deactivate</>
              ) : (
                <><UserCheck className="size-3.5" />Reactivate</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
