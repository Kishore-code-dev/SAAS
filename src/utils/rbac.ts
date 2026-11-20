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
  fleet_staff: new Set<FleetAction>([
    'add_vehicle',
    'edit_vehicle',
    'assign_driver',
    'add_driver',
    'manage_driver_status',
    'verify_documents',
    'schedule_trip',
    'log_fuel',
    'verify_fuel',
    'schedule_maintenance',
    'complete_maintenance',
    'manage_work_orders',
    'manage_inventory',
    'report_issue',
    'acknowledge_alert',
    'update_telemetry',
    'view_finance',
    'add_finance_records',
    'record_finance_payments',
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
  driver: new Set<FleetAction>([
    'end_trip',
    'log_fuel',
    'report_issue',
    'acknowledge_alert',
  ]),
}

export type ContractAction =
  | 'view_contracts'
  | 'create_contracts'
  | 'edit_contracts'
  | 'submit_contracts'
  | 'approve_contracts'
  | 'terminate_contracts'
  | 'renew_contracts'
  | 'create_amendments'
  | 'approve_amendments'
  | 'manage_suppliers'
  | 'manage_individual_owners'
  | 'manage_contract_vehicles'
  | 'manage_contract_payments'
  | 'approve_contract_payments'
  | 'manage_security_deposits'
  | 'approve_deposit_refunds'
  | 'manage_contract_maintenance'
  | 'approve_contract_maintenance'
  | 'manage_contract_documents'
  | 'view_contract_financial_reports'
  | 'record_handovers'

const ALL_CONTRACT_ACTIONS: ContractAction[] = [
  'view_contracts', 'create_contracts', 'edit_contracts', 'submit_contracts', 'approve_contracts',
  'terminate_contracts', 'renew_contracts', 'create_amendments', 'approve_amendments',
  'manage_suppliers', 'manage_individual_owners', 'manage_contract_vehicles',
  'manage_contract_payments', 'approve_contract_payments', 'manage_security_deposits',
  'approve_deposit_refunds', 'manage_contract_maintenance', 'approve_contract_maintenance',
  'manage_contract_documents', 'view_contract_financial_reports', 'record_handovers',
]

const CONTRACT_ROLE_ACTIONS: Record<OrganizationRole, Set<ContractAction>> = {
  platform_admin: new Set<ContractAction>(['view_contracts', 'view_contract_financial_reports']),
  org_admin: new Set<ContractAction>(ALL_CONTRACT_ACTIONS),
  fleet_staff: new Set<ContractAction>([
    'view_contracts', 'create_contracts', 'edit_contracts', 'submit_contracts', 'renew_contracts',
    'create_amendments', 'manage_suppliers', 'manage_individual_owners', 'manage_contract_vehicles',
    'manage_contract_payments', 'manage_contract_documents', 'manage_contract_maintenance',
    'view_contract_financial_reports', 'record_handovers',
  ]),
  fleet_manager: new Set<ContractAction>([
    'view_contracts', 'create_contracts', 'edit_contracts', 'submit_contracts', 'renew_contracts',
    'create_amendments', 'manage_suppliers', 'manage_individual_owners', 'manage_contract_vehicles',
    'manage_contract_payments', 'manage_contract_documents', 'manage_contract_maintenance',
    'view_contract_financial_reports', 'record_handovers',
  ]),
  maintenance: new Set<ContractAction>([
    'view_contracts', 'manage_contract_maintenance', 'manage_contract_documents', 'record_handovers',
  ]),
  finance: new Set<ContractAction>([
    'view_contracts', 'manage_contract_payments', 'approve_contract_payments',
    'manage_security_deposits', 'approve_deposit_refunds', 'view_contract_financial_reports',
  ]),
  viewer: new Set<ContractAction>(['view_contracts', 'view_contract_financial_reports']),
  driver: new Set<ContractAction>(['view_contracts']),
}

export function canPerformContractAction(role: OrganizationRole, action: ContractAction): boolean {
  return CONTRACT_ROLE_ACTIONS[role]?.has(action) ?? false
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
  if (role === 'driver') return '/driver'
  return '/dashboard'
}

export function canAccessRoute(role: OrganizationRole, pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'

  if (clean.startsWith('/platform-admin')) {
    return role === 'platform_admin'
  }

  // Driver mobile routes
  if (clean.startsWith('/driver')) {
    return role === 'driver'
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

  if (clean === '/dashboard/contracts' || clean.startsWith('/dashboard/contracts/')) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'maintenance' ||
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
      role === 'fleet_staff' ||
      role === 'maintenance' ||
      role === 'viewer'
    )
  }

  if (clean === '/dashboard/fuel' || clean.startsWith('/dashboard/fuel/')) {
    return (
      role === 'platform_admin' ||
      role === 'org_admin' ||
      role === 'fleet_manager' ||
      role === 'fleet_staff' ||
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
    return role === 'platform_admin'
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
      role === 'fleet_staff' ||
      role === 'maintenance' ||
      role === 'viewer'
    )
  }

  return true
}
