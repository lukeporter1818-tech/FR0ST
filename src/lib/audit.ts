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
  | 'board.add_tech'
  | 'board.remove_tech'
  | 'roster.add_tech'
  | 'roster.remove_tech'
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
  | 'chat.post'
  | 'chat.delete'
  | 'access.forbidden'
  | 'mgmt_task.create'
  | 'mgmt_task.update'
  | 'mgmt_task.delete'

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
