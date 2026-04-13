'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

// Today's schedule assignment: a store code → tech initials pair.
// storeCode is normalized to UPPERCASE at the data layer.
export type TechAssignment = {
  storeCode: string  // e.g. "85", "SPF" — normalized to uppercase
  initials:  string  // e.g. "JD", "MK"
}

// A serviced store/location — appears as a teal diamond pin on the map.
// The `code` matches the schedule board's assignment abbreviation (e.g. WFM).
export type StorePin = {
  id: string
  code: string
  name: string
  address: string
  city: string | null
  state: string | null
  lat: number
  lng: number
  notes: string | null
}

// ─── Store icon ──────────────────────────────────────────────────────────────
// Teal diamond — visually distinct from circular pins.

const STORE_ICON = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#06b6d4;border:2px solid rgba(255,255,255,0.9);box-shadow:0 1px 6px rgba(0,0,0,.6);transform:rotate(45deg)"></div>`,
  className: '',
  iconSize:    [14, 14],
  iconAnchor:  [7, 7],
  popupAnchor: [0, -11],
})

function buildWholeFoodsIcon(code: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#00674B;color:#fff;font-size:9px;font-weight:800;letter-spacing:0.05em;padding:2px 5px;border-radius:6px;border:2px solid rgba(255,255,255,0.9);box-shadow:0 1px 6px rgba(0,0,0,.6);white-space:nowrap;">${code.toUpperCase()}</div>`,
    className: '',
    iconSize: undefined,
    iconAnchor: [20, 10],
    popupAnchor: [0, -14],
  })
}

// ─── Invalidate size on mount ────────────────────────────────────────────────
// The explicit dvh-calc height means Leaflet always initialises against a real
// dimension. This single rAF + 250ms pass is kept only as a belt-and-suspenders
// guard in case the browser hasn't committed the calc() result yet.

function MapReadyHandler() {
  const map = useMap()
  useEffect(() => {
    const raf = requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    const t   = setTimeout(() => map.invalidateSize({ pan: false }), 250)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [map])
  return null
}

// ─── Main component ──────────────────────────────────────────────────────────
// Height strategy: MapContainer receives an explicit calc(100dvh - TOP_BAR_H)
// height as an inline style. This has zero dependency on the flex chain above it.

const TOP_BAR_H = 64  // must match TopBar h-16

// Service region fallback: DC / Maryland / Virginia metro area
const SERVICE_CENTER: [number, number] = [38.9, -77.0]
const SERVICE_ZOOM = 9

export default function ServiceMap({
  stores,
  techAssignments,
}: {
  stores: StorePin[]
  techAssignments: TechAssignment[]
}) {
  // Fit all store pins into view. Fall back to the DC/MD/VA service region when none.
  const allPins = stores.map(s => [s.lat, s.lng] as [number, number])
  const mapBounds = allPins.length > 0 ? L.latLngBounds(allPins) : null
  const mapInit = mapBounds
    ? { bounds: mapBounds, boundsOptions: { padding: [48, 48] as [number, number], maxZoom: 14 } }
    : { center: SERVICE_CENTER, zoom: SERVICE_ZOOM }

  const mapHeight = `calc(100dvh - ${TOP_BAR_H}px)`

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-1 min-h-0">
        {/* ── Map panel ── */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <MapContainer
            {...mapInit}
            style={{ height: mapHeight, width: '100%' }}
            scrollWheelZoom
            zoomControl
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              maxZoom={19}
            />
            <MapReadyHandler />

            {/* ── Store pins (teal diamonds) + today's tech initials ── */}
            {stores.map((store) => {
              const assigned = techAssignments.filter(
                a => a.storeCode === store.code.toUpperCase()
              )
              const initialsLabel = assigned.map(a => a.initials).join(' · ')

              return (
                <Marker
                  key={store.id}
                  position={[store.lat, store.lng]}
                  icon={store.name.toLowerCase().includes('whole foods')
                    ? buildWholeFoodsIcon(store.code)
                    : STORE_ICON}
                >
                  {/* Permanent initials label — only shown when a tech is assigned today */}
                  {initialsLabel && (
                    <Tooltip permanent direction="top" offset={[0, -10]} opacity={1}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: '#0e7490' }}>
                        {initialsLabel}
                      </span>
                    </Tooltip>
                  )}
                  <Popup>
                    <div style={{ minWidth: 160 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ background: '#06b6d4', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>
                          {store.code}
                        </span>
                        <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{store.name}</p>
                      </div>
                      <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                        {store.address}
                        {store.city  ? `, ${store.city}`  : ''}
                        {store.state ? ` ${store.state}` : ''}
                      </p>
                      {initialsLabel && (
                        <p style={{ fontSize: 11, color: '#0e7490', marginTop: 6, fontWeight: 600 }}>
                          Today: {initialsLabel}
                        </p>
                      )}
                      {store.notes && (
                        <p style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{store.notes}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  )
}
