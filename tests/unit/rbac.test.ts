import { describe, expect, it } from 'vitest'
import type { OrganizationRole } from '../../src/types/fleet'
import {
  assertRolePermission,
  canAccessRoute,
  canPerformAction,
  getDefaultHomeForRole,
  type FleetAction,
} from '../../src/utils/rbac'

const ALL_ROLES: OrganizationRole[] = [
  'platform_admin',
  'org_admin',
  'fleet_manager',
  'maintenance',
  'finance',
  'driver',
]

describe('RBAC permission & route matrix', () => {
  it('routes drivers to /driver and management roles to /dashboard', () => {
    expect(getDefaultHomeForRole('driver')).toBe('/driver')
    for (const role of ALL_ROLES.filter((r) => r !== 'driver')) {
      expect(getDefaultHomeForRole(role)).toBe('/dashboard')
    }
  })

  it('denies driver role access to all /dashboard enterprise routes', () => {
    const restrictedRoutes = [
      '/dashboard',
      '/dashboard/map',
      '/dashboard/trips',
      '/dashboard/fleet',
      '/dashboard/maintenance',
      '/dashboard/drivers',
      '/dashboard/fuel',
      '/dashboard/financials',
      '/dashboard/admin',
      '/dashboard/subscription',
      '/dashboard/settings',
    ]
    for (const route of restrictedRoutes) {
      expect(canAccessRoute('driver', route)).toBe(false)
    }
    expect(canAccessRoute('driver', '/driver')).toBe(true)
    expect(canAccessRoute('driver', '/driver/trips')).toBe(true)
    expect(canAccessRoute('driver', '/driver/fuel')).toBe(true)
  })

  it('enforces strict role separation across finance, maintenance, fleet_manager, and admins', () => {
    // Finance: allowed financials, fuel, subscription; denied maintenance, admin, drivers, settings
    expect(canAccessRoute('finance', '/dashboard/financials')).toBe(true)
    expect(canAccessRoute('finance', '/dashboard/fuel')).toBe(true)
    expect(canAccessRoute('finance', '/dashboard/subscription')).toBe(true)
    expect(canAccessRoute('finance', '/dashboard/maintenance')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/drivers')).toBe(false)
    expect(canAccessRoute('finance', '/dashboard/settings')).toBe(false)

    // Maintenance: allowed maintenance, drivers, trips, map; denied financials, fuel, subscription, admin, settings
    expect(canAccessRoute('maintenance', '/dashboard/maintenance')).toBe(true)
    expect(canAccessRoute('maintenance', '/dashboard/financials')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/fuel')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/subscription')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('maintenance', '/dashboard/settings')).toBe(false)

    // Fleet Manager: allowed operational routes & settings; denied admin & subscription
    expect(canAccessRoute('fleet_manager', '/dashboard/fleet')).toBe(true)
    expect(canAccessRoute('fleet_manager', '/dashboard/settings')).toBe(true)
    expect(canAccessRoute('fleet_manager', '/dashboard/admin')).toBe(false)
    expect(canAccessRoute('fleet_manager', '/dashboard/subscription')).toBe(false)

    // Org Admin & Platform Admin: allowed admin, subscription, settings
    expect(canAccessRoute('org_admin', '/dashboard/admin')).toBe(true)
    expect(canAccessRoute('platform_admin', '/dashboard/admin')).toBe(true)
    expect(canAccessRoute('org_admin', '/dashboard/subscription')).toBe(true)
  })

  it('enforces action-level permissions and throws clear errors via assertRolePermission', () => {
    const fleetManagerDenied: FleetAction[] = [
      'create_organization',
      'manage_members',
      'manage_subscription',
      'update_global_settings',
    ]
    for (const action of fleetManagerDenied) {
      expect(canPerformAction('fleet_manager', action)).toBe(false)
      expect(() => assertRolePermission('fleet_manager', action)).toThrow(/not authorized/i)
    }

    expect(canPerformAction('maintenance', 'schedule_maintenance')).toBe(true)
    expect(canPerformAction('maintenance', 'verify_fuel')).toBe(false)

    expect(canPerformAction('finance', 'verify_fuel')).toBe(true)
    expect(canPerformAction('finance', 'schedule_maintenance')).toBe(false)

    expect(canPerformAction('driver', 'start_own_trip')).toBe(true)
    expect(canPerformAction('driver', 'log_fuel')).toBe(true)
    expect(canPerformAction('driver', 'use_copilot')).toBe(false)
    expect(canPerformAction('driver', 'decommission_vehicle')).toBe(false)
  })
})
