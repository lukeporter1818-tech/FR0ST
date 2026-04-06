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

// ─── Marker colors ──────────────────────────────────────────────────────────

function markerColor(job: JobPin): string {
  if (job.priority === 'EMERGENCY') return '#ef4444'
  const sched = job.scheduleEntry?.status
  if (sched === 'ON_SITE') return '#f59e0b'
  if (sched === 'EN_ROUTE') return '#60a5fa'
  if (job.status === 'IN_PROGRESS') return '#f59e0b'
  if (job.status === 'SCHEDULED') return '#818cf8'
  return '#6b7280'
}

function buildIcon(color: string) {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.9);box-shadow:0 1px 6px rgba(0,0,0,.55)"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

// ─── Fly-to controller (must live inside MapContainer) ──────────────────────

function FlyController({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 })
  }, [target, map])
  return null
}

// ─── Status label helpers ────────────────────────────────────────────────────

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

export default function ServiceMap({ jobs }: { jobs: JobPin[] }) {
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [activeId, setActiveId]   = useState<string | null>(null)

  const center: [number, number] = jobs.length > 0
    ? [jobs[0].lat, jobs[0].lng]
    : [39.5, -98.35] // continental US fallback
  const zoom = jobs.length > 0 ? 12 : 4

  function handleListClick(job: JobPin) {
    setFlyTarget({ lat: job.lat, lng: job.lng })
    setActiveId(job.id)
  }

  return (
    <div className="flex h-full">

      {/* ── Job list panel ── */}
      <div className="w-60 shrink-0 overflow-y-auto border-r border-white/10 bg-gray-950">
        <div className="sticky top-0 z-10 px-3 py-2.5 border-b border-white/10 bg-gray-950">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            {jobs.length} Active {jobs.length === 1 ? 'Job' : 'Jobs'}
          </p>
        </div>

        {jobs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-500">No mapped jobs yet.</p>
            <p className="text-xs text-gray-600 mt-1">
              New jobs are geocoded automatically when created.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {jobs.map((job) => (
              <li key={job.id}>
                <button
                  onClick={() => handleListClick(job)}
                  className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-white/5 ${activeId === job.id ? 'bg-white/[0.08]' : ''}`}
                >
                  <p className="text-xs font-medium text-gray-200 truncate">{job.customerName}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {job.address}{job.city ? `, ${job.city}` : ''}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className="inline-block size-2 rounded-full shrink-0"
                      style={{ backgroundColor: markerColor(job) }}
                    />
                    <span className="text-[10px] text-gray-500 truncate">
                      {job.assignedTech?.name ?? 'Unassigned'}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Map ── */}
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={zoom}
          className="w-full h-full"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            maxZoom={19}
          />
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
                  <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>{job.customerName}</p>
                  <p style={{ fontSize: 11, color: '#555', margin: '0 0 8px' }}>
                    {job.address}{job.city ? `, ${job.city}` : ''}{job.state ? ` ${job.state}` : ''}
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
                            ? SCHED_LABEL[job.scheduleEntry.status] ?? job.scheduleEntry.status
                            : JOB_STATUS_LABEL[job.status] ?? job.status}
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
  )
}
