import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzeFuelTransactions,
  buildFleetRiskAssessments,
  classifyTelemetryFreshness,
  computeFinancialIntelligence,
  computeVehicleComponentPrediction,
  evaluateDriverSafety,
  generateCsvContent,
} from './intelligenceEngine'
import type {
  Driver,
  DriverBehaviorEvent,
  FuelTransaction,
  MaintenanceRecord,
  RegionalCorridor,
  Trip,
  Vehicle,
  VehicleInspection,
} from '../types/fleet'

const nowMs = new Date('2026-06-15T10:00:00.000Z').getTime()

const sampleCorridor: RegionalCorridor = {
  id: 'cor-madurai',
  name: 'Madurai',
  region: 'South',
  roadStressIndex: 0.78,
  climateImpactScore: 0.82,
  potholeDensity: 'high',
  avgAmbientTempC: 39,
}

const sampleVehicle: Vehicle = {
  id: 'veh-1',
  organizationId: 'org-1',
  environment: 'demo',
  registrationNumber: 'TN 58 AB 4321',
  make: 'Ashok Leyland',
  model: 'Dost Strong',
  category: 'Light Commercial',
  powertrain: 'ICE',
  fuelType: 'Diesel',
  year: 2021,
  assignedDriverId: 'drv-1',
  odometerKm: 145600,
  dailyAvgKm: 190,
  healthScore: 52,
  operationStatus: 'moving',
  fuelOrSocPct: 68,
  corridorId: 'cor-madurai',
  cityName: 'Madurai',
  registrationExpiry: '2027-03-15',
  insuranceExpiry: '2026-11-30',
  insuranceProvider: 'ICICI Lombard Commercial',
  lastServiceDate: '2025-11-01',
  nextServiceDueDate: '2026-06-20',
  monthlyRevenueInr: 165000,
  telemetry: {
    vehicleId: 'veh-1',
    location: { lat: 9.9252, lng: 78.1198 },
    cityLabel: 'Madurai Ring Road',
    speedKmh: 54,
    heading: 120,
    gpsAccuracyMeters: 9,
    signalQualityPct: 88,
    connectionState: 'connected',
    source: 'smartphone_gps',
    lastUpdatedAt: new Date(nowMs - 25000).toISOString(),
    batteryLevelPct: 76,
    motionPermissionGranted: true,
  },
  components: [
    {
      id: 'cmp-susp',
      vehicleId: 'veh-1',
      componentName: 'Suspension',
      healthScore: 39,
      status: 'critical',
      wearRatePer1000Km: 0.85,
      lastServicedAt: '2025-05-10',
      predictedReplacementDate: '2026-06-28',
      notes: 'Front spring wear noted under heavy payload',
    },
  ],
}

const sampleDriver: Driver = {
  id: 'drv-1',
  organizationId: 'org-1',
  environment: 'demo',
  name: 'Selvam P',
  mobile: '+91 98401 11223',
  email: 'selvam@kaveri.in',
  licenseNumber: 'TN58-2019-004128',
  licenseExpiry: '2028-09-10',
  assignedVehicleId: 'veh-1',
  status: 'on_trip',
  safetyScore: 76,
  speedingScore: 78,
  brakingScore: 70,
  accelerationScore: 80,
  corneringScore: 74,
  fatigueComplianceScore: 85,
  totalTrips: 412,
  totalDistanceKm: 52300,
  joinDate: '2022-04-01',
  coachingRecommendations: [],
  dataConfidenceNote: 'Smartphone GPS',
}

test('classifyTelemetryFreshness separates live, delayed, stale, and offline honestly', () => {
  const live = classifyTelemetryFreshness(new Date(nowMs - 20_000).toISOString(), 'connected', nowMs)
  assert.equal(live.freshness, 'live')

  const delayed = classifyTelemetryFreshness(new Date(nowMs - 140_000).toISOString(), 'connected', nowMs)
  assert.equal(delayed.freshness, 'delayed')

  const stale = classifyTelemetryFreshness(new Date(nowMs - 600_000).toISOString(), 'connected', nowMs)
  assert.equal(stale.freshness, 'stale')

  const offline = classifyTelemetryFreshness(new Date(nowMs - 2400_000).toISOString(), 'connected', nowMs)
  assert.equal(offline.freshness, 'offline')

  const disconnected = classifyTelemetryFreshness(new Date(nowMs - 10_000).toISOString(), 'disconnected', nowMs)
  assert.equal(disconnected.freshness, 'offline')
})

test('computeVehicleComponentPrediction produces deterministic explainable prediction with cost of delay', () => {
  const inspections: VehicleInspection[] = [
    {
      id: 'insp-1',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      timestamp: new Date(nowMs - 86400000).toISOString(),
      tyreCondition: 'worn',
      brakeFeel: 'normal',
      fluidLeaksDetected: false,
      warningLightsOn: true,
      batteryOrStartingIssue: false,
      notes: 'Suspension rattle over speed breakers',
      passed: false,
    },
  ]

  const prediction = computeVehicleComponentPrediction({
    vehicle: sampleVehicle,
    component: sampleVehicle.components[0],
    corridor: sampleCorridor,
    driverEvents: [],
    inspections,
    nowMs,
  })

  assert.equal(prediction.priority, 'critical')
  assert.ok(prediction.estimatedDaysToFailure <= 14)
  assert.ok(prediction.delayCostInr > prediction.repairCostInr)
  assert.equal(prediction.potentialSavingsInr, prediction.delayCostInr - prediction.repairCostInr)
  assert.equal(prediction.inputFeatureSnapshot.inspectionFlagsCount, 2)
  assert.ok(prediction.causalFactors.length === 4)
  const weightSum = prediction.causalFactors.reduce((s, f) => s + f.weight, 0)
  assert.ok(Math.abs(weightSum - 1) <= 0.03)
})

test('evaluateDriverSafety excludes accepted disputed events from penalties', () => {
  const events: DriverBehaviorEvent[] = [
    {
      id: 'ev-1',
      organizationId: 'org-1',
      driverId: 'drv-1',
      vehicleId: 'veh-1',
      tripId: 'trp-1',
      eventType: 'harsh_braking',
      severity: 'high',
      speedKmh: 58,
      roadStressContext: 0.78,
      gpsAccuracyMeters: 10,
      mountStabilityWarning: false,
      timestamp: new Date(nowMs - 3600000).toISOString(),
      locationLabel: 'NH44 Madurai',
      disputeStatus: 'none',
    },
    {
      id: 'ev-2',
      organizationId: 'org-1',
      driverId: 'drv-1',
      vehicleId: 'veh-1',
      tripId: 'trp-1',
      eventType: 'harsh_braking',
      severity: 'high',
      speedKmh: 44,
      roadStressContext: 0.78,
      gpsAccuracyMeters: 35,
      mountStabilityWarning: true,
      timestamp: new Date(nowMs - 1800000).toISOString(),
      locationLabel: 'NH44 Madurai',
      disputeStatus: 'accepted_dismissed',
      disputeReason: 'Phone fell from dashboard mount over pothole',
    },
  ]

  const result = evaluateDriverSafety({
    driver: sampleDriver,
    events,
    trips: [],
    corridors: [sampleCorridor],
    vehicles: [sampleVehicle],
  })

  assert.equal(result.activeEventCount, 1)
  assert.ok(result.brakingScore > 85)
})

test('analyzeFuelTransactions flags duplicate and low-efficiency entries for review without labeling fraud', () => {
  const txs: FuelTransaction[] = [
    {
      id: 'f-1',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      amountInr: 4000,
      litersOrKwh: 44,
      unitPriceInr: 90.9,
      odometerKm: 145000,
      station: 'Indian Oil Madurai',
      location: { lat: 9.92, lng: 78.12 },
      timestamp: '2026-06-15T06:00:00.000Z',
      paymentMethod: 'upi',
      entrySource: 'manual_driver_entry',
      verificationStatus: 'verified',
      anomalyFlags: [],
    },
    {
      id: 'f-2',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      amountInr: 4000,
      litersOrKwh: 44,
      unitPriceInr: 90.9,
      odometerKm: 145020,
      station: 'Indian Oil Madurai',
      location: { lat: 9.92, lng: 78.12 },
      timestamp: '2026-06-15T06:30:00.000Z',
      paymentMethod: 'upi',
      entrySource: 'manual_driver_entry',
      verificationStatus: 'pending',
      anomalyFlags: [],
    },
  ]

  const analyzed = analyzeFuelTransactions(txs, [sampleVehicle])
  const flagged = analyzed.find((t) => t.id === 'f-2')
  assert.ok(flagged)
  assert.equal(flagged.verificationStatus, 'needs_review')
  assert.ok(flagged.anomalyFlags.some((f) => f.toLowerCase().includes('duplicate')))
  assert.ok(flagged.anomalyFlags.every((f) => !f.toLowerCase().includes('fraud')))
})

test('buildFleetRiskAssessments classifies insufficient data when telemetry is offline', () => {
  const offlineVehicle: Vehicle = {
    ...sampleVehicle,
    id: 'veh-off',
    telemetry: {
      ...sampleVehicle.telemetry,
      connectionState: 'disconnected',
      lastUpdatedAt: new Date(nowMs - 7200_000).toISOString(),
    },
  }

  const risks = buildFleetRiskAssessments({
    organizationId: 'org-1',
    vehicles: [offlineVehicle],
    predictions: [],
    drivers: [sampleDriver],
    driverEvents: [],
    fuelTransactions: [],
    trips: [],
    nowMs,
  })

  const telemetryRisk = risks.find((r) => r.vehicleId === 'veh-off' && r.category === 'telemetry')
  assert.ok(telemetryRisk)
  assert.equal(telemetryRisk.insufficientData, true)
  assert.equal(telemetryRisk.severity, 'high')
})

test('computeFinancialIntelligence computes cost per km and ICE vs EV comparison cleanly', () => {
  const evVehicle: Vehicle = {
    ...sampleVehicle,
    id: 'veh-ev',
    registrationNumber: 'TN 01 EV 1001',
    powertrain: 'EV',
    fuelType: 'Electric',
    healthScore: 91,
    dailyAvgKm: 150,
  }

  const txs: FuelTransaction[] = [
    {
      id: 'f-ice',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      amountInr: 22000,
      litersOrKwh: 240,
      unitPriceInr: 91.6,
      odometerKm: 145600,
      station: 'BPCL',
      location: { lat: 9.9, lng: 78.1 },
      timestamp: '2026-06-14T10:00:00.000Z',
      paymentMethod: 'upi',
      entrySource: 'manual_driver_entry',
      verificationStatus: 'verified',
      anomalyFlags: [],
    },
    {
      id: 'f-ev',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-ev',
      driverId: 'drv-1',
      amountInr: 4500,
      litersOrKwh: 450,
      unitPriceInr: 10,
      odometerKm: 22000,
      station: 'Zeon Depot Charger',
      location: { lat: 13.08, lng: 80.27 },
      timestamp: '2026-06-14T10:00:00.000Z',
      paymentMethod: 'ev_charging',
      entrySource: 'station_feed',
      verificationStatus: 'verified',
      anomalyFlags: [],
    },
  ]

  const maint: MaintenanceRecord[] = [
    {
      id: 'm-1',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      serviceType: 'Scheduled',
      componentName: 'Engine',
      serviceCenter: 'Madurai ASC',
      description: 'Oil service',
      costInr: 4500,
      downtimeDays: 1,
      partsReplaced: ['Oil filter'],
      performedAt: '2026-06-10T10:00:00.000Z',
      status: 'completed',
    },
  ]

  const trips: Trip[] = []
  const fin = computeFinancialIntelligence({
    vehicles: [sampleVehicle, evVehicle],
    fuelTransactions: txs,
    maintenanceRecords: maint,
    predictions: [],
    trips,
    period: '30d',
  })

  assert.equal(fin.fuelExpenditureInr, 26500)
  assert.equal(fin.maintenanceExpenditureInr, 4500)
  assert.equal(fin.operatingExpenditureInr, 31000)
  assert.ok(fin.iceVsEv.evCostPerKmInr < fin.iceVsEv.iceCostPerKmInr)
  assert.ok(fin.methodologyNotes.length >= 3)
})

test('generateCsvContent escapes commas and quotes correctly', () => {
  const csv = generateCsvContent(['Vehicle', 'Notes'], [['TN 58 AB 4321', 'Brake, "front" check']])
  assert.equal(csv, 'Vehicle,Notes\nTN 58 AB 4321,"Brake, ""front"" check"')
})

test('computeVehicleComponentPrediction refuses to fabricate forecast when odometer or telemetry history is missing', () => {
  const incompleteVehicle: Vehicle = {
    ...sampleVehicle,
    id: 'veh-incomplete',
    odometerKm: 0,
    lastServiceDate: '',
    telemetry: {
      ...sampleVehicle.telemetry,
      connectionState: 'disconnected',
    },
  }

  const prediction = computeVehicleComponentPrediction({
    vehicle: incompleteVehicle,
    component: incompleteVehicle.components[0],
    corridor: sampleCorridor,
    driverEvents: [],
    inspections: [],
    nowMs,
  })

  assert.equal(prediction.insufficientData, true)
  assert.equal(prediction.confidenceScore, 0)
  assert.equal(prediction.potentialSavingsInr, 0)
  assert.equal(prediction.estimatedDaysToFailure, 0)
  assert.equal(prediction.predictedFailureDate, 'Insufficient data')
})

test('evaluateDriverSafety suspends penalties on inaccurate GPS (>25m) or restricted motion permission', () => {
  const highGpsNoiseEvent: DriverBehaviorEvent = {
    id: 'ev-gps',
    organizationId: 'org-1',
    driverId: 'drv-1',
    vehicleId: 'veh-1',
    tripId: 'trp-1',
    eventType: 'harsh_braking',
    severity: 'high',
    speedKmh: 50,
    roadStressContext: 0.78,
    gpsAccuracyMeters: 40,
    mountStabilityWarning: false,
    timestamp: new Date(nowMs - 100000).toISOString(),
    locationLabel: 'NH44 Madurai',
    disputeStatus: 'none',
  }
  const gpsEval = evaluateDriverSafety({
    driver: sampleDriver,
    events: [highGpsNoiseEvent],
    trips: [],
    corridors: [sampleCorridor],
    vehicles: [sampleVehicle],
  })
  assert.equal(gpsEval.brakingScore, 95)

  const motionRestrictedVehicle: Vehicle = {
    ...sampleVehicle,
    telemetry: { ...sampleVehicle.telemetry, motionPermissionGranted: false },
  }
  const motionEval = evaluateDriverSafety({
    driver: sampleDriver,
    events: [{ ...highGpsNoiseEvent, id: 'ev-ok-gps', gpsAccuracyMeters: 8 }],
    trips: [],
    corridors: [sampleCorridor],
    vehicles: [motionRestrictedVehicle],
  })
  assert.equal(motionEval.brakingScore, 95)
})

test('analyzeFuelTransactions preserves verified status and computeFinancialIntelligence sums match breakdown across periods', () => {
  const verifiedDuplicate: FuelTransaction[] = [
    {
      id: 'f-1',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      amountInr: 4000,
      litersOrKwh: 44,
      unitPriceInr: 90.9,
      odometerKm: 145000,
      station: 'Indian Oil Madurai',
      location: { lat: 9.92, lng: 78.12 },
      timestamp: '2026-06-15T06:00:00.000Z',
      paymentMethod: 'upi',
      entrySource: 'manual_driver_entry',
      verificationStatus: 'verified',
      anomalyFlags: [],
    },
    {
      id: 'f-2',
      organizationId: 'org-1',
      environment: 'demo',
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      amountInr: 4000,
      litersOrKwh: 44,
      unitPriceInr: 90.9,
      odometerKm: 145020,
      station: 'Indian Oil Madurai',
      location: { lat: 9.92, lng: 78.12 },
      timestamp: '2026-06-15T06:30:00.000Z',
      paymentMethod: 'upi',
      entrySource: 'manual_driver_entry',
      verificationStatus: 'verified',
      anomalyFlags: [],
    },
  ]

  const analyzed = analyzeFuelTransactions(verifiedDuplicate, [sampleVehicle])
  assert.equal(analyzed.find((t) => t.id === 'f-2')?.verificationStatus, 'verified')

  for (const period of ['7d', '30d', '90d'] as const) {
    const fin = computeFinancialIntelligence({
      vehicles: [sampleVehicle],
      fuelTransactions: analyzed,
      maintenanceRecords: [],
      predictions: [],
      trips: [],
      period,
      nowMs,
    })
    const sumTotal = fin.vehicleCostBreakdown.reduce((s, r) => s + r.totalSpendInr, 0)
    assert.equal(fin.operatingExpenditureInr, sumTotal)
  }
})

