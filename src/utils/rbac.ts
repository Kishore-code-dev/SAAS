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

  if (clean === '/dashboard/admin') {
    return role === 'platform_admin' || role === 'org_admin'
  }

  if (clean === '/dashboard/subscription') {
    return role === 'platform_admin' || role === 'org_admin' || role === 'finance'
  }

  if (clean === '/dashboard/settings' || clean.startsWith('/dashboard/settings/')) {
    return role === 'platform_admin' || role === 'org_admin' || role === 'fleet_manager'
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
