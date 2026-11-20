import { beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import {
  addContractDocument,
  approveAmendment,
  approveDepositRefund,
  approveMaintenanceAllocation,
  createAmendment,
  createContract,
  createDeposit,
  createFleetPartner,
  createHandover,
  createMaintenanceAllocation,
  createPayment,
  ensureContractsSchemaAndSeed,
  getContractOverview,
  getContractWorkspace,
  recordDepositDeduction,
  recordDepositPayment,
  settleMaintenanceAllocation,
  submitAmendment,
  updateContractStatus,
  updatePaymentStatus,
} from '../../server/contractsDb.ts'

const ORG = 'org-kaveri'
const OTHER = 'org-other'

function makeVehicles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `veh-${index + 1}`,
    registrationNumber: `KA01AB${String(1000 + index)}`,
    category: index % 2 === 0 ? 'Truck' : 'Van',
    odometerKm: 10_000 + index * 500,
    lastServiceDate: '2026-01-05',
  }))
}

function buildDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE org_fleet_blobs (
      organization_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL
    );
  `)
  db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run(ORG, 'Kaveri Logistics')
  db.prepare('INSERT INTO organizations (id, name) VALUES (?, ?)').run(OTHER, 'Other Transport')
  db.prepare('INSERT INTO org_fleet_blobs (organization_id, payload_json) VALUES (?, ?)')
    .run(ORG, JSON.stringify({ vehicles: makeVehicles(6) }))
  db.prepare('INSERT INTO org_fleet_blobs (organization_id, payload_json) VALUES (?, ?)')
    .run(OTHER, JSON.stringify({ vehicles: makeVehicles(2) }))
  ensureContractsSchemaAndSeed(db)
  return db
}

describe('vehicle contracts domain', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = buildDb()
  })

  it('seeds ownership, partners, contracts, deposits, payments, maintenance and handovers', () => {
    const workspace = getContractWorkspace(db, ORG)
    expect(workspace.contracts).toHaveLength(3)
    expect(workspace.partners).toHaveLength(2)
    expect(workspace.owners).toHaveLength(1)
    expect(workspace.deposits).toHaveLength(2)
    expect(workspace.payments).toHaveLength(4)
    expect(workspace.maintenance).toHaveLength(1)
    expect(workspace.handovers).toHaveLength(1)
    expect(workspace.ownership).toHaveLength(6)

    const types = workspace.ownership.map((o) => o.ownershipType)
    expect(types.filter((t) => t === 'contracted_fleet')).toHaveLength(3)
    expect(types.filter((t) => t === 'individual_owner')).toHaveLength(1)
    expect(types.filter((t) => t === 'company_owned')).toHaveLength(2)
  })

  it('derives overview KPIs from persisted records only', () => {
    const overview = getContractOverview(db, ORG)
    expect(overview.kpis.activeContracts).toBe(2)
    expect(overview.kpis.contractedVehicles).toBe(3)
    expect(overview.kpis.individualOwnerVehicles).toBe(1)
    expect(overview.kpis.totalSecurityDepositsInr).toBe(150_000)
    expect(overview.kpis.outstandingDepositsInr).toBe(40_000)
    expect(overview.kpis.pendingMaintenanceSettlementsInr).toBe(13_000)
    expect(overview.ownershipDistribution.find((r) => r.ownershipType === 'company_owned')?.count).toBe(2)
  })

  it('rejects duplicate GSTIN within one organization but allows another organization', () => {
    const partner = createFleetPartner(db, ORG, { companyName: 'New Partner', gstin: '27AAACX1234D1Z5' }, 'Owner')
    expect(partner.gstin).toBe('27AAACX1234D1Z5')
    expect(() => createFleetPartner(db, ORG, { companyName: 'Duplicate', gstin: '27aaacx1234d1z5' }, 'Owner'))
      .toThrow(/GSTIN already exists/i)
    expect(() => createFleetPartner(db, OTHER, { companyName: 'Same GSTIN other tenant', gstin: '27AAACX1234D1Z5' }, 'Owner'))
      .not.toThrow()
  })

  it('creates a multi-vehicle contract and blocks overlapping active contracts', () => {
    const workspace = getContractWorkspace(db, ORG)
    const partner = workspace.partners[0]
    const contract = createContract(db, ORG, 'Owner', {
      name: 'Multi vehicle test',
      category: 'fixed_monthly',
      supplierType: 'fleet_partner',
      fleetPartnerId: partner.id,
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      status: 'active',
      financialTerms: { monthlyRentalInr: 1234.56 },
      vehicles: [
        { vehicleId: 'veh-1', agreedRentalInr: 600.5 },
        { vehicleId: 'veh-6', agreedRentalInr: 634.06 },
      ],
    }, 'Owner')
    expect(contract.vehicles).toHaveLength(2)
    expect(contract.financialTerms.monthlyRentalInr).toBe(1234.56)

    const updated = getContractWorkspace(db, ORG)
    expect(updated.ownership.find((o) => o.vehicleId === 'veh-1')?.contractId).toBe(contract.id)
    expect(updated.ownership.find((o) => o.vehicleId === 'veh-1')?.ownershipType).toBe('contracted_fleet')

    expect(() => createContract(db, ORG, 'Owner', {
      name: 'Overlap',
      category: 'custom',
      supplierType: 'fleet_partner',
      fleetPartnerId: partner.id,
      startDate: '2026-02-01',
      expiryDate: '2027-02-01',
      vehicles: [{ vehicleId: 'veh-1' }],
    }, 'Owner')).toThrow(/active operating contract/i)
  })

  it('enforces tenant isolation for suppliers and vehicles', () => {
    const kaveriPartner = getContractWorkspace(db, ORG).partners[0]
    expect(() => createContract(db, OTHER, 'Other Owner', {
      name: 'Cross tenant',
      category: 'custom',
      supplierType: 'fleet_partner',
      fleetPartnerId: kaveriPartner.id,
      startDate: '2026-01-01',
      expiryDate: '2027-01-01',
      vehicles: [{ vehicleId: 'veh-1' }],
    }, 'Other Owner')).toThrow(/Fleet partner not found/i)
  })

  it('rejects invalid status transitions and protects closing with unresolved records', () => {
    const active = getContractWorkspace(db, ORG).contracts.find((c) => c.status === 'active')!
    expect(() => updateContractStatus(db, ORG, active.id, 'draft', 'Owner')).toThrow(/Cannot move a contract/i)
    expect(() => updateContractStatus(db, ORG, active.id, 'closed', 'Owner')).toThrow(/Cannot move a contract/i)
    const returned = updateContractStatus(db, ORG, active.id, 'termination_requested', 'Owner')
    expect(returned.status).toBe('termination_requested')
    expect(() => updateContractStatus(db, ORG, active.id, 'terminated', 'Owner')).not.toThrow()
    expect(() => updateContractStatus(db, ORG, active.id, 'closed', 'Owner')).toThrow(/unresolved deposits, payments or vehicle returns/i)
    const closed = updateContractStatus(db, ORG, active.id, 'closed', 'Owner', { allowUnresolved: true })
    expect(closed.status).toBe('closed')
  })

  it('versions amendments and applies approved values', () => {
    const contract = getContractWorkspace(db, ORG).contracts.find((c) => c.status === 'renewal_pending')!
    const before = contract.currentVersion
    const amendment = createAmendment(db, ORG, contract.id, {
      title: 'Extend by one year',
      reason: 'Renewal negotiation',
      revisedValues: { expiryDate: '2028-01-01', monthlyRentalInr: 42000 },
      effectiveDate: '2026-12-01',
    }, 'Owner')
    expect(amendment.status).toBe('draft')
    expect(amendment.previousValues.monthlyRentalInr).toBe(35000)

    submitAmendment(db, ORG, contract.id, amendment.id, 'Owner')
    approveAmendment(db, ORG, contract.id, amendment.id, 'Approver', true)
    const after = getContractWorkspace(db, ORG).contracts.find((c) => c.id === contract.id)!
    expect(after.currentVersion).toBe(before + 1)
    expect(after.expiryDate).toBe('2028-01-01')
    expect(after.financialTerms.monthlyRentalInr).toBe(42000)
  })

  it('tracks deposit payment, deduction and refund with paise precision', () => {
    const contract = getContractWorkspace(db, ORG).contracts[0]
    const deposit = createDeposit(db, ORG, contract.id, {
      depositType: 'refundable_security',
      requiredAmountInr: 1000.55,
      refundable: true,
      receivingParty: contract.supplierName,
    }, 'Owner')
    expect(deposit.requiredAmountInr).toBe(1000.55)
    expect(deposit.outstandingAmountInr).toBe(1000.55)

    const partial = recordDepositPayment(db, ORG, contract.id, deposit.id, { amountInr: 500.25, paymentReference: 'UTR-1' }, 'Owner')
    expect(partial.paidAmountInr).toBe(500.25)
    expect(partial.outstandingAmountInr).toBe(500.3)

    expect(() => recordDepositDeduction(db, ORG, contract.id, deposit.id, { amountInr: 600, reason: 'Damage' }, 'Owner'))
      .toThrow(/exceeds/i)

    recordDepositDeduction(db, ORG, contract.id, deposit.id, { amountInr: 100.05, reason: 'Damage', evidence: 'INSP-1' }, 'Owner')
    const refunded = approveDepositRefund(db, ORG, contract.id, deposit.id, 'Approver')
    expect(refunded.status).toBe('refunded')
    expect(refunded.refundableInr).toBe(400.2)
  })

  it('supports partial payments and prevents overpayment', () => {
    const contract = getContractWorkspace(db, ORG).contracts[0]
    const payment = createPayment(db, ORG, contract.id, {
      billingPeriod: '2027-01',
      dueDate: '2027-01-10',
      amountInr: 5000.75,
      status: 'approved',
    }, 'Owner')
    const partial = updatePaymentStatus(db, ORG, contract.id, payment.id, 'paid', 'Owner', 2000.25, 'UTR-2')
    expect(partial.status).toBe('partially_paid')
    expect(partial.outstandingAmountInr).toBe(3000.5)
    const paid = updatePaymentStatus(db, ORG, contract.id, payment.id, 'paid', 'Owner', 9999, 'UTR-3')
    expect(paid.status).toBe('paid')
    expect(paid.paidAmountInr).toBe(5000.75)
  })

  it('requires maintenance shares to equal the total and settles after approval', () => {
    const contract = getContractWorkspace(db, ORG).contracts.find((c) => c.status === 'active')!
    const vehicle = contract.vehicles[0]
    expect(() => createMaintenanceAllocation(db, ORG, contract.id, {
      vehicleId: vehicle.vehicleId,
      category: 'Brakes',
      description: 'Pad replacement',
      totalCostInr: 1000,
      operatingOrgShareInr: 200,
      supplierShareInr: 700,
      responsibility: 'shared',
    }, 'Owner')).toThrow(/add up to the total/i)

    const allocation = createMaintenanceAllocation(db, ORG, contract.id, {
      vehicleId: vehicle.vehicleId,
      category: 'Brakes',
      description: 'Pad replacement',
      totalCostInr: 1000.25,
      operatingOrgShareInr: 200.1,
      supplierShareInr: 800.15,
      responsibility: 'shared',
    }, 'Owner')
    expect(() => settleMaintenanceAllocation(db, ORG, contract.id, allocation.id, 'Owner')).toThrow(/Approve/i)
    approveMaintenanceAllocation(db, ORG, contract.id, allocation.id, 'Approver', true)
    const settled = settleMaintenanceAllocation(db, ORG, contract.id, allocation.id, 'Approver')
    expect(settled.settlementStatus).toBe('settled')
  })

  it('records handover and return evidence and links documents', () => {
    const contract = getContractWorkspace(db, ORG).contracts.find((c) => c.status === 'active')!
    const vehicle = contract.vehicles[0]
    const handover = createHandover(db, ORG, contract.id, {
      vehicleId: vehicle.vehicleId,
      handoverType: 'return',
      handoverAt: '2027-01-15',
      odometerKm: 42000.4,
      fuelLevelPct: 55,
      exteriorCondition: 'Clean',
      interiorCondition: 'Clean',
      tyreCondition: '4 mm',
      photoReferences: ['return/front.jpg'],
      documentChecklist: ['RC'],
    }, 'Owner')
    expect(handover.odometerKm).toBe(42000)
    const updated = getContractWorkspace(db, ORG).contracts.find((c) => c.id === contract.id)!
    expect(updated.vehicles.find((v) => v.vehicleId === vehicle.vehicleId)?.returnedAt).toBe('2027-01-15')

    const doc = addContractDocument(db, ORG, contract.id, { name: 'Return checklist', category: 'Handover checklist' }, 'Owner')
    expect(getContractWorkspace(db, ORG).documents.some((d) => d.id === doc.id)).toBe(true)
  })
})
