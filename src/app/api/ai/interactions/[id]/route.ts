import type { NextRequest } from 'next/server'
import { requireApiSession, requireApiRole, unauthorized, forbidden } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const patchSchema = z.object({
  feedback: z.enum(['helpful', 'not_helpful']).optional(),
  actualFix: z.string().trim().max(2000).optional(),
  issueSummary: z.string().trim().max(500).optional(),
  systemType: z.string().trim().max(100).optional(),
  approved: z.boolean().optional(),
})

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Auth first — require at minimum an authenticated session before parsing input
  const session = await requireApiSession()
  if (!session) return unauthorized()

  const { id } = await context.params

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = patchSchema.safeParse(raw)
  if (!result.success) {
    return Response.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { feedback, actualFix, issueSummary, systemType, approved } = result.data

  // Approval requires ADMIN — re-check for elevated role
  if (approved !== undefined) {
    const adminSession = await requireApiRole('ADMIN')
    if (!adminSession) return forbidden()

    await prisma.aIInteraction.update({
      where: { id },
      data: { approved },
    })
    return Response.json({ ok: true })
  }

  // Feedback/fix: session already verified above — just enforce ownership

  const interaction = await prisma.aIInteraction.findUnique({
    where: { id },
    select: { userId: true },
  })
  if (!interaction) return Response.json({ error: 'Not found' }, { status: 404 })
  if (interaction.userId !== session.user.id) return forbidden()

  await prisma.aIInteraction.update({
    where: { id },
    data: {
      ...(feedback !== undefined && { feedback }),
      ...(actualFix !== undefined && { actualFix }),
      ...(issueSummary !== undefined && { issueSummary }),
      ...(systemType !== undefined && { systemType }),
    },
  })

  return Response.json({ ok: true })
}
