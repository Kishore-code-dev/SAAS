import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildSeedDataset } from '../src/data/seedOrganizations.ts'
import {
  deleteApiKey,
  ensureFleetSchemaAndMigrate,
  getOrgFleetDataset,
  getOrgFleetModules,
  getOrgOperationalCounts,
  insertApiKey,
  insertCustomDashboard,
  insertCustomRecord,
  insertFleetRecall,
  insertFleetTool,
  insertFleetWarranty,
  insertInspectionForm,
  insertInspectionSchedule,
  insertServiceProgram,
  insertServiceTask,
  insertWebhook,
  saveOrgFleetDataset,
  toggleWebhookActive,
  updateFleetRecallStatus,
  updateFleetToolStatus,
  updateFleetWorkspaceSettings,
} from './fleetDb.ts'
import { extractSchemaSnapshot, generateFullSchemaPdfBuffer } from './schemaPdf.ts'
import { syncDbsReferenceFolder } from './dbsSync.ts'

function createSeededRelationalTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      timezone TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      vehicle_limit INTEGER NOT NULL,
      driver_limit INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      subscription_start_date TEXT NOT NULL,
      subscription_expiry_date TEXT NOT NULL,
      grace_period_until TEXT,
      suspension_reason TEXT,
      owner_name TEXT,
      owner_email TEXT,
      owner_phone TEXT,
      gstin TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE org_fleet_blobs (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  const seed = buildSeedDataset('production')
  const nowIso = '2026-11-19T00:00:00.000Z'

  const insertOrg = db.prepare(`
    INSERT INTO organizations (
      id, name, code, city, state, timezone, plan_id, vehicle_limit, driver_limit,
      status, payment_status, subscription_start_date, subscription_expiry_date,
      owner_name, owner_email, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertBlob = db.prepare(`
    INSERT INTO org_fleet_blobs (organization_id, payload_json, updated_at) VALUES (?, ?, ?)
  `)

  for (const org of seed.organizations) {
    insertOrg.run(
      org.id,
      org.name,
      org.code,
      org.city,
      org.state,
      org.timezone,
      org.planId,
      org.vehicleLimit,
      org.driverLimit,
      org.status,
      org.paymentStatus,
      org.subscriptionStartDate,
      org.subscriptionExpiryDate,
      org.ownerName ?? null,
      org.ownerEmail ?? null,
      org.createdAt,
    )

    const blob = {
      vehicles: seed.vehicles.filter((v) => v.organizationId === org.id),
      drivers: seed.drivers.filter((d) => d.organizationId === org.id),
      driverEvents: seed.driverEvents.filter((e) => e.organizationId === org.id),
      driverAssignments: seed.driverAssignments.filter((a) => a.organizationId === org.id),
      trips: seed.trips.filter((t) => t.organizationId === org.id),
      fuelTransactions: seed.fuelTransactions.filter((f) => f.organizationId === org.id),
      maintenanceRecords: seed.maintenanceRecords.filter((m) => m.organizationId === org.id),
      inspections: seed.inspections.filter((i) => i.organizationId === org.id),
      serviceSchedules: seed.serviceSchedules.filter((s) => s.organizationId === org.id),
      smallIssues: seed.smallIssues.filter((i) => i.organizationId === org.id),
      workOrders: seed.workOrders.filter((w) => w.organizationId === org.id),
      partsInventory: seed.partsInventory.filter((p) => p.organizationId === org.id),
      suppliers: seed.suppliers.filter((s) => s.organizationId === org.id),
      purchaseOrders: seed.purchaseOrders.filter((p) => p.organizationId === org.id),
      inventoryTransactions: seed.inventoryTransactions.filter((t) => t.organizationId === org.id),
      workshops: seed.workshops.filter((w) => w.organizationId === org.id),
      invoices: seed.invoices.filter((inv) => inv.organizationId === org.id),
      payments: seed.payments.filter((p) => p.organizationId === org.id),
      documentVault: seed.documentVault.filter((d) => d.organizationId === org.id),
      tyrePositions: seed.tyrePositions.filter((tp) =>
        seed.vehicles.some((v) => v.id === tp.vehicleId && v.organizationId === org.id),
      ),
      alerts: seed.alerts.filter((a) => a.organizationId === org.id),
      auditLogs: seed.auditLogs.filter((a) => a.organizationId === org.id),
      reports: seed.reports.filter((r) => r.organizationId === org.id),
      members: seed.members.filter((m) => m.organizationId === org.id),
    }
    insertBlob.run(org.id, JSON.stringify(blob), nowIso)
  }

  ensureFleetSchemaAndMigrate(db)
  return db
}

test('ensureFleetSchemaAndMigrate migrates org_fleet_blobs into 25 normalized tables + 12 extension module tables idempotently', () => {
  const db = createSeededRelationalTestDb()

  // Calling a second time must remain idempotent without duplicating records
  ensureFleetSchemaAndMigrate(db)

  const kaveri = getOrgFleetDataset(db, 'org-kaveri')
  const deccan = getOrgFleetDataset(db, 'org-deccan')

  assert.equal(kaveri.vehicles.length, 8)
  assert.ok(kaveri.drivers.length >= 4)
  assert.ok(kaveri.workOrders.length >= 1)
  assert.ok(kaveri.partsInventory.length >= 1)
  assert.ok(kaveri.tyrePositions.length >= 1)
  assert.ok(kaveri.vehicles.every((v) => v.components.length > 0))

  assert.ok(deccan.vehicles.length >= 3)
  assert.ok(deccan.vehicles.every((v) => v.organizationId === 'org-deccan'))
  assert.ok(kaveri.vehicles.every((v) => v.organizationId === 'org-kaveri'))

  const kaveriCounts = getOrgOperationalCounts(db, 'org-kaveri')
  assert.equal(kaveriCounts.totalVehicles, 8)
  assert.equal(kaveriCounts.totalDrivers, kaveri.drivers.length)

  const kaveriModules = getOrgFleetModules(db, 'org-kaveri')
  const deccanModules = getOrgFleetModules(db, 'org-deccan')
  assert.equal(kaveriModules.tools.length, 4)
  assert.equal(deccanModules.tools.length, 4)
  assert.ok(kaveriModules.warranties.length >= 1)
  assert.ok(kaveriModules.serviceTasks.length >= 5)
  assert.ok(kaveriModules.servicePrograms.length >= 2)
  assert.ok(kaveriModules.inspectionForms.length >= 3)
  assert.ok(kaveriModules.inspectionSchedules.length >= 3)
  assert.ok(kaveriModules.recalls.length >= 2)
  assert.ok(kaveriModules.apiKeys.length >= 1)
  assert.ok(kaveriModules.webhooks.length >= 1)
  assert.ok(kaveriModules.customDashboards.length >= 2)
})

test('saveOrgFleetDataset persists mutations transactionally and enforces vehicle & organization ON DELETE CASCADE', () => {
  const db = createSeededRelationalTestDb()
  const before = getOrgFleetDataset(db, 'org-kaveri')

  const removedVehicleId = before.vehicles[0].id
  const updatedVehicles = before.vehicles.slice(1)
  updatedVehicles[0] = {
    ...updatedVehicles[0],
    odometerKm: updatedVehicles[0].odometerKm + 420,
  }

  saveOrgFleetDataset(db, 'org-kaveri', {
    ...before,
    vehicles: updatedVehicles,
  })

  const after = getOrgFleetDataset(db, 'org-kaveri')
  assert.equal(after.vehicles.length, 7)
  assert.equal(after.vehicles[0].odometerKm, before.vehicles[1].odometerKm + 420)
  assert.equal(after.vehicles.some((v) => v.id === removedVehicleId), false)

  // Vehicle deletion must not leave orphaned components or tyres
  const orphanComponents = db
    .prepare('SELECT COUNT(*) AS count FROM fleet_vehicle_components WHERE vehicle_id = ?')
    .get(removedVehicleId) as { count: number }
  const orphanTyres = db
    .prepare('SELECT COUNT(*) AS count FROM fleet_tyre_positions WHERE vehicle_id = ?')
    .get(removedVehicleId) as { count: number }
  assert.equal(orphanComponents.count, 0)
  assert.equal(orphanTyres.count, 0)

  // Deleting an organization cascades across all tenant tables without affecting other orgs
  db.prepare('DELETE FROM organizations WHERE id = ?').run('org-deccan')
  const deccanVehLeft = db
    .prepare('SELECT COUNT(*) AS count FROM fleet_vehicles WHERE organization_id = ?')
    .get('org-deccan') as { count: number }
  const deccanToolsLeft = db
    .prepare('SELECT COUNT(*) AS count FROM fleet_tools WHERE organization_id = ?')
    .get('org-deccan') as { count: number }
  assert.equal(deccanVehLeft.count, 0)
  assert.equal(deccanToolsLeft.count, 0)

  // Kaveri remains untouched
  assert.equal(getOrgOperationalCounts(db, 'org-kaveri').totalVehicles, 7)
})

test('Fleetio extension module SQLite CRUD maintains strict tenant isolation', () => {
  const db = createSeededRelationalTestDb()

  const newTool = insertFleetTool(db, 'org-kaveri', {
    name: 'Digital Torque Wrench 600Nm',
    serialNumber: 'TW-9910',
    category: 'Workshop Lifting',
    assignedTo: 'Bay 2',
    location: 'Chennai Hub',
    status: 'in_service',
    purchaseCostInr: 18900,
    nextCalibrationDate: '2027-06-30',
  })
  assert.equal(updateFleetToolStatus(db, 'org-deccan', newTool.id, 'retired'), false)
  assert.equal(updateFleetToolStatus(db, 'org-kaveri', newTool.id, 'checked_out'), true)

  const warranty = insertFleetWarranty(db, 'org-kaveri', {
    assetName: 'Tata Ace Gold CNG',
    registrationNumber: 'TN 38 AB 1234',
    provider: 'Tata Motors Shield',
    coverageType: 'Powertrain',
    startDate: '2026-01-01',
    expiryDate: '2030-01-01',
    maxOdometerKm: 300000,
    claimStatus: 'active',
  })
  assert.equal(warranty.organizationId, 'org-kaveri')

  const customRec = insertCustomRecord(db, 'org-kaveri', {
    recordType: 'Weighbridge Slip',
    vehicleOrDriver: 'TN 38 AB 1234',
    referenceCode: 'WB-2026-771',
    recordedDate: '2026-11-19',
    amountInr: 450,
    status: 'verified',
    notes: 'Sriperumbudur checkpost weighment verified',
  })
  assert.equal(customRec.referenceCode, 'WB-2026-771')

  const task = insertServiceTask(db, 'org-kaveri', {
    code: 'VMRS-019-003',
    title: 'Air Dryer Cartridge Replacement',
    area: 'Vehicle Health',
    avgHours: 1.2,
    estCostInr: 2600,
    active: true,
  })
  assert.equal(task.code, 'VMRS-019-003')

  const prog = insertServiceProgram(db, 'org-kaveri', {
    name: 'CNG Urban Last-Mile Check',
    powertrain: 'ICE',
    cadence: 'Every 7,500 km or 60 days',
    intervalKm: 7500,
    intervalDays: 60,
    active: true,
  })
  assert.equal(prog.intervalKm, 7500)

  const form = insertInspectionForm(db, 'org-kaveri', {
    title: 'Reefer Temperature & Seal Checklist',
    itemsCount: 12,
    lastUpdated: '2026-11-19',
    active: true,
  })
  const sched = insertInspectionSchedule(db, 'org-kaveri', {
    name: 'Daily Reefer Check',
    frequency: 'Every 12 Hours',
    scope: 'Cold Chain Vehicles',
    formId: form.id,
    formTitle: form.title,
    active: true,
  })
  assert.equal(sched.formId, form.id)

  const recall = insertFleetRecall(db, 'org-kaveri', {
    campaign: 'OEM Brake Valve Pin Recall 2026',
    oem: 'Ashok Leyland',
    targetMake: 'ashok',
    severity: 'high',
    status: 'Monitoring',
    issuedDate: '2026-11-18',
  })
  assert.equal(updateFleetRecallStatus(db, 'org-deccan', recall.id, 'Completed'), false)
  assert.equal(updateFleetRecallStatus(db, 'org-kaveri', recall.id, 'Completed'), true)

  const key = insertApiKey(db, 'org-kaveri', {
    label: 'SAP ERP Finance Sync',
    prefix: 'dm_live_sap••••9901',
    scope: 'read_only',
    createdAt: '2026-11-19T00:00:00.000Z',
    lastUsedAt: 'Never',
  })
  assert.equal(deleteApiKey(db, 'org-deccan', key.id), false)
  assert.equal(deleteApiKey(db, 'org-kaveri', key.id), true)

  const webhook = insertWebhook(db, 'org-kaveri', {
    url: 'https://hooks.kaveri.in/fleet-events',
    events: ['work_order.completed'],
    active: true,
    lastDeliveryStatus: 200,
  })
  assert.equal(toggleWebhookActive(db, 'org-kaveri', webhook.id, false), true)

  const dash = insertCustomDashboard(db, 'org-kaveri', {
    name: 'Cost & Fuel Variance',
    widgets: 'Fuel Efficiency, Overdue EMIs, Workshop TAT',
    defaultView: false,
  })
  assert.equal(dash.name, 'Cost & Fuel Variance')

  const updatedSettings = updateFleetWorkspaceSettings(db, 'org-kaveri', {
    workspaceSettings: { speedCeilingKmh: 75, digilockerEnabled: true },
    fleetioSettings: { serviceReminderLeadDays: 21 },
    visitedReports: true,
  })
  assert.equal(updatedSettings.workspaceSettings.speedCeilingKmh, 75)
  assert.equal(updatedSettings.workspaceSettings.digilockerEnabled, true)
  assert.equal(updatedSettings.fleetioSettings.serviceReminderLeadDays, 21)
  assert.equal(updatedSettings.visitedReports, true)

  const kaveriModAfter = getOrgFleetModules(db, 'org-kaveri')
  const deccanModAfter = getOrgFleetModules(db, 'org-deccan')

  assert.equal(kaveriModAfter.tools.find((t) => t.id === newTool.id)?.status, 'checked_out')
  assert.equal(kaveriModAfter.recalls.find((r) => r.id === recall.id)?.status, 'Completed')
  assert.equal(kaveriModAfter.webhooks.find((w) => w.id === webhook.id)?.active, false)
  assert.equal(kaveriModAfter.apiKeys.some((k) => k.id === key.id), false)
  assert.equal(kaveriModAfter.workspaceSettings.speedCeilingKmh, 75)

  // Deccan's modules remain untouched
  assert.equal(deccanModAfter.tools.some((t) => t.id === newTool.id), false)
  assert.equal(deccanModAfter.workspaceSettings.speedCeilingKmh, 80)
  assert.equal(deccanModAfter.visitedReports, false)
})

test('extractSchemaSnapshot and generateFullSchemaPdfBuffer produce a complete multi-page PDF document', async () => {
  const db = createSeededRelationalTestDb()
  const snap = extractSchemaSnapshot(db)

  assert.ok(snap.totalTables >= 39)
  assert.ok(snap.totalColumns >= 250)
  assert.ok(snap.typeDefinitions.some((t) => t.name === 'Vehicle'))
  assert.ok(snap.typeDefinitions.some((t) => t.name === 'VehicleFinanceRecord'))

  const pdfBuffer = await generateFullSchemaPdfBuffer(db, {
    organizationName: 'Kaveri Logistics Pvt Ltd',
    organizationCode: 'KAV-TN',
  })
  assert.ok(Buffer.isBuffer(pdfBuffer))
  assert.ok(pdfBuffer.length > 15000)
  assert.equal(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-')
  const pageMatches = pdfBuffer.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []
  assert.ok(pageMatches.length >= 18 && pageMatches.length <= 55, `Unexpected PDF page count: ${pageMatches.length}`)
})

test('syncDbsReferenceFolder creates atomic SQLite copy, DDL, JSON export, README, and PDF', async () => {
  const db = createSeededRelationalTestDb()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drivemitra-dbs-test-'))
  try {
    const result = await syncDbsReferenceFolder(db, { targetDir: tempDir, regeneratePdf: true })
    assert.equal(result.integrity, 'ok')
    assert.ok(result.totalTables >= 39)
    assert.ok(result.totalRows > 0)
    assert.equal(result.pdfRegenerated, true)

    for (const file of ['drivemitra.db', 'schema.sql', 'full_data_export.json', 'README.md', 'DriveMitra_Full_Database_Architecture.pdf']) {
      assert.equal(fs.existsSync(path.join(tempDir, file)), true, `Missing ${file}`)
    }

    const schemaText = fs.readFileSync(path.join(tempDir, 'schema.sql'), 'utf8')
    assert.ok(schemaText.includes('CREATE TABLE fleet_vehicles'))

    // Calling again without DDL changes should detect schemaChanged = false
    const second = await syncDbsReferenceFolder(db, { targetDir: tempDir })
    assert.equal(second.schemaChanged, false)
    assert.equal(second.pdfRegenerated, false)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
