'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

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
          {submitted ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-white font-medium">Check your email</p>
              <p className="text-xs text-gray-400">
                If that address is in our system you will receive a reset link shortly.
              </p>
              <Link href="/login" className="block text-xs text-amber-400 hover:text-amber-300 mt-4">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-base font-semibold text-white mb-2">Forgot password</h1>
              <p className="text-xs text-gray-400 mb-6">Enter your email and we will send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-500 text-gray-950 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
                <div className="text-center">
                  <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                    Back to sign in
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
