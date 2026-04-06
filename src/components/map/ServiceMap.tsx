'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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
// Module-level cache: each unique color string gets one DivIcon instance.
// Prevents re-creating Leaflet objects on every React render cycle.

const iconCache = new Map<string, L.DivIcon>()

function buildIcon(color: string): L.DivIcon {
  if (!iconCache.has(color)) {
    iconCache.set(
      color,
      L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.85);box-shadow:0 1px 6px rgba(0,0,0,.55)"></div>`,
        className: '',
        iconSize:   [14, 14],
        iconAnchor: [7, 7],
        popupAnchor:[0, -10],
      }),
    )
  }
  return iconCache.get(color)!
}

// ─── Marker color logic ──────────────────────────────────────────────────────

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
  }, [target, map]) // target.key changing re-triggers even for the same lat/lng
  return null
}

// ─── Invalidate size on mount ────────────────────────────────────────────────
// Leaflet needs the container to have a resolved pixel height before it can
// render tiles. Calling invalidateSize() after a short delay ensures the
// flex/height chain has settled after the dynamic import resolves.

function InvalidateSizeOnMount() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 60)
    return () => clearTimeout(t)
  }, [map])
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

// ─── Main component ──────────────────────────────────────────────────────────

export default function ServiceMap({
  jobs,
  unmappedCount,
}: {
  jobs: JobPin[]
  unmappedCount: number
}) {
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [flyKey,    setFlyKey]    = useState(0)
  const [activeId,  setActiveId]  = useState<string | null>(null)

  const center: [number, number] = jobs.length > 0
    ? [jobs[0].lat, jobs[0].lng]
    : [39.5, -98.35] // continental US
  const zoom = jobs.length > 0 ? 12 : 4

  function handleListClick(job: JobPin) {
    const key = flyKey + 1
    setFlyKey(key)
    setFlyTarget({ lat: job.lat, lng: job.lng, key })
    setActiveId(job.id)
  }

  return (
    // Explicit height:100% in both class and style — belts-and-suspenders for
    // Leaflet which requires a resolved pixel height on its container.
    <div className="flex flex-col" style={{ height: '100%' }}>

      {/* ── Mobile-only banner (sidebar is hidden on small screens) ── */}
      <div className="flex md:hidden shrink-0 items-center gap-2 border-b border-white/10 bg-gray-950 px-3 py-2">
        {jobs.length === 0 ? (
          <span className="text-xs text-gray-500">No mapped jobs yet — new jobs geocode automatically.</span>
        ) : (
          <span className="text-xs text-gray-400">
            {jobs.length} active {jobs.length === 1 ? 'job' : 'jobs'} on map
            {unmappedCount > 0 && (
              <span className="text-gray-600"> · {unmappedCount} address{unmappedCount === 1 ? '' : 'es'} not yet mapped</span>
            )}
          </span>
        )}
      </div>

      {/* ── Main body: sidebar + map ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar (hidden on mobile) ── */}
        <div className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-white/10 bg-gray-950">

          {/* Header */}
          <div className="shrink-0 border-b border-white/10 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {jobs.length} Active {jobs.length === 1 ? 'Job' : 'Jobs'}
            </p>
          </div>

          {/* List */}
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
                  <li key={job.id}>
                    <button
                      onClick={() => handleListClick(job)}
                      className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
                        activeId === job.id ? 'bg-white/[0.08]' : ''
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
                ))}
              </ul>
            )}
          </div>

          {/* Unmapped jobs notice */}
          {unmappedCount > 0 && (
            <div className="shrink-0 border-t border-white/10 px-3 py-2.5">
              <p className="text-[10px] leading-snug text-gray-600">
                {unmappedCount} active {unmappedCount === 1 ? 'job' : 'jobs'} could not be placed on the map.
                Geocoding may have failed or the address is incomplete.
              </p>
            </div>
          )}
        </div>

        {/* ── Map ── */}
        <div className="relative flex-1 min-h-0" style={{ height: '100%' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            // Both class and inline style — Leaflet reads computed pixel height at init
            className="h-full w-full"
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={19}
            />
            <InvalidateSizeOnMount />
            <FlyController target={flyTarget} />
            {jobs.map((job) => (
              <Marker
                key={job.id}
                position={[job.lat, job.lng]}
                icon={buildIcon(markerColor(job))}
                eventHandlers={{ click: () => setActiveId(job.id) }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>
                      {job.customerName}
                    </p>
                    <p style={{ fontSize: 11, color: '#666', margin: '0 0 8px' }}>
                      {job.address}
                      {job.city  ? `, ${job.city}`  : ''}
                      {job.state ? ` ${job.state}` : ''}
                    </p>
                    <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                      <tbody>
                        <tr>
                          <td style={{ color: '#888', paddingRight: 6, paddingBottom: 2 }}>Tech</td>
                          <td style={{ fontWeight: 500 }}>{job.assignedTech?.name ?? '—'}</td>
                        </tr>
                        <tr>
                          <td style={{ color: '#888', paddingRight: 6, paddingBottom: 2 }}>Status</td>
                          <td>
                            {job.scheduleEntry?.status
                              ? (SCHED_LABEL[job.scheduleEntry.status] ?? job.scheduleEntry.status)
                              : (JOB_STATUS_LABEL[job.status] ?? job.status)}
                          </td>
                        </tr>
                        <tr>
                          <td style={{ color: '#888', paddingRight: 6 }}>Priority</td>
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
        </div>
      </div>
    </div>
  )
}
