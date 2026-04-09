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
      canManageStores: boolean
    }
  }
  interface JWT {
    id: string
    role: string
    technicianId: string | null
    canManageStores: boolean
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

        const identifier = (credentials.email as string).toLowerCase().trim()
        const emailToLookup = identifier.includes('@') ? identifier : `${identifier}@users.local`

        const user = await prisma.user.findUnique({
          where: { email: emailToLookup },
          include: { technician: { select: { id: true } } },
        })

        if (!user) return null
        if (!user.active) return null
        if (!user.isActivated) return null  // invite not yet completed

        const valid = await compare(credentials.password as string, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          technicianId: user.technician?.id ?? null,
          canManageStores: user.canManageStores,
        }
      },
    }),
  ],
})
