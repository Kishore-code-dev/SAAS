import type { GeofenceZone } from './workflowRules'

export type { GeofenceZone }

const GEOFENCE_STORAGE_PREFIX = 'dm_custom_geofences_v1_'

export const DEFAULT_GEOFENCE_ZONES: GeofenceZone[] = [
  {
    id: 'gf-chennai-hub',
    name: 'Chennai Ambattur Dispatch Hub',
    lat: 13.098,
    lng: 80.162,
    radiusMeters: 2200,
    color: '#6E5696',
    corridor: 'NH-48 / NH-44 Junction',
  },
  {
    id: 'gf-coimbatore-hub',
    name: 'Coimbatore Logistics Yard',
    lat: 11.0168,
    lng: 76.9558,
    radiusMeters: 2000,
    color: '#D8B442',
    corridor: 'NH-544 Freight Zone',
  },
  {
    id: 'gf-bengaluru-yard',
    name: 'Bengaluru Peenya EV Depot',
    lat: 13.0285,
    lng: 77.5197,
    radiusMeters: 1800,
    color: '#739570',
    corridor: 'Peenya Industrial Sector',
  },
]

export function loadCustomGeofences(orgId: string): GeofenceZone[] {
  try {
    const raw = localStorage.getItem(`${GEOFENCE_STORAGE_PREFIX}${orgId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as GeofenceZone[]) : []
  } catch {
    return []
  }
}

export function saveCustomGeofences(orgId: string, zones: GeofenceZone[]): void {
  try {
    localStorage.setItem(`${GEOFENCE_STORAGE_PREFIX}${orgId}`, JSON.stringify(zones))
  } catch {
    // ignore storage quota errors
  }
}
