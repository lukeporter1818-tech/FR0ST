import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-guard'
import { prisma } from '@/lib/db'
import { DispatchBoard } from '@/components/dispatch/DispatchBoard'
import type { TechData } from '@/components/dispatch/TechColumn'
import type { DispatchJobData } from '@/components/dispatch/DraggableJobCard'

function getTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const [session, params] = await Promise.all([auth(), searchParams])
  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/')
  const dateParam =
    typeof params.date === 'string' ? params.date : getTomorrow()
  const scheduleDate = new Date(dateParam + 'T00:00:00.000Z')

  // Fetch active technicians with their schedule entries for this date
  const technicians = await prisma.technician.findMany({
    where: { active: true, status: 'ACTIVE' },
    include: {
      scheduleEntries: {
        where: { date: scheduleDate },
        include: { job: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Fetch unassigned jobs: status NEW or no schedule entry, not completed/cancelled
  const unassignedJobs = await prisma.job.findMany({
    where: {
      status: { in: ['NEW', 'ON_HOLD'] },
      scheduleEntry: null,
    },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  })

  // Build data for the client component
  const techData: TechData[] = technicians.map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    tradeType: t.tradeType,
    status: t.status,
  }))

  const columns: Record<string, string[]> = {}
  const jobs: Record<string, DispatchJobData> = {}

  // Populate tech columns and jobs from schedule entries
  for (const tech of technicians) {
    columns[tech.id] = tech.scheduleEntries.map((entry) => entry.jobId)

    for (const entry of tech.scheduleEntries) {
      const job = entry.job
      jobs[job.id] = {
        id: job.id,
        customerName: job.customerName,
        address: job.address,
        city: job.city,
        issueDescription: job.issueDescription,
        priority: job.priority,
        tradeClassification: job.tradeClassification,
        timeWindow: job.timeWindow,
        customerPhone: job.customerPhone,
        scheduledDate: job.scheduledDate?.toISOString().split('T')[0] ?? null,
        notes: entry.notes ?? undefined,
      }
    }
  }

  // Populate unassigned jobs
  const unassignedIds = unassignedJobs.map((job) => {
    jobs[job.id] = {
      id: job.id,
      customerName: job.customerName,
      address: job.address,
      city: job.city,
      issueDescription: job.issueDescription,
      priority: job.priority,
      tradeClassification: job.tradeClassification,
      timeWindow: job.timeWindow,
      customerPhone: job.customerPhone,
      scheduledDate: job.scheduledDate?.toISOString().split('T')[0] ?? null,
    }
    return job.id
  })

  return (
    <div className="h-[calc(100dvh-3.5rem)]">
      <DispatchBoard
        date={dateParam}
        technicians={techData}
        initialColumns={columns}
        initialUnassigned={unassignedIds}
        jobs={jobs}
      />
    </div>
  )
}
