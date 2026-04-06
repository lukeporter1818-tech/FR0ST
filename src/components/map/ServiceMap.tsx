'use client'

import { useState } from 'react'

export type JobPin = {
  id: string
  customerName: string
  address: string
  city: string | null
  state: string | null
  priority: string
  status: string
  lat: number
  lng: number
  assignedTech: { name: string } | null
  scheduleEntry: { status: string } | null
}

// ─── US projection ────────────────────────────────────────────────────────────
// Equirectangular projection bounded to the continental US.

const W = 800
const H = 500
const LNG_MIN = -125.0
const LNG_MAX = -66.9
const LAT_MIN = 24.5
const LAT_MAX = 49.4

function project(lat: number, lng: number): [number, number] {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W
  const y = (1 - (lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * H
  return [x, y]
}

// ─── Approximate CONUS outline ────────────────────────────────────────────────
// Simplified polygon tracing the rough boundary of the lower-48 states.
// Coordinates are [lat, lng] pairs; projected at render time.

const CONUS: [number, number][] = [
  // Northwest coast → north border
  [48.5, -124.7], [49.0, -123.3], [49.0, -117.0], [49.0, -110.0],
  [49.0, -105.0], [49.0, -100.0], [49.0, -95.2],  [49.4, -95.2],
  // Great Lakes notch (rough)
  [48.0, -88.0],  [46.5, -84.5],  [45.0, -83.0],  [42.5, -82.7],
  // Northeast coast
  [45.0, -71.5],  [44.8, -66.9],
  // East coast south
  [41.3, -70.9],  [40.5, -74.0],  [38.9, -75.5],
  [37.0, -76.3],  [35.1, -75.5],  [34.0, -77.9],
  [32.0, -80.9],  [30.3, -81.4],  [29.9, -81.3],
  [25.8, -80.2],  [25.0, -80.9],  [25.6, -82.0],
  [28.7, -82.8],  [29.9, -85.0],  [30.0, -88.0],
  [29.0, -89.0],  [29.2, -90.2],  [29.7, -93.8],
  // Texas / Gulf
  [26.0, -97.2],  [25.9, -97.1],  [26.0, -98.0],
  [29.8, -100.0], [29.7, -103.3], [32.0, -106.6],
  [31.7, -106.5], [31.3, -111.0], [32.7, -117.1],
  // West coast north
  [33.0, -117.3], [34.4, -120.5], [37.8, -122.5],
  [38.0, -123.7], [40.8, -124.3], [42.0, -124.5],
  [46.2, -124.1], [48.5, -124.7],
]

function conusPath(): string {
  return CONUS.map(([lat, lng], i) => {
    const [x, y] = project(lat, lng)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

// ─── Marker color ────────────────────────────────────────────────────────────

function markerColor(job: JobPin): string {
  if (job.priority === 'EMERGENCY') return '#ef4444'
  const sched = job.scheduleEntry?.status
  if (sched === 'ON_SITE')  return '#f59e0b'
  if (sched === 'EN_ROUTE') return '#60a5fa'
  if (job.status === 'IN_PROGRESS') return '#f59e0b'
  if (job.status === 'SCHEDULED')   return '#818cf8'
  return '#6b7280'
}

// ─── Status labels ───────────────────────────────────────────────────────────

const SCHED_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  EN_ROUTE:  'En Route',
  ON_SITE:   'On Site',
  COMPLETED: 'Completed',
  SKIPPED:   'Skipped',
}

const JOB_STATUS_LABEL: Record<string, string> = {
  NEW:         'New',
  SCHEDULED:   'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED:   'Completed',
  ON_HOLD:     'On Hold',
  CANCELLED:   'Cancelled',
}

// ─── Job list item ────────────────────────────────────────────────────────────

function JobListItem({
  job,
  active,
  onClick,
}: {
  job: JobPin
  active: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
          active ? 'bg-white/[0.08]' : ''
        }`}
      >
        <p className="truncate text-xs font-medium text-gray-200">{job.customerName}</p>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {job.address}{job.city ? `, ${job.city}` : ''}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="inline-block size-2 shrink-0 rounded-full"
            style={{ backgroundColor: markerColor(job) }}
          />
          <span className="truncate text-[10px] text-gray-500">
            {job.assignedTech?.name ?? 'Unassigned'}
          </span>
        </div>
      </button>
    </li>
  )
}

// ─── Detail card ─────────────────────────────────────────────────────────────

function DetailCard({ job, onClose }: { job: JobPin; onClose: () => void }) {
  const statusLabel = job.scheduleEntry?.status
    ? (SCHED_LABEL[job.scheduleEntry.status] ?? job.scheduleEntry.status)
    : (JOB_STATUS_LABEL[job.status] ?? job.status)

  return (
    <div className="absolute bottom-3 left-1/2 z-10 w-56 -translate-x-1/2 rounded-xl border border-white/10 bg-gray-900/95 p-3 shadow-xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-gray-100 leading-snug">{job.customerName}</p>
        <button
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-gray-500 hover:text-gray-300"
          aria-label="Close"
        >
          <svg className="size-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M1 1l10 10M11 1L1 11" />
          </svg>
        </button>
      </div>
      <p className="mt-0.5 text-[10px] text-gray-500 leading-snug">
        {job.address}{job.city ? `, ${job.city}` : ''}{job.state ? ` ${job.state}` : ''}
      </p>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
        <span className="text-gray-500">Tech</span>
        <span className="text-gray-300">{job.assignedTech?.name ?? '—'}</span>
        <span className="text-gray-500">Status</span>
        <span className="text-gray-300">{statusLabel}</span>
        <span className="text-gray-500">Priority</span>
        <span className="text-gray-300 capitalize">{job.priority.toLowerCase()}</span>
      </div>
      <a
        href={`/jobs/${job.id}`}
        className="mt-2.5 inline-block text-[10px] text-amber-400 hover:text-amber-300"
      >
        View job →
      </a>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

const PATH = conusPath()

export default function ServiceMap({
  jobs,
  unmappedCount,
}: {
  jobs: JobPin[]
  unmappedCount: number
}) {
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const activeJob = jobs.find((j) => j.id === activeId) ?? null

  function handleSelect(job: JobPin) {
    setActiveId((prev) => (prev === job.id ? null : job.id))
  }

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>
      <div className="flex flex-1 min-h-0">

        {/* ── Desktop sidebar ── */}
        <div className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-white/10 bg-gray-950">
          <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {jobs.length} Active {jobs.length === 1 ? 'Job' : 'Jobs'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {jobs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-gray-500">No mapped jobs yet.</p>
                <p className="mt-1 text-xs text-gray-600">
                  New jobs geocode automatically when created.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-white/5">
                {jobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    active={activeId === job.id}
                    onClick={() => handleSelect(job)}
                  />
                ))}
              </ul>
            )}
          </div>

          {unmappedCount > 0 && (
            <div className="shrink-0 border-t border-white/10 px-3 py-2.5">
              <p className="text-[10px] leading-snug text-gray-600">
                {unmappedCount} active {unmappedCount === 1 ? 'job' : 'jobs'} could not be
                placed on the map — geocoding may have failed or the address is incomplete.
              </p>
            </div>
          )}
        </div>

        {/* ── Map panel ── */}
        <div className="relative flex-1 min-h-0 bg-gray-950">

          {/* SVG dot map */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Ocean / background */}
            <rect width={W} height={H} fill="#0b0f1a" />

            {/* CONUS land fill */}
            <path d={PATH} fill="#1a2035" stroke="#2d3a55" strokeWidth={1} />

            {/* Job dots */}
            {jobs.map((job) => {
              const [x, y] = project(job.lat, job.lng)
              const color  = markerColor(job)
              const isActive = job.id === activeId
              return (
                <g
                  key={job.id}
                  onClick={() => handleSelect(job)}
                  style={{ cursor: 'pointer' }}
                >
                  {isActive && (
                    <circle cx={x} cy={y} r={10} fill={color} opacity={0.25} />
                  )}
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 6 : 5}
                    fill={color}
                    stroke="rgba(255,255,255,0.75)"
                    strokeWidth={1.5}
                  />
                </g>
              )
            })}

            {/* Empty state text */}
            {jobs.length === 0 && (
              <text
                x={W / 2}
                y={H / 2}
                textAnchor="middle"
                fill="#4b5563"
                fontSize={14}
                fontFamily="system-ui, sans-serif"
              >
                No active jobs with coordinates yet
              </text>
            )}
          </svg>

          {/* Detail card for selected job */}
          {activeJob && (
            <DetailCard job={activeJob} onClose={() => setActiveId(null)} />
          )}

          {/* ── Mobile: floating pill button ── */}
          <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 md:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex items-center gap-2 rounded-full border border-white/15 bg-gray-900/90 px-4 py-2 text-xs font-medium text-gray-200 shadow-lg backdrop-blur-sm"
            >
              <span className="size-2 rounded-full bg-amber-400" />
              {jobs.length === 0
                ? 'No jobs mapped yet'
                : `${jobs.length} ${jobs.length === 1 ? 'Job' : 'Jobs'}`}
            </button>
          </div>

          {/* ── Mobile: bottom sheet drawer ── */}
          {drawerOpen && (
            <>
              <div
                className="absolute inset-0 z-20 bg-black/40 md:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[60%] flex-col rounded-t-2xl border-t border-white/10 bg-gray-950 md:hidden">
                <div className="flex shrink-0 justify-center pb-1 pt-2">
                  <div className="h-1 w-8 rounded-full bg-white/20" />
                </div>
                <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-2.5 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {jobs.length} Active {jobs.length === 1 ? 'Job' : 'Jobs'}
                    {unmappedCount > 0 && (
                      <span className="ml-2 font-normal normal-case text-gray-600">
                        · {unmappedCount} not mapped
                      </span>
                    )}
                  </p>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="rounded p-1 text-gray-500 hover:text-gray-300"
                    aria-label="Close"
                  >
                    <svg className="size-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M1 1l12 12M13 1L1 13" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {jobs.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-gray-500">No mapped jobs yet.</p>
                      <p className="mt-1 text-xs text-gray-600">
                        New jobs geocode automatically when created.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/5 pb-6">
                      {jobs.map((job) => (
                        <JobListItem
                          key={job.id}
                          job={job}
                          active={activeId === job.id}
                          onClick={() => {
                            handleSelect(job)
                            setDrawerOpen(false)
                          }}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
