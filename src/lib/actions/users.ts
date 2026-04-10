'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { createHash, randomBytes, randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { auth } from '@/lib/auth'
import { auditLog } from '@/lib/audit'

// ─── Invite token helpers ────────────────────────────────────────────────────

function generateInviteToken(): { raw: string; tokenHash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(raw).digest('hex')
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  return { raw, tokenHash, expiresAt }
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  )
}

// ─── Create User with Invite Link ────────────────────────────────────────────

export async function createUserWithInvite(formData: FormData): Promise<{ inviteUrl: string; userName: string }> {
  const session = await requireRole('ADMIN')

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = (formData.get('role') as string) || 'TECHNICIAN'
  const phone = (formData.get('phone') as string)?.trim() || null
  const technicianId = (formData.get('technicianId') as string) || null

  if (!name || !email) throw new Error('Name and email are required')
  if (!['ADMIN', 'DISPATCHER', 'TECHNICIAN'].includes(role)) throw new Error('Invalid role')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('A user with that email already exists')

  const { raw, tokenHash, expiresAt } = generateInviteToken()
  // Placeholder hash — cannot be used to log in (account inactive until activated)
  const placeholderHash = await hash(randomBytes(32).toString('hex'), 12)

  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash: placeholderHash,
        role: role as 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN',
        phone,
        active: true,
        isActivated: false,
        inviteTokenHash: tokenHash,
        inviteExpiresAt: expiresAt,
      },
      select: { id: true },
    })

    if (technicianId) {
      // Link to an existing unlinked technician profile
      await tx.technician.update({
        where: { id: technicianId },
        data: { userId: user.id },
      })
    } else if (role === 'TECHNICIAN') {
      // Auto-create a technician profile for new technician accounts
      await tx.technician.create({
        data: {
          userId: user.id,
          name,
          phone: phone ?? '',
          status: 'ACTIVE',
          active: true,
        },
      })
    }

    return user
  })

  auditLog({
    action: 'invite.send',
    userId: session.user.id,
    userRole: session.user.role,
    targetId: user.id,
    targetType: 'User',
    meta: { name, email, role },
  })

  revalidatePath('/settings/users')
  return { inviteUrl: `${getAppUrl()}/invite/${raw}`, userName: name }
}

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

  // Hash before opening the transaction — CPU-only work, no DB round trip.
  const passwordHash = await hash(password, 12)

  // Atomic: user row and technician link either both commit or both roll back.
  // Matches the reliability level of createUserWithInvite.
  const user = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: role as 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN',
        phone,
        active: true,
      },
      select: { id: true },
    })

    if (technicianId) {
      await tx.technician.update({
        where: { id: technicianId },
        data: { userId: user.id },
      })
    }

    return user
  })

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

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
  if (!existing) throw new Error('User not found')

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const role = formData.get('role') as string
  const phone = (formData.get('phone') as string)?.trim() || null
  const technicianId = (formData.get('technicianId') as string) || null
  // Checkbox inputs are absent from FormData when unchecked, present when checked
  const canManageStores = formData.get('canManageStores') === 'on'

  if (!name || !email) throw new Error('Name and email are required')
  if (!['ADMIN', 'DISPATCHER', 'TECHNICIAN'].includes(role)) throw new Error('Invalid role')

  // Can't demote yourself
  if (id === session.user.id && role !== 'ADMIN') {
    throw new Error('You cannot change your own role')
  }

  // Check email uniqueness (excluding self)
  const emailTaken = await prisma.user.findFirst({
    where: { email, id: { not: id } },
    select: { id: true },
  })
  if (emailTaken) throw new Error('That email is already in use')

  await prisma.user.update({
    where: { id },
    data: {
      name,
      email,
      role: role as 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN',
      phone,
      canManageStores,
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

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true } })
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

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
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

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
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

// ─── Delete User + Technician ────────────────────────────────────────────────
// Full hard delete. FK resolution order:
//   1. Nullify optional Technician FKs (Job.assignedTechId, SmsMessage.technicianId)
//   2. Delete required-FK Technician children (BoardEntry, ScheduleEntry)
//   3. Delete Technician
//   4. Delete required-FK User children (ChatMessage, Note, AIInteraction)
//   5. Delete User

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole('ADMIN')

  if (id === session.user.id) {
    return { success: false, error: 'You cannot delete your own account' }
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { name: true, email: true, technician: { select: { id: true } } },
  })
  if (!existing) return { success: false, error: 'User not found' }

  try {
    await prisma.$transaction(async (tx) => {
      if (existing.technician) {
        const techId = existing.technician.id
        await tx.job.updateMany({ where: { assignedTechId: techId }, data: { assignedTechId: null } })
        await tx.smsMessage.updateMany({ where: { technicianId: techId }, data: { technicianId: null } })
        await tx.boardEntry.deleteMany({ where: { technicianId: techId } })
        await tx.scheduleEntry.deleteMany({ where: { technicianId: techId } })
        await tx.technician.delete({ where: { id: techId } })
      }
      await tx.chatMessage.deleteMany({ where: { userId: id } })
      await tx.note.deleteMany({ where: { createdById: id } })
      await tx.aIInteraction.deleteMany({ where: { userId: id } })
      await tx.user.delete({ where: { id } })
    })

    auditLog({
      action: 'tech.delete',
      userId: session.user.id,
      userRole: session.user.role,
      targetId: id,
      targetType: 'User',
      meta: { name: existing.name, email: existing.email },
    })

    revalidatePath('/settings/users')
    return { success: true }
  } catch (err) {
    console.error('[deleteUser] Error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Delete failed' }
  }
}

// ─── Check if current user is admin (for page-level guards) ──────────────────

export async function requireAdminSession() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/')
  }
  return session
}
