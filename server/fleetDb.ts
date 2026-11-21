import crypto from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type {
  ApiKeyEntry,
  AuditLogEntry,
  CustomDashboardLayout,
  CustomRecordEntry,
  DocumentVaultItem,
  Driver,
  DriverAssignmentHistoryItem,
  DriverBehaviorEvent,
  FinancialInvoice,
  FleetModulesDataset,
  FleetRecallItem,
  FleetToolItem,
  FleetWarrantyItem,
  FleetioSettingsState,
  FuelTransaction,
  InspectionFormTemplate,
  InspectionScheduleItem,
  InventoryTransaction,
  MaintenanceRecord,
  OperationalAlert,
  Organization,
  OrganizationMember,
  PartInventoryItem,
  PaymentRecord,
  PurchaseOrder,
  ReportHistoryItem,
  ServiceProgramItem,
  ServiceScheduleReminder,
  ServiceTaskCatalogItem,
  SmallIssueLog,
  SupplierRecord,
  Trip,
  TyrePositionRecord,
  Vehicle,
  VehicleComponent,
  VehicleInspection,
  WebhookEndpoint,
  WorkOrder,
  WorkshopVendor,
  WorkspaceSettings,
} from '../src/types/fleet.ts'
import {
  buildDefaultModulesDataset,
  DEFAULT_FLEETIO_SETTINGS,
  DEFAULT_WORKSPACE_SETTINGS,
} from '../src/utils/fleetioConfigStore.ts'

export interface OrgOperationalDataset {
  members: OrganizationMember[]
  vehicles: Vehicle[]
  drivers: Driver[]
  driverEvents: DriverBehaviorEvent[]
  driverAssignments: DriverAssignmentHistoryItem[]
  trips: Trip[]
  fuelTransactions: FuelTransaction[]
  maintenanceRecords: MaintenanceRecord[]
  inspections: VehicleInspection[]
  serviceSchedules: ServiceScheduleReminder[]
  smallIssues: SmallIssueLog[]
  workOrders: WorkOrder[]
  partsInventory: PartInventoryItem[]
  suppliers: SupplierRecord[]
  purchaseOrders: PurchaseOrder[]
  inventoryTransactions: InventoryTransaction[]
  workshops: WorkshopVendor[]
  invoices: FinancialInvoice[]
  payments: PaymentRecord[]
  documentVault: DocumentVaultItem[]
  tyrePositions: TyrePositionRecord[]
  alerts: OperationalAlert[]
  auditLogs: AuditLogEntry[]
  reports: ReportHistoryItem[]
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function ensureFleetSchemaAndMigrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS org_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_members_org ON org_members(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_vehicles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      registration_number TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      category TEXT NOT NULL,
      powertrain TEXT NOT NULL,
      fuel_type TEXT NOT NULL,
      year INTEGER NOT NULL,
      assigned_driver_id TEXT,
      odometer_km REAL NOT NULL DEFAULT 0,
      daily_avg_km REAL NOT NULL DEFAULT 0,
      health_score REAL NOT NULL DEFAULT 100,
      operation_status TEXT NOT NULL,
      fuel_or_soc_pct REAL NOT NULL DEFAULT 100,
      corridor_id TEXT NOT NULL,
      city_name TEXT NOT NULL,
      registration_expiry TEXT NOT NULL,
      insurance_expiry TEXT NOT NULL,
      insurance_provider TEXT NOT NULL,
      fitness_expiry TEXT,
      puc_expiry TEXT,
      permit_expiry TEXT,
      last_service_date TEXT NOT NULL,
      next_service_due_date TEXT NOT NULL,
      next_service_due_odometer_km REAL,
      monthly_revenue_inr REAL NOT NULL DEFAULT 0,
      specs_json TEXT,
      telemetry_json TEXT NOT NULL,
      decommissioned INTEGER NOT NULL DEFAULT 0,
      ownership_category TEXT NOT NULL DEFAULT 'company_owned',
      legal_owner_name TEXT,
      fleet_partner_id TEXT,
      individual_owner_id TEXT,
      active_contract_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_org ON fleet_vehicles(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_vehicle_components (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
      component_name TEXT NOT NULL,
      health_score REAL NOT NULL,
      status TEXT NOT NULL,
      wear_rate_per_1000km REAL NOT NULL,
      last_serviced_at TEXT NOT NULL,
      predicted_replacement_date TEXT NOT NULL,
      notes TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_vehicle_components_veh ON fleet_vehicle_components(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_fleet_vehicle_components_org ON fleet_vehicle_components(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_drivers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      employee_code TEXT,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      alternate_mobile TEXT,
      email TEXT NOT NULL,
      date_of_birth TEXT,
      city TEXT,
      state TEXT,
      address TEXT,
      blood_group TEXT,
      emergency_contact_name TEXT,
      emergency_contact_relation TEXT,
      emergency_contact_phone TEXT,
      license_number TEXT NOT NULL,
      license_categories_json TEXT,
      license_issuing_rto TEXT,
      license_issue_date TEXT,
      license_expiry TEXT NOT NULL,
      hazmat_endorsed INTEGER NOT NULL DEFAULT 0,
      hazmat_expiry TEXT,
      aadhaar_masked TEXT,
      pan_masked TEXT,
      medical_fitness_expiry TEXT,
      police_verification_status TEXT,
      digilocker_status TEXT,
      assigned_vehicle_id TEXT,
      operational_status TEXT NOT NULL,
      status TEXT NOT NULL,
      safety_score REAL NOT NULL,
      speeding_score REAL NOT NULL,
      braking_score REAL NOT NULL,
      acceleration_score REAL NOT NULL,
      cornering_score REAL NOT NULL,
      fatigue_compliance_score REAL NOT NULL,
      total_trips INTEGER NOT NULL DEFAULT 0,
      total_distance_km REAL NOT NULL DEFAULT 0,
      join_date TEXT NOT NULL,
      coaching_recommendations_json TEXT NOT NULL,
      data_confidence_note TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_drivers_org ON fleet_drivers(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_driver_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      trip_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      speed_kmh REAL NOT NULL,
      road_stress_context REAL NOT NULL,
      gps_accuracy_meters REAL NOT NULL,
      mount_stability_warning INTEGER NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      location_label TEXT NOT NULL,
      dispute_status TEXT NOT NULL,
      dispute_reason TEXT,
      dispute_resolution_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_driver_events_org ON fleet_driver_events(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_driver_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      vehicle_registration TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      unassigned_at TEXT,
      assigned_by TEXT NOT NULL,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_driver_assignments_org ON fleet_driver_assignments(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_trips (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      origin_address TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      start_lat REAL NOT NULL,
      start_lng REAL NOT NULL,
      end_lat REAL,
      end_lng REAL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      distance_km REAL NOT NULL,
      planned_distance_km REAL,
      duration_minutes REAL NOT NULL,
      planned_duration_minutes REAL,
      avg_speed_kmh REAL NOT NULL,
      max_speed_kmh REAL NOT NULL,
      status TEXT NOT NULL,
      truck_routing_mode TEXT,
      route_json TEXT NOT NULL,
      speed_timeline_json TEXT NOT NULL,
      stops_json TEXT NOT NULL,
      offline_synced INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_trips_org ON fleet_trips(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_fuel_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      trip_id TEXT,
      amount_inr REAL NOT NULL,
      liters_or_kwh REAL NOT NULL,
      unit_price_inr REAL NOT NULL,
      odometer_km REAL NOT NULL,
      station TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      timestamp TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      entry_source TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      payment_state TEXT,
      anomaly_flags_json TEXT NOT NULL,
      efficiency_km_per_unit REAL,
      cost_per_km_inr REAL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_fuel_org ON fleet_fuel_transactions(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_maintenance_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      service_type TEXT NOT NULL,
      component_name TEXT NOT NULL,
      service_center TEXT NOT NULL,
      workshop_id TEXT,
      description TEXT NOT NULL,
      cost_inr REAL NOT NULL,
      payment_state TEXT,
      bill_number TEXT,
      bill_file_name TEXT,
      downtime_days REAL NOT NULL,
      parts_replaced_json TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      odometer_at_service_km REAL,
      status TEXT NOT NULL,
      linked_prediction_id TEXT,
      linked_work_order_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_maintenance_org ON fleet_maintenance_records(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_inspections (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      inspector_name TEXT,
      timestamp TEXT NOT NULL,
      tyre_condition TEXT NOT NULL,
      brake_feel TEXT NOT NULL,
      fluid_leaks_detected INTEGER NOT NULL DEFAULT 0,
      warning_lights_on INTEGER NOT NULL DEFAULT 0,
      battery_or_starting_issue INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL,
      passed INTEGER NOT NULL DEFAULT 1,
      linked_issue_ids_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_inspections_org ON fleet_inspections(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_service_schedules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      title TEXT NOT NULL,
      health_area TEXT NOT NULL,
      interval_days INTEGER NOT NULL,
      interval_km REAL NOT NULL,
      due_date TEXT NOT NULL,
      due_odometer_km REAL NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_service_schedules_org ON fleet_service_schedules(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_small_issues (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL,
      driver_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      health_area TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      reported_at TEXT NOT NULL,
      linked_work_order_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_small_issues_org ON fleet_small_issues(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_work_orders (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      work_order_number TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      workshop_id TEXT,
      workshop_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      health_area TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      linked_issue_ids_json TEXT NOT NULL,
      tasks_json TEXT NOT NULL,
      parts_json TEXT NOT NULL,
      labor_cost_inr REAL NOT NULL,
      parts_cost_inr REAL NOT NULL,
      total_cost_inr REAL NOT NULL,
      payment_state TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      scheduled_for TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_work_orders_org ON fleet_work_orders(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_parts_inventory (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      stock_qty REAL NOT NULL,
      reorder_threshold REAL NOT NULL,
      unit_cost_inr REAL NOT NULL,
      preferred_supplier_id TEXT,
      warehouse_location TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_parts_org ON fleet_parts_inventory(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_suppliers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      gstin TEXT,
      city TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      lead_time_days INTEGER NOT NULL,
      rating REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_suppliers_org ON fleet_suppliers(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_purchase_orders (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      po_number TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      status TEXT NOT NULL,
      items_json TEXT NOT NULL,
      total_amount_inr REAL NOT NULL,
      payment_state TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expected_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_purchase_orders_org ON fleet_purchase_orders(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_inventory_transactions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      part_id TEXT NOT NULL,
      part_name TEXT NOT NULL,
      type TEXT NOT NULL,
      quantity_delta REAL NOT NULL,
      balance_after REAL NOT NULL,
      reference_type TEXT NOT NULL,
      reference_id TEXT NOT NULL,
      performed_by TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_inventory_tx_org ON fleet_inventory_transactions(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_workshops (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      specialties_json TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      sla_turnaround_hours REAL NOT NULL,
      avg_turnaround_hours REAL NOT NULL,
      completed_jobs_count INTEGER NOT NULL,
      total_spend_inr REAL NOT NULL,
      rating REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_workshops_org ON fleet_workshops(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      vendor_name TEXT NOT NULL,
      category TEXT NOT NULL,
      vehicle_id TEXT,
      reference_id TEXT,
      amount_inr REAL NOT NULL,
      paid_amount_inr REAL NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_invoices_org ON fleet_invoices(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      paid_at TEXT NOT NULL,
      recorded_by TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_payments_org ON fleet_payments(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_document_vault (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      document_number TEXT,
      masked_number TEXT,
      issuing_authority TEXT,
      issued_date TEXT,
      expiry_date TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      storage_key TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      verified_by TEXT,
      verified_at TEXT,
      rejection_reason TEXT,
      uploaded_by TEXT NOT NULL,
      uploaded_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_document_vault_org ON fleet_document_vault(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_tyre_positions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
      position TEXT NOT NULL,
      brand TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      tread_depth_mm REAL NOT NULL,
      installed_at_odometer_km REAL NOT NULL,
      expected_life_km REAL NOT NULL,
      status TEXT NOT NULL,
      last_inspected_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_tyres_org ON fleet_tyre_positions(organization_id);
    CREATE INDEX IF NOT EXISTS idx_fleet_tyres_veh ON fleet_tyre_positions(vehicle_id);

    CREATE TABLE IF NOT EXISTS fleet_alerts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      vehicle_id TEXT NOT NULL,
      driver_id TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source TEXT,
      timestamp TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      acknowledged INTEGER NOT NULL DEFAULT 0,
      action_route TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_alerts_org ON fleet_alerts(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      summary TEXT NOT NULL,
      reason TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_audit_logs_org ON fleet_audit_logs(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      environment TEXT NOT NULL DEFAULT 'production',
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      period TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      format TEXT NOT NULL,
      row_count INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_reports_org ON fleet_reports(organization_id);

    -- Fleetio Extension Module Tables
    CREATE TABLE IF NOT EXISTS fleet_tools (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      serial_number TEXT NOT NULL,
      category TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      purchase_cost_inr REAL NOT NULL DEFAULT 0,
      next_calibration_date TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_tools_org ON fleet_tools(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_warranties (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      vehicle_id TEXT,
      asset_name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      provider TEXT NOT NULL,
      coverage_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      max_odometer_km REAL NOT NULL,
      claim_status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_warranties_org ON fleet_warranties(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_custom_records (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      record_type TEXT NOT NULL,
      vehicle_or_driver TEXT NOT NULL,
      reference_code TEXT NOT NULL,
      recorded_date TEXT NOT NULL,
      amount_inr REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      notes TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_custom_records_org ON fleet_custom_records(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_service_tasks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      health_area TEXT NOT NULL,
      avg_hours REAL NOT NULL,
      est_cost_inr REAL NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_service_tasks_org ON fleet_service_tasks(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_service_programs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      powertrain TEXT NOT NULL,
      cadence TEXT NOT NULL,
      interval_km REAL NOT NULL,
      interval_days INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_service_programs_org ON fleet_service_programs(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_inspection_forms (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      items_count INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      checklist_items_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_inspection_forms_org ON fleet_inspection_forms(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_inspection_schedules (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      frequency TEXT NOT NULL,
      scope TEXT NOT NULL,
      form_id TEXT,
      form_title TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_inspection_schedules_org ON fleet_inspection_schedules(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_recalls (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      campaign TEXT NOT NULL,
      oem TEXT NOT NULL,
      target_make TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      issued_date TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_recalls_org ON fleet_recalls(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_api_keys (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      prefix TEXT NOT NULL,
      scope TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_used_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_api_keys_org ON fleet_api_keys(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_webhooks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      events_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      last_delivery_status INTEGER NOT NULL DEFAULT 200
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_webhooks_org ON fleet_webhooks(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_custom_dashboards (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      widgets TEXT NOT NULL,
      default_view INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_fleet_custom_dashboards_org ON fleet_custom_dashboards(organization_id);

    CREATE TABLE IF NOT EXISTS fleet_workspace_settings (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      workspace_settings_json TEXT NOT NULL,
      fleetio_settings_json TEXT NOT NULL,
      visited_integrations INTEGER NOT NULL DEFAULT 1,
      visited_reports INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `)

  // Safe migrations for multi-ownership vehicle columns on pre-existing DBs
  const vehCols = (db.prepare('PRAGMA table_info(fleet_vehicles)').all() as Array<{ name: string }>).map((c) => c.name)
  if (!vehCols.includes('ownership_category')) {
    db.exec("ALTER TABLE fleet_vehicles ADD COLUMN ownership_category TEXT NOT NULL DEFAULT 'company_owned'")
  }
  if (!vehCols.includes('legal_owner_name')) {
    db.exec('ALTER TABLE fleet_vehicles ADD COLUMN legal_owner_name TEXT')
  }
  if (!vehCols.includes('fleet_partner_id')) {
    db.exec('ALTER TABLE fleet_vehicles ADD COLUMN fleet_partner_id TEXT')
  }
  if (!vehCols.includes('individual_owner_id')) {
    db.exec('ALTER TABLE fleet_vehicles ADD COLUMN individual_owner_id TEXT')
  }
  if (!vehCols.includes('active_contract_id')) {
    db.exec('ALTER TABLE fleet_vehicles ADD COLUMN active_contract_id TEXT')
  }

  // 1. Idempotently migrate org_fleet_blobs into normalized relational tables
  const orgRows = db.prepare('SELECT * FROM organizations').all() as Array<Record<string, unknown>>
  for (const orgRow of orgRows) {
    const orgId = String(orgRow.id)
    const vehCount = (db.prepare('SELECT COUNT(*) AS count FROM fleet_vehicles WHERE organization_id = ?').get(orgId) as { count: number }).count
    const memCount = (db.prepare('SELECT COUNT(*) AS count FROM org_members WHERE organization_id = ?').get(orgId) as { count: number }).count
    const audCount = (db.prepare('SELECT COUNT(*) AS count FROM fleet_audit_logs WHERE organization_id = ?').get(orgId) as { count: number }).count

    if (vehCount === 0 && memCount === 0 && audCount === 0) {
      const blobRow = db
        .prepare('SELECT payload_json FROM org_fleet_blobs WHERE organization_id = ?')
        .get(orgId) as { payload_json: string } | undefined
      if (blobRow?.payload_json) {
        const parsed = parseJson<Partial<OrgOperationalDataset>>(blobRow.payload_json, {})
        saveOrgFleetDataset(db, orgId, parsed, false)
      }
    }

    // 2. Seed Fleetio module tables per org if fleet_workspace_settings row doesn't exist
    const settingsExists = db
      .prepare('SELECT organization_id FROM fleet_workspace_settings WHERE organization_id = ?')
      .get(orgId)
    if (!settingsExists) {
      const orgObj: Organization = {
        id: orgId,
        name: String(orgRow.name),
        code: String(orgRow.code),
        city: String(orgRow.city),
        state: String(orgRow.state),
        timezone: String(orgRow.timezone),
        currency: 'INR',
        planId: String(orgRow.plan_id) as Organization['planId'],
        vehicleLimit: Number(orgRow.vehicle_limit),
        driverLimit: Number(orgRow.driver_limit),
        status: String(orgRow.status) as Organization['status'],
        paymentStatus: String(orgRow.payment_status) as Organization['paymentStatus'],
        subscriptionStartDate: String(orgRow.subscription_start_date),
        subscriptionExpiryDate: String(orgRow.subscription_expiry_date),
        createdAt: String(orgRow.created_at),
        environment: 'production',
      }
      const dataset = getOrgFleetDataset(db, orgId)
      seedOrgFleetModules(db, orgObj, dataset.vehicles)
    }
  }
}

export function seedOrgFleetModules(db: DatabaseSync, org: Organization, vehicles: Vehicle[]): void {
  const defaults = buildDefaultModulesDataset(org, vehicles)
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    const insertTool = db.prepare(`
      INSERT OR IGNORE INTO fleet_tools (
        id, organization_id, name, serial_number, category, assigned_to, location, status, purchase_cost_inr, next_calibration_date, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const t of defaults.tools) {
      insertTool.run(`${org.id}-${t.id}`, org.id, t.name, t.serialNumber, t.category, t.assignedTo, t.location, t.status, t.purchaseCostInr, t.nextCalibrationDate, nowIso)
    }

    const insertWarranty = db.prepare(`
      INSERT OR IGNORE INTO fleet_warranties (
        id, organization_id, vehicle_id, asset_name, registration_number, provider, coverage_type, start_date, expiry_date, max_odometer_km, claim_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const w of defaults.warranties) {
      const matchedVeh = vehicles.find((v) => v.registrationNumber === w.registrationNumber)
      insertWarranty.run(`${org.id}-${w.id}`, org.id, matchedVeh?.id ?? null, w.assetName, w.registrationNumber, w.provider, w.coverageType, w.startDate, w.expiryDate, w.maxOdometerKm, w.claimStatus, nowIso)
    }

    const insertCustomRecord = db.prepare(`
      INSERT OR IGNORE INTO fleet_custom_records (
        id, organization_id, record_type, vehicle_or_driver, reference_code, recorded_date, amount_inr, status, notes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const cr of defaults.customRecords) {
      insertCustomRecord.run(`${org.id}-${cr.id}`, org.id, cr.recordType, cr.vehicleOrDriver, cr.referenceCode, cr.recordedDate, cr.amountInr, cr.status, cr.notes, nowIso)
    }

    const insertTask = db.prepare(`
      INSERT OR IGNORE INTO fleet_service_tasks (
        id, organization_id, code, title, health_area, avg_hours, est_cost_inr, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const st of defaults.serviceTasks) {
      insertTask.run(`${org.id}-${st.id}`, org.id, st.code, st.title, st.area, st.avgHours, st.estCostInr, st.active ? 1 : 0)
    }

    const insertProg = db.prepare(`
      INSERT OR IGNORE INTO fleet_service_programs (
        id, organization_id, name, powertrain, cadence, interval_km, interval_days, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const sp of defaults.servicePrograms) {
      insertProg.run(`${org.id}-${sp.id}`, org.id, sp.name, sp.powertrain, sp.cadence, sp.intervalKm, sp.intervalDays, sp.active ? 1 : 0)
    }

    const insertForm = db.prepare(`
      INSERT OR IGNORE INTO fleet_inspection_forms (
        id, organization_id, title, items_count, last_updated, active, checklist_items_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const f of defaults.inspectionForms) {
      insertForm.run(`${org.id}-${f.id}`, org.id, f.title, f.itemsCount, f.lastUpdated, f.active ? 1 : 0, f.checklistItems ? JSON.stringify(f.checklistItems) : null)
    }

    const insertSched = db.prepare(`
      INSERT OR IGNORE INTO fleet_inspection_schedules (
        id, organization_id, name, frequency, scope, form_id, form_title, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const s of defaults.inspectionSchedules) {
      insertSched.run(`${org.id}-${s.id}`, org.id, s.name, s.frequency, s.scope, s.formId ? `${org.id}-${s.formId}` : null, s.formTitle, s.active ? 1 : 0)
    }

    const insertRecall = db.prepare(`
      INSERT OR IGNORE INTO fleet_recalls (
        id, organization_id, campaign, oem, target_make, severity, status, notes, issued_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const r of defaults.recalls) {
      insertRecall.run(`${org.id}-${r.id}`, org.id, r.campaign, r.oem, r.targetMake, r.severity, r.status, r.notes ?? null, r.issuedDate)
    }

    const insertKey = db.prepare(`
      INSERT OR IGNORE INTO fleet_api_keys (
        id, organization_id, label, prefix, scope, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const k of defaults.apiKeys) {
      insertKey.run(k.id, org.id, k.label, k.prefix, k.scope, k.createdAt, k.lastUsedAt)
    }

    const insertHook = db.prepare(`
      INSERT OR IGNORE INTO fleet_webhooks (
        id, organization_id, url, events_json, active, last_delivery_status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const h of defaults.webhooks) {
      insertHook.run(h.id, org.id, h.url, JSON.stringify(h.events), h.active ? 1 : 0, h.lastDeliveryStatus)
    }

    const insertDash = db.prepare(`
      INSERT OR IGNORE INTO fleet_custom_dashboards (
        id, organization_id, name, widgets, default_view
      ) VALUES (?, ?, ?, ?, ?)
    `)
    for (const d of defaults.customDashboards) {
      insertDash.run(`${org.id}-${d.id}`, org.id, d.name, d.widgets, d.defaultView ? 1 : 0)
    }

    db.prepare(`
      INSERT OR IGNORE INTO fleet_workspace_settings (
        organization_id, workspace_settings_json, fleetio_settings_json, visited_integrations, visited_reports, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      org.id,
      JSON.stringify(defaults.workspaceSettings),
      JSON.stringify(defaults.fleetioSettings),
      defaults.visitedIntegrations ? 1 : 0,
      defaults.visitedReports ? 1 : 0,
      nowIso,
    )

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function getOrgFleetDataset(db: DatabaseSync, orgId: string): OrgOperationalDataset {
  const membersRows = db.prepare('SELECT * FROM org_members WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  const members: OrganizationMember[] = membersRows.map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    userId: String(r.user_id),
    username: r.username ? String(r.username) : undefined,
    fullName: String(r.full_name),
    email: String(r.email),
    role: String(r.role) as OrganizationMember['role'],
    status: String(r.status) as OrganizationMember['status'],
    lastActiveAt: String(r.last_active_at),
  }))

  const compRows = db.prepare('SELECT * FROM fleet_vehicle_components WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  const compsByVehicle = new Map<string, VehicleComponent[]>()
  for (const r of compRows) {
    const vid = String(r.vehicle_id)
    const list = compsByVehicle.get(vid) ?? []
    list.push({
      id: String(r.id),
      vehicleId: vid,
      componentName: String(r.component_name) as VehicleComponent['componentName'],
      healthScore: Number(r.health_score),
      status: String(r.status) as VehicleComponent['status'],
      wearRatePer1000Km: Number(r.wear_rate_per_1000km),
      lastServicedAt: String(r.last_serviced_at),
      predictedReplacementDate: String(r.predicted_replacement_date),
      notes: String(r.notes),
    })
    compsByVehicle.set(vid, list)
  }

  const vehRows = db.prepare('SELECT * FROM fleet_vehicles WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  const vehicles: Vehicle[] = vehRows.map((r) => {
    const id = String(r.id)
    return {
      id,
      organizationId: String(r.organization_id),
      environment: 'production',
      registrationNumber: String(r.registration_number),
      make: String(r.make),
      model: String(r.model),
      category: String(r.category) as Vehicle['category'],
      powertrain: String(r.powertrain) as Vehicle['powertrain'],
      fuelType: String(r.fuel_type) as Vehicle['fuelType'],
      year: Number(r.year),
      assignedDriverId: r.assigned_driver_id ? String(r.assigned_driver_id) : null,
      odometerKm: Number(r.odometer_km),
      dailyAvgKm: Number(r.daily_avg_km),
      healthScore: Number(r.health_score),
      operationStatus: String(r.operation_status) as Vehicle['operationStatus'],
      fuelOrSocPct: Number(r.fuel_or_soc_pct),
      corridorId: String(r.corridor_id),
      cityName: String(r.city_name),
      registrationExpiry: String(r.registration_expiry),
      insuranceExpiry: String(r.insurance_expiry),
      insuranceProvider: String(r.insurance_provider),
      fitnessExpiry: r.fitness_expiry ? String(r.fitness_expiry) : undefined,
      pucExpiry: r.puc_expiry ? String(r.puc_expiry) : undefined,
      permitExpiry: r.permit_expiry ? String(r.permit_expiry) : undefined,
      lastServiceDate: String(r.last_service_date),
      nextServiceDueDate: String(r.next_service_due_date),
      nextServiceDueOdometerKm: r.next_service_due_odometer_km != null ? Number(r.next_service_due_odometer_km) : undefined,
      monthlyRevenueInr: Number(r.monthly_revenue_inr),
      specs: r.specs_json ? parseJson<Vehicle['specs']>(r.specs_json, undefined) : undefined,
      telemetry: parseJson<Vehicle['telemetry']>(r.telemetry_json, {
        vehicleId: id,
        location: { lat: 13.0827, lng: 80.2707 },
        cityLabel: String(r.city_name),
        speedKmh: 0,
        heading: 0,
        gpsAccuracyMeters: 10,
        signalQualityPct: 90,
        connectionState: 'connected',
        source: 'smartphone_gps',
        lastUpdatedAt: new Date().toISOString(),
        motionPermissionGranted: true,
      }),
      components: compsByVehicle.get(id) ?? [],
      decommissioned: Number(r.decommissioned) === 1,
      ownershipCategory: (r.ownership_category ? String(r.ownership_category) : 'company_owned') as Vehicle['ownershipCategory'],
      legalOwnerName: r.legal_owner_name ? String(r.legal_owner_name) : undefined,
      fleetPartnerId: r.fleet_partner_id ? String(r.fleet_partner_id) : null,
      individualOwnerId: r.individual_owner_id ? String(r.individual_owner_id) : null,
      activeContractId: r.active_contract_id ? String(r.active_contract_id) : null,
    }
  })

  const drvRows = db.prepare('SELECT * FROM fleet_drivers WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>
  const drivers: Driver[] = drvRows.map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    employeeCode: r.employee_code ? String(r.employee_code) : undefined,
    name: String(r.name),
    mobile: String(r.mobile),
    alternateMobile: r.alternate_mobile ? String(r.alternate_mobile) : undefined,
    email: String(r.email),
    dateOfBirth: r.date_of_birth ? String(r.date_of_birth) : undefined,
    city: r.city ? String(r.city) : undefined,
    state: r.state ? String(r.state) : undefined,
    address: r.address ? String(r.address) : undefined,
    bloodGroup: r.blood_group ? String(r.blood_group) : undefined,
    emergencyContactName: r.emergency_contact_name ? String(r.emergency_contact_name) : undefined,
    emergencyContactRelation: r.emergency_contact_relation ? String(r.emergency_contact_relation) : undefined,
    emergencyContactPhone: r.emergency_contact_phone ? String(r.emergency_contact_phone) : undefined,
    licenseNumber: String(r.license_number),
    licenseCategories: r.license_categories_json ? parseJson(r.license_categories_json, undefined) : undefined,
    licenseIssuingRto: r.license_issuing_rto ? String(r.license_issuing_rto) : undefined,
    licenseIssueDate: r.license_issue_date ? String(r.license_issue_date) : undefined,
    licenseExpiry: String(r.license_expiry),
    hazmatEndorsed: Number(r.hazmat_endorsed) === 1,
    hazmatExpiry: r.hazmat_expiry ? String(r.hazmat_expiry) : undefined,
    aadhaarMasked: r.aadhaar_masked ? String(r.aadhaar_masked) : undefined,
    panMasked: r.pan_masked ? String(r.pan_masked) : undefined,
    medicalFitnessExpiry: r.medical_fitness_expiry ? String(r.medical_fitness_expiry) : undefined,
    policeVerificationStatus: r.police_verification_status ? (String(r.police_verification_status) as Driver['policeVerificationStatus']) : undefined,
    digilockerStatus: r.digilocker_status ? (String(r.digilocker_status) as Driver['digilockerStatus']) : undefined,
    assignedVehicleId: r.assigned_vehicle_id ? String(r.assigned_vehicle_id) : null,
    operationalStatus: String(r.operational_status) as Driver['operationalStatus'],
    status: String(r.status) as Driver['status'],
    safetyScore: Number(r.safety_score),
    speedingScore: Number(r.speeding_score),
    brakingScore: Number(r.braking_score),
    accelerationScore: Number(r.acceleration_score),
    corneringScore: Number(r.cornering_score),
    fatigueComplianceScore: Number(r.fatigue_compliance_score),
    totalTrips: Number(r.total_trips),
    totalDistanceKm: Number(r.total_distance_km),
    joinDate: String(r.join_date),
    coachingRecommendations: parseJson<string[]>(r.coaching_recommendations_json, []),
    dataConfidenceNote: String(r.data_confidence_note),
  }))

  const driverEvents = (db.prepare('SELECT * FROM fleet_driver_events WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): DriverBehaviorEvent => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    driverId: String(r.driver_id),
    vehicleId: String(r.vehicle_id),
    tripId: String(r.trip_id),
    eventType: String(r.event_type) as DriverBehaviorEvent['eventType'],
    severity: String(r.severity) as DriverBehaviorEvent['severity'],
    speedKmh: Number(r.speed_kmh),
    roadStressContext: Number(r.road_stress_context),
    gpsAccuracyMeters: Number(r.gps_accuracy_meters),
    mountStabilityWarning: Number(r.mount_stability_warning) === 1,
    timestamp: String(r.timestamp),
    locationLabel: String(r.location_label),
    disputeStatus: String(r.dispute_status) as DriverBehaviorEvent['disputeStatus'],
    disputeReason: r.dispute_reason ? String(r.dispute_reason) : undefined,
    disputeResolutionNote: r.dispute_resolution_note ? String(r.dispute_resolution_note) : undefined,
  }))

  const driverAssignments = (db.prepare('SELECT * FROM fleet_driver_assignments WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): DriverAssignmentHistoryItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    driverId: String(r.driver_id),
    vehicleId: String(r.vehicle_id),
    vehicleRegistration: String(r.vehicle_registration),
    assignedAt: String(r.assigned_at),
    unassignedAt: r.unassigned_at ? String(r.unassigned_at) : undefined,
    assignedBy: String(r.assigned_by),
    notes: r.notes ? String(r.notes) : undefined,
  }))

  const trips = (db.prepare('SELECT * FROM fleet_trips WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): Trip => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    vehicleId: String(r.vehicle_id),
    driverId: String(r.driver_id),
    originAddress: String(r.origin_address),
    destinationAddress: String(r.destination_address),
    startLocation: { lat: Number(r.start_lat), lng: Number(r.start_lng) },
    endLocation: r.end_lat != null && r.end_lng != null ? { lat: Number(r.end_lat), lng: Number(r.end_lng) } : undefined,
    startTime: String(r.start_time),
    endTime: r.end_time ? String(r.end_time) : undefined,
    distanceKm: Number(r.distance_km),
    plannedDistanceKm: r.planned_distance_km != null ? Number(r.planned_distance_km) : undefined,
    durationMinutes: Number(r.duration_minutes),
    plannedDurationMinutes: r.planned_duration_minutes != null ? Number(r.planned_duration_minutes) : undefined,
    avgSpeedKmh: Number(r.avg_speed_kmh),
    maxSpeedKmh: Number(r.max_speed_kmh),
    status: String(r.status) as Trip['status'],
    truckRoutingMode: r.truck_routing_mode ? (String(r.truck_routing_mode) as Trip['truckRoutingMode']) : undefined,
    route: parseJson(r.route_json, []),
    speedTimeline: parseJson(r.speed_timeline_json, []),
    stops: parseJson(r.stops_json, []),
    offlineSynced: Number(r.offline_synced) === 1,
  }))

  const fuelTransactions = (db.prepare('SELECT * FROM fleet_fuel_transactions WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): FuelTransaction => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    vehicleId: String(r.vehicle_id),
    driverId: String(r.driver_id),
    tripId: r.trip_id ? String(r.trip_id) : undefined,
    amountInr: Number(r.amount_inr),
    litersOrKwh: Number(r.liters_or_kwh),
    unitPriceInr: Number(r.unit_price_inr),
    odometerKm: Number(r.odometer_km),
    station: String(r.station),
    location: { lat: Number(r.lat), lng: Number(r.lng) },
    timestamp: String(r.timestamp),
    paymentMethod: String(r.payment_method) as FuelTransaction['paymentMethod'],
    entrySource: String(r.entry_source) as FuelTransaction['entrySource'],
    verificationStatus: String(r.verification_status) as FuelTransaction['verificationStatus'],
    paymentState: r.payment_state ? (String(r.payment_state) as FuelTransaction['paymentState']) : undefined,
    anomalyFlags: parseJson(r.anomaly_flags_json, []),
    efficiencyKmPerUnit: r.efficiency_km_per_unit != null ? Number(r.efficiency_km_per_unit) : undefined,
    costPerKmInr: r.cost_per_km_inr != null ? Number(r.cost_per_km_inr) : undefined,
  }))

  const maintenanceRecords = (db.prepare('SELECT * FROM fleet_maintenance_records WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): MaintenanceRecord => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    vehicleId: String(r.vehicle_id),
    serviceType: String(r.service_type),
    componentName: String(r.component_name) as MaintenanceRecord['componentName'],
    serviceCenter: String(r.service_center),
    workshopId: r.workshop_id ? String(r.workshop_id) : undefined,
    description: String(r.description),
    costInr: Number(r.cost_inr),
    paymentState: r.payment_state ? (String(r.payment_state) as MaintenanceRecord['paymentState']) : undefined,
    billNumber: r.bill_number ? String(r.bill_number) : undefined,
    billFileName: r.bill_file_name ? String(r.bill_file_name) : undefined,
    downtimeDays: Number(r.downtime_days),
    partsReplaced: parseJson(r.parts_replaced_json, []),
    performedAt: String(r.performed_at),
    odometerAtServiceKm: r.odometer_at_service_km != null ? Number(r.odometer_at_service_km) : undefined,
    status: String(r.status) as MaintenanceRecord['status'],
    linkedPredictionId: r.linked_prediction_id ? String(r.linked_prediction_id) : undefined,
    linkedWorkOrderId: r.linked_work_order_id ? String(r.linked_work_order_id) : undefined,
  }))

  const inspections = (db.prepare('SELECT * FROM fleet_inspections WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): VehicleInspection => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    vehicleId: String(r.vehicle_id),
    driverId: String(r.driver_id),
    inspectorName: r.inspector_name ? String(r.inspector_name) : undefined,
    timestamp: String(r.timestamp),
    tyreCondition: String(r.tyre_condition) as VehicleInspection['tyreCondition'],
    brakeFeel: String(r.brake_feel) as VehicleInspection['brakeFeel'],
    fluidLeaksDetected: Number(r.fluid_leaks_detected) === 1,
    warningLightsOn: Number(r.warning_lights_on) === 1,
    batteryOrStartingIssue: Number(r.battery_or_starting_issue) === 1,
    notes: String(r.notes),
    passed: Number(r.passed) === 1,
    linkedIssueIds: r.linked_issue_ids_json ? parseJson(r.linked_issue_ids_json, undefined) : undefined,
  }))

  const serviceSchedules = (db.prepare('SELECT * FROM fleet_service_schedules WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): ServiceScheduleReminder => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    vehicleId: String(r.vehicle_id),
    title: String(r.title),
    healthArea: String(r.health_area) as ServiceScheduleReminder['healthArea'],
    intervalDays: Number(r.interval_days),
    intervalKm: Number(r.interval_km),
    dueDate: String(r.due_date),
    dueOdometerKm: Number(r.due_odometer_km),
    priority: String(r.priority) as ServiceScheduleReminder['priority'],
    status: String(r.status) as ServiceScheduleReminder['status'],
  }))

  const smallIssues = (db.prepare('SELECT * FROM fleet_small_issues WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): SmallIssueLog => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    vehicleId: String(r.vehicle_id),
    driverId: r.driver_id ? String(r.driver_id) : undefined,
    title: String(r.title),
    description: String(r.description),
    healthArea: String(r.health_area) as SmallIssueLog['healthArea'],
    severity: String(r.severity) as SmallIssueLog['severity'],
    status: String(r.status) as SmallIssueLog['status'],
    source: String(r.source) as SmallIssueLog['source'],
    reportedBy: String(r.reported_by),
    reportedAt: String(r.reported_at),
    linkedWorkOrderId: r.linked_work_order_id ? String(r.linked_work_order_id) : undefined,
  }))

  const workOrders = (db.prepare('SELECT * FROM fleet_work_orders WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): WorkOrder => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    workOrderNumber: String(r.work_order_number),
    vehicleId: String(r.vehicle_id),
    workshopId: r.workshop_id ? String(r.workshop_id) : undefined,
    workshopName: String(r.workshop_name),
    title: String(r.title),
    description: String(r.description),
    healthArea: String(r.health_area) as WorkOrder['healthArea'],
    priority: String(r.priority) as WorkOrder['priority'],
    status: String(r.status) as WorkOrder['status'],
    linkedIssueIds: parseJson(r.linked_issue_ids_json, []),
    tasks: parseJson(r.tasks_json, []),
    parts: parseJson(r.parts_json, []),
    laborCostInr: Number(r.labor_cost_inr),
    partsCostInr: Number(r.parts_cost_inr),
    totalCostInr: Number(r.total_cost_inr),
    paymentState: String(r.payment_state) as WorkOrder['paymentState'],
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    scheduledFor: r.scheduled_for ? String(r.scheduled_for) : undefined,
    completedAt: r.completed_at ? String(r.completed_at) : undefined,
  }))

  const partsInventory = (db.prepare('SELECT * FROM fleet_parts_inventory WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): PartInventoryItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    sku: String(r.sku),
    name: String(r.name),
    category: String(r.category) as PartInventoryItem['category'],
    unit: String(r.unit),
    stockQty: Number(r.stock_qty),
    reorderThreshold: Number(r.reorder_threshold),
    unitCostInr: Number(r.unit_cost_inr),
    preferredSupplierId: r.preferred_supplier_id ? String(r.preferred_supplier_id) : undefined,
    warehouseLocation: String(r.warehouse_location),
    updatedAt: String(r.updated_at),
  }))

  const suppliers = (db.prepare('SELECT * FROM fleet_suppliers WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): SupplierRecord => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    gstin: r.gstin ? String(r.gstin) : undefined,
    city: String(r.city),
    contactName: String(r.contact_name),
    phone: String(r.phone),
    email: String(r.email),
    leadTimeDays: Number(r.lead_time_days),
    rating: Number(r.rating),
  }))

  const purchaseOrders = (db.prepare('SELECT * FROM fleet_purchase_orders WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): PurchaseOrder => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    poNumber: String(r.po_number),
    supplierId: String(r.supplier_id),
    supplierName: String(r.supplier_name),
    status: String(r.status) as PurchaseOrder['status'],
    items: parseJson(r.items_json, []),
    totalAmountInr: Number(r.total_amount_inr),
    paymentState: String(r.payment_state) as PurchaseOrder['paymentState'],
    createdAt: String(r.created_at),
    expectedAt: r.expected_at ? String(r.expected_at) : undefined,
  }))

  const inventoryTransactions = (db.prepare('SELECT * FROM fleet_inventory_transactions WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): InventoryTransaction => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    partId: String(r.part_id),
    partName: String(r.part_name),
    type: String(r.type) as InventoryTransaction['type'],
    quantityDelta: Number(r.quantity_delta),
    balanceAfter: Number(r.balance_after),
    referenceType: String(r.reference_type) as InventoryTransaction['referenceType'],
    referenceId: String(r.reference_id),
    performedBy: String(r.performed_by),
    timestamp: String(r.timestamp),
  }))

  const workshops = (db.prepare('SELECT * FROM fleet_workshops WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): WorkshopVendor => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    city: String(r.city),
    specialties: parseJson(r.specialties_json, []),
    contactPhone: String(r.contact_phone),
    slaTurnaroundHours: Number(r.sla_turnaround_hours),
    avgTurnaroundHours: Number(r.avg_turnaround_hours),
    completedJobsCount: Number(r.completed_jobs_count),
    totalSpendInr: Number(r.total_spend_inr),
    rating: Number(r.rating),
  }))

  const invoices = (db.prepare('SELECT * FROM fleet_invoices WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): FinancialInvoice => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    invoiceNumber: String(r.invoice_number),
    vendorName: String(r.vendor_name),
    category: String(r.category) as FinancialInvoice['category'],
    vehicleId: r.vehicle_id ? String(r.vehicle_id) : undefined,
    referenceId: r.reference_id ? String(r.reference_id) : undefined,
    amountInr: Number(r.amount_inr),
    paidAmountInr: Number(r.paid_amount_inr),
    status: String(r.status) as FinancialInvoice['status'],
    dueDate: String(r.due_date),
    issuedDate: String(r.issued_date),
    notes: r.notes ? String(r.notes) : undefined,
  }))

  const payments = (db.prepare('SELECT * FROM fleet_payments WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): PaymentRecord => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    invoiceId: String(r.invoice_id),
    invoiceNumber: String(r.invoice_number),
    amountInr: Number(r.amount_inr),
    paymentMethod: String(r.payment_method) as PaymentRecord['paymentMethod'],
    referenceNumber: String(r.reference_number),
    paidAt: String(r.paid_at),
    recordedBy: String(r.recorded_by),
  }))

  const documentVault = (db.prepare('SELECT * FROM fleet_document_vault WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): DocumentVaultItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    entityType: String(r.entity_type) as DocumentVaultItem['entityType'],
    entityId: String(r.entity_id),
    category: String(r.category),
    title: String(r.title),
    documentNumber: r.document_number ? String(r.document_number) : undefined,
    maskedNumber: r.masked_number ? String(r.masked_number) : undefined,
    issuingAuthority: r.issuing_authority ? String(r.issuing_authority) : undefined,
    issuedDate: r.issued_date ? String(r.issued_date) : undefined,
    expiryDate: r.expiry_date ? String(r.expiry_date) : undefined,
    fileName: String(r.file_name),
    mimeType: String(r.mime_type),
    fileSizeBytes: Number(r.file_size_bytes),
    storageKey: String(r.storage_key),
    verificationStatus: String(r.verification_status) as DocumentVaultItem['verificationStatus'],
    verifiedBy: r.verified_by ? String(r.verified_by) : undefined,
    verifiedAt: r.verified_at ? String(r.verified_at) : undefined,
    rejectionReason: r.rejection_reason ? String(r.rejection_reason) : undefined,
    uploadedBy: String(r.uploaded_by),
    uploadedAt: String(r.uploaded_at),
  }))

  const tyrePositions = (db.prepare('SELECT * FROM fleet_tyre_positions WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): TyrePositionRecord => ({
    id: String(r.id),
    vehicleId: String(r.vehicle_id),
    position: String(r.position),
    brand: String(r.brand),
    serialNumber: String(r.serial_number),
    treadDepthMm: Number(r.tread_depth_mm),
    installedAtOdometerKm: Number(r.installed_at_odometer_km),
    expectedLifeKm: Number(r.expected_life_km),
    status: String(r.status) as TyrePositionRecord['status'],
    lastInspectedAt: String(r.last_inspected_at),
  }))

  const alerts = (db.prepare('SELECT * FROM fleet_alerts WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): OperationalAlert => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    vehicleId: String(r.vehicle_id),
    driverId: r.driver_id ? String(r.driver_id) : undefined,
    category: String(r.category) as OperationalAlert['category'],
    severity: String(r.severity) as OperationalAlert['severity'],
    title: String(r.title),
    message: String(r.message),
    source: r.source ? String(r.source) : undefined,
    timestamp: String(r.timestamp),
    read: Number(r.read) === 1,
    acknowledged: Number(r.acknowledged) === 1,
    actionRoute: String(r.action_route),
  }))

  const auditLogs = (db.prepare('SELECT * FROM fleet_audit_logs WHERE organization_id = ? ORDER BY timestamp DESC').all(orgId) as Array<Record<string, unknown>>).map((r): AuditLogEntry => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    actorName: String(r.actor_name),
    actorRole: String(r.actor_role) as AuditLogEntry['actorRole'],
    action: String(r.action),
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    summary: String(r.summary),
    reason: r.reason ? String(r.reason) : undefined,
    timestamp: String(r.timestamp),
  }))

  const reports = (db.prepare('SELECT * FROM fleet_reports WHERE organization_id = ? ORDER BY generated_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r): ReportHistoryItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    environment: 'production',
    categoryId: String(r.category_id),
    title: String(r.title),
    period: String(r.period) as ReportHistoryItem['period'],
    generatedBy: String(r.generated_by),
    generatedAt: String(r.generated_at),
    format: String(r.format) as ReportHistoryItem['format'],
    rowCount: Number(r.row_count),
  }))

  return {
    members,
    vehicles,
    drivers,
    driverEvents,
    driverAssignments,
    trips,
    fuelTransactions,
    maintenanceRecords,
    inspections,
    serviceSchedules,
    smallIssues,
    workOrders,
    partsInventory,
    suppliers,
    purchaseOrders,
    inventoryTransactions,
    workshops,
    invoices,
    payments,
    documentVault,
    tyrePositions,
    alerts,
    auditLogs,
    reports,
  }
}

export function saveOrgFleetDataset(
  db: DatabaseSync,
  orgId: string,
  data: Partial<OrgOperationalDataset>,
  updateBlobCache = true,
): string {
  const nowIso = new Date().toISOString()

  db.exec('BEGIN IMMEDIATE')
  try {
    if (Array.isArray(data.members)) {
      db.prepare('DELETE FROM org_members WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO org_members (id, organization_id, user_id, username, full_name, email, role, status, last_active_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const m of data.members) {
        ins.run(m.id, orgId, m.userId, m.username ?? null, m.fullName, m.email, m.role, m.status, m.lastActiveAt)
      }
    }

    if (Array.isArray(data.vehicles)) {
      db.prepare('DELETE FROM fleet_tyre_positions WHERE organization_id = ?').run(orgId)
      db.prepare('DELETE FROM fleet_vehicle_components WHERE organization_id = ?').run(orgId)
      db.prepare('DELETE FROM fleet_vehicles WHERE organization_id = ?').run(orgId)

      const insVeh = db.prepare(`
        INSERT OR REPLACE INTO fleet_vehicles (
          id, organization_id, environment, registration_number, make, model, category, powertrain, fuel_type, year,
          assigned_driver_id, odometer_km, daily_avg_km, health_score, operation_status, fuel_or_soc_pct,
          corridor_id, city_name, registration_expiry, insurance_expiry, insurance_provider,
          fitness_expiry, puc_expiry, permit_expiry, last_service_date, next_service_due_date,
          next_service_due_odometer_km, monthly_revenue_inr, specs_json, telemetry_json, decommissioned,
          ownership_category, legal_owner_name, fleet_partner_id, individual_owner_id, active_contract_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const insComp = db.prepare(`
        INSERT OR REPLACE INTO fleet_vehicle_components (
          id, organization_id, vehicle_id, component_name, health_score, status, wear_rate_per_1000km, last_serviced_at, predicted_replacement_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const vehicleIdSet = new Set<string>()
      for (const v of data.vehicles) {
        vehicleIdSet.add(v.id)
        insVeh.run(
          v.id,
          orgId,
          v.environment ?? 'production',
          v.registrationNumber,
          v.make,
          v.model,
          v.category,
          v.powertrain,
          v.fuelType,
          v.year,
          v.assignedDriverId ?? null,
          v.odometerKm,
          v.dailyAvgKm,
          v.healthScore,
          v.operationStatus,
          v.fuelOrSocPct,
          v.corridorId,
          v.cityName,
          v.registrationExpiry,
          v.insuranceExpiry,
          v.insuranceProvider,
          v.fitnessExpiry ?? null,
          v.pucExpiry ?? null,
          v.permitExpiry ?? null,
          v.lastServiceDate,
          v.nextServiceDueDate,
          v.nextServiceDueOdometerKm ?? null,
          v.monthlyRevenueInr,
          v.specs ? JSON.stringify(v.specs) : null,
          JSON.stringify(v.telemetry),
          v.decommissioned ? 1 : 0,
          v.ownershipCategory ?? 'company_owned',
          v.legalOwnerName ?? null,
          v.fleetPartnerId ?? null,
          v.individualOwnerId ?? null,
          v.activeContractId ?? null,
        )
        for (const c of v.components ?? []) {
          insComp.run(
            c.id,
            orgId,
            v.id,
            c.componentName,
            c.healthScore,
            c.status,
            c.wearRatePer1000Km,
            c.lastServicedAt,
            c.predictedReplacementDate,
            c.notes,
          )
        }
      }

      if (Array.isArray(data.tyrePositions)) {
        const insTyre = db.prepare(`
          INSERT OR REPLACE INTO fleet_tyre_positions (
            id, organization_id, vehicle_id, position, brand, serial_number, tread_depth_mm, installed_at_odometer_km, expected_life_km, status, last_inspected_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        for (const t of data.tyrePositions) {
          if (!vehicleIdSet.has(t.vehicleId)) continue
          insTyre.run(
            t.id,
            orgId,
            t.vehicleId,
            t.position,
            t.brand,
            t.serialNumber,
            t.treadDepthMm,
            t.installedAtOdometerKm,
            t.expectedLifeKm,
            t.status,
            t.lastInspectedAt,
          )
        }
      }
    } else if (Array.isArray(data.tyrePositions)) {
      const vehRows = db.prepare('SELECT id FROM fleet_vehicles WHERE organization_id = ?').all(orgId) as Array<{ id: string }>
      const validIds = new Set(vehRows.map((r) => r.id))
      db.prepare('DELETE FROM fleet_tyre_positions WHERE organization_id = ?').run(orgId)
      const insTyre = db.prepare(`
        INSERT OR REPLACE INTO fleet_tyre_positions (
          id, organization_id, vehicle_id, position, brand, serial_number, tread_depth_mm, installed_at_odometer_km, expected_life_km, status, last_inspected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const t of data.tyrePositions) {
        if (!validIds.has(t.vehicleId)) continue
        insTyre.run(
          t.id,
          orgId,
          t.vehicleId,
          t.position,
          t.brand,
          t.serialNumber,
          t.treadDepthMm,
          t.installedAtOdometerKm,
          t.expectedLifeKm,
          t.status,
          t.lastInspectedAt,
        )
      }
    }

    if (Array.isArray(data.drivers)) {
      db.prepare('DELETE FROM fleet_drivers WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_drivers (
          id, organization_id, environment, employee_code, name, mobile, alternate_mobile, email, date_of_birth,
          city, state, address, blood_group, emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
          license_number, license_categories_json, license_issuing_rto, license_issue_date, license_expiry,
          hazmat_endorsed, hazmat_expiry, aadhaar_masked, pan_masked, medical_fitness_expiry, police_verification_status,
          digilocker_status, assigned_vehicle_id, operational_status, status, safety_score, speeding_score,
          braking_score, acceleration_score, cornering_score, fatigue_compliance_score, total_trips, total_distance_km,
          join_date, coaching_recommendations_json, data_confidence_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const d of data.drivers) {
        ins.run(
          d.id, orgId, d.environment ?? 'production', d.employeeCode ?? null, d.name, d.mobile, d.alternateMobile ?? null,
          d.email, d.dateOfBirth ?? null, d.city ?? null, d.state ?? null, d.address ?? null, d.bloodGroup ?? null,
          d.emergencyContactName ?? null, d.emergencyContactRelation ?? null, d.emergencyContactPhone ?? null,
          d.licenseNumber, d.licenseCategories ? JSON.stringify(d.licenseCategories) : null,
          d.licenseIssuingRto ?? null, d.licenseIssueDate ?? null, d.licenseExpiry,
          d.hazmatEndorsed ? 1 : 0, d.hazmatExpiry ?? null, d.aadhaarMasked ?? null, d.panMasked ?? null,
          d.medicalFitnessExpiry ?? null, d.policeVerificationStatus ?? null, d.digilockerStatus ?? null,
          d.assignedVehicleId ?? null, d.operationalStatus, d.status, d.safetyScore, d.speedingScore,
          d.brakingScore, d.accelerationScore, d.corneringScore, d.fatigueComplianceScore,
          d.totalTrips, d.totalDistanceKm, d.joinDate, JSON.stringify(d.coachingRecommendations ?? []), d.dataConfidenceNote ?? '',
        )
      }
    }

    if (Array.isArray(data.driverEvents)) {
      db.prepare('DELETE FROM fleet_driver_events WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_driver_events (
          id, organization_id, driver_id, vehicle_id, trip_id, event_type, severity, speed_kmh, road_stress_context,
          gps_accuracy_meters, mount_stability_warning, timestamp, location_label, dispute_status, dispute_reason, dispute_resolution_note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const e of data.driverEvents) {
        ins.run(
          e.id, orgId, e.driverId, e.vehicleId, e.tripId, e.eventType, e.severity, e.speedKmh, e.roadStressContext,
          e.gpsAccuracyMeters, e.mountStabilityWarning ? 1 : 0, e.timestamp, e.locationLabel, e.disputeStatus,
          e.disputeReason ?? null, e.disputeResolutionNote ?? null,
        )
      }
    }

    if (Array.isArray(data.driverAssignments)) {
      db.prepare('DELETE FROM fleet_driver_assignments WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_driver_assignments (
          id, organization_id, driver_id, vehicle_id, vehicle_registration, assigned_at, unassigned_at, assigned_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const a of data.driverAssignments) {
        ins.run(a.id, orgId, a.driverId, a.vehicleId, a.vehicleRegistration, a.assignedAt, a.unassignedAt ?? null, a.assignedBy, a.notes ?? null)
      }
    }

    if (Array.isArray(data.trips)) {
      db.prepare('DELETE FROM fleet_trips WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_trips (
          id, organization_id, environment, vehicle_id, driver_id, origin_address, destination_address,
          start_lat, start_lng, end_lat, end_lng, start_time, end_time, distance_km, planned_distance_km,
          duration_minutes, planned_duration_minutes, avg_speed_kmh, max_speed_kmh, status, truck_routing_mode,
          route_json, speed_timeline_json, stops_json, offline_synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const t of data.trips) {
        ins.run(
          t.id, orgId, t.environment ?? 'production', t.vehicleId, t.driverId, t.originAddress, t.destinationAddress,
          t.startLocation.lat, t.startLocation.lng, t.endLocation?.lat ?? null, t.endLocation?.lng ?? null,
          t.startTime, t.endTime ?? null, t.distanceKm, t.plannedDistanceKm ?? null,
          t.durationMinutes, t.plannedDurationMinutes ?? null, t.avgSpeedKmh, t.maxSpeedKmh, t.status,
          t.truckRoutingMode ?? null, JSON.stringify(t.route ?? []), JSON.stringify(t.speedTimeline ?? []),
          JSON.stringify(t.stops ?? []), t.offlineSynced ? 1 : 0,
        )
      }
    }

    if (Array.isArray(data.fuelTransactions)) {
      db.prepare('DELETE FROM fleet_fuel_transactions WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_fuel_transactions (
          id, organization_id, environment, vehicle_id, driver_id, trip_id, amount_inr, liters_or_kwh, unit_price_inr,
          odometer_km, station, lat, lng, timestamp, payment_method, entry_source, verification_status, payment_state,
          anomaly_flags_json, efficiency_km_per_unit, cost_per_km_inr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const f of data.fuelTransactions) {
        ins.run(
          f.id, orgId, f.environment ?? 'production', f.vehicleId, f.driverId, f.tripId ?? null, f.amountInr,
          f.litersOrKwh, f.unitPriceInr, f.odometerKm, f.station, f.location.lat, f.location.lng, f.timestamp,
          f.paymentMethod, f.entrySource, f.verificationStatus, f.paymentState ?? null,
          JSON.stringify(f.anomalyFlags ?? []), f.efficiencyKmPerUnit ?? null, f.costPerKmInr ?? null,
        )
      }
    }

    if (Array.isArray(data.maintenanceRecords)) {
      db.prepare('DELETE FROM fleet_maintenance_records WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_maintenance_records (
          id, organization_id, environment, vehicle_id, service_type, component_name, service_center, workshop_id,
          description, cost_inr, payment_state, bill_number, bill_file_name, downtime_days, parts_replaced_json,
          performed_at, odometer_at_service_km, status, linked_prediction_id, linked_work_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const m of data.maintenanceRecords) {
        ins.run(
          m.id, orgId, m.environment ?? 'production', m.vehicleId, m.serviceType, m.componentName, m.serviceCenter,
          m.workshopId ?? null, m.description, m.costInr, m.paymentState ?? null, m.billNumber ?? null,
          m.billFileName ?? null, m.downtimeDays, JSON.stringify(m.partsReplaced ?? []), m.performedAt,
          m.odometerAtServiceKm ?? null, m.status, m.linkedPredictionId ?? null, m.linkedWorkOrderId ?? null,
        )
      }
    }

    if (Array.isArray(data.inspections)) {
      db.prepare('DELETE FROM fleet_inspections WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_inspections (
          id, organization_id, environment, vehicle_id, driver_id, inspector_name, timestamp, tyre_condition,
          brake_feel, fluid_leaks_detected, warning_lights_on, battery_or_starting_issue, notes, passed, linked_issue_ids_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const i of data.inspections) {
        ins.run(
          i.id, orgId, i.environment ?? 'production', i.vehicleId, i.driverId, i.inspectorName ?? null, i.timestamp,
          i.tyreCondition, i.brakeFeel, i.fluidLeaksDetected ? 1 : 0, i.warningLightsOn ? 1 : 0,
          i.batteryOrStartingIssue ? 1 : 0, i.notes, i.passed ? 1 : 0,
          i.linkedIssueIds ? JSON.stringify(i.linkedIssueIds) : null,
        )
      }
    }

    if (Array.isArray(data.serviceSchedules)) {
      db.prepare('DELETE FROM fleet_service_schedules WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_service_schedules (
          id, organization_id, vehicle_id, title, health_area, interval_days, interval_km, due_date, due_odometer_km, priority, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const s of data.serviceSchedules) {
        ins.run(s.id, orgId, s.vehicleId, s.title, s.healthArea, s.intervalDays, s.intervalKm, s.dueDate, s.dueOdometerKm, s.priority, s.status)
      }
    }

    if (Array.isArray(data.smallIssues)) {
      db.prepare('DELETE FROM fleet_small_issues WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_small_issues (
          id, organization_id, vehicle_id, driver_id, title, description, health_area, severity, status, source, reported_by, reported_at, linked_work_order_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const iss of data.smallIssues) {
        ins.run(
          iss.id, orgId, iss.vehicleId, iss.driverId ?? null, iss.title, iss.description, iss.healthArea,
          iss.severity, iss.status, iss.source, iss.reportedBy, iss.reportedAt, iss.linkedWorkOrderId ?? null,
        )
      }
    }

    if (Array.isArray(data.workOrders)) {
      db.prepare('DELETE FROM fleet_work_orders WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_work_orders (
          id, organization_id, work_order_number, vehicle_id, workshop_id, workshop_name, title, description,
          health_area, priority, status, linked_issue_ids_json, tasks_json, parts_json, labor_cost_inr, parts_cost_inr,
          total_cost_inr, payment_state, created_by, created_at, scheduled_for, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const w of data.workOrders) {
        ins.run(
          w.id, orgId, w.workOrderNumber, w.vehicleId, w.workshopId ?? null, w.workshopName, w.title, w.description,
          w.healthArea, w.priority, w.status, JSON.stringify(w.linkedIssueIds ?? []), JSON.stringify(w.tasks ?? []),
          JSON.stringify(w.parts ?? []), w.laborCostInr, w.partsCostInr, w.totalCostInr, w.paymentState,
          w.createdBy, w.createdAt, w.scheduledFor ?? null, w.completedAt ?? null,
        )
      }
    }

    if (Array.isArray(data.partsInventory)) {
      db.prepare('DELETE FROM fleet_parts_inventory WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_parts_inventory (
          id, organization_id, sku, name, category, unit, stock_qty, reorder_threshold, unit_cost_inr, preferred_supplier_id, warehouse_location, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const p of data.partsInventory) {
        ins.run(p.id, orgId, p.sku, p.name, p.category, p.unit, p.stockQty, p.reorderThreshold, p.unitCostInr, p.preferredSupplierId ?? null, p.warehouseLocation, p.updatedAt)
      }
    }

    if (Array.isArray(data.suppliers)) {
      db.prepare('DELETE FROM fleet_suppliers WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_suppliers (
          id, organization_id, name, gstin, city, contact_name, phone, email, lead_time_days, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const s of data.suppliers) {
        ins.run(s.id, orgId, s.name, s.gstin ?? null, s.city, s.contactName, s.phone, s.email, s.leadTimeDays, s.rating)
      }
    }

    if (Array.isArray(data.purchaseOrders)) {
      db.prepare('DELETE FROM fleet_purchase_orders WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_purchase_orders (
          id, organization_id, po_number, supplier_id, supplier_name, status, items_json, total_amount_inr, payment_state, created_at, expected_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const p of data.purchaseOrders) {
        ins.run(p.id, orgId, p.poNumber, p.supplierId, p.supplierName, p.status, JSON.stringify(p.items ?? []), p.totalAmountInr, p.paymentState, p.createdAt, p.expectedAt ?? null)
      }
    }

    if (Array.isArray(data.inventoryTransactions)) {
      db.prepare('DELETE FROM fleet_inventory_transactions WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_inventory_transactions (
          id, organization_id, part_id, part_name, type, quantity_delta, balance_after, reference_type, reference_id, performed_by, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const tx of data.inventoryTransactions) {
        ins.run(tx.id, orgId, tx.partId, tx.partName, tx.type, tx.quantityDelta, tx.balanceAfter, tx.referenceType, tx.referenceId, tx.performedBy, tx.timestamp)
      }
    }

    if (Array.isArray(data.workshops)) {
      db.prepare('DELETE FROM fleet_workshops WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_workshops (
          id, organization_id, name, city, specialties_json, contact_phone, sla_turnaround_hours, avg_turnaround_hours, completed_jobs_count, total_spend_inr, rating
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const w of data.workshops) {
        ins.run(w.id, orgId, w.name, w.city, JSON.stringify(w.specialties ?? []), w.contactPhone, w.slaTurnaroundHours, w.avgTurnaroundHours, w.completedJobsCount, w.totalSpendInr, w.rating)
      }
    }

    if (Array.isArray(data.invoices)) {
      db.prepare('DELETE FROM fleet_invoices WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_invoices (
          id, organization_id, invoice_number, vendor_name, category, vehicle_id, reference_id, amount_inr, paid_amount_inr, status, due_date, issued_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const inv of data.invoices) {
        ins.run(inv.id, orgId, inv.invoiceNumber, inv.vendorName, inv.category, inv.vehicleId ?? null, inv.referenceId ?? null, inv.amountInr, inv.paidAmountInr, inv.status, inv.dueDate, inv.issuedDate, inv.notes ?? null)
      }
    }

    if (Array.isArray(data.payments)) {
      db.prepare('DELETE FROM fleet_payments WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_payments (
          id, organization_id, invoice_id, invoice_number, amount_inr, payment_method, reference_number, paid_at, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const p of data.payments) {
        ins.run(p.id, orgId, p.invoiceId, p.invoiceNumber, p.amountInr, p.paymentMethod, p.referenceNumber, p.paidAt, p.recordedBy)
      }
    }

    if (Array.isArray(data.documentVault)) {
      db.prepare('DELETE FROM fleet_document_vault WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_document_vault (
          id, organization_id, entity_type, entity_id, category, title, document_number, masked_number, issuing_authority,
          issued_date, expiry_date, file_name, mime_type, file_size_bytes, storage_key, verification_status,
          verified_by, verified_at, rejection_reason, uploaded_by, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const doc of data.documentVault) {
        ins.run(
          doc.id, orgId, doc.entityType, doc.entityId, doc.category, doc.title, doc.documentNumber ?? null,
          doc.maskedNumber ?? null, doc.issuingAuthority ?? null, doc.issuedDate ?? null, doc.expiryDate ?? null,
          doc.fileName, doc.mimeType, doc.fileSizeBytes, doc.storageKey, doc.verificationStatus,
          doc.verifiedBy ?? null, doc.verifiedAt ?? null, doc.rejectionReason ?? null, doc.uploadedBy, doc.uploadedAt,
        )
      }
    }

    if (Array.isArray(data.alerts)) {
      db.prepare('DELETE FROM fleet_alerts WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_alerts (
          id, organization_id, environment, vehicle_id, driver_id, category, severity, title, message, source, timestamp, read, acknowledged, action_route
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const a of data.alerts) {
        ins.run(a.id, orgId, a.environment ?? 'production', a.vehicleId, a.driverId ?? null, a.category, a.severity, a.title, a.message, a.source ?? null, a.timestamp, a.read ? 1 : 0, a.acknowledged ? 1 : 0, a.actionRoute)
      }
    }

    if (Array.isArray(data.auditLogs)) {
      db.prepare('DELETE FROM fleet_audit_logs WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_audit_logs (
          id, organization_id, environment, actor_name, actor_role, action, entity_type, entity_id, summary, reason, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const a of data.auditLogs) {
        ins.run(a.id, orgId, a.environment ?? 'production', a.actorName, a.actorRole, a.action, a.entityType, a.entityId, a.summary, a.reason ?? null, a.timestamp)
      }
    }

    if (Array.isArray(data.reports)) {
      db.prepare('DELETE FROM fleet_reports WHERE organization_id = ?').run(orgId)
      const ins = db.prepare(`
        INSERT OR REPLACE INTO fleet_reports (
          id, organization_id, environment, category_id, title, period, generated_by, generated_at, format, row_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const r of data.reports) {
        ins.run(r.id, orgId, r.environment ?? 'production', r.categoryId, r.title, r.period, r.generatedBy, r.generatedAt, r.format, r.rowCount)
      }
    }

    if (updateBlobCache) {
      db.prepare(`
        INSERT INTO org_fleet_blobs (organization_id, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(organization_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `).run(orgId, JSON.stringify(data), nowIso)
    }

    db.exec('COMMIT')
    return nowIso
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function getOrgFleetModules(db: DatabaseSync, orgId: string): FleetModulesDataset {
  const tools = (db.prepare('SELECT * FROM fleet_tools WHERE organization_id = ? ORDER BY updated_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r): FleetToolItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    serialNumber: String(r.serial_number),
    category: String(r.category),
    assignedTo: String(r.assigned_to),
    location: String(r.location),
    status: String(r.status) as FleetToolItem['status'],
    purchaseCostInr: Number(r.purchase_cost_inr),
    nextCalibrationDate: String(r.next_calibration_date),
  }))

  const warranties = (db.prepare('SELECT * FROM fleet_warranties WHERE organization_id = ? ORDER BY updated_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r): FleetWarrantyItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    vehicleId: r.vehicle_id ? String(r.vehicle_id) : undefined,
    assetName: String(r.asset_name),
    registrationNumber: String(r.registration_number),
    provider: String(r.provider),
    coverageType: String(r.coverage_type) as FleetWarrantyItem['coverageType'],
    startDate: String(r.start_date),
    expiryDate: String(r.expiry_date),
    maxOdometerKm: Number(r.max_odometer_km),
    claimStatus: String(r.claim_status) as FleetWarrantyItem['claimStatus'],
  }))

  const customRecords = (db.prepare('SELECT * FROM fleet_custom_records WHERE organization_id = ? ORDER BY recorded_date DESC').all(orgId) as Array<Record<string, unknown>>).map((r): CustomRecordEntry => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    recordType: String(r.record_type) as CustomRecordEntry['recordType'],
    vehicleOrDriver: String(r.vehicle_or_driver),
    referenceCode: String(r.reference_code),
    recordedDate: String(r.recorded_date),
    amountInr: Number(r.amount_inr),
    status: String(r.status) as CustomRecordEntry['status'],
    notes: String(r.notes),
  }))

  const serviceTasks = (db.prepare('SELECT * FROM fleet_service_tasks WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): ServiceTaskCatalogItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    code: String(r.code),
    title: String(r.title),
    area: String(r.health_area) as ServiceTaskCatalogItem['area'],
    avgHours: Number(r.avg_hours),
    estCostInr: Number(r.est_cost_inr),
    active: Number(r.active) === 1,
  }))

  const servicePrograms = (db.prepare('SELECT * FROM fleet_service_programs WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): ServiceProgramItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    powertrain: String(r.powertrain) as ServiceProgramItem['powertrain'],
    cadence: String(r.cadence),
    intervalKm: Number(r.interval_km),
    intervalDays: Number(r.interval_days),
    active: Number(r.active) === 1,
  }))

  const inspectionForms = (db.prepare('SELECT * FROM fleet_inspection_forms WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): InspectionFormTemplate => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    title: String(r.title),
    itemsCount: Number(r.items_count),
    lastUpdated: String(r.last_updated),
    active: Number(r.active) === 1,
    checklistItems: r.checklist_items_json ? parseJson(r.checklist_items_json, undefined) : undefined,
  }))

  const inspectionSchedules = (db.prepare('SELECT * FROM fleet_inspection_schedules WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): InspectionScheduleItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    frequency: String(r.frequency),
    scope: String(r.scope),
    formId: r.form_id ? String(r.form_id) : undefined,
    formTitle: String(r.form_title),
    active: Number(r.active) === 1,
  }))

  const recalls = (db.prepare('SELECT * FROM fleet_recalls WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): FleetRecallItem => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    campaign: String(r.campaign),
    oem: String(r.oem),
    targetMake: String(r.target_make),
    severity: String(r.severity) as FleetRecallItem['severity'],
    status: String(r.status) as FleetRecallItem['status'],
    notes: r.notes ? String(r.notes) : undefined,
    issuedDate: String(r.issued_date),
  }))

  const apiKeys = (db.prepare('SELECT * FROM fleet_api_keys WHERE organization_id = ? ORDER BY created_at DESC').all(orgId) as Array<Record<string, unknown>>).map((r): ApiKeyEntry => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    label: String(r.label),
    prefix: String(r.prefix),
    scope: String(r.scope) as ApiKeyEntry['scope'],
    createdAt: String(r.created_at),
    lastUsedAt: String(r.last_used_at),
  }))

  const webhooks = (db.prepare('SELECT * FROM fleet_webhooks WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): WebhookEndpoint => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    url: String(r.url),
    events: parseJson(r.events_json, []),
    active: Number(r.active) === 1,
    lastDeliveryStatus: Number(r.last_delivery_status),
  }))

  const customDashboards = (db.prepare('SELECT * FROM fleet_custom_dashboards WHERE organization_id = ?').all(orgId) as Array<Record<string, unknown>>).map((r): CustomDashboardLayout => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    name: String(r.name),
    widgets: String(r.widgets),
    defaultView: Number(r.default_view) === 1,
  }))

  const settingsRow = db
    .prepare('SELECT * FROM fleet_workspace_settings WHERE organization_id = ?')
    .get(orgId) as Record<string, unknown> | undefined

  return {
    tools,
    warranties,
    customRecords,
    serviceTasks,
    servicePrograms,
    inspectionForms,
    inspectionSchedules,
    recalls,
    apiKeys,
    webhooks,
    customDashboards,
    fleetioSettings: settingsRow
      ? { ...DEFAULT_FLEETIO_SETTINGS, ...parseJson<Partial<FleetioSettingsState>>(settingsRow.fleetio_settings_json, {}) }
      : DEFAULT_FLEETIO_SETTINGS,
    workspaceSettings: settingsRow
      ? { ...DEFAULT_WORKSPACE_SETTINGS, ...parseJson<Partial<WorkspaceSettings>>(settingsRow.workspace_settings_json, {}) }
      : DEFAULT_WORKSPACE_SETTINGS,
    visitedIntegrations: settingsRow ? Number(settingsRow.visited_integrations) === 1 : true,
    visitedReports: settingsRow ? Number(settingsRow.visited_reports) === 1 : false,
  }
}

export function insertFleetTool(db: DatabaseSync, orgId: string, item: Omit<FleetToolItem, 'id' | 'organizationId'> & { id?: string }): FleetToolItem {
  const id = item.id || `tool-${crypto.randomUUID().slice(0, 8)}`
  const nowIso = new Date().toISOString()
  db.prepare(`
    INSERT INTO fleet_tools (id, organization_id, name, serial_number, category, assigned_to, location, status, purchase_cost_inr, next_calibration_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.name, item.serialNumber, item.category, item.assignedTo, item.location, item.status, item.purchaseCostInr, item.nextCalibrationDate, nowIso)
  return { ...item, id, organizationId: orgId }
}

export function updateFleetToolStatus(db: DatabaseSync, orgId: string, toolId: string, status: FleetToolItem['status']): boolean {
  const res = db
    .prepare('UPDATE fleet_tools SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?')
    .run(status, new Date().toISOString(), toolId, orgId)
  return Number(res.changes ?? 0) > 0
}

export function insertFleetWarranty(db: DatabaseSync, orgId: string, item: Omit<FleetWarrantyItem, 'id' | 'organizationId'> & { id?: string }): FleetWarrantyItem {
  const id = item.id || `war-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_warranties (id, organization_id, vehicle_id, asset_name, registration_number, provider, coverage_type, start_date, expiry_date, max_odometer_km, claim_status, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.vehicleId ?? null, item.assetName, item.registrationNumber, item.provider, item.coverageType, item.startDate, item.expiryDate, item.maxOdometerKm, item.claimStatus, new Date().toISOString())
  return { ...item, id, organizationId: orgId }
}

export function insertCustomRecord(db: DatabaseSync, orgId: string, item: Omit<CustomRecordEntry, 'id' | 'organizationId'> & { id?: string }): CustomRecordEntry {
  const id = item.id || `cr-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_custom_records (id, organization_id, record_type, vehicle_or_driver, reference_code, recorded_date, amount_inr, status, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.recordType, item.vehicleOrDriver, item.referenceCode, item.recordedDate, item.amountInr, item.status, item.notes, new Date().toISOString())
  return { ...item, id, organizationId: orgId }
}

export function insertServiceTask(db: DatabaseSync, orgId: string, item: Omit<ServiceTaskCatalogItem, 'id' | 'organizationId'>): ServiceTaskCatalogItem {
  const id = `st-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_service_tasks (id, organization_id, code, title, health_area, avg_hours, est_cost_inr, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.code, item.title, item.area, item.avgHours, item.estCostInr, item.active ? 1 : 0)
  return { ...item, id, organizationId: orgId }
}

export function insertServiceProgram(db: DatabaseSync, orgId: string, item: Omit<ServiceProgramItem, 'id' | 'organizationId'>): ServiceProgramItem {
  const id = `sp-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_service_programs (id, organization_id, name, powertrain, cadence, interval_km, interval_days, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.name, item.powertrain, item.cadence, item.intervalKm, item.intervalDays, item.active ? 1 : 0)
  return { ...item, id, organizationId: orgId }
}

export function insertInspectionForm(db: DatabaseSync, orgId: string, item: Omit<InspectionFormTemplate, 'id' | 'organizationId'>): InspectionFormTemplate {
  const id = `if-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_inspection_forms (id, organization_id, title, items_count, last_updated, active, checklist_items_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.title, item.itemsCount, item.lastUpdated, item.active ? 1 : 0, item.checklistItems ? JSON.stringify(item.checklistItems) : null)
  return { ...item, id, organizationId: orgId }
}

export function insertInspectionSchedule(db: DatabaseSync, orgId: string, item: Omit<InspectionScheduleItem, 'id' | 'organizationId'>): InspectionScheduleItem {
  const id = `is-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_inspection_schedules (id, organization_id, name, frequency, scope, form_id, form_title, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.name, item.frequency, item.scope, item.formId ?? null, item.formTitle, item.active ? 1 : 0)
  return { ...item, id, organizationId: orgId }
}

export function insertFleetRecall(db: DatabaseSync, orgId: string, item: Omit<FleetRecallItem, 'id' | 'organizationId'>): FleetRecallItem {
  const id = `rec-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_recalls (id, organization_id, campaign, oem, target_make, severity, status, notes, issued_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.campaign, item.oem, item.targetMake, item.severity, item.status, item.notes ?? null, item.issuedDate)
  return { ...item, id, organizationId: orgId }
}

export function updateFleetRecallStatus(db: DatabaseSync, orgId: string, recallId: string, status: FleetRecallItem['status']): boolean {
  const res = db
    .prepare('UPDATE fleet_recalls SET status = ? WHERE id = ? AND organization_id = ?')
    .run(status, recallId, orgId)
  return Number(res.changes ?? 0) > 0
}

export function insertApiKey(db: DatabaseSync, orgId: string, item: Omit<ApiKeyEntry, 'id' | 'organizationId'>): ApiKeyEntry {
  const id = `key-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_api_keys (id, organization_id, label, prefix, scope, created_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.label, item.prefix, item.scope, item.createdAt, item.lastUsedAt)
  return { ...item, id, organizationId: orgId }
}

export function deleteApiKey(db: DatabaseSync, orgId: string, keyId: string): boolean {
  const res = db.prepare('DELETE FROM fleet_api_keys WHERE id = ? AND organization_id = ?').run(keyId, orgId)
  return Number(res.changes ?? 0) > 0
}

export function insertWebhook(db: DatabaseSync, orgId: string, item: Omit<WebhookEndpoint, 'id' | 'organizationId'>): WebhookEndpoint {
  const id = `wh-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_webhooks (id, organization_id, url, events_json, active, last_delivery_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, orgId, item.url, JSON.stringify(item.events), item.active ? 1 : 0, item.lastDeliveryStatus)
  return { ...item, id, organizationId: orgId }
}

export function toggleWebhookActive(db: DatabaseSync, orgId: string, webhookId: string, active: boolean): boolean {
  const res = db
    .prepare('UPDATE fleet_webhooks SET active = ? WHERE id = ? AND organization_id = ?')
    .run(active ? 1 : 0, webhookId, orgId)
  return Number(res.changes ?? 0) > 0
}

export function insertCustomDashboard(db: DatabaseSync, orgId: string, item: Omit<CustomDashboardLayout, 'id' | 'organizationId'>): CustomDashboardLayout {
  const id = `cd-${crypto.randomUUID().slice(0, 8)}`
  db.prepare(`
    INSERT INTO fleet_custom_dashboards (id, organization_id, name, widgets, default_view)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, orgId, item.name, item.widgets, item.defaultView ? 1 : 0)
  return { ...item, id, organizationId: orgId }
}

export function updateFleetWorkspaceSettings(
  db: DatabaseSync,
  orgId: string,
  patch: {
    workspaceSettings?: Partial<WorkspaceSettings>
    fleetioSettings?: Partial<FleetioSettingsState>
    visitedIntegrations?: boolean
    visitedReports?: boolean
  },
): {
  workspaceSettings: WorkspaceSettings
  fleetioSettings: FleetioSettingsState
  visitedIntegrations: boolean
  visitedReports: boolean
} {
  const existing = getOrgFleetModules(db, orgId)
  const nextWorkspace = patch.workspaceSettings
    ? { ...existing.workspaceSettings, ...patch.workspaceSettings }
    : existing.workspaceSettings
  const nextFleetio = patch.fleetioSettings
    ? { ...existing.fleetioSettings, ...patch.fleetioSettings }
    : existing.fleetioSettings
  const nextVisitedInt = patch.visitedIntegrations ?? existing.visitedIntegrations
  const nextVisitedRep = patch.visitedReports ?? existing.visitedReports
  const nowIso = new Date().toISOString()

  db.prepare(`
    INSERT INTO fleet_workspace_settings (
      organization_id, workspace_settings_json, fleetio_settings_json, visited_integrations, visited_reports, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(organization_id) DO UPDATE SET
      workspace_settings_json = excluded.workspace_settings_json,
      fleetio_settings_json = excluded.fleetio_settings_json,
      visited_integrations = excluded.visited_integrations,
      visited_reports = excluded.visited_reports,
      updated_at = excluded.updated_at
  `).run(
    orgId,
    JSON.stringify(nextWorkspace),
    JSON.stringify(nextFleetio),
    nextVisitedInt ? 1 : 0,
    nextVisitedRep ? 1 : 0,
    nowIso,
  )

  return {
    workspaceSettings: nextWorkspace,
    fleetioSettings: nextFleetio,
    visitedIntegrations: nextVisitedInt,
    visitedReports: nextVisitedRep,
  }
}

export function getOrgOperationalCounts(db: DatabaseSync, orgId: string): {
  totalVehicles: number
  totalDrivers: number
  openWorkOrders: number
  monthlyRevenueInr: number
} {
  const vehRow = db
    .prepare('SELECT COUNT(*) AS count, COALESCE(SUM(monthly_revenue_inr), 0) AS rev FROM fleet_vehicles WHERE organization_id = ? AND decommissioned = 0')
    .get(orgId) as { count: number; rev: number }
  const drvRow = db
    .prepare('SELECT COUNT(*) AS count FROM fleet_drivers WHERE organization_id = ?')
    .get(orgId) as { count: number }
  const woRow = db
    .prepare("SELECT COUNT(*) AS count FROM fleet_work_orders WHERE organization_id = ? AND status NOT IN ('completed', 'closed')")
    .get(orgId) as { count: number }

  return {
    totalVehicles: Number(vehRow?.count ?? 0),
    totalDrivers: Number(drvRow?.count ?? 0),
    openWorkOrders: Number(woRow?.count ?? 0),
    monthlyRevenueInr: Number(vehRow?.rev ?? 0),
  }
}
