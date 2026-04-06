/**
 * scripts/backfill-job-coords.ts
 *
 * One-time backfill: geocodes existing Job records that have a text address
 * but missing lat/lng. Safe to re-run — skips any job that already has coordinates.
 *
 * Uses the same geocodeAddress helper as the live app. No duplicate geocoder.
 * Respects Nominatim's 1 req/sec limit via a sequential loop with a 1.1s delay.
 *
 * Usage:
 *   npx tsx scripts/backfill-job-coords.ts
 *   npm run backfill-coords
 *
 * Output: scanned / geocoded / failed / skipped counts only.
 */

import 'dotenv/config'
import { Client } from 'pg'
import { geocodeAddress } from '../src/lib/geocode'

const DELAY_MS = 1100 // polite gap between Nominatim requests

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }

  const client = new Client({ connectionString })
  await client.connect()

  const { rows: jobs } = await client.query<{
    id: string
    address: string
    city: string | null
    state: string | null
    zip: string | null
  }>(`
    SELECT id, address, city, state, zip
    FROM "Job"
    WHERE (lat IS NULL OR lng IS NULL)
      AND address IS NOT NULL
      AND address != ''
    ORDER BY "createdAt" DESC
  `)

  const total = jobs.length

  if (total === 0) {
    console.log('Backfill: 0 jobs need coordinates — nothing to do.')
    await client.end()
    return
  }

  console.log(`Backfill: ${total} job(s) need coordinates. Starting...`)

  let geocoded = 0
  let failed   = 0
  let skipped  = 0

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]

    if (!job.address?.trim()) {
      skipped++
      continue
    }

    const coords = await geocodeAddress(job.address, job.city, job.state, job.zip)

    if (coords) {
      await client.query(
        'UPDATE "Job" SET lat = $1, lng = $2 WHERE id = $3',
        [coords.lat, coords.lng, job.id],
      )
      geocoded++
    } else {
      failed++
    }

    // Delay between requests except after the last one
    if (i < jobs.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log(
    `Backfill complete — scanned: ${total}, geocoded: ${geocoded}, failed: ${failed}, skipped: ${skipped}`,
  )

  await client.end()
}

main().catch((err) => {
  console.error('Backfill error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
