import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFleetRiskAssessments,
  classifyComplianceExpiryTier,
  computeFinancialLedgerSummary,
  computeVehicleFiveAreaHealth,
} from './intelligenceEngine'
import {
  FIXED_NOW_MS,
  ORG_KAVERI,
  SAMPLE_DRIVER_EVENTS,
  SAMPLE_DRIVER_KAVERI,
  SAMPLE_FUEL_TXS,
  SAMPLE_INSPECTIONS,
  SAMPLE_VEHICLE_ICE,
} from '../../tests/fixtures/fleetFixtures'
import type { FinancialInvoice, TyrePositionRecord, WorkOrder } from '../types/fleet'

test('computeVehicleFiveAreaHealth evaluates all 5 fleet areas cleanly and separates Driver Health as safety/compliance only', () => {
  const tyres: TyrePositionRecord[] = [
    {
      id: 'ty-1',
      vehicleId: SAMPLE_VEHICLE_ICE.id,
      position: 'FL',
      brand: 'MRF Steel',
      serialNumber: 'MRF-11',
      treadDepthMm: 3.1,
      installedAtOdometerKm: 110000,
      expectedLifeKm: 65000,
      status: 'replace_soon',
      lastInspectedAt: '2026-06-14',
    },
  ]

  const res = computeVehicleFiveAreaHealth({
    vehicle: SAMPLE_VEHICLE_ICE,
    drivers: [SAMPLE_DRIVER_KAVERI],
    driverEvents: SAMPLE_DRIVER_EVENTS,
    fuelTransactions: SAMPLE_FUEL_TXS,
    tyrePositions: tyres,
    inspections: SAMPLE_INSPECTIONS,
    smallIssues: [],
    nowMs: FIXED_NOW_MS,
  })

  assert.ok(res.fuelHealth.score >= 0 && res.fuelHealth.score <= 100)
  assert.equal(res.engineHealth.status, 'insufficient_data')
  assert.equal(res.tyreHealth.status, 'critical')
  assert.ok(res.driverHealth.score >= 0 && res.driverHealth.score <= 100)
  assert.ok(res.vehicleHealth.score >= 0 && res.vehicleHealth.score <= 100)
  assert.doesNotMatch(res.driverHealth.detail, /diagnos|disease|heart|medical|illness/i)
})

test('computeVehicleFiveAreaHealth returns insufficient_data when baseline fuel, driver, and tyre data are missing', () => {
  const res = computeVehicleFiveAreaHealth({
    vehicle: {
      ...SAMPLE_VEHICLE_ICE,
      assignedDriverId: null,
      odometerKm: 0,
      lastServiceDate: '',
      telemetry: { ...SAMPLE_VEHICLE_ICE.telemetry, connectionState: 'disconnected' },
    },
    drivers: [],
    driverEvents: [],
    fuelTransactions: [],
    tyrePositions: [],
    inspections: [],
    smallIssues: [],
    nowMs: FIXED_NOW_MS,
  })

  assert.equal(res.fuelHealth.status, 'insufficient_data')
  assert.equal(res.driverHealth.status, 'insufficient_data')
  assert.equal(res.tyreHealth.status, 'insufficient_data')
})

test('classifyComplianceExpiryTier classifies 60/30/15/7/0d Indian compliance windows accurately', () => {
  assert.equal(classifyComplianceExpiryTier('2026-06-14', FIXED_NOW_MS).tier, 'expired')
  assert.equal(classifyComplianceExpiryTier('2026-06-21', FIXED_NOW_MS).tier, 'critical_7d')
  assert.equal(classifyComplianceExpiryTier('2026-06-29', FIXED_NOW_MS).tier, 'urgent_15d')
  assert.equal(classifyComplianceExpiryTier('2026-07-12', FIXED_NOW_MS).tier, 'upcoming_30d')
  assert.equal(classifyComplianceExpiryTier('2026-08-12', FIXED_NOW_MS).tier, 'watch_60d')
  assert.equal(classifyComplianceExpiryTier('2026-12-31', FIXED_NOW_MS).tier, 'valid')
})

test('buildFleetRiskAssessments produces risks across compliance_expiry, inspection_defects, inventory_shortage, and financial_variance', () => {
  const soonExpiryVehicle = {
    ...SAMPLE_VEHICLE_ICE,
    insuranceExpiry: '2026-06-20',
  }
  const overdueInvoice: FinancialInvoice = {
    id: 'inv-over',
    organizationId: ORG_KAVERI.id,
    invoiceNumber: 'INV-OVER',
    vendorName: 'Test Garage',
    category: 'maintenance',
    amountInr: 18000,
    paidAmountInr: 0,
    issuedDate: '2026-05-01',
    dueDate: '2026-06-01',
    status: 'verified',
  }

  const risks = buildFleetRiskAssessments({
    organizationId: ORG_KAVERI.id,
    vehicles: [soonExpiryVehicle],
    predictions: [],
    drivers: [SAMPLE_DRIVER_KAVERI],
    driverEvents: [],
    fuelTransactions: SAMPLE_FUEL_TXS,
    trips: [],
    inspections: SAMPLE_INSPECTIONS,
    partsInventory: [
      {
        id: 'prt-low',
        organizationId: ORG_KAVERI.id,
        sku: 'BRK-LOW',
        name: 'Brake Lining',
        category: 'Vehicle Health',
        unit: 'set',
        stockQty: 1,
        reorderThreshold: 4,
        unitCostInr: 3200,
        warehouseLocation: 'Bay A',
        updatedAt: '2026-06-14T10:00:00.000Z',
      },
    ],
    invoices: [overdueInvoice],
    nowMs: FIXED_NOW_MS,
  })

  const categories = new Set(risks.map((r) => r.category))
  assert.ok(categories.has('compliance_expiry'))
  assert.ok(categories.has('inspection_defects'))
  assert.ok(categories.has('inventory_shortage'))
  assert.ok(categories.has('financial_variance'))
})

test('computeFinancialLedgerSummary separates Recorded / Verified / Paid invoice and work order ledgers accurately', () => {
  const invoices: FinancialInvoice[] = [
    {
      id: 'inv-a',
      organizationId: ORG_KAVERI.id,
      invoiceNumber: 'INV-A',
      vendorName: 'Alpha Motors',
      category: 'maintenance',
      amountInr: 12000,
      paidAmountInr: 0,
      issuedDate: '2026-06-10',
      dueDate: '2026-06-25',
      status: 'verified',
      referenceId: 'wo-a',
    },
    {
      id: 'inv-b',
      organizationId: ORG_KAVERI.id,
      invoiceNumber: 'INV-B',
      vendorName: 'Beta Spares',
      category: 'parts_po',
      amountInr: 5000,
      paidAmountInr: 5000,
      issuedDate: '2026-06-05',
      dueDate: '2026-06-15',
      status: 'paid',
    },
    {
      id: 'inv-c',
      organizationId: ORG_KAVERI.id,
      invoiceNumber: 'INV-C',
      vendorName: 'Gamma Service',
      category: 'maintenance',
      amountInr: 3500,
      paidAmountInr: 0,
      issuedDate: '2026-06-14',
      dueDate: '2026-06-28',
      status: 'recorded',
    },
  ]

  const workOrders: WorkOrder[] = [
    {
      id: 'wo-a',
      organizationId: ORG_KAVERI.id,
      workOrderNumber: 'WO-A',
      vehicleId: SAMPLE_VEHICLE_ICE.id,
      title: 'Clutch overhaul',
      description: 'Clutch plate and release bearing overhaul',
      healthArea: 'Engine Health',
      workshopName: 'Alpha Motors',
      status: 'completed',
      priority: 'high',
      parts: [],
      laborCostInr: 4000,
      partsCostInr: 8000,
      totalCostInr: 12000,
      tasks: [],
      linkedIssueIds: [],
      paymentState: 'verified',
      createdBy: 'Admin',
      createdAt: '2026-06-10T09:00:00.000Z',
    },
  ]

  const summary = computeFinancialLedgerSummary({
    invoices,
    payments: [],
    workOrders,
    purchaseOrders: [],
    fuelTransactions: SAMPLE_FUEL_TXS,
  })
  assert.equal(summary.recordedInvoicesInr, 3500)
  assert.equal(summary.verifiedInvoicesInr, 12000)
  assert.equal(summary.paidInvoicesInr, 5000)
  assert.equal(summary.outstandingPayablesInr, 15500)
  assert.equal(summary.workOrderSpendInr, 12000)
})
