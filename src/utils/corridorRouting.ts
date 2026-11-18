import type { LatLng } from '../types/fleet'

export interface CorridorWaypoint {
  marker: 'A' | 'B'
  role: 'Starting Location' | 'Destination'
  city: string
  landmark: string
  state: string
  lat: number
  lng: number
  elevationNote: string
}

export interface CorridorRouteData {
  origin: CorridorWaypoint
  destination: CorridorWaypoint
  points: LatLng[]
  distanceKm: number
  durationMinutes: number
  source: 'osrm' | 'nh544-fallback'
  corridorName: string
}

export const KOCHI_ORIGIN: CorridorWaypoint = {
  marker: 'A',
  role: 'Starting Location',
  city: 'Kochi',
  landmark: 'Fort Kochi – Chinese Fishing Nets',
  state: 'Kerala',
  lat: 9.9658,
  lng: 76.2421,
  elevationNote: 'Coastal logistics gateway · Arabian Sea',
}

export const COIMBATORE_DESTINATION: CorridorWaypoint = {
  marker: 'B',
  role: 'Destination',
  city: 'Coimbatore',
  landmark: 'Adiyogi – Isha Yoga Centre',
  state: 'Tamil Nadu',
  lat: 10.9770,
  lng: 76.7403,
  elevationNote: 'Velliangiri foothills · Western Ghats',
}

// Accurate NH-544 road-following waypoints between Fort Kochi and Adiyogi Coimbatore
// Used immediately on initial render and as a seamless fallback if external OSRM is unreachable.
export const KOCHI_COIMBATORE_ROAD_FALLBACK: LatLng[] = [
  { lat: 9.9658, lng: 76.2421 }, // Fort Kochi – Chinese Fishing Nets
  { lat: 9.9625, lng: 76.2654 }, // Mattancherry / Venduruthy Bridge
  { lat: 9.9675, lng: 76.2995 }, // Vyttila Mobility Hub
  { lat: 10.0261, lng: 76.3086 }, // Edappally NH-544 Junction
  { lat: 10.1004, lng: 76.3570 }, // Aluva
  { lat: 10.1960, lng: 76.3860 }, // Angamaly
  { lat: 10.3070, lng: 76.3340 }, // Chalakudy
  { lat: 10.4220, lng: 76.2880 }, // Puthukkad
  { lat: 10.5276, lng: 76.2673 }, // Thrissur Mannuthy Bypass
  { lat: 10.5880, lng: 76.3810 }, // Kuthiran Tunnel Corridor
  { lat: 10.5940, lng: 76.4890 }, // Vadakkencherry
  { lat: 10.6590, lng: 76.5780 }, // Alathur
  { lat: 10.7755, lng: 76.6548 }, // Palakkad Chandranagar Bypass
  { lat: 10.8350, lng: 76.8420 }, // Walayar Interstate Checkpost
  { lat: 10.9035, lng: 76.9255 }, // Madukkarai Bypass
  { lat: 10.9495, lng: 76.8980 }, // Sundakkamuthur / Perur Road
  { lat: 10.9610, lng: 76.8240 }, // Alanthurai Corridor
  { lat: 10.9770, lng: 76.7403 }, // Adiyogi – Isha Yoga Centre, Coimbatore
]

export const DEFAULT_KOCHI_COIMBATORE_ROUTE: CorridorRouteData = {
  origin: KOCHI_ORIGIN,
  destination: COIMBATORE_DESTINATION,
  points: KOCHI_COIMBATORE_ROAD_FALLBACK,
  distanceKm: 190,
  durationMinutes: 265,
  source: 'nh544-fallback',
  corridorName: 'NH-544 Western Ghats Freight Corridor',
}

export function formatTravelDuration(totalMinutes: number): string {
  const safeMins = Math.max(1, Math.round(totalMinutes))
  const hours = Math.floor(safeMins / 60)
  const mins = safeMins % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

interface OsrmRouteApiResponse {
  code?: string
  routes?: Array<{
    distance?: number
    duration?: number
    geometry?: {
      coordinates?: Array<[number, number]>
    }
  }>
}

export async function fetchCorridorDrivingRoute(
  origin: CorridorWaypoint = KOCHI_ORIGIN,
  destination: CorridorWaypoint = COIMBATORE_DESTINATION,
): Promise<CorridorRouteData> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 5000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return DEFAULT_KOCHI_COIMBATORE_ROUTE
    }
    const payload = (await res.json()) as OsrmRouteApiResponse
    const primary = payload?.routes?.[0]
    const coords = primary?.geometry?.coordinates
    if (
      payload?.code !== 'Ok' ||
      !Array.isArray(coords) ||
      coords.length < 2 ||
      typeof primary?.distance !== 'number' ||
      typeof primary?.duration !== 'number'
    ) {
      return DEFAULT_KOCHI_COIMBATORE_ROUTE
    }

    const points: LatLng[] = coords
      .filter((pair) => Array.isArray(pair) && pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
      .map(([lng, lat]) => ({ lat, lng }))

    if (points.length < 2) {
      return DEFAULT_KOCHI_COIMBATORE_ROUTE
    }

    return {
      origin,
      destination,
      points,
      distanceKm: Math.max(1, Math.round(primary.distance / 1000)),
      durationMinutes: Math.max(1, Math.round(primary.duration / 60)),
      source: 'osrm',
      corridorName: 'NH-544 Live Driving Route',
    }
  } catch {
    return DEFAULT_KOCHI_COIMBATORE_ROUTE
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}
