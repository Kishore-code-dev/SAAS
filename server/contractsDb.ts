import crypto from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { OrganizationRole, VehicleOwnershipCategory } from '../src/types/fleet.ts'
import type {
  AmendmentApprovalStatus,
  ContractAmendment,
  ContractBondDeposit,
  ContractConditions,
  ContractDepositDeduction,
  ContractDocumentItem,
  ContractFinancialTerms,
  ContractHistoryEntry,
  ContractMaintenanceAllocation,
  ContractMaintenanceRule,
  ContractPayment,
  ContractPermissionKey,
  ContractPermissionRule,
  ContractStatus,
  ContractsWorkspacePayload,
  ContractVehicleLink,
  ContractVersion,
  DepositStatus,
  FleetPartner,
  IndividualVehicleOwner,
  ResponsibilityParty,
  VehicleContract,
  VehicleHandoverRecord,
  VehicleOwnershipRecord,
} from '../src/types/contracts.ts'
import {
  ALL_CONTRACT_PERMISSION_KEYS,
  canCloseContract,
  canRevealSensitiveSupplierDetails,
  canTransitionAmendment,
  checkOverlappingVehicleContract,
  computeDepositSummary,
  computeMaintenanceSplit,
  detectDuplicateIndividualOwner,
  detectDuplicatePartner,
  generateContractAlerts,
  hasContractPermission,
  isValidContractTransition,
  maskAadhaarNumber,
  maskBankAccount,
  maskPanNumber,
  resolveEffectiveContractPermissions,
} from '../src/utils/contractsEngine.ts'

export interface ContractActor {
  userId: string
  fullName: string
  role: OrganizationRole
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function ensureContractsSchemaAndSeed(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fleet_partners (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      partner_code TEXT NOT NULL,
      company_name TEXT NOT NULL,
      business_registration_no TEXT NOT NULL,
      gstin TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT NOT NULL,
      registered_address TEXT NOT NULL,
      operating_location TEXT NOT NULL,
      bank_account_holder TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      bank_account_number_masked TEXT NOT NULL,
      bank_account_last4 TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_partners_org ON fleet_partners(organization_id);

    CREATE TABLE IF NOT EXISTS individual_vehicle_owners (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      owner_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      identity_verification_status TEXT NOT NULL DEFAULT 'pending',
      pan_masked TEXT NOT NULL,
      aadhaar_masked TEXT NOT NULL,
      bank_account_holder TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      bank_account_number_masked TEXT NOT NULL,
      bank_account_last4 TEXT NOT NULL,
      ifsc_code TEXT NOT NULL,
      payment_preference TEXT NOT NULL DEFAULT 'bank_transfer',
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_individual_owners_org ON individual_vehicle_owners(organization_id);

    CREATE TABLE IF NOT EXISTS vehicle_ownership (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      ownership_category TEXT NOT NULL DEFAULT 'company_owned',
      legal_owner_name TEXT NOT NULL,
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      ownership_proof_ref TEXT NOT NULL DEFAULT '',
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_ownership_org ON vehicle_ownership(organization_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_ownership_veh ON vehicle_ownership(vehicle_id);

    CREATE TABLE IF NOT EXISTS vehicle_contracts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contract_code TEXT NOT NULL,
      contract_name TEXT NOT NULL,
      contract_category TEXT NOT NULL,
      supplier_type TEXT NOT NULL,
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      supplier_name TEXT NOT NULL,
      agreement_ref_number TEXT NOT NULL,
      agreement_date TEXT NOT NULL,
      start_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      duration_months INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1,
      description TEXT NOT NULL DEFAULT '',
      financial_terms_json TEXT NOT NULL,
      contract_conditions_json TEXT NOT NULL,
      closure_exception_note TEXT,
      created_by TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_vehicle_contracts_org ON vehicle_contracts(organization_id);

    CREATE TABLE IF NOT EXISTS vehicle_contract_vehicles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      ownership_category TEXT NOT NULL,
      agreed_monthly_rental REAL NOT NULL DEFAULT 0,
      agreed_per_km_rate REAL NOT NULL DEFAULT 0,
      agreed_per_trip_rate REAL NOT NULL DEFAULT 0,
      revenue_share_pct REAL NOT NULL DEFAULT 0,
      fixed_component REAL NOT NULL DEFAULT 0,
      variable_rate_note TEXT NOT NULL DEFAULT '',
      maintenance_responsibility TEXT NOT NULL DEFAULT 'supplier',
      fuel_responsibility TEXT NOT NULL DEFAULT 'operating_org',
      insurance_responsibility TEXT NOT NULL DEFAULT 'supplier',
      vehicle_condition_note TEXT NOT NULL DEFAULT '',
      initial_odometer_km REAL NOT NULL DEFAULT 0,
      handover_date TEXT NOT NULL,
      return_date TEXT,
      vehicle_contract_status TEXT NOT NULL DEFAULT 'active',
      overlapping_auth_note TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vcv_org ON vehicle_contract_vehicles(organization_id);
    CREATE INDEX IF NOT EXISTS idx_vcv_contract ON vehicle_contract_vehicles(contract_id);

    CREATE TABLE IF NOT EXISTS contract_versions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      financial_terms_json TEXT NOT NULL,
      contract_conditions_json TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      duration_months INTEGER NOT NULL,
      created_by TEXT NOT NULL,
      approved_by TEXT,
      created_at TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(contract_id);

    CREATE TABLE IF NOT EXISTS contract_amendments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      amendment_code TEXT NOT NULL,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      reason TEXT NOT NULL,
      amendment_type TEXT NOT NULL,
      previous_values_json TEXT NOT NULL,
      revised_values_json TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      recalculate_future_schedule INTEGER NOT NULL DEFAULT 1,
      recalculation_confirmed INTEGER NOT NULL DEFAULT 0,
      supporting_doc_id TEXT,
      approval_status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      rejection_reason TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_contract_amendments_org ON contract_amendments(organization_id);

    CREATE TABLE IF NOT EXISTS contract_maintenance_rules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      vehicle_id TEXT,
      maintenance_category TEXT NOT NULL,
      custom_category_label TEXT,
      responsible_party TEXT NOT NULL,
      org_share_pct REAL NOT NULL DEFAULT 0,
      supplier_share_pct REAL NOT NULL DEFAULT 100,
      threshold_amount_inr REAL NOT NULL DEFAULT 0,
      circumstance TEXT NOT NULL DEFAULT 'all',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cmr_org ON contract_maintenance_rules(organization_id);

    CREATE TABLE IF NOT EXISTS contract_maintenance_allocations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      maintenance_record_id TEXT,
      work_order_id TEXT,
      maintenance_category TEXT NOT NULL,
      description TEXT NOT NULL,
      total_repair_amount_inr REAL NOT NULL,
      org_share_inr REAL NOT NULL,
      supplier_share_inr REAL NOT NULL,
      responsible_party TEXT NOT NULL,
      settlement_status TEXT NOT NULL DEFAULT 'pending_approval',
      approved_by TEXT,
      approved_at TEXT,
      settlement_payment_id TEXT,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cma_org ON contract_maintenance_allocations(organization_id);

    CREATE TABLE IF NOT EXISTS contract_bonds_deposits (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      deposit_code TEXT NOT NULL,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      supplier_type TEXT NOT NULL,
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      supplier_name TEXT NOT NULL,
      vehicle_id TEXT,
      vehicle_group_label TEXT NOT NULL DEFAULT 'Contract Fleet Pool',
      deposit_type TEXT NOT NULL,
      required_amount_inr REAL NOT NULL,
      paid_amount_inr REAL NOT NULL DEFAULT 0,
      outstanding_amount_inr REAL NOT NULL DEFAULT 0,
      deducted_amount_inr REAL NOT NULL DEFAULT 0,
      refunded_amount_inr REAL NOT NULL DEFAULT 0,
      payment_date TEXT,
      payment_reference TEXT,
      payment_method TEXT,
      receiving_party TEXT NOT NULL,
      is_refundable INTEGER NOT NULL DEFAULT 1,
      refund_conditions TEXT NOT NULL DEFAULT '',
      expiry_date TEXT,
      document_ref TEXT,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      verified_by TEXT,
      refund_approved_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cbd_org ON contract_bonds_deposits(organization_id);

    CREATE TABLE IF NOT EXISTS contract_deposit_deductions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      deposit_id TEXT NOT NULL REFERENCES contract_bonds_deposits(id) ON DELETE CASCADE,
      contract_id TEXT NOT NULL,
      vehicle_id TEXT,
      amount_inr REAL NOT NULL,
      reason TEXT NOT NULL,
      evidence_ref TEXT NOT NULL DEFAULT '',
      authorized_by TEXT NOT NULL,
      authorized_at TEXT NOT NULL,
      handover_return_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cdd_org ON contract_deposit_deductions(organization_id);

    CREATE TABLE IF NOT EXISTS contract_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      transaction_code TEXT NOT NULL,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      contract_version INTEGER NOT NULL DEFAULT 1,
      supplier_type TEXT NOT NULL,
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      supplier_name TEXT NOT NULL,
      vehicle_id TEXT,
      vehicle_registration TEXT,
      payment_kind TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      due_date TEXT NOT NULL,
      payment_amount_inr REAL NOT NULL,
      paid_amount_inr REAL NOT NULL DEFAULT 0,
      outstanding_amount_inr REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_reference TEXT NOT NULL,
      receipt_ref TEXT,
      status TEXT NOT NULL,
      reconciliation_notes TEXT,
      recorded_by TEXT NOT NULL,
      approved_by TEXT,
      approved_at TEXT,
      reconciled_by TEXT,
      reconciled_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cp_org ON contract_payments(organization_id);

    CREATE TABLE IF NOT EXISTS vehicle_handovers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      handover_code TEXT NOT NULL,
      contract_id TEXT NOT NULL REFERENCES vehicle_contracts(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      supplier_type TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      record_type TEXT NOT NULL,
      linked_initial_handover_id TEXT,
      handover_datetime TEXT NOT NULL,
      odometer_km REAL NOT NULL,
      fuel_level_pct REAL NOT NULL,
      exterior_condition TEXT NOT NULL,
      interior_condition TEXT NOT NULL,
      tyre_condition TEXT NOT NULL,
      existing_damages TEXT NOT NULL DEFAULT '',
      accessories_checklist_json TEXT NOT NULL,
      equipment_checklist_json TEXT NOT NULL,
      document_checklist_json TEXT NOT NULL,
      photos_json TEXT NOT NULL,
      handover_notes TEXT NOT NULL DEFAULT '',
      supplier_representative TEXT NOT NULL,
      receiving_representative TEXT NOT NULL,
      supplier_ack_name TEXT NOT NULL,
      receiving_ack_name TEXT NOT NULL,
      new_damages TEXT,
      missing_equipment TEXT,
      pending_repairs_inr REAL DEFAULT 0,
      outstanding_expenses_inr REAL DEFAULT 0,
      recommended_deduction_inr REAL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vh_org ON vehicle_handovers(organization_id);

    CREATE TABLE IF NOT EXISTS contract_documents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      contract_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      expiry_date TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending_verification',
      restricted_access INTEGER NOT NULL DEFAULT 0,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cdoc_org ON contract_documents(organization_id);

    CREATE TABLE IF NOT EXISTS contract_history (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      contract_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      summary TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chist_org ON contract_history(organization_id);

    CREATE TABLE IF NOT EXISTS contract_permissions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      permission_key TEXT NOT NULL,
      allowed INTEGER NOT NULL,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, role, permission_key)
    );
    CREATE INDEX IF NOT EXISTS idx_cperm_org ON contract_permissions(organization_id);
  `)

  seedContractsIfEmpty(db)
}

function appendContractHistory(
  db: DatabaseSync,
  params: {
    organizationId: string
    contractId?: string | null
    entityType: string
    entityId: string
    action: string
    actor: ContractActor
    summary: string
    before?: unknown
    after?: unknown
  },
): void {
  db.prepare(`
    INSERT INTO contract_history (
      id, organization_id, contract_id, entity_type, entity_id, action,
      actor_user_id, actor_name, actor_role, summary, before_json, after_json, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `ch-${crypto.randomUUID().slice(0, 10)}`,
    params.organizationId,
    params.contractId ?? null,
    params.entityType,
    params.entityId,
    params.action,
    params.actor.userId,
    params.actor.fullName,
    params.actor.role,
    params.summary,
    params.before !== undefined ? JSON.stringify(params.before) : null,
    params.after !== undefined ? JSON.stringify(params.after) : null,
    new Date().toISOString(),
  )
}

function seedContractsIfEmpty(db: DatabaseSync): void {
  const existingPartners = db.prepare('SELECT COUNT(*) AS count FROM fleet_partners').get() as { count: number }
  if (existingPartners.count > 0) return

  const kaveriExists = db.prepare("SELECT id FROM organizations WHERE id = 'org-kaveri'").get()
  if (!kaveriExists) return

  const now = new Date()
  const nowIso = now.toISOString()
  const dayIso = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86400000).toISOString().slice(0, 10)

  // Seed 2 Contracted Fleet Vehicles + 2 Individual Owner Vehicles into org-kaveri fleet_vehicles (leaving v-k1..v-k8 company_owned)
  const thirdPartyVehicles = [
    {
      id: 'v-kc1',
      reg: 'TN09CR4410',
      make: 'Tata',
      model: 'Ultra T.7',
      category: 'Medium Truck',
      powertrain: 'ICE',
      fuelType: 'Diesel',
      year: 2024,
      odometer: 48200,
      dailyAvg: 195,
      health: 86,
      corridorId: 'cor-chennai',
      cityName: 'Chennai',
      lat: 13.0952,
      lng: 80.2468,
      insProvider: 'ICICI Lombard Commercial',
      monthlyRevenue: 162000,
      ownershipCategory: 'contracted_fleet',
      legalOwnerName: 'Sri Murugan Fleet Carriers Pvt Ltd',
      fleetPartnerId: 'fp-k-1',
      individualOwnerId: null,
      activeContractId: 'con-k-1',
    },
    {
      id: 'v-kc2',
      reg: 'TN11CR8820',
      make: 'Ashok Leyland',
      model: 'Ecomet 1615 HE',
      category: 'Heavy Truck',
      powertrain: 'ICE',
      fuelType: 'Diesel',
      year: 2023,
      odometer: 89400,
      dailyAvg: 245,
      health: 78,
      corridorId: 'cor-coimbatore',
      cityName: 'Coimbatore',
      lat: 11.0168,
      lng: 76.9688,
      insProvider: 'New India Assurance',
      monthlyRevenue: 198000,
      ownershipCategory: 'contracted_fleet',
      legalOwnerName: 'Cauvery Heavy Haulage LLP',
      fleetPartnerId: 'fp-k-2',
      individualOwnerId: null,
      activeContractId: 'con-k-2',
    },
    {
      id: 'v-ki1',
      reg: 'TN58IO7721',
      make: 'Mahindra',
      model: 'Furio 12',
      category: 'Medium Truck',
      powertrain: 'ICE',
      fuelType: 'Diesel',
      year: 2024,
      odometer: 36500,
      dailyAvg: 175,
      health: 91,
      corridorId: 'cor-madurai',
      cityName: 'Madurai',
      lat: 9.9392,
      lng: 78.1288,
      insProvider: 'Bajaj Allianz Commercial',
      monthlyRevenue: 148000,
      ownershipCategory: 'individual_owner',
      legalOwnerName: 'Ramesh Babu M',
      fleetPartnerId: null,
      individualOwnerId: 'io-k-1',
      activeContractId: 'con-k-3',
    },
    {
      id: 'v-ki2',
      reg: 'TN37IO3390',
      make: 'Switch Mobility',
      model: 'IeV4 Electric',
      category: 'Electric Cargo',
      powertrain: 'EV',
      fuelType: 'Electric',
      year: 2025,
      odometer: 19800,
      dailyAvg: 135,
      health: 94,
      corridorId: 'cor-salem',
      cityName: 'Salem',
      lat: 11.6712,
      lng: 78.1512,
      insProvider: 'HDFC ERGO EV Commercial',
      monthlyRevenue: 134000,
      ownershipCategory: 'individual_owner',
      legalOwnerName: 'Selvakumar Natarajan',
      fleetPartnerId: null,
      individualOwnerId: 'io-k-2',
      activeContractId: 'con-k-4',
    },
  ]

  const insVeh = db.prepare(`
    INSERT OR IGNORE INTO fleet_vehicles (
      id, organization_id, environment, registration_number, make, model, category, powertrain, fuel_type, year,
      assigned_driver_id, odometer_km, daily_avg_km, health_score, operation_status, fuel_or_soc_pct,
      corridor_id, city_name, registration_expiry, insurance_expiry, insurance_provider,
      fitness_expiry, puc_expiry, permit_expiry, last_service_date, next_service_due_date,
      next_service_due_odometer_km, monthly_revenue_inr, specs_json, telemetry_json, decommissioned,
      ownership_category, legal_owner_name, fleet_partner_id, individual_owner_id, active_contract_id
    ) VALUES (?, 'org-kaveri', 'production', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'moving', 78, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `)
  const insComp = db.prepare(`
    INSERT OR IGNORE INTO fleet_vehicle_components (
      id, organization_id, vehicle_id, component_name, health_score, status, wear_rate_per_1000km, last_serviced_at, predicted_replacement_date, notes
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const v of thirdPartyVehicles) {
    insVeh.run(
      v.id,
      v.reg,
      v.make,
      v.model,
      v.category,
      v.powertrain,
      v.fuelType,
      v.year,
      v.odometer,
      v.dailyAvg,
      v.health,
      v.corridorId,
      v.cityName,
      dayIso(320),
      dayIso(210),
      v.insProvider,
      dayIso(240),
      dayIso(140),
      dayIso(300),
      dayIso(-35),
      dayIso(85),
      v.odometer + 10000,
      v.monthlyRevenue,
      JSON.stringify({
        heightMeters: 3.1,
        widthMeters: 2.25,
        lengthMeters: 6.4,
        grossVehicleWeightKg: v.category === 'Heavy Truck' ? 16200 : 11990,
        axleCount: v.category === 'Heavy Truck' ? 3 : 2,
        payloadCapacityKg: v.category === 'Heavy Truck' ? 9800 : 6200,
        cargoType: 'Regional Commercial Freight',
        emissionNorm: v.powertrain === 'EV' ? 'EV-Zero' : 'BS-VI',
      }),
      JSON.stringify({
        vehicleId: v.id,
        location: { lat: v.lat, lng: v.lng },
        cityLabel: `${v.cityName} Industrial Ring`,
        speedKmh: 42,
        heading: 118,
        gpsAccuracyMeters: 9,
        signalQualityPct: 92,
        connectionState: 'connected',
        source: 'smartphone_gps',
        lastUpdatedAt: nowIso,
        motionPermissionGranted: true,
      }),
      v.ownershipCategory,
      v.legalOwnerName,
      v.fleetPartnerId,
      v.individualOwnerId,
      v.activeContractId,
    )

    insComp.run(`${v.id}-c1`, v.id, 'Engine', v.health, 'healthy', 0.34, dayIso(-35), dayIso(190), 'Contracted asset telemetry nominal')
    insComp.run(`${v.id}-c2`, v.id, 'Brakes', Math.max(70, v.health - 4), 'healthy', 0.41, dayIso(-35), dayIso(140), 'Brake lining checked at supplier handover')
    insComp.run(`${v.id}-c3`, v.id, 'Tyres', Math.max(72, v.health - 6), 'healthy', 0.44, dayIso(-35), dayIso(120), 'Tread depth verified on handover')
  }

  // Record ownership ledger rows for all 12 org-kaveri vehicles
  const kaveriVehicles = db
    .prepare("SELECT id, ownership_category, legal_owner_name, fleet_partner_id, individual_owner_id FROM fleet_vehicles WHERE organization_id = 'org-kaveri'")
    .all() as Array<Record<string, unknown>>
  const insOwn = db.prepare(`
    INSERT INTO vehicle_ownership (
      id, organization_id, vehicle_id, ownership_category, legal_owner_name, fleet_partner_id, individual_owner_id,
      ownership_proof_ref, effective_from, effective_to, notes, updated_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `)
  for (const kv of kaveriVehicles) {
    const cat = String(kv.ownership_category || 'company_owned')
    const ownerName = kv.legal_owner_name ? String(kv.legal_owner_name) : 'Kaveri Logistics Pvt Ltd'
    insOwn.run(
      `vown-${kv.id}`,
      String(kv.id),
      cat,
      ownerName,
      kv.fleet_partner_id ? String(kv.fleet_partner_id) : null,
      kv.individual_owner_id ? String(kv.individual_owner_id) : null,
      cat === 'company_owned' ? 'RC-CORP-KAVERI' : 'RC-SUPPLIER-VERIFIED',
      dayIso(-180),
      cat === 'company_owned' ? 'Capitalized on Kaveri Logistics balance sheet' : 'Third-party supplied vehicle under operational contract',
      nowIso,
    )
  }

  // Fleet Partners
  const insPartner = db.prepare(`
    INSERT INTO fleet_partners (
      id, organization_id, partner_code, company_name, business_registration_no, gstin, contact_person,
      mobile, email, registered_address, operating_location, bank_account_holder, bank_name,
      bank_account_number_masked, bank_account_last4, ifsc_code, status, notes, created_at, updated_at, archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `)
  insPartner.run(
    'fp-k-1',
    'org-kaveri',
    'FP-KAV-001',
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'CIN-U60230TN2018PTC124901',
    '33AABCS8421M1Z2',
    'S. Muruganandam',
    '+91 98402 77119',
    'contracts@srimurugancarriers.in',
    'Plot 42, Madhavaram Truck Terminal, Chennai 600060',
    'Chennai · Tiruvallur · Sriperumbudur',
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'HDFC Bank Commercial',
    'XXXXXX8814',
    '8814',
    'HDFC0000128',
    'active',
    'Tier-1 multi-vehicle fleet supplier with shared major repair SLA.',
    dayIso(-180),
    nowIso,
  )
  insPartner.run(
    'fp-k-2',
    'org-kaveri',
    'FP-KAV-002',
    'Cauvery Heavy Haulage LLP',
    'LLPIN-AAQ-7821',
    '33AAFFC2190E1Z8',
    'Prakash Velusamy',
    '+91 98942 66104',
    'ops@cauveryhaulage.in',
    '19 Avinashi Logistics Park, Neelambur, Coimbatore 641062',
    'Coimbatore · Erode · Salem Corridor',
    'Cauvery Heavy Haulage LLP',
    'Axis Bank Corporate',
    'XXXXXX5529',
    '5529',
    'UTIB0000245',
    'active',
    'Heavy haulage partner supplying BS-VI Ecomet units on per-km + fixed hybrid agreement.',
    dayIso(-120),
    nowIso,
  )

  // Individual Vehicle Owners
  const insOwner = db.prepare(`
    INSERT INTO individual_vehicle_owners (
      id, organization_id, owner_code, full_name, mobile, email, address, identity_verification_status,
      pan_masked, aadhaar_masked, bank_account_holder, bank_name, bank_account_number_masked, bank_account_last4,
      ifsc_code, payment_preference, status, notes, created_at, updated_at, archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `)
  insOwner.run(
    'io-k-1',
    'org-kaveri',
    'IO-KAV-001',
    'Ramesh Babu M',
    '+91 98421 55001',
    'rameshbabu.transport@gmail.com',
    '14 Bypass Road, Ellis Nagar, Madurai 625016',
    'verified',
    'ABXXXX419M',
    'XXXX-XXXX-8891',
    'Ramesh Babu M',
    'State Bank of India',
    'XXXXXX4401',
    '4401',
    'SBIN0004218',
    'bank_transfer',
    'active',
    'Verified owner-cum-supplier supplying Mahindra Furio 12 on fixed monthly attachment.',
    dayIso(-150),
    nowIso,
  )
  insOwner.run(
    'io-k-2',
    'org-kaveri',
    'IO-KAV-002',
    'Selvakumar Natarajan',
    '+91 94433 90218',
    'selva.evfreight@gmail.com',
    '88 Five Roads Extension, Salem 636004',
    'verified',
    'CDXXXX772K',
    'XXXX-XXXX-3142',
    'Selvakumar Natarajan',
    'Canara Bank',
    'XXXXXX1930',
    '1930',
    'CNRB0001822',
    'upi',
    'active',
    'EV light commercial owner on revenue sharing attachment.',
    dayIso(-65),
    nowIso,
  )

  const defaultConds: ContractConditions = {
    maintenanceResponsibility: 'shared',
    fuelResponsibility: 'operating_org',
    insuranceResponsibility: 'supplier',
    accidentResponsibility: 'shared',
    tyreReplacementResponsibility: 'supplier',
    breakdownResponsibility: 'operating_org',
    driverResponsibility: 'operating_org',
    permitResponsibility: 'supplier',
    fitnessPucResponsibility: 'supplier',
    vehicleReplacementConditions: 'Supplier provides standby truck within 24 hours for breakdowns exceeding 48 hours.',
    downtimeConditions: 'Pro-rata rental deduction at Rs 2,200/day after 24h supplier-attributable downtime.',
    terminationConditions: '30 days written notice or immediate cause termination on permit/insurance lapse.',
    renewalConditions: 'Auto-review 30 days prior to expiry with +/- 5% rate indexation clause.',
    vehicleReturnConditions: 'Joint odometer, fuel, accessory, and photographic damage inspection at Chennai/Madurai depot.',
  }

  // Contracts (showing multiple categories, expiring-soon, pending approval, and active agreements)
  const insContract = db.prepare(`
    INSERT INTO vehicle_contracts (
      id, organization_id, contract_code, contract_name, contract_category, supplier_type,
      fleet_partner_id, individual_owner_id, supplier_name, agreement_ref_number, agreement_date,
      start_date, expiry_date, duration_months, currency, status, current_version, description,
      financial_terms_json, contract_conditions_json, closure_exception_note, created_by, approved_by, approved_at,
      created_at, updated_at, archived
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0)
  `)

  const c1Terms: ContractFinancialTerms = {
    fixedRentalAmount: 68000,
    monthlyRental: 68000,
    perKmRate: 0,
    perTripRate: 0,
    revenueSharingPct: 0,
    fixedComponent: 68000,
    variableComponentDesc: 'Zero per-km surcharge up to 4,500 km/month; Rs 14/km thereafter',
    paymentFrequency: 'monthly',
    paymentDueDay: 5,
    advancePayment: 34000,
    securityDeposit: 50000,
    bondAmount: 50000,
    latePaymentTerms: '1.5% monthly interest after 7-day grace window',
    taxTreatment: 'GST 18% RCM / TDS 194C 2%',
    additionalCharges: 'Toll & state border entry reimbursed at actuals',
    deductionConditions: 'Unauthorized downtime or missing tools deducted from monthly settlement',
    settlementConditions: 'Net 5 days after monthly log verification',
  }

  const c2Terms: ContractFinancialTerms = {
    fixedRentalAmount: 42000,
    monthlyRental: 42000,
    perKmRate: 18,
    perTripRate: 0,
    revenueSharingPct: 0,
    fixedComponent: 42000,
    variableComponentDesc: 'Rs 42,000 base commitment + Rs 18/km corridor run',
    paymentFrequency: 'monthly',
    paymentDueDay: 10,
    advancePayment: 25000,
    securityDeposit: 75000,
    bondAmount: 75000,
    latePaymentTerms: 'Standard 10-day settlement cycle',
    taxTreatment: 'GST 12% Forward Charge / TDS 194C 2%',
    additionalCharges: 'Night halt allowance Rs 600/night beyond 400 km',
    deductionConditions: 'Fuel variance > 8% deducted post audit',
    settlementConditions: 'Monthly reconciliation via e-POD logs',
  }

  const c3Terms: ContractFinancialTerms = {
    fixedRentalAmount: 52000,
    monthlyRental: 52000,
    perKmRate: 0,
    perTripRate: 0,
    revenueSharingPct: 0,
    fixedComponent: 52000,
    variableComponentDesc: 'Fixed monthly individual owner attachment fee',
    paymentFrequency: 'monthly',
    paymentDueDay: 7,
    advancePayment: 20000,
    securityDeposit: 30000,
    bondAmount: 0,
    latePaymentTerms: 'Direct NEFT within 5 working days',
    taxTreatment: 'TDS 194C 1% (Individual)',
    additionalCharges: 'Permit & fitness borne by individual owner',
    deductionConditions: 'Damage beyond wear & tear deducted on handover return',
    settlementConditions: 'Owner monthly settlement statement issued on 1st',
  }

  const c4Terms: ContractFinancialTerms = {
    fixedRentalAmount: 0,
    monthlyRental: 0,
    perKmRate: 0,
    perTripRate: 0,
    revenueSharingPct: 72,
    fixedComponent: 0,
    variableComponentDesc: '72% operating revenue share to owner / 28% platform & dispatch share to Kaveri',
    paymentFrequency: 'bi_weekly',
    paymentDueDay: 15,
    advancePayment: 0,
    securityDeposit: 25000,
    bondAmount: 0,
    latePaymentTerms: 'Settled bi-weekly',
    taxTreatment: 'TDS 194C 1%',
    additionalCharges: 'DC fast charging billed to operating organization',
    deductionConditions: 'Pending fines settled at bi-weekly payout',
    settlementConditions: 'Bi-weekly route settlement',
  }

  insContract.run(
    'con-k-1',
    'CON-KAV-2026-001',
    'Sri Murugan Urban Express Rental Agreement',
    'fixed_monthly_rental',
    'fleet_partner',
    'fp-k-1',
    null,
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'SMFC/KAV/AGR/2026-14',
    dayIso(-175),
    dayIso(-170),
    dayIso(195),
    12,
    'active',
    2,
    'Primary contracted medium truck agreement covering Chennai hub intra-corridor dispatches with 60/40 shared major repair clause.',
    JSON.stringify(c1Terms),
    JSON.stringify(defaultConds),
    'Karthikeyan R',
    'Karthikeyan R',
    dayIso(-172),
    dayIso(-175),
    nowIso,
  )

  insContract.run(
    'con-k-2',
    'CON-KAV-2026-002',
    'Cauvery Heavy Linehaul Hybrid Contract',
    'fixed_plus_variable',
    'fleet_partner',
    'fp-k-2',
    null,
    'Cauvery Heavy Haulage LLP',
    'CHH/KAV/2026-08',
    dayIso(-340),
    dayIso(-335),
    dayIso(18),
    12,
    'renewal_pending',
    1,
    'Coimbatore-Salem heavy truck fixed + per-km agreement expiring within 30 days; renewal review queued.',
    JSON.stringify(c2Terms),
    JSON.stringify({ ...defaultConds, maintenanceResponsibility: 'supplier' }),
    'Priya Sundar',
    'Karthikeyan R',
    dayIso(-336),
    dayIso(-340),
    nowIso,
  )

  insContract.run(
    'con-k-3',
    'CON-KAV-2026-003',
    'Ramesh Babu Individual Owner Truck Attachment',
    'fixed_monthly_rental',
    'individual_owner',
    null,
    'io-k-1',
    'Ramesh Babu M',
    'IO/MAD/2026-03',
    dayIso(-140),
    dayIso(-135),
    dayIso(230),
    12,
    'active',
    1,
    'Individual owner supplied Furio 12 operating Madurai-Trichy distribution corridor.',
    JSON.stringify(c3Terms),
    JSON.stringify({ ...defaultConds, maintenanceResponsibility: 'operating_org', insuranceResponsibility: 'supplier' }),
    'Priya Sundar',
    'Karthikeyan R',
    dayIso(-136),
    dayIso(-140),
    nowIso,
  )

  insContract.run(
    'con-k-4',
    'CON-KAV-2026-004',
    'Selvakumar EV Cargo Revenue Share Contract',
    'revenue_sharing',
    'individual_owner',
    null,
    'io-k-2',
    'Selvakumar Natarajan',
    'IO/SLM/EV-09',
    dayIso(-10),
    dayIso(-5),
    dayIso(355),
    12,
    'pending_approval',
    1,
    'New EV revenue sharing attachment awaiting Fleet Owner final sign-off.',
    JSON.stringify(c4Terms),
    JSON.stringify({ ...defaultConds, fuelResponsibility: 'operating_org', maintenanceResponsibility: 'supplier' }),
    'Priya Sundar',
    null,
    null,
    dayIso(-10),
    nowIso,
  )

  // Vehicle links
  const insLink = db.prepare(`
    INSERT INTO vehicle_contract_vehicles (
      id, organization_id, contract_id, vehicle_id, vehicle_registration, ownership_category,
      agreed_monthly_rental, agreed_per_km_rate, agreed_per_trip_rate, revenue_share_pct, fixed_component,
      variable_rate_note, maintenance_responsibility, fuel_responsibility, insurance_responsibility,
      vehicle_condition_note, initial_odometer_km, handover_date, return_date, vehicle_contract_status,
      overlapping_auth_note, created_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)
  `)
  insLink.run('cvl-k-1', 'con-k-1', 'v-kc1', 'TN09CR4410', 'contracted_fleet', 68000, 0, 0, 68000, 'Up to 4,500 km', 'shared', 'operating_org', 'supplier', 'Clean cab, 90% tyres', 32400, dayIso(-170), 'active', nowIso)
  insLink.run('cvl-k-2', 'con-k-2', 'v-kc2', 'TN11CR8820', 'contracted_fleet', 42000, 18, 0, 42000, 'Rs 18/km variable', 'supplier', 'operating_org', 'supplier', 'Heavy cargo body verified', 68200, dayIso(-335), 'active', nowIso)
  insLink.run('cvl-k-3', 'con-k-3', 'v-ki1', 'TN58IO7721', 'individual_owner', 52000, 0, 0, 52000, 'Fixed monthly payout', 'operating_org', 'operating_org', 'supplier', '2024 Furio 12 clean body', 26100, dayIso(-135), 'active', nowIso)
  insLink.run('cvl-k-4', 'con-k-4', 'v-ki2', 'TN37IO3390', 'individual_owner', 0, 0, 72, 0, '72% net freight share', 'supplier', 'operating_org', 'supplier', 'EV battery SOH 97% at inspection', 19400, dayIso(-5), 'pending_handover', nowIso)

  // Version snapshots + Sample Approved Amendment on con-k-1
  const insVer = db.prepare(`
    INSERT INTO contract_versions (
      id, organization_id, contract_id, version_number, effective_date, financial_terms_json,
      contract_conditions_json, expiry_date, duration_months, created_by, approved_by, created_at, notes
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insVer.run(
    'cv-k-1-v1',
    'con-k-1',
    1,
    dayIso(-170),
    JSON.stringify({ ...c1Terms, monthlyRental: 64000, fixedRentalAmount: 64000 }),
    JSON.stringify({ ...defaultConds, maintenanceResponsibility: 'supplier' }),
    dayIso(195),
    12,
    'Karthikeyan R',
    'Karthikeyan R',
    dayIso(-170),
    'Initial signed contract v1 (Rs 64,000/month)',
  )
  insVer.run(
    'cv-k-1-v2',
    'con-k-1',
    2,
    dayIso(-45),
    JSON.stringify(c1Terms),
    JSON.stringify(defaultConds),
    dayIso(195),
    12,
    'Karthikeyan R',
    'Karthikeyan R',
    dayIso(-45),
    'Effective Amendment AMD-KAV-001: Rental adjusted to Rs 68,000 & 60/40 shared repair rule activated',
  )
  insVer.run('cv-k-2-v1', 'con-k-2', 1, dayIso(-335), JSON.stringify(c2Terms), JSON.stringify({ ...defaultConds, maintenanceResponsibility: 'supplier' }), dayIso(18), 12, 'Priya Sundar', 'Karthikeyan R', dayIso(-335), 'Initial signed version')
  insVer.run('cv-k-3-v1', 'con-k-3', 1, dayIso(-135), JSON.stringify(c3Terms), JSON.stringify({ ...defaultConds, maintenanceResponsibility: 'operating_org' }), dayIso(230), 12, 'Priya Sundar', 'Karthikeyan R', dayIso(-135), 'Initial signed version')

  db.prepare(`
    INSERT INTO contract_amendments (
      id, organization_id, amendment_code, contract_id, title, reason, amendment_type,
      previous_values_json, revised_values_json, effective_date, recalculate_future_schedule,
      recalculation_confirmed, supporting_doc_id, approval_status, created_by, created_at, approved_by, approved_at, rejection_reason
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'cdoc-k-2', 'effective', 'Priya Sundar', ?, 'Karthikeyan R', ?, NULL)
  `).run(
    'amd-k-1',
    'AMD-KAV-001',
    'con-k-1',
    'Q3 Rate & Shared Major Repair Addendum',
    'Expanded Chennai hub shift hours and moved major engine/transmission repairs to 60/40 shared split',
    'rental_amount',
    JSON.stringify({ monthlyRental: 64000, maintenanceResponsibility: 'supplier' }),
    JSON.stringify({ monthlyRental: 68000, maintenanceResponsibility: 'shared' }),
    dayIso(-45),
    dayIso(-50),
    dayIso(-46),
  )

  // Maintenance Responsibility Rules & Split Allocations (spec §20 Scenario G: ₹18,000 -> 60/40 -> ₹10,800 org / ₹7,200 supplier)
  const insRule = db.prepare(`
    INSERT INTO contract_maintenance_rules (
      id, organization_id, contract_id, vehicle_id, maintenance_category, custom_category_label,
      responsible_party, org_share_pct, supplier_share_pct, threshold_amount_inr, circumstance, notes, created_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
  `)
  insRule.run('cmr-k-1', 'con-k-1', 'v-kc1', 'engine', 'shared', 60, 40, 5000, 'breakdown', 'Major engine repairs split 60% operating org / 40% Sri Murugan above Rs 5,000.', nowIso)
  insRule.run('cmr-k-2', 'con-k-1', 'v-kc1', 'preventive_maintenance', 'operating_org', 100, 0, 0, 'routine', 'Scheduled oil & filter consumables handled by Kaveri workshop.', nowIso)
  insRule.run('cmr-k-3', 'con-k-2', 'v-kc2', 'tyres', 'supplier', 0, 100, 0, 'all', 'Cauvery Haulage bears 100% tyre replacement.', nowIso)
  insRule.run('cmr-k-4', 'con-k-3', 'v-ki1', 'periodic_servicing', 'operating_org', 100, 0, 0, 'routine', 'Operating org absorbs periodic running service.', nowIso)

  const insAlloc = db.prepare(`
    INSERT INTO contract_maintenance_allocations (
      id, organization_id, contract_id, vehicle_id, vehicle_registration, maintenance_record_id, work_order_id,
      maintenance_category, description, total_repair_amount_inr, org_share_inr, supplier_share_inr,
      responsible_party, settlement_status, approved_by, approved_at, settlement_payment_id, notes, created_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insAlloc.run(
    'cma-k-1',
    'con-k-1',
    'v-kc1',
    'TN09CR4410',
    'engine',
    'Turbocharger & EGR valve assembly overhaul (single workshop invoice split 60/40)',
    18000,
    10800,
    7200,
    'shared',
    'approved',
    'Karthikeyan R',
    dayIso(-12),
    null,
    'Split cleanly under rule CMR-K-1: Rs 10,800 operating org + Rs 7,200 recoverable from Sri Murugan.',
    dayIso(-14),
  )

  // Security Deposits & Bonds (spec §20 Scenario C: ₹50,000 deposit with ₹40,000 paid -> ₹10,000 outstanding)
  const insDep = db.prepare(`
    INSERT INTO contract_bonds_deposits (
      id, organization_id, deposit_code, contract_id, supplier_type, fleet_partner_id, individual_owner_id,
      supplier_name, vehicle_id, vehicle_group_label, deposit_type, required_amount_inr, paid_amount_inr,
      outstanding_amount_inr, deducted_amount_inr, refunded_amount_inr, payment_date, payment_reference, payment_method,
      receiving_party, is_refundable, refund_conditions, expiry_date, document_ref, status,
      created_by, verified_by, refund_approved_by, created_at, updated_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
  `)
  insDep.run(
    'dep-k-1',
    'DEP-KAV-001',
    'con-k-1',
    'fleet_partner',
    'fp-k-1',
    null,
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'v-kc1',
    'TN09CR4410',
    'refundable_security_deposit',
    50000,
    40000,
    10000,
    0,
    0,
    dayIso(-168),
    'NEFT-HDFC-992014',
    'neft',
    'Sri Murugan Fleet Carriers Pvt Ltd',
    1,
    'Refundable within 15 days of vehicle return inspection after damage/pending dues deductions.',
    dayIso(195),
    'DEP-RCPT-001',
    'payment_recorded',
    'Karthikeyan R',
    'Lakshmi Narayanan',
    dayIso(-168),
    nowIso,
  )
  insDep.run(
    'dep-k-2',
    'DEP-KAV-002',
    'con-k-2',
    'fleet_partner',
    'fp-k-2',
    null,
    'Cauvery Heavy Haulage LLP',
    'v-kc2',
    'TN11CR8820',
    'performance_bond',
    75000,
    75000,
    0,
    0,
    0,
    dayIso(-332),
    'RTGS-AXIS-77120',
    'rtgs',
    'Cauvery Heavy Haulage LLP',
    1,
    'Full bond release upon completion of Coimbatore return inspection.',
    dayIso(18),
    'BOND-CERT-002',
    'active',
    'Karthikeyan R',
    'Lakshmi Narayanan',
    dayIso(-332),
    nowIso,
  )
  insDep.run(
    'dep-k-3',
    'DEP-KAV-003',
    'con-k-3',
    'individual_owner',
    null,
    'io-k-1',
    'Ramesh Babu M',
    'v-ki1',
    'TN58IO7721',
    'refundable_security_deposit',
    30000,
    30000,
    0,
    0,
    0,
    dayIso(-130),
    'IMPS-SBI-41022',
    'imps',
    'Ramesh Babu M',
    1,
    'Returned upon closure of Madurai attachment.',
    dayIso(230),
    'DEP-RCPT-003',
    'active',
    'Lakshmi Narayanan',
    'Karthikeyan R',
    dayIso(-130),
    nowIso,
  )

  // Contract Payments (historical paid v1 + current active v2 + overdue/upcoming)
  const insPay = db.prepare(`
    INSERT INTO contract_payments (
      id, organization_id, transaction_code, contract_id, contract_version, supplier_type,
      fleet_partner_id, individual_owner_id, supplier_name, vehicle_id, vehicle_registration,
      payment_kind, billing_period, due_date, payment_amount_inr, paid_amount_inr, outstanding_amount_inr,
      payment_method, payment_reference, receipt_ref, status, reconciliation_notes,
      recorded_by, approved_by, approved_at, reconciled_by, reconciled_at, created_at, updated_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  // Historical payment preserved at v1 ₹64,000 before amendment v2 ₹68,000!
  insPay.run(
    'cp-k-1',
    'CPAY-2026-001',
    'con-k-1',
    1,
    'fleet_partner',
    'fp-k-1',
    null,
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'v-kc1',
    'TN09CR4410',
    'monthly_rental',
    'Sep 2026 (v1 Rate)',
    dayIso(-60),
    64000,
    64000,
    0,
    'neft',
    'NEFT-KAV-20260905',
    'RCPT-SMFC-09',
    'reconciled',
    'Matched with bank statement; preserved under Contract v1.',
    'Lakshmi Narayanan',
    'Karthikeyan R',
    dayIso(-59),
    'Lakshmi Narayanan',
    dayIso(-58),
    dayIso(-62),
    dayIso(-58),
  )
  insPay.run(
    'cp-k-2',
    'CPAY-2026-002',
    'con-k-1',
    2,
    'fleet_partner',
    'fp-k-1',
    null,
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'v-kc1',
    'TN09CR4410',
    'monthly_rental',
    'Oct 2026 (v2 Rate)',
    dayIso(-30),
    68000,
    68000,
    0,
    'neft',
    'NEFT-KAV-20261005',
    'RCPT-SMFC-10',
    'paid',
    'Paid at amended v2 rate Rs 68,000.',
    'Lakshmi Narayanan',
    'Karthikeyan R',
    dayIso(-29),
    null,
    null,
    dayIso(-32),
    dayIso(-29),
  )
  insPay.run(
    'cp-k-3',
    'CPAY-2026-003',
    'con-k-1',
    2,
    'fleet_partner',
    'fp-k-1',
    null,
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'v-kc1',
    'TN09CR4410',
    'monthly_rental',
    'Nov 2026',
    dayIso(4),
    68000,
    30000,
    38000,
    'neft',
    'PART-NEFT-1102',
    null,
    'partially_paid',
    'Part settlement Rs 30,000 released; balance Rs 38,000 scheduled.',
    'Lakshmi Narayanan',
    'Karthikeyan R',
    dayIso(-1),
    null,
    null,
    dayIso(-3),
    nowIso,
  )
  insPay.run(
    'cp-k-4',
    'CPAY-2026-004',
    'con-k-2',
    1,
    'fleet_partner',
    'fp-k-2',
    null,
    'Cauvery Heavy Haulage LLP',
    'v-kc2',
    'TN11CR8820',
    'per_km',
    'Oct 2026 Linehaul',
    dayIso(-4),
    94200,
    0,
    94200,
    'rtgs',
    'PENDING-CHH-10',
    null,
    'overdue',
    'Awaiting e-POD toll bill cross-check prior to RTGS release.',
    'Lakshmi Narayanan',
    null,
    null,
    null,
    null,
    dayIso(-10),
    nowIso,
  )
  insPay.run(
    'cp-k-5',
    'CPAY-2026-005',
    'con-k-3',
    1,
    'individual_owner',
    null,
    'io-k-1',
    'Ramesh Babu M',
    'v-ki1',
    'TN58IO7721',
    'monthly_rental',
    'Oct 2026',
    dayIso(-20),
    52000,
    52000,
    0,
    'imps',
    'IMPS-RB-202610',
    'RCPT-RB-10',
    'reconciled',
    'Reconciled with owner acknowledgment.',
    'Lakshmi Narayanan',
    'Karthikeyan R',
    dayIso(-19),
    'Lakshmi Narayanan',
    dayIso(-18),
    dayIso(-22),
    dayIso(-18),
  )

  // Initial Vehicle Handovers
  const insHandover = db.prepare(`
    INSERT INTO vehicle_handovers (
      id, organization_id, handover_code, contract_id, vehicle_id, vehicle_registration,
      supplier_type, supplier_name, record_type, linked_initial_handover_id, handover_datetime,
      odometer_km, fuel_level_pct, exterior_condition, interior_condition, tyre_condition,
      existing_damages, accessories_checklist_json, equipment_checklist_json, document_checklist_json,
      photos_json, handover_notes, supplier_representative, receiving_representative,
      supplier_ack_name, receiving_ack_name, new_damages, missing_equipment,
      pending_repairs_inr, outstanding_expenses_inr, recommended_deduction_inr, created_by, created_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 0, 0, ?, ?)
  `)
  insHandover.run(
    'ho-k-1',
    'HO-KAV-001',
    'con-k-1',
    'v-kc1',
    'TN09CR4410',
    'fleet_partner',
    'Sri Murugan Fleet Carriers Pvt Ltd',
    'initial_handover',
    null,
    `${dayIso(-170)}T09:30:00Z`,
    32400,
    85,
    'good',
    'good',
    'good',
    'Minor scratch on rear left mudguard noted at gate.',
    JSON.stringify(['Spare Wheel', 'Hydraulic Jack', 'Warning Triangle', 'First Aid Kit', 'Wheel Spanner']),
    JSON.stringify(['GPS Mount', 'Fastag', 'Fire Extinguisher', 'Tarpaulin Sheet']),
    JSON.stringify(['RC Book', 'Comprehensive Insurance', 'National Permit', 'Fitness Certificate', 'PUC']),
    JSON.stringify([{ label: 'Front 3/4 Handover Photo', ref: 'cam-kc1-front.jpg', uploadedAt: dayIso(-170) }]),
    'Joint gate inspection passed at Chennai Ambattur hub.',
    'S. Muruganandam',
    'Priya Sundar',
    'S. Muruganandam',
    'Priya Sundar',
    'Priya Sundar',
    dayIso(-170),
  )
  insHandover.run(
    'ho-k-2',
    'HO-KAV-002',
    'con-k-2',
    'v-kc2',
    'TN11CR8820',
    'fleet_partner',
    'Cauvery Heavy Haulage LLP',
    'initial_handover',
    null,
    `${dayIso(-335)}T10:15:00Z`,
    68200,
    90,
    'good',
    'fair',
    'good',
    'Tailgate hinge repainted prior to delivery.',
    JSON.stringify(['Spare Wheel', 'Heavy Jack', 'Wheel Chocks', 'First Aid Kit']),
    JSON.stringify(['GPS Mount', 'Fastag', 'Reflective Tape']),
    JSON.stringify(['RC Book', 'Insurance Policy', 'State Permit', 'Fitness Certificate']),
    JSON.stringify([{ label: 'Coimbatore Gate Check Photo', ref: 'cam-kc2-side.jpg', uploadedAt: dayIso(-335) }]),
    'Handed over for Coimbatore-Salem heavy freight corridor.',
    'Prakash Velusamy',
    'Priya Sundar',
    'Prakash Velusamy',
    'Priya Sundar',
    'Priya Sundar',
    dayIso(-335),
  )
  insHandover.run(
    'ho-k-3',
    'HO-KAV-003',
    'con-k-3',
    'v-ki1',
    'TN58IO7721',
    'individual_owner',
    'Ramesh Babu M',
    'initial_handover',
    null,
    `${dayIso(-135)}T11:00:00Z`,
    26100,
    75,
    'excellent',
    'excellent',
    'good',
    'No pre-existing body defects.',
    JSON.stringify(['Spare Wheel', 'Jack', 'First Aid Kit', 'Tool Kit']),
    JSON.stringify(['GPS Mount', 'Fastag']),
    JSON.stringify(['RC Book', 'Insurance Policy', 'Owner PAN Copy', 'PUC']),
    JSON.stringify([]),
    'Verified individual owner attachment at Madurai hub.',
    'Ramesh Babu M',
    'Priya Sundar',
    'Ramesh Babu M',
    'Priya Sundar',
    'Priya Sundar',
    dayIso(-135),
  )

  // Contract Documents
  const insDoc = db.prepare(`
    INSERT INTO contract_documents (
      id, organization_id, entity_type, entity_id, contract_id, category, title, file_name,
      mime_type, file_size_bytes, storage_key, expiry_date, verification_status, restricted_access, uploaded_by, uploaded_at
    ) VALUES (?, 'org-kaveri', ?, ?, ?, ?, ?, ?, 'application/pdf', 248120, ?, ?, ?, ?, ?, ?)
  `)
  insDoc.run('cdoc-k-1', 'contract', 'con-k-1', 'con-k-1', 'Signed Master Agreement', 'Master Rental Agreement — Sri Murugan Carriers', 'smfc-master-agreement-2026.pdf', 'seed-smfc-master.pdf', dayIso(195), 'verified', 0, 'Karthikeyan R', dayIso(-170))
  insDoc.run('cdoc-k-2', 'amendment', 'amd-k-1', 'con-k-1', 'Signed Amendment Addendum', 'Q3 Rate & Shared Repair Addendum (AMD-KAV-001)', 'smfc-amd-001-signed.pdf', 'seed-amd-001.pdf', dayIso(195), 'verified', 0, 'Priya Sundar', dayIso(-46))
  insDoc.run('cdoc-k-3', 'individual_owner', 'io-k-1', 'con-k-3', 'Identity & Bank KYC', 'Ramesh Babu Owner KYC & Cancelled Cheque', 'ramesh-kyc-bundle.pdf', 'seed-ramesh-kyc.pdf', null, 'verified', 1, 'Lakshmi Narayanan', dayIso(-135))
  insDoc.run('cdoc-k-4', 'deposit', 'dep-k-2', 'con-k-2', 'Performance Bond Receipt', 'Cauvery Haulage Rs 75,000 Performance Bond Certificate', 'cauvery-bond-cert.pdf', 'seed-cauvery-bond.pdf', dayIso(18), 'verified', 1, 'Lakshmi Narayanan', dayIso(-332))

  // Contract History
  const kaveriActor: ContractActor = { userId: 'u-k1', fullName: 'Karthikeyan R', role: 'org_admin' }
  appendContractHistory(db, {
    organizationId: 'org-kaveri',
    contractId: 'con-k-1',
    entityType: 'contract',
    entityId: 'con-k-1',
    action: 'CONTRACT_ACTIVATED',
    actor: kaveriActor,
    summary: 'Signed & activated CON-KAV-2026-001 with Sri Murugan Fleet Carriers Pvt Ltd (TN09CR4410).',
  })
  appendContractHistory(db, {
    organizationId: 'org-kaveri',
    contractId: 'con-k-1',
    entityType: 'amendment',
    entityId: 'amd-k-1',
    action: 'AMENDMENT_EFFECTIVE',
    actor: kaveriActor,
    summary: 'Approved AMD-KAV-001 updating monthly rental from Rs 64,000 to Rs 68,000 (v2) while keeping historical v1 receipts intact.',
  })
  appendContractHistory(db, {
    organizationId: 'org-kaveri',
    contractId: 'con-k-1',
    entityType: 'maintenance_allocation',
    entityId: 'cma-k-1',
    action: 'MAINTENANCE_SPLIT_APPROVED',
    actor: kaveriActor,
    summary: 'Allocated Rs 18,000 repair on TN09CR4410 cleanly as Rs 10,800 Operating Org / Rs 7,200 Supplier.',
  })
}

// =========================================================================
// Mappers + Masking by Role/Permission
// =========================================================================

function mapPartner(r: Record<string, unknown>, revealSensitive: boolean): FleetPartner {
  const last4 = String(r.bank_account_last4 || '0000')
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    partnerCode: String(r.partner_code),
    companyName: String(r.company_name),
    businessRegistrationNo: String(r.business_registration_no),
    gstin: String(r.gstin),
    contactPerson: String(r.contact_person),
    mobile: String(r.mobile),
    email: String(r.email),
    registeredAddress: String(r.registered_address),
    operatingLocation: String(r.operating_location),
    bankAccountHolder: revealSensitive ? String(r.bank_account_holder) : 'Authorized Finance Only',
    bankName: String(r.bank_name),
    bankAccountNumberMasked: String(r.bank_account_number_masked),
    bankAccountLast4: last4,
    ifscCode: revealSensitive ? String(r.ifsc_code) : `${String(r.ifsc_code).slice(0, 4)}XXXX`,
    status: String(r.status) as FleetPartner['status'],
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    archived: Number(r.archived) === 1,
  }
}

function mapOwner(r: Record<string, unknown>, revealSensitive: boolean): IndividualVehicleOwner {
  const last4 = String(r.bank_account_last4 || '0000')
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    ownerCode: String(r.owner_code),
    fullName: String(r.full_name),
    mobile: String(r.mobile),
    email: String(r.email),
    address: String(r.address),
    identityVerificationStatus: String(r.identity_verification_status) as IndividualVehicleOwner['identityVerificationStatus'],
    panMasked: revealSensitive ? String(r.pan_masked) : 'XXXXXXXXXX',
    aadhaarMasked: revealSensitive ? String(r.aadhaar_masked) : 'XXXX-XXXX-XXXX',
    bankAccountHolder: revealSensitive ? String(r.bank_account_holder) : 'Authorized Finance Only',
    bankName: String(r.bank_name),
    bankAccountNumberMasked: String(r.bank_account_number_masked),
    bankAccountLast4: last4,
    ifscCode: revealSensitive ? String(r.ifsc_code) : `${String(r.ifsc_code).slice(0, 4)}XXXX`,
    paymentPreference: String(r.payment_preference) as IndividualVehicleOwner['paymentPreference'],
    status: String(r.status) as IndividualVehicleOwner['status'],
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    archived: Number(r.archived) === 1,
  }
}

function mapContract(r: Record<string, unknown>): VehicleContract {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractCode: String(r.contract_code),
    contractName: String(r.contract_name),
    contractCategory: String(r.contract_category) as VehicleContract['contractCategory'],
    supplierType: String(r.supplier_type) as VehicleContract['supplierType'],
    fleetPartnerId: r.fleet_partner_id ? String(r.fleet_partner_id) : null,
    individualOwnerId: r.individual_owner_id ? String(r.individual_owner_id) : null,
    supplierName: String(r.supplier_name),
    agreementRefNumber: String(r.agreement_ref_number),
    agreementDate: String(r.agreement_date),
    startDate: String(r.start_date),
    expiryDate: String(r.expiry_date),
    durationMonths: Number(r.duration_months),
    currency: String(r.currency || 'INR'),
    status: String(r.status) as ContractStatus,
    currentVersion: Number(r.current_version || 1),
    description: String(r.description || ''),
    financialTerms: parseJson<ContractFinancialTerms>(r.financial_terms_json, {} as ContractFinancialTerms),
    contractConditions: parseJson<ContractConditions>(r.contract_conditions_json, {} as ContractConditions),
    closureExceptionNote: r.closure_exception_note ? String(r.closure_exception_note) : null,
    createdBy: String(r.created_by),
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    archived: Number(r.archived) === 1,
  }
}

export function getOrgPermissionRules(db: DatabaseSync, orgId: string): ContractPermissionRule[] {
  const rows = db.prepare('SELECT * FROM contract_permissions WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  return rows.map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    role: String(r.role) as OrganizationRole,
    permissionKey: String(r.permission_key) as ContractPermissionKey,
    allowed: Number(r.allowed) === 1,
    updatedBy: String(r.updated_by),
    updatedAt: String(r.updated_at),
  }))
}

export function assertOrgContractPermission(
  db: DatabaseSync,
  orgId: string,
  role: OrganizationRole,
  permission: ContractPermissionKey,
): void {
  const rules = getOrgPermissionRules(db, orgId)
  if (!hasContractPermission(role, permission, rules)) {
    throw new Error(`Role "${role.replace(/_/g, ' ')}" lacks contract permission "${permission}".`)
  }
}

export function getContractsWorkspace(
  db: DatabaseSync,
  orgId: string,
  role: OrganizationRole,
): ContractsWorkspacePayload {
  const permissions = getOrgPermissionRules(db, orgId)
  const effectivePermissions = resolveEffectiveContractPermissions(role, permissions)
  const revealSensitive = canRevealSensitiveSupplierDetails(role, permissions)

  const partners = (db.prepare('SELECT * FROM fleet_partners WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) =>
    mapPartner(r, revealSensitive),
  )
  const owners = (db.prepare('SELECT * FROM individual_vehicle_owners WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) =>
    mapOwner(r, revealSensitive),
  )
  const ownershipRecords: VehicleOwnershipRecord[] = (db.prepare('SELECT * FROM vehicle_ownership WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    vehicleId: String(r.vehicle_id),
    ownershipCategory: String(r.ownership_category) as VehicleOwnershipCategory,
    legalOwnerName: String(r.legal_owner_name),
    fleetPartnerId: r.fleet_partner_id ? String(r.fleet_partner_id) : null,
    individualOwnerId: r.individual_owner_id ? String(r.individual_owner_id) : null,
    ownershipProofRef: String(r.ownership_proof_ref || ''),
    effectiveFrom: String(r.effective_from),
    effectiveTo: r.effective_to ? String(r.effective_to) : null,
    notes: r.notes ? String(r.notes) : undefined,
    updatedAt: String(r.updated_at),
  }))

  const contracts = (db.prepare('SELECT * FROM vehicle_contracts WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map(mapContract)

  const contractVehicles: ContractVehicleLink[] = (db.prepare('SELECT * FROM vehicle_contract_vehicles WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractId: String(r.contract_id),
    vehicleId: String(r.vehicle_id),
    vehicleRegistration: String(r.vehicle_registration),
    ownershipCategory: String(r.ownership_category) as VehicleOwnershipCategory,
    agreedMonthlyRental: Number(r.agreed_monthly_rental),
    agreedPerKmRate: Number(r.agreed_per_km_rate),
    agreedPerTripRate: Number(r.agreed_per_trip_rate),
    revenueSharePct: Number(r.revenue_share_pct),
    fixedComponent: Number(r.fixed_component),
    variableRateNote: String(r.variable_rate_note || ''),
    maintenanceResponsibility: String(r.maintenance_responsibility) as ResponsibilityParty,
    fuelResponsibility: String(r.fuel_responsibility) as ResponsibilityParty,
    insuranceResponsibility: String(r.insurance_responsibility) as ResponsibilityParty,
    vehicleConditionNote: String(r.vehicle_condition_note || ''),
    initialOdometerKm: Number(r.initial_odometer_km),
    handoverDate: String(r.handover_date),
    returnDate: r.return_date ? String(r.return_date) : null,
    vehicleContractStatus: String(r.vehicle_contract_status) as ContractVehicleLink['vehicleContractStatus'],
    overlappingAuthNote: r.overlapping_auth_note ? String(r.overlapping_auth_note) : null,
    createdAt: String(r.created_at),
  }))

  const versions: ContractVersion[] = (db.prepare('SELECT * FROM contract_versions WHERE organization_id = ? ORDER BY version_number DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractId: String(r.contract_id),
    versionNumber: Number(r.version_number),
    effectiveDate: String(r.effective_date),
    financialTerms: parseJson<ContractFinancialTerms>(r.financial_terms_json, {} as ContractFinancialTerms),
    contractConditions: parseJson<ContractConditions>(r.contract_conditions_json, {} as ContractConditions),
    expiryDate: String(r.expiry_date),
    durationMonths: Number(r.duration_months),
    createdBy: String(r.created_by),
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    createdAt: String(r.created_at),
    notes: String(r.notes || ''),
  }))

  const amendments: ContractAmendment[] = (db.prepare('SELECT * FROM contract_amendments WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    amendmentCode: String(r.amendment_code),
    contractId: String(r.contract_id),
    title: String(r.title),
    reason: String(r.reason),
    amendmentType: String(r.amendment_type) as ContractAmendment['amendmentType'],
    previousValues: parseJson<Record<string, unknown>>(r.previous_values_json, {}),
    revisedValues: parseJson<Record<string, unknown>>(r.revised_values_json, {}),
    effectiveDate: String(r.effective_date),
    recalculateFutureSchedule: Number(r.recalculate_future_schedule) === 1,
    recalculationConfirmed: Number(r.recalculation_confirmed) === 1,
    supportingDocId: r.supporting_doc_id ? String(r.supporting_doc_id) : null,
    approvalStatus: String(r.approval_status) as AmendmentApprovalStatus,
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
  }))

  const maintenanceRules: ContractMaintenanceRule[] = (db.prepare('SELECT * FROM contract_maintenance_rules WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractId: String(r.contract_id),
    vehicleId: r.vehicle_id ? String(r.vehicle_id) : null,
    maintenanceCategory: String(r.maintenance_category) as ContractMaintenanceRule['maintenanceCategory'],
    customCategoryLabel: r.custom_category_label ? String(r.custom_category_label) : undefined,
    responsibleParty: String(r.responsible_party) as ResponsibilityParty,
    orgSharePct: Number(r.org_share_pct),
    supplierSharePct: Number(r.supplier_share_pct),
    thresholdAmountInr: Number(r.threshold_amount_inr),
    circumstance: String(r.circumstance) as ContractMaintenanceRule['circumstance'],
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
  }))

  const maintenanceAllocations: ContractMaintenanceAllocation[] = (db.prepare('SELECT * FROM contract_maintenance_allocations WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractId: String(r.contract_id),
    vehicleId: String(r.vehicle_id),
    vehicleRegistration: String(r.vehicle_registration),
    maintenanceRecordId: r.maintenance_record_id ? String(r.maintenance_record_id) : null,
    workOrderId: r.work_order_id ? String(r.work_order_id) : null,
    maintenanceCategory: String(r.maintenance_category) as ContractMaintenanceAllocation['maintenanceCategory'],
    description: String(r.description),
    totalRepairAmountInr: Number(r.total_repair_amount_inr),
    orgShareInr: Number(r.org_share_inr),
    supplierShareInr: Number(r.supplier_share_inr),
    responsibleParty: String(r.responsible_party) as ResponsibilityParty,
    settlementStatus: String(r.settlement_status) as ContractMaintenanceAllocation['settlementStatus'],
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    settlementPaymentId: r.settlement_payment_id ? String(r.settlement_payment_id) : null,
    notes: String(r.notes || ''),
    createdAt: String(r.created_at),
  }))

  const deposits: ContractBondDeposit[] = (db.prepare('SELECT * FROM contract_bonds_deposits WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    depositCode: String(r.deposit_code),
    contractId: String(r.contract_id),
    supplierType: String(r.supplier_type) as ContractBondDeposit['supplierType'],
    fleetPartnerId: r.fleet_partner_id ? String(r.fleet_partner_id) : null,
    individualOwnerId: r.individual_owner_id ? String(r.individual_owner_id) : null,
    supplierName: String(r.supplier_name),
    vehicleId: r.vehicle_id ? String(r.vehicle_id) : null,
    vehicleGroupLabel: String(r.vehicle_group_label),
    depositType: String(r.deposit_type) as ContractBondDeposit['depositType'],
    requiredAmountInr: Number(r.required_amount_inr),
    paidAmountInr: Number(r.paid_amount_inr),
    outstandingAmountInr: Number(r.outstanding_amount_inr),
    deductedAmountInr: Number(r.deducted_amount_inr),
    refundedAmountInr: Number(r.refunded_amount_inr),
    paymentDate: r.payment_date ? String(r.payment_date) : null,
    paymentReference: r.payment_reference ? String(r.payment_reference) : null,
    paymentMethod: r.payment_method ? String(r.payment_method) : null,
    receivingParty: String(r.receiving_party),
    isRefundable: Number(r.is_refundable) === 1,
    refundConditions: String(r.refund_conditions || ''),
    expiryDate: r.expiry_date ? String(r.expiry_date) : null,
    documentRef: r.document_ref ? String(r.document_ref) : null,
    status: String(r.status) as DepositStatus,
    createdBy: String(r.created_by),
    verifiedBy: r.verified_by ? String(r.verified_by) : null,
    refundApprovedBy: r.refund_approved_by ? String(r.refund_approved_by) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }))

  const deductions: ContractDepositDeduction[] = (db.prepare('SELECT * FROM contract_deposit_deductions WHERE organization_id = ? ORDER BY authorized_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    depositId: String(r.deposit_id),
    contractId: String(r.contract_id),
    vehicleId: r.vehicle_id ? String(r.vehicle_id) : null,
    amountInr: Number(r.amount_inr),
    reason: String(r.reason),
    evidenceRef: String(r.evidence_ref || ''),
    authorizedBy: String(r.authorized_by),
    authorizedAt: String(r.authorized_at),
    handoverReturnId: r.handover_return_id ? String(r.handover_return_id) : null,
  }))

  const payments: ContractPayment[] = (db.prepare('SELECT * FROM contract_payments WHERE organization_id = ? ORDER BY due_date DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    transactionCode: String(r.transaction_code),
    contractId: String(r.contract_id),
    contractVersion: Number(r.contract_version || 1),
    supplierType: String(r.supplier_type) as ContractPayment['supplierType'],
    fleetPartnerId: r.fleet_partner_id ? String(r.fleet_partner_id) : null,
    individualOwnerId: r.individual_owner_id ? String(r.individual_owner_id) : null,
    supplierName: String(r.supplier_name),
    vehicleId: r.vehicle_id ? String(r.vehicle_id) : null,
    vehicleRegistration: r.vehicle_registration ? String(r.vehicle_registration) : null,
    paymentKind: String(r.payment_kind) as ContractPayment['paymentKind'],
    billingPeriod: String(r.billing_period),
    dueDate: String(r.due_date),
    paymentAmountInr: Number(r.payment_amount_inr),
    paidAmountInr: Number(r.paid_amount_inr),
    outstandingAmountInr: Number(r.outstanding_amount_inr),
    paymentMethod: String(r.payment_method) as ContractPayment['paymentMethod'],
    paymentReference: String(r.payment_reference),
    receiptRef: r.receipt_ref ? String(r.receipt_ref) : null,
    status: String(r.status) as ContractPayment['status'],
    reconciliationNotes: r.reconciliation_notes ? String(r.reconciliation_notes) : null,
    recordedBy: String(r.recorded_by),
    approvedBy: r.approved_by ? String(r.approved_by) : null,
    approvedAt: r.approved_at ? String(r.approved_at) : null,
    reconciledBy: r.reconciled_by ? String(r.reconciled_by) : null,
    reconciledAt: r.reconciled_at ? String(r.reconciled_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }))

  const handovers: VehicleHandoverRecord[] = (db.prepare('SELECT * FROM vehicle_handovers WHERE organization_id = ? ORDER BY handover_datetime DESC').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    handoverCode: String(r.handover_code),
    contractId: String(r.contract_id),
    vehicleId: String(r.vehicle_id),
    vehicleRegistration: String(r.vehicle_registration),
    supplierType: String(r.supplier_type) as VehicleHandoverRecord['supplierType'],
    supplierName: String(r.supplier_name),
    recordType: String(r.record_type) as VehicleHandoverRecord['recordType'],
    linkedInitialHandoverId: r.linked_initial_handover_id ? String(r.linked_initial_handover_id) : null,
    handoverDatetime: String(r.handover_datetime),
    odometerKm: Number(r.odometer_km),
    fuelLevelPct: Number(r.fuel_level_pct),
    exteriorCondition: String(r.exterior_condition) as VehicleHandoverRecord['exteriorCondition'],
    interiorCondition: String(r.interior_condition) as VehicleHandoverRecord['interiorCondition'],
    tyreCondition: String(r.tyre_condition) as VehicleHandoverRecord['tyreCondition'],
    existingDamages: String(r.existing_damages || ''),
    accessoriesChecklist: parseJson<string[]>(r.accessories_checklist_json, []),
    equipmentChecklist: parseJson<string[]>(r.equipment_checklist_json, []),
    documentChecklist: parseJson<string[]>(r.document_checklist_json, []),
    photos: parseJson<VehicleHandoverRecord['photos']>(r.photos_json, []),
    handoverNotes: String(r.handover_notes || ''),
    supplierRepresentative: String(r.supplier_representative),
    receivingRepresentative: String(r.receiving_representative),
    supplierAckName: String(r.supplier_ack_name),
    receivingAckName: String(r.receiving_ack_name),
    newDamages: r.new_damages ? String(r.new_damages) : undefined,
    missingEquipment: r.missing_equipment ? String(r.missing_equipment) : undefined,
    pendingRepairsInr: Number(r.pending_repairs_inr || 0),
    outstandingExpensesInr: Number(r.outstanding_expenses_inr || 0),
    recommendedDeductionInr: Number(r.recommended_deduction_inr || 0),
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
  }))

  const documents: ContractDocumentItem[] = (db.prepare('SELECT * FROM contract_documents WHERE organization_id = ? ORDER BY uploaded_at DESC').all(orgId) as Array<Record<string, unknown>>)
    .filter((r) => !(Number(r.restricted_access) === 1 && !revealSensitive && role === 'viewer'))
    .map((r) => ({
      id: String(r.id),
      organizationId: String(r.organization_id),
      entityType: String(r.entity_type) as ContractDocumentItem['entityType'],
      entityId: String(r.entity_id),
      contractId: r.contract_id ? String(r.contract_id) : null,
      category: String(r.category),
      title: String(r.title),
      fileName: String(r.file_name),
      mimeType: String(r.mime_type),
      fileSizeBytes: Number(r.file_size_bytes),
      storageKey: String(r.storage_key),
      expiryDate: r.expiry_date ? String(r.expiry_date) : null,
      verificationStatus: String(r.verification_status) as ContractDocumentItem['verificationStatus'],
      restrictedAccess: Number(r.restricted_access) === 1,
      uploadedBy: String(r.uploaded_by),
      uploadedAt: String(r.uploaded_at),
    }))

  const history: ContractHistoryEntry[] = (db.prepare('SELECT * FROM contract_history WHERE organization_id = ? ORDER BY timestamp DESC LIMIT 200').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractId: r.contract_id ? String(r.contract_id) : null,
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    action: String(r.action),
    actorUserId: String(r.actor_user_id),
    actorName: String(r.actor_name),
    actorRole: String(r.actor_role) as OrganizationRole,
    summary: String(r.summary),
    beforeJson: r.before_json ? String(r.before_json) : null,
    afterJson: r.after_json ? String(r.after_json) : null,
    timestamp: String(r.timestamp),
  }))

  const alerts = generateContractAlerts({
    contracts,
    payments,
    deposits,
    amendments,
    links: contractVehicles,
    handovers,
  })

  return {
    partners,
    owners,
    ownershipRecords,
    contracts,
    contractVehicles,
    versions,
    amendments,
    maintenanceRules,
    maintenanceAllocations,
    deposits,
    deductions,
    payments,
    handovers,
    documents,
    history,
    permissions,
    alerts,
    effectivePermissions,
  }
}

// =========================================================================
// Transactional Mutations
// =========================================================================

export function upsertFleetPartner(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: Partial<FleetPartner> & { bankAccountNumber?: string },
): FleetPartner {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_suppliers')
  if (!input.companyName?.trim() || !input.gstin?.trim() || !input.mobile?.trim()) {
    throw new Error('Company name, GSTIN, and primary mobile are required for a Fleet Partner.')
  }
  const existingRows = db.prepare('SELECT * FROM fleet_partners WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  const existingPartners = existingRows.map((r) => mapPartner(r, true))
  const dup = detectDuplicatePartner(existingPartners, {
    id: input.id,
    companyName: input.companyName,
    gstin: input.gstin,
    businessRegistrationNo: input.businessRegistrationNo ?? '',
    mobile: input.mobile,
  })
  if (dup) throw new Error(dup)

  const nowIso = new Date().toISOString()
  const isUpdate = Boolean(input.id && existingPartners.some((p) => p.id === input.id))
  const id = isUpdate ? String(input.id) : `fp-${crypto.randomUUID().slice(0, 8)}`
  const existing = existingPartners.find((p) => p.id === id)
  const bankInfo = input.bankAccountNumber?.trim()
    ? maskBankAccount(input.bankAccountNumber)
    : {
        masked: existing?.bankAccountNumberMasked ?? 'XXXXXX0000',
        last4: existing?.bankAccountLast4 ?? '0000',
      }

  const code = existing?.partnerCode ?? `FP-${String(existingPartners.length + 1).padStart(3, '0')}`
  db.prepare(`
    INSERT OR REPLACE INTO fleet_partners (
      id, organization_id, partner_code, company_name, business_registration_no, gstin, contact_person,
      mobile, email, registered_address, operating_location, bank_account_holder, bank_name,
      bank_account_number_masked, bank_account_last4, ifsc_code, status, notes, created_at, updated_at, archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    orgId,
    code,
    input.companyName.trim(),
    (input.businessRegistrationNo ?? existing?.businessRegistrationNo ?? '').trim(),
    input.gstin.trim().toUpperCase(),
    (input.contactPerson ?? existing?.contactPerson ?? 'Partner Desk').trim(),
    input.mobile.trim(),
    (input.email ?? existing?.email ?? '').trim().toLowerCase(),
    (input.registeredAddress ?? existing?.registeredAddress ?? '').trim(),
    (input.operatingLocation ?? existing?.operatingLocation ?? '').trim(),
    (input.bankAccountHolder ?? existing?.bankAccountHolder ?? input.companyName).trim(),
    (input.bankName ?? existing?.bankName ?? 'Commercial Bank').trim(),
    bankInfo.masked,
    bankInfo.last4,
    (input.ifscCode ?? existing?.ifscCode ?? '').trim().toUpperCase(),
    input.status ?? existing?.status ?? 'active',
    (input.notes ?? existing?.notes ?? '').trim(),
    existing?.createdAt ?? nowIso,
    nowIso,
    input.archived ? 1 : 0,
  )

  appendContractHistory(db, {
    organizationId: orgId,
    entityType: 'fleet_partner',
    entityId: id,
    action: isUpdate ? 'PARTNER_UPDATED' : 'PARTNER_CREATED',
    actor,
    summary: `${isUpdate ? 'Updated' : 'Created'} Fleet Partner ${input.companyName.trim()} (${code}).`,
  })

  const row = db.prepare('SELECT * FROM fleet_partners WHERE id = ? AND organization_id = ?').get(id, orgId) as Record<string, unknown>
  return mapPartner(row, canRevealSensitiveSupplierDetails(actor.role, getOrgPermissionRules(db, orgId)))
}

export function upsertIndividualOwner(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: Partial<IndividualVehicleOwner> & { panNumber?: string; aadhaarNumber?: string; bankAccountNumber?: string },
): IndividualVehicleOwner {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_individual_owners')
  if (!input.fullName?.trim() || !input.mobile?.trim()) {
    throw new Error('Full name and mobile number are required for an Individual Vehicle Owner.')
  }
  const existingRows = db.prepare('SELECT * FROM individual_vehicle_owners WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  const existingOwners = existingRows.map((r) => mapOwner(r, true))
  const existing = input.id ? existingOwners.find((o) => o.id === input.id) : undefined

  const panMasked = input.panNumber?.trim()
    ? maskPanNumber(input.panNumber)
    : existing?.panMasked ?? input.panMasked ?? 'XXXXXXXXXX'
  const aadhaarMasked = input.aadhaarNumber?.trim()
    ? maskAadhaarNumber(input.aadhaarNumber)
    : existing?.aadhaarMasked ?? input.aadhaarMasked ?? 'XXXX-XXXX-XXXX'

  const dup = detectDuplicateIndividualOwner(existingOwners, {
    id: input.id,
    fullName: input.fullName,
    mobile: input.mobile,
    panMasked,
    aadhaarMasked,
  })
  if (dup) throw new Error(dup)

  const nowIso = new Date().toISOString()
  const isUpdate = Boolean(existing)
  const id = isUpdate ? existing!.id : `io-${crypto.randomUUID().slice(0, 8)}`
  const bankInfo = input.bankAccountNumber?.trim()
    ? maskBankAccount(input.bankAccountNumber)
    : {
        masked: existing?.bankAccountNumberMasked ?? 'XXXXXX0000',
        last4: existing?.bankAccountLast4 ?? '0000',
      }
  const code = existing?.ownerCode ?? `IO-${String(existingOwners.length + 1).padStart(3, '0')}`

  db.prepare(`
    INSERT OR REPLACE INTO individual_vehicle_owners (
      id, organization_id, owner_code, full_name, mobile, email, address, identity_verification_status,
      pan_masked, aadhaar_masked, bank_account_holder, bank_name, bank_account_number_masked, bank_account_last4,
      ifsc_code, payment_preference, status, notes, created_at, updated_at, archived
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    orgId,
    code,
    input.fullName.trim(),
    input.mobile.trim(),
    (input.email ?? existing?.email ?? '').trim().toLowerCase(),
    (input.address ?? existing?.address ?? '').trim(),
    input.identityVerificationStatus ?? existing?.identityVerificationStatus ?? 'pending',
    panMasked,
    aadhaarMasked,
    (input.bankAccountHolder ?? existing?.bankAccountHolder ?? input.fullName).trim(),
    (input.bankName ?? existing?.bankName ?? '').trim(),
    bankInfo.masked,
    bankInfo.last4,
    (input.ifscCode ?? existing?.ifscCode ?? '').trim().toUpperCase(),
    input.paymentPreference ?? existing?.paymentPreference ?? 'bank_transfer',
    input.status ?? existing?.status ?? 'active',
    (input.notes ?? existing?.notes ?? '').trim(),
    existing?.createdAt ?? nowIso,
    nowIso,
    input.archived ? 1 : 0,
  )

  appendContractHistory(db, {
    organizationId: orgId,
    entityType: 'individual_owner',
    entityId: id,
    action: isUpdate ? 'INDIVIDUAL_OWNER_UPDATED' : 'INDIVIDUAL_OWNER_CREATED',
    actor,
    summary: `${isUpdate ? 'Updated' : 'Created'} Individual Owner ${input.fullName.trim()} (${code}).`,
  })

  const row = db.prepare('SELECT * FROM individual_vehicle_owners WHERE id = ? AND organization_id = ?').get(id, orgId) as Record<string, unknown>
  return mapOwner(row, canRevealSensitiveSupplierDetails(actor.role, getOrgPermissionRules(db, orgId)))
}

export interface CreateContractInput {
  contractName: string
  contractCategory: VehicleContract['contractCategory']
  supplierType: VehicleContract['supplierType']
  fleetPartnerId?: string | null
  individualOwnerId?: string | null
  agreementRefNumber: string
  agreementDate: string
  startDate: string
  expiryDate: string
  durationMonths: number
  status?: ContractStatus
  description?: string
  financialTerms: ContractFinancialTerms
  contractConditions: ContractConditions
  vehicles: Array<{
    vehicleId: string
    agreedMonthlyRental?: number
    agreedPerKmRate?: number
    agreedPerTripRate?: number
    revenueSharePct?: number
    fixedComponent?: number
    variableRateNote?: string
    maintenanceResponsibility?: ResponsibilityParty
    fuelResponsibility?: ResponsibilityParty
    insuranceResponsibility?: ResponsibilityParty
    vehicleConditionNote?: string
    initialOdometerKm?: number
    overlappingAuthNote?: string
  }>
}

export function createVehicleContract(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: CreateContractInput,
): VehicleContract {
  assertOrgContractPermission(db, orgId, actor.role, 'create_contracts')
  if (!input.contractName?.trim() || !input.startDate || !input.expiryDate) {
    throw new Error('Contract name, start date, and expiry date are required.')
  }
  if (new Date(input.expiryDate).getTime() < new Date(input.startDate).getTime()) {
    throw new Error('Contract expiry date cannot be earlier than start date.')
  }

  let supplierName = ''
  if (input.supplierType === 'fleet_partner') {
    const fp = db
      .prepare('SELECT company_name FROM fleet_partners WHERE id = ? AND organization_id = ?')
      .get(input.fleetPartnerId ?? '', orgId) as { company_name?: string } | undefined
    if (!fp?.company_name) throw new Error('Select a valid Fleet Partner within this organization.')
    supplierName = fp.company_name
  } else {
    const io = db
      .prepare('SELECT full_name FROM individual_vehicle_owners WHERE id = ? AND organization_id = ?')
      .get(input.individualOwnerId ?? '', orgId) as { full_name?: string } | undefined
    if (!io?.full_name) throw new Error('Select a valid Individual Vehicle Owner within this organization.')
    supplierName = io.full_name
  }

  const targetStatus: ContractStatus = input.status === 'pending_approval' ? 'pending_approval' : 'draft'
  if (targetStatus === 'pending_approval') {
    assertOrgContractPermission(db, orgId, actor.role, 'submit_contracts')
  }

  const existingContracts = (db.prepare('SELECT * FROM vehicle_contracts WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map(mapContract)
  const existingLinks = (db.prepare('SELECT * FROM vehicle_contract_vehicles WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    contractId: String(r.contract_id),
    vehicleId: String(r.vehicle_id),
    vehicleRegistration: String(r.vehicle_registration),
    ownershipCategory: String(r.ownership_category) as VehicleOwnershipCategory,
    agreedMonthlyRental: Number(r.agreed_monthly_rental),
    agreedPerKmRate: Number(r.agreed_per_km_rate),
    agreedPerTripRate: Number(r.agreed_per_trip_rate),
    revenueSharePct: Number(r.revenue_share_pct),
    fixedComponent: Number(r.fixed_component),
    variableRateNote: String(r.variable_rate_note || ''),
    maintenanceResponsibility: String(r.maintenance_responsibility) as ResponsibilityParty,
    fuelResponsibility: String(r.fuel_responsibility) as ResponsibilityParty,
    insuranceResponsibility: String(r.insurance_responsibility) as ResponsibilityParty,
    vehicleConditionNote: String(r.vehicle_condition_note || ''),
    initialOdometerKm: Number(r.initial_odometer_km),
    handoverDate: String(r.handover_date),
    vehicleContractStatus: String(r.vehicle_contract_status) as ContractVehicleLink['vehicleContractStatus'],
    createdAt: String(r.created_at),
  }))

  // Check each attached vehicle exists in org and doesn't overlap without override
  const resolvedVehicles: Array<{
    row: Record<string, unknown>
    spec: CreateContractInput['vehicles'][number]
  }> = []

  for (const vSpec of input.vehicles || []) {
    const vehRow = db
      .prepare('SELECT * FROM fleet_vehicles WHERE id = ? AND organization_id = ?')
      .get(vSpec.vehicleId, orgId) as Record<string, unknown> | undefined
    if (!vehRow) {
      throw new Error(`Vehicle ${vSpec.vehicleId} does not belong to this organization.`)
    }
    const overlapErr = checkOverlappingVehicleContract({
      vehicleId: vSpec.vehicleId,
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      existingLinks,
      existingContracts,
      overrideNote: vSpec.overlappingAuthNote,
    })
    if (overlapErr) throw new Error(overlapErr)
    resolvedVehicles.push({ row: vehRow, spec: vSpec })
  }

  const nowIso = new Date().toISOString()
  const contractId = `con-${crypto.randomUUID().slice(0, 8)}`
  const contractCode = `CON-${new Date().getFullYear()}-${String(existingContracts.length + 1).padStart(3, '0')}`
  const expectedOwnership: VehicleOwnershipCategory =
    input.supplierType === 'fleet_partner' ? 'contracted_fleet' : 'individual_owner'

  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare(`
      INSERT INTO vehicle_contracts (
        id, organization_id, contract_code, contract_name, contract_category, supplier_type,
        fleet_partner_id, individual_owner_id, supplier_name, agreement_ref_number, agreement_date,
        start_date, expiry_date, duration_months, currency, status, current_version, description,
        financial_terms_json, contract_conditions_json, closure_exception_note, created_by, approved_by, approved_at,
        created_at, updated_at, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, 1, ?, ?, ?, NULL, ?, NULL, NULL, ?, ?, 0)
    `).run(
      contractId,
      orgId,
      contractCode,
      input.contractName.trim(),
      input.contractCategory,
      input.supplierType,
      input.fleetPartnerId ?? null,
      input.individualOwnerId ?? null,
      supplierName,
      input.agreementRefNumber.trim() || contractCode,
      input.agreementDate || nowIso.slice(0, 10),
      input.startDate,
      input.expiryDate,
      Math.max(1, Math.round(Number(input.durationMonths || 12))),
      targetStatus,
      (input.description ?? '').trim(),
      JSON.stringify(input.financialTerms),
      JSON.stringify(input.contractConditions),
      actor.fullName,
      nowIso,
      nowIso,
    )

    db.prepare(`
      INSERT INTO contract_versions (
        id, organization_id, contract_id, version_number, effective_date, financial_terms_json,
        contract_conditions_json, expiry_date, duration_months, created_by, approved_by, created_at, notes
      ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, 'Initial version')
    `).run(
      `cv-${crypto.randomUUID().slice(0, 8)}`,
      orgId,
      contractId,
      input.startDate,
      JSON.stringify(input.financialTerms),
      JSON.stringify(input.contractConditions),
      input.expiryDate,
      Math.max(1, Math.round(Number(input.durationMonths || 12))),
      actor.fullName,
      nowIso,
    )

    const insLink = db.prepare(`
      INSERT INTO vehicle_contract_vehicles (
        id, organization_id, contract_id, vehicle_id, vehicle_registration, ownership_category,
        agreed_monthly_rental, agreed_per_km_rate, agreed_per_trip_rate, revenue_share_pct, fixed_component,
        variable_rate_note, maintenance_responsibility, fuel_responsibility, insurance_responsibility,
        vehicle_condition_note, initial_odometer_km, handover_date, return_date, vehicle_contract_status,
        overlapping_auth_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `)

    for (const item of resolvedVehicles) {
      const reg = String(item.row.registration_number)
      insLink.run(
        `cvl-${crypto.randomUUID().slice(0, 8)}`,
        orgId,
        contractId,
        item.spec.vehicleId,
        reg,
        expectedOwnership,
        Number(item.spec.agreedMonthlyRental ?? input.financialTerms.monthlyRental ?? 0),
        Number(item.spec.agreedPerKmRate ?? input.financialTerms.perKmRate ?? 0),
        Number(item.spec.agreedPerTripRate ?? input.financialTerms.perTripRate ?? 0),
        Number(item.spec.revenueSharePct ?? input.financialTerms.revenueSharingPct ?? 0),
        Number(item.spec.fixedComponent ?? input.financialTerms.fixedComponent ?? 0),
        item.spec.variableRateNote ?? input.financialTerms.variableComponentDesc ?? '',
        item.spec.maintenanceResponsibility ?? input.contractConditions.maintenanceResponsibility,
        item.spec.fuelResponsibility ?? input.contractConditions.fuelResponsibility,
        item.spec.insuranceResponsibility ?? input.contractConditions.insuranceResponsibility,
        item.spec.vehicleConditionNote ?? 'Verified on agreement creation',
        Number(item.spec.initialOdometerKm ?? item.row.odometer_km ?? 0),
        input.startDate,
        targetStatus === 'draft' ? 'pending_handover' : 'active',
        item.spec.overlappingAuthNote ?? null,
        nowIso,
      )

      db.prepare(`
        UPDATE fleet_vehicles
        SET ownership_category = ?, legal_owner_name = ?, fleet_partner_id = ?, individual_owner_id = ?, active_contract_id = ?
        WHERE id = ? AND organization_id = ?
      `).run(
        expectedOwnership,
        supplierName,
        input.fleetPartnerId ?? null,
        input.individualOwnerId ?? null,
        contractId,
        item.spec.vehicleId,
        orgId,
      )
    }

    appendContractHistory(db, {
      organizationId: orgId,
      contractId,
      entityType: 'contract',
      entityId: contractId,
      action: 'CONTRACT_CREATED',
      actor,
      summary: `Created ${contractCode} (${input.contractName.trim()}) with ${resolvedVehicles.length} linked vehicle(s) in ${targetStatus} state.`,
    })

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  const row = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ?').get(contractId) as Record<string, unknown>
  return mapContract(row)
}

export function transitionContractStatus(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  contractId: string,
  nextStatus: ContractStatus,
  reason?: string,
  closureExceptionNote?: string,
): VehicleContract {
  const row = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Contract not found in this organization.')
  const current = mapContract(row)

  if (nextStatus === 'pending_approval') {
    assertOrgContractPermission(db, orgId, actor.role, 'submit_contracts')
  } else if (nextStatus === 'active' || nextStatus === 'awaiting_handover') {
    if (current.status === 'pending_approval') {
      assertOrgContractPermission(db, orgId, actor.role, 'approve_contracts')
    } else if (current.status === 'draft') {
      assertOrgContractPermission(db, orgId, actor.role, 'approve_contracts')
    } else {
      assertOrgContractPermission(db, orgId, actor.role, 'edit_contracts')
    }
  } else if (nextStatus === 'terminated' || nextStatus === 'termination_requested' || nextStatus === 'closed') {
    if (current.status === 'pending_approval' && nextStatus === 'terminated') {
      assertOrgContractPermission(db, orgId, actor.role, 'reject_contracts')
    } else {
      assertOrgContractPermission(db, orgId, actor.role, 'terminate_contracts')
    }
  } else if (nextStatus === 'renewal_pending') {
    assertOrgContractPermission(db, orgId, actor.role, 'renew_contracts')
  } else {
    assertOrgContractPermission(db, orgId, actor.role, 'edit_contracts')
  }

  if (!isValidContractTransition(current.status, nextStatus)) {
    throw new Error(`Invalid contract transition from "${current.status}" to "${nextStatus}".`)
  }

  if (nextStatus === 'closed') {
    const ws = getContractsWorkspace(db, orgId, actor.role)
    const candidateContract: VehicleContract = {
      ...current,
      closureExceptionNote: closureExceptionNote ?? current.closureExceptionNote,
    }
    const check = canCloseContract({
      contract: candidateContract,
      payments: ws.payments,
      deposits: ws.deposits,
      handovers: ws.handovers,
      links: ws.contractVehicles,
    })
    if (!check.allowed) {
      throw new Error(`Cannot close contract yet: ${check.blockers.join(' ')} Provide an authorized exception note if closing early.`)
    }
  }

  const nowIso = new Date().toISOString()
  const approvedBy =
    current.status === 'pending_approval' && (nextStatus === 'active' || nextStatus === 'awaiting_handover')
      ? actor.fullName
      : current.approvedBy ?? null
  const approvedAt =
    current.status === 'pending_approval' && (nextStatus === 'active' || nextStatus === 'awaiting_handover')
      ? nowIso
      : current.approvedAt ?? null

  db.prepare(`
    UPDATE vehicle_contracts
    SET status = ?, approved_by = ?, approved_at = ?, closure_exception_note = ?, updated_at = ?
    WHERE id = ? AND organization_id = ?
  `).run(
    nextStatus,
    approvedBy,
    approvedAt,
    closureExceptionNote ?? current.closureExceptionNote ?? null,
    nowIso,
    contractId,
    orgId,
  )

  appendContractHistory(db, {
    organizationId: orgId,
    contractId,
    entityType: 'contract',
    entityId: contractId,
    action: `CONTRACT_STATUS_${nextStatus.toUpperCase()}`,
    actor,
    summary: `Transitioned ${current.contractCode} from ${current.status} to ${nextStatus}${reason ? ` (${reason})` : ''}.`,
  })

  const updated = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ?').get(contractId) as Record<string, unknown>
  return mapContract(updated)
}

export function createContractAmendment(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: {
    contractId: string
    title: string
    reason: string
    amendmentType: ContractAmendment['amendmentType']
    revisedValues: Record<string, unknown>
    effectiveDate: string
    recalculateFutureSchedule?: boolean
    submitImmediately?: boolean
  },
): ContractAmendment {
  assertOrgContractPermission(db, orgId, actor.role, 'create_amendments')
  const row = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(input.contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Contract not found.')
  const contract = mapContract(row)
  if (!input.title.trim() || !input.reason.trim() || !input.effectiveDate) {
    throw new Error('Amendment title, reason, and effective date are required.')
  }

  const previousValues: Record<string, unknown> = {
    monthlyRental: contract.financialTerms.monthlyRental,
    perKmRate: contract.financialTerms.perKmRate,
    perTripRate: contract.financialTerms.perTripRate,
    paymentFrequency: contract.financialTerms.paymentFrequency,
    securityDeposit: contract.financialTerms.securityDeposit,
    expiryDate: contract.expiryDate,
    durationMonths: contract.durationMonths,
    maintenanceResponsibility: contract.contractConditions.maintenanceResponsibility,
    fuelResponsibility: contract.contractConditions.fuelResponsibility,
    insuranceResponsibility: contract.contractConditions.insuranceResponsibility,
  }

  const count = (db.prepare('SELECT COUNT(*) AS count FROM contract_amendments WHERE organization_id = ?').get(orgId) as { count: number }).count
  const id = `amd-${crypto.randomUUID().slice(0, 8)}`
  const code = `AMD-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
  const status: AmendmentApprovalStatus = input.submitImmediately ? 'submitted' : 'draft'
  const nowIso = new Date().toISOString()

  db.prepare(`
    INSERT INTO contract_amendments (
      id, organization_id, amendment_code, contract_id, title, reason, amendment_type,
      previous_values_json, revised_values_json, effective_date, recalculate_future_schedule,
      recalculation_confirmed, supporting_doc_id, approval_status, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?)
  `).run(
    id,
    orgId,
    code,
    input.contractId,
    input.title.trim(),
    input.reason.trim(),
    input.amendmentType,
    JSON.stringify(previousValues),
    JSON.stringify(input.revisedValues),
    input.effectiveDate,
    input.recalculateFutureSchedule ? 1 : 0,
    status,
    actor.fullName,
    nowIso,
  )

  appendContractHistory(db, {
    organizationId: orgId,
    contractId: input.contractId,
    entityType: 'amendment',
    entityId: id,
    action: 'AMENDMENT_CREATED',
    actor,
    summary: `Created amendment ${code} (${input.title.trim()}) for ${contract.contractCode} [${status}].`,
  })

  const ws = getContractsWorkspace(db, orgId, actor.role)
  return ws.amendments.find((a) => a.id === id)!
}

export function reviewContractAmendment(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  amendmentId: string,
  decision: 'submit' | 'approve' | 'reject',
  rejectionReason?: string,
): { amendment: ContractAmendment; contract: VehicleContract } {
  const amRow = db.prepare('SELECT * FROM contract_amendments WHERE id = ? AND organization_id = ?').get(amendmentId, orgId) as Record<string, unknown> | undefined
  if (!amRow) throw new Error('Amendment not found.')
  const currentStatus = String(amRow.approval_status) as AmendmentApprovalStatus

  if (decision === 'submit') {
    assertOrgContractPermission(db, orgId, actor.role, 'create_amendments')
    if (!canTransitionAmendment(currentStatus, 'submitted')) {
      throw new Error(`Cannot submit amendment from ${currentStatus}.`)
    }
    db.prepare("UPDATE contract_amendments SET approval_status = 'submitted' WHERE id = ?").run(amendmentId)
  } else if (decision === 'reject') {
    assertOrgContractPermission(db, orgId, actor.role, 'approve_amendments')
    db.prepare("UPDATE contract_amendments SET approval_status = 'rejected', rejection_reason = ?, approved_by = ?, approved_at = ? WHERE id = ?").run(
      rejectionReason?.trim() || 'Rejected by contract approver',
      actor.fullName,
      new Date().toISOString(),
      amendmentId,
    )
  } else {
    assertOrgContractPermission(db, orgId, actor.role, 'approve_amendments')
    const contractRow = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(String(amRow.contract_id), orgId) as Record<string, unknown>
    const contract = mapContract(contractRow)
    const revised = parseJson<Record<string, unknown>>(amRow.revised_values_json, {})
    const nowIso = new Date().toISOString()

    db.exec('BEGIN IMMEDIATE')
    try {
      const nextVersion = contract.currentVersion + 1
      const nextFinancialTerms: ContractFinancialTerms = {
        ...contract.financialTerms,
        ...(revised.monthlyRental !== undefined ? { monthlyRental: Number(revised.monthlyRental), fixedRentalAmount: Number(revised.monthlyRental) } : {}),
        ...(revised.perKmRate !== undefined ? { perKmRate: Number(revised.perKmRate) } : {}),
        ...(revised.perTripRate !== undefined ? { perTripRate: Number(revised.perTripRate) } : {}),
        ...(revised.securityDeposit !== undefined ? { securityDeposit: Number(revised.securityDeposit) } : {}),
        ...(revised.paymentFrequency !== undefined ? { paymentFrequency: String(revised.paymentFrequency) as ContractFinancialTerms['paymentFrequency'] } : {}),
      }
      const nextConditions: ContractConditions = {
        ...contract.contractConditions,
        ...(revised.maintenanceResponsibility !== undefined ? { maintenanceResponsibility: String(revised.maintenanceResponsibility) as ResponsibilityParty } : {}),
        ...(revised.fuelResponsibility !== undefined ? { fuelResponsibility: String(revised.fuelResponsibility) as ResponsibilityParty } : {}),
        ...(revised.insuranceResponsibility !== undefined ? { insuranceResponsibility: String(revised.insuranceResponsibility) as ResponsibilityParty } : {}),
      }
      const nextExpiry = typeof revised.expiryDate === 'string' && revised.expiryDate ? revised.expiryDate : contract.expiryDate
      const nextDuration = revised.durationMonths !== undefined ? Number(revised.durationMonths) : contract.durationMonths

      // Preserve prior versions cleanly; insert new immutable version snapshot
      db.prepare(`
        INSERT INTO contract_versions (
          id, organization_id, contract_id, version_number, effective_date, financial_terms_json,
          contract_conditions_json, expiry_date, duration_months, created_by, approved_by, created_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `cv-${crypto.randomUUID().slice(0, 8)}`,
        orgId,
        contract.id,
        nextVersion,
        String(amRow.effective_date),
        JSON.stringify(nextFinancialTerms),
        JSON.stringify(nextConditions),
        nextExpiry,
        nextDuration,
        String(amRow.created_by),
        actor.fullName,
        nowIso,
        `Effective from Amendment ${String(amRow.amendment_code)}: ${String(amRow.title)}`,
      )

      db.prepare(`
        UPDATE vehicle_contracts
        SET current_version = ?, financial_terms_json = ?, contract_conditions_json = ?, expiry_date = ?, duration_months = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(
        nextVersion,
        JSON.stringify(nextFinancialTerms),
        JSON.stringify(nextConditions),
        nextExpiry,
        nextDuration,
        nowIso,
        contract.id,
        orgId,
      )

      // Update unstarted / unpaid future pending payment drafts if recalculateFutureSchedule=1; NEVER alter paid or reconciled transactions!
      if (Number(amRow.recalculate_future_schedule) === 1 && revised.monthlyRental !== undefined) {
        db.prepare(`
          UPDATE contract_payments
          SET payment_amount_inr = ?, outstanding_amount_inr = ?, updated_at = ?
          WHERE contract_id = ? AND organization_id = ? AND status IN ('draft', 'pending_approval') AND paid_amount_inr = 0 AND due_date >= ?
        `).run(
          Number(revised.monthlyRental),
          Number(revised.monthlyRental),
          nowIso,
          contract.id,
          orgId,
          String(amRow.effective_date),
        )
      }

      db.prepare(`
        UPDATE contract_amendments
        SET approval_status = 'effective', recalculation_confirmed = 1, approved_by = ?, approved_at = ?
        WHERE id = ?
      `).run(actor.fullName, nowIso, amendmentId)

      appendContractHistory(db, {
        organizationId: orgId,
        contractId: contract.id,
        entityType: 'amendment',
        entityId: amendmentId,
        action: 'AMENDMENT_APPROVED_EFFECTIVE',
        actor,
        summary: `Approved amendment ${String(amRow.amendment_code)} creating Contract v${nextVersion} while preserving v${contract.currentVersion} and historical paid receipts.`,
      })

      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }

  const ws = getContractsWorkspace(db, orgId, actor.role)
  return {
    amendment: ws.amendments.find((a) => a.id === amendmentId)!,
    contract: ws.contracts.find((c) => c.id === String(amRow.contract_id))!,
  }
}

export function renewVehicleContract(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  contractId: string,
  input: {
    newExpiryDate: string
    durationMonths: number
    revisedMonthlyRental?: number
    notes?: string
  },
): VehicleContract {
  assertOrgContractPermission(db, orgId, actor.role, 'renew_contracts')
  const row = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(contractId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Contract not found.')
  const current = mapContract(row)
  if (!input.newExpiryDate || new Date(input.newExpiryDate).getTime() <= new Date(current.startDate).getTime()) {
    throw new Error('New renewal expiry date must be later than contract start date.')
  }

  const nowIso = new Date().toISOString()
  const nextVersion = current.currentVersion + 1
  const nextTerms: ContractFinancialTerms = {
    ...current.financialTerms,
    ...(input.revisedMonthlyRental !== undefined && Number(input.revisedMonthlyRental) > 0
      ? { monthlyRental: Number(input.revisedMonthlyRental), fixedRentalAmount: Number(input.revisedMonthlyRental) }
      : {}),
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare(`
      INSERT INTO contract_versions (
        id, organization_id, contract_id, version_number, effective_date, financial_terms_json,
        contract_conditions_json, expiry_date, duration_months, created_by, approved_by, created_at, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `cv-${crypto.randomUUID().slice(0, 8)}`,
      orgId,
      contractId,
      nextVersion,
      nowIso.slice(0, 10),
      JSON.stringify(nextTerms),
      JSON.stringify(current.contractConditions),
      input.newExpiryDate,
      Math.max(1, Math.round(input.durationMonths)),
      actor.fullName,
      actor.fullName,
      nowIso,
      input.notes?.trim() || `Contract renewed through ${input.newExpiryDate}`,
    )

    db.prepare(`
      UPDATE vehicle_contracts
      SET status = 'active', current_version = ?, expiry_date = ?, duration_months = ?, financial_terms_json = ?, updated_at = ?
      WHERE id = ? AND organization_id = ?
    `).run(nextVersion, input.newExpiryDate, Math.max(1, Math.round(input.durationMonths)), JSON.stringify(nextTerms), nowIso, contractId, orgId)

    appendContractHistory(db, {
      organizationId: orgId,
      contractId,
      entityType: 'contract',
      entityId: contractId,
      action: 'CONTRACT_RENEWED',
      actor,
      summary: `Renewed ${current.contractCode} to ${input.newExpiryDate} (v${nextVersion}).`,
    })
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return mapContract(db.prepare('SELECT * FROM vehicle_contracts WHERE id = ?').get(contractId) as Record<string, unknown>)
}

export function recordContractPayment(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: {
    contractId: string
    vehicleId?: string | null
    paymentKind: ContractPayment['paymentKind']
    billingPeriod: string
    dueDate: string
    paymentAmountInr: number
    paidAmountInr: number
    paymentMethod: ContractPayment['paymentMethod']
    paymentReference: string
    reconciliationNotes?: string
  },
): ContractPayment {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_contract_payments')
  const contractRow = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(input.contractId, orgId) as Record<string, unknown> | undefined
  if (!contractRow) throw new Error('Contract not found.')
  const contract = mapContract(contractRow)

  const total = Math.max(1, Math.round(Number(input.paymentAmountInr)))
  const paid = Math.max(0, Math.min(total, Math.round(Number(input.paidAmountInr || 0))))
  const outstanding = Math.max(0, total - paid)
  const status: ContractPayment['status'] =
    paid === 0 ? 'pending_approval' : outstanding > 0 ? 'partially_paid' : 'paid'

  let vehicleReg: string | null = null
  if (input.vehicleId) {
    const vRow = db.prepare('SELECT registration_number FROM fleet_vehicles WHERE id = ? AND organization_id = ?').get(input.vehicleId, orgId) as { registration_number?: string } | undefined
    vehicleReg = vRow?.registration_number ?? null
  }

  const count = (db.prepare('SELECT COUNT(*) AS count FROM contract_payments WHERE organization_id = ?').get(orgId) as { count: number }).count
  const id = `cp-${crypto.randomUUID().slice(0, 8)}`
  const txCode = `CPAY-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
  const nowIso = new Date().toISOString()

  db.prepare(`
    INSERT INTO contract_payments (
      id, organization_id, transaction_code, contract_id, contract_version, supplier_type,
      fleet_partner_id, individual_owner_id, supplier_name, vehicle_id, vehicle_registration,
      payment_kind, billing_period, due_date, payment_amount_inr, paid_amount_inr, outstanding_amount_inr,
      payment_method, payment_reference, receipt_ref, status, reconciliation_notes,
      recorded_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
  `).run(
    id,
    orgId,
    txCode,
    contract.id,
    contract.currentVersion,
    contract.supplierType,
    contract.fleetPartnerId,
    contract.individualOwnerId,
    contract.supplierName,
    input.vehicleId ?? null,
    vehicleReg,
    input.paymentKind,
    input.billingPeriod.trim() || 'Current Cycle',
    input.dueDate,
    total,
    paid,
    outstanding,
    input.paymentMethod,
    input.paymentReference.trim() || txCode,
    status,
    input.reconciliationNotes?.trim() || null,
    actor.fullName,
    nowIso,
    nowIso,
  )

  appendContractHistory(db, {
    organizationId: orgId,
    contractId: contract.id,
    entityType: 'contract_payment',
    entityId: id,
    action: 'CONTRACT_PAYMENT_RECORDED',
    actor,
    summary: `Recorded ${txCode} (Rs ${paid.toLocaleString('en-IN')} / Rs ${total.toLocaleString('en-IN')}) under ${contract.contractCode} v${contract.currentVersion}.`,
  })

  return getContractsWorkspace(db, orgId, actor.role).payments.find((p) => p.id === id)!
}

export function updateContractPaymentState(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  paymentId: string,
  action: 'approve' | 'reconcile' | 'dispute' | 'settle_balance',
  note?: string,
  additionalPaidInr?: number,
): ContractPayment {
  const row = db.prepare('SELECT * FROM contract_payments WHERE id = ? AND organization_id = ?').get(paymentId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Contract payment record not found.')

  const nowIso = new Date().toISOString()
  if (action === 'approve' || action === 'reconcile') {
    assertOrgContractPermission(db, orgId, actor.role, 'approve_contract_payments')
    if (action === 'approve') {
      db.prepare(`UPDATE contract_payments SET status = CASE WHEN paid_amount_inr >= payment_amount_inr THEN 'paid' ELSE 'approved' END, approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?`).run(
        actor.fullName,
        nowIso,
        nowIso,
        paymentId,
      )
    } else {
      db.prepare(`UPDATE contract_payments SET status = 'reconciled', reconciled_by = ?, reconciled_at = ?, reconciliation_notes = COALESCE(?, reconciliation_notes), updated_at = ? WHERE id = ?`).run(
        actor.fullName,
        nowIso,
        note?.trim() || null,
        nowIso,
        paymentId,
      )
    }
  } else if (action === 'dispute') {
    assertOrgContractPermission(db, orgId, actor.role, 'manage_contract_payments')
    db.prepare(`UPDATE contract_payments SET status = 'disputed', reconciliation_notes = ?, updated_at = ? WHERE id = ?`).run(
      note?.trim() || 'Marked disputed for billing verification',
      nowIso,
      paymentId,
    )
  } else {
    assertOrgContractPermission(db, orgId, actor.role, 'manage_contract_payments')
    const total = Number(row.payment_amount_inr)
    const prevPaid = Number(row.paid_amount_inr)
    const add = Math.max(1, Math.round(Number(additionalPaidInr ?? row.outstanding_amount_inr)))
    const nextPaid = Math.min(total, prevPaid + add)
    const nextOut = Math.max(0, total - nextPaid)
    const nextStatus = nextOut === 0 ? 'paid' : 'partially_paid'
    db.prepare(`UPDATE contract_payments SET paid_amount_inr = ?, outstanding_amount_inr = ?, status = ?, reconciliation_notes = COALESCE(?, reconciliation_notes), updated_at = ? WHERE id = ?`).run(
      nextPaid,
      nextOut,
      nextStatus,
      note?.trim() || null,
      nowIso,
      paymentId,
    )
  }

  appendContractHistory(db, {
    organizationId: orgId,
    contractId: String(row.contract_id),
    entityType: 'contract_payment',
    entityId: paymentId,
    action: `PAYMENT_${action.toUpperCase()}`,
    actor,
    summary: `Updated payment ${String(row.transaction_code)} via ${action}${note ? ` (${note})` : ''}.`,
  })

  return getContractsWorkspace(db, orgId, actor.role).payments.find((p) => p.id === paymentId)!
}

export function createOrUpdateDeposit(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: {
    contractId: string
    depositType: ContractBondDeposit['depositType']
    requiredAmountInr: number
    paidAmountInr: number
    paymentReference?: string
    paymentMethod?: string
    receivingParty?: string
    isRefundable?: boolean
    refundConditions?: string
    vehicleId?: string | null
    vehicleGroupLabel?: string
  },
): ContractBondDeposit {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_security_deposits')
  const contractRow = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(input.contractId, orgId) as Record<string, unknown> | undefined
  if (!contractRow) throw new Error('Contract not found.')
  const contract = mapContract(contractRow)

  const required = Math.max(1, Math.round(Number(input.requiredAmountInr)))
  const paid = Math.max(0, Math.min(required, Math.round(Number(input.paidAmountInr || 0))))
  const outstanding = Math.max(0, required - paid)
  const count = (db.prepare('SELECT COUNT(*) AS count FROM contract_bonds_deposits WHERE organization_id = ?').get(orgId) as { count: number }).count
  const id = `dep-${crypto.randomUUID().slice(0, 8)}`
  const code = `DEP-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
  const nowIso = new Date().toISOString()
  const status: DepositStatus = paid === 0 ? 'deposit_defined' : outstanding > 0 ? 'payment_recorded' : 'active'

  db.prepare(`
    INSERT INTO contract_bonds_deposits (
      id, organization_id, deposit_code, contract_id, supplier_type, fleet_partner_id, individual_owner_id,
      supplier_name, vehicle_id, vehicle_group_label, deposit_type, required_amount_inr, paid_amount_inr,
      outstanding_amount_inr, deducted_amount_inr, refunded_amount_inr, payment_date, payment_reference,
      payment_method, receiving_party, is_refundable, refund_conditions, expiry_date, document_ref,
      status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
  `).run(
    id,
    orgId,
    code,
    contract.id,
    contract.supplierType,
    contract.fleetPartnerId,
    contract.individualOwnerId,
    contract.supplierName,
    input.vehicleId ?? null,
    input.vehicleGroupLabel?.trim() || 'Contract Asset Security',
    input.depositType,
    required,
    paid,
    outstanding,
    paid > 0 ? nowIso.slice(0, 10) : null,
    input.paymentReference?.trim() || null,
    input.paymentMethod?.trim() || 'neft',
    input.receivingParty?.trim() || contract.supplierName,
    input.isRefundable === false ? 0 : 1,
    input.refundConditions?.trim() || 'Refundable post return handover inspection.',
    contract.expiryDate,
    status,
    actor.fullName,
    nowIso,
    nowIso,
  )

  appendContractHistory(db, {
    organizationId: orgId,
    contractId: contract.id,
    entityType: 'deposit',
    entityId: id,
    action: 'DEPOSIT_RECORDED',
    actor,
    summary: `Defined ${code} (${input.depositType}) required Rs ${required.toLocaleString('en-IN')}, paid Rs ${paid.toLocaleString('en-IN')}.`,
  })

  return getContractsWorkspace(db, orgId, actor.role).deposits.find((d) => d.id === id)!
}

export function addDepositDeductionOrRefund(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  depositId: string,
  action: 'deduct' | 'topup' | 'approve_refund' | 'settle_refund',
  input: { amountInr?: number; reason?: string; evidenceRef?: string; handoverReturnId?: string | null },
): ContractBondDeposit {
  const row = db.prepare('SELECT * FROM contract_bonds_deposits WHERE id = ? AND organization_id = ?').get(depositId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Deposit record not found.')

  const nowIso = new Date().toISOString()
  if (action === 'topup') {
    assertOrgContractPermission(db, orgId, actor.role, 'manage_security_deposits')
    const addAmt = Math.max(1, Math.round(Number(input.amountInr || 0)))
    const req = Number(row.required_amount_inr)
    const nextPaid = Math.min(req, Number(row.paid_amount_inr) + addAmt)
    const nextOut = Math.max(0, req - nextPaid)
    db.prepare(`UPDATE contract_bonds_deposits SET paid_amount_inr = ?, outstanding_amount_inr = ?, status = ?, updated_at = ? WHERE id = ?`).run(
      nextPaid,
      nextOut,
      nextOut === 0 ? 'active' : 'payment_recorded',
      nowIso,
      depositId,
    )
    appendContractHistory(db, {
      organizationId: orgId,
      contractId: String(row.contract_id),
      entityType: 'deposit',
      entityId: depositId,
      action: 'DEPOSIT_TOPUP',
      actor,
      summary: `Recorded deposit payment Rs ${addAmt.toLocaleString('en-IN')} on ${String(row.deposit_code)}.`,
    })
  } else if (action === 'deduct') {
    assertOrgContractPermission(db, orgId, actor.role, 'approve_deposit_refunds')
    const dedAmt = Math.max(1, Math.round(Number(input.amountInr || 0)))
    if (!input.reason?.trim()) throw new Error('Deduction reason is required.')
    const paid = Number(row.paid_amount_inr)
    const curDed = Number(row.deducted_amount_inr)
    if (curDed + dedAmt > paid) {
      throw new Error(`Deduction exceeds available paid deposit balance (Rs ${(paid - curDed).toLocaleString('en-IN')}).`)
    }
    db.prepare(`
      INSERT INTO contract_deposit_deductions (
        id, organization_id, deposit_id, contract_id, vehicle_id, amount_inr, reason, evidence_ref, authorized_by, authorized_at, handover_return_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `ded-${crypto.randomUUID().slice(0, 8)}`,
      orgId,
      depositId,
      String(row.contract_id),
      row.vehicle_id ? String(row.vehicle_id) : null,
      dedAmt,
      input.reason.trim(),
      input.evidenceRef?.trim() || 'Authorized Inspection Deduction',
      actor.fullName,
      nowIso,
      input.handoverReturnId ?? null,
    )
    db.prepare(`UPDATE contract_bonds_deposits SET deducted_amount_inr = ?, status = 'deductions', updated_at = ? WHERE id = ?`).run(
      curDed + dedAmt,
      nowIso,
      depositId,
    )
    appendContractHistory(db, {
      organizationId: orgId,
      contractId: String(row.contract_id),
      entityType: 'deposit',
      entityId: depositId,
      action: 'DEPOSIT_DEDUCTION_AUTHORIZED',
      actor,
      summary: `Authorized Rs ${dedAmt.toLocaleString('en-IN')} deduction on ${String(row.deposit_code)}: ${input.reason.trim()}.`,
    })
  } else if (action === 'approve_refund') {
    assertOrgContractPermission(db, orgId, actor.role, 'approve_deposit_refunds')
    db.prepare(`UPDATE contract_bonds_deposits SET status = 'refund_approval', refund_approved_by = ?, updated_at = ? WHERE id = ?`).run(
      actor.fullName,
      nowIso,
      depositId,
    )
    appendContractHistory(db, {
      organizationId: orgId,
      contractId: String(row.contract_id),
      entityType: 'deposit',
      entityId: depositId,
      action: 'DEPOSIT_REFUND_APPROVED',
      actor,
      summary: `Approved refund release calculation for ${String(row.deposit_code)}.`,
    })
  } else {
    assertOrgContractPermission(db, orgId, actor.role, 'approve_deposit_refunds')
    const summary = computeDepositSummary({
      requiredAmountInr: Number(row.required_amount_inr),
      paidAmountInr: Number(row.paid_amount_inr),
      deductedAmountInr: Number(row.deducted_amount_inr),
      refundedAmountInr: Number(row.refunded_amount_inr),
      isRefundable: Number(row.is_refundable) === 1,
    })
    const refundAmt = Math.min(summary.netRefundableInr, Math.max(0, Math.round(Number(input.amountInr ?? summary.netRefundableInr))))
    const totalRefunded = Number(row.refunded_amount_inr) + refundAmt
    db.prepare(`UPDATE contract_bonds_deposits SET refunded_amount_inr = ?, status = 'closed', refund_approved_by = COALESCE(refund_approved_by, ?), updated_at = ? WHERE id = ?`).run(
      totalRefunded,
      actor.fullName,
      nowIso,
      depositId,
    )
    appendContractHistory(db, {
      organizationId: orgId,
      contractId: String(row.contract_id),
      entityType: 'deposit',
      entityId: depositId,
      action: 'DEPOSIT_REFUND_SETTLED',
      actor,
      summary: `Settled refund Rs ${refundAmt.toLocaleString('en-IN')} & closed ${String(row.deposit_code)}.`,
    })
  }

  return getContractsWorkspace(db, orgId, actor.role).deposits.find((d) => d.id === depositId)!
}

export function createMaintenanceRuleOrAllocation(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  mode: 'rule' | 'allocation',
  input: Record<string, unknown>,
): ContractsWorkspacePayload {
  const nowIso = new Date().toISOString()
  if (mode === 'rule') {
    assertOrgContractPermission(db, orgId, actor.role, 'manage_maintenance_responsibilities')
    const contractId = String(input.contractId || '')
    if (!contractId) throw new Error('Select a contract.')
    const party = String(input.responsibleParty || 'shared') as ResponsibilityParty
    const orgPct = party === 'operating_org' ? 100 : party === 'supplier' ? 0 : Math.min(100, Math.max(0, Number(input.orgSharePct ?? 50)))
    const supPct = 100 - orgPct

    db.prepare(`
      INSERT INTO contract_maintenance_rules (
        id, organization_id, contract_id, vehicle_id, maintenance_category, custom_category_label,
        responsible_party, org_share_pct, supplier_share_pct, threshold_amount_inr, circumstance, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `cmr-${crypto.randomUUID().slice(0, 8)}`,
      orgId,
      contractId,
      input.vehicleId ? String(input.vehicleId) : null,
      String(input.maintenanceCategory || 'engine'),
      input.customCategoryLabel ? String(input.customCategoryLabel) : null,
      party,
      orgPct,
      supPct,
      Number(input.thresholdAmountInr || 0),
      String(input.circumstance || 'all'),
      String(input.notes || ''),
      nowIso,
    )
    appendContractHistory(db, {
      organizationId: orgId,
      contractId,
      entityType: 'maintenance_rule',
      entityId: contractId,
      action: 'MAINTENANCE_RULE_DEFINED',
      actor,
      summary: `Defined ${String(input.maintenanceCategory || 'engine')} responsibility (${party}: ${orgPct}% Org / ${supPct}% Supplier).`,
    })
  } else {
    assertOrgContractPermission(db, orgId, actor.role, 'manage_maintenance_responsibilities')
    const contractId = String(input.contractId || '')
    const vehicleId = String(input.vehicleId || '')
    const vRow = db.prepare('SELECT registration_number FROM fleet_vehicles WHERE id = ? AND organization_id = ?').get(vehicleId, orgId) as { registration_number?: string } | undefined
    if (!vRow?.registration_number) throw new Error('Select a valid vehicle.')

    const total = Math.max(1, Math.round(Number(input.totalRepairAmountInr || 0)))
    const party = String(input.responsibleParty || 'shared') as ResponsibilityParty
    const split = computeMaintenanceSplit({
      totalRepairAmountInr: total,
      responsibleParty: party,
      orgSharePct: Number(input.orgSharePct ?? 50),
    })

    const allocId = `cma-${crypto.randomUUID().slice(0, 8)}`
    db.prepare(`
      INSERT INTO contract_maintenance_allocations (
        id, organization_id, contract_id, vehicle_id, vehicle_registration, maintenance_record_id, work_order_id,
        maintenance_category, description, total_repair_amount_inr, org_share_inr, supplier_share_inr,
        responsible_party, settlement_status, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?)
    `).run(
      allocId,
      orgId,
      contractId,
      vehicleId,
      vRow.registration_number,
      String(input.maintenanceCategory || 'engine'),
      String(input.description || 'Contract repair split entry'),
      total,
      split.orgShareInr,
      split.supplierShareInr,
      party,
      String(input.notes || ''),
      nowIso,
    )
    appendContractHistory(db, {
      organizationId: orgId,
      contractId,
      entityType: 'maintenance_allocation',
      entityId: allocId,
      action: 'MAINTENANCE_SPLIT_LOGGED',
      actor,
      summary: `Logged Rs ${total.toLocaleString('en-IN')} split on ${vRow.registration_number} (${split.orgShareInr} Org / ${split.supplierShareInr} Supplier).`,
    })
  }
  return getContractsWorkspace(db, orgId, actor.role)
}

export function approveMaintenanceAllocation(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  allocId: string,
  status: 'approved' | 'settled' | 'disputed',
): ContractMaintenanceAllocation {
  assertOrgContractPermission(db, orgId, actor.role, 'approve_contract_maintenance')
  const row = db.prepare('SELECT * FROM contract_maintenance_allocations WHERE id = ? AND organization_id = ?').get(allocId, orgId) as Record<string, unknown> | undefined
  if (!row) throw new Error('Maintenance allocation not found.')
  const nowIso = new Date().toISOString()
  db.prepare(`UPDATE contract_maintenance_allocations SET settlement_status = ?, approved_by = ?, approved_at = ? WHERE id = ?`).run(
    status,
    actor.fullName,
    nowIso,
    allocId,
  )
  appendContractHistory(db, {
    organizationId: orgId,
    contractId: String(row.contract_id),
    entityType: 'maintenance_allocation',
    entityId: allocId,
    action: `MAINTENANCE_ALLOCATION_${status.toUpperCase()}`,
    actor,
    summary: `Marked maintenance split allocation ${allocId} (${String(row.vehicle_registration)}) as ${status}.`,
  })
  return getContractsWorkspace(db, orgId, actor.role).maintenanceAllocations.find((a) => a.id === allocId)!
}

export function createVehicleHandoverRecord(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: {
    contractId: string
    vehicleId: string
    recordType: 'initial_handover' | 'vehicle_return'
    linkedInitialHandoverId?: string | null
    handoverDatetime?: string
    odometerKm: number
    fuelLevelPct: number
    exteriorCondition: VehicleHandoverRecord['exteriorCondition']
    interiorCondition: VehicleHandoverRecord['interiorCondition']
    tyreCondition: VehicleHandoverRecord['tyreCondition']
    existingDamages?: string
    accessoriesChecklist: string[]
    equipmentChecklist: string[]
    documentChecklist: string[]
    handoverNotes?: string
    supplierRepresentative: string
    receivingRepresentative: string
    supplierAckName: string
    receivingAckName: string
    newDamages?: string
    missingEquipment?: string
    pendingRepairsInr?: number
    outstandingExpensesInr?: number
    recommendedDeductionInr?: number
  },
): VehicleHandoverRecord {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_contract_vehicles')
  const contractRow = db.prepare('SELECT * FROM vehicle_contracts WHERE id = ? AND organization_id = ?').get(input.contractId, orgId) as Record<string, unknown> | undefined
  if (!contractRow) throw new Error('Contract not found.')
  const contract = mapContract(contractRow)
  const vRow = db.prepare('SELECT registration_number FROM fleet_vehicles WHERE id = ? AND organization_id = ?').get(input.vehicleId, orgId) as { registration_number?: string } | undefined
  if (!vRow?.registration_number) throw new Error('Vehicle not found.')

  const count = (db.prepare('SELECT COUNT(*) AS count FROM vehicle_handovers WHERE organization_id = ?').get(orgId) as { count: number }).count
  const id = `ho-${crypto.randomUUID().slice(0, 8)}`
  const code = `${input.recordType === 'initial_handover' ? 'HO' : 'RET'}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    db.prepare(`
      INSERT INTO vehicle_handovers (
        id, organization_id, handover_code, contract_id, vehicle_id, vehicle_registration,
        supplier_type, supplier_name, record_type, linked_initial_handover_id, handover_datetime,
        odometer_km, fuel_level_pct, exterior_condition, interior_condition, tyre_condition,
        existing_damages, accessories_checklist_json, equipment_checklist_json, document_checklist_json,
        photos_json, handover_notes, supplier_representative, receiving_representative,
        supplier_ack_name, receiving_ack_name, new_damages, missing_equipment,
        pending_repairs_inr, outstanding_expenses_inr, recommended_deduction_inr, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      orgId,
      code,
      contract.id,
      input.vehicleId,
      vRow.registration_number,
      contract.supplierType,
      contract.supplierName,
      input.recordType,
      input.linkedInitialHandoverId ?? null,
      input.handoverDatetime || nowIso,
      Number(input.odometerKm || 0),
      Number(input.fuelLevelPct || 0),
      input.exteriorCondition,
      input.interiorCondition,
      input.tyreCondition,
      input.existingDamages?.trim() || '',
      JSON.stringify(input.accessoriesChecklist || []),
      JSON.stringify(input.equipmentChecklist || []),
      JSON.stringify(input.documentChecklist || []),
      input.handoverNotes?.trim() || '',
      input.supplierRepresentative.trim(),
      input.receivingRepresentative.trim(),
      input.supplierAckName.trim(),
      input.receivingAckName.trim(),
      input.newDamages?.trim() || null,
      input.missingEquipment?.trim() || null,
      Number(input.pendingRepairsInr || 0),
      Number(input.outstandingExpensesInr || 0),
      Number(input.recommendedDeductionInr || 0),
      actor.fullName,
      nowIso,
    )

    if (input.recordType === 'initial_handover') {
      db.prepare(`
        UPDATE vehicle_contract_vehicles SET vehicle_contract_status = 'active', initial_odometer_km = ?
        WHERE contract_id = ? AND vehicle_id = ? AND organization_id = ?
      `).run(Number(input.odometerKm || 0), contract.id, input.vehicleId, orgId)
      if (contract.status === 'awaiting_handover') {
        db.prepare(`UPDATE vehicle_contracts SET status = 'active', updated_at = ? WHERE id = ?`).run(nowIso, contract.id)
      }
    } else {
      db.prepare(`
        UPDATE vehicle_contract_vehicles SET vehicle_contract_status = 'returned', return_date = ?
        WHERE contract_id = ? AND vehicle_id = ? AND organization_id = ?
      `).run(nowIso.slice(0, 10), contract.id, input.vehicleId, orgId)
    }

    appendContractHistory(db, {
      organizationId: orgId,
      contractId: contract.id,
      entityType: 'handover',
      entityId: id,
      action: input.recordType === 'initial_handover' ? 'VEHICLE_HANDOVER_COMPLETED' : 'VEHICLE_RETURN_INSPECTED',
      actor,
      summary: `Completed ${code} (${input.recordType.replace(/_/g, ' ')}) for ${vRow.registration_number} at ${Number(input.odometerKm).toLocaleString('en-IN')} km.`,
    })
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  return getContractsWorkspace(db, orgId, actor.role).handovers.find((h) => h.id === id)!
}

export function createContractDocument(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  input: {
    entityType: ContractDocumentItem['entityType']
    entityId: string
    contractId?: string | null
    category: string
    title: string
    fileName: string
    mimeType?: string
    fileSizeBytes?: number
    storageKey?: string
    expiryDate?: string | null
    restrictedAccess?: boolean
  },
): ContractDocumentItem {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_contract_documents')
  if (!input.title.trim() || !input.fileName.trim()) {
    throw new Error('Document title and file name are required.')
  }
  const id = `cdoc-${crypto.randomUUID().slice(0, 8)}`
  const nowIso = new Date().toISOString()
  db.prepare(`
    INSERT INTO contract_documents (
      id, organization_id, entity_type, entity_id, contract_id, category, title, file_name,
      mime_type, file_size_bytes, storage_key, expiry_date, verification_status, restricted_access, uploaded_by, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?, ?)
  `).run(
    id,
    orgId,
    input.entityType,
    input.entityId,
    input.contractId ?? null,
    input.category.trim(),
    input.title.trim(),
    input.fileName.trim(),
    input.mimeType ?? 'application/pdf',
    Number(input.fileSizeBytes ?? 128000),
    input.storageKey ?? `${id}-${input.fileName.trim()}`,
    input.expiryDate || null,
    input.restrictedAccess ? 1 : 0,
    actor.fullName,
    nowIso,
  )
  appendContractHistory(db, {
    organizationId: orgId,
    contractId: input.contractId ?? null,
    entityType: 'contract_document',
    entityId: id,
    action: 'CONTRACT_DOCUMENT_UPLOADED',
    actor,
    summary: `Uploaded ${input.title.trim()} (${input.category}).`,
  })
  return getContractsWorkspace(db, orgId, actor.role).documents.find((d) => d.id === id)!
}

export function verifyContractDocument(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  docId: string,
  status: ContractDocumentItem['verificationStatus'],
): ContractDocumentItem {
  assertOrgContractPermission(db, orgId, actor.role, 'manage_contract_documents')
  db.prepare('UPDATE contract_documents SET verification_status = ? WHERE id = ? AND organization_id = ?').run(status, docId, orgId)
  appendContractHistory(db, {
    organizationId: orgId,
    entityType: 'contract_document',
    entityId: docId,
    action: 'CONTRACT_DOCUMENT_VERIFIED',
    actor,
    summary: `Updated contract document ${docId} status to ${status}.`,
  })
  return getContractsWorkspace(db, orgId, actor.role).documents.find((d) => d.id === docId)!
}

export function updateOrgContractPermissions(
  db: DatabaseSync,
  orgId: string,
  actor: ContractActor,
  updates: Array<{ role: OrganizationRole; permissionKey: ContractPermissionKey; allowed: boolean }>,
): ContractsWorkspacePayload {
  if (actor.role !== 'org_admin') {
    throw new Error('Only the Fleet Owner (Organization Admin) can configure staff contract permissions.')
  }
  const nowIso = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO contract_permissions (id, organization_id, role, permission_key, allowed, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id, role, permission_key) DO UPDATE SET
      allowed = excluded.allowed,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at
  `)

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const u of updates) {
      if (u.role === 'org_admin' || !ALL_CONTRACT_PERMISSION_KEYS.includes(u.permissionKey)) continue
      stmt.run(
        `cperm-${orgId}-${u.role}-${u.permissionKey}`,
        orgId,
        u.role,
        u.permissionKey,
        u.allowed ? 1 : 0,
        actor.fullName,
        nowIso,
      )
    }
    appendContractHistory(db, {
      organizationId: orgId,
      entityType: 'permissions',
      entityId: orgId,
      action: 'CONTRACT_PERMISSIONS_UPDATED',
      actor,
      summary: `Updated ${updates.length} role permission setting(s) for Vehicle Contracts.`,
    })
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return getContractsWorkspace(db, orgId, actor.role)
}
