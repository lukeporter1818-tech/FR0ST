'use client'

import dynamic from 'next/dynamic'
import type { JobPin, StorePin, TechAssignment } from './ServiceMap'

function MapSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        <p className="mt-3 text-xs text-gray-500">Loading map…</p>
      </div>
    </div>
  )
}

// Leaflet needs the DOM — dynamic import with ssr:false must live in a
// Client Component. ServiceMap.tsx imports from 'leaflet' which accesses
// window/document at module evaluation time.
const ServiceMap = dynamic(() => import('./ServiceMap'), {
  ssr: false,
  loading: MapSkeleton,
})

export function MapLoader({
  jobs,
  unmappedCount,
  stores,
  techAssignments,
}: {
  jobs: JobPin[]
  unmappedCount: number
  stores: StorePin[]
  techAssignments: TechAssignment[]
}) {
  return <ServiceMap jobs={jobs} unmappedCount={unmappedCount} stores={stores} techAssignments={techAssignments} />
}
