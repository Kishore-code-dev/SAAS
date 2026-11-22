import crypto from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import { canPerformAction, type FleetAction } from '../src/utils/rbac.ts'
import {
  buildOwnerPermissionMatrix,
  buildPlatformAdminMatrix,
  getPresetMatrixForRole,
  hasModulePermission,
  makeAllDeniedMatrix,
  normalizeStaffPermissions,
} from '../src/utils/staffPermissions.ts'
import type {
  CanonicalSubscriptionStatus,
  Organization,
  PermissionAction,
  PermissionModuleKey,
  StaffPermissionMatrix,
  SubscriptionRecord,
} from '../src/types/fleet.ts'
import { getDb, mapOrgRow, mapUserRow, type DbUserRow } from './db.ts'
import { hashToken, isOrganizationLoginAllowed, parseCookies, SESSION_COOKIE_NAME } from './authLogic.ts'
import { evaluateSubscriptionState } from './subscriptionEngine.ts'

export interface AuthenticatedRequest extends Request {
  authUser?: DbUserRow
  authSessionId?: string
  activeOrg?: Organization | null
  authPermissions?: StaffPermissionMatrix
  activeSubscription?: SubscriptionRecord | null
  subscriptionAccess?: 'full' | 'read_only' | 'blocked' | 'onboarding_only'
}

export function loadUserPermissionMatrix(user: DbUserRow): StaffPermissionMatrix {
  if (user.role === 'platform_admin') {
    return buildPlatformAdminMatrix()
  }
  if (user.role === 'org_admin') {
    return buildOwnerPermissionMatrix()
  }
  if (user.role === 'driver') {
    return makeAllDeniedMatrix()
  }
  const db = getDb()
  const row = db
    .prepare('SELECT permissions_json FROM user_permissions WHERE user_id = ?')
    .get(user.id) as { permissions_json?: string } | undefined

  if (row?.permissions_json) {
    try {
      return normalizeStaffPermissions(JSON.parse(row.permissions_json))
    } catch {
      return getPresetMatrixForRole(user.role)
    }
  }
  return getPresetMatrixForRole(user.role)
}

export function loadOrgSubscription(orgId: string, org: Organization | null): {
  subscription: SubscriptionRecord | null
  operationalAccess: 'full' | 'read_only' | 'blocked' | 'onboarding_only'
} {
  const db = getDb()
  const row = db
    .prepare('SELECT * FROM subscriptions WHERE organization_id = ?')
    .get(orgId) as Record<string, unknown> | undefined

  if (!row) {
    if (!org) {
      return { subscription: null, operationalAccess: 'onboarding_only' }
    }
    const status: CanonicalSubscriptionStatus =
      org.status === 'payment_pending' || org.paymentStatus === 'pending'
        ? 'pending_payment'
        : org.status === 'suspended'
          ? 'suspended'
          : 'active'
    const evaluated = evaluateSubscriptionState({
      status,
      currentPeriodEnd: org.subscriptionExpiryDate || null,
      gracePeriodDays: org.gracePeriodDays ?? 0,
      expiredAccessPolicy: org.expiredAccessPolicy ?? 'read_only',
    })
    return { subscription: null, operationalAccess: evaluated.operationalAccess }
  }

  const rawStatus = String(row.status) as CanonicalSubscriptionStatus
  const currentPeriodEnd = row.current_period_end ? String(row.current_period_end) : null
  const gracePeriodDays = Number(row.grace_period_days ?? 0)
  const expiredAccessPolicy =
    String(row.expired_access_policy || 'read_only') === 'blocked' ? 'blocked' : 'read_only'

  const evaluated = evaluateSubscriptionState({
    status: rawStatus,
    currentPeriodEnd,
    gracePeriodDays,
    expiredAccessPolicy,
  })

  const subscription: SubscriptionRecord = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    planId: String(row.plan_id) === 'annual' ? 'annual' : 'monthly',
    billingFrequency: String(row.billing_frequency) === 'annual' ? 'annual' : 'monthly',
    status: evaluated.effectiveStatus,
    baseAmountInr: Number(row.base_amount_inr),
    taxAmountInr: Number(row.tax_amount_inr),
    totalAmountInr: Number(row.total_amount_inr),
    currency: 'INR',
    startedAt: String(row.started_at),
    currentPeriodStart: row.current_period_start ? String(row.current_period_start) : null,
    currentPeriodEnd,
    gracePeriodDays,
    expiredAccessPolicy,
    cancelAtPeriodEnd: Number(row.cancel_at_period_end) === 1,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    autoRenew: Number(row.auto_renew) === 1,
    daysRemaining: evaluated.daysRemaining,
    operationalAccess: evaluated.operationalAccess,
    updatedAt: String(row.updated_at),
  }

  return { subscription, operationalAccess: evaluated.operationalAccess }
}

export function attachSession(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const cookies = parseCookies(req.headers.cookie)
    const authHeader = req.headers.authorization
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : undefined
    const rawToken = cookies[SESSION_COOKIE_NAME] || bearerToken
    if (!rawToken) {
      next()
      return
    }
    const tokenHash = hashToken(rawToken)
    const db = getDb()
    const sess = db
      .prepare('SELECT id, user_id, organization_id, revoked, expires_at FROM auth_sessions WHERE token_hash = ?')
      .get(tokenHash) as Record<string, unknown> | undefined

    if (!sess || Number(sess.revoked) === 1) {
      next()
      return
    }
    const expMs = new Date(String(sess.expires_at)).getTime()
    if (!Number.isFinite(expMs) || expMs <= Date.now()) {
      next()
      return
    }

    const userRow = db
      .prepare('SELECT * FROM users WHERE id = ?')
      .get(String(sess.user_id)) as Record<string, unknown> | undefined
    if (!userRow) {
      next()
      return
    }
    const user = mapUserRow(userRow)
    if (user.status !== 'active') {
      next()
      return
    }

    req.authUser = user
    req.authSessionId = String(sess.id)
    req.authPermissions = loadUserPermissionMatrix(user)

    if (user.organizationId) {
      const orgRow = db
        .prepare('SELECT * FROM organizations WHERE id = ?')
        .get(user.organizationId) as Record<string, unknown> | undefined
      req.activeOrg = orgRow ? mapOrgRow(orgRow) : null
      if (req.activeOrg) {
        const subInfo = loadOrgSubscription(req.activeOrg.id, req.activeOrg)
        req.activeSubscription = subInfo.subscription
        req.subscriptionAccess = subInfo.operationalAccess
      } else {
        req.activeSubscription = null
        req.subscriptionAccess = 'onboarding_only'
      }
    } else {
      req.activeOrg = null
      req.activeSubscription = null
      req.subscriptionAccess = 'full'
    }
    next()
  } catch {
    next()
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required. Please log in.' })
    return
  }
  next()
}

export function requirePasswordChanged(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  if (req.authUser.passwordChangeRequired) {
    res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      error: 'You must update your temporary password before accessing the workspace.',
    })
    return
  }
  next()
}

export function requirePlatformAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  if (req.authUser.role !== 'platform_admin') {
    res.status(403).json({
      code: 'PLATFORM_ADMIN_REQUIRED',
      error: 'Platform Super Admin authorization is required.',
    })
    return
  }
  next()
}

export function requireDriverRole(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  if (req.authUser.role !== 'driver' || !req.authUser.driverId || !req.activeOrg) {
    res.status(403).json({
      code: 'DRIVER_PORTAL_ONLY',
      error: 'This endpoint is restricted to authenticated driver portal accounts linked to a driver record.',
    })
    return
  }
  if (req.subscriptionAccess === 'onboarding_only' || req.subscriptionAccess === 'blocked') {
    res.status(403).json({
      code: 'SUBSCRIPTION_REQUIRED',
      error: 'Your organization subscription is not active. Contact your fleet owner.',
    })
    return
  }
  next()
}

export function requireActiveOrganization(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' })
    return
  }
  if (req.authUser.role === 'platform_admin') {
    res.status(403).json({
      code: 'LEVEL2_SEPARATION',
      error: 'Platform Super Admin accounts govern organizations in /platform-admin.',
    })
    return
  }
  if (!req.activeOrg) {
    res.status(403).json({ error: 'No active organization is assigned to this account.' })
    return
  }
  const check = isOrganizationLoginAllowed(req.activeOrg.status)
  if (!check.allowed) {
    res.status(403).json({
      code: 'ORG_ACCESS_BLOCKED',
      orgStatus: req.activeOrg.status,
      reason: req.activeOrg.suspensionReason ?? check.message,
      error: check.message,
    })
    return
  }
  next()
}

export function requirePaidActiveSubscription(options: { allowReadOnlyOnExpiry?: boolean } = { allowReadOnlyOnExpiry: true }) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' })
      return
    }
    if (req.authUser.role === 'platform_admin') {
      next()
      return
    }
    const access = req.subscriptionAccess ?? 'onboarding_only'
    if (access === 'onboarding_only') {
      res.status(402).json({
        code: 'SUBSCRIPTION_PAYMENT_REQUIRED',
        error: 'Active paid DriveMitra subscription required before accessing fleet operations. Complete onboarding & subscription payment first.',
        redirectTo: '/onboarding',
      })
      return
    }
    if (access === 'blocked') {
      res.status(402).json({
        code: 'SUBSCRIPTION_EXPIRED',
        error: 'Your subscription has expired. Renew your plan to restore operational access.',
        redirectTo: '/dashboard/subscription',
      })
      return
    }
    if (access === 'read_only') {
      const isReadMethod = req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
      if (!isReadMethod || options.allowReadOnlyOnExpiry === false) {
        res.status(402).json({
          code: 'SUBSCRIPTION_READ_ONLY',
          error: 'Subscription expired — workspace is in read-only renewal mode. Renew your Monthly or Annual plan to make changes.',
          redirectTo: '/dashboard/subscription',
        })
        return
      }
    }
    next()
  }
}

export function requireFleetAction(action: FleetAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' })
      return
    }
    if (req.authUser.role === 'driver') {
      res.status(403).json({
        code: 'DRIVER_ISOLATION',
        error: 'Driver accounts may only access Driver Portal APIs (/api/driver/*).',
      })
      return
    }
    if (!canPerformAction(req.authUser.role, action, req.authPermissions)) {
      res.status(403).json({
        code: 'PERMISSION_DENIED',
        error: `Account permissions deny "${action}". Ask your Fleet Owner to enable this module permission.`,
      })
      return
    }
    next()
  }
}

export function requireModulePermission(moduleKey: PermissionModuleKey, action: PermissionAction = 'view') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' })
      return
    }
    if (moduleKey === 'integrations' && req.authUser.role !== 'platform_admin') {
      res.status(403).json({
        code: 'PLATFORM_ADMIN_ONLY',
        error: 'Integrations are restricted strictly to DriveMitra Platform Super Admin.',
      })
      return
    }
    if (!hasModulePermission(req.authPermissions, req.authUser.role, moduleKey, action)) {
      res.status(403).json({
        code: 'MODULE_PERMISSION_DENIED',
        module: moduleKey,
        action,
        error: `Access denied for module "${moduleKey}" (${action}).`,
      })
      return
    }
    next()
  }
}

export function recordStaffActivity(
  req: AuthenticatedRequest,
  entry: {
    action: string
    module: string
    recordId?: string | null
    previousValue?: unknown
    newValue?: unknown
  },
): void {
  if (!req.authUser || !req.authUser.organizationId) return
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO staff_activity_logs (
        id, organization_id, staff_user_id, staff_name, action, module,
        record_id, previous_value_json, new_value_json, device_info, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `sal-${crypto.randomUUID().slice(0, 12)}`,
      req.authUser.organizationId,
      req.authUser.id,
      req.authUser.fullName,
      entry.action,
      entry.module,
      entry.recordId ?? null,
      entry.previousValue !== undefined ? JSON.stringify(entry.previousValue) : null,
      entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
      String(req.headers['user-agent'] || 'web-client').slice(0, 180),
      new Date().toISOString(),
    )
  } catch {
    // Non-blocking audit helper
  }
}
