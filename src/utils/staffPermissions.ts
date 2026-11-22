import type {
  ModulePermissionEntry,
  OrganizationRole,
  PermissionAction,
  PermissionModuleKey,
  SensitivePermissionKey,
  StaffPermissionMatrix,
} from '../types/fleet'

export interface PermissionModuleDefinition {
  key: PermissionModuleKey
  label: string
  category: 'Core Operations' | 'Maintenance & Assets' | 'Finance & Governance'
  platformAdminOnly?: boolean
  defaultStaffSummary: string
}

export const PERMISSION_ACTIONS: Array<{ key: PermissionAction; label: string }> = [
  { key: 'view', label: 'View' },
  { key: 'add', label: 'Add' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'approve', label: 'Approve' },
  { key: 'export', label: 'Export' },
  { key: 'manage', label: 'Manage / Maintain' },
]

export const SENSITIVE_PERMISSION_LABELS: Array<{ key: SensitivePermissionKey; label: string; description: string }> = [
  {
    key: 'viewBankDetails',
    label: 'View Bank Account & IFSC Details',
    description: 'Reveal unmasked account numbers, IFSC codes, and beneficiary banking fields.',
  },
  {
    key: 'modifyContractRates',
    label: 'Modify Vehicle Contract Rates',
    description: 'Change contracted monthly/per-km tariff amounts on vehicle contracts.',
  },
  {
    key: 'releaseDeposits',
    label: 'Release or Deduct Security Deposits',
    description: 'Approve deposit deductions or release bond refunds.',
  },
  {
    key: 'approveContractAmendments',
    label: 'Approve Contract Amendments',
    description: 'Approve or reject contract amendment proposals.',
  },
  {
    key: 'viewFinancialLedgers',
    label: 'View Full Financial Ledgers & TCO',
    description: 'Access profit/loss, EMI principal/interest breakdowns, and GST invoices.',
  },
]

export const PERMISSION_MODULES: PermissionModuleDefinition[] = [
  { key: 'dashboard', label: 'Dashboard', category: 'Core Operations', defaultStaffSummary: 'View' },
  { key: 'live_monitoring', label: 'Live Monitoring', category: 'Core Operations', defaultStaffSummary: 'View' },
  { key: 'vehicles', label: 'Vehicles', category: 'Core Operations', defaultStaffSummary: 'Add + Edit' },
  { key: 'drivers', label: 'Drivers', category: 'Core Operations', defaultStaffSummary: 'Add + Edit' },
  { key: 'staff', label: 'Staff Management', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  { key: 'trips', label: 'Trip Planning', category: 'Core Operations', defaultStaffSummary: 'Add + Edit' },
  { key: 'assignments', label: 'Vehicle Assignment', category: 'Core Operations', defaultStaffSummary: 'Add + Edit' },
  { key: 'meter_history', label: 'Meter History', category: 'Core Operations', defaultStaffSummary: 'Add + Edit' },
  { key: 'tyre_readings', label: 'Tyre Readings', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'expense_history', label: 'Expense History', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  { key: 'replacement_analysis', label: 'Replacement Analysis', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  { key: 'tools_equipment', label: 'Tools & Equipment', category: 'Maintenance & Assets', defaultStaffSummary: 'Add + Edit + Maintain' },
  { key: 'inspections', label: 'Inspections', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'issues', label: 'Issues', category: 'Maintenance & Assets', defaultStaffSummary: 'Add + Edit' },
  { key: 'reminders', label: 'Reminders', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'maintenance', label: 'Maintenance', category: 'Maintenance & Assets', defaultStaffSummary: 'View + Maintain' },
  { key: 'work_orders', label: 'Work Orders', category: 'Maintenance & Assets', defaultStaffSummary: 'View + Maintain' },
  { key: 'contacts', label: 'Contacts', category: 'Core Operations', defaultStaffSummary: 'No Access' },
  { key: 'vendors', label: 'Vendors', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'parts_inventory', label: 'Parts & Inventory', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'fuel_history', label: 'Fuel History', category: 'Core Operations', defaultStaffSummary: 'View' },
  { key: 'charging_history', label: 'Charging History', category: 'Core Operations', defaultStaffSummary: 'View' },
  { key: 'places', label: 'Places', category: 'Core Operations', defaultStaffSummary: 'View' },
  { key: 'documents', label: 'Documents', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'warranties', label: 'Warranties', category: 'Maintenance & Assets', defaultStaffSummary: 'No Access' },
  { key: 'custom_records', label: 'Custom Records', category: 'Core Operations', defaultStaffSummary: 'Add + Edit + Maintain' },
  { key: 'vehicle_contracts', label: 'Vehicle Contracts', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  { key: 'finance', label: 'Finance', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  { key: 'reports', label: 'Reports', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  { key: 'settings', label: 'Settings', category: 'Finance & Governance', defaultStaffSummary: 'No Access' },
  {
    key: 'integrations',
    label: 'Integrations (Platform Admin Only)',
    category: 'Finance & Governance',
    platformAdminOnly: true,
    defaultStaffSummary: 'No Access',
  },
]

export function makeEmptyEntry(): ModulePermissionEntry {
  return {
    view: false,
    add: false,
    edit: false,
    delete: false,
    approve: false,
    export: false,
    manage: false,
  }
}

export function makeEntry(actions: PermissionAction[]): ModulePermissionEntry {
  const entry = makeEmptyEntry()
  for (const act of actions) {
    entry[act] = true
  }
  return entry
}

export function makeAllDeniedMatrix(): StaffPermissionMatrix {
  const modules = {} as Record<PermissionModuleKey, ModulePermissionEntry>
  for (const m of PERMISSION_MODULES) {
    modules[m.key] = makeEmptyEntry()
  }
  return {
    modules,
    sensitive: {
      viewBankDetails: false,
      modifyContractRates: false,
      releaseDeposits: false,
      approveContractAmendments: false,
      viewFinancialLedgers: false,
    },
  }
}

/**
 * Canonical Part 3.2 Default Staff Permission Matrix
 * Exact match: only the 15 listed modules have access; all remaining 16 default to No Access.
 */
export function buildDefaultStaffPermissionMatrix(): StaffPermissionMatrix {
  const matrix = makeAllDeniedMatrix()
  matrix.modules.dashboard = makeEntry(['view'])
  matrix.modules.live_monitoring = makeEntry(['view'])
  matrix.modules.vehicles = makeEntry(['view', 'add', 'edit'])
  matrix.modules.drivers = makeEntry(['view', 'add', 'edit'])
  matrix.modules.trips = makeEntry(['view', 'add', 'edit'])
  matrix.modules.assignments = makeEntry(['view', 'add', 'edit'])
  matrix.modules.meter_history = makeEntry(['view', 'add', 'edit'])
  matrix.modules.tools_equipment = makeEntry(['view', 'add', 'edit', 'manage'])
  matrix.modules.issues = makeEntry(['view', 'add', 'edit'])
  matrix.modules.maintenance = makeEntry(['view', 'manage'])
  matrix.modules.work_orders = makeEntry(['view', 'manage'])
  matrix.modules.fuel_history = makeEntry(['view'])
  matrix.modules.charging_history = makeEntry(['view'])
  matrix.modules.places = makeEntry(['view'])
  matrix.modules.custom_records = makeEntry(['view', 'add', 'edit', 'manage'])
  return matrix
}

export const DEFAULT_STAFF_PERMISSION_MATRIX: StaffPermissionMatrix = buildDefaultStaffPermissionMatrix()

export function buildOwnerPermissionMatrix(): StaffPermissionMatrix {
  const modules = {} as Record<PermissionModuleKey, ModulePermissionEntry>
  for (const m of PERMISSION_MODULES) {
    if (m.key === 'integrations') {
      // Integrations are strictly Platform Admin only per Part 2.4 & Part 5
      modules[m.key] = makeEmptyEntry()
    } else {
      modules[m.key] = makeEntry(['view', 'add', 'edit', 'delete', 'approve', 'export', 'manage'])
    }
  }
  return {
    modules,
    sensitive: {
      viewBankDetails: true,
      modifyContractRates: true,
      releaseDeposits: true,
      approveContractAmendments: true,
      viewFinancialLedgers: true,
    },
  }
}

export function buildPlatformAdminMatrix(): StaffPermissionMatrix {
  const owner = buildOwnerPermissionMatrix()
  owner.modules.integrations = makeEntry(['view', 'add', 'edit', 'delete', 'approve', 'export', 'manage'])
  return owner
}

export function normalizeStaffPermissions(raw: unknown): StaffPermissionMatrix {
  const base = makeAllDeniedMatrix()
  if (!raw || typeof raw !== 'object') {
    return buildDefaultStaffPermissionMatrix()
  }
  const obj = raw as Partial<StaffPermissionMatrix>
  if (obj.modules && typeof obj.modules === 'object') {
    for (const def of PERMISSION_MODULES) {
      const candidate = (obj.modules as Record<string, Partial<ModulePermissionEntry>>)[def.key]
      if (candidate && typeof candidate === 'object') {
        const entry = makeEmptyEntry()
        for (const act of PERMISSION_ACTIONS) {
          entry[act.key] = Boolean(candidate[act.key])
        }
        // Integrations cannot be granted to tenant staff/owners under any override
        if (def.key === 'integrations') {
          base.modules[def.key] = makeEmptyEntry()
        } else {
          // If write/manage actions are granted, ensure view is active too
          if (entry.add || entry.edit || entry.delete || entry.approve || entry.export || entry.manage) {
            entry.view = true
          }
          base.modules[def.key] = entry
        }
      }
    }
  }
  if (obj.sensitive && typeof obj.sensitive === 'object') {
    for (const s of SENSITIVE_PERMISSION_LABELS) {
      base.sensitive[s.key] = Boolean((obj.sensitive as Record<string, unknown>)[s.key])
    }
  }
  return base
}

export function getPresetMatrixForRole(role: OrganizationRole): StaffPermissionMatrix {
  if (role === 'platform_admin') return buildPlatformAdminMatrix()
  if (role === 'org_admin') return buildOwnerPermissionMatrix()
  if (role === 'driver') return makeAllDeniedMatrix()
  if (role === 'fleet_staff') return buildDefaultStaffPermissionMatrix()

  if (role === 'fleet_manager') {
    const m = buildOwnerPermissionMatrix()
    m.modules.staff = makeEntry(['view'])
    m.modules.finance = makeEntry(['view', 'add', 'export'])
    m.sensitive.viewBankDetails = false
    m.sensitive.releaseDeposits = false
    m.sensitive.approveContractAmendments = false
    return m
  }

  if (role === 'maintenance') {
    const m = makeAllDeniedMatrix()
    m.modules.dashboard = makeEntry(['view'])
    m.modules.maintenance = makeEntry(['view', 'add', 'edit', 'manage'])
    m.modules.work_orders = makeEntry(['view', 'add', 'edit', 'manage'])
    m.modules.inspections = makeEntry(['view', 'add', 'edit'])
    m.modules.issues = makeEntry(['view', 'add', 'edit'])
    m.modules.reminders = makeEntry(['view', 'add', 'edit'])
    m.modules.tools_equipment = makeEntry(['view', 'add', 'edit', 'manage'])
    m.modules.parts_inventory = makeEntry(['view', 'add', 'edit', 'manage'])
    m.modules.vendors = makeEntry(['view', 'add', 'edit'])
    m.modules.tyre_readings = makeEntry(['view', 'add', 'edit'])
    m.modules.vehicles = makeEntry(['view'])
    m.modules.documents = makeEntry(['view'])
    m.modules.warranties = makeEntry(['view', 'add', 'edit'])
    m.modules.custom_records = makeEntry(['view', 'add', 'edit'])
    m.modules.vehicle_contracts = makeEntry(['view'])
    m.modules.reports = makeEntry(['view', 'export'])
    return m
  }

  if (role === 'finance') {
    const m = makeAllDeniedMatrix()
    m.modules.dashboard = makeEntry(['view'])
    m.modules.finance = makeEntry(['view', 'add', 'edit', 'approve', 'export', 'manage'])
    m.modules.vehicle_contracts = makeEntry(['view', 'add', 'edit', 'approve', 'export', 'manage'])
    m.modules.expense_history = makeEntry(['view', 'add', 'edit', 'approve', 'export'])
    m.modules.replacement_analysis = makeEntry(['view', 'export'])
    m.modules.fuel_history = makeEntry(['view', 'add', 'edit', 'approve', 'export'])
    m.modules.charging_history = makeEntry(['view', 'add', 'edit', 'approve', 'export'])
    m.modules.reports = makeEntry(['view', 'export'])
    m.modules.documents = makeEntry(['view'])
    m.sensitive = {
      viewBankDetails: true,
      modifyContractRates: true,
      releaseDeposits: true,
      approveContractAmendments: true,
      viewFinancialLedgers: true,
    }
    return m
  }

  // viewer (read-only)
  const m = makeAllDeniedMatrix()
  for (const def of PERMISSION_MODULES) {
    if (def.key !== 'integrations' && def.key !== 'staff' && def.key !== 'settings') {
      m.modules[def.key] = makeEntry(['view'])
    }
  }
  return m
}

export function hasModulePermission(
  matrix: StaffPermissionMatrix | null | undefined,
  role: OrganizationRole,
  moduleKey: PermissionModuleKey,
  action: PermissionAction = 'view',
): boolean {
  if (moduleKey === 'integrations') {
    return role === 'platform_admin'
  }
  if (role === 'platform_admin' || role === 'org_admin') {
    return true
  }
  if (role === 'driver') {
    return false
  }
  const effective = matrix ?? getPresetMatrixForRole(role)
  const entry = effective.modules?.[moduleKey]
  if (!entry) return false
  if (action === 'view') {
    return Boolean(entry.view || entry.add || entry.edit || entry.delete || entry.approve || entry.export || entry.manage)
  }
  return Boolean(entry[action])
}

export function resolveModulePermissionForPath(
  pathname: string,
): { moduleKey: PermissionModuleKey; action: PermissionAction } | null {
  const clean = pathname.replace(/\/+$/, '') || '/'
  if (clean === '/dashboard' || clean === '/dashboard/') {
    return { moduleKey: 'dashboard', action: 'view' }
  }
  if (clean === '/dashboard/map') return { moduleKey: 'live_monitoring', action: 'view' }
  if (clean === '/dashboard/map/geofences/new') return { moduleKey: 'places', action: 'edit' }
  if (clean === '/dashboard/roads') return { moduleKey: 'places', action: 'view' }

  if (clean === '/dashboard/integrations') return { moduleKey: 'integrations', action: 'view' }
  if (clean === '/dashboard/staff' || clean.startsWith('/dashboard/staff/')) {
    return { moduleKey: 'staff', action: 'view' }
  }
  if (clean === '/dashboard/admin' || clean.startsWith('/dashboard/admin/')) {
    return { moduleKey: 'staff', action: 'manage' }
  }
  if (clean === '/dashboard/settings' || clean.startsWith('/dashboard/settings/')) {
    return { moduleKey: 'settings', action: 'view' }
  }

  // Vehicles cluster
  if (clean === '/dashboard/fleet/new') return { moduleKey: 'vehicles', action: 'add' }
  if (/^\/dashboard\/fleet\/(vehicles\/)?[^/]+\/edit$/.test(clean)) return { moduleKey: 'vehicles', action: 'edit' }
  if (clean === '/dashboard/fleet/assignments/new') return { moduleKey: 'assignments', action: 'add' }
  if (clean === '/dashboard/fleet/assignments') return { moduleKey: 'assignments', action: 'view' }
  if (clean === '/dashboard/fleet/meter-history/new') return { moduleKey: 'meter_history', action: 'add' }
  if (clean === '/dashboard/fleet/meter-history') return { moduleKey: 'meter_history', action: 'view' }
  if (clean === '/dashboard/fleet/tire-readings/new' || clean.startsWith('/dashboard/fleet/tire-readings/')) {
    return { moduleKey: 'tyre_readings', action: clean.endsWith('/new') ? 'add' : 'edit' }
  }
  if (clean === '/dashboard/fleet/tire-readings') return { moduleKey: 'tyre_readings', action: 'view' }
  if (clean === '/dashboard/fleet/expenses') return { moduleKey: 'expense_history', action: 'view' }
  if (clean === '/dashboard/fleet/replacement-analysis') return { moduleKey: 'replacement_analysis', action: 'view' }
  if (clean.startsWith('/dashboard/fleet/drivers/')) return { moduleKey: 'drivers', action: 'view' }
  if (clean === '/dashboard/fleet' || clean.startsWith('/dashboard/fleet/')) {
    return { moduleKey: 'vehicles', action: 'view' }
  }

  // Drivers & Contacts & Trips
  if (clean === '/dashboard/drivers/new') return { moduleKey: 'drivers', action: 'add' }
  if (clean === '/dashboard/drivers' || clean.startsWith('/dashboard/drivers/')) {
    return { moduleKey: 'drivers', action: 'view' }
  }
  if (clean === '/dashboard/trips/new') return { moduleKey: 'trips', action: 'add' }
  if (clean === '/dashboard/trips') return { moduleKey: 'trips', action: 'view' }

  // Tools, Inspections, Issues, Reminders, Maintenance, Work Orders, Vendors, Parts
  if (clean === '/dashboard/tools/new') return { moduleKey: 'tools_equipment', action: 'add' }
  if (clean.startsWith('/dashboard/tools')) return { moduleKey: 'tools_equipment', action: 'view' }
  if (clean === '/dashboard/inspections/new' || clean === '/dashboard/inspections/schedules/new' || clean === '/dashboard/inspections/forms/new') {
    return { moduleKey: 'inspections', action: 'add' }
  }
  if (clean.startsWith('/dashboard/inspections')) return { moduleKey: 'inspections', action: 'view' }
  if (clean === '/dashboard/issues/new' || clean === '/dashboard/issues/recalls/new') {
    return { moduleKey: 'issues', action: 'add' }
  }
  if (clean.startsWith('/dashboard/issues') || clean === '/dashboard/risk') {
    return { moduleKey: 'issues', action: 'view' }
  }
  if (clean === '/dashboard/reminders/service/new') return { moduleKey: 'reminders', action: 'add' }
  if (clean.startsWith('/dashboard/reminders')) return { moduleKey: 'reminders', action: 'view' }
  if (clean === '/dashboard/work-orders/new') return { moduleKey: 'work_orders', action: 'add' }
  if (clean.startsWith('/dashboard/work-orders')) return { moduleKey: 'work_orders', action: 'view' }
  if (clean === '/dashboard/maintenance/new' || clean === '/dashboard/service/tasks/new' || clean === '/dashboard/service/programs/new') {
    return { moduleKey: 'maintenance', action: 'add' }
  }
  if (clean.startsWith('/dashboard/maintenance') || clean.startsWith('/dashboard/service')) {
    return { moduleKey: 'maintenance', action: 'view' }
  }
  if (clean === '/dashboard/workshops/new') return { moduleKey: 'vendors', action: 'add' }
  if (clean.startsWith('/dashboard/workshops')) return { moduleKey: 'vendors', action: 'view' }
  if (clean === '/dashboard/inventory/new' || clean === '/dashboard/inventory/purchase-orders/new') {
    return { moduleKey: 'parts_inventory', action: 'add' }
  }
  if (clean.startsWith('/dashboard/inventory')) return { moduleKey: 'parts_inventory', action: 'view' }

  // Fuel & Charging
  if (clean === '/dashboard/fuel/charging/new') return { moduleKey: 'charging_history', action: 'add' }
  if (clean === '/dashboard/fuel/charging') return { moduleKey: 'charging_history', action: 'view' }
  if (clean === '/dashboard/fuel/new') return { moduleKey: 'fuel_history', action: 'add' }
  if (clean.startsWith('/dashboard/fuel')) return { moduleKey: 'fuel_history', action: 'view' }

  // Documents, Warranties, Custom Records
  if (clean.startsWith('/dashboard/documents')) return { moduleKey: 'documents', action: 'view' }
  if (clean === '/dashboard/warranties/new') return { moduleKey: 'warranties', action: 'add' }
  if (clean.startsWith('/dashboard/warranties')) return { moduleKey: 'warranties', action: 'view' }
  if (clean === '/dashboard/custom-records/new') return { moduleKey: 'custom_records', action: 'add' }
  if (clean.startsWith('/dashboard/custom-records')) return { moduleKey: 'custom_records', action: 'view' }

  // Contracts
  if (clean.startsWith('/dashboard/contracts')) {
    if (clean.endsWith('/new') || clean.endsWith('/upload')) return { moduleKey: 'vehicle_contracts', action: 'add' }
    if (clean.endsWith('/edit') || clean.endsWith('/amend') || clean.endsWith('/renew')) {
      return { moduleKey: 'vehicle_contracts', action: 'edit' }
    }
    return { moduleKey: 'vehicle_contracts', action: 'view' }
  }

  // Finance
  if (clean.startsWith('/dashboard/finance')) {
    if (clean.endsWith('/new') || clean.endsWith('/upload') || clean.endsWith('/pay')) {
      return { moduleKey: 'finance', action: 'add' }
    }
    if (clean.endsWith('/edit') || clean.endsWith('/correct')) {
      return { moduleKey: 'finance', action: 'edit' }
    }
    return { moduleKey: 'finance', action: 'view' }
  }

  // Reports & Analytics
  if (clean === '/dashboard/financials' || clean.startsWith('/dashboard/financials/')) {
    return { moduleKey: 'reports', action: 'view' }
  }
  if (clean === '/dashboard/reports') return { moduleKey: 'reports', action: 'view' }

  if (clean === '/dashboard/alerts') return { moduleKey: 'dashboard', action: 'view' }
  if (clean === '/dashboard/mobile') return { moduleKey: 'dashboard', action: 'view' }
  if (clean === '/dashboard/get-started' || clean === '/dashboard/support') return { moduleKey: 'dashboard', action: 'view' }

  return null
}

export function maskAccountNumber(raw: string | null | undefined, allowUnmasked: boolean): string {
  if (!raw) return 'Not Provided'
  if (allowUnmasked) return raw
  const clean = raw.replace(/\s+/g, '')
  if (clean.length <= 4) return '••••'
  return `${'•'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`
}
