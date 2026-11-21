import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { ensureFleetSchemaAndMigrate } from './fleetDb.ts'
import { createVehicleFinanceRecord, ensureFinanceSchemaAndSeed } from './financeDb.ts'
import {
  addDepositDeductionOrRefund,
  createContractAmendment,
  createMaintenanceRuleOrAllocation,
  createOrUpdateDeposit,
  createVehicleContract,
  createVehicleHandoverRecord,
  ensureContractsSchemaAndSeed,
  getContractsWorkspace,
  recordContractPayment,
  reviewContractAmendment,
  transitionContractStatus,
  updateOrgContractPermissions,
  upsertFleetPartner,
  upsertIndividualOwner,
} from './contractsDb.ts'

function setupTestDb(): DatabaseSync {
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
      organization_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  const insertOrg = db.prepare(`
    INSERT INTO organizations (
      id, name, code, city, state, timezone, plan_id, vehicle_limit, driver_limit,
      status, payment_status, subscription_start_date, subscription_expiry_date, created_at
    ) VALUES (?, ?, ?, ?, ?, 'Asia/Kolkata', 'growth', 75, 120, 'active', 'paid', '2026-01-01', '2027-01-01', '2026-01-01T00:00:00Z')
  `)
  insertOrg.run('org-kaveri', 'Kaveri Logistics', 'KAV-TN', 'Chennai', 'TN')
  insertOrg.run('org-deccan', 'Deccan EV', 'DEC-KA', 'Bengaluru', 'KA')

  ensureFleetSchemaAndMigrate(db)
  ensureFinanceSchemaAndSeed(db)
  ensureContractsSchemaAndSeed(db)
  return db
}

test('database contracts persistence enforces tenant isolation, permissions, versioning, deposits, splits, and finance isolation', () => {
  const db = setupTestDb()
  const ownerActor = { userId: 'u-k1', fullName: 'Karthikeyan R', role: 'org_admin' as const }
  const mgrActor = { userId: 'u-k2', fullName: 'Priya Sundar', role: 'fleet_manager' as const }
  const financeActor = { userId: 'u-k4', fullName: 'Lakshmi', role: 'finance' as const }
  const superAdmin = { userId: 'u-sa', fullName: 'SuperAdmin', role: 'platform_admin' as const }

  // 1. Seeded workspace has mixed ownership + 4 contracts + 2 partners + 2 owners
  const wsOwner = getContractsWorkspace(db, 'org-kaveri', 'org_admin')
  assert.equal(wsOwner.partners.length, 2)
  assert.equal(wsOwner.owners.length, 2)
  assert.equal(wsOwner.contracts.length, 4)

  // 2. Tenant isolation: org-deccan sees 0 org-kaveri partners/contracts
  const wsDeccan = getContractsWorkspace(db, 'org-deccan', 'org_admin')
  assert.equal(wsDeccan.partners.length, 0)
  assert.equal(wsDeccan.contracts.length, 0)

  // 3. PII / bank masking: fleet_manager and platform_admin cannot see unmasked PAN/IFSC/bank account holder
  const wsMgr = getContractsWorkspace(db, 'org-kaveri', 'fleet_manager')
  assert.equal(wsMgr.owners[0].panMasked, 'XXXXXXXXXX')
  assert.equal(wsMgr.partners[0].bankAccountHolder, 'Authorized Finance Only')
  assert.notEqual(wsOwner.owners[0].panMasked, 'XXXXXXXXXX')

  // 4. Platform admin and fleet_manager cannot approve pending contract without grant
  assert.throws(() => transitionContractStatus(db, 'org-kaveri', superAdmin, 'con-k-4', 'active'), /permission/i)
  assert.throws(() => transitionContractStatus(db, 'org-kaveri', mgrActor, 'con-k-4', 'active'), /permission/i)

  // Owner grants approve_contracts to fleet_manager, then manager succeeds
  updateOrgContractPermissions(db, 'org-kaveri', ownerActor, [
    { role: 'fleet_manager', permissionKey: 'approve_contracts', allowed: true },
  ])
  const approvedC4 = transitionContractStatus(db, 'org-kaveri', mgrActor, 'con-k-4', 'active', 'Authorized by owner rule')
  assert.equal(approvedC4.status, 'active')

  // 5. Company Loan blocked on third-party vehicles (v-kc1 contracted_fleet, v-ki1 individual_owner)
  assert.throws(
    () =>
      createVehicleFinanceRecord(db, 'org-kaveri', { userId: 'u-k4', fullName: 'Lakshmi', role: 'finance' }, {
        vehicleId: 'v-kc1',
        vehicleRegistration: 'TN09CR4410',
        vehicleName: 'Tata Ultra',
        vehicleMakeModel: 'Tata Ultra T.7',
        vehicleOwnership: 'owned',
        bankName: 'HDFC Bank Commercial',
        loanAccountNumber: '9988776655',
        loanReferenceNumber: 'REF-1',
        loanType: 'term_loan',
        principalAmount: 1000000,
        downPayment: 100000,
        interestRateAnnualPct: 9.5,
        interestType: 'reducing_balance',
        loanStartDate: '2026-01-01',
        loanTenureMonths: 36,
        numberOfInstalments: 36,
        firstEmiDate: '2026-02-01',
        paymentMethod: 'nach',
      }),
    /company-owned/i,
  )

  // 6. Overlapping contract prevented unless override note provided
  const partner = upsertFleetPartner(db, 'org-kaveri', ownerActor, {
    companyName: 'Vellore Logistics Co',
    gstin: '33AAACV9988K1Z1',
    businessRegistrationNo: 'REG-VEL-99',
    mobile: '+91 98409 11002',
    email: 'ops@vellore.in',
  })
  assert.throws(
    () =>
      createVehicleContract(db, 'org-kaveri', ownerActor, {
        contractName: 'Duplicate Vehicle Overlap Test',
        contractCategory: 'fixed_monthly_rental',
        supplierType: 'fleet_partner',
        fleetPartnerId: partner.id,
        agreementRefNumber: 'REF-OV',
        agreementDate: '2026-06-01',
        startDate: '2026-06-01',
        expiryDate: '2026-12-31',
        durationMonths: 7,
        financialTerms: wsOwner.contracts[0].financialTerms,
        contractConditions: wsOwner.contracts[0].contractConditions,
        vehicles: [{ vehicleId: 'v-kc1' }],
      }),
    /overlapping/i,
  )

  // 7. Deposit deduction + refund calculation in DB
  const dep = createOrUpdateDeposit(db, 'org-kaveri', financeActor, {
    contractId: 'con-k-4',
    depositType: 'refundable_security_deposit',
    requiredAmountInr: 50000,
    paidAmountInr: 40000,
    paymentReference: 'DEP-EV-40K',
  })
  assert.equal(dep.outstandingAmountInr, 10000)
  const afterDed = addDepositDeductionOrRefund(db, 'org-kaveri', ownerActor, dep.id, 'deduct', {
    amountInr: 6500,
    reason: 'Charging cable replacement upon inspection',
  })
  assert.equal(afterDed.deductedAmountInr, 6500)
  const afterRefund = addDepositDeductionOrRefund(db, 'org-kaveri', ownerActor, dep.id, 'settle_refund', {})
  assert.equal(afterRefund.refundedAmountInr, 33500)
  assert.equal(afterRefund.status, 'closed')

  // 8. Amendment versioning creates v3 without modifying historical paid cp-k-1 (₹64,000)
  const amd = createContractAmendment(db, 'org-kaveri', ownerActor, {
    contractId: 'con-k-1',
    title: 'Annual CPI Adjustment',
    reason: 'Revised freight rate to Rs 72,000',
    amendmentType: 'rental_amount',
    revisedValues: { monthlyRental: 72000 },
    effectiveDate: '2026-12-01',
    recalculateFutureSchedule: true,
    submitImmediately: true,
  })
  const rev = reviewContractAmendment(db, 'org-kaveri', ownerActor, amd.id, 'approve')
  assert.equal(rev.contract.currentVersion, 3)
  assert.equal(rev.contract.financialTerms.monthlyRental, 72000)
  const afterAmdWs = getContractsWorkspace(db, 'org-kaveri', 'org_admin')
  const histPay = afterAmdWs.payments.find((p) => p.id === 'cp-k-1')
  assert.equal(histPay?.paymentAmountInr, 64000)

  // 9. Maintenance single-transaction split in DB
  const postSplitWs = createMaintenanceRuleOrAllocation(db, 'org-kaveri', ownerActor, 'allocation', {
    contractId: 'con-k-1',
    vehicleId: 'v-kc1',
    maintenanceCategory: 'brakes',
    description: 'Air compressor & brake chamber split',
    totalRepairAmountInr: 10000,
    responsibleParty: 'shared',
    orgSharePct: 70,
  })
  const latestAlloc = postSplitWs.maintenanceAllocations[0]
  assert.equal(latestAlloc.orgShareInr, 7000)
  assert.equal(latestAlloc.supplierShareInr, 3000)

  // 10. Individual owner creation + Handover return
  const indOwner = upsertIndividualOwner(db, 'org-kaveri', ownerActor, {
    fullName: 'Kannan S',
    mobile: '+91 97890 12345',
    panNumber: 'ABCDE1234F',
    aadhaarNumber: '123456789012',
    bankAccountNumber: '9876543210',
  })
  assert.equal(indOwner.panMasked, 'ABXXXX234F')

  const retHandover = createVehicleHandoverRecord(db, 'org-kaveri', ownerActor, {
    contractId: 'con-k-1',
    vehicleId: 'v-kc1',
    recordType: 'vehicle_return',
    linkedInitialHandoverId: 'ho-k-1',
    odometerKm: 52000,
    fuelLevelPct: 70,
    exteriorCondition: 'good',
    interiorCondition: 'good',
    tyreCondition: 'good',
    accessoriesChecklist: ['Spare Wheel', 'Hydraulic Jack'],
    equipmentChecklist: ['GPS Mount', 'Fastag'],
    documentChecklist: ['RC Book', 'Insurance'],
    supplierRepresentative: 'Murugan',
    receivingRepresentative: 'Karthikeyan R',
    supplierAckName: 'Murugan',
    receivingAckName: 'Karthikeyan R',
  })
  assert.equal(retHandover.recordType, 'vehicle_return')

  const payRec = recordContractPayment(db, 'org-kaveri', financeActor, {
    contractId: 'con-k-3',
    paymentKind: 'monthly_rental',
    billingPeriod: 'Nov 2026',
    dueDate: '2026-12-07',
    paymentAmountInr: 52000,
    paidAmountInr: 52000,
    paymentMethod: 'neft',
    paymentReference: 'NEFT-RB-11',
  })
  assert.equal(payRec.outstandingAmountInr, 0)
})
