import { createHash } from 'crypto'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  if (!token || typeof token !== 'string' || token.length > 200) {
    return Response.json({ error: 'Invalid link' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const user = await prisma.user.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { gt: new Date() },
      isActivated: false,
    },
    select: { name: true, email: true },
  })

  if (!user) {
    return Response.json({ error: 'Invalid or expired invite link' }, { status: 400 })
  }

  // Return display-safe info only — never return the token hash or internal fields
  const login = user.email.endsWith('@users.local')
    ? user.email.slice(0, -'@users.local'.length)
    : user.email

  return Response.json({ name: user.name, login })
}
