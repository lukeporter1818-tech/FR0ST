'use client'

import { useState } from 'react'
import { Users, Loader2, CheckCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'

interface TechCandidate {
  id: string
  name: string
  tradeType: string | null
  openJobs: number
}

interface DispatchResult {
  source: 'deterministic' | 'ai'
  recommended: TechCandidate | null
  backups: TechCandidate[]
  reasoning: string
  reasons: string[]
  riskFlags: string[]
  missingInfo: string[]
  confidence: 'high' | 'medium' | 'low'
}

const CONFIDENCE_STYLES = {
  high:   'bg-green-50 text-green-700',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-gray-100 text-gray-500',
}

export function DispatchRecommend({ jobId }: { jobId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DispatchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function handleRecommend() {
    if (loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ai/dispatch-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Recommendation failed. Please try again.')
        return
      }
      setResult(data)
      setExpanded(true)
    } catch {
      setError('Request failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">Dispatch Recommendation</h2>
        </div>
        {result && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
      </div>

      <div className="px-6 py-4">
        {/* Initial state — prompt to run */}
        {!result && !error && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="text-sm text-gray-500">
              Get a ranked recommendation based on trade, availability, and workload.
            </p>
            <button
              onClick={handleRecommend}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Users className="size-3.5" />
                  Recommend Tech
                </>
              )}
            </button>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="space-y-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={handleRecommend}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {loading && <Loader2 className="size-3 animate-spin" />}
              Try again
            </button>
          </div>
        )}

        {/* Result panel */}
        {result && expanded && (
          <div className="space-y-4">
            {/* Source + confidence badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                result.source === 'deterministic' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
              }`}>
                {result.source === 'deterministic' ? '⚡ Rule-based' : '✦ AI assisted'}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_STYLES[result.confidence]}`}>
                {result.confidence} confidence
              </span>
            </div>

            {/* Missing info notice */}
            {result.missingInfo.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1 flex items-center gap-1">
                  <Info className="size-3" />
                  Missing info
                </p>
                <ul className="space-y-0.5">
                  {result.missingInfo.map((m, i) => (
                    <li key={i} className="text-xs text-amber-700">• {m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended tech */}
            {result.recommended ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Best match</p>
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="size-4 text-green-600 shrink-0" />
                      <span className="text-sm font-semibold text-gray-900">{result.recommended.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {result.recommended.tradeType && (
                        <span className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {result.recommended.tradeType}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {result.recommended.openJobs} open {result.recommended.openJobs === 1 ? 'job' : 'jobs'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-sm text-gray-500">
                  No available technician matched. Assign manually or update technician availability.
                </p>
              </div>
            )}

            {/* Backup techs */}
            {result.backups.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  {result.backups.length === 1 ? 'Backup' : 'Backups'}
                </p>
                <div className="space-y-1.5">
                  {result.backups.map((tech) => (
                    <div
                      key={tech.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                    >
                      <span className="text-sm text-gray-700">{tech.name}</span>
                      <div className="flex items-center gap-2">
                        {tech.tradeType && (
                          <span className="text-xs text-gray-400">{tech.tradeType}</span>
                        )}
                        <span className="text-xs text-gray-400">{tech.openJobs} open</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Why — structured reasons bullet list */}
            {result.reasons.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Why</p>
                <ul className="space-y-1">
                  {result.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-400" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Risk flags */}
            {result.riskFlags.length > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs font-semibold text-amber-800 mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="size-3" />
                  Risks
                </p>
                <ul className="space-y-0.5">
                  {result.riskFlags.map((flag, i) => (
                    <li key={i} className="text-xs text-amber-700">• {flag}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer: disclaimer + re-run */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">Final assignment stays with you.</p>
              <button
                onClick={handleRecommend}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
              >
                {loading && <Loader2 className="size-3 animate-spin" />}
                Re-run
              </button>
            </div>
          </div>
        )}

        {/* Result collapsed — show re-run only */}
        {result && !expanded && (
          <button
            onClick={handleRecommend}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3 animate-spin" /> : <Users className="size-3" />}
            {loading ? 'Analyzing…' : 'Re-run recommendation'}
          </button>
        )}
      </div>
    </div>
  )
}
