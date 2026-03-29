import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    await requireRole('ADMIN')
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const techs = await prisma.technician.findMany({
    where: { userId: null, active: true },
    select: { id: true, name: true, tradeType: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(techs)
}
