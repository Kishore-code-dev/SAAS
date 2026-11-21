import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_CONTRACT_PERMISSION_KEYS,
  buildAmendmentComparison,
  canCloseContract,
  canRevealSensitiveSupplierDetails,
  checkOverlappingVehicleContract,
  compareHandoverVsReturn,
  computeDepositSummary,
  computeMaintenanceSplit,
  detectDuplicateIndividualOwner,
  detectDuplicatePartner,
  filterReplacementCandidates,
  generateContractAlerts,
  hasContractPermission,
  isValidContractTransition,
  validateAssignmentAgainstContract,
  validateCompanyFinanceEligibility,
} from './contractsEngine'
import type {
  ContractAmendment,
  ContractBondDeposit,
  ContractPayment,
  ContractPermissionRule,
  ContractVehicleLink,
  FleetPartner,
  IndividualVehicleOwner,
  VehicleContract,
  VehicleHandoverRecord,
} from '../types/contracts'
import type { Vehicle } from '../types/fleet'

test('permission matrix enforces owner full control, restricted platform_admin, and configurable staff overrides', () => {
  assert.equal(ALL_CONTRACT_PERMISSION_KEYS.length, 21)
  assert.equal(hasContractPermission('org_admin', 'approve_contracts'), true)
  assert.equal(hasContractPermission('org_admin', 'approve_deposit_refunds'), true)
  assert.equal(hasContractPermission('platform_admin', 'approve_contracts'), false)
  assert.equal(hasContractPermission('platform_admin', 'approve_contract_payments'), false)
  assert.equal(hasContractPermission('fleet_manager', 'approve_contracts'), false)
  assert.equal(hasContractPermission('fleet_manager', 'create_contracts'), true)
  assert.equal(hasContractPermission('finance', 'approve_contract_payments'), true)
  assert.equal(hasContractPermission('finance', 'create_contracts'), false)

  const overrides: ContractPermissionRule[] = [
    {
      id: 'perm-1',
      organizationId: 'org-kaveri',
      role: 'fleet_manager',
      permissionKey: 'approve_contracts',
      allowed: true,
      updatedBy: 'kaveri.owner',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ]
  assert.equal(hasContractPermission('fleet_manager', 'approve_contracts', overrides), true)
  assert.equal(canRevealSensitiveSupplierDetails('org_admin'), true)
  assert.equal(canRevealSensitiveSupplierDetails('platform_admin'), false)
  assert.equal(canRevealSensitiveSupplierDetails('fleet_manager'), false)
  assert.equal(canRevealSensitiveSupplierDetails('finance'), true)
})

test('duplicate fleet partner and individual owner detection flags matching identifiers', () => {
  const partners: FleetPartner[] = [
    {
      id: 'fp-1',
      organizationId: 'org-kaveri',
      partnerCode: 'FP-001',
      companyName: 'Sri Murugan Fleet Carriers Pvt Ltd',
      businessRegistrationNo: 'CIN-U60230TN2019',
      gstin: '33AABCS1234F1Z5',
      contactPerson: 'S. Muruganandam',
      mobile: '9840011223',
      email: 'ops@srimurugan.in',
      registeredAddress: 'Chennai',
      operatingLocation: 'Chennai',
      bankAccountHolder: 'Sri Murugan Fleet Carriers Pvt Ltd',
      bankName: 'HDFC',
      bankAccountNumberMasked: 'XXXXXX1122',
      bankAccountLast4: '1122',
      ifscCode: 'HDFC0000128',
      status: 'active',
      notes: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ]

  const dupPartnerErr = detectDuplicatePartner(partners, {
    companyName: 'Another Logistics',
    gstin: '33AABCS1234F1Z5',
    businessRegistrationNo: 'NEW-REG',
    mobile: '9999988888',
  })
  assert.match(dupPartnerErr ?? '', /Duplicate Fleet Partner/i)

  const owners: IndividualVehicleOwner[] = [
    {
      id: 'io-1',
      organizationId: 'org-kaveri',
      ownerCode: 'IO-001',
      fullName: 'Ramesh Babu',
      mobile: '+91 98421 55001',
      email: 'ramesh@example.com',
      address: 'Madurai',
      identityVerificationStatus: 'verified',
      panMasked: 'ABXXXX1234',
      aadhaarMasked: 'XXXX-XXXX-8891',
      bankAccountHolder: 'Ramesh Babu',
      bankName: 'SBI',
      bankAccountNumberMasked: 'XXXXXX4401',
      bankAccountLast4: '4401',
      ifscCode: 'SBIN0004218',
      paymentPreference: 'bank_transfer',
      status: 'active',
      notes: '',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ]

  const dupOwnerErr = detectDuplicateIndividualOwner(owners, {
    fullName: 'Ramesh B',
    mobile: '9842155001',
    panMasked: 'ZZXXXX9999',
    aadhaarMasked: 'XXXX-XXXX-0001',
  })
  assert.match(dupOwnerErr ?? '', /Duplicate Individual Owner/i)
})

test('deposit deductions & net refundable calculation matches ₹50,000 - ₹40,000 paid - ₹6,500 deduction scenario', () => {
  const summary = computeDepositSummary(
    {
      requiredAmountInr: 50000,
      paidAmountInr: 40000,
      deductedAmountInr: 0,
      refundedAmountInr: 0,
      isRefundable: true,
    },
    [
      {
        id: 'ded-1',
        organizationId: 'org-kaveri',
        depositId: 'dep-1',
        contractId: 'con-1',
        amountInr: 6500,
        reason: 'Side panel dent repair upon return',
        evidenceRef: 'ret-inv-1',
        authorizedBy: 'Karthikeyan R',
        authorizedAt: '2026-06-01',
      },
    ],
  )
  assert.equal(summary.outstandingPaymentInr, 10000)
  assert.equal(summary.totalDeductions, 6500)
  assert.equal(summary.netRefundableInr, 33500)
})

test('single-transaction maintenance split allocates 60/40 accurately without rounding loss', () => {
  const split = computeMaintenanceSplit({
    totalRepairAmountInr: 18000,
    responsibleParty: 'shared',
    orgSharePct: 60,
    supplierSharePct: 40,
  })
  assert.equal(split.orgShareInr, 10800)
  assert.equal(split.supplierShareInr, 7200)
  assert.equal(split.orgShareInr + split.supplierShareInr, 18000)
})

test('overlapping active contract detection blocks duplicate active assignment unless overridden', () => {
  const existingContracts: VehicleContract[] = [
    {
      id: 'con-1',
      organizationId: 'org-kaveri',
      contractCode: 'CON-2026-001',
      contractName: 'Murugan Rental',
      contractCategory: 'fixed_monthly_rental',
      supplierType: 'fleet_partner',
      fleetPartnerId: 'fp-1',
      individualOwnerId: null,
      supplierName: 'Sri Murugan',
      agreementRefNumber: 'AGR-1',
      agreementDate: '2026-01-01',
      startDate: '2026-01-01',
      expiryDate: '2026-12-31',
      durationMonths: 12,
      currency: 'INR',
      status: 'active',
      currentVersion: 1,
      description: '',
      financialTerms: {} as VehicleContract['financialTerms'],
      contractConditions: {} as VehicleContract['contractConditions'],
      createdBy: 'owner',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
  ]
  const existingLinks: ContractVehicleLink[] = [
    {
      id: 'cvl-1',
      organizationId: 'org-kaveri',
      contractId: 'con-1',
      vehicleId: 'v-kc1',
      vehicleRegistration: 'TN09CR4410',
      ownershipCategory: 'contracted_fleet',
      agreedMonthlyRental: 68000,
      agreedPerKmRate: 0,
      agreedPerTripRate: 0,
      revenueSharePct: 0,
      fixedComponent: 68000,
      variableRateNote: '',
      maintenanceResponsibility: 'shared',
      fuelResponsibility: 'operating_org',
      insuranceResponsibility: 'supplier',
      vehicleConditionNote: 'Good',
      initialOdometerKm: 12000,
      handoverDate: '2026-01-01',
      vehicleContractStatus: 'active',
      createdAt: '2026-01-01',
    },
  ]

  const err = checkOverlappingVehicleContract({
    vehicleId: 'v-kc1',
    startDate: '2026-06-01',
    expiryDate: '2027-05-31',
    existingLinks,
    existingContracts,
  })
  assert.match(err ?? '', /overlapping/i)

  const overridden = checkOverlappingVehicleContract({
    vehicleId: 'v-kc1',
    startDate: '2026-06-01',
    expiryDate: '2027-05-31',
    existingLinks,
    existingContracts,
    overrideNote: 'Approved secondary peak-season addendum by owner',
  })
  assert.equal(overridden, null)
})

test('ownership separation blocks company loans and excludes contracted vehicles from replacement analysis by default', () => {
  const companyVehicle = { registrationNumber: 'TN01AB1234', ownershipCategory: 'company_owned' as const }
  const contractedVehicle = { registrationNumber: 'TN09CR4410', ownershipCategory: 'contracted_fleet' as const }
  const individualVehicle = { registrationNumber: 'TN58IO7721', ownershipCategory: 'individual_owner' as const }

  assert.equal(validateCompanyFinanceEligibility(companyVehicle), null)
  assert.match(validateCompanyFinanceEligibility(contractedVehicle) ?? '', /company-owned/i)
  assert.match(validateCompanyFinanceEligibility(individualVehicle) ?? '', /company-owned/i)

  const mixed = [
    { id: 'v1', ...companyVehicle },
    { id: 'v2', ...contractedVehicle },
    { id: 'v3', ...individualVehicle },
  ] as Vehicle[]
  assert.equal(filterReplacementCandidates(mixed, false).length, 1)
  assert.equal(filterReplacementCandidates(mixed, true).length, 3)
})

test('amendment diff comparison, handover comparison, lifecycle transitions, closure guard, and alerts work cleanly', () => {
  assert.equal(isValidContractTransition('draft', 'pending_approval'), true)
  assert.equal(isValidContractTransition('closed', 'active'), false)

  const amendment: ContractAmendment = {
    id: 'am-1',
    organizationId: 'org-kaveri',
    amendmentCode: 'AMD-001',
    contractId: 'con-1',
    title: 'Monthly Rental Revision',
    reason: 'Diesel cost escalation adjustment',
    amendmentType: 'rental_amount',
    previousValues: { monthlyRental: 68000, maintenanceResponsibility: 'supplier' },
    revisedValues: { monthlyRental: 72500, maintenanceResponsibility: 'shared' },
    effectiveDate: '2026-07-01',
    recalculateFutureSchedule: true,
    recalculationConfirmed: true,
    approvalStatus: 'approved',
    createdBy: 'Karthikeyan R',
    createdAt: '2026-06-15',
  }
  const diff = buildAmendmentComparison(amendment)
  assert.equal(diff.length, 2)
  assert.equal(diff[0].changed, true)

  const initial: VehicleHandoverRecord = {
    id: 'ho-1',
    organizationId: 'org-kaveri',
    handoverCode: 'HO-001',
    contractId: 'con-1',
    vehicleId: 'v-kc1',
    vehicleRegistration: 'TN09CR4410',
    supplierType: 'fleet_partner',
    supplierName: 'Sri Murugan',
    recordType: 'initial_handover',
    handoverDatetime: '2026-01-01T09:00:00Z',
    odometerKm: 24000,
    fuelLevelPct: 80,
    exteriorCondition: 'good',
    interiorCondition: 'good',
    tyreCondition: 'good',
    existingDamages: 'None',
    accessoriesChecklist: ['Spare Wheel', 'Jack', 'First Aid Kit'],
    equipmentChecklist: ['GPS Mount', 'Fastag'],
    documentChecklist: ['RC', 'Insurance', 'Permit'],
    photos: [],
    handoverNotes: 'Clean handover',
    supplierRepresentative: 'Murugan',
    receivingRepresentative: 'Priya',
    supplierAckName: 'Murugan',
    receivingAckName: 'Priya',
    createdBy: 'Priya',
    createdAt: '2026-01-01T09:00:00Z',
  }
  const returned: VehicleHandoverRecord = {
    ...initial,
    id: 'ho-2',
    handoverCode: 'RET-001',
    recordType: 'vehicle_return',
    linkedInitialHandoverId: 'ho-1',
    handoverDatetime: '2026-06-01T17:00:00Z',
    odometerKm: 39400,
    fuelLevelPct: 45,
    exteriorCondition: 'damaged',
    accessoriesChecklist: ['Spare Wheel', 'Jack'],
    pendingRepairsInr: 4500,
    outstandingExpensesInr: 2000,
    recommendedDeductionInr: 6500,
  }
  const cmp = compareHandoverVsReturn(initial, returned)
  assert.equal(cmp.distanceTravelledKm, 15400)
  assert.equal(cmp.fuelDeltaPct, -35)
  assert.deepEqual(cmp.missingAccessories, ['First Aid Kit'])
  assert.equal(cmp.exteriorChanged, true)
  assert.equal(cmp.totalEstimatedChargesInr, 6500)

  const closureCheck = canCloseContract({
    contract: { id: 'con-1', status: 'vehicle_return_pending' } as VehicleContract,
    payments: [{ contractId: 'con-1', status: 'overdue', outstandingAmountInr: 15000 } as ContractPayment],
    deposits: [{ contractId: 'con-1', isRefundable: true, status: 'refund_approval' } as ContractBondDeposit],
    handovers: [],
    links: [{ contractId: 'con-1', vehicleContractStatus: 'active' } as ContractVehicleLink],
  })
  assert.equal(closureCheck.allowed, false)
  assert.equal(closureCheck.blockers.length, 3)

  const assignBlock = validateAssignmentAgainstContract({
    vehicle: { id: 'v-kc1', registrationNumber: 'TN09CR4410', ownershipCategory: 'contracted_fleet', activeContractId: 'con-1' },
    contracts: [{ id: 'con-1', contractCode: 'CON-1', status: 'expired' } as VehicleContract],
  })
  assert.match(assignBlock ?? '', /expired/i)

  const nowMs = new Date('2026-11-20T00:00:00Z').getTime()
  const alerts = generateContractAlerts({
    contracts: [
      {
        id: 'con-exp-soon',
        contractCode: 'CON-EXP-1',
        contractName: 'Soon Expiring',
        supplierName: 'Partner A',
        expiryDate: '2026-11-25',
        status: 'active',
      } as VehicleContract,
    ],
    payments: [],
    deposits: [],
    amendments: [],
    links: [],
    handovers: [],
    nowMs,
  })
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].severity, 'high')
})
