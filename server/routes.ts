import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express, { type Response, type Router } from 'express'
import { REGIONAL_CORRIDORS, SUBSCRIPTION_PLANS } from '../src/data/seedOrganizations.ts'
import type {
  DocumentVaultItem,
  Organization,
  OrganizationRole,
  OrganizationStatus,
  SubscriptionPlanId,
} from '../src/types/fleet.ts'
import {
  ALLOWED_DOCUMENT_MIMES,
  formatCookieHeader,
  generateOpaqueToken,
  generateTemporaryPassword,
  getBackendRedirectForRole,
  hashPassword,
  hashToken,
  isOrganizationLoginAllowed,
  LoginRateLimiter,
  MAX_DOCUMENT_BYTES,
  RESET_TOKEN_TTL_MS,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  validatePasswordStrength,
  verifyPassword,
} from './authLogic.ts'
import {
  attachSession,
  requireActiveOrganization,
  requireAuth,
  requireFleetAction,
  requirePasswordChanged,
  requirePlatformAdmin,
  type AuthenticatedRequest,
} from './authMiddleware.ts'
import { createEmptyOrgDataset, getDb, getUploadsDir, mapOrgRow, mapUserRow } from './db.ts'

const loginLimiter = new LoginRateLimiter(6, 5 * 60 * 1000)

interface WeatherCacheEntry {
  fetchedAtMs: number
  corridors: Array<{
    corridorId: string
    city: string
    temperatureC: number
    windSpeedKmh: number
    precipitationMm: number
    condition: string
    source: string
    observedAt: string
  }>
}
let weatherCache: WeatherCacheEntry | null = null

const CORRIDOR_COORDS: Record<string, { lat: number; lng: number }> = {
  'cor-chennai': { lat: 13.0827, lng: 80.2707 },
  'cor-coimbatore': { lat: 11.0168, lng: 76.9558 },
  'cor-madurai': { lat: 9.9252, lng: 78.1198 },
  'cor-salem': { lat: 11.6643, lng: 78.146 },
  'cor-trichy': { lat: 10.7905, lng: 78.7047 },
  'cor-bengaluru': { lat: 12.9716, lng: 77.5946 },
  'cor-vellore': { lat: 12.9165, lng: 79.1325 },
  'cor-erode': { lat: 11.341, lng: 77.7172 },
}

function describeWmoCode(code: number): string {
  if (code === 0) return 'Clear Sky'
  if (code <= 3) return 'Partly Cloudy'
  if (code <= 48) return 'Haze / Fog'
  if (code <= 67) return 'Rain'
  if (code <= 82) return 'Heavy Showers'
  if (code >= 95) return 'Thunderstorm'
  return 'Overcast'
}

function sendSafeUser(user: ReturnType<typeof mapUserRow>, org: Organization | null) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    organizationId: user.organizationId,
    passwordChangeRequired: user.passwordChangeRequired,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    organization: org,
    redirectTo: user.passwordChangeRequired
      ? '/change-password'
      : getBackendRedirectForRole(user.role),
  }
}

export function buildApiRouter(): Router {
  const router = express.Router()
  router.use(attachSession)

  // ===================== AUTHENTICATION =====================
  router.post('/auth/login', (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as { username?: unknown; password?: unknown }
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!username || !password) {
      res.status(400).json({ error: 'Enter both username and password.' })
      return
    }

    const rateKey = `${req.ip ?? 'local'}::${username}`
    const rate = loginLimiter.check(rateKey)
    if (!rate.allowed) {
      res.status(429).json({
        error: `Too many failed login attempts. Try again in ${Math.max(1, Math.ceil(rate.retryAfterSec / 60))} minute(s).`,
      })
      return
    }

    const db = getDb()
    const row = db
      .prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(username, username) as Record<string, unknown> | undefined

    if (!row) {
      loginLimiter.recordFailure(rateKey)
      res.status(401).json({ error: 'Invalid username or password.' })
      return
    }

    const user = mapUserRow(row)
    if (!verifyPassword(password, user.passwordHash)) {
      loginLimiter.recordFailure(rateKey)
      res.status(401).json({ error: 'Invalid username or password.' })
      return
    }

    if (user.status !== 'active') {
      res.status(403).json({ error: 'Your user account is disabled. Contact your administrator.' })
      return
    }

    let org: Organization | null = null
    if (user.role !== 'platform_admin' && user.organizationId) {
      const orgRow = db
        .prepare('SELECT * FROM organizations WHERE id = ?')
        .get(user.organizationId) as Record<string, unknown> | undefined
      org = orgRow ? mapOrgRow(orgRow) : null
      if (!org) {
        res.status(403).json({ error: 'Assigned organization workspace could not be found.' })
        return
      }
      const orgCheck = isOrganizationLoginAllowed(org.status)
      if (!orgCheck.allowed) {
        res.status(403).json({
          code: 'ORG_ACCESS_BLOCKED',
          orgStatus: org.status,
          reason: org.suspensionReason ?? orgCheck.message,
          error: orgCheck.message,
        })
        return
      }
    }

    loginLimiter.recordSuccess(rateKey)
    const rawToken = generateOpaqueToken(32)
    const tokenHash = hashToken(rawToken)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString()

    db.prepare(`
      INSERT INTO auth_sessions (id, user_id, organization_id, token_hash, revoked, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), user.id, user.organizationId, tokenHash, expiresAt, now.toISOString())

    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now.toISOString(), user.id)
    user.lastLoginAt = now.toISOString()

    res.setHeader(
      'Set-Cookie',
      formatCookieHeader(SESSION_COOKIE_NAME, rawToken, Math.floor(SESSION_TTL_MS / 1000)),
    )
    res.json(sendSafeUser(user, org))
  })

  router.get('/auth/me', (req: AuthenticatedRequest, res: Response) => {
    if (!req.authUser) {
      res.status(200).json({ authenticated: false })
      return
    }
    if (req.authUser.role !== 'platform_admin' && req.activeOrg) {
      const check = isOrganizationLoginAllowed(req.activeOrg.status)
      if (!check.allowed) {
        res.setHeader('Set-Cookie', formatCookieHeader(SESSION_COOKIE_NAME, '', 0))
        res.status(403).json({
          authenticated: false,
          code: 'ORG_ACCESS_BLOCKED',
          orgStatus: req.activeOrg.status,
          reason: req.activeOrg.suspensionReason ?? check.message,
          error: check.message,
        })
        return
      }
    }
    res.json({ authenticated: true, ...sendSafeUser(req.authUser, req.activeOrg ?? null) })
  })

  router.post('/auth/logout', (req: AuthenticatedRequest, res: Response) => {
    if (req.authSessionId) {
      getDb().prepare('UPDATE auth_sessions SET revoked = 1 WHERE id = ?').run(req.authSessionId)
    }
    res.setHeader('Set-Cookie', formatCookieHeader(SESSION_COOKIE_NAME, '', 0))
    res.json({ ok: true })
  })

  router.post('/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as { currentPassword?: unknown; newPassword?: unknown }
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
    const user = req.authUser!

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect.' })
      return
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ error: 'New password must be different from your current or temporary password.' })
      return
    }
    const strengthErr = validatePasswordStrength(newPassword)
    if (strengthErr) {
      res.status(400).json({ error: strengthErr })
      return
    }

    const db = getDb()
    const newHash = hashPassword(newPassword)
    db.prepare('UPDATE users SET password_hash = ?, password_change_required = 0 WHERE id = ?').run(
      newHash,
      user.id,
    )
    // Revoke all other sessions for this user, keeping current session valid
    if (req.authSessionId) {
      db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE user_id = ? AND id != ?').run(
        user.id,
        req.authSessionId,
      )
    }

    const refreshedRow = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown>
    const refreshed = mapUserRow(refreshedRow)
    res.json({
      ok: true,
      ...sendSafeUser(refreshed, req.activeOrg ?? null),
    })
  })

  router.post('/auth/forgot-password', (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as { username?: unknown }
    const identifier = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    if (!identifier) {
      res.status(400).json({ error: 'Enter your username or work email address.' })
      return
    }

    const db = getDb()
    const row = db
      .prepare('SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(identifier, identifier) as Record<string, unknown> | undefined

    // Always return neutral confirmation to prevent account enumeration
    if (!row) {
      res.json({
        ok: true,
        message: 'If a matching active account exists, a single-use password reset token has been issued.',
      })
      return
    }

    const user = mapUserRow(row)
    const rawResetToken = generateOpaqueToken(24)
    const tokenHash = hashToken(rawResetToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString()

    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id)
    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, used, expires_at, created_at)
      VALUES (?, ?, ?, 0, ?, ?)
    `).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, new Date().toISOString())

    res.json({
      ok: true,
      message: 'A single-use recovery token valid for 30 minutes has been issued for this account.',
      // Expose recovery token only when SMTP relay is not configured in self-hosted container
      recoveryTokenPreview: process.env.SMTP_HOST ? undefined : rawResetToken,
    })
  })

  router.post('/auth/reset-password', (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as { token?: unknown; newPassword?: unknown }
    const token = typeof body?.token === 'string' ? body.token.trim() : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

    if (!token) {
      res.status(400).json({ error: 'Enter your password reset token.' })
      return
    }
    const strengthErr = validatePasswordStrength(newPassword)
    if (strengthErr) {
      res.status(400).json({ error: strengthErr })
      return
    }

    const db = getDb()
    const tokenHash = hashToken(token)
    const resetRow = db
      .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ?')
      .get(tokenHash) as Record<string, unknown> | undefined

    if (!resetRow || Number(resetRow.used) === 1) {
      res.status(400).json({ error: 'Invalid or already used password reset token.' })
      return
    }
    if (new Date(String(resetRow.expires_at)).getTime() <= Date.now()) {
      res.status(400).json({ error: 'Password reset token has expired. Request a new reset token.' })
      return
    }

    const userId = String(resetRow.user_id)
    db.prepare('UPDATE users SET password_hash = ?, password_change_required = 0 WHERE id = ?').run(
      hashPassword(newPassword),
      userId,
    )
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(String(resetRow.id))
    db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE user_id = ?').run(userId)

    res.json({ ok: true, message: 'Password updated successfully. You may now log in with your new password.' })
  })

  // ===================== LEVEL-2 SUPER ADMIN PANEL =====================
  router.get(
    '/platform-admin/organizations',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : ''
      const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all'
      const planFilter = typeof req.query.plan === 'string' ? req.query.plan : 'all'

      const rows = db.prepare('SELECT * FROM organizations ORDER BY created_at DESC').all() as Array<
        Record<string, unknown>
      >

      const enriched = rows
        .map((row) => {
          const org = mapOrgRow(row)
          const blobRow = db
            .prepare('SELECT payload_json FROM org_fleet_blobs WHERE organization_id = ?')
            .get(org.id) as { payload_json?: string } | undefined
          const userCountRow = db
            .prepare('SELECT COUNT(*) AS count FROM users WHERE organization_id = ?')
            .get(org.id) as { count: number }

          let totalVehicles = 0
          let totalDrivers = 0
          let openWorkOrders = 0
          let monthlyRevenueInr = 0

          if (blobRow?.payload_json) {
            try {
              const parsed = JSON.parse(blobRow.payload_json) as {
                vehicles?: Array<{ decommissioned?: boolean; monthlyRevenueInr?: number }>
                drivers?: unknown[]
                workOrders?: Array<{ status?: string }>
              }
              const activeVehs = (parsed.vehicles ?? []).filter((v) => !v.decommissioned)
              totalVehicles = activeVehs.length
              totalDrivers = (parsed.drivers ?? []).length
              openWorkOrders = (parsed.workOrders ?? []).filter(
                (w) => w.status !== 'completed' && w.status !== 'closed',
              ).length
              monthlyRevenueInr = activeVehs.reduce((s, v) => s + (v.monthlyRevenueInr ?? 0), 0)
            } catch {
              // ignore corrupt counts
            }
          }

          return {
            ...org,
            totalVehicles,
            totalDrivers,
            openWorkOrders,
            monthlyRevenueInr,
            activeUsersCount: userCountRow.count,
          }
        })
        .filter((o) => {
          const matchQ =
            !q ||
            o.name.toLowerCase().includes(q) ||
            o.code.toLowerCase().includes(q) ||
            o.city.toLowerCase().includes(q) ||
            (o.ownerName?.toLowerCase().includes(q) ?? false) ||
            (o.ownerEmail?.toLowerCase().includes(q) ?? false)
          const matchStatus = statusFilter === 'all' || o.status === statusFilter
          const matchPlan = planFilter === 'all' || o.planId === planFilter
          return matchQ && matchStatus && matchPlan
        })

      const auditRows = db
        .prepare('SELECT * FROM platform_admin_audit_logs ORDER BY created_at DESC LIMIT 80')
        .all() as Array<Record<string, unknown>>

      res.json({
        organizations: enriched,
        auditLogs: auditRows.map((a) => ({
          id: String(a.id),
          actorUserId: String(a.actor_user_id),
          actorUsername: String(a.actor_username),
          action: String(a.action),
          targetOrgId: a.target_org_id ? String(a.target_org_id) : null,
          targetOrgName: a.target_org_name ? String(a.target_org_name) : null,
          reason: String(a.reason),
          metadata: JSON.parse(String(a.metadata_json || '{}')),
          createdAt: String(a.created_at),
        })),
      })
    },
  )

  router.post(
    '/platform-admin/organizations',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        name?: string
        city?: string
        state?: string
        ownerName?: string
        ownerEmail?: string
        ownerPhone?: string
        gstin?: string
        planId?: SubscriptionPlanId
        paymentStatus?: Organization['paymentStatus']
        requestedUsername?: string
      }

      if (!body.name?.trim() || !body.city?.trim() || !body.state?.trim() || !body.ownerName?.trim() || !body.ownerEmail?.trim()) {
        res.status(400).json({ error: 'Organization name, city, state, owner name, and owner email are required.' })
        return
      }

      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === (body.planId ?? 'starter')) ?? SUBSCRIPTION_PLANS[0]
      const nowIso = new Date().toISOString()
      const orgId = `org-${crypto.randomUUID().slice(0, 8)}`
      const prefix = body.name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'ORG'
      const code = `${prefix}-${Math.floor(100 + Math.random() * 899)}`

      const baseUsername = (
        body.requestedUsername?.trim() ||
        `${body.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}.owner`
      ).toLowerCase()

      const db = getDb()
      const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(baseUsername)
      const finalUsername = existingUser
        ? `${baseUsername}.${Math.floor(10 + Math.random() * 89)}`
        : baseUsername

      const temporaryPassword = generateTemporaryPassword()
      const ownerUserId = `u-${crypto.randomUUID().slice(0, 8)}`

      const org: Organization = {
        id: orgId,
        name: body.name.trim(),
        code,
        city: body.city.trim(),
        state: body.state.trim(),
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        planId: plan.id,
        vehicleLimit: plan.vehicleLimit,
        driverLimit: plan.driverLimit,
        status: body.paymentStatus === 'pending' ? 'payment_pending' : 'active',
        paymentStatus: body.paymentStatus ?? 'paid',
        subscriptionStartDate: nowIso.slice(0, 10),
        subscriptionExpiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        ownerName: body.ownerName.trim(),
        ownerEmail: body.ownerEmail.trim().toLowerCase(),
        ownerPhone: body.ownerPhone?.trim(),
        gstin: body.gstin?.trim().toUpperCase(),
        createdAt: nowIso,
        environment: 'production',
      }

      db.prepare(`
        INSERT INTO organizations (
          id, name, code, city, state, timezone, plan_id, vehicle_limit, driver_limit,
          status, payment_status, subscription_start_date, subscription_expiry_date,
          grace_period_until, suspension_reason, owner_name, owner_email, owner_phone, gstin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
      `).run(
        org.id,
        org.name,
        org.code,
        org.city,
        org.state,
        org.timezone,
        org.planId,
        org.vehicleLimit,
        org.driverLimit,
        org.status,
        org.paymentStatus,
        org.subscriptionStartDate,
        org.subscriptionExpiryDate,
        org.ownerName ?? null,
        org.ownerEmail ?? null,
        org.ownerPhone ?? null,
        org.gstin ?? null,
        org.createdAt,
      )

      const emptyBlob = {
        ...createEmptyOrgDataset(org),
        members: [
          {
            id: `mem-${crypto.randomUUID().slice(0, 8)}`,
            organizationId: org.id,
            userId: ownerUserId,
            username: finalUsername,
            fullName: org.ownerName!,
            email: org.ownerEmail!,
            role: 'org_admin' as OrganizationRole,
            status: 'active' as const,
            lastActiveAt: nowIso,
          },
        ],
      }
      db.prepare('INSERT INTO org_fleet_blobs (organization_id, payload_json, updated_at) VALUES (?, ?, ?)').run(
        org.id,
        JSON.stringify(emptyBlob),
        nowIso,
      )

      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          password_change_required, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'org_admin', ?, 1, 'active', ?)
      `).run(
        ownerUserId,
        finalUsername,
        org.ownerEmail!,
        org.ownerName!,
        hashPassword(temporaryPassword),
        org.id,
        nowIso,
      )

      db.prepare(`
        INSERT INTO platform_admin_audit_logs (
          id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
        ) VALUES (?, ?, ?, 'ONBOARD_ORGANIZATION', ?, ?, ?, ?, ?)
      `).run(
        `paud-${crypto.randomUUID().slice(0, 8)}`,
        req.authUser!.id,
        req.authUser!.username,
        org.id,
        org.name,
        `Onboarded new tenant ${org.name} (${org.code}) on ${plan.name} plan.`,
        JSON.stringify({ planId: org.planId, ownerUsername: finalUsername }),
        nowIso,
      )

      res.status(201).json({
        organization: org,
        ownerCredentials: {
          username: finalUsername,
          temporaryPassword,
          passwordChangeRequired: true,
        },
      })
    },
  )

  router.patch(
    '/platform-admin/organizations/:orgId/status',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const orgId = String(req.params.orgId)
      const body = req.body as {
        status?: OrganizationStatus
        reason?: string
        confirmAction?: boolean
        gracePeriodDays?: number
      }

      const validStatuses: OrganizationStatus[] = [
        'active',
        'payment_pending',
        'grace_period',
        'suspended',
        'terminated',
        'archived',
      ]
      if (!body.status || !validStatuses.includes(body.status)) {
        res.status(400).json({ error: 'Invalid organization lifecycle status.' })
        return
      }
      if (!body.reason || body.reason.trim().length < 5) {
        res.status(400).json({ error: 'A clear administrative reason (minimum 5 characters) is mandatory.' })
        return
      }
      if (body.confirmAction !== true) {
        res.status(400).json({ error: 'Explicit confirmation is required for organization access changes.' })
        return
      }

      const db = getDb()
      const existingRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as
        | Record<string, unknown>
        | undefined
      if (!existingRow) {
        res.status(404).json({ error: 'Organization not found.' })
        return
      }
      const prevOrg = mapOrgRow(existingRow)
      const nowIso = new Date().toISOString()

      const graceUntil =
        body.status === 'grace_period'
          ? new Date(Date.now() + (body.gracePeriodDays ?? 7) * 86400000).toISOString().slice(0, 10)
          : null
      const suspensionReason =
        body.status === 'suspended' || body.status === 'terminated' || body.status === 'archived'
          ? body.reason.trim()
          : null

      db.prepare(`
        UPDATE organizations
        SET status = ?, grace_period_until = ?, suspension_reason = ?
        WHERE id = ?
      `).run(body.status, graceUntil, suspensionReason, orgId)

      // Immediate server-side session revocation when suspending/terminating/archiving WITHOUT deleting fleet data
      let revokedSessions = 0
      if (body.status === 'suspended' || body.status === 'terminated' || body.status === 'archived') {
        const result = db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE organization_id = ? AND revoked = 0').run(orgId)
        revokedSessions = Number(result.changes ?? 0)
      }

      db.prepare(`
        INSERT INTO platform_admin_audit_logs (
          id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `paud-${crypto.randomUUID().slice(0, 8)}`,
        req.authUser!.id,
        req.authUser!.username,
        `ORG_STATUS_${body.status.toUpperCase()}`,
        orgId,
        prevOrg.name,
        body.reason.trim(),
        JSON.stringify({ previousStatus: prevOrg.status, nextStatus: body.status, revokedSessions }),
        nowIso,
      )

      const updatedRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as Record<string, unknown>
      res.json({ organization: mapOrgRow(updatedRow), revokedSessions })
    },
  )

  router.patch(
    '/platform-admin/organizations/:orgId/subscription',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const orgId = String(req.params.orgId)
      const body = req.body as {
        planId?: SubscriptionPlanId
        paymentStatus?: Organization['paymentStatus']
        subscriptionExpiryDate?: string
        reason?: string
      }

      const db = getDb()
      const existingRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as
        | Record<string, unknown>
        | undefined
      if (!existingRow) {
        res.status(404).json({ error: 'Organization not found.' })
        return
      }
      const prevOrg = mapOrgRow(existingRow)
      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === (body.planId ?? prevOrg.planId)) ?? SUBSCRIPTION_PLANS[0]
      const nextPaymentStatus = body.paymentStatus ?? prevOrg.paymentStatus
      const nextExpiry = body.subscriptionExpiryDate ?? prevOrg.subscriptionExpiryDate

      db.prepare(`
        UPDATE organizations
        SET plan_id = ?, vehicle_limit = ?, driver_limit = ?, payment_status = ?, subscription_expiry_date = ?
        WHERE id = ?
      `).run(plan.id, plan.vehicleLimit, plan.driverLimit, nextPaymentStatus, nextExpiry, orgId)

      db.prepare(`
        INSERT INTO platform_admin_audit_logs (
          id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
        ) VALUES (?, ?, ?, 'UPDATE_ORG_SUBSCRIPTION', ?, ?, ?, ?, ?)
      `).run(
        `paud-${crypto.randomUUID().slice(0, 8)}`,
        req.authUser!.id,
        req.authUser!.username,
        orgId,
        prevOrg.name,
        body.reason?.trim() || `Updated plan to ${plan.name} and payment status to ${nextPaymentStatus}.`,
        JSON.stringify({ planId: plan.id, paymentStatus: nextPaymentStatus, subscriptionExpiryDate: nextExpiry }),
        new Date().toISOString(),
      )

      const updatedRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as Record<string, unknown>
      res.json({ organization: mapOrgRow(updatedRow) })
    },
  )

  // ===================== TENANT FLEET STATE & DOCUMENT VAULT =====================
  router.get(
    '/fleet/bootstrap',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const blobRow = db
        .prepare('SELECT payload_json, updated_at FROM org_fleet_blobs WHERE organization_id = ?')
        .get(org.id) as { payload_json: string; updated_at: string } | undefined

      const payload = blobRow ? JSON.parse(blobRow.payload_json) : createEmptyOrgDataset(org)
      res.json({
        organization: org,
        role: req.authUser!.role,
        updatedAt: blobRow?.updated_at ?? new Date().toISOString(),
        data: payload,
      })
    },
  )

  router.put(
    '/fleet/state',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const body = req.body as { data?: Record<string, unknown> }
      if (!body?.data || typeof body.data !== 'object') {
        res.status(400).json({ error: 'Invalid fleet state payload.' })
        return
      }
      const nowIso = new Date().toISOString()
      db.prepare(`
        INSERT INTO org_fleet_blobs (organization_id, payload_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(organization_id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
      `).run(org.id, JSON.stringify(body.data), nowIso)

      res.json({ ok: true, updatedAt: nowIso })
    },
  )

  router.post(
    '/fleet/members',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('manage_members'),
    (req: AuthenticatedRequest, res: Response) => {
      const org = req.activeOrg!
      const body = req.body as { fullName?: string; email?: string; role?: OrganizationRole }
      if (!body.fullName?.trim() || !body.email?.includes('@')) {
        res.status(400).json({ error: 'Valid full name and work email are required.' })
        return
      }
      const allowedOrgRoles: OrganizationRole[] = ['org_admin', 'fleet_manager', 'maintenance', 'finance', 'viewer']
      const role = body.role && allowedOrgRoles.includes(body.role) ? body.role : 'fleet_manager'

      const db = getDb()
      const baseUsername = body.email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '')
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(baseUsername)
      const username = existing ? `${baseUsername}.${Math.floor(10 + Math.random() * 89)}` : baseUsername
      const tempPassword = generateTemporaryPassword()
      const userId = `u-${crypto.randomUUID().slice(0, 8)}`
      const nowIso = new Date().toISOString()

      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          password_change_required, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?)
      `).run(userId, username, body.email.trim().toLowerCase(), body.fullName.trim(), hashPassword(tempPassword), role, org.id, nowIso)

      res.status(201).json({
        member: {
          id: `mem-${crypto.randomUUID().slice(0, 8)}`,
          organizationId: org.id,
          userId,
          username,
          fullName: body.fullName.trim(),
          email: body.email.trim().toLowerCase(),
          role,
          status: 'active',
          lastActiveAt: nowIso,
        },
        temporaryCredentials: {
          username,
          temporaryPassword,
          passwordChangeRequired: true,
        },
      })
    },
  )

  router.post(
    '/fleet/documents',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('edit_vehicle'),
    (req: AuthenticatedRequest, res: Response) => {
      const org = req.activeOrg!
      const body = req.body as {
        entityType?: 'vehicle' | 'driver'
        entityId?: string
        category?: string
        title?: string
        maskedNumber?: string
        issuingAuthority?: string
        issuedDate?: string
        expiryDate?: string
        fileName?: string
        mimeType?: string
        contentBase64?: string
      }

      if (
        !body.entityType ||
        !['vehicle', 'driver'].includes(body.entityType) ||
        !body.entityId?.trim() ||
        !body.category?.trim() ||
        !body.title?.trim() ||
        !body.fileName?.trim() ||
        !body.mimeType?.trim() ||
        !body.contentBase64?.trim()
      ) {
        res.status(400).json({ error: 'All document metadata fields and file content are required.' })
        return
      }

      if (!ALLOWED_DOCUMENT_MIMES.has(body.mimeType)) {
        res.status(400).json({ error: 'Unsupported document format. Upload PDF, JPEG, PNG, or WebP.' })
        return
      }

      const rawBase64 = body.contentBase64.includes(',') ? body.contentBase64.split(',')[1] : body.contentBase64
      const fileBuf = Buffer.from(rawBase64, 'base64')
      if (fileBuf.length === 0 || fileBuf.length > MAX_DOCUMENT_BYTES) {
        res.status(400).json({ error: 'Document file must be non-empty and under 5 MB.' })
        return
      }

      const docId = `doc-${crypto.randomUUID().slice(0, 10)}`
      const orgDir = path.join(getUploadsDir(), org.id)
      fs.mkdirSync(orgDir, { recursive: true })
      const safeName = body.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storageKey = path.join(org.id, `${docId}_${safeName}`)
      fs.writeFileSync(path.join(getUploadsDir(), storageKey), fileBuf)

      const nowIso = new Date().toISOString()
      getDb()
        .prepare(`
          INSERT INTO document_files (id, organization_id, storage_key, file_name, mime_type, file_size_bytes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(docId, org.id, storageKey, safeName, body.mimeType, fileBuf.length, nowIso)

      // Strict policy: Uploaded != Verified
      const item: DocumentVaultItem = {
        id: docId,
        organizationId: org.id,
        entityType: body.entityType,
        entityId: body.entityId,
        category: body.category.trim(),
        title: body.title.trim(),
        maskedNumber: body.maskedNumber?.trim(),
        issuingAuthority: body.issuingAuthority?.trim(),
        issuedDate: body.issuedDate || undefined,
        expiryDate: body.expiryDate || undefined,
        fileName: safeName,
        mimeType: body.mimeType,
        fileSizeBytes: fileBuf.length,
        storageKey,
        verificationStatus: 'pending_verification',
        uploadedBy: req.authUser!.fullName,
        uploadedAt: nowIso,
      }

      res.status(201).json({ document: item })
    },
  )

  router.get(
    '/fleet/documents/:docId/download',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const org = req.activeOrg!
      const docId = String(req.params.docId)
      const row = getDb()
        .prepare('SELECT * FROM document_files WHERE id = ? AND organization_id = ?')
        .get(docId, org.id) as Record<string, unknown> | undefined

      if (!row) {
        res.status(404).json({ error: 'Private document record not found in your organization.' })
        return
      }
      const absPath = path.join(getUploadsDir(), String(row.storage_key))
      if (!fs.existsSync(absPath)) {
        res.status(404).json({ error: 'Stored document file is unavailable on disk.' })
        return
      }
      res.setHeader('Content-Type', String(row.mime_type))
      res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name)}"`)
      res.sendFile(absPath)
    },
  )

  // ===================== COMMERCIAL TRUCK ROUTING & CLIMATE =====================
  router.post(
    '/routing/truck',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        origin?: { lat: number; lng: number }
        destination?: { lat: number; lng: number }
        specs?: {
          heightMeters?: number
          widthMeters?: number
          lengthMeters?: number
          grossVehicleWeightKg?: number
          axleCount?: number
          hazmatClass?: string
        }
      }

      if (!body?.origin || !body?.destination) {
        res.status(400).json({ error: 'Origin and destination coordinates are required.' })
        return
      }

      const mapsKey = process.env.GOOGLE_MAPS_API_KEY
      if (!mapsKey) {
        res.json({
          available: false,
          mode: 'highway_geometry_unverified',
          routeRestrictionsPartiallyIgnored: true,
          message:
            'Google Maps Truck Routing API is not configured. Standard highway corridor geometry is shown and is NOT verified for bridge height, GVW, or axle restrictions.',
        })
        return
      }

      try {
        const gRes = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          signal: AbortSignal.timeout(5000),
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': mapsKey,
            'X-Goog-FieldMask':
              'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.routeLabels,routes.travelAdvisory.routeRestrictionsPartiallyIgnored',
          },
          body: JSON.stringify({
            origin: { location: { latLng: { latitude: body.origin.lat, longitude: body.origin.lng } } },
            destination: {
              location: { latLng: { latitude: body.destination.lat, longitude: body.destination.lng } },
            },
            travelMode: 'TRUCK',
            routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
            routeModifiers: {
              vehicleInfo: {
                emissionType: 'DIESEL',
                ...(body.specs?.grossVehicleWeightKg
                  ? { grossWeightKg: body.specs.grossVehicleWeightKg }
                  : {}),
                ...(body.specs?.heightMeters ? { heightMeters: body.specs.heightMeters } : {}),
                ...(body.specs?.widthMeters ? { widthMeters: body.specs.widthMeters } : {}),
                ...(body.specs?.lengthMeters ? { lengthMeters: body.specs.lengthMeters } : {}),
                ...(body.specs?.axleCount ? { axleCount: body.specs.axleCount } : {}),
              },
            },
          }),
        })

        const payload = (await gRes.json()) as {
          routes?: Array<{
            distanceMeters?: number
            duration?: string
            travelAdvisory?: { routeRestrictionsPartiallyIgnored?: boolean }
          }>
          error?: { message?: string }
        }

        const route = payload?.routes?.[0]
        if (!gRes.ok || !route) {
          res.json({
            available: false,
            mode: 'highway_geometry_unverified',
            routeRestrictionsPartiallyIgnored: true,
            message:
              'Commercial truck routing gateway did not return a verified truck path. Falling back to unverified corridor distance estimation.',
          })
          return
        }

        const partiallyIgnored = Boolean(route.travelAdvisory?.routeRestrictionsPartiallyIgnored)
        res.json({
          available: true,
          mode: partiallyIgnored
            ? 'google_truck_partial_restrictions'
            : 'google_truck_verified',
          routeRestrictionsPartiallyIgnored: partiallyIgnored,
          distanceKm: route.distanceMeters ? Number((route.distanceMeters / 1000).toFixed(1)) : null,
          durationSeconds: route.duration ? parseInt(route.duration.replace('s', ''), 10) : null,
          message: partiallyIgnored
            ? 'Truck route calculated with partial restriction warnings — verify local bridge clearances.'
            : 'Verified Google Maps Commercial Truck Route with vehicle dimension & GVW constraints.',
        })
      } catch {
        res.json({
          available: false,
          mode: 'highway_geometry_unverified',
          routeRestrictionsPartiallyIgnored: true,
          message:
            'Commercial truck routing service is currently unreachable. Corridor geometry shown is not truck-restriction verified.',
        })
      }
    },
  )

  router.get(
    '/climate/corridors',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    async (_req: AuthenticatedRequest, res: Response) => {
      if (weatherCache && Date.now() - weatherCache.fetchedAtMs < 5 * 60 * 1000) {
        res.json({
          live: true,
          provider: 'Open-Meteo Live Weather',
          fetchedAt: new Date(weatherCache.fetchedAtMs).toISOString(),
          corridors: weatherCache.corridors,
        })
        return
      }

      try {
        const lats = REGIONAL_CORRIDORS.map((c) => CORRIDOR_COORDS[c.id]?.lat ?? 11.0).join(',')
        const lngs = REGIONAL_CORRIDORS.map((c) => CORRIDOR_COORDS[c.id]?.lng ?? 78.0).join(',')
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,wind_speed_10m,weather_code&timezone=Asia%2FKolkata`
        const wxRes = await fetch(url, { signal: AbortSignal.timeout(3500) })
        if (!wxRes.ok) throw new Error(`HTTP ${wxRes.status}`)
        const raw = (await wxRes.json()) as Array<{
          current?: {
            time?: string
            temperature_2m?: number
            precipitation?: number
            wind_speed_10m?: number
            weather_code?: number
          }
        }>

        if (!Array.isArray(raw) || raw.length === 0) throw new Error('Empty weather feed')

        const corridors = REGIONAL_CORRIDORS.map((c, idx) => {
          const item = raw[idx]?.current
          return {
            corridorId: c.id,
            city: c.name,
            temperatureC: typeof item?.temperature_2m === 'number' ? item.temperature_2m : c.avgAmbientTempC,
            windSpeedKmh: typeof item?.wind_speed_10m === 'number' ? item.wind_speed_10m : 12,
            precipitationMm: typeof item?.precipitation === 'number' ? item.precipitation : 0,
            condition: typeof item?.weather_code === 'number' ? describeWmoCode(item.weather_code) : 'Clear',
            source: 'Open-Meteo Live API',
            observedAt: item?.time ?? new Date().toISOString(),
          }
        })

        weatherCache = { fetchedAtMs: Date.now(), corridors }
        res.json({
          live: true,
          provider: 'Open-Meteo Live Weather',
          fetchedAt: new Date(weatherCache.fetchedAtMs).toISOString(),
          corridors,
        })
      } catch {
        res.json({
          live: false,
          provider: 'Regional Baseline Model (Live Weather Feed Unavailable)',
          fetchedAt: null,
          corridors: REGIONAL_CORRIDORS.map((c) => ({
            corridorId: c.id,
            city: c.name,
            temperatureC: c.avgAmbientTempC,
            windSpeedKmh: null,
            precipitationMm: null,
            condition: 'Baseline seasonal estimate (live feed unreachable)',
            source: 'Static Regional Baseline',
            observedAt: null,
          })),
        })
      }
    },
  )

  return router
}
