/**
 * Geocode a US address using Nominatim (OpenStreetMap).
 * Free, no API key required. Results are stored on the Job record —
 * never re-geocoded unless the address changes.
 *
 * Rate limit: 1 req/sec. Jobs are created one at a time by dispatchers,
 * so this constraint is never reached in practice.
 */
export async function geocodeAddress(
  address: string,
  city: string | null,
  state: string | null,
  zip: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const parts = [address, city, state, zip].filter(Boolean).join(', ')
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(parts)}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Frost-FieldCommand/1.0 (field service operations)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(9000),
      // Never cache at the fetch layer — we persist results ourselves
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`[geocode] Nominatim HTTP ${res.status} for: ${parts}`)
      return null
    }
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data?.length) {
      console.warn(`[geocode] No results for: ${parts}`)
      return null
    }
    const lat = parseFloat(data[0].lat)
    const lng = parseFloat(data[0].lon)
    if (isNaN(lat) || isNaN(lng)) return null
    console.log(`[geocode] ${parts} → ${lat}, ${lng}`)
    return { lat, lng }
  } catch (err) {
    // Geocoding failure is non-fatal — record is still created without coordinates
    console.error(`[geocode] fetch failed for: ${parts}`, err)
    return null
  }
}
