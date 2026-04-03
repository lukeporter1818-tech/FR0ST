'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { createUserWithInvite } from '@/lib/actions/users'

interface UnlinkedTech {
  id: string
  name: string
  tradeType: string | null
}

async function fetchUnlinkedTechs(): Promise<UnlinkedTech[]> {
  const res = await fetch('/api/unlinked-techs')
  if (!res.ok) return []
  return res.json()
}

type Step = 'form' | 'success'

export default function NewUserPage() {
  const [step, setStep]         = useState<Step>('form')
  const [inviteUrl, setInviteUrl] = useState('')
  const [userName, setUserName]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [techs, setTechs]         = useState<UnlinkedTech[]>([])

  useEffect(() => {
    fetchUnlinkedTechs().then(setTechs).catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData(e.currentTarget)
      const result = await createUserWithInvite(formData)
      setInviteUrl(result.inviteUrl)
      setUserName(result.userName)
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl)
    toast.success('Invite link copied')
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <Link
          href="/settings/users"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-200 mb-4 transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to users
        </Link>
        <h1 className="text-xl font-semibold text-gray-100">Add User</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Create an account — the user sets their own password via invite link.
        </p>
      </div>

      {step === 'form' ? (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4"
        >
          {error && (
            <div className="rounded-lg bg-red-500/15 border border-red-500/30 px-3 py-2.5">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Full Name</label>
              <input
                name="name"
                required
                maxLength={100}
                disabled={loading}
                className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm text-gray-100 bg-white/5 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 disabled:opacity-50"
                placeholder="Sarah Miller"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
              <input
                name="email"
                type="email"
                required
                maxLength={200}
                disabled={loading}
                className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm text-gray-100 bg-white/5 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 disabled:opacity-50"
                placeholder="sarah@company.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Role</label>
              <select
                name="role"
                defaultValue="TECHNICIAN"
                disabled={loading}
                className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm text-gray-100 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
              >
                <option value="TECHNICIAN">Technician</option>
                <option value="DISPATCHER">Dispatcher</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Phone (optional)</label>
              <input
                name="phone"
                type="tel"
                maxLength={20}
                disabled={loading}
                className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm text-gray-100 bg-white/5 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
                placeholder="(555) 123-4567"
              />
            </div>

            {techs.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Link to Technician Profile (optional)
                </label>
                <select
                  name="technicianId"
                  disabled={loading}
                  className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm text-gray-100 bg-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50"
                >
                  <option value="">— None —</option>
                  {techs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.tradeType ? ` (${t.tradeType})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 text-gray-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create & Get Invite Link'}
            </button>
            <Link
              href="/settings/users"
              className="flex-1 text-center border border-white/15 text-gray-400 rounded-lg py-2.5 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-gray-100">{userName} added</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Send this link to the user to activate their account. Expires in 24 hours.
            </p>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <Link2 className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-xs text-gray-300 font-mono break-all leading-relaxed">
                {inviteUrl}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 py-2 text-sm font-semibold text-gray-950 hover:bg-amber-400 transition-colors"
          >
            <Copy className="size-3.5" /> Copy Invite Link
          </button>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep('form'); setError(null) }}
              className="flex-1 border border-white/15 text-gray-400 rounded-lg py-2.5 text-sm font-medium hover:bg-white/5 transition-colors"
            >
              Add Another
            </button>
            <Link
              href="/settings/users"
              className="flex-1 text-center bg-amber-500 text-gray-900 rounded-lg py-2.5 text-sm font-semibold hover:bg-amber-400 transition-colors"
            >
              Done
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
