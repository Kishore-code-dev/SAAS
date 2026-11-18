import type { NextFunction, Request, Response } from 'express'
import { canPerformAction, type FleetAction } from '../src/utils/rbac.ts'
import type { Organization } from '../src/types/fleet.ts'
import { getDb, mapOrgRow, mapUserRow, type DbUserRow } from './db.ts'
import { hashToken, isOrganizationLoginAllowed, parseCookies, SESSION_COOKIE_NAME } from './authLogic.ts'

export interface AuthenticatedRequest extends Request {
  authUser?: DbUserRow
  authSessionId?: string
  activeOrg?: Organization | null
}

export function attachSession(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const cookies = parseCookies(req.headers.cookie)
    const rawToken = cookies[SESSION_COOKIE_NAME]
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

    if (user.organizationId) {
      const orgRow = db
        .prepare('SELECT * FROM organizations WHERE id = ?')
        .get(user.organizationId) as Record<string, unknown> | undefined
      req.activeOrg = orgRow ? mapOrgRow(orgRow) : null
    } else {
      req.activeOrg = null
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

export function requireFleetAction(action: FleetAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required.' })
      return
    }
    if (!canPerformAction(req.authUser.role, action)) {
      res.status(403).json({
        error: `Role "${req.authUser.role.replace(/_/g, ' ')}" is not permitted to perform ${action}.`,
      })
      return
    }
    next()
  }
}
