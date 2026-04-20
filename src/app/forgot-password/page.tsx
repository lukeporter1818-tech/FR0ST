'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Wrench } from 'lucide-react'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
        })
        setSubmitted(true)
        setLoading(false)
  }

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
                                <h1 className="text-base font-semibold text-white mb-2">Reset Password</h1>h1>
                      
                        {submitted ? (
                      <div>
                                    <p className="text-sm text-gray-400 mb-4">
                                                    If that email is in our system, a reset link is on its way. Check your inbox.
                                    </p>p>
                                    <Link
                                                      href="/login"
                                                      className="text-xs text-amber-500 hover:text-amber-400"
                                                    >
                                                    Back to sign in
                                    </Link>Link>
                      </div>div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-4">
                                    <p className="text-xs text-gray-400">
                                                    Enter your email and we'll send a reset link.
                                    </p>p>
                                    <div>
                                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>label>
                                                    <input
                                                                        type="email"
                                                                        value={email}
                                                                        onChange={(e) => setEmail(e.target.value)}
                                                                        required
                                                                        autoFocus
                                                                        className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent placeholder:text-gray-600"
                                                                        placeholder="you@example.com"
                                                                      />
                                    </div>div>
                                    <button
                                                      type="submit"
                                                      disabled={loading}
                                                      className="w-full bg-amber-500 text-gray-950 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                                    >
                                      {loading ? 'Sending…' : 'Send Reset Link'}
                                    </button>button>
                                    <div className="text-center">
                                                    <Link href="/login" className="text-xs text-gray-500 hover:text-gray-300">
                                                                      Back to sign in
                                                    </Link>Link>
                                    </div>div>
                      </form>form>
                                )}
                      </div>div>
              </div>div>
        </div>div>
      )
}</div>
