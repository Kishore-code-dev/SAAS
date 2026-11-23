import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { buildSeedDataset, type EnvironmentDataset } from '../src/data/seedOrganizations.ts'
import type { Organization, OrganizationRole, OrganizationStatus } from '../src/types/fleet.ts'
import { hashPassword } from './authLogic.ts'
import { ensureFinanceSchemaAndSeed } from './financeDb.ts'
import { ensureFleetSchemaAndMigrate } from './fleetDb.ts'
import { ensureContractsSchemaAndSeed } from './contractsDb.ts'

const DATA_DIR = path.resolve(process.cwd(), '.drivemitra-data')
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads')
const DB_PATH = path.join(DATA_DIR, 'drivemitra.db')

import {
  CANONICAL_SUBSCRIPTION_PLANS,
  UNLIMITED_SEAT_CAP,
  computeCheckoutTotals,
} from './subscriptionEngine.ts'
import {
  DEFAULT_STAFF_PERMISSION_MATRIX,
  getPresetMatrixForRole,
} from '../src/utils/staffPermissions.ts'

export interface DbUserRow {
  id: string
  username: string
  email: string
  fullName: string
  passwordHash: string
  role: OrganizationRole
  organizationId: string | null
  driverId: string | null
  staffProfileId: string | null
  mobile: string | null
  passwordChangeRequired: boolean
  status: 'active' | 'suspended' | 'disabled' | 'deactivated'
  createdAt: string
  lastLoginAt: string | null
}

export interface PlatformAuditLogRow {
  id: string
  actorUserId: string
  actorUsername: string
  action: string
  targetOrgId: string | null
  targetOrgName: string | null
  reason: string
  metadataJson: string
  createdAt: string
}

export interface SaasBillingInvoiceRow {
  id: string
  organizationId: string
  invoiceNumber: string
  planId: string
  billingCycle: 'monthly' | 'annual'
  baseAmountInr: number
  gstInr: number
  totalInr: number
  status: 'trial' | 'paid' | 'pending'
  periodStart: string
  periodEnd: string
  issuedAt: string
  notes: string | null
}

let dbInstance: DatabaseSync | null = null

export function getUploadsDir(): string {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
  return UPLOADS_DIR
}

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  const db = new DatabaseSync(DB_PATH)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      organization_id TEXT,
      password_change_required INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT,
      token_hash TEXT UNIQUE NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT UNIQUE NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      timezone TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      vehicle_limit INTEGER NOT NULL,
      driver_limit INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      subscription_start_date TEXT NOT NULL,
      subscription_expiry_date TEXT NOT NULL,
      grace_period_until TEXT,
      suspension_reason TEXT,
      owner_name TEXT,
      owner_email TEXT,
      owner_phone TEXT,
      gstin TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS org_fleet_blobs (
      organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_admin_audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      action TEXT NOT NULL,
      target_org_id TEXT,
      target_org_name TEXT,
      reason TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_files (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saas_billing_invoices (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      base_amount_inr INTEGER NOT NULL,
      gst_inr INTEGER NOT NULL,
      total_inr INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      notes TEXT
    );
  `)

  seedDatabaseIfEmpty(db)
  backfillDeccanOperationalSeedIfNeeded(db)
  ensureFleetSchemaAndMigrate(db)
  ensureFinanceSchemaAndSeed(db)
  ensureContractsSchemaAndSeed(db)
  ensureSaasInvoicesSeeded(db)
  ensureCanonicalSchema(db)
  dbInstance = db
  return db
}

function ensureSaasInvoicesSeeded(db: DatabaseSync): void {
  const existing = db.prepare('SELECT COUNT(*) AS count FROM saas_billing_invoices').get() as { count: number }
  if (existing.count > 0) return

  const orgRows = db.prepare('SELECT * FROM organizations').all() as Array<Record<string, unknown>>
  const insert = db.prepare(`
    INSERT INTO saas_billing_invoices (
      id, organization_id, invoice_number, plan_id, billing_cycle,
      base_amount_inr, gst_inr, total_inr, status, period_start, period_end, issued_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const now = new Date()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10)
  const currMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const currMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  for (const row of orgRows) {
    const org = mapOrgRow(row)
    const cycle = org.planId === 'annual' ? 'annual' : 'monthly'
    const { baseAmountInr: monthlyBase, taxAmountInr: gst, totalPayableInr: total } =
      computeCheckoutTotals(cycle)
    const invStatus = org.paymentStatus === 'pending' ? 'pending' : 'paid'

    insert.run(
      `sinv-${org.id}-curr`,
      org.id,
      `DM-${org.code}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
      org.planId,
      'monthly',
      monthlyBase,
      gst,
      total,
      invStatus,
      currMonthStart,
      currMonthEnd,
      `${currMonthStart}T09:00:00.000Z`,
      `${org.planId.toUpperCase()} SaaS subscription cycle (18% GST included)`,
    )
    if (invStatus === 'paid') {
      insert.run(
        `sinv-${org.id}-prev`,
        org.id,
        `DM-${org.code}-${now.getFullYear()}${String(Math.max(1, now.getMonth())).padStart(2, '0')}`,
        org.planId,
        'monthly',
        monthlyBase,
        gst,
        total,
        'paid',
        prevMonthStart,
        prevMonthEnd,
        `${prevMonthStart}T09:00:00.000Z`,
        `Settled ${org.planId.toUpperCase()} monthly SaaS invoice`,
      )
    }
  }
}

function backfillDeccanOperationalSeedIfNeeded(db: DatabaseSync): void {
  const row = db
    .prepare("SELECT payload_json FROM org_fleet_blobs WHERE organization_id = 'org-deccan'")
    .get() as { payload_json: string } | undefined
  if (!row) return

  let parsed: Record<string, unknown[]>
  try {
    parsed = JSON.parse(row.payload_json) as Record<string, unknown[]>
  } catch {
    return
  }
  if (Array.isArray(parsed.workOrders) && parsed.workOrders.length > 0) return

  const seed = buildSeedDataset('production')
  const deccanVehicleIds = new Set(seed.vehicles.filter((v) => v.organizationId === 'org-deccan').map((v) => v.id))
  const mergeById = <T extends { id: string }>(existing: unknown, additions: T[]): T[] => {
    const arr = Array.isArray(existing) ? (existing as T[]) : []
    const ids = new Set(arr.map((i) => i.id))
    return [...arr, ...additions.filter((a) => !ids.has(a.id))]
  }

  parsed.inspections = mergeById(parsed.inspections, seed.inspections.filter((i) => i.organizationId === 'org-deccan'))
  parsed.smallIssues = mergeById(parsed.smallIssues, seed.smallIssues.filter((i) => i.organizationId === 'org-deccan'))
  parsed.workOrders = mergeById(parsed.workOrders, seed.workOrders.filter((w) => w.organizationId === 'org-deccan'))
  parsed.purchaseOrders = mergeById(parsed.purchaseOrders, seed.purchaseOrders.filter((p) => p.organizationId === 'org-deccan'))
  parsed.inventoryTransactions = mergeById(parsed.inventoryTransactions, seed.inventoryTransactions.filter((t) => t.organizationId === 'org-deccan'))
  parsed.documentVault = mergeById(parsed.documentVault, seed.documentVault.filter((d) => d.organizationId === 'org-deccan'))
  parsed.tyrePositions = mergeById(parsed.tyrePositions, seed.tyrePositions.filter((t) => deccanVehicleIds.has(t.vehicleId)))

  db.prepare('UPDATE org_fleet_blobs SET payload_json = ?, updated_at = ? WHERE organization_id = ?').run(
    JSON.stringify(parsed),
    new Date().toISOString(),
    'org-deccan',
  )
}

export function createEmptyOrgDataset(org: Organization): Omit<EnvironmentDataset, 'organizations' | 'members'> {
  return {
    vehicles: [],
    drivers: [],
    driverEvents: [],
    driverAssignments: [],
    trips: [],
    fuelTransactions: [],
    maintenanceRecords: [],
    inspections: [],
    serviceSchedules: [],
    smallIssues: [],
    workOrders: [],
    partsInventory: [],
    suppliers: [],
    purchaseOrders: [],
    inventoryTransactions: [],
    workshops: [],
    invoices: [],
    payments: [],
    documentVault: [],
    tyrePositions: [],
    alerts: [],
    auditLogs: [
      {
        id: `aud-init-${org.id}`,
        organizationId: org.id,
        environment: 'production',
        actorName: 'Platform Administration',
        actorRole: 'platform_admin',
        action: 'ORG_PROVISIONED',
        entityType: 'organization',
        entityId: org.id,
        summary: `Provisioned production workspace for ${org.name} (${org.code}).`,
        timestamp: org.createdAt,
      },
    ],
    reports: [],
  }
}

function seedDatabaseIfEmpty(db: DatabaseSync) {
  const existingUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }
  if (existingUsers.count > 0) return

  const seed = buildSeedDataset('production')
  const nowIso = new Date().toISOString()

  const insertOrg = db.prepare(`
    INSERT INTO organizations (
      id, name, code, city, state, timezone, plan_id, vehicle_limit, driver_limit,
      status, payment_status, subscription_start_date, subscription_expiry_date,
      grace_period_until, suspension_reason, owner_name, owner_email, owner_phone, gstin, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertBlob = db.prepare(`
    INSERT INTO org_fleet_blobs (organization_id, payload_json, updated_at) VALUES (?, ?, ?)
  `)

  for (const org of seed.organizations) {
    insertOrg.run(
      org.id,
      org.name,
      org.code,
      org.city,
      org.state,
      org.timezone,
      org.planId,
      org.vehicleLimit,
      org.driverLimit,
      org.status,
      org.paymentStatus,
      org.subscriptionStartDate,
      org.subscriptionExpiryDate,
      org.gracePeriodUntil ?? null,
      org.suspensionReason ?? null,
      org.ownerName ?? null,
      org.ownerEmail ?? null,
      org.ownerPhone ?? null,
      org.gstin ?? null,
      org.createdAt,
    )

    const orgScoped = {
      vehicles: seed.vehicles.filter((v) => v.organizationId === org.id),
      drivers: seed.drivers.filter((d) => d.organizationId === org.id),
      driverEvents: seed.driverEvents.filter((e) => e.organizationId === org.id),
      driverAssignments: seed.driverAssignments.filter((a) => a.organizationId === org.id),
      trips: seed.trips.filter((t) => t.organizationId === org.id),
      fuelTransactions: seed.fuelTransactions.filter((f) => f.organizationId === org.id),
      maintenanceRecords: seed.maintenanceRecords.filter((m) => m.organizationId === org.id),
      inspections: seed.inspections.filter((i) => i.organizationId === org.id),
      serviceSchedules: seed.serviceSchedules.filter((s) => s.organizationId === org.id),
      smallIssues: seed.smallIssues.filter((i) => i.organizationId === org.id),
      workOrders: seed.workOrders.filter((w) => w.organizationId === org.id),
      partsInventory: seed.partsInventory.filter((p) => p.organizationId === org.id),
      suppliers: seed.suppliers.filter((s) => s.organizationId === org.id),
      purchaseOrders: seed.purchaseOrders.filter((p) => p.organizationId === org.id),
      inventoryTransactions: seed.inventoryTransactions.filter((tx) => tx.organizationId === org.id),
      workshops: seed.workshops.filter((w) => w.organizationId === org.id),
      invoices: seed.invoices.filter((inv) => inv.organizationId === org.id),
      payments: seed.payments.filter((p) => p.organizationId === org.id),
      documentVault: seed.documentVault.filter((doc) => doc.organizationId === org.id),
      tyrePositions: seed.tyrePositions.filter((t) =>
        seed.vehicles.some((v) => v.id === t.vehicleId && v.organizationId === org.id),
      ),
      alerts: seed.alerts.filter((a) => a.organizationId === org.id),
      auditLogs: seed.auditLogs.filter((a) => a.organizationId === org.id),
      reports: seed.reports.filter((r) => r.organizationId === org.id),
      members: seed.members.filter((m) => m.organizationId === org.id),
    }

    insertBlob.run(org.id, JSON.stringify(orgScoped), nowIso)
  }

  // Provision Southern Freight Lines (new tenant awaiting first login password update)
  const southernOrg: Organization = {
    id: 'org-southern',
    name: 'Southern Freight Corridor LLP',
    code: 'STH-KL',
    city: 'Kochi',
    state: 'Kerala',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    planId: 'monthly',
    billingFrequency: 'monthly',
    businessType: 'Transport',
    vehicleLimit: UNLIMITED_SEAT_CAP,
    driverLimit: UNLIMITED_SEAT_CAP,
    status: 'payment_pending',
    paymentStatus: 'pending',
    onboardingCompleted: false,
    onboardingStep: 1,
    subscriptionStartDate: nowIso.slice(0, 10),
    subscriptionExpiryDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    ownerName: 'Aravind Menon',
    ownerEmail: 'aravind@southernfreight.in',
    ownerPhone: '+91 98950 33112',
    gstin: '32AABCS9910E1Z1',
    createdAt: nowIso,
    environment: 'production',
  }

  insertOrg.run(
    southernOrg.id,
    southernOrg.name,
    southernOrg.code,
    southernOrg.city,
    southernOrg.state,
    southernOrg.timezone,
    southernOrg.planId,
    southernOrg.vehicleLimit,
    southernOrg.driverLimit,
    southernOrg.status,
    southernOrg.paymentStatus,
    southernOrg.subscriptionStartDate,
    southernOrg.subscriptionExpiryDate,
    null,
    null,
    southernOrg.ownerName ?? null,
    southernOrg.ownerEmail ?? null,
    southernOrg.ownerPhone ?? null,
    southernOrg.gstin ?? null,
    southernOrg.createdAt,
  )
  insertBlob.run(
    southernOrg.id,
    JSON.stringify({
      ...createEmptyOrgDataset(southernOrg),
      members: [
        {
          id: 'mem-sth-1',
          organizationId: southernOrg.id,
          userId: 'u-sth-1',
          username: 'southern.owner',
          fullName: 'Aravind Menon',
          email: 'aravind@southernfreight.in',
          role: 'org_admin',
          status: 'active',
          lastActiveAt: nowIso,
        },
      ],
    }),
    nowIso,
  )

  const insertUser = db.prepare(`
    INSERT INTO users (
      id, username, email, full_name, password_hash, role, organization_id,
      password_change_required, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const defaultOwnerPass = process.env.SEED_OWNER_PASSWORD || 'DriveMitra@2026'
  const defaultAdminPass = process.env.SEED_SUPERADMIN_PASSWORD || 'PlatformAdmin@2026'
  const defaultTempPass = process.env.SEED_FIRSTLOGIN_TEMP_PASSWORD || 'WelcomeTmp#2026'

  const initialUsers: Array<{
    id: string
    username: string
    email: string
    fullName: string
    password: string
    role: OrganizationRole
    orgId: string | null
    pwdChangeReq: number
  }> = [
    {
      id: 'u-platform-admin',
      username: 'superadmin',
      email: 'governance@drivemitra.in',
      fullName: 'DriveMitra Platform Governance',
      password: defaultAdminPass,
      role: 'platform_admin',
      orgId: null,
      pwdChangeReq: 0,
    },
    {
      id: 'u-k1',
      username: 'kaveri.owner',
      email: 'karthikeyan@kaverilogistics.in',
      fullName: 'Karthikeyan R',
      password: defaultOwnerPass,
      role: 'org_admin',
      orgId: 'org-kaveri',
      pwdChangeReq: 0,
    },
    {
      id: 'u-k2',
      username: 'kaveri.manager',
      email: 'priya@kaverilogistics.in',
      fullName: 'Priya Sundar',
      password: defaultOwnerPass,
      role: 'fleet_manager',
      orgId: 'org-kaveri',
      pwdChangeReq: 0,
    },
    {
      id: 'u-k3',
      username: 'kaveri.maint',
      email: 'senthil@kaverilogistics.in',
      fullName: 'Senthil Murugan',
      password: defaultOwnerPass,
      role: 'maintenance',
      orgId: 'org-kaveri',
      pwdChangeReq: 0,
    },
    {
      id: 'u-k4',
      username: 'kaveri.finance',
      email: 'finance@kaverilogistics.in',
      fullName: 'Lakshmi Narayanan',
      password: defaultOwnerPass,
      role: 'finance',
      orgId: 'org-kaveri',
      pwdChangeReq: 0,
    },
    {
      id: 'u-d1',
      username: 'deccan.owner',
      email: 'nandini@deccanev.in',
      fullName: 'Nandini Rao',
      password: defaultOwnerPass,
      role: 'org_admin',
      orgId: 'org-deccan',
      pwdChangeReq: 0,
    },
    {
      id: 'u-sth-1',
      username: 'southern.owner',
      email: 'aravind@southernfreight.in',
      fullName: 'Aravind Menon',
      password: defaultTempPass,
      role: 'org_admin',
      orgId: 'org-southern',
      pwdChangeReq: 1,
    },
  ]

  for (const u of initialUsers) {
    insertUser.run(
      u.id,
      u.username,
      u.email,
      u.fullName,
      hashPassword(u.password),
      u.role,
      u.orgId,
      u.pwdChangeReq,
      'active',
      nowIso,
    )
  }

  db.prepare(`
    INSERT INTO platform_admin_audit_logs (
      id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'paud-init-1',
    'u-platform-admin',
    'superadmin',
    'ONBOARD_ORGANIZATION',
    'org-southern',
    'Southern Freight Corridor LLP',
    'Initial commercial fleet onboarding with mandatory first-login credential rotation',
    JSON.stringify({ planId: 'starter', ownerUsername: 'southern.owner' }),
    nowIso,
  )
}

function ensureColumn(db: DatabaseSync, table: string, column: string, sqlDef: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${sqlDef}`)
  }
}

export function ensureCanonicalSchema(db: DatabaseSync): void {
  ensureColumn(db, 'users', 'driver_id', 'TEXT')
  ensureColumn(db, 'users', 'mobile', 'TEXT')
  ensureColumn(db, 'users', 'staff_profile_id', 'TEXT')

  ensureColumn(db, 'organizations', 'business_type', 'TEXT')
  ensureColumn(db, 'organizations', 'onboarding_completed', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(db, 'organizations', 'onboarding_step', 'INTEGER NOT NULL DEFAULT 6')
  ensureColumn(db, 'organizations', 'billing_frequency', "TEXT NOT NULL DEFAULT 'monthly'")
  ensureColumn(db, 'organizations', 'grace_period_days', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'organizations', 'expired_access_policy', "TEXT NOT NULL DEFAULT 'read_only'")

  // fleet_trips may not exist in unit tests that skip ensureFleetSchemaAndMigrate
  const hasTripsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'fleet_trips'")
    .get() as { name?: string } | undefined
  if (hasTripsTable?.name) {
    ensureColumn(db, 'fleet_trips', 'odometer_start', 'REAL')
    ensureColumn(db, 'fleet_trips', 'odometer_end', 'REAL')
    ensureColumn(db, 'fleet_trips', 'odometer_flag', 'TEXT')
    ensureColumn(db, 'fleet_trips', 'odometer_flag_reason', 'TEXT')
    ensureColumn(db, 'fleet_trips', 'driver_notes', 'TEXT')
    ensureColumn(db, 'fleet_trips', 'started_by_user_id', 'TEXT')
    ensureColumn(db, 'fleet_trips', 'completed_by_user_id', 'TEXT')
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_profiles (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile TEXT,
      employee_code TEXT,
      designation TEXT NOT NULL DEFAULT 'Fleet Staff',
      department TEXT DEFAULT 'Operations',
      employment_status TEXT NOT NULL DEFAULT 'active',
      account_status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_staff_profiles_org ON staff_profiles(organization_id);

    CREATE TABLE IF NOT EXISTS user_permissions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      staff_profile_id TEXT REFERENCES staff_profiles(id) ON DELETE CASCADE,
      permissions_json TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_permissions_org ON user_permissions(organization_id);

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL,
      target_record_id TEXT NOT NULL,
      email TEXT NOT NULL,
      mobile TEXT,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      raw_token_preview TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      permissions_json TEXT,
      invited_by TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      accepted_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_invitations_org ON invitations(organization_id);

    CREATE TABLE IF NOT EXISTS subscription_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      billing_frequency TEXT NOT NULL,
      base_amount_inr INTEGER NOT NULL,
      tax_rate_pct INTEGER NOT NULL DEFAULT 18,
      tax_amount_inr INTEGER NOT NULL,
      total_payable_inr INTEGER NOT NULL,
      monthly_equivalent_inr INTEGER NOT NULL,
      savings_vs_monthly_inr INTEGER NOT NULL DEFAULT 0,
      savings_percent REAL NOT NULL DEFAULT 0,
      vehicle_limit INTEGER NOT NULL DEFAULT -1,
      driver_limit INTEGER NOT NULL DEFAULT -1,
      staff_limit INTEGER NOT NULL DEFAULT -1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT UNIQUE NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      billing_frequency TEXT NOT NULL,
      status TEXT NOT NULL,
      base_amount_inr INTEGER NOT NULL,
      tax_amount_inr INTEGER NOT NULL,
      total_amount_inr INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      started_at TEXT NOT NULL,
      current_period_start TEXT,
      current_period_end TEXT,
      grace_period_days INTEGER NOT NULL DEFAULT 0,
      expired_access_policy TEXT NOT NULL DEFAULT 'read_only',
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      auto_renew INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscription_payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      billing_cycle TEXT NOT NULL,
      base_amount_inr INTEGER NOT NULL,
      tax_amount_inr INTEGER NOT NULL,
      total_amount_inr INTEGER NOT NULL,
      reported_amount_inr INTEGER,
      payment_method TEXT NOT NULL DEFAULT 'UPI / Razorpay',
      status TEXT NOT NULL,
      gateway_reference TEXT,
      invoice_id TEXT,
      verified_by TEXT,
      verified_at TEXT,
      failure_reason TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sub_payments_org ON subscription_payments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON subscription_payments(status);

    CREATE TABLE IF NOT EXISTS subscription_events (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subscription_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_user_id TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sub_events_org ON subscription_events(organization_id);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      recipient_user_id TEXT,
      recipient_role TEXT,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      module TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      action_url TEXT,
      severity TEXT NOT NULL DEFAULT 'info',
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, organization_id, is_read);

    CREATE TABLE IF NOT EXISTS staff_activity_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      staff_user_id TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      previous_value_json TEXT,
      new_value_json TEXT,
      device_info TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_staff_activity_org ON staff_activity_logs(organization_id);

    CREATE TABLE IF NOT EXISTS driver_expenses (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT,
      trip_id TEXT,
      category TEXT NOT NULL,
      amount_inr REAL NOT NULL,
      expense_date TEXT NOT NULL,
      odometer_km REAL,
      location TEXT,
      description TEXT,
      receipt_url TEXT,
      approval_status TEXT NOT NULL DEFAULT 'Submitted',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      reviewed_by TEXT,
      reviewed_at TEXT,
      review_note TEXT,
      paid_by TEXT,
      paid_at TEXT,
      payment_reference TEXT,
      created_by_user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_driver_expenses_org ON driver_expenses(organization_id, driver_id);

    CREATE TABLE IF NOT EXISTS platform_integrations_config (
      id TEXT PRIMARY KEY,
      provider_key TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected',
      config_json TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_support_sessions (
      id TEXT PRIMARY KEY,
      platform_admin_id TEXT NOT NULL,
      platform_admin_username TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
  `)

  const nowIso = new Date().toISOString()

  // Seed canonical two active subscription plans cleanly
  const upsertPlan = db.prepare(`
    INSERT OR REPLACE INTO subscription_plans (
      id, name, tagline, billing_frequency, base_amount_inr, tax_rate_pct,
      tax_amount_inr, total_payable_inr, monthly_equivalent_inr, savings_vs_monthly_inr,
      savings_percent, vehicle_limit, driver_limit, staff_limit, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `)
  for (const plan of CANONICAL_SUBSCRIPTION_PLANS) {
    upsertPlan.run(
      plan.id,
      plan.name,
      plan.tagline,
      plan.billingFrequency,
      plan.baseAmountInr,
      plan.gstRatePct,
      plan.taxAmountInr,
      plan.totalPayableInr,
      plan.monthlyEquivalentInr,
      plan.savingsVsMonthlyInr,
      plan.savingsPercent,
      plan.vehicleLimit,
      plan.driverLimit,
      plan.staffLimit,
      nowIso,
    )
  }

  // Normalize seeded legacy orgs to Monthly / Annual + Unlimited caps
  db.prepare(`
    UPDATE organizations
    SET plan_id = 'annual',
        billing_frequency = 'annual',
        business_type = COALESCE(business_type, 'Goods Transportation'),
        vehicle_limit = ?,
        driver_limit = ?,
        onboarding_completed = 1,
        onboarding_step = 6
    WHERE id = 'org-kaveri' AND plan_id IN ('growth', 'enterprise', 'annual')
  `).run(UNLIMITED_SEAT_CAP, UNLIMITED_SEAT_CAP)

  db.prepare(`
    UPDATE organizations
    SET plan_id = 'monthly',
        billing_frequency = 'monthly',
        business_type = COALESCE(business_type, 'Logistics'),
        vehicle_limit = ?,
        driver_limit = ?,
        onboarding_completed = 1,
        onboarding_step = 6
    WHERE id = 'org-deccan' AND plan_id IN ('starter', 'monthly')
  `).run(UNLIMITED_SEAT_CAP, UNLIMITED_SEAT_CAP)

  db.prepare(`
    UPDATE organizations
    SET plan_id = 'monthly',
        billing_frequency = 'monthly',
        business_type = COALESCE(business_type, 'Transport'),
        vehicle_limit = ?,
        driver_limit = ?,
        onboarding_completed = 0,
        onboarding_step = 1
    WHERE id = 'org-southern' AND plan_id IN ('starter', 'monthly')
  `).run(UNLIMITED_SEAT_CAP, UNLIMITED_SEAT_CAP)

  // Backfill legacy saas_billing_invoices prices if old Starter/Growth/Enterprise amounts remain
  const monthlyTotals = computeCheckoutTotals('monthly')
  const annualTotals = computeCheckoutTotals('annual')
  db.prepare(`
    UPDATE saas_billing_invoices
    SET plan_id = 'annual', billing_cycle = 'annual', base_amount_inr = ?, gst_inr = ?, total_inr = ?,
        notes = 'Annual Plan (Unlimited fleet) — 18% GST included'
    WHERE organization_id = 'org-kaveri' AND plan_id IN ('growth', 'enterprise')
  `).run(annualTotals.baseAmountInr, annualTotals.taxAmountInr, annualTotals.totalPayableInr)
  db.prepare(`
    UPDATE saas_billing_invoices
    SET plan_id = 'monthly', billing_cycle = 'monthly', base_amount_inr = ?, gst_inr = ?, total_inr = ?,
        notes = 'Monthly Plan (Unlimited fleet) — 18% GST included'
    WHERE organization_id IN ('org-deccan', 'org-southern') AND plan_id = 'starter'
  `).run(monthlyTotals.baseAmountInr, monthlyTotals.taxAmountInr, monthlyTotals.totalPayableInr)

  // Ensure every organization has a canonical subscriptions row
  const allOrgs = db.prepare('SELECT * FROM organizations').all() as Array<Record<string, unknown>>
  const upsertSub = db.prepare(`
    INSERT OR IGNORE INTO subscriptions (
      id, organization_id, plan_id, billing_frequency, status,
      base_amount_inr, tax_amount_inr, total_amount_inr, currency,
      started_at, current_period_start, current_period_end,
      grace_period_days, expired_access_policy, cancel_at_period_end,
      auto_renew, updated_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, 0, 1, ?, ?)
  `)

  for (const row of allOrgs) {
    const org = mapOrgRow(row)
    const freq = org.planId === 'annual' ? 'annual' : 'monthly'
    const totals = computeCheckoutTotals(freq)
    const subStatus =
      org.status === 'payment_pending' || org.paymentStatus === 'pending'
        ? 'pending_payment'
        : org.status === 'suspended'
          ? 'suspended'
          : org.status === 'grace_period'
            ? 'grace_period'
            : 'active'

    upsertSub.run(
      `sub-${org.id}`,
      org.id,
      freq,
      freq,
      subStatus,
      totals.baseAmountInr,
      totals.taxAmountInr,
      totals.totalPayableInr,
      org.subscriptionStartDate || nowIso.slice(0, 10),
      subStatus === 'pending_payment' ? null : org.subscriptionStartDate || nowIso.slice(0, 10),
      subStatus === 'pending_payment' ? null : org.subscriptionExpiryDate || null,
      org.gracePeriodDays ?? 0,
      org.expiredAccessPolicy ?? 'read_only',
      nowIso,
      org.createdAt || nowIso,
    )
  }

  // Ensure seeded staff user ('kaveri.staff') + seeded driver user ('kaveri.driver' -> 'd-k1') exist when 'org-kaveri' exists
  const kaveriExists = db
    .prepare("SELECT id FROM organizations WHERE id = 'org-kaveri'")
    .get() as { id?: string } | undefined

  if (kaveriExists?.id) {
    const defaultOwnerPass = process.env.SEED_OWNER_PASSWORD || 'DriveMitra@2026'
    const hasStaffUser = db
      .prepare("SELECT id FROM users WHERE id = 'u-k-staff1' OR username = 'kaveri.staff'")
      .get() as { id?: string } | undefined

    if (!hasStaffUser?.id) {
      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          driver_id, mobile, staff_profile_id, password_change_required, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, 'active', ?)
      `).run(
        'u-k-staff1',
        'kaveri.staff',
        'dispatch@kaverilogistics.in',
        'Arjun Subramanian',
        hashPassword(defaultOwnerPass),
        'fleet_staff',
        'org-kaveri',
        '+91 98400 44556',
        'stf-k-1',
        nowIso,
      )
    }

    const hasDriverUser = db
      .prepare("SELECT id FROM users WHERE id = 'u-k-drv1' OR username = 'kaveri.driver'")
      .get() as { id?: string } | undefined

    if (!hasDriverUser?.id) {
      // Seed ONLY ONE active driver portal account linked to d-k1 (Selvam Murugan).
      // Other drivers (d-k2, etc.) intentionally remain WITHOUT login credentials (Driver Record != Driver Login).
      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          driver_id, mobile, staff_profile_id, password_change_required, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'driver', 'org-kaveri', 'd-k1', '+91 98401 77889', NULL, 0, 'active', ?)
      `).run(
        'u-k-drv1',
        'kaveri.driver',
        'selvam.driver@kaverilogistics.in',
        'Selvam Murugan',
        hashPassword(defaultOwnerPass),
        nowIso,
      )
    }
  }

  // Ensure staff_profiles + user_permissions exist for all seeded non-owner/non-driver tenant staff
  const staffUsers = db
    .prepare(
      "SELECT * FROM users WHERE organization_id IS NOT NULL AND role IN ('fleet_staff', 'fleet_manager', 'maintenance', 'finance', 'viewer')",
    )
    .all() as Array<Record<string, unknown>>

  const insertProfile = db.prepare(`
    INSERT OR IGNORE INTO staff_profiles (
      id, organization_id, user_id, full_name, email, mobile, employee_code,
      designation, department, employment_status, account_status, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'active', 'system', ?, ?)
  `)
  const insertPerms = db.prepare(`
    INSERT OR IGNORE INTO user_permissions (
      id, organization_id, user_id, staff_profile_id, permissions_json, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'system', ?)
  `)

  for (const row of staffUsers) {
    const u = mapUserRow(row)
    if (!u.organizationId) continue
    const profileId = u.staffProfileId || `stf-${u.id}`
    const designation =
      u.role === 'fleet_staff'
        ? 'Fleet Operations Coordinator'
        : u.role === 'fleet_manager'
          ? 'Fleet Manager'
          : u.role === 'maintenance'
            ? 'Maintenance Supervisor'
            : u.role === 'finance'
              ? 'Finance Controller'
              : 'Viewer'
    insertProfile.run(
      profileId,
      u.organizationId,
      u.id,
      u.fullName,
      u.email,
      u.mobile ?? '+91 98400 00000',
      `EMP-${u.id.toUpperCase()}`,
      designation,
      u.role === 'finance' ? 'Finance' : u.role === 'maintenance' ? 'Workshop' : 'Operations',
      u.createdAt,
      nowIso,
    )
    if (!u.staffProfileId) {
      db.prepare('UPDATE users SET staff_profile_id = ? WHERE id = ?').run(profileId, u.id)
    }
    const matrix =
      u.role === 'fleet_staff'
        ? DEFAULT_STAFF_PERMISSION_MATRIX
        : getPresetMatrixForRole(u.role)
    insertPerms.run(
      `prm-${u.id}`,
      u.organizationId,
      u.id,
      profileId,
      JSON.stringify(matrix),
      nowIso,
    )
  }

  // Seed Platform Admin exclusive integrations catalog
  const existingIntegrations = db
    .prepare('SELECT COUNT(*) AS count FROM platform_integrations_config')
    .get() as { count: number }
  if (existingIntegrations.count === 0) {
    const insertInt = db.prepare(`
      INSERT INTO platform_integrations_config (
        id, provider_key, name, category, status, config_json, updated_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'u-platform-admin', ?)
    `)
    const seedProviders = [
      {
        id: 'pint-razorpay',
        key: 'razorpay_gateway',
        name: 'Razorpay UPI & NetBanking Gateway',
        category: 'Payment Gateway',
        status: 'connected',
        config: { mode: 'live_verification', gstRatePct: 18, settlementCycle: 'T+1' },
      },
      {
        id: 'pint-maps',
        key: 'google_maps_corridors',
        name: 'Corridor Maps & Weather Telemetry Relay',
        category: 'Maps & Telemetry',
        status: 'connected',
        config: { osmFallback: true, weatherProvider: 'Open-Meteo' },
      },
      {
        id: 'pint-parivahan',
        key: 'parivahan_vahan',
        name: 'Parivahan / Vahan & DigiLocker Verification',
        category: 'Compliance',
        status: 'sandbox',
        config: { endpoint: 'api.parivahan.gov.in', autoCheckRcFitness: true },
      },
      {
        id: 'pint-webhooks',
        key: 'platform_webhooks',
        name: 'Platform Outbound Webhook Dispatcher',
        category: 'Developer APIs',
        status: 'connected',
        config: { retryPolicy: 'exponential_3x', timeoutMs: 5000 },
      },
    ]
    for (const p of seedProviders) {
      insertInt.run(p.id, p.key, p.name, p.category, p.status, JSON.stringify(p.config), nowIso)
    }
  }
}

export function mapUserRow(row: Record<string, unknown>): DbUserRow {
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    fullName: String(row.full_name),
    passwordHash: String(row.password_hash),
    role: String(row.role) as OrganizationRole,
    organizationId: row.organization_id ? String(row.organization_id) : null,
    driverId: row.driver_id ? String(row.driver_id) : null,
    staffProfileId: row.staff_profile_id ? String(row.staff_profile_id) : null,
    mobile: row.mobile ? String(row.mobile) : null,
    passwordChangeRequired: Number(row.password_change_required) === 1,
    status: String(row.status) as DbUserRow['status'],
    createdAt: String(row.created_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  }
}

export function mapOrgRow(row: Record<string, unknown>): Organization {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    city: String(row.city),
    state: String(row.state),
    timezone: String(row.timezone),
    currency: 'INR',
    planId: String(row.plan_id) as Organization['planId'],
    billingFrequency:
      row.billing_frequency === 'annual' || row.plan_id === 'annual' ? 'annual' : 'monthly',
    businessType: row.business_type ? (String(row.business_type) as Organization['businessType']) : undefined,
    vehicleLimit: Number(row.vehicle_limit),
    driverLimit: Number(row.driver_limit),
    status: String(row.status) as OrganizationStatus,
    paymentStatus: String(row.payment_status) as Organization['paymentStatus'],
    onboardingCompleted:
      row.onboarding_completed === undefined || row.onboarding_completed === null
        ? true
        : Number(row.onboarding_completed) === 1,
    onboardingStep:
      row.onboarding_step !== undefined && row.onboarding_step !== null
        ? Number(row.onboarding_step)
        : 6,
    gracePeriodDays:
      row.grace_period_days !== undefined && row.grace_period_days !== null
        ? Number(row.grace_period_days)
        : 0,
    expiredAccessPolicy:
      row.expired_access_policy === 'blocked' ? 'blocked' : 'read_only',
    subscriptionStartDate: String(row.subscription_start_date),
    subscriptionExpiryDate: String(row.subscription_expiry_date),
    gracePeriodUntil: row.grace_period_until ? String(row.grace_period_until) : undefined,
    suspensionReason: row.suspension_reason ? String(row.suspension_reason) : undefined,
    ownerName: row.owner_name ? String(row.owner_name) : undefined,
    ownerEmail: row.owner_email ? String(row.owner_email) : undefined,
    ownerPhone: row.owner_phone ? String(row.owner_phone) : undefined,
    gstin: row.gstin ? String(row.gstin) : undefined,
    createdAt: String(row.created_at),
    environment: 'production',
  }
}

export function mapSaasInvoiceRow(row: Record<string, unknown>): SaasBillingInvoiceRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    invoiceNumber: String(row.invoice_number),
    planId: String(row.plan_id),
    billingCycle: String(row.billing_cycle) === 'annual' ? 'annual' : 'monthly',
    baseAmountInr: Number(row.base_amount_inr),
    gstInr: Number(row.gst_inr),
    totalInr: Number(row.total_inr),
    status: (String(row.status) as SaasBillingInvoiceRow['status']) || 'paid',
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    issuedAt: String(row.issued_at),
    notes: row.notes ? String(row.notes) : null,
  }
}
