/**
 * Geocode a US address using two providers in sequence:
 *   1. Nominatim (OpenStreetMap) — structured query, zip-anchored
 *   2. Photon (Komoot / OSM)     — free-text fallback with street validation
 *
 * US postal city names often differ from OSM administrative boundary names
 * (e.g. "Capitol Heights" vs "Largo" for the same address). Using the zip
 * code as the geographic anchor is more reliable than city+state for US
 * street-level lookups — zip+street uniquely locates most addresses without
 * triggering OSM boundary mismatches.
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

  // ── 1. Nominatim (structured query — zip-anchored for US addresses) ────────
  // Prefer postalcode as the geographic scope; fall back to city+state when
  // no zip is provided. This avoids false-zero results when the postal city
  // name ("Capitol Heights") differs from the OSM admin boundary ("Largo").
  try {
    const params = new URLSearchParams({
      format:       'json',
      limit:        '1',
      street:       address,
      countrycodes: 'us',
    })
    if (zip) {
      params.set('postalcode', zip)
    } else {
      if (city)  params.set('city',  city)
      if (state) params.set('state', state)
    }

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
  // Fetch multiple candidates and validate that the returned street name
  // contains the primary keyword from the input address. This prevents
  // accepting a nearest-match on a completely different street (e.g. Photon
  // returning "Walker Mill Rd" when "Edgeworth Dr" was requested).
  try {
    const q = [address, city, state, zip].filter(Boolean).join(' ')

    // Extract the first meaningful word from the street address (skip house
    // number and short tokens) as a loose validation keyword.
    const streetKeyword = address
      .split(/\s+/)
      .find(w => w.length > 2 && !/^\d+$/.test(w))
      ?.toLowerCase()

    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`,
      {
        headers: { 'User-Agent': 'Frost-FieldCommand/1.0' },
        signal: AbortSignal.timeout(7000),
        cache:  'no-store',
      },
    )
    if (res.ok) {
      const data = await res.json() as {
        features?: Array<{
          geometry: { coordinates: [number, number] }
          properties: { street?: string; name?: string }
        }>
      }

      const features = data.features ?? []

      // Pick the first result whose street matches the input street keyword.
      // Without a keyword (very short address) accept the first result.
      const match = features.find((f) => {
        if (!streetKeyword) return true
        const returnedStreet = (
          f.properties.street ?? f.properties.name ?? ''
        ).toLowerCase()
        return returnedStreet.includes(streetKeyword)
      })

      if (match) {
        const [lng, lat] = match.geometry.coordinates   // GeoJSON is [lng, lat]
        if (!isNaN(lat) && !isNaN(lng)) {
          console.log(`[geocode] photon: ${label} → ${lat}, ${lng}`)
          return { lat, lng }
        }
      } else {
        console.warn(`[geocode] photon: no street-matching result for: ${label}`)
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
