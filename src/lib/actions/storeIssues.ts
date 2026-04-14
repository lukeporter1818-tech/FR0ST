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

export async function getStoreIssues(storeCode: string, includeHistory = false) {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const store = await prisma.store.findUnique({
    where: { code: storeCode.toUpperCase() },
    include: {
      issueLog: {
        where: includeHistory ? {} : {
          resolvedAt: null,
          createdAt: { gte: ninetyDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: includeHistory ? 20 : 5,
        include: { reportedBy: { select: { name: true } } },
      },
    },
  })
  return store ?? null
}

export async function resolveStoreIssue(issueId: string) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not authenticated' }

  await prisma.storeIssueLog.update({
    where: { id: issueId },
    data: { resolvedAt: new Date() },
  })

  return { ok: true }
}

export async function resolveStoreIssueByDescription(storeCode: string, _description: string) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not authenticated' }

  const store = await prisma.store.findUnique({ where: { code: storeCode.toUpperCase() } })
  if (!store) return { ok: false, error: `Store ${storeCode} not found` }

  // Find the most recent unresolved issue at this store
  const issue = await prisma.storeIssueLog.findFirst({
    where: {
      storeId: store.id,
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!issue) return { ok: false, error: 'No active issues found at this store' }

  await prisma.storeIssueLog.update({
    where: { id: issue.id },
    data: { resolvedAt: new Date() },
  })

  return { ok: true, storeName: store.name }
}

export async function updateStoreEquipment(storeCode: string, equipment: string) {
  const session = await auth()
  if (!session?.user?.id) return { ok: false, error: 'Not authenticated' }

  const store = await prisma.store.findUnique({ where: { code: storeCode.toUpperCase() } })
  if (!store) return { ok: false, error: `Store ${storeCode} not found` }

  await prisma.store.update({
    where: { id: store.id },
    data: { equipment },
  })

  return { ok: true, storeName: store.name }
}
