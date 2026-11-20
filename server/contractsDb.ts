import crypto from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type {
  ContractActivityEntry,
  ContractAmendment,
  ContractConditions,
  ContractDeposit,
  ContractDocument,
  ContractFinancialTerms,
  ContractMaintenanceAllocation,
  ContractOverview,
  ContractPayment,
  ContractPaymentStatus,
  ContractStatus,
  ContractVehicleLink,
  ContractWorkspace,
  CreateAmendmentInput,
  CreateContractInput,
  DepositStatus,
  DepositType,
  FleetPartner,
  IndividualVehicleOwner,
  MaintenanceResponsibility,
  OwnershipType,
  VehicleContract,
  VehicleHandover,
  VehicleOwnershipRecord,
} from '../src/types/contracts.ts'
import type { Vehicle } from '../src/types/fleet.ts'

const DEFAULT_TERMS: ContractFinancialTerms = {
  fixedRentalInr: 0,
  monthlyRentalInr: 0,
  perKmRateInr: 0,
  perTripRateInr: 0,
  revenueSharePct: 0,
  paymentFrequency: 'monthly',
  paymentDueDay: 5,
  advancePaymentInr: 0,
  securityDepositInr: 0,
  bondAmountInr: 0,
  latePaymentTerms: '',
  taxTreatment: 'GST extra as applicable',
  additionalCharges: '',
  deductionConditions: '',
  settlementConditions: '',
}

const DEFAULT_CONDITIONS: ContractConditions = {
  maintenance: 'unspecified',
  fuel: 'operating_org',
  insurance: 'supplier',
  accident: 'unspecified',
  tyres: 'unspecified',
  breakdown: 'unspecified',
  driver: 'operating_org',
  permit: 'supplier',
  fitnessPuc: 'supplier',
  vehicleReplacement: '',
  downtime: '',
  termination: '',
  renewal: '',
  vehicleReturn: '',
}

function nowIso(): string {
  return new Date().toISOString()
}

function dateOffset(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
}

function rupeesToPaise(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function paiseToRupees(value: unknown): number {
  return Math.round(Number(value ?? 0)) / 100
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export interface ContractActor {
  userId: string
  username: string
  fullName: string
  role: string
}

export function ensureContractsSchemaAndSeed(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fleet_partners (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      registration_number TEXT NOT NULL DEFAULT '',
      gstin TEXT NOT NULL DEFAULT '',
      contact_person TEXT NOT NULL DEFAULT '',
      mobile TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      registered_address TEXT NOT NULL DEFAULT '',
      operating_location TEXT NOT NULL DEFAULT '',
      bank_account_masked TEXT NOT NULL DEFAULT '',
      bank_ifsc TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fleet_partners_org_gstin
      ON fleet_partners(organization_id, gstin) WHERE gstin <> '';

    CREATE TABLE IF NOT EXISTS individual_vehicle_owners (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      identity_verification_status TEXT NOT NULL DEFAULT 'pending',
      identity_document_type TEXT NOT NULL DEFAULT '',
      identity_document_masked TEXT NOT NULL DEFAULT '',
      bank_account_masked TEXT NOT NULL DEFAULT '',
      bank_ifsc TEXT NOT NULL DEFAULT '',
      payment_preference TEXT NOT NULL DEFAULT 'bank_transfer',
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_individual_owners_org_mobile
      ON individual_vehicle_owners(organization_id, mobile) WHERE mobile <> '';

    CREATE TABLE IF NOT EXISTS vehicle_ownership (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      ownership_type TEXT NOT NULL DEFAULT 'company_owned',
      legal_owner_name TEXT NOT NULL DEFAULT '',
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      contract_id TEXT,
      effective_from TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_ownership_org_vehicle
      ON vehicle_ownership(organization_id, vehicle_id);

    CREATE TABLE IF NOT EXISTS vehicle_contracts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_number TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      supplier_type TEXT NOT NULL,
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      supplier_name TEXT NOT NULL,
      agreement_reference TEXT NOT NULL DEFAULT '',
      agreement_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      duration_months INTEGER NOT NULL DEFAULT 12,
      currency TEXT NOT NULL DEFAULT 'INR',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      current_version INTEGER NOT NULL DEFAULT 1,
      financial_terms_json TEXT NOT NULL,
      conditions_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_contracts_org_number
      ON vehicle_contracts(organization_id, contract_number);
    CREATE INDEX IF NOT EXISTS idx_vehicle_contracts_org_status
      ON vehicle_contracts(organization_id, status, expiry_date);

    CREATE TABLE IF NOT EXISTS vehicle_contract_vehicles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      ownership_type TEXT NOT NULL,
      vehicle_category TEXT NOT NULL DEFAULT '',
      condition TEXT NOT NULL DEFAULT '',
      initial_odometer_km INTEGER NOT NULL DEFAULT 0,
      handover_date TEXT NOT NULL,
      agreed_rental_paise INTEGER NOT NULL DEFAULT 0,
      maintenance_responsibility TEXT NOT NULL DEFAULT 'unspecified',
      returned_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_vehicles_org_vehicle
      ON vehicle_contract_vehicles(organization_id, vehicle_id, contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_vehicles_contract
      ON vehicle_contract_vehicles(contract_id);

    CREATE TABLE IF NOT EXISTS contract_amendments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      amendment_number TEXT NOT NULL,
      title TEXT NOT NULL,
      reason TEXT NOT NULL,
      previous_values_json TEXT NOT NULL,
      revised_values_json TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      approved_by TEXT,
      created_at TEXT NOT NULL,
      approved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_contract_amendments_contract
      ON contract_amendments(contract_id, status);

    CREATE TABLE IF NOT EXISTS contract_deposits (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      deposit_type TEXT NOT NULL,
      vehicle_ids_json TEXT NOT NULL,
      required_paise INTEGER NOT NULL DEFAULT 0,
      paid_paise INTEGER NOT NULL DEFAULT 0,
      deductions_paise INTEGER NOT NULL DEFAULT 0,
      refundable INTEGER NOT NULL DEFAULT 1,
      payment_date TEXT,
      payment_reference TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT '',
      receiving_party TEXT NOT NULL DEFAULT '',
      refund_conditions TEXT NOT NULL DEFAULT '',
      expiry_date TEXT,
      document_reference TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'defined',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contract_deposits_contract ON contract_deposits(contract_id);

    CREATE TABLE IF NOT EXISTS contract_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      vehicle_id TEXT,
      billing_period TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount_paise INTEGER NOT NULL DEFAULT 0,
      paid_paise INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT '',
      payment_reference TEXT NOT NULL DEFAULT '',
      receipt_reference TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      recorded_by TEXT NOT NULL,
      approved_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON contract_payments(contract_id, status);

    CREATE TABLE IF NOT EXISTS contract_maintenance_allocations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      work_order_id TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      total_paise INTEGER NOT NULL DEFAULT 0,
      operating_org_paise INTEGER NOT NULL DEFAULT 0,
      supplier_paise INTEGER NOT NULL DEFAULT 0,
      responsibility TEXT NOT NULL DEFAULT 'unspecified',
      approval_status TEXT NOT NULL DEFAULT 'pending',
      approved_by TEXT,
      settlement_status TEXT NOT NULL DEFAULT 'unsettled',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contract_maintenance_contract
      ON contract_maintenance_allocations(contract_id, settlement_status);

    CREATE TABLE IF NOT EXISTS vehicle_handovers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      handover_type TEXT NOT NULL,
      handover_at TEXT NOT NULL,
      odometer_km INTEGER NOT NULL DEFAULT 0,
      fuel_level_pct INTEGER NOT NULL DEFAULT 0,
      exterior_condition TEXT NOT NULL DEFAULT '',
      interior_condition TEXT NOT NULL DEFAULT '',
      tyre_condition TEXT NOT NULL DEFAULT '',
      existing_damages TEXT NOT NULL DEFAULT '',
      accessories TEXT NOT NULL DEFAULT '',
      photo_references_json TEXT NOT NULL,
      document_checklist_json TEXT NOT NULL,
      supplier_representative TEXT NOT NULL DEFAULT '',
      receiving_representative TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_handovers_contract ON vehicle_handovers(contract_id, vehicle_id);

    CREATE TABLE IF NOT EXISTS contract_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      reference TEXT NOT NULL DEFAULT '',
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_activity_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contract_activity_contract
      ON contract_activity_logs(contract_id, created_at);
  `)

  seedContractsIfEmpty(db)
}

function logActivity(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  action: string,
  summary: string,
  actor: string,
): void {
  db.prepare(`
    INSERT INTO contract_activity_logs (id, organization_id, contract_id, action, summary, actor, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(newId('cact'), orgId, contractId, action, summary, actor, nowIso())
}

function readOrgVehicles(db: DatabaseSync, orgId: string): Vehicle[] {
  const row = db
    .prepare('SELECT payload_json FROM org_fleet_blobs WHERE organization_id = ?')
    .get(orgId) as { payload_json: string } | undefined
  if (!row) return []
  const parsed = parseJson<{ vehicles?: Vehicle[] }>(row.payload_json, {})
  return Array.isArray(parsed.vehicles) ? parsed.vehicles : []
}

export function syncOwnershipFromFleet(db: DatabaseSync, orgId: string): void {
  const vehicles = readOrgVehicles(db, orgId)
  if (!vehicles.length) return
  const insert = db.prepare(`
    INSERT OR IGNORE INTO vehicle_ownership
      (id, organization_id, vehicle_id, vehicle_registration, ownership_type, legal_owner_name,
       fleet_partner_id, individual_owner_id, contract_id, effective_from, notes, created_at)
    VALUES (?, ?, ?, ?, 'company_owned', ?, NULL, NULL, NULL, ?, '', ?)
  `)
  const orgRow = db
    .prepare('SELECT name FROM organizations WHERE id = ?')
    .get(orgId) as { name: string } | undefined
  const stamp = nowIso()
  for (const vehicle of vehicles) {
    insert.run(
      newId('vown'),
      orgId,
      vehicle.id,
      vehicle.registrationNumber,
      orgRow?.name ?? 'Operating organization',
      vehicle.lastServiceDate || stamp.slice(0, 10),
      stamp,
    )
  }
}

function seedContractsIfEmpty(db: DatabaseSync): void {
  const existing = db
    .prepare('SELECT COUNT(*) AS count FROM vehicle_contracts WHERE organization_id = ?')
    .get('org-kaveri') as { count: number }
  if (existing.count > 0) return

  const vehicles = readOrgVehicles(db, 'org-kaveri')
  if (vehicles.length < 4) return
  const stamp = nowIso()

  const partnerA: FleetPartner = {
    id: 'fp-kaveri-deccan',
    organizationId: 'org-kaveri',
    companyName: 'Deccan EV Fleet Services',
    registrationNumber: 'U40100KA2021PTC144221',
    gstin: '29AABCD1234E1Z7',
    contactPerson: 'Nandini Rao',
    mobile: '+91 98450 22110',
    email: 'contracts@deccanev.in',
    registeredAddress: 'Plot 42, Peenya Industrial Area, Bengaluru, Karnataka 560058',
    operatingLocation: 'Bengaluru / Hosur corridor',
    bankAccountMasked: 'XXXX XXXX 4412',
    bankIfsc: 'HDFC0000123',
    status: 'active',
    notes: 'EV cargo fleet partner. Quarterly rate review agreed.',
    createdAt: stamp,
  }
  const partnerB: FleetPartner = {
    id: 'fp-kaveri-western',
    organizationId: 'org-kaveri',
    companyName: 'Western Star Logistics LLP',
    registrationNumber: 'AABFW8891K',
    gstin: '27AABFW8891K1Z3',
    contactPerson: 'Amit Desai',
    mobile: '+91 98200 44551',
    email: 'fleet@westernstar.in',
    registeredAddress: 'Unit 7, Bhiwandi Logistics Park, Thane, Maharashtra 421302',
    operatingLocation: 'Mumbai / Pune corridor',
    bankAccountMasked: 'XXXX XXXX 7781',
    bankIfsc: 'ICIC0000456',
    status: 'active',
    notes: 'Heavy truck supplier. Maintains own workshop.',
    createdAt: stamp,
  }
  const ownerA: IndividualVehicleOwner = {
    id: 'ivo-kaveri-ramesh',
    organizationId: 'org-kaveri',
    fullName: 'Ramesh Yadav',
    mobile: '+91 99870 11223',
    email: 'ramesh.yadav@example.in',
    address: '14 Transport Nagar, Nelamangala, Karnataka 562123',
    identityVerificationStatus: 'verified',
    identityDocumentType: 'Aadhaar',
    identityDocumentMasked: 'XXXX-XXXX-7712',
    bankAccountMasked: 'XXXX XXXX 9920',
    bankIfsc: 'SBIN0004567',
    paymentPreference: 'bank_transfer',
    status: 'active',
    notes: 'Supplies one container truck with his own driver.',
    createdAt: stamp,
  }

  const insertPartner = db.prepare(`
    INSERT INTO fleet_partners (id, organization_id, company_name, registration_number, gstin,
      contact_person, mobile, email, registered_address, operating_location, bank_account_masked,
      bank_ifsc, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const p of [partnerA, partnerB]) {
    insertPartner.run(p.id, p.organizationId, p.companyName, p.registrationNumber, p.gstin,
      p.contactPerson, p.mobile, p.email, p.registeredAddress, p.operatingLocation,
      p.bankAccountMasked, p.bankIfsc, p.status, p.notes, p.createdAt)
  }
  db.prepare(`
    INSERT INTO individual_vehicle_owners (id, organization_id, full_name, mobile, email, address,
      identity_verification_status, identity_document_type, identity_document_masked,
      bank_account_masked, bank_ifsc, payment_preference, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(ownerA.id, ownerA.organizationId, ownerA.fullName, ownerA.mobile, ownerA.email, ownerA.address,
    ownerA.identityVerificationStatus, ownerA.identityDocumentType, ownerA.identityDocumentMasked,
    ownerA.bankAccountMasked, ownerA.bankIfsc, ownerA.paymentPreference, ownerA.status, ownerA.notes, ownerA.createdAt)

  const contractA = createContract(db, 'org-kaveri', 'Kaveri Owner', {
    name: 'EV cargo fleet lease — Bengaluru hub',
    category: 'fixed_monthly',
    supplierType: 'fleet_partner',
    fleetPartnerId: partnerA.id,
    agreementReference: 'DVS/KAV/2025/014',
    agreementDate: dateOffset(-95),
    startDate: dateOffset(-90),
    expiryDate: dateOffset(275),
    durationMonths: 12,
    description: 'Two electric cargo vehicles leased from Deccan EV for the Bengaluru distribution hub.',
    status: 'active',
    financialTerms: {
      fixedRentalInr: 64000,
      monthlyRentalInr: 64000,
      securityDepositInr: 100000,
      paymentFrequency: 'monthly',
      paymentDueDay: 5,
      latePaymentTerms: '2% monthly late fee after 7-day grace',
      taxTreatment: 'GST at 18% extra',
      settlementConditions: 'Monthly rental settled by 5th; maintenance settled within 15 days of approval.',
    },
    conditions: {
      maintenance: 'supplier',
      fuel: 'operating_org',
      insurance: 'supplier',
      accident: 'shared',
      tyres: 'supplier',
      breakdown: 'supplier',
      driver: 'operating_org',
      permit: 'supplier',
      fitnessPuc: 'supplier',
      vehicleReturn: 'Return with OEM charger, both keys and valid PUC.',
    },
    vehicles: [
      { vehicleId: vehicles[1].id, agreedRentalInr: 32000, maintenanceResponsibility: 'supplier', condition: 'Good', initialOdometerKm: vehicles[1].odometerKm, handoverDate: dateOffset(-90) },
      { vehicleId: vehicles[2].id, agreedRentalInr: 32000, maintenanceResponsibility: 'supplier', condition: 'Good', initialOdometerKm: vehicles[2].odometerKm, handoverDate: dateOffset(-90) },
    ],
  }, 'seed')

  const contractB = createContract(db, 'org-kaveri', 'Kaveri Owner', {
    name: 'Container truck — per-km agreement',
    category: 'per_km',
    supplierType: 'individual_owner',
    individualOwnerId: ownerA.id,
    agreementReference: 'KAV/IND/2025/003',
    agreementDate: dateOffset(-200),
    startDate: dateOffset(-195),
    expiryDate: dateOffset(18),
    durationMonths: 7,
    description: 'Container truck supplied by an individual owner. Driver is employed by the owner.',
    status: 'renewal_pending',
    financialTerms: {
      perKmRateInr: 34,
      monthlyRentalInr: 35000,
      securityDepositInr: 50000,
      paymentFrequency: 'monthly',
      paymentDueDay: 7,
      settlementConditions: 'Per-km run sheet reconciled monthly; minimum 4,000 km guaranteed.',
    },
    conditions: {
      maintenance: 'shared',
      fuel: 'operating_org',
      insurance: 'supplier',
      tyres: 'operating_org',
      driver: 'supplier',
      permit: 'supplier',
      fitnessPuc: 'supplier',
    },
    vehicles: [
      { vehicleId: vehicles[3].id, agreedRentalInr: 35000, maintenanceResponsibility: 'shared', condition: 'Fair', initialOdometerKm: vehicles[3].odometerKm, handoverDate: dateOffset(-195) },
    ],
  }, 'seed')

  createContract(db, 'org-kaveri', 'Kaveri Owner', {
    name: 'Heavy haulage — Western Star pilot',
    category: 'fixed_variable',
    supplierType: 'fleet_partner',
    fleetPartnerId: partnerB.id,
    agreementReference: 'WSL/KAV/2026/002',
    agreementDate: dateOffset(-12),
    startDate: dateOffset(5),
    expiryDate: dateOffset(370),
    durationMonths: 12,
    description: 'Pilot heavy haulage contract awaiting owner approval and vehicle handover.',
    status: 'pending_approval',
    financialTerms: {
      fixedRentalInr: 45000,
      monthlyRentalInr: 45000,
      perKmRateInr: 12,
      securityDepositInr: 75000,
      paymentFrequency: 'monthly',
      paymentDueDay: 10,
    },
    conditions: {
      maintenance: 'operating_org',
      fuel: 'operating_org',
      insurance: 'supplier',
      accident: 'shared',
      tyres: 'operating_org',
    },
    vehicles: [
      { vehicleId: vehicles[4].id, agreedRentalInr: 45000, maintenanceResponsibility: 'operating_org', condition: 'Good', initialOdometerKm: vehicles[4].odometerKm, handoverDate: dateOffset(5) },
    ],
  }, 'seed')

  // Ownership classification for the demo fleet.
  const setOwnership = db.prepare(`
    UPDATE vehicle_ownership SET ownership_type = ?, legal_owner_name = ?, fleet_partner_id = ?,
      individual_owner_id = ?, contract_id = ?, effective_from = ?, notes = ?
    WHERE organization_id = ? AND vehicle_id = ?
  `)
  syncOwnershipFromFleet(db, 'org-kaveri')
  const orgRow = db.prepare('SELECT name FROM organizations WHERE id = ?').get('org-kaveri') as { name: string } | undefined
  setOwnership.run('company_owned', orgRow?.name ?? 'Kaveri Logistics', null, null, null, dateOffset(-400), '', 'org-kaveri', vehicles[0].id)
  setOwnership.run('contracted_fleet', partnerA.companyName, partnerA.id, null, contractA.id, contractA.startDate, 'Leased EV cargo unit', 'org-kaveri', vehicles[1].id)
  setOwnership.run('contracted_fleet', partnerA.companyName, partnerA.id, null, contractA.id, contractA.startDate, 'Leased EV cargo unit', 'org-kaveri', vehicles[2].id)
  setOwnership.run('individual_owner', ownerA.fullName, null, ownerA.id, contractB.id, contractB.startDate, 'Individually supplied container truck', 'org-kaveri', vehicles[3].id)
  setOwnership.run('contracted_fleet', partnerB.companyName, partnerB.id, null, null, dateOffset(5), 'Pilot contract pending approval', 'org-kaveri', vehicles[4].id)

  // Deposit for contract A: required 1,00,000, paid 60,000.
  const depA = createDeposit(db, 'org-kaveri', contractA.id, {
    depositType: 'refundable_security',
    vehicleIds: contractA.vehicles.map((v) => v.vehicleId),
    requiredAmountInr: 100000,
    refundable: true,
    refundConditions: 'Refund after return inspection and deduction approval.',
    receivingParty: partnerA.companyName,
    documentReference: 'DEP/KAV/2025/014',
  }, 'seed')
  recordDepositPayment(db, 'org-kaveri', contractA.id, depA.id, {
    amountInr: 60000,
    paymentDate: dateOffset(-88),
    paymentReference: 'NEFT-884120',
    paymentMethod: 'NEFT',
  }, 'seed')
  const depB = createDeposit(db, 'org-kaveri', contractB.id, {
    depositType: 'refundable_security',
    vehicleIds: contractB.vehicles.map((v) => v.vehicleId),
    requiredAmountInr: 50000,
    refundable: true,
    refundConditions: 'Refund subject to return inspection.',
    receivingParty: ownerA.fullName,
    documentReference: 'DEP/KAV/2025/003',
  }, 'seed')
  recordDepositPayment(db, 'org-kaveri', contractB.id, depB.id, {
    amountInr: 50000,
    paymentDate: dateOffset(-190),
    paymentReference: 'UPI-772190',
    paymentMethod: 'UPI',
  }, 'seed')

  // Payments: two paid, one overdue for contract A; one pending for contract B.
  const p1 = createPayment(db, 'org-kaveri', contractA.id, {
    billingPeriod: '2026-08',
    dueDate: dateOffset(-75),
    amountInr: 64000,
    status: 'approved',
  }, 'seed')
  updatePaymentStatus(db, 'org-kaveri', contractA.id, p1.id, 'paid', 'seed', 64000, 'NEFT-900112')
  const p2 = createPayment(db, 'org-kaveri', contractA.id, {
    billingPeriod: '2026-09',
    dueDate: dateOffset(-45),
    amountInr: 64000,
    status: 'approved',
  }, 'seed')
  updatePaymentStatus(db, 'org-kaveri', contractA.id, p2.id, 'paid', 'seed', 64000, 'NEFT-900245')
  createPayment(db, 'org-kaveri', contractA.id, {
    billingPeriod: '2026-10',
    dueDate: dateOffset(-12),
    amountInr: 64000,
    status: 'approved',
  }, 'seed')
  createPayment(db, 'org-kaveri', contractB.id, {
    billingPeriod: '2026-11',
    dueDate: dateOffset(6),
    amountInr: 35000,
    status: 'pending_approval',
  }, 'seed')

  // Maintenance split: 18,000 total, 5,000 operating org / 13,000 supplier.
  const alloc = createMaintenanceAllocation(db, 'org-kaveri', contractA.id, {
    vehicleId: contractA.vehicles[0].vehicleId,
    category: 'Engine',
    description: 'Engine coolant pump replacement and pressure test',
    totalCostInr: 18000,
    operatingOrgShareInr: 5000,
    supplierShareInr: 13000,
    responsibility: 'shared',
  }, 'seed')
  approveMaintenanceAllocation(db, 'org-kaveri', contractA.id, alloc.id, 'Kaveri Owner', true)

  // Handover record.
  createHandover(db, 'org-kaveri', contractA.id, {
    vehicleId: contractA.vehicles[0].vehicleId,
    handoverType: 'handover',
    handoverAt: contractA.startDate,
    odometerKm: contractA.vehicles[0].initialOdometerKm,
    fuelLevelPct: 92,
    exteriorCondition: 'Good, minor scuff on rear bumper',
    interiorCondition: 'Clean',
    tyreCondition: '6 mm tread',
    existingDamages: 'Rear bumper scuff',
    accessories: 'Charger, fast-charge cable, toolbox',
    photoReferences: ['handover/veh-1-front.jpg', 'handover/veh-1-rear.jpg'],
    documentChecklist: ['RC copy', 'Insurance', 'Permit', 'Fitness'],
    supplierRepresentative: 'Nandini Rao',
    receivingRepresentative: 'Kaveri Owner',
    notes: 'Odometer and charger serial verified.',
  }, 'seed')

  // Amendment: 30,000 -> 35,000 monthly, approved and effective.
  const amendment = createAmendment(db, 'org-kaveri', contractB.id, {
    title: 'Monthly minimum revised to ₹35,000',
    reason: 'Fuel and driver cost revision requested by the individual owner.',
    revisedValues: { monthlyRentalInr: 35000, effectiveDate: dateOffset(-60) },
    effectiveDate: dateOffset(-60),
  }, 'Kaveri Owner')
  approveAmendment(db, 'org-kaveri', contractB.id, amendment.id, 'Kaveri Owner', true)

  addContractDocument(db, 'org-kaveri', contractA.id, {
    name: 'Lease agreement (signed)',
    category: 'Agreement',
    reference: 'DOC/KAV/2025/014',
  }, 'Kaveri Owner')
  addContractDocument(db, 'org-kaveri', contractA.id, {
    name: 'Vehicle RC and insurance pack',
    category: 'Vehicle documents',
    reference: 'DOC/KAV/2025/014-RC',
  }, 'Kaveri Owner')
}

function mapPartner(row: Record<string, unknown>): FleetPartner {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    companyName: String(row.company_name),
    registrationNumber: String(row.registration_number ?? ''),
    gstin: String(row.gstin ?? ''),
    contactPerson: String(row.contact_person ?? ''),
    mobile: String(row.mobile ?? ''),
    email: String(row.email ?? ''),
    registeredAddress: String(row.registered_address ?? ''),
    operatingLocation: String(row.operating_location ?? ''),
    bankAccountMasked: String(row.bank_account_masked ?? ''),
    bankIfsc: String(row.bank_ifsc ?? ''),
    status: row.status as FleetPartner['status'],
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
  }
}

function mapOwner(row: Record<string, unknown>): IndividualVehicleOwner {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    fullName: String(row.full_name),
    mobile: String(row.mobile ?? ''),
    email: String(row.email ?? ''),
    address: String(row.address ?? ''),
    identityVerificationStatus: row.identity_verification_status as IndividualVehicleOwner['identityVerificationStatus'],
    identityDocumentType: String(row.identity_document_type ?? ''),
    identityDocumentMasked: String(row.identity_document_masked ?? ''),
    bankAccountMasked: String(row.bank_account_masked ?? ''),
    bankIfsc: String(row.bank_ifsc ?? ''),
    paymentPreference: row.payment_preference as IndividualVehicleOwner['paymentPreference'],
    status: row.status as IndividualVehicleOwner['status'],
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
  }
}

function mapOwnership(row: Record<string, unknown>): VehicleOwnershipRecord {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    vehicleId: String(row.vehicle_id),
    vehicleRegistration: String(row.vehicle_registration),
    ownershipType: row.ownership_type as OwnershipType,
    legalOwnerName: String(row.legal_owner_name ?? ''),
    fleetPartnerId: row.fleet_partner_id ? String(row.fleet_partner_id) : null,
    individualOwnerId: row.individual_owner_id ? String(row.individual_owner_id) : null,
    contractId: row.contract_id ? String(row.contract_id) : null,
    effectiveFrom: String(row.effective_from),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
  }
}

function mapVehicleLink(row: Record<string, unknown>): ContractVehicleLink {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    vehicleId: String(row.vehicle_id),
    vehicleRegistration: String(row.vehicle_registration),
    ownershipType: row.ownership_type as OwnershipType,
    vehicleCategory: String(row.vehicle_category ?? ''),
    condition: String(row.condition ?? ''),
    initialOdometerKm: Number(row.initial_odometer_km ?? 0),
    handoverDate: String(row.handover_date),
    agreedRentalInr: paiseToRupees(row.agreed_rental_paise),
    maintenanceResponsibility: row.maintenance_responsibility as MaintenanceResponsibility,
    returnedAt: row.returned_at ? String(row.returned_at) : null,
  }
}

function mapContract(
  row: Record<string, unknown>,
  vehicles: ContractVehicleLink[],
): VehicleContract {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    contractNumber: String(row.contract_number),
    name: String(row.name),
    category: row.category as VehicleContract['category'],
    supplierType: row.supplier_type as VehicleContract['supplierType'],
    fleetPartnerId: row.fleet_partner_id ? String(row.fleet_partner_id) : null,
    individualOwnerId: row.individual_owner_id ? String(row.individual_owner_id) : null,
    supplierName: String(row.supplier_name),
    agreementReference: String(row.agreement_reference ?? ''),
    agreementDate: String(row.agreement_date),
    startDate: String(row.start_date),
    expiryDate: String(row.expiry_date),
    durationMonths: Number(row.duration_months ?? 0),
    currency: String(row.currency ?? 'INR'),
    description: String(row.description ?? ''),
    status: row.status as ContractStatus,
    currentVersion: Number(row.current_version ?? 1),
    financialTerms: { ...DEFAULT_TERMS, ...parseJson<Partial<ContractFinancialTerms>>(row.financial_terms_json, {}) },
    conditions: { ...DEFAULT_CONDITIONS, ...parseJson<Partial<ContractConditions>>(row.conditions_json, {}) },
    vehicles,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    createdBy: String(row.created_by),
  }
}

function mapDeposit(row: Record<string, unknown>): ContractDeposit {
  const required = Number(row.required_paise ?? 0)
  const paid = Number(row.paid_paise ?? 0)
  const deductions = Number(row.deductions_paise ?? 0)
  const refundable = Number(row.refundable ?? 1) === 1
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    depositType: row.deposit_type as DepositType,
    vehicleIds: parseJson<string[]>(row.vehicle_ids_json, []),
    requiredAmountInr: paiseToRupees(required),
    paidAmountInr: paiseToRupees(paid),
    outstandingAmountInr: paiseToRupees(Math.max(0, required - paid)),
    deductionsInr: paiseToRupees(deductions),
    refundableInr: refundable ? paiseToRupees(Math.max(0, paid - deductions)) : 0,
    paymentDate: row.payment_date ? String(row.payment_date) : null,
    paymentReference: String(row.payment_reference ?? ''),
    paymentMethod: String(row.payment_method ?? ''),
    receivingParty: String(row.receiving_party ?? ''),
    refundable,
    refundConditions: String(row.refund_conditions ?? ''),
    expiryDate: row.expiry_date ? String(row.expiry_date) : null,
    documentReference: String(row.document_reference ?? ''),
    status: row.status as DepositStatus,
    createdAt: String(row.created_at),
  }
}

function mapPayment(row: Record<string, unknown>): ContractPayment {
  const amountPaise = Number(row.amount_paise ?? 0)
  const paidPaise = Number(row.paid_paise ?? 0)
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    supplierName: String(row.supplier_name),
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : null,
    billingPeriod: String(row.billing_period),
    dueDate: String(row.due_date),
    amountInr: paiseToRupees(amountPaise),
    paidAmountInr: paiseToRupees(paidPaise),
    outstandingAmountInr: paiseToRupees(Math.max(0, amountPaise - paidPaise)),
    paymentMethod: String(row.payment_method ?? ''),
    paymentReference: String(row.payment_reference ?? ''),
    receiptReference: String(row.receipt_reference ?? ''),
    status: row.status as ContractPaymentStatus,
    recordedBy: String(row.recorded_by),
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapAmendment(row: Record<string, unknown>): ContractAmendment {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    amendmentNumber: String(row.amendment_number),
    title: String(row.title),
    reason: String(row.reason),
    previousValues: parseJson<Record<string, unknown>>(row.previous_values_json, {}),
    revisedValues: parseJson<Record<string, unknown>>(row.revised_values_json, {}),
    effectiveDate: String(row.effective_date),
    status: row.status as ContractAmendment['status'],
    createdBy: String(row.created_by),
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    createdAt: String(row.created_at),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
  }
}

function mapMaintenance(row: Record<string, unknown>): ContractMaintenanceAllocation {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    vehicleId: String(row.vehicle_id),
    vehicleRegistration: String(row.vehicle_registration),
    workOrderId: row.work_order_id ? String(row.work_order_id) : null,
    category: String(row.category),
    description: String(row.description),
    totalCostInr: paiseToRupees(row.total_paise),
    operatingOrgShareInr: paiseToRupees(row.operating_org_paise),
    supplierShareInr: paiseToRupees(row.supplier_paise),
    responsibility: row.responsibility as MaintenanceResponsibility,
    approvalStatus: row.approval_status as ContractMaintenanceAllocation['approvalStatus'],
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    settlementStatus: row.settlement_status as ContractMaintenanceAllocation['settlementStatus'],
    createdAt: String(row.created_at),
  }
}

function mapHandover(row: Record<string, unknown>): VehicleHandover {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    vehicleId: String(row.vehicle_id),
    vehicleRegistration: String(row.vehicle_registration),
    handoverType: row.handover_type as VehicleHandover['handoverType'],
    handoverAt: String(row.handover_at),
    odometerKm: Number(row.odometer_km ?? 0),
    fuelLevelPct: Number(row.fuel_level_pct ?? 0),
    exteriorCondition: String(row.exterior_condition ?? ''),
    interiorCondition: String(row.interior_condition ?? ''),
    tyreCondition: String(row.tyre_condition ?? ''),
    existingDamages: String(row.existing_damages ?? ''),
    accessories: String(row.accessories ?? ''),
    photoReferences: parseJson<string[]>(row.photo_references_json, []),
    documentChecklist: parseJson<string[]>(row.document_checklist_json, []),
    supplierRepresentative: String(row.supplier_representative ?? ''),
    receivingRepresentative: String(row.receiving_representative ?? ''),
    notes: String(row.notes ?? ''),
    createdAt: String(row.created_at),
  }
}

export function getContractWorkspace(db: DatabaseSync, orgId: string): ContractWorkspace {
  syncOwnershipFromFleet(db, orgId)
  const contractRows = db
    .prepare('SELECT * FROM vehicle_contracts WHERE organization_id = ? ORDER BY created_at DESC')
    .all(orgId) as Array<Record<string, unknown>>
  const vehicleRows = db
    .prepare('SELECT * FROM vehicle_contract_vehicles WHERE organization_id = ?')
    .all(orgId) as Array<Record<string, unknown>>
  const vehiclesByContract = new Map<string, ContractVehicleLink[]>()
  for (const row of vehicleRows) {
    const link = mapVehicleLink(row)
    const list = vehiclesByContract.get(link.contractId) ?? []
    list.push(link)
    vehiclesByContract.set(link.contractId, list)
  }
  const contracts = contractRows.map((row) => mapContract(row, vehiclesByContract.get(String(row.id)) ?? []))
  const deposits = (db.prepare('SELECT * FROM contract_deposits WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map(mapDeposit)
  const payments = (db.prepare('SELECT * FROM contract_payments WHERE organization_id = ? ORDER BY due_date DESC').all(orgId) as Array<Record<string, unknown>>).map(mapPayment)
  const amendments = (db.prepare('SELECT * FROM contract_amendments WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map(mapAmendment)
  const maintenance = (db.prepare('SELECT * FROM contract_maintenance_allocations WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map(mapMaintenance)
  const handovers = (db.prepare('SELECT * FROM vehicle_handovers WHERE organization_id = ? ORDER BY handover_at DESC').all(orgId) as Array<Record<string, unknown>>).map(mapHandover)
  const documents = db.prepare('SELECT * FROM contract_documents WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>
  const activity = db.prepare('SELECT * FROM contract_activity_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 300').all(orgId) as Array<Record<string, unknown>>
  const ownership = (db.prepare('SELECT * FROM vehicle_ownership WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map(mapOwnership)

  return {
    contracts,
    partners: (db.prepare('SELECT * FROM fleet_partners WHERE organization_id = ? ORDER BY company_name').all(orgId) as Array<Record<string, unknown>>).map(mapPartner),
    owners: (db.prepare('SELECT * FROM individual_vehicle_owners WHERE organization_id = ? ORDER BY full_name').all(orgId) as Array<Record<string, unknown>>).map(mapOwner),
    deposits,
    payments,
    amendments,
    maintenance,
    handovers,
    documents: documents.map((row) => ({
      id: String(row.id),
      contractId: String(row.contract_id),
      name: String(row.name),
      category: String(row.category ?? ''),
      reference: String(row.reference ?? ''),
      uploadedBy: String(row.uploaded_by),
      createdAt: String(row.created_at),
    })),
    activity: activity.map((row) => ({
      id: String(row.id),
      contractId: String(row.contract_id),
      action: String(row.action),
      summary: String(row.summary),
      actor: String(row.actor),
      createdAt: String(row.created_at),
    })),
    ownership,
  }
}

export function getContractOverview(db: DatabaseSync, orgId: string): ContractOverview {
  const workspace = getContractWorkspace(db, orgId)
  const activeContracts = workspace.contracts.filter((c) => c.status === 'active' || c.status === 'renewal_pending')
  const activeIds = new Set(activeContracts.map((c) => c.id))
  const contractedVehicles = workspace.contracts
    .filter((c) => c.supplierType === 'fleet_partner' && c.status !== 'closed' && c.status !== 'terminated')
    .flatMap((c) => c.vehicles).length
  const individualVehicles = workspace.contracts
    .filter((c) => c.supplierType === 'individual_owner' && c.status !== 'closed' && c.status !== 'terminated')
    .flatMap((c) => c.vehicles).length
  const in30 = dateOffset(30)
  const expiring = workspace.contracts.filter(
    (c) => c.status !== 'closed' && c.status !== 'terminated' && c.expiryDate <= in30 && c.expiryDate >= dateOffset(0),
  ).length
  const outstandingPayments = workspace.payments
    .filter((p) => !['paid', 'cancelled', 'reconciled'].includes(p.status))
    .reduce((sum, p) => sum + p.outstandingAmountInr, 0)
  const totalDeposits = workspace.deposits.reduce((sum, d) => sum + d.requiredAmountInr, 0)
  const outstandingDeposits = workspace.deposits.reduce((sum, d) => sum + d.outstandingAmountInr, 0)
  const pendingMaintenance = workspace.maintenance
    .filter((m) => m.approvalStatus === 'approved' && m.settlementStatus === 'unsettled')
    .reduce((sum, m) => sum + m.supplierShareInr, 0)

  const ownershipCounts = new Map<OwnershipType, number>()
  for (const record of workspace.ownership) {
    ownershipCounts.set(record.ownershipType, (ownershipCounts.get(record.ownershipType) ?? 0) + 1)
  }
  const bySupplier = new Map<string, number>()
  for (const c of workspace.contracts) {
    if (c.status === 'closed' || c.status === 'terminated') continue
    bySupplier.set(c.supplierName, (bySupplier.get(c.supplierName) ?? 0) + c.vehicles.length)
  }

  const monthlyExpenditure: Array<{ month: string; rentalInr: number; maintenanceInr: number }> = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - i)
    const month = d.toISOString().slice(0, 7)
    const rental = workspace.payments
      .filter((p) => p.billingPeriod === month)
      .reduce((sum, p) => sum + p.amountInr, 0)
    const maint = workspace.maintenance
      .filter((m) => m.createdAt.slice(0, 7) === month)
      .reduce((sum, m) => sum + m.operatingOrgShareInr, 0)
    monthlyExpenditure.push({ month, rentalInr: rental, maintenanceInr: maint })
  }

  const expiryTimeline = [
    { bucket: '0-30 days', count: 0 },
    { bucket: '31-60 days', count: 0 },
    { bucket: '61-90 days', count: 0 },
    { bucket: '90+ days', count: 0 },
  ]
  for (const c of workspace.contracts) {
    if (c.status === 'closed' || c.status === 'terminated') continue
    const days = Math.ceil((new Date(c.expiryDate).getTime() - Date.now()) / 86400000)
    if (days < 0) expiryTimeline[0].count += 1
    else if (days <= 30) expiryTimeline[0].count += 1
    else if (days <= 60) expiryTimeline[1].count += 1
    else if (days <= 90) expiryTimeline[2].count += 1
    else expiryTimeline[3].count += 1
  }

  const depositMap = new Map<DepositType, number>()
  for (const d of workspace.deposits) depositMap.set(d.depositType, (depositMap.get(d.depositType) ?? 0) + d.requiredAmountInr)

  const maintenanceByParty = [
    { party: 'Operating organization', amountInr: workspace.maintenance.reduce((s, m) => s + m.operatingOrgShareInr, 0) },
    { party: 'Supplier', amountInr: workspace.maintenance.reduce((s, m) => s + m.supplierShareInr, 0) },
  ]

  const utilization = Array.from(bySupplier.entries()).map(([supplier, contracted]) => {
    const active = workspace.contracts
      .filter((c) => c.supplierName === supplier && activeIds.has(c.id))
      .flatMap((c) => c.vehicles).length
    return { supplier, contracted, active, utilizationPct: contracted ? Math.round((active / contracted) * 100) : 0 }
  })

  return {
    kpis: {
      activeContracts: activeContracts.length,
      contractedVehicles,
      individualOwnerVehicles: individualVehicles,
      fleetPartners: workspace.partners.length,
      expiringWithin30Days: expiring,
      pendingApprovals: workspace.contracts.filter((c) => c.status === 'pending_approval').length,
      pendingHandovers: workspace.contracts.filter((c) => c.status === 'awaiting_handover').length,
      outstandingPaymentsInr: outstandingPayments,
      totalSecurityDepositsInr: totalDeposits,
      outstandingDepositsInr: outstandingDeposits,
      pendingMaintenanceSettlementsInr: pendingMaintenance,
      vehiclesAwaitingReturn: workspace.contracts
        .filter((c) => c.status === 'vehicle_return_pending')
        .flatMap((c) => c.vehicles).length,
    },
    ownershipDistribution: (['company_owned', 'contracted_fleet', 'individual_owner'] as OwnershipType[])
      .map((ownershipType) => ({ ownershipType, count: ownershipCounts.get(ownershipType) ?? 0 })),
    contractedBySupplier: Array.from(bySupplier.entries()).map(([supplier, count]) => ({ supplier, count })),
    monthlyExpenditure,
    expiryTimeline,
    depositDistribution: Array.from(depositMap.entries()).map(([depositType, amountInr]) => ({ depositType, amountInr })),
    maintenanceByParty,
    utilization,
  }
}

function assertContract(db: DatabaseSync, orgId: string, contractId: string): Record<string, unknown> {
  const row = db
    .prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?')
    .get(contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Contract not found in this organization.')
  return row
}

export function createContract(
  db: DatabaseSync,
  orgId: string,
  actor: string,
  input: CreateContractInput,
  actorId = 'system',
): VehicleContract {
  if (!input.name?.trim()) throw new Error('Contract name is required.')
  if (!input.startDate || !input.expiryDate) throw new Error('Start and expiry dates are required.')
  if (input.expiryDate < input.startDate) throw new Error('Expiry date must be after the start date.')
  if (!Array.isArray(input.vehicles) || input.vehicles.length === 0) throw new Error('Select at least one vehicle.')
  const vehicleIds = input.vehicles.map((v) => v.vehicleId)
  if (new Set(vehicleIds).size !== vehicleIds.length) throw new Error('Duplicate vehicles are not allowed in one contract.')

  let supplierName = ''
  let ownershipType: OwnershipType = 'contracted_fleet'
  if (input.supplierType === 'fleet_partner') {
    if (!input.fleetPartnerId) throw new Error('Select a fleet partner.')
    const partner = db.prepare('SELECT * FROM fleet_partners WHERE id = ? AND organization_id = ?')
      .get(input.fleetPartnerId, orgId) as Record<string, unknown> | undefined
    if (!partner) throw new Error('Fleet partner not found.')
    supplierName = String(partner.company_name)
  } else {
    if (!input.individualOwnerId) throw new Error('Select an individual vehicle owner.')
    const owner = db.prepare('SELECT * FROM individual_vehicle_owners WHERE id = ? AND organization_id = ?')
      .get(input.individualOwnerId, orgId) as Record<string, unknown> | undefined
    if (!owner) throw new Error('Individual owner not found.')
    supplierName = String(owner.full_name)
    ownershipType = 'individual_owner'
  }

  const fleetVehicles = new Map(readOrgVehicles(db, orgId).map((v) => [v.id, v]))
  for (const link of input.vehicles) {
    if (!fleetVehicles.has(link.vehicleId)) throw new Error('Selected vehicle is not part of this organization fleet.')
    const overlap = db.prepare(`
      SELECT c.contract_number FROM vehicle_contract_vehicles cv
      JOIN vehicle_contracts c ON c.id = cv.contract_id
      WHERE cv.organization_id = ? AND cv.vehicle_id = ? AND cv.returned_at IS NULL
        AND c.status NOT IN ('closed','terminated','expired','draft','rejected')
        AND c.id <> ?
    `).get(orgId, link.vehicleId, '') as { contract_number: string } | undefined
    if (overlap) {
      throw new Error(`Vehicle already has an active operating contract (${overlap.contract_number}). Explicit authorization is required.`)
    }
  }

  const count = (db.prepare('SELECT COUNT(*) AS count FROM vehicle_contracts WHERE organization_id = ?').get(orgId) as { count: number }).count
  const year = new Date().getUTCFullYear()
  const contractNumber = `VC-${year}-${String(count + 1).padStart(4, '0')}`
  const id = newId('vc')
  const stamp = nowIso()
  const terms: ContractFinancialTerms = { ...DEFAULT_TERMS, ...input.financialTerms }
  const conditions: ContractConditions = { ...DEFAULT_CONDITIONS, ...input.conditions }

  db.prepare(`
    INSERT INTO vehicle_contracts (id, organization_id, contract_number, name, category, supplier_type,
      fleet_partner_id, individual_owner_id, supplier_name, agreement_reference, agreement_date,
      start_date, expiry_date, duration_months, currency, description, status, current_version,
      financial_terms_json, conditions_json, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, 1, ?, ?, ?, ?, ?)
  `).run(id, orgId, contractNumber, input.name.trim(), input.category, input.supplierType,
    input.fleetPartnerId ?? null, input.individualOwnerId ?? null, supplierName,
    input.agreementReference ?? '', input.agreementDate ?? input.startDate, input.startDate,
    input.expiryDate, input.durationMonths ?? 12, input.description ?? '',
    input.status ?? 'draft', JSON.stringify(terms), JSON.stringify(conditions), actor, stamp, stamp)

  const insertLink = db.prepare(`
    INSERT INTO vehicle_contract_vehicles (id, organization_id, contract_id, vehicle_id, vehicle_registration,
      ownership_type, vehicle_category, condition, initial_odometer_km, handover_date, agreed_rental_paise,
      maintenance_responsibility, returned_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
  `)
  for (const link of input.vehicles) {
    const vehicle = fleetVehicles.get(link.vehicleId)!
    insertLink.run(newId('cv'), orgId, id, vehicle.id, vehicle.registrationNumber, ownershipType,
      vehicle.category, link.condition ?? 'Good', link.initialOdometerKm ?? vehicle.odometerKm,
      link.handoverDate ?? input.startDate, rupeesToPaise(link.agreedRentalInr ?? 0),
      link.maintenanceResponsibility ?? conditions.maintenance, stamp)

    db.prepare(`
      UPDATE vehicle_ownership SET ownership_type = ?, legal_owner_name = ?, fleet_partner_id = ?,
        individual_owner_id = ?, contract_id = ?, effective_from = ?, notes = ?
      WHERE organization_id = ? AND vehicle_id = ?
    `).run(ownershipType, supplierName, input.fleetPartnerId ?? null, input.individualOwnerId ?? null,
      id, input.startDate, `Contract ${contractNumber}`, orgId, vehicle.id)
  }

  logActivity(db, orgId, id, 'CONTRACT_CREATED', `Contract ${contractNumber} created for ${supplierName}.`, actor)
  const row = assertContract(db, orgId, id)
  const links = db.prepare('SELECT * FROM vehicle_contract_vehicles WHERE contract_id = ?').all(id) as Array<Record<string, unknown>>
  void actorId
  return mapContract(row, links.map(mapVehicleLink))
}

const CONTRACT_STATUS_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_approval', 'awaiting_handover'],
  pending_approval: ['draft', 'awaiting_handover', 'active'],
  awaiting_handover: ['active', 'pending_approval'],
  active: ['temporarily_suspended', 'renewal_pending', 'termination_requested', 'expired', 'vehicle_return_pending'],
  temporarily_suspended: ['active', 'termination_requested'],
  renewal_pending: ['active', 'expired', 'termination_requested'],
  expired: ['renewal_pending', 'closed'],
  termination_requested: ['active', 'terminated'],
  terminated: ['vehicle_return_pending', 'closed'],
  vehicle_return_pending: ['closed'],
  closed: [],
}

export function updateContractStatus(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  status: ContractStatus,
  actor: string,
  options: { allowUnresolved?: boolean } = {},
): VehicleContract {
  const current = assertContract(db, orgId, contractId)
  const valid: ContractStatus[] = ['draft', 'pending_approval', 'awaiting_handover', 'active', 'temporarily_suspended', 'renewal_pending', 'expired', 'termination_requested', 'terminated', 'vehicle_return_pending', 'closed']
  if (!valid.includes(status)) throw new Error('Invalid contract status.')
  const from = String(current.status) as ContractStatus
  if (from === status) throw new Error(`Contract is already marked ${status.replace(/_/g, ' ')}.`)
  const allowed = CONTRACT_STATUS_TRANSITIONS[from] ?? []
  if (!allowed.includes(status)) {
    throw new Error(`Cannot move a contract from ${from.replace(/_/g, ' ')} to ${status.replace(/_/g, ' ')}.`)
  }
  if (status === 'closed') {
    const deposit = db.prepare(`SELECT COUNT(*) AS count FROM contract_deposits WHERE contract_id = ? AND paid_paise > deductions_paise AND refundable = 1`).get(contractId) as { count: number }
    const payment = db.prepare(`SELECT COUNT(*) AS count FROM contract_payments WHERE contract_id = ? AND status NOT IN ('paid','cancelled','reconciled')`).get(contractId) as { count: number }
    const handover = db.prepare(`SELECT COUNT(*) AS count FROM vehicle_contract_vehicles WHERE contract_id = ? AND returned_at IS NULL`).get(contractId) as { count: number }
    if ((deposit.count > 0 || payment.count > 0 || handover.count > 0) && !options.allowUnresolved) {
      throw new Error('Contract cannot close with unresolved deposits, payments or vehicle returns. Approve documented exceptions first.')
    }
  }
  const stamp = nowIso()
  db.prepare('UPDATE vehicle_contracts SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?')
    .run(status, stamp, contractId, orgId)
  logActivity(db, orgId, contractId, 'STATUS_CHANGED', `Contract status changed to ${status.replace(/_/g, ' ')}.`, actor)
  const row = assertContract(db, orgId, contractId)
  const links = db.prepare('SELECT * FROM vehicle_contract_vehicles WHERE contract_id = ?').all(contractId) as Array<Record<string, unknown>>
  return mapContract(row, links.map(mapVehicleLink))
}

export function createAmendment(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  input: CreateAmendmentInput,
  actor: string,
): ContractAmendment {
  const contract = assertContract(db, orgId, contractId)
  if (!input.title?.trim() || !input.reason?.trim()) throw new Error('Amendment title and reason are required.')
  if (!input.effectiveDate) throw new Error('Effective date is required.')
  const count = (db.prepare('SELECT COUNT(*) AS count FROM contract_amendments WHERE contract_id = ?').get(contractId) as { count: number }).count
  const id = newId('amd')
  const stamp = nowIso()
  const currentTerms = parseJson<Record<string, unknown>>(contract.financial_terms_json, {})
  const previousValues = {
    monthlyRentalInr: currentTerms.monthlyRentalInr ?? 0,
    financialTerms: currentTerms,
    conditions: parseJson<Record<string, unknown>>(contract.conditions_json, {}),
    expiryDate: contract.expiry_date,
    currentVersion: Number(contract.current_version ?? 1),
  }
  db.prepare(`
    INSERT INTO contract_amendments (id, organization_id, contract_id, amendment_number, title, reason,
      previous_values_json, revised_values_json, effective_date, status, created_by, approved_by,
      created_at, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, ?, NULL)
  `).run(id, orgId, contractId, `AMD-${String(count + 1).padStart(3, '0')}`, input.title.trim(),
    input.reason.trim(), JSON.stringify(previousValues), JSON.stringify(input.revisedValues),
    input.effectiveDate, actor, stamp)
  logActivity(db, orgId, contractId, 'AMENDMENT_CREATED', `${input.title.trim()} submitted as draft.`, actor)
  return mapAmendment(db.prepare('SELECT * FROM contract_amendments WHERE id = ?').get(id) as Record<string, unknown>)
}

export function submitAmendment(db: DatabaseSync, orgId: string, contractId: string, amendmentId: string, actor: string): ContractAmendment {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_amendments WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(amendmentId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Amendment not found.')
  if (row.status !== 'draft') throw new Error('Only draft amendments can be submitted.')
  db.prepare("UPDATE contract_amendments SET status = 'submitted' WHERE id = ?").run(amendmentId)
  logActivity(db, orgId, contractId, 'AMENDMENT_SUBMITTED', `${String(row.amendment_number)} submitted for approval.`, actor)
  return mapAmendment(db.prepare('SELECT * FROM contract_amendments WHERE id = ?').get(amendmentId) as Record<string, unknown>)
}

export function approveAmendment(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  amendmentId: string,
  actor: string,
  approve: boolean,
): ContractAmendment {
  const contract = assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_amendments WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(amendmentId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Amendment not found.')
  if (!['submitted', 'draft'].includes(String(row.status))) throw new Error('Amendment is not awaiting approval.')
  const stamp = nowIso()
  if (!approve) {
    db.prepare("UPDATE contract_amendments SET status = 'rejected', approved_by = ?, approved_at = ? WHERE id = ?")
      .run(actor, stamp, amendmentId)
    logActivity(db, orgId, contractId, 'AMENDMENT_REJECTED', `${String(row.amendment_number)} rejected.`, actor)
  } else {
    const revised = parseJson<Record<string, unknown>>(row.revised_values_json, {})
    const terms = parseJson<Record<string, unknown>>(contract.financial_terms_json, {})
    const conditions = parseJson<Record<string, unknown>>(contract.conditions_json, {})
    for (const [key, value] of Object.entries(revised)) {
      if (key in terms) terms[key] = value
      else if (key in conditions) conditions[key] = value
    }
    const expiry = typeof revised.expiryDate === 'string' ? revised.expiryDate : String(contract.expiry_date)
    const version = Number(contract.current_version ?? 1) + 1
    db.prepare(`
      UPDATE vehicle_contracts SET financial_terms_json = ?, conditions_json = ?, expiry_date = ?,
        current_version = ?, updated_at = ? WHERE id = ? AND organization_id = ?
    `).run(JSON.stringify(terms), JSON.stringify(conditions), expiry, version, stamp, contractId, orgId)
    db.prepare("UPDATE contract_amendments SET status = 'effective', approved_by = ?, approved_at = ? WHERE id = ?")
      .run(actor, stamp, amendmentId)
    logActivity(db, orgId, contractId, 'AMENDMENT_APPROVED', `${String(row.amendment_number)} approved; contract version ${version} effective ${String(row.effective_date)}.`, actor)
  }
  return mapAmendment(db.prepare('SELECT * FROM contract_amendments WHERE id = ?').get(amendmentId) as Record<string, unknown>)
}

export function createDeposit(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  input: {
    depositType: DepositType
    vehicleIds?: string[]
    requiredAmountInr: number
    refundable?: boolean
    refundConditions?: string
    receivingParty?: string
    documentReference?: string
    expiryDate?: string
  },
  actor: string,
): ContractDeposit {
  const contract = assertContract(db, orgId, contractId)
  if (!Number.isFinite(Number(input.requiredAmountInr)) || Number(input.requiredAmountInr) < 0) throw new Error('Valid deposit amount is required.')
  const linkedVehicles = db.prepare('SELECT vehicle_id FROM vehicle_contract_vehicles WHERE contract_id = ?')
    .all(contractId) as Array<{ vehicle_id: string }>
  const id = newId('dep')
  db.prepare(`
    INSERT INTO contract_deposits (id, organization_id, contract_id, deposit_type, vehicle_ids_json,
      required_paise, paid_paise, deductions_paise, refundable, payment_date, payment_reference,
      payment_method, receiving_party, refund_conditions, expiry_date, document_reference, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, '', '', ?, ?, ?, ?, 'defined', ?)
  `).run(id, orgId, contractId, input.depositType, JSON.stringify(input.vehicleIds ?? linkedVehicles.map((v) => v.vehicle_id)),
    rupeesToPaise(input.requiredAmountInr), input.refundable === false ? 0 : 1,
    input.receivingParty ?? String(contract.supplier_name), input.refundConditions ?? '',
    input.expiryDate ?? null, input.documentReference ?? '', nowIso())
  logActivity(db, orgId, contractId, 'DEPOSIT_DEFINED', `Deposit of ₹${Number(input.requiredAmountInr).toLocaleString('en-IN')} defined.`, actor)
  return mapDeposit(db.prepare('SELECT * FROM contract_deposits WHERE id = ?').get(id) as Record<string, unknown>)
}

export function recordDepositPayment(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  depositId: string,
  input: { amountInr: number; paymentDate?: string; paymentReference?: string; paymentMethod?: string },
  actor: string,
): ContractDeposit {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_deposits WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(depositId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Deposit not found.')
  const amount = rupeesToPaise(input.amountInr)
  if (amount <= 0) throw new Error('Deposit payment must be greater than zero.')
  const required = Number(row.required_paise)
  const paid = Math.min(required, Number(row.paid_paise) + amount)
  const status: DepositStatus = paid >= required ? 'active' : 'payment_recorded'
  db.prepare(`
    UPDATE contract_deposits SET paid_paise = ?, status = ?, payment_date = ?, payment_reference = ?,
      payment_method = ? WHERE id = ?
  `).run(paid, status, input.paymentDate ?? nowIso().slice(0, 10), input.paymentReference ?? '',
    input.paymentMethod ?? 'Bank transfer', depositId)
  logActivity(db, orgId, contractId, 'DEPOSIT_PAYMENT', `Deposit payment of ₹${Number(input.amountInr).toLocaleString('en-IN')} recorded.`, actor)
  return mapDeposit(db.prepare('SELECT * FROM contract_deposits WHERE id = ?').get(depositId) as Record<string, unknown>)
}

export function recordDepositDeduction(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  depositId: string,
  input: { amountInr: number; reason: string; evidence?: string },
  actor: string,
): ContractDeposit {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_deposits WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(depositId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Deposit not found.')
  if (!input.reason?.trim()) throw new Error('A deduction reason is required.')
  const amount = rupeesToPaise(input.amountInr)
  if (amount <= 0) throw new Error('Deduction must be greater than zero.')
  const max = Number(row.paid_paise) - Number(row.deductions_paise)
  if (amount > max) throw new Error('Deduction exceeds the refundable deposit balance.')
  db.prepare("UPDATE contract_deposits SET deductions_paise = deductions_paise + ?, status = 'deduction_pending' WHERE id = ?")
    .run(amount, depositId)
  logActivity(db, orgId, contractId, 'DEPOSIT_DEDUCTION', `Deduction of ₹${Number(input.amountInr).toLocaleString('en-IN')} recorded: ${input.reason.trim()}. Evidence: ${input.evidence ?? 'not provided'}.`, actor)
  return mapDeposit(db.prepare('SELECT * FROM contract_deposits WHERE id = ?').get(depositId) as Record<string, unknown>)
}

export function approveDepositRefund(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  depositId: string,
  actor: string,
): ContractDeposit {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_deposits WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(depositId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Deposit not found.')
  if (Number(row.refundable) !== 1) throw new Error('This deposit is non-refundable.')
  if (Number(row.paid_paise) - Number(row.deductions_paise) <= 0) throw new Error('No refundable balance remains.')
  db.prepare("UPDATE contract_deposits SET status = 'refunded' WHERE id = ?").run(depositId)
  logActivity(db, orgId, contractId, 'DEPOSIT_REFUND_APPROVED', `Refund of ₹${paiseToRupees(Number(row.paid_paise) - Number(row.deductions_paise)).toLocaleString('en-IN')} approved.`, actor)
  return mapDeposit(db.prepare('SELECT * FROM contract_deposits WHERE id = ?').get(depositId) as Record<string, unknown>)
}

export function createPayment(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  input: { billingPeriod: string; dueDate: string; amountInr: number; status?: ContractPaymentStatus; vehicleId?: string; paymentMethod?: string; paymentReference?: string },
  actor: string,
): ContractPayment {
  const contract = assertContract(db, orgId, contractId)
  if (!input.billingPeriod || !input.dueDate) throw new Error('Billing period and due date are required.')
  if (!Number.isFinite(Number(input.amountInr)) || Number(input.amountInr) <= 0) throw new Error('Payment amount must be greater than zero.')
  const id = newId('cpay')
  const stamp = nowIso()
  db.prepare(`
    INSERT INTO contract_payments (id, organization_id, contract_id, supplier_name, vehicle_id,
      billing_period, due_date, amount_paise, paid_paise, payment_method, payment_reference,
      receipt_reference, status, recorded_by, approved_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, '', ?, ?, NULL, ?, ?)
  `).run(id, orgId, contractId, String(contract.supplier_name), input.vehicleId ?? null,
    input.billingPeriod, input.dueDate, rupeesToPaise(input.amountInr), input.paymentMethod ?? '',
    input.paymentReference ?? '', input.status ?? 'draft', actor, stamp, stamp)
  logActivity(db, orgId, contractId, 'PAYMENT_CREATED', `Payment of ₹${Number(input.amountInr).toLocaleString('en-IN')} for ${input.billingPeriod} created.`, actor)
  return mapPayment(db.prepare('SELECT * FROM contract_payments WHERE id = ?').get(id) as Record<string, unknown>)
}

export function updatePaymentStatus(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  paymentId: string,
  status: ContractPaymentStatus,
  actor: string,
  paidAmountInr?: number,
  paymentReference?: string,
): ContractPayment {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_payments WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(paymentId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Payment not found.')
  if (status === 'paid') {
    const paid = rupeesToPaise(paidAmountInr ?? paiseToRupees(row.amount_paise))
    if (paid <= 0) throw new Error('Paid amount must be greater than zero.')
    const amount = Number(row.amount_paise)
    const finalStatus: ContractPaymentStatus = paid >= amount ? 'paid' : 'partially_paid'
    db.prepare(`UPDATE contract_payments SET paid_paise = ?, status = ?, payment_reference = ?, approved_by = ?, updated_at = ? WHERE id = ?`)
      .run(Math.min(paid, amount), finalStatus, paymentReference ?? String(row.payment_reference ?? ''), actor, nowIso(), paymentId)
    logActivity(db, orgId, contractId, 'PAYMENT_RECORDED', `Payment of ₹${paiseToRupees(Math.min(paid, amount)).toLocaleString('en-IN')} recorded (${finalStatus.replace(/_/g, ' ')}).`, actor)
  } else {
    const allowed: ContractPaymentStatus[] = ['draft', 'pending_approval', 'approved', 'overdue', 'disputed', 'cancelled', 'reconciled']
    if (!allowed.includes(status)) throw new Error('Invalid payment status.')
    db.prepare('UPDATE contract_payments SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), paymentId)
    logActivity(db, orgId, contractId, 'PAYMENT_STATUS', `Payment status set to ${status.replace(/_/g, ' ')}.`, actor)
  }
  return mapPayment(db.prepare('SELECT * FROM contract_payments WHERE id = ?').get(paymentId) as Record<string, unknown>)
}

export function createMaintenanceAllocation(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  input: {
    vehicleId: string
    workOrderId?: string
    category: string
    description: string
    totalCostInr: number
    operatingOrgShareInr: number
    supplierShareInr: number
    responsibility?: MaintenanceResponsibility
  },
  actor: string,
): ContractMaintenanceAllocation {
  assertContract(db, orgId, contractId)
  const vehicle = db.prepare('SELECT * FROM vehicle_contract_vehicles WHERE contract_id = ? AND vehicle_id = ? AND organization_id = ?')
    .get(contractId, input.vehicleId, orgId) as Record<string, unknown> | undefined
  if (!vehicle) throw new Error('Vehicle is not linked to this contract.')
  const total = rupeesToPaise(input.totalCostInr)
  const orgShare = rupeesToPaise(input.operatingOrgShareInr)
  const supplierShare = rupeesToPaise(input.supplierShareInr)
  if (total <= 0) throw new Error('Maintenance cost must be greater than zero.')
  if (orgShare + supplierShare !== total) throw new Error('Cost allocation must add up to the total maintenance cost.')
  const id = newId('cmnt')
  db.prepare(`
    INSERT INTO contract_maintenance_allocations (id, organization_id, contract_id, vehicle_id,
      vehicle_registration, work_order_id, category, description, total_paise, operating_org_paise,
      supplier_paise, responsibility, approval_status, approved_by, settlement_status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, 'unsettled', ?)
  `).run(id, orgId, contractId, input.vehicleId, String(vehicle.vehicle_registration),
    input.workOrderId ?? null, input.category, input.description, total, orgShare, supplierShare,
    input.responsibility ?? 'shared', nowIso())
  logActivity(db, orgId, contractId, 'MAINTENANCE_ALLOCATED', `₹${Number(input.totalCostInr).toLocaleString('en-IN')} maintenance allocated: operating org ₹${Number(input.operatingOrgShareInr).toLocaleString('en-IN')}, supplier ₹${Number(input.supplierShareInr).toLocaleString('en-IN')}.`, actor)
  return mapMaintenance(db.prepare('SELECT * FROM contract_maintenance_allocations WHERE id = ?').get(id) as Record<string, unknown>)
}

export function approveMaintenanceAllocation(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  allocationId: string,
  actor: string,
  approve: boolean,
): ContractMaintenanceAllocation {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_maintenance_allocations WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(allocationId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Maintenance allocation not found.')
  if (row.approval_status !== 'pending') throw new Error('Allocation is not awaiting approval.')
  db.prepare('UPDATE contract_maintenance_allocations SET approval_status = ?, approved_by = ? WHERE id = ?')
    .run(approve ? 'approved' : 'rejected', actor, allocationId)
  logActivity(db, orgId, contractId, approve ? 'MAINTENANCE_APPROVED' : 'MAINTENANCE_REJECTED', `Maintenance allocation ${approve ? 'approved' : 'rejected'}.`, actor)
  return mapMaintenance(db.prepare('SELECT * FROM contract_maintenance_allocations WHERE id = ?').get(allocationId) as Record<string, unknown>)
}

export function settleMaintenanceAllocation(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  allocationId: string,
  actor: string,
): ContractMaintenanceAllocation {
  assertContract(db, orgId, contractId)
  const row = db.prepare('SELECT * FROM contract_maintenance_allocations WHERE id = ? AND contract_id = ? AND organization_id = ?')
    .get(allocationId, contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Maintenance allocation not found.')
  if (row.approval_status !== 'approved') throw new Error('Approve the allocation before settlement.')
  db.prepare("UPDATE contract_maintenance_allocations SET settlement_status = 'settled' WHERE id = ?").run(allocationId)
  logActivity(db, orgId, contractId, 'MAINTENANCE_SETTLED', `Supplier share of ₹${paiseToRupees(row.supplier_paise).toLocaleString('en-IN')} settled.`, actor)
  return mapMaintenance(db.prepare('SELECT * FROM contract_maintenance_allocations WHERE id = ?').get(allocationId) as Record<string, unknown>)
}

export function createHandover(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  input: {
    vehicleId: string
    handoverType: 'handover' | 'return'
    handoverAt: string
    odometerKm: number
    fuelLevelPct: number
    exteriorCondition: string
    interiorCondition: string
    tyreCondition: string
    existingDamages?: string
    accessories?: string
    photoReferences?: string[]
    documentChecklist?: string[]
    supplierRepresentative?: string
    receivingRepresentative?: string
    notes?: string
  },
  actor: string,
): VehicleHandover {
  assertContract(db, orgId, contractId)
  const vehicle = db.prepare('SELECT * FROM vehicle_contract_vehicles WHERE contract_id = ? AND vehicle_id = ? AND organization_id = ?')
    .get(contractId, input.vehicleId, orgId) as Record<string, unknown> | undefined
  if (!vehicle) throw new Error('Vehicle is not linked to this contract.')
  if (!input.handoverAt) throw new Error('Handover date is required.')
  const id = newId('hnd')
  db.prepare(`
    INSERT INTO vehicle_handovers (id, organization_id, contract_id, vehicle_id, vehicle_registration,
      handover_type, handover_at, odometer_km, fuel_level_pct, exterior_condition, interior_condition,
      tyre_condition, existing_damages, accessories, photo_references_json, document_checklist_json,
      supplier_representative, receiving_representative, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, contractId, input.vehicleId, String(vehicle.vehicle_registration),
    input.handoverType, input.handoverAt, Math.max(0, Math.round(input.odometerKm)),
    Math.max(0, Math.min(100, Math.round(input.fuelLevelPct))), input.exteriorCondition,
    input.interiorCondition, input.tyreCondition, input.existingDamages ?? '',
    input.accessories ?? '', JSON.stringify(input.photoReferences ?? []),
    JSON.stringify(input.documentChecklist ?? []), input.supplierRepresentative ?? '',
    input.receivingRepresentative ?? '', input.notes ?? '', nowIso())
  if (input.handoverType === 'return') {
    db.prepare('UPDATE vehicle_contract_vehicles SET returned_at = ? WHERE contract_id = ? AND vehicle_id = ?')
      .run(input.handoverAt, contractId, input.vehicleId)
  }
  logActivity(db, orgId, contractId, input.handoverType === 'return' ? 'VEHICLE_RETURNED' : 'VEHICLE_HANDOVER', `${input.handoverType === 'return' ? 'Return' : 'Handover'} recorded for ${String(vehicle.vehicle_registration)} at ${Math.round(input.odometerKm)} km.`, actor)
  return mapHandover(db.prepare('SELECT * FROM vehicle_handovers WHERE id = ?').get(id) as Record<string, unknown>)
}

export function addContractDocument(
  db: DatabaseSync,
  orgId: string,
  contractId: string,
  input: { name: string; category?: string; reference?: string },
  actor: string,
): ContractDocument {
  assertContract(db, orgId, contractId)
  if (!input.name?.trim()) throw new Error('Document name is required.')
  const id = newId('cdoc')
  db.prepare(`
    INSERT INTO contract_documents (id, organization_id, contract_id, name, category, reference, uploaded_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, contractId, input.name.trim(), input.category ?? '', input.reference ?? '', actor, nowIso())
  logActivity(db, orgId, contractId, 'DOCUMENT_ADDED', `Document "${input.name.trim()}" linked.`, actor)
  return {
    id,
    contractId,
    name: input.name.trim(),
    category: input.category ?? '',
    reference: input.reference ?? '',
    uploadedBy: actor,
    createdAt: nowIso(),
  }
}

export function createFleetPartner(
  db: DatabaseSync,
  orgId: string,
  input: Partial<FleetPartner>,
  actor: string,
): FleetPartner {
  if (!input.companyName?.trim()) throw new Error('Company name is required.')
  const gstin = (input.gstin ?? '').trim().toUpperCase()
  if (gstin) {
    const duplicate = db.prepare('SELECT company_name FROM fleet_partners WHERE organization_id = ? AND gstin = ?')
      .get(orgId, gstin) as { company_name: string } | undefined
    if (duplicate) throw new Error(`A fleet partner with this GSTIN already exists (${duplicate.company_name}).`)
  }
  const id = newId('fp')
  db.prepare(`
    INSERT INTO fleet_partners (id, organization_id, company_name, registration_number, gstin,
      contact_person, mobile, email, registered_address, operating_location, bank_account_masked,
      bank_ifsc, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, input.companyName.trim(), input.registrationNumber ?? '', gstin,
    input.contactPerson ?? '', input.mobile ?? '', input.email ?? '', input.registeredAddress ?? '',
    input.operatingLocation ?? '', input.bankAccountMasked ?? '', input.bankIfsc ?? '',
    input.status ?? 'active', input.notes ?? '', nowIso())
  const row = db.prepare('SELECT * FROM fleet_partners WHERE id = ?').get(id) as Record<string, unknown>
  logActivity(db, orgId, '', 'PARTNER_CREATED', `Fleet partner ${input.companyName.trim()} added by ${actor}.`, actor)
  return mapPartner(row)
}

export function updateFleetPartner(
  db: DatabaseSync,
  orgId: string,
  partnerId: string,
  input: Partial<FleetPartner>,
  actor: string,
): FleetPartner {
  const existing = db.prepare('SELECT * FROM fleet_partners WHERE id = ? AND organization_id = ?')
    .get(partnerId, orgId) as Record<string, string> | undefined
  if (!existing) throw new Error('Fleet partner not found.')
  db.prepare(`
    UPDATE fleet_partners SET company_name = ?, registration_number = ?, gstin = ?, contact_person = ?,
      mobile = ?, email = ?, registered_address = ?, operating_location = ?, bank_account_masked = ?,
      bank_ifsc = ?, status = ?, notes = ? WHERE id = ? AND organization_id = ?
  `).run(input.companyName ?? existing.company_name, input.registrationNumber ?? existing.registration_number,
    input.gstin ?? existing.gstin, input.contactPerson ?? existing.contact_person,
    input.mobile ?? existing.mobile, input.email ?? existing.email,
    input.registeredAddress ?? existing.registered_address, input.operatingLocation ?? existing.operating_location,
    input.bankAccountMasked ?? existing.bank_account_masked, input.bankIfsc ?? existing.bank_ifsc,
    input.status ?? existing.status, input.notes ?? existing.notes, partnerId, orgId)
  logActivity(db, orgId, '', 'PARTNER_UPDATED', `Fleet partner ${String(existing.company_name)} updated by ${actor}.`, actor)
  return mapPartner(db.prepare('SELECT * FROM fleet_partners WHERE id = ?').get(partnerId) as Record<string, unknown>)
}

export function createIndividualOwner(
  db: DatabaseSync,
  orgId: string,
  input: Partial<IndividualVehicleOwner>,
  actor: string,
): IndividualVehicleOwner {
  if (!input.fullName?.trim()) throw new Error('Owner name is required.')
  if (input.mobile?.trim()) {
    const duplicate = db.prepare('SELECT full_name FROM individual_vehicle_owners WHERE organization_id = ? AND mobile = ?')
      .get(orgId, input.mobile.trim()) as { full_name: string } | undefined
    if (duplicate) throw new Error(`An individual owner with this mobile already exists (${duplicate.full_name}).`)
  }
  const id = newId('ivo')
  db.prepare(`
    INSERT INTO individual_vehicle_owners (id, organization_id, full_name, mobile, email, address,
      identity_verification_status, identity_document_type, identity_document_masked,
      bank_account_masked, bank_ifsc, payment_preference, status, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, input.fullName.trim(), input.mobile ?? '', input.email ?? '', input.address ?? '',
    input.identityVerificationStatus ?? 'pending', input.identityDocumentType ?? '',
    input.identityDocumentMasked ?? '', input.bankAccountMasked ?? '', input.bankIfsc ?? '',
    input.paymentPreference ?? 'bank_transfer', input.status ?? 'active', input.notes ?? '', nowIso())
  logActivity(db, orgId, '', 'INDIVIDUAL_OWNER_CREATED', `Individual owner ${input.fullName.trim()} added by ${actor}.`, actor)
  return mapOwner(db.prepare('SELECT * FROM individual_vehicle_owners WHERE id = ?').get(id) as Record<string, unknown>)
}

export function updateIndividualOwner(
  db: DatabaseSync,
  orgId: string,
  ownerId: string,
  input: Partial<IndividualVehicleOwner>,
  actor: string,
): IndividualVehicleOwner {
  const existing = db.prepare('SELECT * FROM individual_vehicle_owners WHERE id = ? AND organization_id = ?')
    .get(ownerId, orgId) as Record<string, string> | undefined
  if (!existing) throw new Error('Individual owner not found.')
  db.prepare(`
    UPDATE individual_vehicle_owners SET full_name = ?, mobile = ?, email = ?, address = ?,
      identity_verification_status = ?, identity_document_type = ?, identity_document_masked = ?,
      bank_account_masked = ?, bank_ifsc = ?, payment_preference = ?, status = ?, notes = ?
    WHERE id = ? AND organization_id = ?
  `).run(input.fullName ?? existing.full_name, input.mobile ?? existing.mobile,
    input.email ?? existing.email, input.address ?? existing.address,
    input.identityVerificationStatus ?? existing.identity_verification_status,
    input.identityDocumentType ?? existing.identity_document_type,
    input.identityDocumentMasked ?? existing.identity_document_masked,
    input.bankAccountMasked ?? existing.bank_account_masked, input.bankIfsc ?? existing.bank_ifsc,
    input.paymentPreference ?? existing.payment_preference, input.status ?? existing.status,
    input.notes ?? existing.notes, ownerId, orgId)
  logActivity(db, orgId, '', 'INDIVIDUAL_OWNER_UPDATED', `Individual owner ${String(existing.full_name)} updated by ${actor}.`, actor)
  return mapOwner(db.prepare('SELECT * FROM individual_vehicle_owners WHERE id = ?').get(ownerId) as Record<string, unknown>)
}

export function getContractRenewals(db: DatabaseSync, orgId: string): VehicleContract[] {
  const workspace = getContractWorkspace(db, orgId)
  return workspace.contracts
    .filter((c) => c.status !== 'closed' && c.status !== 'terminated')
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
}

export function getContractActivity(db: DatabaseSync, orgId: string, limit = 300): ContractActivityEntry[] {
  const rows = db.prepare('SELECT * FROM contract_activity_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(orgId, Math.min(500, Math.max(1, limit))) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: String(row.id),
    contractId: String(row.contract_id),
    action: String(row.action),
    summary: String(row.summary),
    actor: String(row.actor),
    createdAt: String(row.created_at),
  }))
}
