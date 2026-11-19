import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyEmiPaymentCalculation,
  buildRestructuredSchedule,
  computeStandardEmiAmount,
  deriveEmiStatus,
  evaluateFinanceAlerts,
  generateAmortisationSchedule,
  maskAccountNumber,
  maskFinanceWorkspaceForRole,
  summarizeVehicleFinanceRecord,
} from './financeEngine'
import type {
  FinanceNotificationSettings,
  VehicleFinanceRecord,
} from '../types/finance'

function makeSampleRecord(overrides: Partial<VehicleFinanceRecord> = {}): VehicleFinanceRecord {
  return {
    id: 'fin-test-1',
    organizationId: 'org-kaveri',
    vehicleId: 'v-k1',
    institutionId: 'inst-hdfc',
    vehicleRegistration: 'TN 38 AB 1234',
    vehicleName: 'Tata Ace Gold Diesel+',
    vehicleMakeModel: 'Tata Ace Gold Diesel+',
    vehicleOwnership: 'Financed',
    bankName: 'HDFC Bank Commercial',
    institutionName: 'HDFC Bank Ltd',
    branch: 'Guindy Commercial Hub',
    relationshipManager: 'Raghavan S',
    contactNumber: '+91 98400 11223',
    email: 'raghavan.cv@hdfcbank.com',
    ifscCode: 'HDFC0000128',
    loanAccountNumber: 'HDFC901288334411',
    loanAccountMasked: '••••••••••••4411',
    loanReferenceNumber: 'LN-CV-2026-001',
    loanType: 'commercial_vehicle_loan',
    principalAmount: 1200000,
    downPayment: 200000,
    netFinancedAmount: 1000000,
    interestRateAnnualPct: 9.5,
    interestType: 'reducing_balance',
    loanStartDate: '2026-01-05',
    loanTenureMonths: 12,
    numberOfInstalments: 12,
    emiAmount: 87683.5,
    firstEmiDate: '2026-02-05',
    finalEmiDate: '2027-01-05',
    processingFees: 5000,
    otherCharges: 0,
    paymentMethod: 'nach',
    financeStatus: 'active',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-01-05T08:00:00.000Z',
    createdBy: 'Karthikeyan R',
    outstandingPrincipal: 1000000,
    principalRepaid: 0,
    interestPaid: 0,
    totalAmountPaid: 0,
    remainingInstalments: 12,
    nextDueDate: '2026-02-05',
    loanCompletionDate: '2027-01-05',
    overdueCount: 0,
    overdueAmount: 0,
    ...overrides,
  }
}

const DEFAULT_SETTINGS: FinanceNotificationSettings = {
  organizationId: 'org-kaveri',
  reminderDaysBefore: [15, 7, 3, 1, 0],
  notifyAfterDueDate: true,
  overdueEscalationDays: 5,
  inAppEnabled: true,
  emailEnabled: true,
  smtpConfigured: false,
  recipientRoles: ['org_admin', 'finance'],
  recipientEmails: ['finance@kaverilogistics.in'],
  defaultCurrency: 'INR',
  defaultTimezone: 'Asia/Kolkata',
  defaultReportingPeriod: 'monthly',
  partialPaymentRule: 'allow_partial',
  dueSoonWindowDays: 7,
  allowManualLateFeeEntry: true,
  updatedAt: '2026-01-05T08:00:00.000Z',
  updatedBy: 'System',
}

test('reducing balance, flat rate, and balloon amortisations balance principal exactly', () => {
  const reducing = generateAmortisationSchedule({
    organizationId: 'org-kaveri',
    financeId: 'fin-r',
    vehicleId: 'v-k1',
    netFinancedAmount: 1000000,
    interestRateAnnualPct: 9.5,
    interestType: 'reducing_balance',
    numberOfInstalments: 12,
    firstEmiDate: '2026-02-05',
  })
  assert.equal(reducing.instalments.length, 12)
  const sumPrincipalReducing = Math.round(
    reducing.instalments.reduce((s, i) => s + i.principalComponent, 0),
  )
  assert.equal(sumPrincipalReducing, 1000000)

  const flat = generateAmortisationSchedule({
    organizationId: 'org-kaveri',
    financeId: 'fin-f',
    vehicleId: 'v-k2',
    netFinancedAmount: 600000,
    interestRateAnnualPct: 10,
    interestType: 'flat_rate',
    numberOfInstalments: 12,
    firstEmiDate: '2026-02-10',
  })
  assert.equal(Math.round(flat.instalments.reduce((s, i) => s + i.principalComponent, 0)), 600000)
  assert.equal(Math.round(flat.instalments.reduce((s, i) => s + i.interestComponent, 0)), 60000)

  const balloon = generateAmortisationSchedule({
    organizationId: 'org-kaveri',
    financeId: 'fin-b',
    vehicleId: 'v-k3',
    netFinancedAmount: 500000,
    interestRateAnnualPct: 12,
    interestType: 'interest_only_balloon',
    numberOfInstalments: 6,
    firstEmiDate: '2026-02-01',
  })
  assert.equal(balloon.instalments[0].principalComponent, 0)
  assert.equal(balloon.instalments[5].principalComponent, 500000)
  assert.equal(computeStandardEmiAmount(1000000, 0, 10, 'reducing_balance'), 100000)
})

test('EMI statuses never falsely auto-mark past due dates as paid', () => {
  const { instalments } = generateAmortisationSchedule({
    organizationId: 'org-kaveri',
    financeId: 'fin-1',
    vehicleId: 'v-k1',
    netFinancedAmount: 120000,
    interestRateAnnualPct: 0,
    interestType: 'reducing_balance',
    numberOfInstalments: 4,
    firstEmiDate: '2026-03-01',
  })
  assert.equal(deriveEmiStatus(instalments[0], '2026-03-05', 7), 'overdue')
  assert.equal(deriveEmiStatus(instalments[1], '2026-04-01', 7), 'due_today')
  assert.equal(deriveEmiStatus(instalments[2], '2026-04-28', 7), 'due_soon')
  assert.equal(deriveEmiStatus(instalments[3], '2026-04-28', 7), 'upcoming')
})

test('partial payment, manual late fee, and double-pay guard work accurately', () => {
  const { instalments } = generateAmortisationSchedule({
    organizationId: 'org-kaveri',
    financeId: 'fin-1',
    vehicleId: 'v-k1',
    netFinancedAmount: 100000,
    interestRateAnnualPct: 0,
    interestType: 'reducing_balance',
    numberOfInstalments: 2,
    firstEmiDate: '2026-03-01',
  })
  const first = instalments[0] // 50,000 due

  // Partial payment 20,000 + manual late fee 500
  const step1 = applyEmiPaymentCalculation(first, 20000, 500, '2026-03-10', true)
  assert.equal(step1.updatedEmi.status, 'partially_paid')
  assert.equal(step1.updatedEmi.lateFeeInr, 500)
  assert.equal(step1.updatedEmi.amountPaid, 20000)
  assert.equal(step1.updatedEmi.remainingAmount, 30500)

  // Overpay guard prevents paying more than remaining
  assert.throws(() => {
    applyEmiPaymentCalculation(step1.updatedEmi, 35000, 0, '2026-03-12', true)
  }, /double-pay|exceeds/i)

  // Complete remaining 30,500
  const step2 = applyEmiPaymentCalculation(step1.updatedEmi, 30500, 0, '2026-03-15', true)
  assert.equal(step2.updatedEmi.status, 'paid')
  assert.equal(step2.updatedEmi.remainingAmount, 0)

  // Double-pay guard prevents paying already paid EMI
  assert.throws(() => {
    applyEmiPaymentCalculation(step2.updatedEmi, 100, 0, '2026-03-16', true)
  }, /already paid/i)
})

test('restructuring preserves historical paid instalments and re-amortises remaining principal', () => {
  const record = makeSampleRecord()
  const { instalments } = generateAmortisationSchedule({
    organizationId: record.organizationId,
    financeId: record.id,
    vehicleId: record.vehicleId,
    netFinancedAmount: record.netFinancedAmount,
    interestRateAnnualPct: record.interestRateAnnualPct,
    interestType: record.interestType,
    numberOfInstalments: 12,
    firstEmiDate: record.firstEmiDate,
  })
  // Mark first 2 paid
  const paid1 = applyEmiPaymentCalculation(instalments[0], instalments[0].emiAmount, 0, '2026-02-05', true).updatedEmi
  const paid2 = applyEmiPaymentCalculation(instalments[1], instalments[1].emiAmount, 0, '2026-03-05', true).updatedEmi
  const all = [paid1, paid2, ...instalments.slice(2)]

  const restructured = buildRestructuredSchedule({
    record,
    existingInstalments: all,
    newInterestRateAnnualPct: 8.5,
    newInterestType: 'reducing_balance',
    newRemainingInstalmentsCount: 15,
    effectiveNextDueDate: '2026-04-05',
  })

  assert.equal(restructured.preservedInstalments.length, 2)
  assert.equal(restructured.newInstalments.length, 15)
  assert.equal(restructured.newInstalments[0].emiNumber, 3)
  assert.equal(restructured.newInstalments[0].dueDate, '2026-04-05')
  const totalRestructuredPrincipal = Math.round(
    restructured.preservedInstalments.reduce((s, i) => s + i.principalComponent, 0) +
      restructured.newInstalments.reduce((s, i) => s + i.principalComponent, 0),
  )
  assert.equal(totalRestructuredPrincipal, 1000000)
})

test('loan completion, overdue detection, alerts, and RBAC masking work accurately', () => {
  const record = makeSampleRecord({ numberOfInstalments: 2, loanTenureMonths: 2 })
  const { instalments } = generateAmortisationSchedule({
    organizationId: record.organizationId,
    financeId: record.id,
    vehicleId: record.vehicleId,
    netFinancedAmount: 100000,
    interestRateAnnualPct: 0,
    interestType: 'reducing_balance',
    numberOfInstalments: 2,
    firstEmiDate: '2026-03-01',
  })
  record.netFinancedAmount = 100000

  // One paid, one upcoming 3 days away -> nearing completion + 3d reminder + missing docs
  const emi1Paid = applyEmiPaymentCalculation(instalments[0], 50000, 0, '2026-03-01', true).updatedEmi
  const summary = summarizeVehicleFinanceRecord(record, [emi1Paid, instalments[1]], [], '2026-03-29', 7)
  assert.equal(summary.remainingInstalments, 1)
  assert.equal(summary.outstandingPrincipal, 50000)

  const alerts = evaluateFinanceAlerts({
    organizationId: record.organizationId,
    records: [summary],
    instalments: [emi1Paid, instalments[1]],
    documents: [],
    settings: DEFAULT_SETTINGS,
    todayIso: '2026-03-29',
  })

  assert.ok(alerts.some((a) => a.alertType === 'emi_due_reminder'))
  assert.ok(alerts.some((a) => a.alertType === 'loan_nearing_completion'))
  assert.ok(alerts.some((a) => a.alertType === 'finance_doc_missing'))
  assert.ok(alerts.every((a) => !a.channelSummary.includes('SMS')))

  // Complete second EMI -> loan status transitions to completed
  const emi2Paid = applyEmiPaymentCalculation(instalments[1], 50000, 0, '2026-04-01', true).updatedEmi
  const completedSummary = summarizeVehicleFinanceRecord(record, [emi1Paid, emi2Paid], [], '2026-04-01', 7)
  assert.equal(completedSummary.financeStatus, 'completed')
  assert.equal(completedSummary.outstandingPrincipal, 0)
  assert.equal(completedSummary.remainingInstalments, 0)

  // Masking verification
  assert.equal(maskAccountNumber('HDFC901288334411'), '••••••••••••4411')
  const maskedRecord = maskFinanceWorkspaceForRole(completedSummary, false)
  assert.equal(maskedRecord.loanAccountNumber, '••••••••••••4411')
  assert.equal(maskedRecord.email, '***@protected')
  const unmaskedRecord = maskFinanceWorkspaceForRole(completedSummary, true)
  assert.equal(unmaskedRecord.loanAccountNumber, 'HDFC901288334411')
})
