import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'
import { authConfig } from '@/lib/auth.config'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      technicianId: string | null
    }
  }
  interface JWT {
    id: string
    role: string
    technicianId: string | null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        let user
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
            include: { technician: { select: { id: true } } },
          })
          console.log('[AUTH] DB lookup:', user ? 'user found' : 'user NOT found', '| email:', credentials.email)
        } catch (err) {
          console.error('[AUTH] DB error during login:', err instanceof Error ? err.message : String(err))
          return null
        }

        if (!user) return null
        if (!user.active) {
          console.log('[AUTH] User inactive:', credentials.email)
          return null
        }

        const valid = await compare(credentials.password as string, user.passwordHash)
        console.log('[AUTH] Password compare:', valid ? 'PASS' : 'FAIL')
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          technicianId: user.technician?.id ?? null,
        }
      },
    }),
  ],
})
