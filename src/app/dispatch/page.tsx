import { redirect } from 'next/navigation'

// Legacy route — the canonical scheduling surface is now /schedule.
// Redirect immediately so no user can reach the old dispatch board by direct URL.
export default function DispatchPage() {
  redirect('/schedule')
}
