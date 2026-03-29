'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Wrench, Loader2, Eye, EyeOff } from 'lucide-react'

type PageState =
  | { phase: 'loading' }
  | { phase: 'invalid'; message: string }
  | { phase: 'form'; name: string; login: string }
  | { phase: 'activating' }
  | { phase: 'done' }

export default function InvitePage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const token = params.token

  const [state, setState] = useState<PageState>({ phase: 'loading' })
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [fieldError, setFieldError] = useState('')

  useEffect(() => {
    if (!token) { setState({ phase: 'invalid', message: 'Invalid invite link.' }); return }
    fetch(`/api/invite/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setState({ phase: 'invalid', message: data.error })
        } else {
          setState({ phase: 'form', name: data.name, login: data.login })
        }
      })
      .catch(() => setState({ phase: 'invalid', message: 'Could not validate invite link.' }))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError('')
    if (password.length < 8) { setFieldError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setFieldError('Passwords do not match'); return }

    setState({ phase: 'activating' })
    try {
      const res = await fetch('/api/invite/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setState({ phase: 'form', name: (state as { name: string; login: string }).name, login: (state as { name: string; login: string }).login })
        setFieldError(data.error ?? 'Activation failed. Please try again.')
        return
      }
      setState({ phase: 'done' })
      setTimeout(() => router.push('/login'), 1500)
    } catch {
      setState({ phase: 'form', name: (state as { name: string; login: string }).name, login: (state as { name: string; login: string }).login })
      setFieldError('Request failed. Check your connection.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-400/15">
            <Wrench className="size-4 text-amber-400" />
          </div>
          <span className="text-lg font-semibold text-white">FR0ST</span>
        </div>

        <div className="bg-gray-900 rounded-xl border border-white/10 shadow-2xl px-8 py-8">
          {state.phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="size-6 animate-spin text-gray-500" />
              <p className="text-sm text-gray-400">Validating invite…</p>
            </div>
          )}

          {state.phase === 'invalid' && (
            <div className="text-center space-y-2">
              <p className="text-base font-semibold text-white">Invalid invite link</p>
              <p className="text-sm text-gray-400">{state.message}</p>
              <p className="text-xs text-gray-600 pt-2">Contact your administrator for a new invite.</p>
            </div>
          )}

          {(state.phase === 'form' || state.phase === 'activating') && (
            <>
              <h1 className="text-base font-semibold text-white mb-1">Welcome to FR0ST</h1>
              <p className="text-sm text-gray-400 mb-6">
                Set a password to activate your account.
              </p>

              {state.phase === 'form' && (
                <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 mb-5">
                  <p className="text-xs text-gray-500 mb-0.5">Your username</p>
                  <p className="text-sm font-mono text-gray-200">{state.login}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      maxLength={200}
                      disabled={state.phase === 'activating'}
                      autoFocus
                      className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 pr-10 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent placeholder:text-gray-600 disabled:opacity-50"
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    maxLength={200}
                    disabled={state.phase === 'activating'}
                    className="w-full border border-white/15 bg-white/5 rounded-lg px-3 py-2.5 text-sm text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent placeholder:text-gray-600 disabled:opacity-50"
                    placeholder="Re-enter password"
                  />
                </div>

                {fieldError && (
                  <p className="text-xs text-red-400">{fieldError}</p>
                )}

                <button
                  type="submit"
                  disabled={state.phase === 'activating'}
                  className="w-full bg-amber-500 text-gray-950 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {state.phase === 'activating' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Activating…
                    </span>
                  ) : 'Activate Account'}
                </button>
              </form>
            </>
          )}

          {state.phase === 'done' && (
            <div className="text-center space-y-2">
              <p className="text-base font-semibold text-white">Account activated</p>
              <p className="text-sm text-gray-400">Redirecting to login…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
