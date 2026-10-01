import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireApiRole, requireApiSession, unauthorized, forbidden } from '@/lib/auth-guard'

export async function GET() {
  const admin = await requireApiRole('ADMIN')
  if (!admin) {
    const anySession = await requireApiSession()
    return anySession ? forbidden() : unauthorized()
  }

  const docs = await prisma.knowledgeDoc.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      pageCount: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  })

  return NextResponse.json({
    docs: docs.map((d) => ({
      id: d.id,
      title: d.title,
      pageCount: d.pageCount,
      chunkCount: d._count.chunks,
      createdAt: d.createdAt,
    })),
  })
}
