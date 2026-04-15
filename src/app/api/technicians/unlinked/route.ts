import { NextResponse } from 'next/server'
import { requireApiRole } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'

export async function GET() {
  const session = await requireApiRole('DISPATCHER')
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const techs = await prisma.technician.findMany({
    where: {
      active: true,
      userId: null, // only techs not yet linked to a user account
    },
    select: { id: true, name: true, tradeType: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(techs)
}
