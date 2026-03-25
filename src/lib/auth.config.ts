import type { NextAuthConfig } from 'next-auth'

// Edge-compatible auth config — no Prisma, no Node.js-only imports.
// Used by middleware. Full auth.ts extends this with the Credentials provider.
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthRoute =
        nextUrl.pathname.startsWith('/login') ||
        nextUrl.pathname.startsWith('/api/auth') ||
        nextUrl.pathname.startsWith('/reset-password')

      if (isAuthRoute) return true
      if (!isLoggedIn) return Response.redirect(new URL('/login', nextUrl))
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.technicianId = (user as any).technicianId ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.technicianId = token.technicianId as string | null
      }
      return session
    },
  },
  providers: [],
}
