'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auditLog } from '@/lib/audit'

export async function createTechnician(formData: FormData) {
  const session = await requireRole('DISPATCHER')

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const status = (formData.get('status') as string) || 'ACTIVE'
  const tradeType = (formData.get('tradeType') as string)?.trim() || null
  const skillTagsRaw = formData.get('skillTags') as string | null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name || !phone) throw new Error('Name and phone are required')

  const skillTags = skillTagsRaw
    ? skillTagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
    : []

  const tech = await prisma.technician.create({
    data: {
      name,
      phone,
      status: status as 'ACTIVE' | 'OFF' | 'VACATION' | 'SICK',
      tradeType,
      skillTags,
      notes,
    },
  })

  auditLog({
    action: 'tech.create',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: tech.id,
    targetType: 'Technician',
    meta: { name: tech.name },
  })

  revalidatePath('/technicians')
  redirect('/technicians')
}

export async function updateTechnician(id: string, formData: FormData) {
  const session = await requireRole('DISPATCHER')

  const existing = await prisma.technician.findUnique({ where: { id } })
  if (!existing) throw new Error('Technician not found')

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  const status = (formData.get('status') as string) || 'ACTIVE'
  const tradeType = (formData.get('tradeType') as string)?.trim() || null
  const skillTagsRaw = formData.get('skillTags') as string | null
  const notes = (formData.get('notes') as string)?.trim() || null

  if (!name || !phone) throw new Error('Name and phone are required')

  const skillTags = skillTagsRaw
    ? skillTagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20)
    : []

  await prisma.technician.update({
    where: { id },
    data: {
      name,
      phone,
      status: status as 'ACTIVE' | 'OFF' | 'VACATION' | 'SICK',
      tradeType,
      skillTags,
      notes,
    },
  })

  auditLog({
    action: 'tech.update',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'Technician',
  })

  revalidatePath('/technicians')
  revalidatePath(`/technicians/${id}`)
  redirect(`/technicians/${id}`)
}

export async function deleteTechnician(id: string) {
  // Only admins can delete technicians
  const session = await requireRole('ADMIN')

  const existing = await prisma.technician.findUnique({ where: { id } })
  if (!existing) throw new Error('Technician not found')

  await prisma.technician.delete({ where: { id } })

  auditLog({
    action: 'tech.delete',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'Technician',
    meta: { name: existing.name },
  })

  revalidatePath('/technicians')
  redirect('/technicians')
}
