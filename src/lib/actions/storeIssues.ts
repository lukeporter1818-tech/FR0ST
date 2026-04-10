'use server'

import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function logStoreIssue({
  storeCode,
  systemType,
  description,
  resolution,
}: {
  storeCode: string
  systemType: string
  description: string
  resolution?: string
}) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not authenticated' }

  const store = await prisma.store.findUnique({ where: { code: storeCode.toUpperCase() } })
  if (!store) return { ok: false, error: `Store ${storeCode} not found` }

  await prisma.storeIssueLog.create({
    data: {
      storeId: store.id,
      reportedById: session.user.id,
      systemType,
      description,
      resolution,
    },
  })

  return { ok: true, storeName: store.name }
}

export async function getStoreIssues(storeCode: string) {
  const store = await prisma.store.findUnique({
    where: { code: storeCode.toUpperCase() },
    include: {
      issueLog: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { reportedBy: { select: { name: true } } },
      },
    },
  })
  return store ?? null
}
