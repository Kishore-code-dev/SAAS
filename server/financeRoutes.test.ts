import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import {
  correctFinancePayment,
  createVehicleFinanceRecord,
  ensureFinanceSchemaAndSeed,
  getFinanceWorkspace,
  reconcileFinancePayment,
  recordEmiPayment,
  updateFinanceSettings,
  updateVehicleFinanceTerms,
  upsertInstitution,
  type FinanceActor,
} from './financeDb'

function createIsolatedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
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
    CREATE TABLE document_files (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
  db.prepare(`
    INSERT INTO organizations (
      id, name, code, city, state, timezone, plan_id, vehicle_limit, driver_limit,
      status, payment_status, subscription_start_date, subscription_expiry_date, owner_email, created_at
    ) VALUES ('org-kaveri', 'Kaveri Logistics', 'KVL-TN', 'Chennai', 'TN', 'Asia/Kolkata', 'growth', 75, 120, 'active', 'paid', '2026-01-01', '2027-01-01', 'owner@kaveri.in', '2026-01-01T00:00:00Z')
  `).run()
  ensureFinanceSchemaAndSeed(db)
  return db
}

const ADMIN_ACTOR: FinanceActor = {
  userId: 'u-k1',
  username: 'kaveri.owner',
  fullName: 'Karthikeyan R',
  role: 'org_admin',
}

test('SQLite transactional finance lifecycle: create, partial pay, double-pay block, reconcile, correct, restructure, foreclose, masking', () => {
  const db = createIsolatedDb()

  // 1. Seeded workspace exists and masks sensitive identifiers for fleet_manager/viewer
  const maskedView = getFinanceWorkspace(db, 'org-kaveri', 'fleet_manager', 'Asia/Kolkata')
  assert.ok(maskedView.records.length >= 5)
  assert.equal(maskedView.maskedForRole, true)
  assert.ok(maskedView.records[0].loanAccountNumber.startsWith('••••'))

  const unmaskedView = getFinanceWorkspace(db, 'org-kaveri', 'org_admin', 'Asia/Kolkata')
  assert.equal(unmaskedView.maskedForRole, false)
  assert.ok(!unmaskedView.records[0].loanAccountNumber.startsWith('••••'))

  // 2. Add financial institution
  const inst = upsertInstitution(db, 'org-kaveri', ADMIN_ACTOR, {
    bankName: 'Kotak Mahindra Commercial',
    institutionType: 'bank',
    branch: 'Anna Salai, Chennai',
    relationshipManager: 'Prakash V',
    contactNumber: '+91 98400 77889',
    email: 'prakash.v@kotak.com',
    ifscCode: 'KKBK0000462',
    defaultPaymentMethod: 'nach',
  })
  assert.equal(inst.bankName, 'Kotak Mahindra Commercial')

  // 3. Create vehicle finance record -> generates EMI schedule
  const created = createVehicleFinanceRecord(db, 'org-kaveri', ADMIN_ACTOR, {
    vehicleId: 'v-k6',
    vehicleRegistration: 'TN 45 CN 7710',
    vehicleName: 'Mahindra Bolero Pik-Up CNG',
    vehicleMakeModel: 'Mahindra Bolero Pik-Up CNG',
    vehicleOwnership: 'Financed',
    institutionId: inst.id,
    bankName: inst.bankName,
    branch: inst.branch,
    relationshipManager: inst.relationshipManager,
    contactNumber: inst.contactNumber,
    email: inst.email,
    loanAccountNumber: 'KKBK882100449922',
    ifscCode: inst.ifscCode,
    loanReferenceNumber: 'KOTAK-CV-2026-501',
    loanType: 'commercial_vehicle_loan',
    principalAmount: 900000,
    downPayment: 100000,
    interestRateAnnualPct: 9.0,
    interestType: 'reducing_balance',
    loanStartDate: '2026-04-01',
    loanTenureMonths: 6,
    numberOfInstalments: 6,
    firstEmiDate: '2026-05-01',
    paymentMethod: 'nach',
  })
  assert.equal(created.instalments.length, 6)
  assert.equal(created.record.netFinancedAmount, 800000)

  // 4. Partial payment + manual late fee on EMI #1
  const emi1 = created.instalments[0]
  const partialRes = recordEmiPayment(db, 'org-kaveri', emi1.id, ADMIN_ACTOR, {
    amountInr: 50000,
    manualLateFeeInr: 400,
    paymentDate: '2026-05-02',
    paymentMethod: 'neft',
    bankTransactionRef: 'UTRKKBK123456',
    notes: 'Partial NEFT batch 1',
  })
  assert.equal(partialRes.instalment.status, 'partially_paid')
  assert.equal(partialRes.instalment.lateFeeInr, 400)

  // 5. Reconcile partial payment + settle remaining balance
  const reconciled = reconcileFinancePayment(
    db,
    'org-kaveri',
    partialRes.payment.id,
    ADMIN_ACTOR,
    'reconciled',
    'Verified on Kotak May statement',
  )
  assert.equal(reconciled.reconciliationStatus, 'reconciled')

  const remainingToPay = partialRes.instalment.remainingAmount
  const fullRes = recordEmiPayment(db, 'org-kaveri', emi1.id, ADMIN_ACTOR, {
    amountInr: remainingToPay,
    paymentDate: '2026-05-04',
    paymentMethod: 'neft',
    bankTransactionRef: 'UTRKKBK123999',
  })
  assert.equal(fullRes.instalment.status, 'paid')
  assert.equal(fullRes.instalment.remainingAmount, 0)

  // Double-payment guard
  assert.throws(() => {
    recordEmiPayment(db, 'org-kaveri', emi1.id, ADMIN_ACTOR, {
      amountInr: 1000,
      paymentDate: '2026-05-05',
      paymentMethod: 'upi',
      bankTransactionRef: 'UPIDUP001',
    })
  }, /already paid/i)

  // 6. Payment correction preserves audit history
  const corrected = correctFinancePayment(db, 'org-kaveri', fullRes.payment.id, ADMIN_ACTOR, {
    correctedAmountInr: remainingToPay - 500,
    bankTransactionRef: 'UTRKKBK123999-REV',
    reason: 'Bank statement differed by ₹500',
  })
  assert.equal(corrected.amountInr, remainingToPay - 500)

  // Settle the remaining ₹500 so EMI #1 is cleanly paid prior to future restructuring
  recordEmiPayment(db, 'org-kaveri', emi1.id, ADMIN_ACTOR, {
    amountInr: 500,
    paymentDate: '2026-05-06',
    paymentMethod: 'upi',
    bankTransactionRef: 'UPISETTLE500',
  })

  // 7. Restructuring requires confirmScheduleRevision
  assert.throws(() => {
    updateVehicleFinanceTerms(db, 'org-kaveri', created.record.id, ADMIN_ACTOR, {
      mode: 'restructure',
      reason: 'Extend tenure to 10 EMIs',
      numberOfInstalments: 10,
      confirmScheduleRevision: false,
    })
  }, /confirmScheduleRevision/i)

  const restructured = updateVehicleFinanceTerms(db, 'org-kaveri', created.record.id, ADMIN_ACTOR, {
    mode: 'restructure',
    reason: 'Lower monthly outflow after tenure extension',
    interestRateAnnualPct: 8.5,
    interestType: 'reducing_balance',
    numberOfInstalments: 10,
    firstEmiDate: '2026-12-05',
    confirmScheduleRevision: true,
  })
  assert.equal(restructured.financeStatus, 'restructured')

  // 8. Foreclosure marks loan foreclosed & outstanding principal 0 while retaining history
  const foreclosed = updateVehicleFinanceTerms(db, 'org-kaveri', created.record.id, ADMIN_ACTOR, {
    mode: 'foreclose',
    reason: 'Fleet owner early settlement discount',
    settlementAmountInr: 650000,
    settlementDate: '2026-06-15',
    confirmScheduleRevision: true,
  })
  assert.equal(foreclosed.financeStatus, 'foreclosed')
  assert.equal(foreclosed.outstandingPrincipal, 0)

  // 9. Update Finance Notification Settings & verify Update History logs everything
  const nextSettings = updateFinanceSettings(
    db,
    'org-kaveri',
    ADMIN_ACTOR,
    { reminderDaysBefore: [15, 7, 3, 1, 0], dueSoonWindowDays: 10 },
    'Extend due soon watch window to 10 days',
  )
  assert.equal(nextSettings.dueSoonWindowDays, 10)

  const afterWs = getFinanceWorkspace(db, 'org-kaveri', 'org_admin', 'Asia/Kolkata')
  assert.ok(afterWs.updateHistory.length >= 4)
  assert.ok(afterWs.payments.some((p) => p.isCorrected === true))
})
