'use client'

import {
  AlertTriangle,
  CircleHelp,
  FileCheck,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface TriageResult {
  summary: string
  tradeClassification: string
  urgency: string
  followUpQuestions: string[]
  riskFlags: string[]
  safetyNotes?: string | null
}

const urgencyConfig: Record<string, { label: string; className: string }> = {
  EMERGENCY: {
    label: 'Emergency',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
  HIGH: {
    label: 'High',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  NORMAL: {
    label: 'Normal',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  LOW: {
    label: 'Low',
    className:
      'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
  },
}

const tradeConfig: Record<string, { label: string; className: string }> = {
  HVAC: {
    label: 'HVAC',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  REFRIGERATION: {
    label: 'Refrigeration',
    className:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  },
  PLUMBING: {
    label: 'Plumbing',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  ELECTRICAL: {
    label: 'Electrical',
    className:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  MULTI: {
    label: 'Multi-Trade',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  UNKNOWN: {
    label: 'Unknown',
    className:
      'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-300',
  },
}

interface AiJobTriageProps {
  result: TriageResult
  jobId?: string
  onApplyToJob?: (jobId: string, triage: TriageResult) => void
  applyLoading?: boolean
}

export function AiJobTriage({
  result,
  jobId,
  onApplyToJob,
  applyLoading,
}: AiJobTriageProps) {
  const urgency = urgencyConfig[result.urgency] ?? urgencyConfig.NORMAL
  const trade = tradeConfig[result.tradeClassification] ?? tradeConfig.UNKNOWN

  return (
    <div className="space-y-3">
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            urgency.className
          )}
        >
          <AlertTriangle className="size-3" />
          {urgency.label}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
            trade.className
          )}
        >
          <Wrench className="size-3" />
          {trade.label}
        </span>
      </div>

      {/* Summary */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <FileCheck className="size-4 text-muted-foreground" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {result.summary}
          </p>
        </CardContent>
      </Card>

      {/* Risk flags */}
      {result.riskFlags.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm text-destructive">
              <ShieldAlert className="size-4" />
              Risk Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {result.riskFlags.map((flag, i) => (
                <Badge key={i} variant="destructive">
                  {flag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safety notes */}
      {result.safetyNotes && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <p className="font-medium">Safety Note</p>
          <p className="mt-0.5">{result.safetyNotes}</p>
        </div>
      )}

      {/* Follow-up questions */}
      {result.followUpQuestions.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <CircleHelp className="size-4 text-muted-foreground" />
              Follow-Up Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
              {result.followUpQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Apply to job */}
      {jobId && onApplyToJob && (
        <Button
          className="w-full"
          onClick={() => onApplyToJob(jobId, result)}
          disabled={applyLoading}
        >
          {applyLoading ? 'Applying...' : 'Apply to Job'}
        </Button>
      )}
    </div>
  )
}
