import type { LatLng, TelemetryFreshness, Trip, Vehicle } from '../types/fleet'
import { classifyTelemetryFreshness, isValidCoordinate } from './intelligenceEngine'

export interface GeofenceZone {
  id: string
  name: string
  corridorId: string
  center: LatLng
  radiusMeters: number
  kind: 'depot' | 'hub' | 'custom'
}

export const CORRIDOR_ANCHOR_LOCATIONS: Record<string, LatLng> = {
  'cor-chennai': { lat: 13.0674, lng: 80.2376 },
  'cor-coimbatore': { lat: 11.0168, lng: 76.9558 },
  'cor-madurai': { lat: 9.9392, lng: 78.1415 },
  'cor-salem': { lat: 11.6643, lng: 78.146 },
  'cor-trichy': { lat: 10.7905, lng: 78.7047 },
  'cor-bengaluru': { lat: 12.9352, lng: 77.6245 },
  'cor-vellore': { lat: 12.9165, lng: 79.1325 },
  'cor-erode': { lat: 11.341, lng: 77.7172 },
}

export const DEFAULT_GEOFENCE_ZONES: GeofenceZone[] = [
  {
    id: 'gf-chennai',
    name: 'Chennai Koyambedu-Guindy Hub',
    corridorId: 'cor-chennai',
    center: { lat: 13.062, lng: 80.235 },
    radiusMeters: 9500,
    kind: 'hub',
  },
  {
    id: 'gf-madurai',
    name: 'Madurai Mattuthavani Freight Yard',
    corridorId: 'cor-madurai',
    center: { lat: 9.9392, lng: 78.1415 },
    radiusMeters: 7000,
    kind: 'depot',
  },
  {
    id: 'gf-salem',
    name: 'Salem NH44 Logistics Park',
    corridorId: 'cor-salem',
    center: { lat: 11.6643, lng: 78.146 },
    radiusMeters: 7500,
    kind: 'hub',
  },
  {
    id: 'gf-coimbatore',
    name: 'Coimbatore Avinashi Freight Yard',
    corridorId: 'cor-coimbatore',
    center: { lat: 11.0168, lng: 76.9558 },
    radiusMeters: 8000,
    kind: 'depot',
  },
  {
    id: 'gf-trichy',
    name: 'Trichy Central Delta Bay',
    corridorId: 'cor-trichy',
    center: { lat: 10.7905, lng: 78.7047 },
    radiusMeters: 6500,
    kind: 'depot',
  },
  {
    id: 'gf-erode',
    name: 'Perundurai SIPCOT Yard',
    corridorId: 'cor-erode',
    center: { lat: 11.341, lng: 77.7172 },
    radiusMeters: 6500,
    kind: 'depot',
  },
  {
    id: 'gf-vellore',
    name: 'Katpadi EV Service Depot',
    corridorId: 'cor-vellore',
    center: { lat: 12.9165, lng: 79.1325 },
    radiusMeters: 6500,
    kind: 'depot',
  },
  {
    id: 'gf-bengaluru',
    name: 'Bengaluru Electronic City & Ring Hub',
    corridorId: 'cor-bengaluru',
    center: { lat: 12.89, lng: 77.642 },
    radiusMeters: 9500,
    kind: 'hub',
  },
]

export function getCorridorSeedLocation(corridorId: string, vehicleIndex = 0): LatLng {
  const base = CORRIDOR_ANCHOR_LOCATIONS[corridorId] ?? CORRIDOR_ANCHOR_LOCATIONS['cor-chennai']
  const angle = ((vehicleIndex * 73) % 360) * (Math.PI / 180)
  const offsetDeg = vehicleIndex === 0 ? 0 : 0.012 + (vehicleIndex % 3) * 0.006
  return {
    lat: Number((base.lat + Math.cos(angle) * offsetDeg).toFixed(5)),
    lng: Number((base.lng + Math.sin(angle) * offsetDeg).toFixed(5)),
  }
}

export function computeDistanceMeters(a: LatLng, b: LatLng): number {
  if (!isValidCoordinate(a.lat, a.lng) || !isValidCoordinate(b.lat, b.lng)) {
    return Number.POSITIVE_INFINITY
  }
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)))
}

export function findActiveGeofenceForLocation(
  location: LatLng,
  zones: GeofenceZone[],
): { zone: GeofenceZone; distanceMeters: number } | null {
  let closest: { zone: GeofenceZone; distanceMeters: number } | null = null
  for (const zone of zones) {
    const dist = computeDistanceMeters(location, zone.center)
    if (dist <= zone.radiusMeters && (!closest || dist < closest.distanceMeters)) {
      closest = { zone, distanceMeters: dist }
    }
  }
  return closest
}

export interface FleetBoundsSummary {
  bounds: [[number, number], [number, number]]
  center: [number, number]
  singlePointZoom: number
}

export function computeFleetBounds(locations: LatLng[]): FleetBoundsSummary {
  const valid = locations.filter((pt) => isValidCoordinate(pt.lat, pt.lng))
  if (valid.length === 0) {
    return {
      bounds: [
        [9.8, 76.8],
        [13.2, 80.4],
      ],
      center: [11.5, 78.6],
      singlePointZoom: 7,
    }
  }

  let minLat = valid[0].lat
  let maxLat = valid[0].lat
  let minLng = valid[0].lng
  let maxLng = valid[0].lng

  for (const pt of valid) {
    if (pt.lat < minLat) minLat = pt.lat
    if (pt.lat > maxLat) maxLat = pt.lat
    if (pt.lng < minLng) minLng = pt.lng
    if (pt.lng > maxLng) maxLng = pt.lng
  }

  const latSpan = maxLat - minLat
  const lngSpan = maxLng - minLng
  const padLat = Math.max(0.08, latSpan * 0.08)
  const padLng = Math.max(0.08, lngSpan * 0.08)

  return {
    bounds: [
      [minLat - padLat, minLng - padLng],
      [maxLat + padLat, maxLng + padLng],
    ],
    center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
    singlePointZoom: valid.length === 1 ? 11 : 7,
  }
}

export function interpolateRoutePoint(
  route: LatLng[],
  progressPct: number,
): { position: LatLng; headingDeg: number; segmentIndex: number } | null {
  const valid = route.filter((pt) => isValidCoordinate(pt.lat, pt.lng))
  if (valid.length === 0) return null
  if (valid.length === 1) {
    return { position: valid[0], headingDeg: 0, segmentIndex: 0 }
  }

  const clamped = Math.max(0, Math.min(100, progressPct))
  if (clamped === 0) {
    return {
      position: valid[0],
      headingDeg: computeBearing(valid[0], valid[1]),
      segmentIndex: 0,
    }
  }
  if (clamped === 100) {
    const last = valid.length - 1
    return {
      position: valid[last],
      headingDeg: computeBearing(valid[last - 1], valid[last]),
      segmentIndex: last - 1,
    }
  }

  const segmentLengths: number[] = []
  let totalLength = 0
  for (let i = 0; i < valid.length - 1; i += 1) {
    const len = Math.max(1, computeDistanceMeters(valid[i], valid[i + 1]))
    segmentLengths.push(len)
    totalLength += len
  }

  const targetDist = (clamped / 100) * totalLength
  let traversed = 0
  for (let i = 0; i < segmentLengths.length; i += 1) {
    const segLen = segmentLengths[i]
    if (traversed + segLen >= targetDist || i === segmentLengths.length - 1) {
      const ratio = Math.max(0, Math.min(1, (targetDist - traversed) / segLen))
      const start = valid[i]
      const end = valid[i + 1]
      return {
        position: {
          lat: Number((start.lat + (end.lat - start.lat) * ratio).toFixed(6)),
          lng: Number((start.lng + (end.lng - start.lng) * ratio).toFixed(6)),
        },
        headingDeg: computeBearing(start, end),
        segmentIndex: i,
      }
    }
    traversed += segLen
  }

  return { position: valid[0], headingDeg: 0, segmentIndex: 0 }
}

function computeBearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLng = toRad(b.lng - a.lng)
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat))
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng)
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360)
}

export interface FleetTrackingCounts {
  all: number
  moving: number
  idle: number
  stopped: number
  delayed: number
  maintenance: number
  offline: number
}

export function summarizeFleetTrackingStatuses(
  vehicles: Vehicle[],
  nowMs: number = Date.now(),
): FleetTrackingCounts {
  const counts: FleetTrackingCounts = {
    all: vehicles.length,
    moving: 0,
    idle: 0,
    stopped: 0,
    delayed: 0,
    maintenance: 0,
    offline: 0,
  }

  for (const v of vehicles) {
    const freshness: { freshness: TelemetryFreshness } = classifyTelemetryFreshness(
      v.telemetry.lastUpdatedAt,
      v.telemetry.connectionState,
      nowMs,
    )
    if (v.operationStatus === 'moving') counts.moving += 1
    else if (v.operationStatus === 'idle') counts.idle += 1
    else if (v.operationStatus === 'stopped') counts.stopped += 1
    else if (v.operationStatus === 'delayed') counts.delayed += 1
    else if (v.operationStatus === 'maintenance') counts.maintenance += 1

    if (v.operationStatus === 'offline' || freshness.freshness === 'offline') {
      counts.offline += 1
    }
  }
  return counts
}

export function estimateTripProgress(
  trip: Trip,
  vehicle?: Vehicle,
): { completionPct: number; etaMinutes: number | null } {
  if (trip.status === 'completed') {
    return { completionPct: 100, etaMinutes: 0 }
  }
  const plannedDistance = Math.max(trip.distanceKm * 1.35, 35)
  const completionPct = Math.max(12, Math.min(94, Math.round((trip.distanceKm / plannedDistance) * 100)))
  const remainingKm = Math.max(2, plannedDistance - trip.distanceKm)
  const effectiveSpeed = Math.max(18, vehicle?.telemetry.speedKmh || trip.avgSpeedKmh || 32)
  const etaMinutes = Math.round((remainingKm / effectiveSpeed) * 60)
  return { completionPct, etaMinutes }
}
