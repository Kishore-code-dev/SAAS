import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_STAFF_PERMISSION_MATRIX,
  PERMISSION_MODULES,
  buildOwnerPermissionMatrix,
  buildPlatformAdminMatrix,
  hasModulePermission,
  maskAccountNumber,
  normalizeStaffPermissions,
  resolveModulePermissionForPath,
} from './staffPermissions.ts'
import { canAccessRoute, canPerformAction, getDefaultHomeForRole } from './rbac.ts'

describe('Canonical 31-Module Staff RBAC Engine', () => {
  it('defines all 31 canonical modules with integrations marked platformAdminOnly', () => {
    assert.equal(PERMISSION_MODULES.length, 31)
    const integrations = PERMISSION_MODULES.find((m) => m.key === 'integrations')
    assert.ok(integrations)
    assert.equal(integrations.platformAdminOnly, true)
  })

  it('grants exact Part 3.2 default modules to Fleet Staff and denies the other 16', () => {
    const allowedByDefault = [
      { key: 'dashboard', action: 'view' },
      { key: 'live_monitoring', action: 'view' },
      { key: 'vehicles', action: 'add' },
      { key: 'vehicles', action: 'edit' },
      { key: 'drivers', action: 'add' },
      { key: 'drivers', action: 'edit' },
      { key: 'trips', action: 'add' },
      { key: 'trips', action: 'edit' },
      { key: 'assignments', action: 'add' },
      { key: 'meter_history', action: 'add' },
      { key: 'tools_equipment', action: 'manage' },
      { key: 'issues', action: 'edit' },
      { key: 'maintenance', action: 'manage' },
      { key: 'work_orders', action: 'manage' },
      { key: 'fuel_history', action: 'view' },
      { key: 'charging_history', action: 'view' },
      { key: 'places', action: 'view' },
      { key: 'custom_records', action: 'manage' },
    ] as const

    for (const check of allowedByDefault) {
      assert.equal(
        hasModulePermission(DEFAULT_STAFF_PERMISSION_MATRIX, 'fleet_staff', check.key, check.action),
        true,
        `Expected fleet_staff default to allow ${check.key}:${check.action}`,
      )
    }

    const deniedByDefault = [
      'staff',
      'tyre_readings',
      'expense_history',
      'replacement_analysis',
      'inspections',
      'reminders',
      'contacts',
      'vendors',
      'parts_inventory',
      'documents',
      'warranties',
      'vehicle_contracts',
      'finance',
      'reports',
      'settings',
      'integrations',
    ] as const

    for (const modKey of deniedByDefault) {
      assert.equal(
        hasModulePermission(DEFAULT_STAFF_PERMISSION_MATRIX, 'fleet_staff', modKey, 'view'),
        false,
        `Expected fleet_staff default to DENY ${modKey}`,
      )
    }

    // Also verify default staff cannot delete vehicles or approve fuel history
    assert.equal(hasModulePermission(DEFAULT_STAFF_PERMISSION_MATRIX, 'fleet_staff', 'vehicles', 'delete'), false)
    assert.equal(hasModulePermission(DEFAULT_STAFF_PERMISSION_MATRIX, 'fleet_staff', 'fuel_history', 'add'), false)
  })

  it('denies integrations to Owners and Staff under all overrides, allowing only platform_admin', () => {
    const ownerMatrix = buildOwnerPermissionMatrix()
    assert.equal(hasModulePermission(ownerMatrix, 'org_admin', 'integrations', 'view'), false)
    assert.equal(canAccessRoute('org_admin', '/dashboard/integrations', ownerMatrix), false)
    assert.equal(canAccessRoute('fleet_staff', '/dashboard/integrations', ownerMatrix), false)
    assert.equal(canAccessRoute('driver', '/dashboard/integrations'), false)

    const hackedMatrix = normalizeStaffPermissions({
      modules: {
        integrations: { view: true, add: true, edit: true, delete: true, approve: true, export: true, manage: true },
        reports: { view: true, export: true },
      },
      sensitive: { viewBankDetails: true },
    })
    assert.equal(hackedMatrix.modules.integrations.view, false)
    assert.equal(hasModulePermission(hackedMatrix, 'fleet_staff', 'integrations', 'view'), false)
    assert.equal(hasModulePermission(hackedMatrix, 'fleet_staff', 'reports', 'export'), true)
    assert.equal(hackedMatrix.sensitive.viewBankDetails, true)

    const adminMatrix = buildPlatformAdminMatrix()
    assert.equal(hasModulePermission(adminMatrix, 'platform_admin', 'integrations', 'manage'), true)
    assert.equal(canAccessRoute('platform_admin', '/dashboard/integrations', adminMatrix), true)
  })

  it('reflects permission updates immediately without caching or redeploy', () => {
    const custom = normalizeStaffPermissions(DEFAULT_STAFF_PERMISSION_MATRIX)
    assert.equal(canAccessRoute('fleet_staff', '/dashboard/finance', custom), false)
    custom.modules.finance.view = true
    assert.equal(canAccessRoute('fleet_staff', '/dashboard/finance', custom), true)
    custom.modules.finance.view = false
    assert.equal(canAccessRoute('fleet_staff', '/dashboard/finance', custom), false)
  })

  it('strictly isolates driver portal routes and blocks non-drivers / tenant routes', () => {
    assert.equal(getDefaultHomeForRole('driver'), '/driver')
    assert.equal(canAccessRoute('driver', '/driver'), true)
    assert.equal(canAccessRoute('driver', '/driver/trips'), true)
    assert.equal(canAccessRoute('driver', '/driver/expenses'), true)

    // Drivers cannot access owner/staff/platform routes
    assert.equal(canAccessRoute('driver', '/dashboard'), false)
    assert.equal(canAccessRoute('driver', '/dashboard/vehicles'), false)
    assert.equal(canAccessRoute('driver', '/dashboard/finance'), false)
    assert.equal(canAccessRoute('driver', '/dashboard/staff'), false)
    assert.equal(canAccessRoute('driver', '/dashboard/settings'), false)
    assert.equal(canAccessRoute('driver', '/platform-admin'), false)
    assert.equal(canPerformAction('driver', 'add_vehicle'), false)

    // Non-drivers cannot open /driver portal routes
    assert.equal(canAccessRoute('fleet_staff', '/driver'), false)
    assert.equal(canAccessRoute('org_admin', '/driver'), false)
  })

  it('resolves routes and masks bank account numbers when unprivileged', () => {
    assert.deepEqual(resolveModulePermissionForPath('/dashboard/staff'), { moduleKey: 'staff', action: 'view' })
    assert.deepEqual(resolveModulePermissionForPath('/dashboard/integrations'), { moduleKey: 'integrations', action: 'view' })
    assert.deepEqual(resolveModulePermissionForPath('/dashboard/contracts/new'), { moduleKey: 'vehicle_contracts', action: 'add' })
    assert.equal(maskAccountNumber('321004981122', false), '••••••••1122')
    assert.equal(maskAccountNumber('321004981122', true), '321004981122')
  })
})
