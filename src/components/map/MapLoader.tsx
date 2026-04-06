'use client'

import dynamic from 'next/dynamic'
import type { JobPin } from './ServiceMap'

// Leaflet needs the DOM — dynamic import with ssr:false must live in a Client Component
const ServiceMap = dynamic(() => import('./ServiceMap'), { ssr: false })

export function MapLoader({ jobs }: { jobs: JobPin[] }) {
  return <ServiceMap jobs={jobs} />
}
