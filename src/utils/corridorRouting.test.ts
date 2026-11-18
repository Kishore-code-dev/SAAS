import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COIMBATORE_DESTINATION,
  DEFAULT_KOCHI_COIMBATORE_ROUTE,
  formatTravelDuration,
  KOCHI_COIMBATORE_ROAD_FALLBACK,
  KOCHI_ORIGIN,
} from './corridorRouting'
import { interpolateRoutePoint } from './fleetTracking'

test('Kochi to Coimbatore corridor metadata and fallback road geometry match specification', () => {
  assert.equal(KOCHI_ORIGIN.marker, 'A')
  assert.equal(KOCHI_ORIGIN.city, 'Kochi')
  assert.equal(KOCHI_ORIGIN.landmark, 'Fort Kochi – Chinese Fishing Nets')
  assert.equal(KOCHI_ORIGIN.state, 'Kerala')

  assert.equal(COIMBATORE_DESTINATION.marker, 'B')
  assert.equal(COIMBATORE_DESTINATION.city, 'Coimbatore')
  assert.equal(COIMBATORE_DESTINATION.landmark, 'Adiyogi – Isha Yoga Centre')
  assert.equal(COIMBATORE_DESTINATION.state, 'Tamil Nadu')

  assert.equal(DEFAULT_KOCHI_COIMBATORE_ROUTE.distanceKm, 190)
  assert.ok(KOCHI_COIMBATORE_ROAD_FALLBACK.length >= 12)
  assert.deepEqual(KOCHI_COIMBATORE_ROAD_FALLBACK[0], { lat: KOCHI_ORIGIN.lat, lng: KOCHI_ORIGIN.lng })
  assert.deepEqual(KOCHI_COIMBATORE_ROAD_FALLBACK[KOCHI_COIMBATORE_ROAD_FALLBACK.length - 1], {
    lat: COIMBATORE_DESTINATION.lat,
    lng: COIMBATORE_DESTINATION.lng,
  })
})

test('formatTravelDuration and interpolateRoutePoint animate smoothly along road geometry', () => {
  assert.equal(formatTravelDuration(265), '4h 25m')
  assert.equal(formatTravelDuration(180), '3h')
  assert.equal(formatTravelDuration(45), '45m')

  const start = interpolateRoutePoint(KOCHI_COIMBATORE_ROAD_FALLBACK, 0)
  const mid = interpolateRoutePoint(KOCHI_COIMBATORE_ROAD_FALLBACK, 50)
  const end = interpolateRoutePoint(KOCHI_COIMBATORE_ROAD_FALLBACK, 100)

  assert.ok(start && mid && end)
  assert.ok(mid.position.lat > start.position.lat && mid.position.lat < end.position.lat)
  assert.ok(mid.position.lng > start.position.lng && mid.position.lng < end.position.lng)
})
