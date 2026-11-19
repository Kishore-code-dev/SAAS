import type { OrganizationRole, RiskSeverity } from './fleet'

export type FinanceLoanType =
  | 'vehicle_loan'
  | 'commercial_vehicle_loan'
  | 'lease'
  | 'hire_purchase'
  | 'other'

export type FinanceInterestType =
  | 'reducing_balance'
  | 'flat_rate'
  | 'lease_fixed'
  | 'interest_only_balloon'
  | 'custom'

export type FinancePaymentMethod =
  | 'nach'
  | 'ecs'
  | 'neft'
  | 'rtgs'
  | 'imps'
  | 'upi'
  | 'cheque'
  | 'cash'
  | 'bank_transfer'

export type VehicleFinanceStatus =
  | 'active'
  | 'partially_paid'
  | 'overdue'
  | 'restructured'
  | 'foreclosed'
  | 'completed'
  | 'cancelled'

export type EmiPaymentStatus =
  | 'upcoming'
  | 'due_soon'
  | 'due_today'
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'waived'
  | 'cancelled'

export type ReconciliationStatus = 'pending' | 'reconciled' | 'discrepancy'

export type FinanceDocCategory =
  | 'loan_agreement'
  | 'loan_sanction_letter'
  | 'emi_schedule'
  | 'bank_statements'
  | 'payment_receipts'
  | 'noc'
  | 'foreclosure_letter'
  | 'insurance_finance_docs'
  | 'other_supporting_docs'

export type FinanceAlertType =
  | 'emi_due_reminder'
  | 'emi_overdue'
  | 'partial_payment_recorded'
  | 'payment_reconciled'
  | 'loan_nearing_completion'
  | 'loan_completed'
  | 'finance_doc_missing'
  | 'finance_doc_renewal'
  | 'loan_info_updated'

export interface FinancialInstitution {
  id: string
  organizationId: string
  bankName: string
  institutionType: 'bank' | 'nbfc' | 'oem_captive' | 'leasing_partner'
  branch: string
  relationshipManager: string
  contactNumber: string
  email: string
  ifscCode: string
  defaultPaymentMethod: FinancePaymentMethod
  active: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface VehicleFinanceRecord {
  id: string
  organizationId: string
  vehicleId: string
  institutionId: string | null
  vehicleRegistration: string
  vehicleName: string
  vehicleMakeModel: string
  vehicleOwnership: 'Financed' | 'Leased' | 'Hire Purchase' | 'Owned'
  bankName: string
  institutionName: string
  branch: string
  relationshipManager: string
  contactNumber: string
  email: string
  ifscCode: string
  loanAccountNumber: string
  loanAccountMasked: string
  loanReferenceNumber: string
  loanType: FinanceLoanType
  customLoanTypeLabel?: string
  principalAmount: number
  downPayment: number
  netFinancedAmount: number
  interestRateAnnualPct: number
  interestType: FinanceInterestType
  loanStartDate: string
  loanTenureMonths: number
  numberOfInstalments: number
  emiAmount: number
  firstEmiDate: string
  finalEmiDate: string
  processingFees: number
  otherCharges: number
  paymentMethod: FinancePaymentMethod
  financeStatus: VehicleFinanceStatus
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy: string
  // Computed live summary fields
  outstandingPrincipal: number
  principalRepaid: number
  interestPaid: number
  totalAmountPaid: number
  remainingInstalments: number
  nextDueDate: string | null
  loanCompletionDate: string | null
  overdueCount: number
  overdueAmount: number
}

export interface EmiInstalment {
  id: string
  organizationId: string
  financeId: string
  vehicleId: string
  emiNumber: number
  dueDate: string
  openingPrincipal: number
  principalComponent: number
  interestComponent: number
  emiAmount: number
  lateFeeInr: number
  amountPaid: number
  remainingAmount: number
  paymentDate: string | null
  status: EmiPaymentStatus
  reconciliationStatus: ReconciliationStatus
  notes?: string
  updatedAt: string
}

export interface FinancePaymentTransaction {
  id: string
  organizationId: string
  financeId: string
  emiId: string
  vehicleId: string
  emiNumber: number
  paymentDate: string
  amountInr: number
  lateFeeComponentInr: number
  paymentMethod: FinancePaymentMethod
  bankTransactionRef: string
  bankTransactionRefMasked: string
  receiptDocId?: string | null
  receiptFileName?: string | null
  reconciliationStatus: ReconciliationStatus
  reconciledBy?: string | null
  reconciledAt?: string | null
  correctionOfPaymentId?: string | null
  correctionReason?: string | null
  isCorrected: boolean
  recordedBy: string
  notes?: string
  createdAt: string
}

export interface FinanceDocumentItem {
  id: string
  organizationId: string
  financeId: string
  vehicleId: string
  category: FinanceDocCategory
  title: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  storageKey: string
  version: number
  parentDocId?: string | null
  verificationStatus: 'pending_verification' | 'verified' | 'rejected'
  verifiedBy?: string | null
  verifiedAt?: string | null
  expiryDate?: string | null
  requiresRenewal: boolean
  uploadedBy: string
  uploadedAt: string
  notes?: string
}

export interface FinanceNotificationSettings {
  organizationId: string
  reminderDaysBefore: number[]
  notifyAfterDueDate: boolean
  overdueEscalationDays: number
  inAppEnabled: boolean
  emailEnabled: boolean
  smtpConfigured: boolean
  recipientRoles: OrganizationRole[]
  recipientEmails: string[]
  defaultCurrency: 'INR'
  defaultTimezone: string
  defaultReportingPeriod: 'monthly' | 'quarterly' | 'annual'
  partialPaymentRule: 'allow_partial' | 'full_only'
  dueSoonWindowDays: number
  allowManualLateFeeEntry: boolean
  updatedAt: string
  updatedBy: string
}

export interface FinanceAlertEvent {
  id: string
  organizationId: string
  financeId: string
  emiId?: string | null
  vehicleId: string
  alertType: FinanceAlertType
  severity: RiskSeverity
  title: string
  message: string
  channelSummary: string
  actionRoute: string
  read: boolean
  acknowledged: boolean
  createdAt: string
}

export interface FinanceUpdateHistoryEntry {
  id: string
  organizationId: string
  financeId?: string | null
  entityType: 'finance_record' | 'institution' | 'payment' | 'settings' | 'document'
  entityId: string
  fieldName: string
  previousValue: string
  updatedValue: string
  updateReason: string
  updatedBy: string
  updatedByRole: OrganizationRole
  updateDate: string
  approvalStatus: 'approved' | 'pending' | 'rejected'
}

export interface FinanceWorkspacePayload {
  institutions: FinancialInstitution[]
  records: VehicleFinanceRecord[]
  instalments: EmiInstalment[]
  payments: FinancePaymentTransaction[]
  documents: FinanceDocumentItem[]
  settings: FinanceNotificationSettings
  alerts: FinanceAlertEvent[]
  updateHistory: FinanceUpdateHistoryEntry[]
  maskedForRole: boolean
  todayIso: string
}
