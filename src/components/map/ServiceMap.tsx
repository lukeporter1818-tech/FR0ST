'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

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

// ─── Icon cache ──────────────────────────────────────────────────────────────

const iconCache = new Map<string, L.DivIcon>()

function buildIcon(color: string, active: boolean): L.DivIcon {
  const key = `${color}:${active}`
  if (!iconCache.has(key)) {
    const size = active ? 16 : 13
    const half = size / 2
    iconCache.set(
      key,
      L.divIcon({
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 1px 6px rgba(0,0,0,.55)${active ? ';outline:3px solid ' + color + ';outline-offset:2px' : ''}"></div>`,
        className: '',
        iconSize:    [size, size],
        iconAnchor:  [half, half],
        popupAnchor: [0, -half - 4],
      }),
    )
  }
  return iconCache.get(key)!
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

// ─── Fly-to controller ───────────────────────────────────────────────────────

function FlyController({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 })
  }, [target, map])
  return null
}

// ─── Resize handler ──────────────────────────────────────────────────────────
// After the one-shot initial height is committed, this component keeps Leaflet
// in sync with any subsequent container size changes (window resize, layout
// shifts) by calling invalidateSize rather than recreating MapContainer.

function InvalidateSizeOnResize({ panelRef }: { panelRef: React.RefObject<HTMLDivElement | null> }) {
  const map = useMap()
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [map, panelRef])
  return null
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

// ─── Shared job list item ────────────────────────────────────────────────────

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

// ─── Map skeleton ────────────────────────────────────────────────────────────

function MapSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        <p className="mt-3 text-xs text-gray-500">Loading map…</p>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ServiceMap({
  jobs,
  unmappedCount,
}: {
  jobs: JobPin[]
  unmappedCount: number
}) {
  const [flyTarget,  setFlyTarget]  = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [flyKey,     setFlyKey]     = useState(0)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── One-shot pixel height for MapContainer ───────────────────────────────
  // height:'100%' on MapContainer resolves to 0 when the parent flex-height
  // isn't yet a CSS-definite value at Leaflet's init time.
  // Strategy: measure once (lock after first valid reading) so MapContainer
  // always gets real pixels on first mount. Subsequent resizes are handled
  // by InvalidateSizeOnResize inside the map rather than recreating it.
  const mapPanelRef  = useRef<HTMLDivElement>(null)
  const heightLocked = useRef(false)
  const [mapHeight,  setMapHeight]  = useState<number>(0)

  useEffect(() => {
    const el = mapPanelRef.current
    if (!el) return
    const tryMeasure = () => {
      if (heightLocked.current) return
      const h = el.getBoundingClientRect().height
      if (h > 0) {
        setMapHeight(h)
        heightLocked.current = true
      }
    }
    tryMeasure()
    const ro = new ResizeObserver(tryMeasure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const center: [number, number] = jobs.length > 0
    ? [jobs[0].lat, jobs[0].lng]
    : [39.5, -98.35]
  const zoom = jobs.length > 0 ? 12 : 4

  function handleListClick(job: JobPin) {
    const key = flyKey + 1
    setFlyKey(key)
    setFlyTarget({ lat: job.lat, lng: job.lng, key })
    setActiveId(job.id)
  }

  return (
    <div className="flex flex-col" style={{ height: '100%' }}>

      {/* ── Main body: sidebar (desktop) + map ── */}
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
                    onClick={() => handleListClick(job)}
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
        <div ref={mapPanelRef} className="relative flex-1 min-h-0">

          {mapHeight === 0 ? (
            <MapSkeleton />
          ) : (
            <MapContainer
              center={center}
              zoom={zoom}
              style={{ height: mapHeight, width: '100%' }}
              scrollWheelZoom
              zoomControl
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                maxZoom={19}
              />
              <FlyController target={flyTarget} />
              <InvalidateSizeOnResize panelRef={mapPanelRef} />
              {jobs.map((job) => (
                <Marker
                  key={job.id}
                  position={[job.lat, job.lng]}
                  icon={buildIcon(markerColor(job), job.id === activeId)}
                  eventHandlers={{ click: () => setActiveId(job.id) }}
                >
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>
                        {job.customerName}
                      </p>
                      <p style={{ fontSize: 11, color: '#888', margin: '0 0 8px' }}>
                        {job.address}
                        {job.city  ? `, ${job.city}`  : ''}
                        {job.state ? ` ${job.state}` : ''}
                      </p>
                      <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                        <tbody>
                          <tr>
                            <td style={{ color: '#aaa', paddingRight: 6, paddingBottom: 2 }}>Tech</td>
                            <td style={{ fontWeight: 500 }}>{job.assignedTech?.name ?? '—'}</td>
                          </tr>
                          <tr>
                            <td style={{ color: '#aaa', paddingRight: 6, paddingBottom: 2 }}>Status</td>
                            <td>
                              {job.scheduleEntry?.status
                                ? (SCHED_LABEL[job.scheduleEntry.status] ?? job.scheduleEntry.status)
                                : (JOB_STATUS_LABEL[job.status] ?? job.status)}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ color: '#aaa', paddingRight: 6 }}>Priority</td>
                            <td style={{ textTransform: 'capitalize' }}>{job.priority.toLowerCase()}</td>
                          </tr>
                        </tbody>
                      </table>
                      <a
                        href={`/jobs/${job.id}`}
                        style={{ display: 'inline-block', marginTop: 8, fontSize: 11, color: '#d97706' }}
                      >
                        View job →
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}

          {/* ── Mobile: floating Jobs pill button ── */}
          <div className="absolute bottom-6 left-1/2 z-[1000] -translate-x-1/2 md:hidden">
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
                className="absolute inset-0 z-[1001] bg-black/40 md:hidden"
                onClick={() => setDrawerOpen(false)}
              />
              <div className="absolute inset-x-0 bottom-0 z-[1002] flex max-h-[60%] flex-col rounded-t-2xl border-t border-white/10 bg-gray-950 md:hidden">
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
                            handleListClick(job)
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
