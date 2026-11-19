import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDefaultCustomRecords,
  buildDefaultTools,
  buildDefaultWarranties,
  computeOnboardingChecklist,
  DEFAULT_FLEETIO_SETTINGS,
} from './fleetioConfigStore'
import { buildSeedDataset } from '../data/seedOrganizations'

test('Fleetio defaults provide lookup statuses, tools, warranties, and custom records', () => {
  const seed = buildSeedDataset('production')
  const kaveriOrg = seed.organizations.find((o) => o.id === 'org-kaveri')!
  const kaveriVehicles = seed.vehicles.filter((v) => v.organizationId === kaveriOrg.id)

  assert.ok(DEFAULT_FLEETIO_SETTINGS.vehicleStatuses.length >= 4)
  assert.ok(DEFAULT_FLEETIO_SETTINGS.vehicleTypes.length >= 5)
  assert.ok(DEFAULT_FLEETIO_SETTINGS.workOrderStatuses.length >= 5)

  const tools = buildDefaultTools(kaveriOrg.city)
  assert.equal(tools.length, 4)
  assert.ok(tools[0].serialNumber.startsWith('DM-'))

  const warranties = buildDefaultWarranties(kaveriVehicles)
  assert.ok(warranties.length > 0)
  assert.equal(warranties[0].registrationNumber, kaveriVehicles[0].registrationNumber)

  const records = buildDefaultCustomRecords(kaveriVehicles)
  assert.equal(records.length, 3)
})

test('Onboarding checklist computes accurate progress count out of 8', () => {
  const seed = buildSeedDataset('production')
  const org = seed.organizations[0]
  const vehicles = seed.vehicles.filter((v) => v.organizationId === org.id)
  const workOrders = seed.workOrders.filter((w) => w.organizationId === org.id)
  const parts = seed.partsInventory.filter((p) => p.organizationId === org.id)

  const items = computeOnboardingChecklist({
    org,
    vehicles,
    workOrders,
    partsInventory: parts,
    hasExploredIntegrations: true,
    hasVisitedReports: false,
  })

  assert.equal(items.length, 8)
  const completedCount = items.filter((i) => i.completed).length
  assert.equal(completedCount, 7)

  const emptyItems = computeOnboardingChecklist({
    org: { ...org, name: '', city: '', timezone: '' },
    vehicles: [],
    workOrders: [],
    partsInventory: [],
    hasExploredIntegrations: false,
    hasVisitedReports: false,
  })
  assert.equal(emptyItems.filter((i) => i.completed).length, 0)
})
