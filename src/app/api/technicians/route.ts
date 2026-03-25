import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiSession, requireApiRole, unauthorized, forbidden } from '@/lib/auth-guard'
import { technicianCreateSchema } from '@/lib/validations'
import { auditLog } from '@/lib/audit'

export async function GET() {
  const session = await requireApiSession()
  if (!session) return unauthorized()

  const technicians = await prisma.technician.findMany({
    where: { active: true },
    include: {
      jobs: {
        where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
        select: { id: true, customerName: true, status: true, priority: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(technicians)
}

export async function POST(request: NextRequest) {
  // Only dispatchers and admins can create technicians
  const session = await requireApiRole('DISPATCHER')
  if (!session) return forbidden()

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = technicianCreateSchema.safeParse(raw)
  if (!result.success) {
    return NextResponse.json({ error: result.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const technician = await prisma.technician.create({ data: result.data })

  auditLog({
    action: 'tech.create',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: technician.id,
    targetType: 'Technician',
    meta: { name: technician.name },
  })

  return NextResponse.json(technician, { status: 201 })
}
