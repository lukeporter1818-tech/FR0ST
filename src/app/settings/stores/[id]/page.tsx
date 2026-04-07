import { redirect } from 'next/navigation'

export default async function OldEditStorePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/stores/${id}`)
}
