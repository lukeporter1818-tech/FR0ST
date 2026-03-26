'use client'

import { useState } from 'react'
import { X, Copy, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { inviteTechnician } from '@/lib/actions/invitations'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
}

interface SuccessState {
  email: string
  tempPassword: string
  smsStatus: 'sent' | 'simulated' | 'failed'
  smsStatusMessage: string
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)

  const [formData, setFormData] = useState({ name: '', email: '', phone: '' })

  if (!isOpen) return null

  const handleClose = () => {
    setStep('form')
    setFormData({ name: '', email: '', phone: '' })
    setError(null)
    setSuccess(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await inviteTechnician(formData.name, formData.email, formData.phone)
      setSuccess({
        email: result.email,
        tempPassword: result.tempPassword,
        smsStatus: result.smsStatus,
        smsStatusMessage: result.smsStatusMessage,
      })
      setStep('success')
      toast.success('Technician invited successfully')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite technician'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  return (
    <>
      {/* Backdrop — disabled during loading so an accidental click cannot
          close the modal while the invite is in-flight and lose the temp
          password before the admin has a chance to copy it. */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={loading ? undefined : handleClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-h-[90vh] overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'form' ? 'Invite Technician' : 'Invitation Sent'}
            </h2>
            <button
              onClick={loading ? undefined : handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {step === 'form' ? (
            // ─── Form Step ───────────────────────────────────────────────
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Jane Smith"
                  required
                  maxLength={100}
                  disabled={loading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                  placeholder="jane@company.com"
                  required
                  maxLength={200}
                  disabled={loading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  required
                  maxLength={20}
                  disabled={loading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                    loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-700'
                  )}
                >
                  {loading ? 'Inviting…' : 'Send Invite'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : success ? (
            // ─── Success Step ────────────────────────────────────────────
            <div className="space-y-4">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 border border-green-200">
                  <CheckCircle2 className="size-6 text-green-600" />
                </div>
              </div>

              <p className="text-sm text-gray-600 text-center">
                Account created and invitation sent to{' '}
                <span className="font-medium text-gray-900">{success.email}</span>
              </p>

              {/* SMS Status */}
              <div
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  success.smsStatus === 'sent'
                    ? 'bg-blue-50 border-blue-200'
                    : success.smsStatus === 'simulated'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                )}
              >
                <p className="font-medium text-gray-900">{success.smsStatusMessage}</p>
              </div>

              {/* Credentials */}
              <div className="space-y-3 bg-gray-50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Email</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1.5">
                      {success.email}
                    </code>
                    <button
                      onClick={() => copyToClipboard(success.email, 'Email')}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Copy email"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 font-medium mb-1">Temporary Password</p>
                  <div className="flex gap-2 items-center">
                    <code className="flex-1 text-sm font-mono bg-white border border-gray-200 rounded px-2 py-1.5">
                      {success.tempPassword}
                    </code>
                    <button
                      onClick={() => copyToClipboard(success.tempPassword, 'Password')}
                      className="text-gray-400 hover:text-gray-600 p-1"
                      aria-label="Copy password"
                    >
                      <Copy className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                ⓘ The technician must change their password on first login.
              </p>

              <button
                onClick={handleClose}
                className="w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
