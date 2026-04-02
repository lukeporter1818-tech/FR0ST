/**
 * NextAuth edge-compatible middleware (Turbopack proxy pattern).
 *
 * Uses authConfig (no Prisma, no Node.js-only imports) so it runs safely in
 * the Edge runtime. The `authorized` callback in authConfig redirects
 * unauthenticated requests to /login for every route except the public auth
 * routes defined there (/login, /invite, /reset-password, /api/auth, /api/invite).
 */
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

export default NextAuth(authConfig).auth

export const config = {
  /*
   * Match all request paths EXCEPT static assets and PWA files that must be
   * publicly accessible without authentication.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|apple-icon\\.png|icon\\.png|.*\\.png$|.*\\.ico$|public).*)',
  ],
}
