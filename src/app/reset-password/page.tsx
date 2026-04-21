'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
      } else {
        router.push('/login?reset=success')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-3">
        <p className="text-sm text-red-400">Invalid or missing reset token.</p>
        <Link href="/forgot-password" className="text-xs text-amber-400 hover:text-amber-300">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <>
      <h1 className="text-base font-semibold text-white mb-2">Set new password</h1>
      <p className="text-xs text-gray-400 mb-6">Choose a strong password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
            placeholder="Min. 8 characters"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
            placeholder="Repeat password"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-500 text-gray-950 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15">
            <Wrench className="size-4 text-amber-400" />
          </div>
          <span className="text-lg font-semibold text-white">FR0ST</span>
        </div>
        <div className="bg-gray-900 rounded-xl border border-white/10 shadow-2xl px-8 py-8">
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
