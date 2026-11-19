import { describe, expect, it } from 'vitest'
import type { OrganizationRole } from '../../src/types/fleet'
import {
  assertRolePermission,
  canAccessRoute,
  canPerformAction,
  getDefaultHomeForRole,
  type FleetAction,
} from '../../src/utils/rbac'

const ALL_OWNER_ROLES: OrganizationRole[] = [
  'platform_admin',
  'org_admin',
  'fleet_manager',
  'maintenance',
  'finance',
  'viewer',
]

describe('Owner-only RBAC permission & route matrix', () => {
  it('routes platform_admin to /platform-admin and organization roles to their authorized home pages', () => {
    expect(getDefaultHomeForRole('platform_admin')).toBe('/platform-admin')
    expect(getDefaultHomeForRole('org_admin')).toBe('/dashboard')
    expect(getDefaultHomeForRole('fleet_manager')).toBe('/dashboard')
    expect(getDefaultHomeForRole('viewer')).toBe('/dashboard')
    expect(getDefaultHomeForRole('maintenance')).toBe('/dashboard/maintenance')
    expect(getDefaultHomeForRole('finance')).toBe('/dashboard/financials')
  })

  it('denies deprecated /driver routes across all owner-only roles and restricts viewer to read-only analytics', () => {
    for (const role of ALL_OWNER_ROLES) {
      expect(canAccessRoute(role, '/driver')).toBe(false)
      expect(canAccessRoute(role, '/driver/trips')).toBe(false)
    }

    expect(canAccessRoute('viewer', '/dashboard')).toBe(true)
    expect(canAccessRoute('viewer', '/dashboard/reports')).toBe(true)
    expect(canAccessRoute('viewer', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('viewer', '/dashboard/subscription')).toBe(false)
    expect(canAccessRoute('viewer', '/platform-admin')).toBe(false)
  })

  it('enforces strict role separation across finance, maintenance, fleet_manager, and admins', () => {
    // Finance: allowed financials, fuel, subscription; denied maintenance, admin, drivers, settings
    expect(canAccessRoute('finance', '/dashboard/financials')).toBe(true)
    expect(canAccessRoute('finance', '/dashboard/fuel')).toBe(true)
    expect(canAccessRoute('finance', '/dashboard/subscription')).toBe(true)
    expect(canAccessRoute('finance', '/dashboard/maintenance')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/work-orders')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/drivers')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/settings')).toBe(false)

    // Maintenance: allowed maintenance, inspections, work-orders, inventory, workshops; denied financials, fuel, admin
    expect(canAccessRoute('maintenance', '/dashboard/maintenance')).toBe(true)
    expect(canAccessRoute('maintenance', '/dashboard/inspections')).toBe(true)
    expect(canAccessRoute('maintenance', '/dashboard/work-orders')).toBe(true)
    expect(canAccessRoute('maintenance', '/dashboard/inventory')).toBe(true)
    expect(canAccessRoute('maintenance', '/dashboard/workshops')).toBe(true)
    expect(canAccessRoute('maintenance', '/dashboard/financials')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/fuel')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/subscription')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/settings')).toBe(false)

    // Fleet Manager: allowed operational routes & settings; denied admin, subscription & platform-admin
    expect(canAccessRoute('fleet_manager', '/dashboard/fleet')).toBe(true)
    expect(canAccessRoute('fleet_manager', '/dashboard/inspections')).toBe(true)
    expect(canAccessRoute('fleet_manager', '/dashboard/settings')).toBe(true)
    expect(canAccessRoute('fleet_manager', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('fleet_manager', '/dashboard/subscription')).toBe(false)
    expect(canAccessRoute('fleet_manager', '/platform-admin')).toBe(false)

    // Org Admin & Platform Admin: allowed admin, subscription, settings; only platform_admin allowed /platform-admin
    expect(canAccessRoute('org_admin', '/dashboard/admin')).toBe(true)
    expect(canAccessRoute('org_admin', '/dashboard/subscription')).toBe(true)
    expect(canAccessRoute('org_admin', '/platform-admin')).toBe(false)
    expect(canAccessRoute('platform_admin', '/dashboard/admin')).toBe(true)
    expect(canAccessRoute('platform_admin', '/platform-admin')).toBe(true)
  })

  it('enforces action-level permissions and throws clear errors via assertRolePermission', () => {
    const fleetManagerDenied: FleetAction[] = [
      'create_organization',
      'manage_members',
      'manage_subscription',
      'update_global_settings',
      'manage_platform_orgs',
    ]
    for (const action of fleetManagerDenied) {
      expect(canPerformAction('fleet_manager', action)).toBe(false)
      expect(() => assertRolePermission('fleet_manager', action)).toThrow(/not authorized/i)
    }

    expect(canPerformAction('maintenance', 'schedule_maintenance')).toBe(true)
    expect(canPerformAction('maintenance', 'manage_work_orders')).toBe(true)
    expect(canPerformAction('maintenance', 'verify_fuel')).toBe(false)

    expect(canPerformAction('finance', 'verify_fuel')).toBe(true)
    expect(canPerformAction('finance', 'manage_financials')).toBe(true)
    expect(canPerformAction('finance', 'schedule_maintenance')).toBe(false)

    expect(canPerformAction('viewer', 'export_reports')).toBe(true)
    expect(canPerformAction('viewer', 'use_copilot')).toBe(true)
    expect(canPerformAction('viewer', 'decommission_vehicle')).toBe(false)
    expect(canPerformAction('viewer', 'manage_work_orders')).toBe(false)
  })

  it('strictly separates org_admin from platform_admin super-governance actions', () => {
    expect(canPerformAction('org_admin', 'manage_members')).toBe(true)
    expect(canPerformAction('org_admin', 'verify_documents')).toBe(true)
    expect(canPerformAction('org_admin', 'create_organization')).toBe(false)
    expect(canPerformAction('org_admin', 'manage_platform_orgs')).toBe(false)
    expect(canPerformAction('org_admin', 'update_global_settings')).toBe(false)
    expect(() => assertRolePermission('org_admin', 'create_organization')).toThrow(/not authorized/i)
    expect(() => assertRolePermission('org_admin', 'update_global_settings')).toThrow(/not authorized/i)

    expect(canPerformAction('platform_admin', 'create_organization')).toBe(true)
    expect(canPerformAction('platform_admin', 'manage_platform_orgs')).toBe(true)
    expect(canPerformAction('platform_admin', 'update_global_settings')).toBe(true)
    expect(canPerformAction('finance', 'update_telemetry')).toBe(false)
    expect(canPerformAction('maintenance', 'update_telemetry')).toBe(false)
  })
})
