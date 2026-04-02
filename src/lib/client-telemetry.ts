/**
 * Client-side telemetry helpers.
 *
 * Fire-and-forget: never throws, never blocks navigation, never affects UX.
 * Events are POSTed to /api/telemetry which logs them to Vercel stdout.
 *
 * Rules:
 * - No PII, no message bodies, no customer data.
 * - Deduplicates rapid same-screen page views (tab re-focuses, re-renders).
 * - Uses keepalive:true so the request completes even if the page navigates away.
 */

type ClientPayload =
  | { event: 'page.view'; screen: string }
  | { event: 'error.client'; message: string; component?: string }

// Simple in-memory dedup for page views — only track when the screen actually changes
let _lastScreen = ''

export function logPageView(screen: string): void {
  if (screen === _lastScreen) return
  _lastScreen = screen
  _send({ event: 'page.view', screen })
}

export function logClientError(message: string, component?: string): void {
  _send({
    event: 'error.client',
    // Truncate hard — never risk leaking a long error that contains user data
    message: message.slice(0, 200),
    component: component?.slice(0, 100),
  })
}

function _send(payload: ClientPayload): void {
  try {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      // keepalive ensures the browser completes the request even on page navigation
      keepalive: true,
    }).catch(() => {
      // Intentionally silent — telemetry failures must never surface to users
    })
  } catch {
    // Intentionally silent
  }
}
