'use client'

import { useState, useTransition } from 'react'
import { X, Copy, AlertCircle, Mail, Phone, MessageSquare, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { inviteTechnician, resendInviteSms } from '@/lib/actions/invitations'
import type { InviteResult } from '@/lib/actions/invitations'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
}

type InviteMethod = 'email' | 'phone' | 'both' | 'manual'
type SuccessState = Extract<InviteResult, { success: true }>

const METHOD_OPTIONS: { value: InviteMethod; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'email',  label: 'Email'  },
  { value: 'phone',  label: 'Phone'  },
  { value: 'both',   label: 'Both'   },
]

function DeliveryBadge({ status, message, label }: {
  status: 'sent' | 'simulated' | 'failed'
  message: string
  label: string
}) {
  const styles = {
    sent:      'bg-blue-50 border-blue-200 text-blue-800',
    simulated: 'bg-amber-50 border-amber-200 text-amber-800',
    failed:    'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs', styles[status])}>
      <span className="font-semibold">{label}: </span>{message}
    </div>
  )
}

export function InviteModal({ isOpen, onClose }: InviteModalProps) {
  const [step, setStep]                 = useState<'form' | 'success'>('form')
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState<SuccessState | null>(null)
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>('manual')
  const [formData, setFormData]         = useState({ name: '', email: '', phone: '' })
  const [smsPending, startSmsTransition] = useTransition()

  if (!isOpen) return null

  const showEmail = inviteMethod === 'email' || inviteMethod === 'both'
  const showPhone = inviteMethod === 'phone' || inviteMethod === 'both'
  const isManual  = inviteMethod === 'manual'

  const handleClose = () => {
    setStep('form')
    setFormData({ name: '', email: '', phone: '' })
    setInviteMethod('manual')
    setError(null)
    setSuccess(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result = await inviteTechnician(
        formData.name,
        showEmail ? formData.email || undefined : undefined,
        showPhone ? formData.phone || undefined : undefined,
        inviteMethod,
      )
      if (!result.success) {
        setError(result.error ?? 'Failed to invite technician')
        toast.error(result.error ?? 'Failed to invite technician')
        return
      }
      setSuccess(result)
      setStep('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to invite technician'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const copyInviteText = () => {
    if (!success) return
    const url = `${window.location.origin}/login`
    const lines = [
      'FieldCommand Login',
      '──────────────────',
      `Name:     ${formData.name}`,
      `Login:    ${success.loginEmail}`,
      `Password: ${success.tempPassword}`,
      `URL:      ${url}`,
      '──────────────────',
      'Change password on first login.',
    ]
    navigator.clipboard.writeText(lines.join('\n'))
    toast.success('Invite text copied')
  }

  const handleResendSms = () => {
    if (!success) return
    startSmsTransition(async () => {
      const result = await resendInviteSms(success.technicianId, success.loginEmail, success.tempPassword)
      if (result.status === 'sent') toast.success('SMS sent')
      else if (result.status === 'simulated') toast.info('SMS not configured — credentials shown above')
      else toast.error(result.message)
    })
  }

  // Show SMS resend when a phone-based method was used
  const canResendSms = success && (success.inviteMethod === 'phone' || success.inviteMethod === 'both')

  return (
    <>
      {/* Backdrop — locked during in-flight invite */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={loading ? undefined : handleClose}
      />

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-xl p-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {step === 'form' ? 'Invite Technician' : 'Technician Added'}
            </h2>
            <button
              type="button"
              onClick={loading ? undefined : handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          {step === 'form' ? (
            // ── Form ──────────────────────────────────────────────────────────
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                  <AlertCircle className="size-4 text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Method selector */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Send invite by</p>
                <div className="flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 gap-0.5">
                  {METHOD_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setInviteMethod(value); setError(null) }}
                      disabled={loading}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors',
                        inviteMethod === value
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      )}
                    >
                      {value === 'manual' && <UserRound className="size-3" />}
                      {value === 'email'  && <Mail className="size-3" />}
                      {value === 'phone'  && <Phone className="size-3" />}
                      {value === 'both'   && <><Mail className="size-3" /><Phone className="size-3" /></>}
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Jane Smith"
                  required maxLength={100} disabled={loading}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
                />
                {isManual && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Username will be generated from the name (e.g. <span className="font-mono">jane.smith</span>). Share credentials manually.
                  </p>
                )}
              </div>

              {/* Email (email + both) */}
              {showEmail && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((d) => ({ ...d, email: e.target.value }))}
                    placeholder="jane@company.com"
                    required maxLength={200} disabled={loading}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
                  />
                </div>
              )}

              {/* Phone (phone + both) */}
              {showPhone && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    required maxLength={20} disabled={loading}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit" disabled={loading}
                  className={cn(
                    'flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors',
                    loading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-gray-700',
                  )}
                >
                  {loading ? 'Inviting…' : 'Send Invite'}
                </button>
                <button
                  type="button" onClick={handleClose} disabled={loading}
                  className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : success ? (
            // ── Success + Share Card ───────────────────────────────────────
            <div className="space-y-4">

              {/* ── Share card — optimised for screenshot ── */}
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900 text-white select-all">
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 border-b border-white/10">
                  <p className="text-xs text-gray-400 font-medium tracking-wider uppercase">FieldCommand</p>
                  <p className="text-sm font-semibold mt-0.5 text-white">Login Details</p>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 space-y-2 font-mono text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Name</span>
                    <span className="text-white text-right truncate">{formData.name}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">{success.inviteMethod === 'manual' ? 'Username' : 'Login'}</span>
                    <span className="text-white text-right break-all">{success.loginEmail}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-400 shrink-0">Password</span>
                    <span className="text-amber-300 font-bold tracking-wide text-right">{success.tempPassword}</span>
                  </div>
                </div>

                {/* Card footer */}
                <div className="px-4 py-2.5 bg-white/5 border-t border-white/10">
                  <p className="text-xs text-gray-400">Change password on first login · {window.location.hostname}</p>
                </div>
              </div>

              {/* Delivery status */}
              <div className="space-y-1.5">
                {success.emailStatus && success.emailStatusMessage && (
                  <DeliveryBadge status={success.emailStatus} message={success.emailStatusMessage} label="Email" />
                )}
                {success.smsStatus && success.smsStatusMessage && (
                  <DeliveryBadge status={success.smsStatus} message={success.smsStatusMessage} label="SMS" />
                )}
              </div>

              {/* Phone-only note */}
              {success.isPlaceholderEmail && success.inviteMethod !== 'manual' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Login email was generated from the phone number and included in the SMS.
                </p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button" onClick={copyInviteText}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Copy className="size-3.5" /> Copy Text
                </button>
                {canResendSms && (
                  <button
                    type="button" onClick={handleResendSms} disabled={smsPending}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    <MessageSquare className="size-3.5" />
                    {smsPending ? 'Sending…' : 'Resend SMS'}
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-400 text-center">
                ⓘ Screenshot the card above or use Copy Text to share via any channel.
              </p>

              <button
                type="button" onClick={handleClose}
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
