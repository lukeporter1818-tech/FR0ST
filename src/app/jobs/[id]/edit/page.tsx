import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { EditJobForm } from '@/components/jobs/EditJobForm'

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [job, technicians] = await Promise.all([
    prisma.job.findUnique({
      where: { id },
    }),
    prisma.technician.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  if (!job) notFound()

  return (
    <EditJobForm
      job={{
        id: job.id,
        customerName: job.customerName,
        customerPhone: job.customerPhone ?? '',
        address: job.address,
        city: job.city ?? '',
        state: job.state ?? '',
        zip: job.zip ?? '',
        issueDescription: job.issueDescription,
        jobType: job.jobType,
        priority: job.priority,
        tradeClassification: job.tradeClassification ?? '',
        scheduledDate: job.scheduledDate
          ? job.scheduledDate.toISOString().split('T')[0]
          : '',
        timeWindow: job.timeWindow ?? '',
        assignedTechId: job.assignedTechId ?? '',
        dispatcherNotes: job.dispatcherNotes ?? '',
        internalNotes: job.internalNotes ?? '',
        tags: job.tags.join(', '),
      }}
      technicians={technicians.map((t) => ({ id: t.id, name: t.name }))}
    />
  )
}
