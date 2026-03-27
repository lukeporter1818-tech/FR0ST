import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ChatRoom } from '@/components/chat/ChatRoom'
import type { ChatMessageData } from '@/components/chat/ChatMessage'

export default async function TeamChatPage() {
  const [rawMessages, session] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { channel: 'general' },
      take: 100,
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { name: true },
        },
      },
    }),
    auth(),
  ])

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
        userId={session?.user?.id ?? ''}
        userName={session?.user?.name ?? 'Unknown'}
      />
    </div>
  )
}
