import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiSession, unauthorized, tooManyRequests } from '@/lib/auth-guard'
import { rateLimit, getClientIp, LIMITS } from '@/lib/rate-limit'
import { chatPostSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  const since = request.nextUrl.searchParams.get('since')

  // Basic sanity check on the `since` param to prevent injection
  if (since && (isNaN(Date.parse(since)) || since.length > 30)) {
    return NextResponse.json({ error: 'Invalid since parameter' }, { status: 400 })
  }

  const messages = await prisma.chatMessage.findMany({
    where: since ? { createdAt: { gt: new Date(since) } } : undefined,
    take: 100,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } },
  })

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      userName: m.user.name,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }))
  )
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  const ip = getClientIp(request)
  if (!rateLimit(`chat:${ip}`, LIMITS.CHAT_POST.limit, LIMITS.CHAT_POST.windowMs)) {
    return tooManyRequests()
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = chatPostSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { body: messageBody, channel } = result.data

  const message = await prisma.chatMessage.create({
    data: {
      userId: session.user.id,
      body: messageBody,
      channel,
    },
    include: { user: { select: { name: true } } },
  })

  auditLog({ action: 'ai.query', userId: session.user.id, meta: { channel } })

  return NextResponse.json(
    {
      id: message.id,
      userId: message.userId,
      userName: message.user.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    },
    { status: 201 }
  )
}
