import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hash } from 'bcryptjs'

export async function POST(req: Request) {
      try {
              const { token, password } = await req.json()
              if (!token || !password) {
                        return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
              }
              if (password.length < 8) {
                        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
              }

        const user = await prisma.user.findFirst({
                  where: {
                              resetToken: token,
                              resetTokenExpiry: { gt: new Date() },
                  },
        })

        if (!user) {
                  return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
        }

        const passwordHash = await hash(password, 12)

        await prisma.user.update({
                  where: { id: user.id },
                  data: {
                              passwordHash,
                              resetToken: null,
                              resetTokenExpiry: null,
                  },
        })

        return NextResponse.json({ success: true })
      } catch (err) {
              console.error('[reset-password]', err)
              return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
      }
}
