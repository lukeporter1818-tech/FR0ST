import ServiceMap from './ServiceMap'
import type { JobPin } from './ServiceMap'

export function MapLoader({
  jobs,
  unmappedCount,
}: {
  jobs: JobPin[]
  unmappedCount: number
}) {
  return <ServiceMap jobs={jobs} unmappedCount={unmappedCount} />
}
