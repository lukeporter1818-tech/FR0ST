import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Called by a cron job or manually — deletes messages older than 90 days
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify secret to prevent unauthorized access
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (secret !== process.env.CLEANUP_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)

  const result = await prisma.chatMessage.deleteMany({
    where: { createdAt: { lt: cutoff } }
  })

  return NextResponse.json({ ok: true, deleted: result.count })
}
