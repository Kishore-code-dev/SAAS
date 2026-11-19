import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSeedDataset } from '../../src/data/seedOrganizations'
import {
  analyzeFuelTransactions,
  classifyComplianceExpiryTier,
  computeFinancialIntelligence,
  computeFinancialLedgerSummary,
  computeVehicleComponentPrediction,
  computeVehicleFiveAreaHealth,
  isStaleOutOfOrderTimestamp,
  isValidCoordinate,
  validateVehiclePayload,
} from '../../src/utils/intelligenceEngine'
import { canAccessRoute, canPerformAction } from '../../src/utils/rbac'
import {
  FIXED_NOW_MS,
  ORG_COROMANDEL,
  ORG_KAVERI,
  SAMPLE_CORRIDOR_MADURAI,
  SAMPLE_DRIVER_KAVERI,
  SAMPLE_FUEL_TXS,
  SAMPLE_INSPECTIONS,
  SAMPLE_VEHICLE_ICE,
} from '../fixtures/fleetFixtures'

describe('Regression Suite (Owner-Only SaaS & Production Integrity)', () => {
  it('REG-001: Auth page enforces Username + Password + Show/Hide + Forgot Password with zero driver or demo controls', () => {
    const authCode = readFileSync(resolve(process.cwd(), 'src/pages/Auth.tsx'), 'utf-8')
    expect(authCode).toContain('Forgot Password?')
    expect(authCode).toContain('Show password')
    expect(authCode).not.toMatch(/demo|pilot|instant.*demo|driver.*login/i)
  })

  it('REG-002: Driver app & driver login role are completely removed; viewer & finance obey least privilege', () => {
    expect(existsSync(resolve(process.cwd(), 'src/pages/DriverApp.tsx'))).toBe(false)
    expect(canAccessRoute('org_admin', '/driver')).toBe(false)
    expect(canAccessRoute('viewer', '/dashboard/admin')).toBe(false)
    expect(canPerformAction('viewer', 'decommission_vehicle')).toBe(false)
    expect(canPerformAction('finance', 'schedule_maintenance')).toBe(false)
  })

  it('REG-003: Predictive engine refuses fabricated RUL/savings when baseline telemetry & odometer are missing', () => {
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

  it('REG-004: Duplicate vehicle registration rejected within same organization but permitted across organizations', () => {
    const prodData = buildSeedDataset('production')
    const kaveriVehicles = prodData.vehicles.filter((v) => v.organizationId === ORG_KAVERI.id)
    const coromandelVehicles = prodData.vehicles.filter((v) => v.organizationId === ORG_COROMANDEL.id)
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

  it('REG-005: Map & Trip coordinates validate against NaN/out-of-range and stale out-of-order telemetry', () => {
    expect(isValidCoordinate(Number.NaN, 78)).toBe(false)
    expect(isValidCoordinate(95, 78)).toBe(false)
    expect(isStaleOutOfOrderTimestamp('2026-06-15T08:00:00.000Z', '2026-06-15T09:00:00.000Z')).toBe(true)
  })

  it('REG-006: Fuel analyzer computes km/unit efficiency and avoids accusing fraud', () => {
    const prodData = buildSeedDataset('production')
    const kaveriFuel = prodData.fuelTransactions.filter((f) => f.organizationId === ORG_KAVERI.id)
    const kaveriVehicles = prodData.vehicles.filter((v) => v.organizationId === ORG_KAVERI.id)
    const analyzed = analyzeFuelTransactions(kaveriFuel, kaveriVehicles)
    expect(analyzed.every((tx) => tx.anomalyFlags.every((flag) => !/fraud/i.test(flag)))).toBe(true)
  })

  it('REG-007: Consolidated financial downtime exposure does not double-count multiple open alerts on one vehicle', () => {
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

  it('REG-008: Dashboard removes Recent Alerts & Predictive Maintenance widgets cleanly while preserving Notification Drawer', () => {
    const dashCode = readFileSync(resolve(process.cwd(), 'src/pages/Dashboard.tsx'), 'utf-8')
    const headerCode = readFileSync(resolve(process.cwd(), 'src/components/layout/Header.tsx'), 'utf-8')
    expect(dashCode).not.toContain('Recent Alerts')
    expect(dashCode).not.toContain('Predictive Maintenance')
    expect(headerCode).toContain('Notifications')
  })

  it('REG-009: 5-area health, compliance expiry 60/30/15/7/0d tiering, and Recorded/Verified/Paid ledger prevent double-counting', () => {
    const fiveArea = computeVehicleFiveAreaHealth({
      vehicle: SAMPLE_VEHICLE_ICE,
      drivers: [SAMPLE_DRIVER_KAVERI],
      driverEvents: [],
      fuelTransactions: SAMPLE_FUEL_TXS,
      tyrePositions: [],
      inspections: SAMPLE_INSPECTIONS,
      smallIssues: [],
      nowMs: FIXED_NOW_MS,
    })
    expect(fiveArea.fuelHealth.score).toBeGreaterThanOrEqual(0)
    expect(fiveArea.engineHealth.score).toBeGreaterThanOrEqual(0)
    expect(fiveArea.tyreHealth.score).toBeGreaterThanOrEqual(0)
    expect(fiveArea.driverHealth.score).toBeGreaterThanOrEqual(0)
    expect(fiveArea.vehicleHealth.score).toBeGreaterThanOrEqual(0)

    expect(classifyComplianceExpiryTier('2026-06-14', FIXED_NOW_MS).tier).toBe('expired')
    expect(classifyComplianceExpiryTier('2026-06-20', FIXED_NOW_MS).tier).toBe('critical_7d')
    expect(classifyComplianceExpiryTier('2026-06-28', FIXED_NOW_MS).tier).toBe('urgent_15d')
    expect(classifyComplianceExpiryTier('2026-07-10', FIXED_NOW_MS).tier).toBe('upcoming_30d')
    expect(classifyComplianceExpiryTier('2026-08-10', FIXED_NOW_MS).tier).toBe('watch_60d')
    expect(classifyComplianceExpiryTier('2027-01-01', FIXED_NOW_MS).tier).toBe('valid')

    const ledger = computeFinancialLedgerSummary({
      invoices: [
        {
          id: 'inv-1',
          organizationId: ORG_KAVERI.id,
          invoiceNumber: 'INV-1',
          vendorName: 'Garage',
          category: 'maintenance',
          amountInr: 10000,
          paidAmountInr: 0,
          issuedDate: '2026-06-10',
          dueDate: '2026-06-20',
          status: 'verified',
          linkedWorkOrderId: 'wo-1',
        },
      ],
      payments: [],
      workOrders: [
        {
          id: 'wo-1',
          organizationId: ORG_KAVERI.id,
          workOrderNumber: 'WO-1',
          vehicleId: SAMPLE_VEHICLE_ICE.id,
          title: 'Brake job',
          description: 'Front axle brake lining replacement',
          healthArea: 'Vehicle Health',
          workshopName: 'Garage',
          status: 'completed',
          priority: 'high',
          parts: [],
          laborCostInr: 4000,
          partsCostInr: 6000,
          totalCostInr: 10000,
          tasks: [],
          linkedIssueIds: [],
          paymentState: 'verified',
          createdBy: 'Admin',
          createdAt: '2026-06-10T10:00:00.000Z',
        },
      ],
      purchaseOrders: [],
      fuelTransactions: [],
    })
    expect(ledger.verifiedInvoicesInr).toBe(10000)
    expect(ledger.recordedInvoicesInr).toBe(0)
    expect(ledger.workOrderSpendInr).toBe(10000)
  })

  it('REG-010: Settings syncs orgForm on tenant switch and Pure White + Pale Lavender + Cocoa palette stays intact', () => {
    const settingsCode = readFileSync(resolve(process.cwd(), 'src/pages/settings/sections.tsx'), 'utf-8')
    expect(settingsCode).toContain('orgFormDraft.orgId === activeOrganization.id')
    expect(settingsCode).toContain('digilockerEnabled')

    const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf-8')
    expect(indexCss).toContain('#FFFFFF')
    expect(indexCss).toContain('#EEE8F7')
    expect(indexCss).toContain('#625346')
    expect(indexCss).toContain('#958777')
    expect(indexCss).not.toMatch(/#F7F0D9|#F4EBD5|#FBF6E6|#000000/i)
  })
})
