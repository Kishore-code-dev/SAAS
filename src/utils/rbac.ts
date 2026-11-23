import type { OrganizationRole, PermissionAction, PermissionModuleKey, StaffPermissionMatrix } from '../types/fleet'
import {
  getPresetMatrixForRole,
  hasModulePermission,
  resolveModulePermissionForPath,
} from './staffPermissions'

export type FleetAction =
  | 'create_organization'
  | 'manage_platform_orgs'
  | 'manage_members'
  | 'add_vehicle'
  | 'edit_vehicle'
  | 'decommission_vehicle'
  | 'restore_vehicle'
  | 'assign_driver'
  | 'add_driver'
  | 'manage_driver_status'
  | 'verify_documents'
  | 'dispute_driver_event'
  | 'resolve_driver_dispute'
  | 'schedule_trip'
  | 'end_trip'
  | 'log_fuel'
  | 'verify_fuel'
  | 'schedule_maintenance'
  | 'complete_maintenance'
  | 'resolve_prediction'
  | 'manage_work_orders'
  | 'manage_inventory'
  | 'manage_workshops'
  | 'submit_inspection'
  | 'report_issue'
  | 'acknowledge_alert'
  | 'manage_financials'
  | 'manage_subscription'
  | 'update_org_settings'
  | 'update_global_settings'
  | 'update_telemetry'
  | 'export_reports'
  | 'use_copilot'
  | 'view_finance'
  | 'view_finance_unmasked'
  | 'add_finance_records'
  | 'edit_finance_records'
  | 'record_finance_payments'
  | 'reconcile_finance_payments'
  | 'manage_bank_details'
  | 'manage_finance_settings'
  | 'view_finance_reports'
  | 'approve_expense'

const ROLE_ACTIONS: Record<OrganizationRole, Set<FleetAction>> = {
  platform_admin: new Set<FleetAction>([
    'create_organization',
    'manage_platform_orgs',
    'manage_members',
    'add_vehicle',
    'edit_vehicle',
    'decommission_vehicle',
    'restore_vehicle',
    'assign_driver',
    'add_driver',
    'manage_driver_status',
    'verify_documents',
    'dispute_driver_event',
    'resolve_driver_dispute',
    'schedule_trip',
    'end_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'manage_work_orders',
    'manage_inventory',
    'manage_workshops',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'manage_financials',
    'manage_subscription',
    'update_org_settings',
    'update_global_settings',
    'update_telemetry',
    'export_reports',
    'use_copilot',
    'view_finance',
    'view_finance_unmasked',
    'add_finance_records',
    'edit_finance_records',
    'record_finance_payments',
    'reconcile_finance_payments',
    'manage_bank_details',
    'manage_finance_settings',
    'view_finance_reports',
  ]),
  org_admin: new Set<FleetAction>([
    'manage_members',
    'add_vehicle',
    'edit_vehicle',
    'decommission_vehicle',
    'restore_vehicle',
    'assign_driver',
    'add_driver',
    'manage_driver_status',
    'verify_documents',
    'dispute_driver_event',
    'resolve_driver_dispute',
    'schedule_trip',
    'end_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'manage_work_orders',
    'manage_inventory',
    'manage_workshops',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'manage_financials',
    'manage_subscription',
    'update_org_settings',
    'update_telemetry',
    'export_reports',
    'use_copilot',
    'view_finance',
    'view_finance_unmasked',
    'add_finance_records',
    'edit_finance_records',
    'record_finance_payments',
    'reconcile_finance_payments',
    'manage_bank_details',
    'manage_finance_settings',
    'view_finance_reports',
    'approve_expense',
  ]),
  fleet_staff: new Set<FleetAction>([
    'add_vehicle',
    'edit_vehicle',
    'assign_driver',
    'add_driver',
    'schedule_trip',
    'end_trip',
    'schedule_maintenance',
    'manage_work_orders',
    'report_issue',
    'acknowledge_alert',
    'use_copilot',
    'approve_expense',
  ]),
  driver: new Set<FleetAction>([
    'end_trip',
    'log_fuel',
    'submit_inspection',
    'report_issue',
    'dispute_driver_event',
  ]),
  fleet_manager: new Set<FleetAction>([
    'add_vehicle',
    'edit_vehicle',
    'decommission_vehicle',
    'restore_vehicle',
    'assign_driver',
    'add_driver',
    'manage_driver_status',
    'verify_documents',
    'dispute_driver_event',
    'resolve_driver_dispute',
    'schedule_trip',
    'end_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'manage_work_orders',
    'manage_inventory',
    'manage_workshops',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'update_org_settings',
    'update_telemetry',
    'export_reports',
    'use_copilot',
    'view_finance',
    'add_finance_records',
    'record_finance_payments',
    'view_finance_reports',
  ]),
  maintenance: new Set<FleetAction>([
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'manage_work_orders',
    'manage_inventory',
    'manage_workshops',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'export_reports',
    'use_copilot',
  ]),
  finance: new Set<FleetAction>([
    'log_fuel',
    'verify_fuel',
    'manage_financials',
    'manage_subscription',
    'acknowledge_alert',
    'export_reports',
    'use_copilot',
    'view_finance',
    'view_finance_unmasked',
    'add_finance_records',
    'edit_finance_records',
    'record_finance_payments',
    'reconcile_finance_payments',
    'manage_bank_details',
    'manage_finance_settings',
    'view_finance_reports',
    'approve_expense',
  ]),
  viewer: new Set<FleetAction>([
    'export_reports',
    'use_copilot',
    'view_finance',
    'view_finance_reports',
  ]),
}

export const ACTION_TO_MODULE_PERMISSION: Record<
  FleetAction,
  { moduleKey: PermissionModuleKey; action: PermissionAction } | null
> = {
  create_organization: null,
  manage_platform_orgs: null,
  manage_members: { moduleKey: 'staff', action: 'manage' },
  add_vehicle: { moduleKey: 'vehicles', action: 'add' },
  edit_vehicle: { moduleKey: 'vehicles', action: 'edit' },
  decommission_vehicle: { moduleKey: 'vehicles', action: 'delete' },
  restore_vehicle: { moduleKey: 'vehicles', action: 'edit' },
  assign_driver: { moduleKey: 'assignments', action: 'edit' },
  add_driver: { moduleKey: 'drivers', action: 'add' },
  manage_driver_status: { moduleKey: 'drivers', action: 'edit' },
  verify_documents: { moduleKey: 'documents', action: 'approve' },
  dispute_driver_event: { moduleKey: 'drivers', action: 'edit' },
  resolve_driver_dispute: { moduleKey: 'drivers', action: 'approve' },
  schedule_trip: { moduleKey: 'trips', action: 'add' },
  end_trip: { moduleKey: 'trips', action: 'edit' },
  log_fuel: { moduleKey: 'fuel_history', action: 'add' },
  verify_fuel: { moduleKey: 'fuel_history', action: 'approve' },
  schedule_maintenance: { moduleKey: 'maintenance', action: 'manage' },
  complete_maintenance: { moduleKey: 'maintenance', action: 'manage' },
  resolve_prediction: { moduleKey: 'maintenance', action: 'manage' },
  manage_work_orders: { moduleKey: 'work_orders', action: 'manage' },
  manage_inventory: { moduleKey: 'parts_inventory', action: 'manage' },
  manage_workshops: { moduleKey: 'vendors', action: 'manage' },
  submit_inspection: { moduleKey: 'inspections', action: 'add' },
  report_issue: { moduleKey: 'issues', action: 'add' },
  acknowledge_alert: { moduleKey: 'dashboard', action: 'view' },
  manage_financials: { moduleKey: 'finance', action: 'manage' },
  manage_subscription: { moduleKey: 'settings', action: 'manage' },
  update_org_settings: { moduleKey: 'settings', action: 'edit' },
  update_global_settings: null,
  update_telemetry: { moduleKey: 'live_monitoring', action: 'edit' },
  export_reports: { moduleKey: 'reports', action: 'export' },
  use_copilot: { moduleKey: 'dashboard', action: 'view' },
  view_finance: { moduleKey: 'finance', action: 'view' },
  view_finance_unmasked: { moduleKey: 'finance', action: 'view' },
  add_finance_records: { moduleKey: 'finance', action: 'add' },
  edit_finance_records: { moduleKey: 'finance', action: 'edit' },
  record_finance_payments: { moduleKey: 'finance', action: 'add' },
  reconcile_finance_payments: { moduleKey: 'finance', action: 'approve' },
  manage_bank_details: { moduleKey: 'finance', action: 'manage' },
  manage_finance_settings: { moduleKey: 'finance', action: 'manage' },
  view_finance_reports: { moduleKey: 'reports', action: 'view' },
  approve_expense: { moduleKey: 'expense_history', action: 'approve' },
}

export function canPerformAction(
  role: OrganizationRole,
  action: FleetAction,
  customPermissions?: StaffPermissionMatrix | null,
): boolean {
  if (role === 'platform_admin') return true
  if (role === 'org_admin') return ROLE_ACTIONS.org_admin.has(action)
  if (role === 'driver') return ROLE_ACTIONS.driver.has(action)
  if (customPermissions) {
    const mapped = ACTION_TO_MODULE_PERMISSION[action]
    if (!mapped) return false
    if (action === 'view_finance_unmasked' || action === 'manage_bank_details') {
      if (!customPermissions.sensitive.viewBankDetails) return false
    }
    return hasModulePermission(customPermissions, role, mapped.moduleKey, mapped.action)
  }
  return ROLE_ACTIONS[role]?.has(action) ?? false
}

export function assertRolePermission(
  role: OrganizationRole,
  action: FleetAction,
  customPermissions?: StaffPermissionMatrix | null,
): void {
  if (!canPerformAction(role, action, customPermissions)) {
    throw new Error(`Role "${role.replace(/_/g, ' ')}" is not authorized to perform "${action.replace(/_/g, ' ')}".`)
  }
}

export function getDefaultHomeForRole(role: OrganizationRole): string {
  if (role === 'platform_admin') return '/platform-admin'
  if (role === 'driver') return '/driver'
  if (role === 'maintenance') return '/dashboard/maintenance'
  if (role === 'finance') return '/dashboard/financials'
  return '/dashboard'
}

export function canAccessRoute(
  role: OrganizationRole,
  pathname: string,
  customPermissions?: StaffPermissionMatrix | null,
): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'

  if (clean.startsWith('/platform-admin')) {
    return role === 'platform_admin'
  }

  // Strictly isolated Driver Portal routes (/driver and /driver/*)
  if (clean === '/driver' || clean.startsWith('/driver/')) {
    return role === 'driver'
  }

  // Drivers cannot access owner/staff dashboard modules or platform admin routes
  if (role === 'driver') {
    if (clean.startsWith('/dashboard') || clean.startsWith('/onboarding')) {
      return false
    }
    return true
  }

  // Platform Integrations are strictly Platform Admin only (never Owner/Staff/Driver)
  if (clean === '/dashboard/integrations' || clean.startsWith('/dashboard/integrations/')) {
    return role === 'platform_admin'
  }

  if (clean === '/onboarding' || clean.startsWith('/onboarding/')) {
    return role === 'org_admin'
  }

  if (!clean.startsWith('/dashboard')) {
    return true
  }

  if (clean === '/dashboard/subscription' || clean.startsWith('/dashboard/subscription/')) {
    return role === 'platform_admin' || role === 'org_admin' || role === 'finance'
  }

  if (clean === '/dashboard/get-started' || clean === '/dashboard/support') {
    return role !== 'platform_admin'
  }

  // Custom granular staff / permission-matrix check takes immediate precedence when provided
  if (role === 'fleet_staff' || customPermissions) {
    const effective = customPermissions ?? getPresetMatrixForRole(role)
    const mapped = resolveModulePermissionForPath(clean)
    if (mapped) {
      return hasModulePermission(effective, role, mapped.moduleKey, mapped.action)
    }
  }

  if (clean === '/dashboard/staff' || clean.startsWith('/dashboard/staff/')) {
    return role === 'platform_admin' || role === 'org_admin'
  }

  // Admin & Billing workflow routes (checked before coarse prefix matches)
  if (clean === '/dashboard/admin' || clean.startsWith('/dashboard/admin/')) {
    return role === 'platform_admin' || role === 'org_admin'
  }

  if (clean === '/dashboard/settings' || clean.startsWith('/dashboard/settings/')) {
    return role === 'platform_admin' || role === 'org_admin' || role === 'fleet_manager'
  }

  if (clean === '/dashboard/contracts' || clean.startsWith('/dashboard/contracts/')) {
    if (clean === '/dashboard/contracts/register/new') {
      return role === 'org_admin' || role === 'fleet_manager'
    }
    if (clean === '/dashboard/contracts/partners/new' || /^\/dashboard\/contracts\/partners\/[^/]+\/edit$/.test(clean)) {
      return role === 'org_admin' || role === 'fleet_manager'
    }
    if (clean === '/dashboard/contracts/owners/new' || /^\/dashboard\/contracts\/owners\/[^/]+\/edit$/.test(clean)) {
      return role === 'org_admin' || role === 'fleet_manager'
    }
    if (clean === '/dashboard/contracts/payments/new') {
      return role === 'org_admin' || role === 'finance'
    }
    if (clean === '/dashboard/contracts/deposits/new') {
      return role === 'org_admin' || role === 'finance'
    }
    if (clean === '/dashboard/contracts/maintenance/new') {
      return role === 'org_admin' || role === 'fleet_manager' || role === 'maintenance'
    }
    if (clean === '/dashboard/contracts/vehicles/handover/new' || /^\/dashboard\/contracts\/vehicles\/return\/[^/]+$/.test(clean)) {
      return role === 'org_admin' || role === 'fleet_manager' || role === 'maintenance'
    }
    if (clean === '/dashboard/contracts/documents/upload') {
      return role === 'org_admin' || role === 'fleet_manager' || role === 'finance' || role === 'maintenance'
    }
    return (
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance' ||
      role === 'maintenance' ||
      role === 'viewer'
    )
  }

  if (clean === '/dashboard/finance/vehicles/new') {
    return canPerformAction(role, 'add_finance_records')
  }
  if (clean === '/dashboard/finance/payments/new' || /^\/dashboard\/finance\/emis\/[^/]+\/pay$/.test(clean)) {
    return canPerformAction(role, 'record_finance_payments')
  }
  if (/^\/dashboard\/finance\/payments\/[^/]+\/correct$/.test(clean)) {
    return canPerformAction(role, 'reconcile_finance_payments')
  }
  if (clean === '/dashboard/finance/banks/new' || /^\/dashboard\/finance\/banks\/[^/]+\/edit$/.test(clean)) {
    return canPerformAction(role, 'manage_bank_details')
  }
  if (clean === '/dashboard/finance/documents/upload') {
    return canPerformAction(role, 'edit_finance_records') || canPerformAction(role, 'add_finance_records')
  }

  if (clean === '/dashboard/financials/invoices/new' || /^\/dashboard\/financials\/invoices\/[^/]+\/pay$/.test(clean)) {
    return canPerformAction(role, 'manage_financials')
  }

  if (clean === '/dashboard/fleet/new') {
    return canPerformAction(role, 'add_vehicle')
  }
  if (/^\/dashboard\/fleet\/vehicles\/[^/]+\/edit$/.test(clean) || /^\/dashboard\/fleet\/[^/]+\/edit$/.test(clean)) {
    return canPerformAction(role, 'edit_vehicle')
  }
  if (clean === '/dashboard/fleet/assignments/new') {
    return canPerformAction(role, 'assign_driver')
  }
  if (clean === '/dashboard/fleet/meter-history/new') {
    return canPerformAction(role, 'edit_vehicle')
  }
  if (clean === '/dashboard/fleet/tire-readings/new' || /^\/dashboard\/fleet\/tire-readings\/[^/]+$/.test(clean)) {
    return canPerformAction(role, 'schedule_maintenance')
  }
  if (clean === '/dashboard/map/geofences/new') {
    return canPerformAction(role, 'update_telemetry')
  }
  if (clean === '/dashboard/drivers/new') {
    return canPerformAction(role, 'add_driver')
  }
  if (/^\/dashboard\/drivers\/[^/]+\/events\/[^/]+\/dispute$/.test(clean)) {
    return canPerformAction(role, 'dispute_driver_event') || canPerformAction(role, 'resolve_driver_dispute')
  }
  if (clean === '/dashboard/trips/new') {
    return canPerformAction(role, 'schedule_trip')
  }
  if (clean === '/dashboard/work-orders/new') {
    return canPerformAction(role, 'manage_work_orders')
  }
  if (
    clean === '/dashboard/maintenance/new' ||
    clean === '/dashboard/reminders/service/new' ||
    clean === '/dashboard/service/tasks/new' ||
    clean === '/dashboard/service/programs/new'
  ) {
    return canPerformAction(role, 'schedule_maintenance')
  }
  if (clean === '/dashboard/issues/new' || clean === '/dashboard/issues/recalls/new') {
    return canPerformAction(role, 'report_issue')
  }
  if (
    clean === '/dashboard/inspections/new' ||
    clean === '/dashboard/inspections/schedules/new' ||
    clean === '/dashboard/inspections/forms/new'
  ) {
    return canPerformAction(role, 'submit_inspection')
  }
  if (clean === '/dashboard/inventory/new' || clean === '/dashboard/inventory/purchase-orders/new') {
    return canPerformAction(role, 'manage_inventory')
  }
  if (clean === '/dashboard/workshops/new') {
    return canPerformAction(role, 'manage_workshops')
  }
  if (clean === '/dashboard/fuel/new' || clean === '/dashboard/fuel/charging/new') {
    return canPerformAction(role, 'log_fuel')
  }
  if (
    clean === '/dashboard/tools/new' ||
    clean === '/dashboard/warranties/new' ||
    clean === '/dashboard/custom-records/new'
  ) {
    return role === 'platform_admin' || role === 'org_admin' || role === 'fleet_manager' || role === 'maintenance'
  }

  if (clean === '/dashboard/financials') {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance' ||
      role === 'viewer'
    )
  }

  if (clean === '/dashboard/finance' || clean.startsWith('/dashboard/finance/')) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance' ||
      role === 'viewer'
    )
  }

  if (
    clean === '/dashboard/maintenance' ||
    clean === '/dashboard/work-orders' ||
    clean.startsWith('/dashboard/inspections') ||
    clean.startsWith('/dashboard/inventory') ||
    clean === '/dashboard/workshops' ||
    clean.startsWith('/dashboard/tools') ||
    clean.startsWith('/dashboard/issues') ||
    clean.startsWith('/dashboard/reminders') ||
    clean.startsWith('/dashboard/service')
  ) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'maintenance' ||
      role === 'viewer'
    )
  }

  if (clean === '/dashboard/fuel' || clean.startsWith('/dashboard/fuel/')) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance' ||
      role === 'viewer'
    )
  }

  if (
    clean === '/dashboard/fleet/expenses' ||
    clean === '/dashboard/fleet/replacement-analysis'
  ) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance' ||
      role === 'viewer'
    )
  }

  if (
    clean.startsWith('/dashboard/drivers') ||
    clean.startsWith('/dashboard/fleet/drivers') ||
    clean === '/dashboard/trips' ||
    clean === '/dashboard/map' ||
    clean === '/dashboard/documents' ||
    clean === '/dashboard/warranties' ||
    clean === '/dashboard/custom-records'
  ) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'maintenance' ||
      role === 'viewer'
    )
  }

  return true
}

