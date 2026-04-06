'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function createJobNote(jobId: string, body: string): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')

  const trimmed = body.trim()
  if (!trimmed) throw new Error('Note cannot be empty')
  if (trimmed.length > 2000) throw new Error('Note must be 2000 characters or fewer')

  await prisma.note.create({
    data: {
      entityType: 'job',
      entityId:   jobId,
      body:       trimmed,
      createdById: session.user.id,
    },
  })

  revalidatePath(`/jobs/${jobId}`)
}
