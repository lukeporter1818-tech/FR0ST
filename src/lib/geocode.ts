/**
 * Geocode a US address using two providers in sequence:
 *   1. Nominatim (OpenStreetMap) — free, no API key, structured query
 *   2. Photon (Komoot / OSM)     — free, no API key, cloud-friendly fallback
 *
 * Results are persisted on the Store/Job record and never re-fetched unless
 * the address changes. Both providers use OSM data so results are consistent.
 */
export async function geocodeAddress(
  address: string,
  city: string | null,
  state: string | null,
  zip: string | null,
): Promise<{ lat: number; lng: number } | null> {
  const label = [address, city, state, zip].filter(Boolean).join(', ')

  // ── 1. Nominatim (structured query — more reliable for US addresses) ────────
  try {
    const params = new URLSearchParams({
      format:       'json',
      limit:        '1',
      street:       address,
      countrycodes: 'us',
    })
    if (city)  params.set('city',       city)
    if (state) params.set('state',      state)
    if (zip)   params.set('postalcode', zip)

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'Frost-FieldCommand/1.0 (field service operations)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(7000),
        cache:  'no-store',
      },
    )
    if (res.ok) {
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (data?.length) {
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log(`[geocode] nominatim: ${label} → ${lat}, ${lng}`)
          return { lat, lng }
        }
      } else {
        console.warn(`[geocode] nominatim: no results for: ${label}`)
      }
    } else {
      console.warn(`[geocode] nominatim: HTTP ${res.status} for: ${label}`)
    }
  } catch (err) {
    console.warn(`[geocode] nominatim: fetch failed for: ${label}`, err)
  }

  // ── 2. Photon / Komoot fallback (cloud-friendly, OSM-backed) ───────────────
  try {
    const q = [address, city, state, zip].filter(Boolean).join(' ')
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=1`,
      {
        headers: { 'User-Agent': 'Frost-FieldCommand/1.0' },
        signal: AbortSignal.timeout(7000),
        cache:  'no-store',
      },
    )
    if (res.ok) {
      const data = await res.json() as { features?: Array<{ geometry: { coordinates: [number, number] } }> }
      const coords = data.features?.[0]?.geometry?.coordinates
      if (coords) {
        const [lng, lat] = coords   // GeoJSON is [lng, lat]
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log(`[geocode] photon: ${label} → ${lat}, ${lng}`)
          return { lat, lng }
        }
      } else {
        console.warn(`[geocode] photon: no results for: ${label}`)
      }
    } else {
      console.warn(`[geocode] photon: HTTP ${res.status} for: ${label}`)
    }
  } catch (err) {
    console.warn(`[geocode] photon: fetch failed for: ${label}`, err)
  }

  // Both providers failed — store saves without coordinates.
  // The 'Not geocoded' badge will appear on the Service Locations list.
  console.error(`[geocode] all providers failed for: ${label}`)
  return null
}
