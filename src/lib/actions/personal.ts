'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'

export interface PersonalLogData {
  id: string
  key: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  createdAt: string
}

export async function getPersonalLogs(userId: string, type: string): Promise<PersonalLogData[]> {
  const logs = await prisma.personalLog.findMany({
    where: { userId, type },
    orderBy: { key: 'desc' },
    take: 200,
    select: { id: true, key: true, data: true, createdAt: true },
  })
  return logs.map((l) => ({
    id: l.id,
    key: l.key,
    data: l.data,
    createdAt: l.createdAt.toISOString(),
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertPersonalLog(userId: string, type: string, key: string, data: Record<string, any>): Promise<void> {
  await prisma.personalLog.upsert({
    where: { userId_type_key: { userId, type, key } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: { data: data as any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: { userId, type, key, data: data as any },
  })
  revalidatePath('/personal')
}

export async function deletePersonalLog(userId: string, type: string, key: string): Promise<void> {
  await prisma.personalLog.deleteMany({
    where: { userId, type, key },
  })
  revalidatePath('/personal')
}
