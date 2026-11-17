import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCopilotFleetContext,
  buildMaintenanceSystemInstruction,
  FLEET_MAINTENANCE_KNOWLEDGE,
} from './copilotContext'
import { computeFinancialIntelligence, computeVehicleComponentPrediction } from './intelligenceEngine'
import {
  FIXED_NOW_MS,
  ORG_KAVERI,
  SAMPLE_CORRIDOR_MADURAI,
  SAMPLE_DRIVER_KAVERI,
  SAMPLE_FUEL_TXS,
  SAMPLE_INSPECTIONS,
  SAMPLE_MAINTENANCE,
  SAMPLE_VEHICLE_ICE,
} from '../../tests/fixtures/fleetFixtures'

const sampleFin = computeFinancialIntelligence({
  vehicles: [SAMPLE_VEHICLE_ICE],
  fuelTransactions: SAMPLE_FUEL_TXS,
  maintenanceRecords: SAMPLE_MAINTENANCE,
  predictions: [],
  trips: [],
  period: '30d',
})

const samplePred = computeVehicleComponentPrediction({
  vehicle: SAMPLE_VEHICLE_ICE,
  component: SAMPLE_VEHICLE_ICE.components[0],
  corridor: SAMPLE_CORRIDOR_MADURAI,
  driverEvents: [],
  inspections: SAMPLE_INSPECTIONS,
  nowMs: FIXED_NOW_MS,
})

test('FLEET_MAINTENANCE_KNOWLEDGE covers 8 subsystems, RUL windows, and cost-of-delay concept', () => {
  assert.ok(FLEET_MAINTENANCE_KNOWLEDGE.includes('Engine Oil & Thermal System'))
  assert.ok(FLEET_MAINTENANCE_KNOWLEDGE.includes('Brake Pads & Rotor Wear'))
  assert.ok(FLEET_MAINTENANCE_KNOWLEDGE.includes('Cost-of-Delay Economic Model'))
  assert.ok(FLEET_MAINTENANCE_KNOWLEDGE.includes('Remaining Useful Life'))
})

test('buildCopilotFleetContext includes active org maintenance predictions and enforces RBAC on financials', () => {
  const managerCtx = buildCopilotFleetContext({
    activeOrganization: ORG_KAVERI,
    activeRole: 'fleet_manager',
    vehicles: [SAMPLE_VEHICLE_ICE],
    predictions: [samplePred],
    maintenanceRecords: SAMPLE_MAINTENANCE,
    riskAssessments: [],
    drivers: [SAMPLE_DRIVER_KAVERI],
    fuelTransactions: SAMPLE_FUEL_TXS,
    financialSummary: sampleFin,
  })
  assert.equal(managerCtx.organization.name, ORG_KAVERI.name)
  assert.equal(managerCtx.predictiveMaintenanceAlerts.length, 1)
  assert.ok('financials30d' in managerCtx)

  const maintCtx = buildCopilotFleetContext({
    activeOrganization: ORG_KAVERI,
    activeRole: 'maintenance',
    vehicles: [SAMPLE_VEHICLE_ICE],
    predictions: [samplePred],
    maintenanceRecords: SAMPLE_MAINTENANCE,
    riskAssessments: [],
    drivers: [SAMPLE_DRIVER_KAVERI],
    fuelTransactions: SAMPLE_FUEL_TXS,
    financialSummary: sampleFin,
  })
  assert.ok(!('financials30d' in maintCtx))
  assert.ok('financialAccessNote' in maintCtx)
})

test('buildMaintenanceSystemInstruction embeds maintenance concept and returns grounded citations', () => {
  const { systemInstruction, citations } = buildMaintenanceSystemInstruction({
    activeOrganization: ORG_KAVERI,
    activeRole: 'fleet_manager',
    vehicles: [SAMPLE_VEHICLE_ICE],
    predictions: [samplePred],
    maintenanceRecords: SAMPLE_MAINTENANCE,
    riskAssessments: [],
    drivers: [SAMPLE_DRIVER_KAVERI],
    fuelTransactions: SAMPLE_FUEL_TXS,
    financialSummary: sampleFin,
  })
  assert.ok(systemInstruction.includes('DRIVEMITRA FLEET MAINTENANCE DOMAIN KNOWLEDGE'))
  assert.ok(systemInstruction.includes(SAMPLE_VEHICLE_ICE.registrationNumber))
  assert.ok(citations.some((c) => c.includes('Predictive Maintenance AI')))
})
