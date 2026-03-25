'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { createHash, randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auth } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// ─── Create User ─────────────────────────────────────────────────────────────

export async function createUser(formData: FormData) {
  const session = await requireRole('ADMIN')

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  const role = (formData.get('role') as string) || 'TECHNICIAN'
  const phone = (formData.get('phone') as string)?.trim() || null
  const technicianId = (formData.get('technicianId') as string) || null

  if (!name || !email || !password) throw new Error('Name, email, and password are required')
  if (password.length < 8) throw new Error('Password must be at least 8 characters')
  if (!['ADMIN', 'DISPATCHER', 'TECHNICIAN'].includes(role)) throw new Error('Invalid role')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('A user with that email already exists')

  const passwordHash = await hash(password, 12)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: role as 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN',
      phone,
      active: true,
    },
  })

  // Link to technician profile if provided
  if (technicianId) {
    await prisma.technician.update({
      where: { id: technicianId },
      data: { userId: user.id },
    })
  }

  auditLog({
    action: 'tech.create',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: user.id,
    targetType: 'User',
    meta: { name, email, role },
  })

  revalidatePath('/settings/users')
  redirect('/settings/users')
}

// ─── Update User ─────────────────────────────────────────────────────────────

export async function updateUser(id: string, formData: FormData) {
  const session = await requireRole('ADMIN')

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new Error('User not found')

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = formData.get('role') as string
  const phone = (formData.get('phone') as string)?.trim() || null
  const technicianId = (formData.get('technicianId') as string) || null

  if (!name || !email) throw new Error('Name and email are required')
  if (!['ADMIN', 'DISPATCHER', 'TECHNICIAN'].includes(role)) throw new Error('Invalid role')

  // Can't demote yourself
  if (id === session.user.id && role !== 'ADMIN') {
    throw new Error('You cannot change your own role')
  }

  // Check email uniqueness (excluding self)
  const emailTaken = await prisma.user.findFirst({
    where: { email, id: { not: id } },
  })
  if (emailTaken) throw new Error('That email is already in use')

  await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role: role as 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN',
      phone,
    },
  })

  // Update technician link: unlink current user from any tech, then re-link
  await prisma.technician.updateMany({
    where: { userId: id },
    data: { userId: null },
  })
  if (technicianId) {
    await prisma.technician.update({
      where: { id: technicianId },
      data: { userId: id },
    })
  }

  auditLog({
    action: 'tech.update',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'User',
    meta: { name, email, role },
  })

  revalidatePath('/settings/users')
  revalidatePath(`/settings/users/${id}`)
}

// ─── Deactivate / Reactivate ─────────────────────────────────────────────────

export async function setUserActive(id: string, active: boolean) {
  const session = await requireRole('ADMIN')

  if (id === session.user.id) throw new Error('You cannot deactivate your own account')

  const existing = await prisma.user.findUnique({ where: { id } })
  if (!existing) throw new Error('User not found')

  await prisma.user.update({ where: { id }, data: { active } })

  auditLog({
    action: 'tech.update',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: id,
    targetType: 'User',
    meta: { active },
  })

  revalidatePath('/settings/users')
  revalidatePath(`/settings/users/${id}`)
}

// ─── Admin Password Reset ─────────────────────────────────────────────────────
// Generates a one-time reset token. Admin copies the link and sends to user.

export async function generatePasswordResetToken(userId: string): Promise<string> {
  await requireRole('ADMIN')

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) throw new Error('User not found')

  const rawToken = randomUUID()
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetToken: tokenHash,
      passwordResetExpiry: expiry,
    },
  })

  auditLog({
    action: 'auth.login',
    userId: userId,
    meta: { action: 'password_reset_generated' },
  })

  return rawToken
}

// ─── Apply Reset Token (public — no auth required) ───────────────────────────

export async function applyPasswordReset(token: string, newPassword: string) {
  if (!token || !newPassword) throw new Error('Token and new password are required')
  if (newPassword.length < 8) throw new Error('Password must be at least 8 characters')

  const tokenHash = createHash('sha256').update(token).digest('hex')

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: tokenHash,
      passwordResetExpiry: { gt: new Date() },
      active: true,
    },
  })

  if (!user) throw new Error('Invalid or expired reset link')

  const passwordHash = await hash(newPassword, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  })

  auditLog({
    action: 'auth.login',
    userId: user.id,
    meta: { action: 'password_reset_applied' },
  })
}

// ─── Admin Direct Password Set ───────────────────────────────────────────────

export async function adminSetPassword(userId: string, newPassword: string) {
  const session = await requireRole('ADMIN')

  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } })
  if (!existing) throw new Error('User not found')

  const passwordHash = await hash(newPassword, 12)

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  })

  auditLog({
    action: 'auth.login',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: userId,
    meta: { action: 'admin_set_password' },
  })

  revalidatePath(`/settings/users/${userId}`)
}

// ─── Check if current user is admin (for page-level guards) ──────────────────

export async function requireAdminSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/')
  }
  return session
}
