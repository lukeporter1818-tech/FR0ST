import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { requireAdminSession } from '@/lib/actions/users'
import { prisma } from '@/lib/db'
import { ApproveToggle } from '@/components/ai/ApproveToggle'

export default async function AIInteractionsPage() {
  await requireAdminSession()

  const interactions = await prisma.aIInteraction.findMany({
    where: { actionType: 'frost.chat' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      user: { select: { name: true } },
      prompt: true,
      response: true,
      feedback: true,
      issueSummary: true,
      actualFix: true,
      systemType: true,
      approved: true,
      createdAt: true,
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="size-4" />
          Settings
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Frost Learning Log</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {interactions.length} interaction{interactions.length !== 1 ? 's' : ''} · Approve entries to mark them for future training.
        </p>
      </div>

      {interactions.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          No Frost interactions logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {interactions.map((i) => (
            <div
              key={i.id}
              className={`rounded-xl border bg-white p-4 space-y-2 ${
                i.approved ? 'border-green-200' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-700">{i.user.name}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(i.createdAt).toLocaleDateString()} {new Date(i.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {i.feedback && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      i.feedback === 'helpful'
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {i.feedback === 'helpful' ? '👍 Helpful' : '👎 Not helpful'}
                    </span>
                  )}
                  {i.systemType && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                      {i.systemType}
                    </span>
                  )}
                </div>
                <ApproveToggle id={i.id} approved={i.approved} />
              </div>

              <div className="text-sm text-gray-900">
                <span className="font-medium text-gray-500">Q: </span>
                {i.prompt.length > 200 ? i.prompt.slice(0, 200) + '…' : i.prompt}
              </div>

              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-400">A: </span>
                {i.response.length > 300 ? i.response.slice(0, 300) + '…' : i.response}
              </div>

              {(i.issueSummary || i.actualFix) && (
                <div className="border-t border-gray-100 pt-2 space-y-1">
                  {i.issueSummary && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">Issue: </span>{i.issueSummary}
                    </p>
                  )}
                  {i.actualFix && (
                    <p className="text-xs text-gray-600">
                      <span className="font-medium text-green-600">Fix: </span>{i.actualFix}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
