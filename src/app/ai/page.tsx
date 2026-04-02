import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AIAssistant } from '@/components/ai/AIAssistant'

export default async function AIPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return <AIAssistant />
}
