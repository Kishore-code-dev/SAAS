import type { OrganizationRole, VehicleOwnershipCategory } from './fleet'

export type ContractCategory =
  | 'fixed_monthly_rental'
  | 'per_km_rental'
  | 'per_trip_rental'
  | 'revenue_sharing'
  | 'fixed_plus_variable'
  | 'custom_agreement'

export type ContractSupplierType = 'fleet_partner' | 'individual_owner'

export type ContractStatus =
  | 'draft'
  | 'pending_approval'
  | 'awaiting_handover'
  | 'active'
  | 'temporarily_suspended'
  | 'renewal_pending'
  | 'expired'
  | 'termination_requested'
  | 'terminated'
  | 'vehicle_return_pending'
  | 'closed'

export type ResponsibilityParty = 'operating_org' | 'supplier' | 'shared' | 'unspecified'

export type ContractPermissionKey =
  | 'view_contracts'
  | 'create_contracts'
  | 'edit_contracts'
  | 'submit_contracts'
  | 'approve_contracts'
  | 'reject_contracts'
  | 'terminate_contracts'
  | 'renew_contracts'
  | 'create_amendments'
  | 'approve_amendments'
  | 'manage_suppliers'
  | 'manage_individual_owners'
  | 'manage_contract_vehicles'
  | 'manage_contract_payments'
  | 'approve_contract_payments'
  | 'manage_security_deposits'
  | 'approve_deposit_refunds'
  | 'manage_maintenance_responsibilities'
  | 'approve_contract_maintenance'
  | 'manage_contract_documents'
  | 'view_contract_financial_reports'

export interface FleetPartner {
  id: string
  organizationId: string
  partnerCode: string
  companyName: string
  businessRegistrationNo: string
  gstin: string
  contactPerson: string
  mobile: string
  email: string
  registeredAddress: string
  operatingLocation: string
  bankAccountHolder: string
  bankName: string
  bankAccountNumberMasked: string
  bankAccountLast4: string
  ifscCode: string
  status: 'active' | 'on_hold' | 'inactive'
  notes: string
  createdAt: string
  updatedAt: string
  archived?: boolean
  city?: string
  state?: string
  address?: string
  panNumber?: string
  bankAccountMasked?: string
  slaTargetUptimePct?: number
  assignedStartDate?: string
}

export interface IndividualVehicleOwner {
  id: string
  organizationId: string
  ownerCode: string
  fullName: string
  mobile: string
  email: string
  address: string
  identityVerificationStatus: 'pending' | 'verified' | 'rejected'
  panMasked: string
  aadhaarMasked: string
  bankAccountHolder: string
  bankName: string
  bankAccountNumberMasked: string
  bankAccountLast4: string
  ifscCode: string
  paymentPreference: 'bank_transfer' | 'upi' | 'cheque'
  status: 'active' | 'on_hold' | 'inactive'
  notes: string
  createdAt: string
  updatedAt: string
  archived?: boolean
  city?: string
  state?: string
  drivingLicenseNo?: string
  emergencyContact?: string
  payoutCycle?: string
  bankAccountMasked?: string
  assignedStartDate?: string
}

export interface VehicleOwnershipRecord {
  id: string
  organizationId: string
  vehicleId: string
  ownershipCategory: VehicleOwnershipCategory
  legalOwnerName: string
  fleetPartnerId: string | null
  individualOwnerId: string | null
  ownershipProofRef: string
  effectiveFrom: string
  effectiveTo?: string | null
  notes?: string
  updatedAt: string
}

export interface ContractFinancialTerms {
  fixedRentalAmount: number
  monthlyRental: number
  perKmRate: number
  perTripRate: number
  revenueSharingPct: number
  fixedComponent: number
  variableComponentDesc: string
  paymentFrequency: 'monthly' | 'bi_weekly' | 'weekly' | 'per_trip' | 'custom'
  paymentDueDay: number
  advancePayment: number
  securityDeposit: number
  bondAmount: number
  latePaymentTerms: string
  taxTreatment: string
  additionalCharges: string
  deductionConditions: string
  settlementConditions: string
}

export interface ContractConditions {
  maintenanceResponsibility: ResponsibilityParty
  fuelResponsibility: ResponsibilityParty
  insuranceResponsibility: ResponsibilityParty
  accidentResponsibility: ResponsibilityParty
  tyreReplacementResponsibility: ResponsibilityParty
  breakdownResponsibility: ResponsibilityParty
  driverResponsibility: ResponsibilityParty
  permitResponsibility: ResponsibilityParty
  fitnessPucResponsibility: ResponsibilityParty
  vehicleReplacementConditions: string
  downtimeConditions: string
  terminationConditions: string
  renewalConditions: string
  vehicleReturnConditions: string
}

export interface VehicleContract {
  id: string
  organizationId: string
  contractCode: string
  contractName: string
  contractCategory: ContractCategory
  supplierType: ContractSupplierType
  fleetPartnerId: string | null
  individualOwnerId: string | null
  supplierName: string
  agreementRefNumber: string
  agreementDate: string
  startDate: string
  expiryDate: string
  durationMonths: number
  currency: string
  status: ContractStatus
  currentVersion: number
  description: string
  financialTerms: ContractFinancialTerms
  contractConditions: ContractConditions
  closureExceptionNote?: string | null
  createdBy: string
  approvedBy?: string | null
  approvedAt?: string | null
  createdAt: string
  updatedAt: string
  archived?: boolean
  renewalType?: string
}

export interface ContractVehicleLink {
  id: string
  organizationId: string
  contractId: string
  vehicleId: string
  vehicleRegistration: string
  ownershipCategory: VehicleOwnershipCategory
  agreedMonthlyRental: number
  agreedPerKmRate: number
  agreedPerTripRate: number
  revenueSharePct: number
  fixedComponent: number
  variableRateNote: string
  maintenanceResponsibility: ResponsibilityParty
  fuelResponsibility: ResponsibilityParty
  insuranceResponsibility: ResponsibilityParty
  vehicleConditionNote: string
  initialOdometerKm: number
  handoverDate: string
  returnDate?: string | null
  vehicleContractStatus: 'pending_handover' | 'active' | 'returned'
  overlappingAuthNote?: string | null
  createdAt: string
  assignedStartDate?: string
}

export interface ContractVersion {
  id: string
  organizationId: string
  contractId: string
  versionNumber: number
  effectiveDate: string
  financialTerms: ContractFinancialTerms
  contractConditions: ContractConditions
  expiryDate: string
  durationMonths: number
  createdBy: string
  approvedBy?: string | null
  createdAt: string
  notes: string
}

export type AmendmentApprovalStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'effective'

export interface ContractAmendment {
  id: string
  organizationId: string
  amendmentCode: string
  contractId: string
  title: string
  reason: string
  amendmentType:
    | 'rental_amount'
    | 'payment_frequency'
    | 'duration_expiry'
    | 'security_deposit'
    | 'maintenance_responsibility'
    | 'vehicle_addition'
    | 'vehicle_removal'
    | 'financial_responsibility'
    | 'general_terms'
  previousValues: Record<string, unknown>
  revisedValues: Record<string, unknown>
  effectiveDate: string
  recalculateFutureSchedule: boolean
  recalculationConfirmed: boolean
  supportingDocId?: string | null
  approvalStatus: AmendmentApprovalStatus
  createdBy: string
  createdAt: string
  approvedBy?: string | null
  approvedAt?: string | null
  rejectionReason?: string | null
}

export type ContractMaintenanceCategory =
  | 'engine'
  | 'transmission'
  | 'brakes'
  | 'tyres'
  | 'electrical'
  | 'battery'
  | 'suspension'
  | 'accident_repairs'
  | 'preventive_maintenance'
  | 'periodic_servicing'
  | 'custom'

export interface ContractMaintenanceRule {
  id: string
  organizationId: string
  contractId: string
  vehicleId?: string | null
  maintenanceCategory: ContractMaintenanceCategory
  customCategoryLabel?: string
  responsibleParty: ResponsibilityParty
  orgSharePct: number
  supplierSharePct: number
  thresholdAmountInr: number
  circumstance: 'all' | 'routine' | 'breakdown' | 'accident'
  notes: string
  createdAt: string
  category?: string
  preApprovalThresholdInr?: number
}

export interface ContractMaintenanceAllocation {
  id: string
  organizationId: string
  contractId: string
  vehicleId: string
  vehicleRegistration: string
  maintenanceRecordId?: string | null
  workOrderId?: string | null
  maintenanceCategory: ContractMaintenanceCategory
  description: string
  totalRepairAmountInr: number
  orgShareInr: number
  supplierShareInr: number
  responsibleParty: ResponsibilityParty
  settlementStatus: 'pending_approval' | 'approved' | 'settled' | 'disputed'
  approvedBy?: string | null
  approvedAt?: string | null
  settlementPaymentId?: string | null
  notes: string
  createdAt: string
  settlementMethod?: string
  orgSharePct?: number
  supplierSharePct?: number
  status?: string
  category?: string
}

export type DepositType =
  | 'refundable_security_deposit'
  | 'non_refundable_charge'
  | 'performance_bond'
  | 'bank_guarantee'
  | 'other_security_instrument'

export type DepositStatus =
  | 'deposit_defined'
  | 'payment_recorded'
  | 'payment_verified'
  | 'active'
  | 'contract_expiry'
  | 'vehicle_inspection'
  | 'deductions'
  | 'refund_approval'
  | 'refund_payment'
  | 'closed'

export interface ContractBondDeposit {
  id: string
  organizationId: string
  depositCode: string
  contractId: string
  supplierType: ContractSupplierType
  fleetPartnerId: string | null
  individualOwnerId: string | null
  supplierName: string
  vehicleId?: string | null
  vehicleGroupLabel: string
  depositType: DepositType
  requiredAmountInr: number
  paidAmountInr: number
  outstandingAmountInr: number
  deductedAmountInr: number
  refundedAmountInr: number
  paymentDate?: string | null
  paymentReference?: string | null
  paymentMethod?: string | null
  receivingParty: string
  isRefundable: boolean
  refundConditions: string
  expiryDate?: string | null
  documentRef?: string | null
  status: DepositStatus
  createdBy: string
  verifiedBy?: string | null
  refundApprovedBy?: string | null
  createdAt: string
  updatedAt: string
  netRefundableInr?: number
  heldBy?: string
}

export interface ContractDepositDeduction {
  id: string
  organizationId: string
  depositId: string
  contractId: string
  vehicleId?: string | null
  amountInr: number
  reason: string
  evidenceRef: string
  authorizedBy: string
  authorizedAt: string
  handoverReturnId?: string | null
  category?: string
  approvedBy?: string | null
}

export type ContractPaymentKind =
  | 'monthly_rental'
  | 'per_km'
  | 'per_trip'
  | 'revenue_share'
  | 'advance'
  | 'additional_charge'
  | 'deduction'
  | 'deposit_payment'
  | 'deposit_refund'
  | 'maintenance_settlement'
  | 'final_settlement'

export type ContractPaymentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'disputed'
  | 'cancelled'
  | 'reconciled'

export interface ContractPayment {
  id: string
  organizationId: string
  transactionCode: string
  contractId: string
  contractVersion: number
  supplierType: ContractSupplierType
  fleetPartnerId: string | null
  individualOwnerId: string | null
  supplierName: string
  vehicleId?: string | null
  vehicleRegistration?: string | null
  paymentKind: ContractPaymentKind
  billingPeriod: string
  dueDate: string
  paymentAmountInr: number
  paidAmountInr: number
  outstandingAmountInr: number
  paymentMethod: 'neft' | 'rtgs' | 'imps' | 'upi' | 'cheque' | 'bank_guarantee' | 'adjustment'
  paymentReference: string
  receiptRef?: string | null
  status: ContractPaymentStatus
  reconciliationNotes?: string | null
  recordedBy: string
  approvedBy?: string | null
  approvedAt?: string | null
  reconciledBy?: string | null
  reconciledAt?: string | null
  createdAt: string
  updatedAt: string
  payableAmountInr?: number
  paymentType?: string
}

export interface VehicleHandoverRecord {
  id: string
  organizationId: string
  handoverCode: string
  contractId: string
  vehicleId: string
  vehicleRegistration: string
  supplierType: ContractSupplierType
  supplierName: string
  recordType: 'initial_handover' | 'vehicle_return'
  linkedInitialHandoverId?: string | null
  handoverDatetime: string
  odometerKm: number
  fuelLevelPct: number
  exteriorCondition: 'excellent' | 'good' | 'fair' | 'damaged'
  interiorCondition: 'excellent' | 'good' | 'fair' | 'damaged'
  tyreCondition: 'good' | 'worn' | 'critical'
  existingDamages: string
  accessoriesChecklist: string[]
  equipmentChecklist: string[]
  documentChecklist: string[]
  photos: Array<{ label: string; ref: string; uploadedAt: string }>
  handoverNotes: string
  supplierRepresentative: string
  receivingRepresentative: string
  supplierAckName: string
  receivingAckName: string
  newDamages?: string
  missingEquipment?: string
  pendingRepairsInr?: number
  outstandingExpensesInr?: number
  recommendedDeductionInr?: number
  createdBy: string
  createdAt: string
  handoverDate?: string
}

export interface ContractDocumentItem {
  id: string
  organizationId: string
  entityType: 'contract' | 'fleet_partner' | 'individual_owner' | 'handover' | 'deposit' | 'amendment'
  entityId: string
  contractId?: string | null
  category: string
  title: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  storageKey: string
  expiryDate?: string | null
  verificationStatus: 'pending_verification' | 'verified' | 'rejected' | 'expired'
  restrictedAccess: boolean
  uploadedBy: string
  uploadedAt: string
  documentType?: string
}

export interface ContractHistoryEntry {
  id: string
  organizationId: string
  contractId?: string | null
  entityType: string
  entityId: string
  action: string
  actorUserId: string
  actorName: string
  actorRole: OrganizationRole
  summary: string
  beforeJson?: string | null
  afterJson?: string | null
  timestamp: string
  actionType?: string
  createdAt?: string
}

export interface ContractPermissionRule {
  id: string
  organizationId: string
  role: OrganizationRole
  permissionKey: ContractPermissionKey
  allowed: boolean
  updatedBy: string
  updatedAt: string
}

export interface ContractAlertItem {
  id: string
  severity: 'critical' | 'high' | 'moderate' | 'normal'
  category: string
  title: string
  message: string
  contractId?: string
  vehicleId?: string
  actionRoute: string
  daysRemaining?: number
}

export interface ContractsWorkspacePayload {
  partners: FleetPartner[]
  owners: IndividualVehicleOwner[]
  ownershipRecords: VehicleOwnershipRecord[]
  contracts: VehicleContract[]
  contractVehicles: ContractVehicleLink[]
  versions: ContractVersion[]
  amendments: ContractAmendment[]
  maintenanceRules: ContractMaintenanceRule[]
  maintenanceAllocations: ContractMaintenanceAllocation[]
  deposits: ContractBondDeposit[]
  deductions: ContractDepositDeduction[]
  payments: ContractPayment[]
  handovers: VehicleHandoverRecord[]
  documents: ContractDocumentItem[]
  history: ContractHistoryEntry[]
  permissions: ContractPermissionRule[]
  alerts: ContractAlertItem[]
  effectivePermissions: Record<ContractPermissionKey, boolean>
}
