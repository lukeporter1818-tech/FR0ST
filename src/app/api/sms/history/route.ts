import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiSession, unauthorized, forbidden } from '@/lib/auth-guard'
import { hasRole } from '@/lib/auth-guard'

export async function GET(request: NextRequest) {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  const technicianId = request.nextUrl.searchParams.get('technicianId')

  if (!technicianId || technicianId.length > 100) {
    return NextResponse.json({ error: 'technicianId query param is required' }, { status: 400 })
  }

  // Technicians can only view their own SMS history
  if (!hasRole(session.user.role, 'DISPATCHER')) {
    if (session.user.technicianId !== technicianId) {
      return forbidden()
    }
  }

  const messages = await prisma.smsMessage.findMany({
    where: { technicianId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      direction: true,
      body: true,
      aiDrafted: true,
      status: true,
      sentAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json(messages)
}
