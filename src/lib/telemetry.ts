/**
 * Operational telemetry logging.
 *
 * Outputs structured JSON to stdout — captured by Vercel's log drain.
 * Filter in Vercel log explorer with: [TELEMETRY]
 *
 * Separate from audit.ts (security / compliance events).
 * This is product-signal only: which screens are used, where errors happen.
 *
 * NEVER log: passwords, secrets, message bodies, customer PII, full stack traces.
 */

export type TelemetryEvent =
  | 'page.view'        // user navigated to a core screen
  | 'error.client'     // React render error caught by ErrorBoundary
  | 'error.server'     // unexpected server/action error

interface TelemetryEntry {
  event: TelemetryEvent
  /** Core screen name (schedule | chat | management | frost) */
  screen?: string
  /** User role — never user ID */
  role?: string
  /** Error message — truncated, no PII */
  message?: string
  /** React component stack top frame — no PII */
  component?: string
  meta?: Record<string, string | number | boolean>
}

export function telemetryLog(entry: TelemetryEntry): void {
  const record = {
    ts: new Date().toISOString(),
    ...entry,
  }
  // [TELEMETRY] prefix lets you grep/filter separately from [AUDIT] and raw errors
  console.log('[TELEMETRY]', JSON.stringify(record))
}
