'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'
import { JobStatus, JobType, Priority, Trade } from '@/generated/prisma'

export async function createJob(formData: FormData) {
  const session = await requireRole('DISPATCHER')

  const customerName = (formData.get('customerName') as string)?.trim()
  const customerPhone = (formData.get('customerPhone') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim()
  const city = (formData.get('city') as string)?.trim() || null
  const state = (formData.get('state') as string)?.trim() || null
  const zip = (formData.get('zip') as string)?.trim() || null
  const issueDescription = (formData.get('issueDescription') as string)?.trim()
  const jobType = (formData.get('jobType') as JobType) || 'SERVICE'
  const priority = (formData.get('priority') as Priority) || 'NORMAL'
  const tradeClassification = (formData.get('tradeClassification') as Trade) || null
  const scheduledDateStr = formData.get('scheduledDate') as string | null
  const timeWindow = (formData.get('timeWindow') as string)?.trim() || null
  const assignedTechId = (formData.get('assignedTechId') as string) || null
  const dispatcherNotes = (formData.get('dispatcherNotes') as string)?.trim() || null
  const internalNotes = (formData.get('internalNotes') as string)?.trim() || null
  const tagsRaw = (formData.get('tags') as string) || ''

  if (!customerName || !address || !issueDescription) {
    throw new Error('customerName, address, and issueDescription are required')
  }

  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20)
  const scheduledDate = scheduledDateStr ? new Date(scheduledDateStr) : null
  const status: JobStatus = assignedTechId && scheduledDate ? 'SCHEDULED' : 'NEW'

  const job = await prisma.job.create({
    data: {
      customerName,
      customerPhone,
      address,
      city,
      state,
      zip,
      issueDescription,
      jobType,
      priority,
      tradeClassification,
      scheduledDate,
      timeWindow,
      assignedTechId,
      dispatcherNotes,
      internalNotes,
      tags,
      status,
    },
  })

  auditLog({
    action: 'job.create',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: job.id,
    targetType: 'Job',
    meta: { customerName, priority, status },
  })

  revalidatePath('/jobs')
  redirect(`/jobs/${job.id}`)
}

export async function updateJob(id: string, formData: FormData) {
  const session = await requireRole('DISPATCHER')

  // Verify the job exists
  const existing = await prisma.job.findUnique({ where: { id } })
  if (!existing) throw new Error('Job not found')

  const customerName = (formData.get('customerName') as string)?.trim()
  const customerPhone = (formData.get('customerPhone') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim()
  const city = (formData.get('city') as string)?.trim() || null
  const state = (formData.get('state') as string)?.trim() || null
  const zip = (formData.get('zip') as string)?.trim() || null
  const issueDescription = (formData.get('issueDescription') as string)?.trim()
  const jobType = (formData.get('jobType') as JobType) || 'SERVICE'
  const priority = (formData.get('priority') as Priority) || 'NORMAL'
  const tradeClassification = (formData.get('tradeClassification') as Trade) || null
  const scheduledDateStr = formData.get('scheduledDate') as string | null
  const timeWindow = (formData.get('timeWindow') as string)?.trim() || null
  const assignedTechId = (formData.get('assignedTechId') as string) || null
  const dispatcherNotes = (formData.get('dispatcherNotes') as string)?.trim() || null
  const internalNotes = (formData.get('internalNotes') as string)?.trim() || null
  const tagsRaw = (formData.get('tags') as string) || ''

  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20)
  const scheduledDate = scheduledDateStr ? new Date(scheduledDateStr) : null

  await prisma.job.update({
    where: { id },
    data: {
      customerName,
      customerPhone,
      address,
      city,
      state,
      zip,
      issueDescription,
      jobType,
      priority,
      tradeClassification,
      scheduledDate,
      timeWindow,
      assignedTechId,
      dispatcherNotes,
      internalNotes,
      tags,
    },
  })

  auditLog({
    action: 'job.update',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'Job',
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
}

export async function updateJobStatus(id: string, status: JobStatus) {
  const session = await requireRole('DISPATCHER')

  const existing = await prisma.job.findUnique({ where: { id } })
  if (!existing) throw new Error('Job not found')

  await prisma.job.update({ where: { id }, data: { status } })

  auditLog({
    action: 'job.status_change',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'Job',
    meta: { from: existing.status, to: status },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${id}`)
}

export async function assignJob(jobId: string, techId: string | null) {
  const session = await requireRole('DISPATCHER')

  const existing = await prisma.job.findUnique({ where: { id: jobId } })
  if (!existing) throw new Error('Job not found')

  await prisma.job.update({
    where: { id: jobId },
    data: {
      assignedTechId: techId,
      status: techId ? 'SCHEDULED' : 'NEW',
    },
  })

  auditLog({
    action: 'job.update',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: jobId,
    targetType: 'Job',
    meta: { assignedTechId: techId },
  })

  revalidatePath('/jobs')
  revalidatePath(`/jobs/${jobId}`)
}

export async function deleteJob(id: string) {
  // Only admins can delete jobs
  const session = await requireRole('ADMIN')

  const existing = await prisma.job.findUnique({ where: { id } })
  if (!existing) throw new Error('Job not found')

  await prisma.job.delete({ where: { id } })

  auditLog({
    action: 'job.delete',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'Job',
    meta: { customerName: existing.customerName },
  })

  revalidatePath('/jobs')
  redirect('/jobs')
}
