'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Wrench } from 'lucide-react'

function ResetPasswordForm() {
    const params = useSearchParams()
    const router = useRouter()
    const token = params.get('token') ?? ''
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        if (password !== confirm) return setError("Passwords don't match")
        if (password.length < 8) return setError('Minimum 8 characters')
        setLoading(true)
        const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
        })
        const data = await res.json()
        if (!res.ok) {
                setError(data.error ?? 'Something went wrong')
                setLoading(false)
        } else {
                router.push('/login?reset=success')
        }
  }

  if (!token) {
        return (
                <p className="text-sm text-red-400">
                        Invalid reset link. Please request a new one.
                </p>p>
              )
  }
  
    return (
          <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">New password</label>label>
                        <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoFocus
                                    autoComplete="new-password"
                                    className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                                    placeholder="••••••••"
                                  />
                </div>div>
                <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm password</label>label>
                        <input
                                    type="password"
                                    value={confirm}
                                    onChange={(e) => setConfirm(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                                    placeholder="••••••••"
                                  />
                </div>div>
            {error && <p className="text-xs text-red-400">{error}</p>p>}
                <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-amber-500 text-gray-950 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                  {loading ? 'Saving…' : 'Set New Password'}
                </button>button>
          </form>form>
        )
}

export default function ResetPasswordPage() {
    return (
          <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
                <div className="w-full max-w-sm">
                        <div className="flex items-center justify-center gap-2.5 mb-8">
                                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15">
                                              <Wrench className="size-4 text-amber-400" />
                                  </div>div>
                                  <span className="text-lg font-semibold text-white">FR0ST</span>span>
                        </div>div>
                        <div className="bg-gray-900 rounded-xl border border-white/10 shadow-2xl px-8 py-8">
                                  <h1 className="text-base font-semibold text-white mb-6">Set New Password</h1>h1>
                                  <Suspense fallback={<p className="text-sm text-gray-400">Loading…</p>p>}>
                                              <ResetPasswordForm />
                                  </Suspense>Suspense>
                        </div>div>
                </div>div>
          </div>div>
        )
}</p>
