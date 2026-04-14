// Pings the server every 4 minutes to prevent Vercel cold starts.
// Called once from the AppShell on mount.
export function startKeepWarm() {
  if (typeof window === 'undefined') return
  const ping = () => fetch('/api/ping').catch(() => {})
  ping()
  setInterval(ping, 4 * 60 * 1000)
}
