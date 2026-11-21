import type { OrganizationRole, Vehicle, VehicleOwnershipCategory } from '../types/fleet'
import type {
  AmendmentApprovalStatus,
  ContractAlertItem,
  ContractAmendment,
  ContractBondDeposit,
  ContractDepositDeduction,
  ContractPayment,
  ContractPermissionKey,
  ContractPermissionRule,
  ContractStatus,
  ContractVehicleLink,
  DepositStatus,
  FleetPartner,
  IndividualVehicleOwner,
  ResponsibilityParty,
  VehicleContract,
  VehicleHandoverRecord,
} from '../types/contracts'

export const ALL_CONTRACT_PERMISSION_KEYS: ContractPermissionKey[] = [
  'view_contracts',
  'create_contracts',
  'edit_contracts',
  'submit_contracts',
  'approve_contracts',
  'reject_contracts',
  'terminate_contracts',
  'renew_contracts',
  'create_amendments',
  'approve_amendments',
  'manage_suppliers',
  'manage_individual_owners',
  'manage_contract_vehicles',
  'manage_contract_payments',
  'approve_contract_payments',
  'manage_security_deposits',
  'approve_deposit_refunds',
  'manage_maintenance_responsibilities',
  'approve_contract_maintenance',
  'manage_contract_documents',
  'view_contract_financial_reports',
]

export const CONTRACT_PERMISSION_LABELS: Record<ContractPermissionKey, string> = {
  view_contracts: 'View Contracts & Ownership',
  create_contracts: 'Create Contracts',
  edit_contracts: 'Edit Draft / Terms',
  submit_contracts: 'Submit for Approval',
  approve_contracts: 'Approve Contracts',
  reject_contracts: 'Reject Contracts',
  terminate_contracts: 'Terminate / Close Contracts',
  renew_contracts: 'Renew Contracts',
  create_amendments: 'Create Amendments',
  approve_amendments: 'Approve Amendments',
  manage_suppliers: 'Manage Fleet Partners',
  manage_individual_owners: 'Manage Individual Owners',
  manage_contract_vehicles: 'Link & Handover Contract Vehicles',
  manage_contract_payments: 'Record Contract Payments',
  approve_contract_payments: 'Approve & Reconcile Payments',
  manage_security_deposits: 'Manage Security Deposits & Bonds',
  approve_deposit_refunds: 'Authorize Deductions & Refunds',
  manage_maintenance_responsibilities: 'Define Maintenance Split Rules',
  approve_contract_maintenance: 'Approve Maintenance Allocations',
  manage_contract_documents: 'Manage Contract Documents',
  view_contract_financial_reports: 'View Contract Financial Reports & Unmasked Bank',
}

/**
 * Default permission matrix per §11 & §14 of spec:
 * - org_admin (Fleet Owner): full authority over their tenant
 * - platform_admin: platform infrastructure admin, NOT automatic tenant financial decision-maker
 * - fleet_manager: operational & draft creation, vehicle handover, suppliers/owners, no financial approvals
 * - finance: payments, deposits, maintenance settlement approval, financial reports
 * - maintenance: view contracts, maintenance split rules, approve maintenance allocations (within scope)
 * - viewer: view contracts & financial reports only
 */
const DEFAULT_ROLE_CONTRACT_PERMS: Record<OrganizationRole, Set<ContractPermissionKey>> = {
  platform_admin: new Set<ContractPermissionKey>([
    'view_contracts',
    'manage_contract_documents',
  ]),
  org_admin: new Set<ContractPermissionKey>(ALL_CONTRACT_PERMISSION_KEYS),
  fleet_manager: new Set<ContractPermissionKey>([
    'view_contracts',
    'create_contracts',
    'edit_contracts',
    'submit_contracts',
    'renew_contracts',
    'create_amendments',
    'manage_suppliers',
    'manage_individual_owners',
    'manage_contract_vehicles',
    'manage_maintenance_responsibilities',
    'manage_contract_documents',
  ]),
  finance: new Set<ContractPermissionKey>([
    'view_contracts',
    'manage_contract_payments',
    'approve_contract_payments',
    'manage_security_deposits',
    'approve_deposit_refunds',
    'approve_contract_maintenance',
    'manage_contract_documents',
    'view_contract_financial_reports',
  ]),
  maintenance: new Set<ContractPermissionKey>([
    'view_contracts',
    'manage_maintenance_responsibilities',
    'manage_contract_documents',
  ]),
  viewer: new Set<ContractPermissionKey>([
    'view_contracts',
    'view_contract_financial_reports',
  ]),
}

export function resolveEffectiveContractPermissions(
  role: OrganizationRole,
  orgRules: ContractPermissionRule[],
): Record<ContractPermissionKey, boolean> {
  const result = {} as Record<ContractPermissionKey, boolean>
  const baseSet = DEFAULT_ROLE_CONTRACT_PERMS[role] ?? new Set<ContractPermissionKey>()

  for (const key of ALL_CONTRACT_PERMISSION_KEYS) {
    if (role === 'org_admin') {
      // Fleet Owner always has full contract authority for their own organization
      result[key] = true
      continue
    }
    const override = orgRules.find((r) => r.role === role && r.permissionKey === key)
    result[key] = override ? Boolean(override.allowed) : baseSet.has(key)
  }
  return result
}

export function hasContractPermission(
  role: OrganizationRole,
  permission: ContractPermissionKey,
  orgRules: ContractPermissionRule[] = [],
): boolean {
  return resolveEffectiveContractPermissions(role, orgRules)[permission] === true
}

export function canRevealSensitiveSupplierDetails(
  role: OrganizationRole,
  orgRules: ContractPermissionRule[] = [],
): boolean {
  if (role === 'org_admin') return true
  if (role === 'platform_admin') return false
  return (
    hasContractPermission(role, 'view_contract_financial_reports', orgRules) &&
    (role === 'finance' || hasContractPermission(role, 'approve_contract_payments', orgRules))
  )
}

export function maskBankAccount(accountNumber: string): { masked: string; last4: string } {
  const clean = accountNumber.replace(/\s+/g, '')
  const last4 = clean.slice(-4) || '0000'
  return {
    masked: `XXXXXX${last4}`,
    last4,
  }
}

export function maskPanNumber(pan: string): string {
  const clean = pan.trim().toUpperCase()
  if (clean.length < 6) return 'XXXXXX'
  return `${clean.slice(0, 2)}XXXX${clean.slice(-4)}`
}

export function maskAadhaarNumber(aadhaar: string): string {
  const digits = aadhaar.replace(/\D/g, '')
  if (digits.length < 4) return 'XXXX-XXXX-XXXX'
  return `XXXX-XXXX-${digits.slice(-4)}`
}

export function detectDuplicatePartner(
  existing: FleetPartner[],
  candidate: {
    id?: string
    companyName: string
    gstin: string
    businessRegistrationNo: string
    mobile: string
  },
): string | null {
  const cleanGstin = candidate.gstin.trim().toUpperCase()
  const cleanReg = candidate.businessRegistrationNo.trim().toUpperCase()
  const cleanName = candidate.companyName.trim().toLowerCase()
  const cleanMobile = candidate.mobile.replace(/\D/g, '').slice(-10)

  for (const p of existing) {
    if (candidate.id && p.id === candidate.id) continue
    if (cleanGstin && p.gstin.trim().toUpperCase() === cleanGstin) {
      return `Duplicate Fleet Partner detected: GSTIN ${cleanGstin} already belongs to ${p.companyName} (${p.partnerCode}).`
    }
    if (cleanReg && p.businessRegistrationNo.trim().toUpperCase() === cleanReg) {
      return `Duplicate Fleet Partner detected: Business Registration ${cleanReg} already exists on ${p.companyName}.`
    }
    if (cleanName && p.companyName.trim().toLowerCase() === cleanName && cleanMobile && p.mobile.replace(/\D/g, '').slice(-10) === cleanMobile) {
      return `Duplicate Fleet Partner detected: ${p.companyName} with the same mobile already exists.`
    }
  }
  return null
}

export function detectDuplicateIndividualOwner(
  existing: IndividualVehicleOwner[],
  candidate: {
    id?: string
    fullName: string
    mobile: string
    panMasked: string
    aadhaarMasked: string
  },
): string | null {
  const cleanMobile = candidate.mobile.replace(/\D/g, '').slice(-10)
  const cleanPan = candidate.panMasked.trim().toUpperCase()
  const cleanAadhaar = candidate.aadhaarMasked.trim().toUpperCase()

  for (const o of existing) {
    if (candidate.id && o.id === candidate.id) continue
    if (cleanMobile && o.mobile.replace(/\D/g, '').slice(-10) === cleanMobile) {
      return `Duplicate Individual Owner detected: Mobile ending ${cleanMobile.slice(-4)} already belongs to ${o.fullName} (${o.ownerCode}).`
    }
    if (cleanPan && cleanPan.length >= 6 && o.panMasked.trim().toUpperCase() === cleanPan) {
      return `Duplicate Individual Owner detected: PAN identifier matches ${o.fullName}.`
    }
    if (cleanAadhaar && cleanAadhaar.length >= 4 && o.aadhaarMasked.trim().toUpperCase() === cleanAadhaar) {
      return `Duplicate Individual Owner detected: Aadhaar identifier matches ${o.fullName}.`
    }
  }
  return null
}

const ALLOWED_CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_approval', 'terminated'],
  pending_approval: ['awaiting_handover', 'active', 'draft', 'terminated'],
  awaiting_handover: ['active', 'temporarily_suspended', 'termination_requested', 'terminated'],
  active: ['temporarily_suspended', 'renewal_pending', 'expired', 'termination_requested', 'vehicle_return_pending'],
  temporarily_suspended: ['active', 'termination_requested', 'terminated', 'vehicle_return_pending'],
  renewal_pending: ['active', 'expired', 'vehicle_return_pending', 'termination_requested'],
  expired: ['renewal_pending', 'vehicle_return_pending', 'closed'],
  termination_requested: ['terminated', 'vehicle_return_pending', 'active'],
  terminated: ['vehicle_return_pending', 'closed'],
  vehicle_return_pending: ['closed'],
  closed: [],
}

export function isValidContractTransition(current: ContractStatus, next: ContractStatus): boolean {
  if (current === next) return true
  return ALLOWED_CONTRACT_TRANSITIONS[current]?.includes(next) ?? false
}

export function checkOverlappingVehicleContract(params: {
  vehicleId: string
  startDate: string
  expiryDate: string
  existingLinks: ContractVehicleLink[]
  existingContracts: VehicleContract[]
  excludeContractId?: string
  overrideNote?: string
}): string | null {
  if (params.overrideNote && params.overrideNote.trim().length >= 8) {
    return null
  }
  const activeStatuses: ContractStatus[] = [
    'pending_approval',
    'awaiting_handover',
    'active',
    'temporarily_suspended',
    'renewal_pending',
  ]
  const reqStart = new Date(params.startDate).getTime()
  const reqEnd = new Date(params.expiryDate).getTime()

  for (const link of params.existingLinks) {
    if (link.vehicleId !== params.vehicleId) continue
    if (link.vehicleContractStatus === 'returned') continue
    if (params.excludeContractId && link.contractId === params.excludeContractId) continue

    const contract = params.existingContracts.find((c) => c.id === link.contractId && !c.archived)
    if (!contract || !activeStatuses.includes(contract.status)) continue

    const cStart = new Date(contract.startDate).getTime()
    const cEnd = new Date(contract.expiryDate).getTime()
    if (reqStart <= cEnd && reqEnd >= cStart) {
      return `Vehicle ${link.vehicleRegistration} already has overlapping ${contract.status.replace(/_/g, ' ')} contract ${contract.contractCode} (${contract.startDate} to ${contract.expiryDate}). Provide an authorized override note to proceed.`
    }
  }
  return null
}

export function validateCompanyFinanceEligibility(vehicle: Pick<Vehicle, 'registrationNumber' | 'ownershipCategory'>): string | null {
  const category: VehicleOwnershipCategory = vehicle.ownershipCategory ?? 'company_owned'
  if (category !== 'company_owned') {
    return `${vehicle.registrationNumber} is classified as "${category.replace(/_/g, ' ')}". Company vehicle loans and EMIs can only be attached to company-owned fleet assets; manage supplier obligations under Vehicle Contracts instead.`
  }
  return null
}

export function computeDepositSummary(
  deposit: Pick<ContractBondDeposit, 'requiredAmountInr' | 'paidAmountInr' | 'deductedAmountInr' | 'refundedAmountInr' | 'isRefundable'>,
  deductions: ContractDepositDeduction[] = [],
) {
  const totalDeductions = deductions.length > 0
    ? deductions.reduce((sum, d) => sum + Number(d.amountInr || 0), 0)
    : Number(deposit.deductedAmountInr || 0)

  const outstandingPaymentInr = Math.max(0, Math.round(Number(deposit.requiredAmountInr || 0) - Number(deposit.paidAmountInr || 0)))
  const netRefundableInr = deposit.isRefundable
    ? Math.max(0, Math.round(Number(deposit.paidAmountInr || 0) - totalDeductions - Number(deposit.refundedAmountInr || 0)))
    : 0

  return {
    totalDeductions: Math.round(totalDeductions),
    outstandingPaymentInr,
    netRefundableInr,
  }
}

export function computeMaintenanceSplit(params: {
  totalRepairAmountInr: number
  responsibleParty: ResponsibilityParty
  orgSharePct?: number
  supplierSharePct?: number
}): { orgShareInr: number; supplierShareInr: number; orgSharePct: number; supplierSharePct: number } {
  const total = Math.max(0, Math.round(Number(params.totalRepairAmountInr || 0)))
  if (params.responsibleParty === 'operating_org') {
    return { orgShareInr: total, supplierShareInr: 0, orgSharePct: 100, supplierSharePct: 0 }
  }
  if (params.responsibleParty === 'supplier') {
    return { orgShareInr: 0, supplierShareInr: total, orgSharePct: 0, supplierSharePct: 100 }
  }
  if (params.responsibleParty === 'shared') {
    const rawOrgPct = Number.isFinite(params.orgSharePct) ? Number(params.orgSharePct) : 50
    const clampedOrgPct = Math.min(100, Math.max(0, rawOrgPct))
    const supplierPct = Number((100 - clampedOrgPct).toFixed(2))
    const orgShareInr = Math.round((total * clampedOrgPct) / 100)
    const supplierShareInr = Math.max(0, total - orgShareInr)
    return {
      orgShareInr,
      supplierShareInr,
      orgSharePct: clampedOrgPct,
      supplierSharePct: supplierPct,
    }
  }
  return { orgShareInr: total, supplierShareInr: 0, orgSharePct: 100, supplierSharePct: 0 }
}

export interface AmendmentDiffRow {
  field: string
  label: string
  previousValue: string
  revisedValue: string
  changed: boolean
}

export function buildAmendmentComparison(amendment: ContractAmendment): AmendmentDiffRow[] {
  const allKeys = Array.from(
    new Set([...Object.keys(amendment.previousValues || {}), ...Object.keys(amendment.revisedValues || {})]),
  )
  return allKeys.map((key) => {
    const prevVal = amendment.previousValues?.[key]
    const nextVal = amendment.revisedValues?.[key]
    const prevStr = prevVal === undefined || prevVal === null ? '—' : String(prevVal)
    const nextStr = nextVal === undefined || nextVal === null ? '—' : String(nextVal)
    const label = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim()
    return {
      field: key,
      label,
      previousValue: prevStr,
      revisedValue: nextStr,
      changed: prevStr !== nextStr,
    }
  })
}

export function compareHandoverVsReturn(
  initial: VehicleHandoverRecord | undefined,
  returned: VehicleHandoverRecord,
) {
  const distanceTravelledKm = initial
    ? Math.max(0, Math.round(returned.odometerKm - initial.odometerKm))
    : 0
  const fuelDeltaPct = initial
    ? Math.round(returned.fuelLevelPct - initial.fuelLevelPct)
    : 0
  const missingAccessories = initial
    ? initial.accessoriesChecklist.filter((item) => !returned.accessoriesChecklist.includes(item))
    : []
  const missingEquipmentList = initial
    ? initial.equipmentChecklist.filter((item) => !returned.equipmentChecklist.includes(item))
    : []
  const exteriorChanged = initial ? initial.exteriorCondition !== returned.exteriorCondition : false
  const interiorChanged = initial ? initial.interiorCondition !== returned.interiorCondition : false
  const tyreChanged = initial ? initial.tyreCondition !== returned.tyreCondition : false

  return {
    distanceTravelledKm,
    fuelDeltaPct,
    missingAccessories,
    missingEquipmentList,
    exteriorChanged,
    interiorChanged,
    tyreChanged,
    totalEstimatedChargesInr:
      Math.round(Number(returned.pendingRepairsInr || 0) + Number(returned.outstandingExpensesInr || 0)),
    recommendedDeductionInr: Math.round(Number(returned.recommendedDeductionInr || 0)),
  }
}

export function canCloseContract(params: {
  contract: VehicleContract
  payments: ContractPayment[]
  deposits: ContractBondDeposit[]
  handovers: VehicleHandoverRecord[]
  links: ContractVehicleLink[]
}): { allowed: boolean; blockers: string[] } {
  if (params.contract.closureExceptionNote && params.contract.closureExceptionNote.trim().length >= 8) {
    return { allowed: true, blockers: [] }
  }
  const blockers: string[] = []
  const openPayments = params.payments.filter(
    (p) =>
      p.contractId === params.contract.id &&
      ['pending_approval', 'approved', 'partially_paid', 'overdue', 'disputed'].includes(p.status) &&
      p.outstandingAmountInr > 0,
  )
  if (openPayments.length > 0) {
    blockers.push(`${openPayments.length} unsettled contract payment(s) still have outstanding balance.`)
  }

  const openDeposits = params.deposits.filter(
    (d) => d.contractId === params.contract.id && d.isRefundable && d.status !== 'closed',
  )
  if (openDeposits.length > 0) {
    blockers.push(`${openDeposits.length} refundable security deposit/bond record(s) are not yet closed.`)
  }

  const activeVehicles = params.links.filter(
    (l) => l.contractId === params.contract.id && l.vehicleContractStatus !== 'returned',
  )
  const returnHandovers = params.handovers.filter(
    (h) => h.contractId === params.contract.id && h.recordType === 'vehicle_return',
  )
  if (activeVehicles.length > 0 && returnHandovers.length < activeVehicles.length) {
    blockers.push(`${activeVehicles.length - returnHandovers.length} contracted vehicle(s) still require return handover inspection.`)
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  }
}

export function validateAssignmentAgainstContract(params: {
  vehicle: Pick<Vehicle, 'id' | 'registrationNumber' | 'ownershipCategory' | 'activeContractId'>
  contracts: VehicleContract[]
  overrideNote?: string
}): string | null {
  if ((params.vehicle.ownershipCategory ?? 'company_owned') === 'company_owned') {
    return null
  }
  if (params.overrideNote && params.overrideNote.trim().length >= 5) {
    return null
  }
  if (!params.vehicle.activeContractId) {
    return `${params.vehicle.registrationNumber} is a third-party vehicle without an active contract. Link an active contract or provide an authorized override note.`
  }
  const contract = params.contracts.find((c) => c.id === params.vehicle.activeContractId)
  if (!contract) return null
  if (contract.status === 'expired' || contract.status === 'terminated' || contract.status === 'closed') {
    return `${params.vehicle.registrationNumber} belongs to ${contract.status} contract ${contract.contractCode}. Renew contract or provide an authorized override.`
  }
  return null
}

export function generateContractAlerts(params: {
  contracts: VehicleContract[]
  payments: ContractPayment[]
  deposits: ContractBondDeposit[]
  amendments: ContractAmendment[]
  links: ContractVehicleLink[]
  handovers: VehicleHandoverRecord[]
  nowMs?: number
}): ContractAlertItem[] {
  const nowMs = params.nowMs ?? Date.now()
  const alerts: ContractAlertItem[] = []

  for (const c of params.contracts) {
    if (c.archived || c.status === 'closed' || c.status === 'terminated') continue

    const daysLeft = Math.ceil((new Date(c.expiryDate).getTime() - nowMs) / 86400000)
    if (daysLeft <= 0 && c.status !== 'expired') {
      alerts.push({
        id: `ca-exp-${c.id}`,
        severity: 'critical',
        category: 'Contract Expired',
        title: `${c.contractCode} expired (${c.supplierName})`,
        message: `${c.contractName} expired on ${c.expiryDate}. Initiate renewal or vehicle return handover immediately.`,
        contractId: c.id,
        actionRoute: `/dashboard/contracts/register/${c.id}`,
        daysRemaining: daysLeft,
      })
    } else if (daysLeft <= 30) {
      const severity = daysLeft <= 3 ? 'critical' : daysLeft <= 7 ? 'high' : daysLeft <= 15 ? 'moderate' : 'normal'
      alerts.push({
        id: `ca-soon-${c.id}`,
        severity,
        category: 'Contract Expiry Reminder',
        title: `${c.contractCode} expires in ${daysLeft} day(s)`,
        message: `${c.contractName} with ${c.supplierName} expires on ${c.expiryDate}.`,
        contractId: c.id,
        actionRoute: `/dashboard/contracts/renewals`,
        daysRemaining: daysLeft,
      })
    }

    if (c.status === 'pending_approval') {
      alerts.push({
        id: `ca-appr-${c.id}`,
        severity: 'high',
        category: 'Contract Approval Pending',
        title: `Approval needed: ${c.contractCode}`,
        message: `${c.contractName} (${c.supplierName}) is awaiting authorized contract approval.`,
        contractId: c.id,
        actionRoute: `/dashboard/contracts/register/${c.id}`,
      })
    }

    if (c.status === 'vehicle_return_pending') {
      alerts.push({
        id: `ca-ret-${c.id}`,
        severity: 'high',
        category: 'Pending Vehicle Return',
        title: `Vehicle return pending for ${c.contractCode}`,
        message: `Complete return inspection & condition comparison before closing ${c.contractName}.`,
        contractId: c.id,
        actionRoute: `/dashboard/contracts/vehicles`,
      })
    }
  }

  for (const am of params.amendments) {
    if (am.approvalStatus === 'submitted') {
      alerts.push({
        id: `ca-am-${am.id}`,
        severity: 'moderate',
        category: 'Amendment Approval Pending',
        title: `Amendment ${am.amendmentCode} submitted`,
        message: `${am.title} effective ${am.effectiveDate} awaits approval.`,
        contractId: am.contractId,
        actionRoute: `/dashboard/contracts/register/${am.contractId}`,
      })
    }
  }

  for (const p of params.payments) {
    const daysDue = Math.ceil((new Date(p.dueDate).getTime() - nowMs) / 86400000)
    if (p.status === 'overdue' || (p.outstandingAmountInr > 0 && daysDue < 0 && p.status !== 'paid' && p.status !== 'reconciled' && p.status !== 'cancelled')) {
      alerts.push({
        id: `ca-pay-ov-${p.id}`,
        severity: 'critical',
        category: 'Contract Payment Overdue',
        title: `Overdue ₹${p.outstandingAmountInr.toLocaleString('en-IN')} (${p.transactionCode})`,
        message: `${p.supplierName} · Due ${p.dueDate} (${p.billingPeriod}).`,
        contractId: p.contractId,
        actionRoute: `/dashboard/contracts/payments`,
        daysRemaining: daysDue,
      })
    } else if (p.outstandingAmountInr > 0 && daysDue <= 7 && p.status !== 'paid' && p.status !== 'reconciled') {
      alerts.push({
        id: `ca-pay-due-${p.id}`,
        severity: 'moderate',
        category: 'Contract Payment Due Soon',
        title: `Upcoming ₹${p.outstandingAmountInr.toLocaleString('en-IN')} (${p.transactionCode})`,
        message: `${p.supplierName} payment due in ${Math.max(0, daysDue)} day(s).`,
        contractId: p.contractId,
        actionRoute: `/dashboard/contracts/payments`,
        daysRemaining: daysDue,
      })
    }
  }

  for (const d of params.deposits) {
    if (d.outstandingAmountInr > 0 && d.status !== 'closed') {
      alerts.push({
        id: `ca-dep-due-${d.id}`,
        severity: 'high',
        category: 'Security Deposit Pending',
        title: `Deposit shortfall ₹${d.outstandingAmountInr.toLocaleString('en-IN')} (${d.depositCode})`,
        message: `${d.supplierName}: ₹${d.paidAmountInr.toLocaleString('en-IN')} paid of ₹${d.requiredAmountInr.toLocaleString('en-IN')} required.`,
        contractId: d.contractId,
        actionRoute: `/dashboard/contracts/deposits/${d.id}`,
      })
    }
    if (d.status === 'refund_approval') {
      alerts.push({
        id: `ca-dep-ref-${d.id}`,
        severity: 'high',
        category: 'Deposit Refund Pending',
        title: `Deposit refund approval pending (${d.depositCode})`,
        message: `Authorize deductions/refund calculation for ${d.supplierName}.`,
        contractId: d.contractId,
        actionRoute: `/dashboard/contracts/deposits/${d.id}`,
      })
    }
  }

  return alerts.sort((a, b) => {
    const rank = { critical: 0, high: 1, moderate: 2, normal: 3 }
    return rank[a.severity] - rank[b.severity]
  })
}

export function filterReplacementCandidates(vehicles: Vehicle[], includeThirdParty = false): Vehicle[] {
  if (includeThirdParty) return vehicles
  return vehicles.filter((v) => (v.ownershipCategory ?? 'company_owned') === 'company_owned')
}

export function getDepositStatusOrder(): DepositStatus[] {
  return [
    'deposit_defined',
    'payment_recorded',
    'payment_verified',
    'active',
    'contract_expiry',
    'vehicle_inspection',
    'deductions',
    'refund_approval',
    'refund_payment',
    'closed',
  ]
}

export function canTransitionAmendment(current: AmendmentApprovalStatus, next: AmendmentApprovalStatus): boolean {
  const map: Record<AmendmentApprovalStatus, AmendmentApprovalStatus[]> = {
    draft: ['submitted', 'rejected'],
    submitted: ['approved', 'rejected'],
    approved: ['effective'],
    rejected: ['draft'],
    effective: [],
  }
  return current === next || (map[current]?.includes(next) ?? false)
}
