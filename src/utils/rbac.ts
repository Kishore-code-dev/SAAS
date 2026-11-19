import type { OrganizationRole } from '../types/fleet'

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
  ]),
  viewer: new Set<FleetAction>([
    'export_reports',
    'use_copilot',
    'view_finance',
    'view_finance_reports',
  ]),
}

export function canPerformAction(role: OrganizationRole, action: FleetAction): boolean {
  return ROLE_ACTIONS[role]?.has(action) ?? false
}

export function assertRolePermission(role: OrganizationRole, action: FleetAction): void {
  if (!canPerformAction(role, action)) {
    throw new Error(`Role "${role.replace(/_/g, ' ')}" is not authorized to perform "${action.replace(/_/g, ' ')}".`)
  }
}

export function getDefaultHomeForRole(role: OrganizationRole): string {
  if (role === 'platform_admin') return '/platform-admin'
  if (role === 'maintenance') return '/dashboard/maintenance'
  if (role === 'finance') return '/dashboard/financials'
  return '/dashboard'
}

export function canAccessRoute(role: OrganizationRole, pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'

  if (clean.startsWith('/platform-admin')) {
    return role === 'platform_admin'
  }

  // Driver mobile companion app is permanently removed from the owner-only platform
  if (clean.startsWith('/driver')) {
    return false
  }

  if (!clean.startsWith('/dashboard')) {
    return true
  }

  // Admin & Billing workflow routes (checked before coarse prefix matches)
  if (clean === '/dashboard/admin' || clean.startsWith('/dashboard/admin/')) {
    return role === 'platform_admin' || role === 'org_admin'
  }

  if (clean === '/dashboard/subscription' || clean.startsWith('/dashboard/subscription/')) {
    return role === 'platform_admin' || role === 'org_admin' || role === 'finance'
  }

  if (clean === '/dashboard/settings' || clean.startsWith('/dashboard/settings/')) {
    return role === 'platform_admin' || role === 'org_admin' || role === 'fleet_manager'
  }

  // Specific Finance write routes must check fine-grained action permissions BEFORE '/dashboard/finance/'
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

  // Specific Fleet & Operations mutation routes BEFORE coarse prefix checks
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

  if (clean === '/dashboard/integrations') {
    return role === 'platform_admin' || role === 'org_admin' || role === 'fleet_manager' || role === 'viewer'
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
