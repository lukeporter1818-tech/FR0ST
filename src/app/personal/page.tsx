import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPersonalLogs } from '@/lib/actions/personal'
import { PersonalDashboard } from '@/components/personal/PersonalDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'PR0JECT33' }

export default async function PersonalPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/schedule')

  const userId = session.user.id

  const [tasks, workouts, nutrition, sleep, plans] = await Promise.all([
    getPersonalLogs(userId, 'task'),
    getPersonalLogs(userId, 'workout'),
    getPersonalLogs(userId, 'nutrition'),
    getPersonalLogs(userId, 'sleep'),
    getPersonalLogs(userId, 'plan'),
  ])

  return (
    <PersonalDashboard
      userId={userId}
      tasks={tasks}
      workouts={workouts}
      nutrition={nutrition}
      sleep={sleep}
      plans={plans}
    />
  )
}
