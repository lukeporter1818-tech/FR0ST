'use client'

import { useState, useMemo } from 'react'
import { MessageSquare, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatRoom } from '@/components/chat/ChatRoom'
import { TaskList } from '@/components/management/TaskList'
import type { ChatMessageData } from '@/components/chat/ChatMessage'
import type { TaskData } from '@/lib/actions/managementTasks'

type Tab = 'chat' | 'tasks'

interface ManagementLayoutProps {
  messages: ChatMessageData[]
  tasks: TaskData[]
  tasksReady?: boolean
  userId: string
  userName: string
  managementUsers: { id: string; name: string }[]
}

export function ManagementLayout({
  messages,
  tasks,
  tasksReady = true,
  userId,
  userName,
  managementUsers,
}: ManagementLayoutProps) {
  const [tab, setTab] = useState<Tab>('chat')

  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== 'DONE').length,
    [tasks]
  )

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-white/10 bg-gray-950 px-4">
        <TabButton
          active={tab === 'chat'}
          onClick={() => setTab('chat')}
          icon={<MessageSquare className="size-3.5" />}
          label="Chat"
        />
        <TabButton
          active={tab === 'tasks'}
          onClick={() => setTab('tasks')}
          icon={<ListTodo className="size-3.5" />}
          label="Tasks"
          badge={openCount > 0 ? openCount : undefined}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {/* Chat — always mounted so realtime subscription stays alive */}
        <div className={cn('h-full', tab !== 'chat' && 'hidden')}>
          <ChatRoom
            initialMessages={messages}
            userId={userId}
            userName={userName}
            channel="management"
          />
        </div>

        {/* Tasks — always mounted so local state is preserved */}
        <div className={cn('h-full overflow-y-auto px-6 py-5', tab !== 'tasks' && 'hidden')}>
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-100">Warehouse Tasks</h2>
              {openCount > 0 && (
                <span className="text-xs text-gray-500">{openCount} open</span>
              )}
            </div>
            {tasksReady ? (
              <TaskList
                initialTasks={tasks}
                currentUserId={userId}
                managementUsers={managementUsers}
              />
            ) : (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-300">
                Tasks table not yet available. Run the pending SQL migration in Supabase to enable this feature.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
        active
          ? 'border-amber-400 text-white'
          : 'border-transparent text-gray-500 hover:text-gray-300'
      )}
    >
      {icon}
      {label}
      {badge !== undefined && (
        <span className="ml-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-gray-900 text-[10px] font-bold">
          {badge}
        </span>
      )}
    </button>
  )
}
