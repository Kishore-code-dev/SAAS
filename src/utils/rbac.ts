import type { OrganizationRole } from '../types/fleet'

export type FleetAction =
  | 'create_organization'
  | 'manage_members'
  | 'add_vehicle'
  | 'edit_vehicle'
  | 'decommission_vehicle'
  | 'restore_vehicle'
  | 'assign_driver'
  | 'add_driver'
  | 'approve_driver'
  | 'dispute_driver_event'
  | 'resolve_driver_dispute'
  | 'schedule_trip'
  | 'start_own_trip'
  | 'end_trip'
  | 'log_fuel'
  | 'verify_fuel'
  | 'schedule_maintenance'
  | 'complete_maintenance'
  | 'resolve_prediction'
  | 'submit_inspection'
  | 'report_issue'
  | 'acknowledge_alert'
  | 'manage_subscription'
  | 'update_org_settings'
  | 'update_global_settings'
  | 'update_telemetry'
  | 'export_reports'
  | 'use_copilot'

const ROLE_ACTIONS: Record<OrganizationRole, Set<FleetAction>> = {
  platform_admin: new Set<FleetAction>([
    'create_organization',
    'manage_members',
    'add_vehicle',
    'edit_vehicle',
    'decommission_vehicle',
    'restore_vehicle',
    'assign_driver',
    'add_driver',
    'approve_driver',
    'dispute_driver_event',
    'resolve_driver_dispute',
    'schedule_trip',
    'start_own_trip',
    'end_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'manage_subscription',
    'update_org_settings',
    'update_global_settings',
    'update_telemetry',
    'export_reports',
    'use_copilot',
  ]),
  org_admin: new Set<FleetAction>([
    'manage_members',
    'add_vehicle',
    'edit_vehicle',
    'decommission_vehicle',
    'restore_vehicle',
    'assign_driver',
    'add_driver',
    'approve_driver',
    'dispute_driver_event',
    'resolve_driver_dispute',
    'schedule_trip',
    'start_own_trip',
    'end_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'manage_subscription',
    'update_org_settings',
    'update_telemetry',
    'export_reports',
    'use_copilot',
  ]),
  fleet_manager: new Set<FleetAction>([
    'add_vehicle',
    'edit_vehicle',
    'decommission_vehicle',
    'restore_vehicle',
    'assign_driver',
    'add_driver',
    'approve_driver',
    'dispute_driver_event',
    'resolve_driver_dispute',
    'schedule_trip',
    'start_own_trip',
    'end_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'submit_inspection',
    'report_issue',
    'acknowledge_alert',
    'update_org_settings',
    'update_telemetry',
    'export_reports',
    'use_copilot',
  ]),
  maintenance: new Set<FleetAction>([
    'schedule_maintenance',
    'complete_maintenance',
    'resolve_prediction',
    'submit_inspection',
    'acknowledge_alert',
    'export_reports',
    'use_copilot',
  ]),
  finance: new Set<FleetAction>([
    'log_fuel',
    'verify_fuel',
    'manage_subscription',
    'export_reports',
    'use_copilot',
  ]),
  driver: new Set<FleetAction>([
    'start_own_trip',
    'end_trip',
    'log_fuel',
    'submit_inspection',
    'report_issue',
    'dispute_driver_event',
    'update_telemetry',
  ]),
}

export function canPerformAction(role: OrganizationRole, action: FleetAction): boolean {
  return ROLE_ACTIONS[role]?.has(action) ?? false
}

export function assertRolePermission(role: OrganizationRole, action: FleetAction): void {
  if (!canPerformAction(role, action)) {
    throw new Error(`Role "${role.replace('_', ' ')}" is not authorized to perform "${action.replace(/_/g, ' ')}".`)
  }
}

export function getDefaultHomeForRole(role: OrganizationRole): string {
  return role === 'driver' ? '/driver' : '/dashboard'
}

export function canAccessRoute(role: OrganizationRole, pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'

  if (clean.startsWith('/driver')) {
    return (
      role === 'driver' ||
      role === 'fleet_manager' ||
      role === 'org_admin' ||
      role === 'platform_admin'
    )
  }

  if (!clean.startsWith('/dashboard')) {
    return true
  }

  if (role === 'driver') {
    return false
  }

  if (clean === '/dashboard/admin') {
    return role === 'platform_admin' || role === 'org_admin'
  }

  if (clean === '/dashboard/subscription') {
    return role === 'platform_admin' || role === 'org_admin' || role === 'finance'
  }

  if (clean === '/dashboard/settings') {
    return role === 'platform_admin' || role === 'org_admin' || role === 'fleet_manager'
  }

  if (clean === '/dashboard/financials') {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance'
    )
  }

  if (clean === '/dashboard/maintenance') {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'maintenance'
    )
  }

  if (clean === '/dashboard/fuel') {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'finance'
    )
  }

  if (clean === '/dashboard/drivers' || clean === '/dashboard/trips' || clean === '/dashboard/map') {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'maintenance'
    )
  }

  return true
}
