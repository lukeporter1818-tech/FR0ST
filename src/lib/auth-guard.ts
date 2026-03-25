/**
 * Auth guard utilities for API routes and server actions.
 * Every API route and server action must call one of these before touching data.
 */

import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'

export type Role = 'ADMIN' | 'DISPATCHER' | 'TECHNICIAN'

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 3,
  DISPATCHER: 2,
  TECHNICIAN: 1,
}

export function hasRole(userRole: string, minRole: Role): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as Role] ?? 0
  const requiredLevel = ROLE_HIERARCHY[minRole]
  return userLevel >= requiredLevel
}

// ─── API Route Guards ────────────────────────────────────────────────────────
// Return NextResponse on failure so the caller can `return` it immediately.

export async function requireApiSession() {
  const session = await auth()
  if (!session?.user?.id) return null
  return session
}

export async function requireApiRole(minRole: Role) {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!hasRole(session.user.role, minRole)) return null
  return session
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function tooManyRequests() {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
}

// ─── Server Action Guards ────────────────────────────────────────────────────
// Throw or redirect on failure (server actions can't return Response).

export async function requireSession() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  return session
}

export async function requireRole(minRole: Role) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login')
  }
  if (!hasRole(session.user.role as Role, minRole)) {
    throw new Error('Forbidden: insufficient permissions')
  }
  return session
}
