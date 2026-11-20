export type OwnershipType = 'company_owned' | 'contracted_fleet' | 'individual_owner'

export type ContractCategory =
  | 'fixed_monthly'
  | 'per_km'
  | 'per_trip'
  | 'revenue_sharing'
  | 'fixed_variable'
  | 'custom'

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

export type SupplierType = 'fleet_partner' | 'individual_owner'

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

export type DepositType =
  | 'refundable_security'
  | 'non_refundable_charge'
  | 'performance_bond'
  | 'bank_guarantee'
  | 'other'

export type DepositStatus =
  | 'defined'
  | 'payment_recorded'
  | 'verified'
  | 'active'
  | 'deduction_pending'
  | 'refund_pending'
  | 'refunded'
  | 'closed'

export type AmendmentStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'effective'

export type MaintenanceResponsibility =
  | 'operating_org'
  | 'supplier'
  | 'shared'
  | 'unspecified'

export type HandoverType = 'handover' | 'return'

export interface VehicleOwnershipRecord {
  id: string
  organizationId: string
  vehicleId: string
  vehicleRegistration: string
  ownershipType: OwnershipType
  legalOwnerName: string
  fleetPartnerId?: string | null
  individualOwnerId?: string | null
  contractId?: string | null
  effectiveFrom: string
  notes?: string
  createdAt: string
}

export interface FleetPartner {
  id: string
  organizationId: string
  companyName: string
  registrationNumber: string
  gstin: string
  contactPerson: string
  mobile: string
  email: string
  registeredAddress: string
  operatingLocation: string
  bankAccountMasked: string
  bankIfsc: string
  status: 'active' | 'inactive' | 'blacklisted'
  notes: string
  createdAt: string
}

export interface IndividualVehicleOwner {
  id: string
  organizationId: string
  fullName: string
  mobile: string
  email: string
  address: string
  identityVerificationStatus: 'pending' | 'verified' | 'rejected'
  identityDocumentType: string
  identityDocumentMasked: string
  bankAccountMasked: string
  bankIfsc: string
  paymentPreference: 'bank_transfer' | 'upi' | 'cash' | 'cheque'
  status: 'active' | 'inactive'
  notes: string
  createdAt: string
}

export interface ContractVehicleLink {
  id: string
  contractId: string
  vehicleId: string
  vehicleRegistration: string
  ownershipType: OwnershipType
  vehicleCategory: string
  condition: string
  initialOdometerKm: number
  handoverDate: string
  agreedRentalInr: number
  maintenanceResponsibility: MaintenanceResponsibility
  returnedAt?: string | null
}

export interface ContractFinancialTerms {
  fixedRentalInr: number
  monthlyRentalInr: number
  perKmRateInr: number
  perTripRateInr: number
  revenueSharePct: number
  paymentFrequency: 'monthly' | 'fortnightly' | 'weekly' | 'per_trip' | 'on_demand'
  paymentDueDay: number
  advancePaymentInr: number
  securityDepositInr: number
  bondAmountInr: number
  latePaymentTerms: string
  taxTreatment: string
  additionalCharges: string
  deductionConditions: string
  settlementConditions: string
}

export interface ContractConditions {
  maintenance: MaintenanceResponsibility
  fuel: MaintenanceResponsibility
  insurance: MaintenanceResponsibility
  accident: MaintenanceResponsibility
  tyres: MaintenanceResponsibility
  breakdown: MaintenanceResponsibility
  driver: MaintenanceResponsibility
  permit: MaintenanceResponsibility
  fitnessPuc: MaintenanceResponsibility
  vehicleReplacement: string
  downtime: string
  termination: string
  renewal: string
  vehicleReturn: string
}

export interface VehicleContract {
  id: string
  organizationId: string
  contractNumber: string
  name: string
  category: ContractCategory
  supplierType: SupplierType
  fleetPartnerId?: string | null
  individualOwnerId?: string | null
  supplierName: string
  agreementReference: string
  agreementDate: string
  startDate: string
  expiryDate: string
  durationMonths: number
  currency: string
  description: string
  status: ContractStatus
  currentVersion: number
  financialTerms: ContractFinancialTerms
  conditions: ContractConditions
  vehicles: ContractVehicleLink[]
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface ContractAmendment {
  id: string
  contractId: string
  amendmentNumber: string
  title: string
  reason: string
  previousValues: Record<string, unknown>
  revisedValues: Record<string, unknown>
  effectiveDate: string
  status: AmendmentStatus
  createdBy: string
  approvedBy?: string | null
  createdAt: string
  approvedAt?: string | null
}

export interface ContractDeposit {
  id: string
  contractId: string
  depositType: DepositType
  vehicleIds: string[]
  requiredAmountInr: number
  paidAmountInr: number
  outstandingAmountInr: number
  deductionsInr: number
  refundableInr: number
  paymentDate?: string | null
  paymentReference: string
  paymentMethod: string
  receivingParty: string
  refundable: boolean
  refundConditions: string
  expiryDate?: string | null
  documentReference: string
  status: DepositStatus
  createdAt: string
}

export interface ContractPayment {
  id: string
  contractId: string
  supplierName: string
  vehicleId?: string | null
  billingPeriod: string
  dueDate: string
  amountInr: number
  paidAmountInr: number
  outstandingAmountInr: number
  paymentMethod: string
  paymentReference: string
  receiptReference: string
  status: ContractPaymentStatus
  recordedBy: string
  approvedBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface ContractMaintenanceAllocation {
  id: string
  contractId: string
  vehicleId: string
  vehicleRegistration: string
  workOrderId?: string | null
  category: string
  description: string
  totalCostInr: number
  operatingOrgShareInr: number
  supplierShareInr: number
  responsibility: MaintenanceResponsibility
  approvalStatus: 'pending' | 'approved' | 'rejected'
  approvedBy?: string | null
  settlementStatus: 'unsettled' | 'settled'
  createdAt: string
}

export interface VehicleHandover {
  id: string
  contractId: string
  vehicleId: string
  vehicleRegistration: string
  handoverType: HandoverType
  handoverAt: string
  odometerKm: number
  fuelLevelPct: number
  exteriorCondition: string
  interiorCondition: string
  tyreCondition: string
  existingDamages: string
  accessories: string
  photoReferences: string[]
  documentChecklist: string[]
  supplierRepresentative: string
  receivingRepresentative: string
  notes: string
  createdAt: string
}

export interface ContractDocument {
  id: string
  contractId: string
  name: string
  category: string
  reference: string
  uploadedBy: string
  createdAt: string
}

export interface ContractActivityEntry {
  id: string
  contractId: string
  action: string
  summary: string
  actor: string
  createdAt: string
}

export interface ContractOverview {
  kpis: {
    activeContracts: number
    contractedVehicles: number
    individualOwnerVehicles: number
    fleetPartners: number
    expiringWithin30Days: number
    pendingApprovals: number
    pendingHandovers: number
    outstandingPaymentsInr: number
    totalSecurityDepositsInr: number
    outstandingDepositsInr: number
    pendingMaintenanceSettlementsInr: number
    vehiclesAwaitingReturn: number
  }
  ownershipDistribution: Array<{ ownershipType: OwnershipType; count: number }>
  contractedBySupplier: Array<{ supplier: string; count: number }>
  monthlyExpenditure: Array<{ month: string; rentalInr: number; maintenanceInr: number }>
  expiryTimeline: Array<{ bucket: string; count: number }>
  depositDistribution: Array<{ depositType: DepositType; amountInr: number }>
  maintenanceByParty: Array<{ party: string; amountInr: number }>
  utilization: Array<{ supplier: string; contracted: number; active: number; utilizationPct: number }>
}

export interface ContractWorkspace {
  contracts: VehicleContract[]
  partners: FleetPartner[]
  owners: IndividualVehicleOwner[]
  deposits: ContractDeposit[]
  payments: ContractPayment[]
  amendments: ContractAmendment[]
  maintenance: ContractMaintenanceAllocation[]
  handovers: VehicleHandover[]
  documents: ContractDocument[]
  activity: ContractActivityEntry[]
  ownership: VehicleOwnershipRecord[]
}

export interface CreateContractInput {
  name: string
  category: ContractCategory
  supplierType: SupplierType
  fleetPartnerId?: string
  individualOwnerId?: string
  agreementReference?: string
  agreementDate?: string
  startDate: string
  expiryDate: string
  durationMonths?: number
  description?: string
  status?: ContractStatus
  financialTerms: Partial<ContractFinancialTerms>
  conditions: Partial<ContractConditions>
  vehicles: Array<{
    vehicleId: string
    agreedRentalInr?: number
    maintenanceResponsibility?: MaintenanceResponsibility
    condition?: string
    initialOdometerKm?: number
    handoverDate?: string
  }>
}

export interface CreateAmendmentInput {
  title: string
  reason: string
  revisedValues: Record<string, unknown>
  effectiveDate: string
}
