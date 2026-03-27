// Supplier directory used by Frost message rendering.
// phone: national / customer-service line (optional — omit if no reliable single number)
// mapsQuery: Google Maps search string for "near me" results
// onlineOnly: true → skip Directions (no physical locations to navigate to)

export interface SupplierInfo {
  phone?: string
  mapsQuery: string
  onlineOnly?: boolean
}

export const SUPPLIER_DIRECTORY: Record<string, SupplierInfo> = {
  'Johnstone Supply': {
    phone: '18885646846',
    mapsQuery: 'Johnstone+Supply+near+me',
  },
  'United Refrigeration': {
    phone: '18004235800',
    mapsQuery: 'United+Refrigeration+near+me',
  },
  // RSD is a regional distributor — no reliable single national line
  'RSD': {
    mapsQuery: 'RSD+refrigeration+distributor+near+me',
  },
  'Ferguson': {
    phone: '18003347376',
    mapsQuery: 'Ferguson+supply+near+me',
  },
  'Carrier Enterprise': {
    phone: '18004274328',
    mapsQuery: 'Carrier+Enterprise+near+me',
  },
  'Grainger': {
    phone: '18004724643', // 1-800-GRAINGER
    mapsQuery: 'Grainger+near+me',
  },
  'Graybar': {
    phone: '18004729227',
    mapsQuery: 'Graybar+near+me',
  },
  // Online-only retailer — no physical locations
  'SupplyHouse': {
    phone: '18887574774',
    mapsQuery: '',
    onlineOnly: true,
  },
  'SupplyHouse.com': {
    phone: '18887574774',
    mapsQuery: '',
    onlineOnly: true,
  },
}

/**
 * Look up a supplier by name.
 * Handles common suffixes like " (online)" that Frost may append.
 */
export function findSupplier(raw: string): SupplierInfo | null {
  const name = raw.trim()
  if (SUPPLIER_DIRECTORY[name]) return SUPPLIER_DIRECTORY[name]
  // Strip trailing parentheticals: "SupplyHouse (online)" → "SupplyHouse"
  const stripped = name.replace(/\s*\([^)]*\)$/, '').trim()
  return SUPPLIER_DIRECTORY[stripped] ?? null
}
