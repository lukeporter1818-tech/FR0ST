'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth-guard'
import { geocodeAddress } from '@/lib/geocode'

export async function deleteStore(id: string) {
  await requireRole('ADMIN')
  await prisma.store.delete({ where: { id } })
  revalidatePath('/stores')
  revalidatePath('/map')
  redirect('/stores')
}

function parseCode(raw: FormDataEntryValue | null): string {
  return (raw as string)?.trim().toUpperCase() ?? ''
}

export async function createStore(formData: FormData) {
  await requireRole('DISPATCHER')

  const code    = parseCode(formData.get('code'))
  const name    = (formData.get('name')    as string)?.trim()
  const address = (formData.get('address') as string)?.trim()
  const city    = (formData.get('city')    as string)?.trim() || null
  const state   = (formData.get('state')   as string)?.trim() || null
  const zip     = (formData.get('zip')     as string)?.trim() || null
  const notes   = (formData.get('notes')   as string)?.trim() || null

  if (!code || !name || !address) {
    throw new Error('Code, name, and address are required')
  }
  if (code.length < 2 || code.length > 5) {
    throw new Error('Code must be 2–5 characters')
  }

  const coords = await geocodeAddress(address, city, state, zip)

  try {
    await prisma.store.create({
      data: {
        code,
        name,
        address,
        city,
        state,
        zip,
        notes,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      },
    })
  } catch (err) {
    console.error('[createStore] failed:', err)
    redirect('/stores/new?error=failed')
  }

  revalidatePath('/stores')
  revalidatePath('/map')
  redirect('/stores')
}

export async function updateStore(formData: FormData) {
  await requireRole('DISPATCHER')

  const id      = formData.get('id') as string
  const code    = parseCode(formData.get('code'))
  const name    = (formData.get('name')    as string)?.trim()
  const address = (formData.get('address') as string)?.trim()
  const city    = (formData.get('city')    as string)?.trim() || null
  const state   = (formData.get('state')   as string)?.trim() || null
  const zip     = (formData.get('zip')     as string)?.trim() || null
  const notes   = (formData.get('notes')   as string)?.trim() || null

  if (!id || !code || !name || !address) {
    throw new Error('id, code, name, and address are required')
  }
  if (code.length < 2 || code.length > 5) {
    throw new Error('Code must be 2–5 characters')
  }

  // Re-geocode on every edit to pick up address changes
  const coords = await geocodeAddress(address, city, state, zip)

  try {
    await prisma.store.update({
      where: { id },
      data: {
        code,
        name,
        address,
        city,
        state,
        zip,
        notes,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      },
    })
  } catch (err) {
    console.error('[updateStore] failed:', err)
    redirect(`/stores/${id}?error=failed`)
  }

  revalidatePath('/stores')
  revalidatePath('/map')
  redirect('/stores')
}

export async function toggleStoreActive(id: string) {
  await requireRole('DISPATCHER')

  try {
    const store = await prisma.store.findUnique({ where: { id }, select: { active: true } })
    if (!store) return
    await prisma.store.update({ where: { id }, data: { active: !store.active } })
  } catch {
    return  // Store table missing — silently no-op; list page already shows safely
  }

  revalidatePath('/stores')
  revalidatePath('/map')
}
