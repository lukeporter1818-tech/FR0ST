'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Wrench } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const params = useSearchParams()
    const resetSuccess = params.get('reset') === 'success'

  async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

      const result = await signIn('credentials', {
              email,
              password,
              redirect: false,
      })

      if (result?.error) {
              setError('Invalid username or password')
              setLoading(false)
      } else {
              router.push('/')
              router.refresh()
      }
  }

  return (
        <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
              <div className="w-full max-w-sm">
                {/* Brand */}
                      <div className="flex items-center justify-center gap-2.5 mb-8">
                                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15">
                                            <Wrench className="size-4 text-amber-400" />
                                </div>div>
                                <span className="text-lg font-semibold text-white">FR0ST</span>span>
                      </div>div>
              
                {/* Card */}
                      <div className="bg-gray-900 rounded-xl border border-white/10 shadow-2xl px-8 py-8">
                                <h1 className="text-base font-semibold text-white mb-6">Sign in</h1>h1>
                      
                        {resetSuccess && (
                      <p className="text-xs text-green-400 mb-4">
                                    Password reset successfully. Sign in with your new password.
                      </p>p>
                                )}
                      
                                <form onSubmit={handleSubmit} className="space-y-4">
                                            <div>
                                                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Username or Email</label>label>
                                                          <input
                                                                            type="text"
                                                                            value={email}
                                                                            onChange={(e) => setEmail(e.target.value)}
                                                                            required
                                                                            autoFocus
                                                                            autoComplete="username"
                                                                            className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent placeholder:text-gray-600"
                                                                            placeholder="john.smith"
                                                                          />
                                            </div>div>
                                
                                            <div>
                                                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>label>
                                                          <input
                                                                            type="password"
                                                                            value={password}
                                                                            onChange={(e) => setPassword(e.target.value)}
                                                                            required
                                                                            autoComplete="current-password"
                                                                            className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                                                                            placeholder="••••••••"
                                                                          />
                                            </div>div>
                                
                                  {error && (
                        <p className="text-xs text-red-400">{error}</p>p>
                                            )}
                                
                                            <button
                                                            type="submit"
                                                            disabled={loading}
                                                            className="w-full bg-amber-500 text-gray-950 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                                                          >
                                              {loading ? 'Signing in…' : 'Sign in'}
                                            </button>button>
                                
                                            <div className="text-center">
                                                          <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                                                                          Forgot password?
                                                          </Link>Link>
                                            </div>div>
                                </form>form>
                      </div>div>
              
                      <p className="text-center text-xs text-gray-600 mt-6">
                                FR0ST · Commercial refrigeration, HVAC, electrical, and plumbing operations
                      </p>p>
              </div>div>
        </div>div>
      )
}</div>
