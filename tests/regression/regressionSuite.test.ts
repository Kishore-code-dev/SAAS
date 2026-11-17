import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSeedDataset,
} from '../../src/data/seedOrganizations'
import {
  analyzeFuelTransactions,
  computeFinancialIntelligence,
  computeVehicleComponentPrediction,
  isStaleOutOfOrderTimestamp,
  isValidCoordinate,
  validateVehiclePayload,
} from '../../src/utils/intelligenceEngine'
import { validateEmailFormat } from '../../src/hooks/useAuth'
import { canAccessRoute, canPerformAction } from '../../src/utils/rbac'
import {
  FIXED_NOW_MS,
  ORG_COROMANDEL,
  ORG_KAVERI,
  SAMPLE_CORRIDOR_MADURAI,
  SAMPLE_VEHICLE_ICE,
} from '../fixtures/fleetFixtures'

describe('Regression Suite (BUG-001 to BUG-012)', () => {
  it('BUG-001: Auth & client layer operates standalone in-browser with zero environment variables or crashes', () => {
    const clientCode = readFileSync(resolve(process.cwd(), 'src/integrations/supabase/client.ts'), 'utf-8')
    expect(clientCode).toContain('isLocalStandaloneMode')
    expect(clientCode).not.toContain('import.meta.env')
    expect(validateEmailFormat('admin@kaveri.in')).toBe(true)
    expect(validateEmailFormat('invalid-email')).toBe(false)
  })

  it('BUG-002: Driver role cannot access management routes or decommission vehicles', () => {
    expect(canAccessRoute('driver', '/dashboard')).toBe(false)
    expect(canPerformAction('driver', 'decommission_vehicle')).toBe(false)
    expect(canPerformAction('finance', 'schedule_maintenance')).toBe(false)
  })

  it('BUG-003: Predictive engine refuses fabricated RUL/savings when baseline telemetry & odometer are missing', () => {
    const pred = computeVehicleComponentPrediction({
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
    expect(pred.insufficientData).toBe(true)
    expect(pred.confidenceScore).toBe(0)
    expect(pred.potentialSavingsInr).toBe(0)
  })

  it('BUG-004: Duplicate vehicle registration rejected within same organization but permitted across organizations', () => {
    const demoData = buildSeedDataset('demo')
    const kaveriVehicles = demoData.vehicles.filter((v) => v.organizationId === ORG_KAVERI.id)
    const coromandelVehicles = demoData.vehicles.filter((v) => v.organizationId === ORG_COROMANDEL.id)
    const sampleReg = kaveriVehicles[0].registrationNumber

    expect(
      validateVehiclePayload({
        registrationNumber: sampleReg.toLowerCase(),
        make: 'Tata',
        model: 'Ace',
        year: 2023,
        odometerKm: 10000,
        dailyAvgKm: 120,
        existingVehicles: kaveriVehicles,
      }),
    ).toContain('already registered')

    expect(
      validateVehiclePayload({
        registrationNumber: sampleReg,
        make: 'Tata',
        model: 'Ace',
        year: 2023,
        odometerKm: 10000,
        dailyAvgKm: 120,
        existingVehicles: coromandelVehicles,
      }),
    ).toBeNull()
  })

  it('BUG-005: Map & Trip coordinates validate against NaN/out-of-range and stale out-of-order telemetry', () => {
    expect(isValidCoordinate(Number.NaN, 78)).toBe(false)
    expect(isValidCoordinate(95, 78)).toBe(false)
    expect(isStaleOutOfOrderTimestamp('2026-06-15T08:00:00.000Z', '2026-06-15T09:00:00.000Z')).toBe(true)
  })

  it('BUG-006: Fuel analyzer computes km/unit efficiency and avoids accusing fraud', () => {
    const demoData = buildSeedDataset('demo')
    const kaveriFuel = demoData.fuelTransactions.filter((f) => f.organizationId === ORG_KAVERI.id)
    const kaveriVehicles = demoData.vehicles.filter((v) => v.organizationId === ORG_KAVERI.id)
    const analyzed = analyzeFuelTransactions(kaveriFuel, kaveriVehicles)
    expect(analyzed.every((tx) => tx.anomalyFlags.every((flag) => !/fraud/i.test(flag)))).toBe(true)
  })

  it('BUG-007: Consolidated financial downtime exposure does not double-count multiple open alerts on one vehicle', () => {
    const p1 = computeVehicleComponentPrediction({
      vehicle: SAMPLE_VEHICLE_ICE,
      component: SAMPLE_VEHICLE_ICE.components[0],
      corridor: SAMPLE_CORRIDOR_MADURAI,
      driverEvents: [],
      inspections: [],
      nowMs: FIXED_NOW_MS,
    })
    const p2 = { ...p1, id: 'pred-dup', componentName: 'Brakes' as const, potentialSavingsInr: 12000 }
    const finSingle = computeFinancialIntelligence({
      vehicles: [SAMPLE_VEHICLE_ICE],
      fuelTransactions: [],
      maintenanceRecords: [],
      predictions: [p1],
      trips: [],
      period: '30d',
    })
    const finTwo = computeFinancialIntelligence({
      vehicles: [SAMPLE_VEHICLE_ICE],
      fuelTransactions: [],
      maintenanceRecords: [],
      predictions: [p1, p2],
      trips: [],
      period: '30d',
    })
    expect(finTwo.estimatedPotentialSavingsInr).toBe(finSingle.estimatedPotentialSavingsInr)
  })

  it('BUG-008: DriverApp locks driver switcher for driver role and surfaces mid-trip GPS revocation alert', () => {
    const driverAppCode = readFileSync(resolve(process.cwd(), 'src/pages/DriverApp.tsx'), 'utf-8')
    expect(driverAppCode).toContain("const canSwitchDriver = activeRole !== 'driver'")
    expect(driverAppCode).toContain('GPS Permission Revoked Mid-Trip')
  })

  it('BUG-009 & BUG-010: Demo/Pilot/Production seeds isolate datasets and Settings syncs orgForm on tenant switch', () => {
    const demoData = buildSeedDataset('demo')
    const prodData = buildSeedDataset('production')
    expect(demoData.vehicles.length).toBeGreaterThan(0)
    expect(prodData.vehicles.length).toBe(0)

    const settingsCode = readFileSync(resolve(process.cwd(), 'src/pages/Settings.tsx'), 'utf-8')
    expect(settingsCode).toContain('orgFormDraft.orgId === activeOrganization.id')
    expect(settingsCode).toContain('activeOrganization.timezone')
  })

  it('BUG-011 & BUG-012: Pure White 60-30-10 + Pale Lavender + Cocoa palette enforced with zero butter cream or black surfaces', () => {
    const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8')
    expect(indexCss).toContain('#FFFFFF')
    expect(indexCss).toContain('#EEE8F7')
    expect(indexCss).toContain('#625346')
    expect(indexCss).toContain('#958777')
    expect(indexCss).not.toMatch(/#F7F0D9|#F4EBD5|#FBF6E6|#000000/i)
  })
})
