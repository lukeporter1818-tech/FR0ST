import { createHash } from 'crypto'
import { hash } from 'bcryptjs'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { token, password } = body as { token?: unknown; password?: unknown }

  if (!token || typeof token !== 'string' || token.length > 200) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return Response.json({ error: 'Password is required' }, { status: 400 })
  }
  if (password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }
  if (password.length > 200) {
    return Response.json({ error: 'Password too long' }, { status: 400 })
  }

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const user = await prisma.user.findFirst({
    where: {
      inviteTokenHash: tokenHash,
      inviteExpiresAt: { gt: new Date() },
      isActivated: false,
    },
    select: { id: true },
  })

  if (!user) {
    return Response.json({ error: 'Invalid or expired invite link' }, { status: 400 })
  }

  const passwordHash = await hash(password, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      isActivated: true,
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  })

  return Response.json({ success: true })
}
