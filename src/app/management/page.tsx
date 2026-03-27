import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-guard'
import { ChatRoom } from '@/components/chat/ChatRoom'
import type { ChatMessageData } from '@/components/chat/ChatMessage'

export default async function ManagementChatPage() {
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/')

  const rawMessages = await prisma.chatMessage.findMany({
    where: { channel: 'management' },
    take: 100,
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true } } },
  })

  const messages: ChatMessageData[] = rawMessages.map((m) => ({
    id: m.id,
    userId: m.userId,
    userName: m.user.name,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6">
      <ChatRoom
        initialMessages={messages}
        userId={session.user.id}
        userName={session.user.name ?? 'Unknown'}
        channel="management"
      />
    </div>
  )
}
