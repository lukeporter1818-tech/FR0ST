import { BookOpen } from 'lucide-react'
import { prisma } from '@/lib/db'
import { requireAdminSession } from '@/lib/actions/users'
import { ManualUpload } from '@/components/manuals/ManualUpload'

export const dynamic = 'force-dynamic'

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function ManualsPage() {
  await requireAdminSession()

  const docs = await prisma.knowledgeDoc.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      pageCount: true,
      createdAt: true,
      _count: { select: { chunks: true } },
    },
  })

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-100">Manuals</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {docs.length} {docs.length === 1 ? 'manual' : 'manuals'} indexed
        </p>
      </div>

      {/* Upload */}
      <ManualUpload />

      {/* List */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Indexed manuals
        </p>

        {docs.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center">
            <BookOpen className="mx-auto size-6 text-gray-600" />
            <p className="mt-2 text-sm text-gray-500">No manuals uploaded yet.</p>
            <p className="mt-1 text-xs text-gray-600">
              Upload a PDF above to make it searchable in FR0ST.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-white/8 overflow-hidden rounded-xl border border-white/10 sm:hidden">
              {docs.map((d) => (
                <div key={d.id} className="space-y-1 px-4 py-3">
                  <p className="truncate font-medium text-gray-200">{d.title}</p>
                  <p className="text-xs text-gray-500">
                    {d.pageCount ?? '—'} pages · {d._count.chunks} chunks
                  </p>
                  <p className="text-xs text-gray-600">Uploaded {formatDate(d.createdAt)}</p>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-white/10 sm:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.03]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Title</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Pages</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Chunks</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2.5 font-medium text-gray-200">{d.title}</td>
                      <td className="px-4 py-2.5 text-gray-400">{d.pageCount ?? '—'}</td>
                      <td className="px-4 py-2.5 text-gray-400">{d._count.chunks}</td>
                      <td className="px-4 py-2.5 text-gray-500">{formatDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
