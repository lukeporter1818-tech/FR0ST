import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { hasRole } from '@/lib/auth-guard'
import { ManagementLayout } from '@/components/management/ManagementLayout'
import type { ChatMessageData } from '@/components/chat/ChatMessage'
import type { TaskData } from '@/lib/actions/managementTasks'

export default async function ManagementPage() {
  const session = await auth()

  if (!session?.user?.id) redirect('/login')
  if (!hasRole(session.user.role, 'DISPATCHER')) redirect('/')

  // Run chat + users queries unconditionally; wrap tasks in try/catch so the
  // page doesn't 500 if the ManagementTask table hasn't been migrated yet.
  const [rawMessages, managementUsers] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { channel: 'management' },
      take: 100,
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'DISPATCHER'] }, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const rawTasks = await prisma.managementTask
    .findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy:  { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
    })
    .catch(() => null)  // null = table not yet migrated

  const messages: ChatMessageData[] = rawMessages.map((m) => ({
    id: m.id,
    userId: m.userId,
    userName: m.user.name,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }))

  const tasks: TaskData[] = rawTasks
    ? rawTasks.map((t) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        location: t.location,
        dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        status: t.status as TaskData['status'],
        createdById: t.createdById,
        createdByName: t.createdBy.name,
        assignedToId: t.assignedToId,
        assignedToName: t.assignedTo?.name ?? null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    : []

  return (
    <ManagementLayout
      messages={messages}
      tasks={tasks}
      tasksReady={rawTasks !== null}
      userId={session.user.id}
      userName={session.user.name ?? 'Unknown'}
      managementUsers={managementUsers}
    />
  )
}
