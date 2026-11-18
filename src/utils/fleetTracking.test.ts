import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSeedDataset } from '../data/seedOrganizations'
import {
  computeDistanceMeters,
  computeFleetBounds,
  DEFAULT_GEOFENCE_ZONES,
  estimateTripProgress,
  findActiveGeofenceForLocation,
  getCorridorSeedLocation,
  interpolateRoutePoint,
  summarizeFleetTrackingStatuses,
} from './fleetTracking'

test('computeFleetBounds encompasses every vehicle across Tamil Nadu corridors', () => {
  const seed = buildSeedDataset('production', Date.parse('2026-11-16T10:00:00Z'))
  const kaveriVehicles = seed.vehicles.filter((v) => v.organizationId === 'org-kaveri')
  assert.equal(kaveriVehicles.length, 8)

  const summary = computeFleetBounds(kaveriVehicles.map((v) => v.telemetry.location))
  const [[minLat, minLng], [maxLat, maxLng]] = summary.bounds

  for (const v of kaveriVehicles) {
    assert.ok(v.telemetry.location.lat >= minLat && v.telemetry.location.lat <= maxLat)
    assert.ok(v.telemetry.location.lng >= minLng && v.telemetry.location.lng <= maxLng)
  }
  // Ensure Madurai (9.93) and Chennai (13.08) span is preserved cleanly
  assert.ok(maxLat - minLat > 3.0)
  assert.ok(maxLng - minLng > 3.0)
})

test('computeFleetBounds handles single vehicle and empty vehicle lists safely', () => {
  const empty = computeFleetBounds([])
  assert.equal(empty.singlePointZoom, 7)

  const single = computeFleetBounds([{ lat: 13.0418, lng: 80.2341 }])
  assert.equal(single.singlePointZoom, 11)
  assert.ok(single.bounds[1][0] > single.bounds[0][0])
  assert.ok(single.bounds[1][1] > single.bounds[0][1])
})

test('getCorridorSeedLocation places newly registered vehicles in their selected corridor', () => {
  const madurai = getCorridorSeedLocation('cor-madurai', 0)
  const coimbatore = getCorridorSeedLocation('cor-coimbatore', 2)
  assert.ok(Math.abs(madurai.lat - 9.9392) < 0.05)
  assert.ok(Math.abs(coimbatore.lat - 11.0168) < 0.05)
  assert.notEqual(madurai.lat, coimbatore.lat)
})

test('findActiveGeofenceForLocation detects depot perimeter membership accurately', () => {
  const insideChennai = findActiveGeofenceForLocation({ lat: 13.0674, lng: 80.2376 }, DEFAULT_GEOFENCE_ZONES)
  assert.ok(insideChennai)
  assert.equal(insideChennai.zone.corridorId, 'cor-chennai')

  const midHighway = findActiveGeofenceForLocation({ lat: 12.126, lng: 78.157 }, DEFAULT_GEOFENCE_ZONES)
  assert.equal(midHighway, null)

  assert.ok(computeDistanceMeters({ lat: 13.0, lng: 80.2 }, { lat: 13.0, lng: 80.2 }) === 0)
})

test('interpolateRoutePoint smoothly interpolates route coordinates and headings for playback', () => {
  const route = [
    { lat: 13.0, lng: 80.0 },
    { lat: 13.1, lng: 80.1 },
    { lat: 13.2, lng: 80.2 },
  ]
  const start = interpolateRoutePoint(route, 0)
  const mid = interpolateRoutePoint(route, 50)
  const end = interpolateRoutePoint(route, 100)

  assert.ok(start && mid && end)
  assert.equal(start.position.lat, 13.0)
  assert.ok(Math.abs(mid.position.lat - 13.1) < 0.005)
  assert.equal(end.position.lat, 13.2)
  assert.ok(mid.headingDeg > 0 && mid.headingDeg < 90)
})

test('summarizeFleetTrackingStatuses counts every operational bucket accurately', () => {
  const refNow = Date.parse('2026-11-16T10:00:00Z')
  const seed = buildSeedDataset('production', refNow)
  const kaveriVehicles = seed.vehicles.filter((v) => v.organizationId === 'org-kaveri')
  const counts = summarizeFleetTrackingStatuses(kaveriVehicles, refNow)

  assert.equal(counts.all, 8)
  assert.equal(counts.moving, 3)
  assert.equal(counts.idle, 1)
  assert.equal(counts.stopped, 1)
  assert.equal(counts.delayed, 1)
  assert.equal(counts.maintenance, 1)
  assert.equal(counts.offline, 1)

  const kaveriTrip = seed.trips.find((t) => t.id === 't-k1')!
  const prog = estimateTripProgress(kaveriTrip, kaveriVehicles[0])
  assert.ok(prog.completionPct > 0 && prog.completionPct <= 100)
  assert.ok((prog.etaMinutes ?? 0) > 0)
})
