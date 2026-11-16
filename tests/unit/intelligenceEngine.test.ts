import { describe, expect, it } from 'vitest'
import {
  analyzeFuelTransactions,
  buildFleetRiskAssessments,
  classifyTelemetryFreshness,
  computeFinancialIntelligence,
  computeVehicleComponentPrediction,
  evaluateDriverSafety,
  generateCsvContent,
  isStaleOutOfOrderTimestamp,
  isValidCoordinate,
  isWithinIndiaCorridorBounds,
  normalizeRegistrationNumber,
  validateFuelTransactionInput,
  validateVehiclePayload,
} from '../../src/utils/intelligenceEngine'
import {
  FIXED_NOW_MS,
  ORG_KAVERI,
  SAMPLE_CORRIDOR_MADURAI,
  SAMPLE_DRIVER_EVENTS,
  SAMPLE_DRIVER_KAVERI,
  SAMPLE_FUEL_TXS,
  SAMPLE_INSPECTIONS,
  SAMPLE_MAINTENANCE,
  SAMPLE_VEHICLE_EV,
  SAMPLE_VEHICLE_ICE,
} from '../fixtures/fleetFixtures'

describe('intelligenceEngine unit suite', () => {
  it('classifies telemetry freshness accurately across live, delayed, stale, and offline boundaries', () => {
    expect(classifyTelemetryFreshness(new Date(FIXED_NOW_MS - 15_000).toISOString(), 'connected', FIXED_NOW_MS).freshness).toBe('live')
    expect(classifyTelemetryFreshness(new Date(FIXED_NOW_MS - 130_000).toISOString(), 'connected', FIXED_NOW_MS).freshness).toBe('delayed')
    expect(classifyTelemetryFreshness(new Date(FIXED_NOW_MS - 480_000).toISOString(), 'connected', FIXED_NOW_MS).freshness).toBe('stale')
    expect(classifyTelemetryFreshness(new Date(FIXED_NOW_MS - 3600_000).toISOString(), 'connected', FIXED_NOW_MS).freshness).toBe('offline')
    expect(classifyTelemetryFreshness(new Date(FIXED_NOW_MS - 5_000).toISOString(), 'disconnected', FIXED_NOW_MS).freshness).toBe('offline')
    expect(classifyTelemetryFreshness('not-a-date', 'connected', FIXED_NOW_MS).freshness).toBe('offline')
  })

  it('validates WGS84 coordinates, India corridor bounds, and out-of-order telemetry timestamps', () => {
    expect(isValidCoordinate(13.0827, 80.2707)).toBe(true)
    expect(isValidCoordinate(91, 80)).toBe(false)
    expect(isValidCoordinate(Number.NaN, 80)).toBe(false)
    expect(isValidCoordinate(13, 181)).toBe(false)

    expect(isWithinIndiaCorridorBounds(13.0827, 80.2707)).toBe(true)
    expect(isWithinIndiaCorridorBounds(51.5072, -0.1276)).toBe(false)

    expect(isStaleOutOfOrderTimestamp('2026-06-15T09:59:00.000Z', '2026-06-15T10:00:00.000Z')).toBe(true)
    expect(isStaleOutOfOrderTimestamp('2026-06-15T10:01:00.000Z', '2026-06-15T10:00:00.000Z')).toBe(false)
    expect(isStaleOutOfOrderTimestamp('invalid', '2026-06-15T10:00:00.000Z')).toBe(true)
  })

  it('validates vehicle registration payload including normalization and duplicate prevention', () => {
    expect(normalizeRegistrationNumber('  tn 58   ab 4321 ')).toBe('TN 58 AB 4321')

    expect(
      validateVehiclePayload({
        registrationNumber: 'tn 58   ab 4321',
        make: 'Ashok Leyland',
        model: 'Dost',
        year: 2022,
        odometerKm: 50000,
        dailyAvgKm: 140,
        existingVehicles: [SAMPLE_VEHICLE_ICE],
      }),
    ).toContain('already registered')

    expect(
      validateVehiclePayload({
        registrationNumber: 'TN 58 AB 4321',
        make: 'Ashok Leyland',
        model: 'Dost',
        year: 2022,
        odometerKm: -5,
        dailyAvgKm: 140,
      }),
    ).toContain('negative')

    expect(
      validateVehiclePayload({
        registrationNumber: 'TN 58 XY 9000',
        make: 'Tata',
        model: 'Intra V30',
        year: 2023,
        odometerKm: 12000,
        dailyAvgKm: 180,
        existingVehicles: [SAMPLE_VEHICLE_ICE],
      }),
    ).toBeNull()
  })

  it('validates fuel transaction inputs and rejects zero/negative or empty station entries', () => {
    expect(
      validateFuelTransactionInput({
        vehicleId: 'veh-1',
        amountInr: 0,
        litersOrKwh: 20,
        unitPriceInr: 92,
        odometerKm: 140000,
        station: 'BPCL',
      }),
    ).toContain('greater than ₹0')

    expect(
      validateFuelTransactionInput({
        vehicleId: 'veh-1',
        amountInr: 2000,
        litersOrKwh: -5,
        unitPriceInr: 92,
        odometerKm: 140000,
        station: 'BPCL',
      }),
    ).toContain('greater than 0')

    expect(
      validateFuelTransactionInput({
        vehicleId: 'veh-1',
        amountInr: 2000,
        litersOrKwh: 20,
        unitPriceInr: 100,
        odometerKm: 140000,
        station: '  ',
      }),
    ).toContain('Station')
  })

  it('computes deterministic explainable component predictions and refuses insufficient baselines', () => {
    const validPred = computeVehicleComponentPrediction({
      vehicle: SAMPLE_VEHICLE_ICE,
      component: SAMPLE_VEHICLE_ICE.components[0],
      corridor: SAMPLE_CORRIDOR_MADURAI,
      driverEvents: SAMPLE_DRIVER_EVENTS,
      inspections: SAMPLE_INSPECTIONS,
      nowMs: FIXED_NOW_MS,
    })

    expect(validPred.insufficientData).toBe(false)
    expect(validPred.priority).toBe('critical')
    expect(validPred.confidenceScore).toBeGreaterThanOrEqual(0.62)
    expect(validPred.confidenceScore).toBeLessThanOrEqual(0.95)
    expect(validPred.potentialSavingsInr).toBe(validPred.delayCostInr - validPred.repairCostInr)
    expect(validPred.causalFactors).toHaveLength(4)

    const weightSum = validPred.causalFactors.reduce((acc, item) => acc + item.weight, 0)
    expect(Math.abs(weightSum - 1)).toBeLessThanOrEqual(0.03)

    const insufficientPred = computeVehicleComponentPrediction({
      vehicle: {
        ...SAMPLE_VEHICLE_ICE,
        odometerKm: 0,
        lastServiceDate: '',
        telemetry: { ...SAMPLE_VEHICLE_ICE.telemetry, connectionState: 'disconnected' },
      },
      component: SAMPLE_VEHICLE_ICE.components[0],
      corridor: SAMPLE_CORRIDOR_MADURAI,
      driverEvents: [],
      inspections: [],
      nowMs: FIXED_NOW_MS,
    })

    expect(insufficientPred.insufficientData).toBe(true)
    expect(insufficientPred.confidenceScore).toBe(0)
    expect(insufficientPred.potentialSavingsInr).toBe(0)
    expect(insufficientPred.delayCostInr).toBe(0)
    expect(insufficientPred.predictedFailureDate).toBe('Insufficient data')
  })

  it('excludes accepted_dismissed disputes from driver safety penalties', () => {
    const result = evaluateDriverSafety({
      driver: SAMPLE_DRIVER_KAVERI,
      events: SAMPLE_DRIVER_EVENTS,
      trips: [],
      corridors: [SAMPLE_CORRIDOR_MADURAI],
      vehicles: [SAMPLE_VEHICLE_ICE],
    })
    expect(result.activeEventCount).toBe(1)
    expect(result.brakingScore).toBeGreaterThan(85)
  })

  it('flags duplicate fuel transactions cleanly without accusing fraud', () => {
    const analyzed = analyzeFuelTransactions(SAMPLE_FUEL_TXS, [SAMPLE_VEHICLE_ICE])
    const dup = analyzed.find((tx) => tx.id === 'f-ice-dup')
    expect(dup?.verificationStatus).toBe('needs_review')
    expect(dup?.anomalyFlags.some((f) => f.toLowerCase().includes('duplicate'))).toBe(true)
    expect(dup?.anomalyFlags.every((f) => !f.toLowerCase().includes('fraud'))).toBe(true)
  })

  it('flags disconnected telemetry vehicles with insufficientData risk assessment', () => {
    const offlineVeh = {
      ...SAMPLE_VEHICLE_ICE,
      telemetry: {
        ...SAMPLE_VEHICLE_ICE.telemetry,
        connectionState: 'disconnected' as const,
        lastUpdatedAt: new Date(FIXED_NOW_MS - 7200_000).toISOString(),
      },
    }
    const risks = buildFleetRiskAssessments({
      organizationId: ORG_KAVERI.id,
      vehicles: [offlineVeh],
      predictions: [],
      drivers: [SAMPLE_DRIVER_KAVERI],
      driverEvents: [],
      fuelTransactions: [],
      trips: [],
      nowMs: FIXED_NOW_MS,
    })
    const telRisk = risks.find((r) => r.category === 'telemetry')
    expect(telRisk?.insufficientData).toBe(true)
    expect(telRisk?.severity).toBe('high')
  })

  it('computes financial intelligence including ICE vs EV cost per km and CSV RFC-4180 escaping', () => {
    const fin = computeFinancialIntelligence({
      vehicles: [SAMPLE_VEHICLE_ICE, SAMPLE_VEHICLE_EV],
      fuelTransactions: SAMPLE_FUEL_TXS,
      maintenanceRecords: SAMPLE_MAINTENANCE,
      predictions: [],
      trips: [],
      period: '30d',
    })
    expect(fin.fuelExpenditureInr).toBe(8000)
    expect(fin.maintenanceExpenditureInr).toBe(4500)
    expect(fin.operatingExpenditureInr).toBe(12500)
    expect(fin.iceVsEv.evCostPerKmInr).toBeLessThan(fin.iceVsEv.iceCostPerKmInr)

    expect(generateCsvContent(['Reg', 'Notes'], [['TN 58 AB 4321', 'Brake, "front" check']])).toBe(
      'Reg,Notes\nTN 58 AB 4321,"Brake, ""front"" check"',
    )
  })
})
