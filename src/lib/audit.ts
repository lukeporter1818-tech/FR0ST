/**
 * Audit logging for security-sensitive events.
 * Logs to console in structured JSON format (for log aggregators in prod).
 * Extend with DB writes for compliance requirements.
 */

export type AuditAction =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'board.save'
  | 'board.update_own_row'
  | 'board.assign_from_screenshot'
  | 'job.create'
  | 'job.update'
  | 'job.delete'
  | 'job.status_change'
  | 'tech.create'
  | 'tech.update'
  | 'tech.delete'
  | 'invite.send'
  | 'sms.send'
  | 'ai.query'
  | 'ai.triage_applied'
  | 'upload.received'
  | 'access.forbidden'

interface AuditEntry {
  action: AuditAction
  userId?: string
  userRole?: string
  targetId?: string
  targetType?: string
  meta?: Record<string, unknown>
  ip?: string
}

export function auditLog(entry: AuditEntry) {
  const record = {
    ts: new Date().toISOString(),
    ...entry,
  }
  // Structured log — pipe to your log aggregator (Datadog, Papertrail, etc.)
  console.log('[AUDIT]', JSON.stringify(record))
}
