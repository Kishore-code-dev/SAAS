import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import express, { type Response, type Router } from 'express'
import { REGIONAL_CORRIDORS, SUBSCRIPTION_PLANS } from '../src/data/seedOrganizations.ts'
import type {
  DocumentVaultItem,
  FleetRecallItem,
  FleetToolItem,
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
import { scheduleDbsSync } from './dbsSync.ts'
import {
  ackFinanceAlert,
  correctFinancePayment,
  createVehicleFinanceRecord,
  getFinanceWorkspace,
  reconcileFinancePayment,
  recordEmiPayment,
  syncFinanceAlertsInDb,
  updateEmiStatusOrLateFee,
  updateFinanceSettings,
  updateVehicleFinanceTerms,
  uploadFinanceDocument,
  upsertInstitution,
  verifyFinanceDocument,
  type FinanceActor,
} from './financeDb.ts'
import {
  deleteApiKey,
  getOrgFleetDataset,
  getOrgFleetModules,
  getOrgOperationalCounts,
  insertApiKey,
  insertCustomDashboard,
  insertCustomRecord,
  insertFleetRecall,
  insertFleetTool,
  insertFleetWarranty,
  insertInspectionForm,
  insertInspectionSchedule,
  insertServiceProgram,
  insertServiceTask,
  insertWebhook,
  saveOrgFleetDataset,
  seedOrgFleetModules,
  toggleWebhookActive,
  updateFleetRecallStatus,
  updateFleetToolStatus,
  updateFleetWorkspaceSettings,
} from './fleetDb.ts'
import { buildContractRouter } from './contractRoutes.ts'

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

  // Vehicle ownership & contract management module
  router.use('/contracts', buildContractRouter())

  // Keep DBS/ reference snapshot synced automatically after any mutating DB API request
  router.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          scheduleDbsSync(getDb())
        }
      })
    }
    next()
  })

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

  router.post(
    '/fleet/self-register',
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        fleetName?: string
        businessName?: string
        businessEmail?: string
        businessMobile?: string
        city?: string
        state?: string
        pinCode?: string
        businessType?: string
        servicesProvided?: string[]
        plannedStaff?: {
          fullName?: string
          mobile?: string
          email?: string
          designation?: string
        }
        selectedPlan?: SubscriptionPlanId
      }

      // Validate required fields
      if (!body.fleetName?.trim() || !body.businessName?.trim() || !body.businessEmail?.trim() ||
          !body.city?.trim() || !body.state?.trim()) {
        res.status(400).json({ 
          error: 'Fleet name, business name, email, city, and state are required.' 
        })
        return
      }

      // Validate email format
      if (!body.businessEmail.includes('@')) {
        res.status(400).json({ error: 'Please enter a valid email address.' })
        return
      }

      const plan = SUBSCRIPTION_PLANS.find((p) => p.id === (body.selectedPlan ?? 'monthly_basic')) ?? SUBSCRIPTION_PLANS[0]
      const nowIso = new Date().toISOString()
      const orgId = `org-${crypto.randomUUID().slice(0, 8)}`
      const prefix = body.fleetName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'FLEET'
      const code = `${prefix}-${Math.floor(100 + Math.random() * 899)}`

      const db = getDb()
      
      // Check for existing user with this email
      const existingUserByEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(body.businessEmail.toLowerCase().trim())
      const baseUsername = `${body.fleetName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}.owner`
      const existingUserByUsername = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(baseUsername)
      
      const finalUsername = existingUserByUsername
        ? `${baseUsername}.${Math.floor(10 + Math.random() * 89)}`
        : baseUsername

      const temporaryPassword = generateTemporaryPassword()
      const ownerUserId = `u-${crypto.randomUUID().slice(0, 8)}`

      const org: Organization = {
        id: orgId,
        name: body.fleetName.trim(),
        code,
        city: body.city.trim(),
        state: body.state.trim(),
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        planId: plan.id,
        vehicleLimit: plan.vehicleLimit,
        driverLimit: plan.driverLimit,
        status: 'active',
        paymentStatus: 'pending', // Set to pending so owner can complete payment
        subscriptionStartDate: nowIso.slice(0, 10),
        subscriptionExpiryDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
        ownerName: body.businessName.trim(),
        ownerEmail: body.businessEmail.trim().toLowerCase(),
        ownerPhone: body.businessMobile?.trim(),
        gstin: undefined,
        createdAt: nowIso,
        environment: 'production',
      }

      // Create organization
      db.prepare(`
        INSERT INTO organizations (
          id, name, code, city, state, timezone, plan_id, vehicle_limit, driver_limit,
          status, payment_status, subscription_start_date, subscription_expiry_date,
          grace_period_until, suspension_reason, owner_name, owner_email, owner_phone, gstin, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?)
      `).run(
        org.id, org.name, org.code, org.city, org.state, org.timezone, org.planId,
        org.vehicleLimit, org.driverLimit, org.status, org.paymentStatus,
        org.subscriptionStartDate, org.subscriptionExpiryDate,
        org.ownerName, org.ownerEmail, org.ownerPhone, null, org.createdAt,
      )

      // Create empty organization dataset
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
            role: 'org_admin',
            status: 'active',
            lastActiveAt: nowIso,
          },
        ],
      }
      saveOrgFleetDataset(db, org.id, emptyBlob, true)
      seedOrgFleetModules(db, org, [])

      // Create owner user
      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          password_change_required, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'org_admin', ?, 1, 'active', ?)
      `).run(
        ownerUserId, finalUsername, org.ownerEmail!, org.ownerName!,
        hashPassword(temporaryPassword), org.id, nowIso,
      )

      // Create first staff member if provided
      if (body.plannedStaff?.fullName?.trim() && body.plannedStaff?.email?.trim()) {
        const staffUserId = `u-${crypto.randomUUID().slice(0, 8)}`
        const staffUsername = body.plannedStaff.email.split('@')[0].toLowerCase().replace(/[^a-z0-9.]/g, '')
        const existingStaffUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(staffUsername)
        const finalStaffUsername = existingStaffUser
          ? `${staffUsername}.${Math.floor(10 + Math.random() * 89)}`
          : staffUsername
        
        const staffTempPassword = generateTemporaryPassword()
        const staffMemberId = `mem-${crypto.randomUUID().slice(0, 8)}`

        db.prepare(`
          INSERT INTO users (
            id, username, email, full_name, password_hash, role, organization_id,
            password_change_required, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'fleet_staff', ?, 1, 'active', ?)
        `).run(
          staffUserId, finalStaffUsername, body.plannedStaff.email.trim().toLowerCase(),
          body.plannedStaff.fullName.trim(), hashPassword(staffTempPassword), org.id, nowIso,
        )

        db.prepare(`
          INSERT INTO org_members (id, organization_id, user_id, username, full_name, email, role, status, last_active_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
        `).run(
          staffMemberId, org.id, staffUserId, finalStaffUsername,
          body.plannedStaff.fullName.trim(), body.plannedStaff.email.trim().toLowerCase(),
          'fleet_staff', nowIso,
        )

        // Add staff temp credentials to response
        const responseWithStaff = {
          organization: org,
          ownerCredentials: {
            username: finalUsername,
            temporaryPassword,
            passwordChangeRequired: true,
          },
          staffCredentials: {
            username: finalStaffUsername,
            temporaryPassword: staffTempPassword,
            passwordChangeRequired: true,
          },
          paymentRequired: true,
          message: 'Account created successfully. Please complete your subscription payment.',
        }
        res.status(201).json(responseWithStaff)
        return
      }

      // Log the registration
      db.prepare(`
        INSERT INTO platform_admin_audit_logs (
          id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
        ) VALUES (?, ?, ?, 'SELF_REGISTRATION', ?, ?, ?, ?, ?)
      `).run(
        `paud-${crypto.randomUUID().slice(0, 8)}`,
        ownerUserId,
        finalUsername,
        org.id,
        org.name,
        `New tenant self-registration for ${org.code}. Awaiting payment confirmation.`,
        JSON.stringify({ planId: org.planId, ownerUsername: finalUsername, selectedPlan: body.selectedPlan }),
        nowIso,
      )

      res.status(201).json({
        organization: org,
        ownerCredentials: {
          username: finalUsername,
          temporaryPassword,
          passwordChangeRequired: true,
        },
        paymentRequired: true,
        message: 'Account created successfully. Please complete your subscription payment.',
      })
    },
  )

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
          const userCountRow = db
            .prepare('SELECT COUNT(*) AS count FROM users WHERE organization_id = ?')
            .get(org.id) as { count: number }
          const counts = getOrgOperationalCounts(db, org.id)

          return {
            ...org,
            totalVehicles: counts.totalVehicles,
            totalDrivers: counts.totalDrivers,
            openWorkOrders: counts.openWorkOrders,
            monthlyRevenueInr: counts.monthlyRevenueInr,
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
      saveOrgFleetDataset(db, org.id, emptyBlob, true)
      seedOrgFleetModules(db, org, [])

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
      const data = getOrgFleetDataset(db, org.id)
      const modules = getOrgFleetModules(db, org.id)
      const blobRow = db
        .prepare('SELECT updated_at FROM org_fleet_blobs WHERE organization_id = ?')
        .get(org.id) as { updated_at: string } | undefined

      res.json({
        organization: org,
        role: req.authUser!.role,
        updatedAt: blobRow?.updated_at ?? new Date().toISOString(),
        data,
        modules,
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
      const updatedAt = saveOrgFleetDataset(db, org.id, body.data, true)
      res.json({ ok: true, updatedAt })
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
      const memberId = `mem-${crypto.randomUUID().slice(0, 8)}`
      const nowIso = new Date().toISOString()

      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          password_change_required, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'active', ?)
      `).run(userId, username, body.email.trim().toLowerCase(), body.fullName.trim(), hashPassword(tempPassword), role, org.id, nowIso)

      db.prepare(`
        INSERT INTO org_members (id, organization_id, user_id, username, full_name, email, role, status, last_active_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(memberId, org.id, userId, username, body.fullName.trim(), body.email.trim().toLowerCase(), role, nowIso)

      res.status(201).json({
        member: {
          id: memberId,
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

  // ===================== FLEETIO EXTENSION MODULES =====================
  router.get(
    '/fleet/modules',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const modules = getOrgFleetModules(getDb(), req.activeOrg!.id)
      res.json(modules)
    },
  )

  router.post(
    '/fleet/modules/tools',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('manage_inventory'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as Partial<FleetToolItem>
      if (!body.name?.trim() || !body.serialNumber?.trim()) {
        res.status(400).json({ error: 'Tool name and serial number are required.' })
        return
      }
      const created = insertFleetTool(getDb(), req.activeOrg!.id, {
        name: body.name.trim(),
        serialNumber: body.serialNumber.trim().toUpperCase(),
        category: body.category?.trim() || 'Workshop Diagnostics',
        assignedTo: body.assignedTo?.trim() || 'Workshop Bay 1',
        location: body.location?.trim() || `${req.activeOrg!.city} Main Depot`,
        status: body.status ?? 'in_service',
        purchaseCostInr: Number(body.purchaseCostInr) || 0,
        nextCalibrationDate: body.nextCalibrationDate || '2027-06-30',
      })
      res.status(201).json({ tool: created })
    },
  )

  router.patch(
    '/fleet/modules/tools/:toolId',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('manage_inventory'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { status?: FleetToolItem['status'] }
      if (!body.status) {
        res.status(400).json({ error: 'Tool status is required.' })
        return
      }
      const ok = updateFleetToolStatus(getDb(), req.activeOrg!.id, String(req.params.toolId), body.status)
      if (!ok) {
        res.status(404).json({ error: 'Tool not found.' })
        return
      }
      res.json({ ok: true })
    },
  )

  router.post(
    '/fleet/modules/warranties',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('edit_vehicle'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        vehicleId?: string
        assetName?: string
        registrationNumber?: string
        provider?: string
        coverageType?: 'Powertrain' | 'Battery / EV Pack' | 'Chassis & Axle' | 'Tyre Casing' | 'Component'
        startDate?: string
        expiryDate?: string
        maxOdometerKm?: number
      }
      if (!body.registrationNumber?.trim() || !body.provider?.trim()) {
        res.status(400).json({ error: 'Registration number and warranty provider are required.' })
        return
      }
      const created = insertFleetWarranty(getDb(), req.activeOrg!.id, {
        vehicleId: body.vehicleId,
        assetName: body.assetName?.trim() || 'Commercial Asset',
        registrationNumber: body.registrationNumber.trim(),
        provider: body.provider.trim(),
        coverageType: body.coverageType ?? 'Powertrain',
        startDate: body.startDate || new Date().toISOString().slice(0, 10),
        expiryDate: body.expiryDate || '2029-03-31',
        maxOdometerKm: Number(body.maxOdometerKm) || 300000,
        claimStatus: 'active',
      })
      res.status(201).json({ warranty: created })
    },
  )

  router.post(
    '/fleet/modules/custom-records',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('edit_vehicle'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        recordType?: 'Toll & FASTag Audit' | 'RTO Permit Log' | 'Cold-Chain Temp Audit' | 'Driver Uniform & Kit'
        vehicleOrDriver?: string
        referenceCode?: string
        recordedDate?: string
        amountInr?: number
        notes?: string
      }
      if (!body.referenceCode?.trim()) {
        res.status(400).json({ error: 'Reference code is required.' })
        return
      }
      const created = insertCustomRecord(getDb(), req.activeOrg!.id, {
        recordType: body.recordType ?? 'Toll & FASTag Audit',
        vehicleOrDriver: body.vehicleOrDriver?.trim() || 'Fleet Asset',
        referenceCode: body.referenceCode.trim().toUpperCase(),
        recordedDate: body.recordedDate || new Date().toISOString().slice(0, 10),
        amountInr: Number(body.amountInr) || 0,
        status: 'verified',
        notes: body.notes?.trim() || 'Recorded via Custom Records module.',
      })
      res.status(201).json({ customRecord: created })
    },
  )

  router.post(
    '/fleet/modules/service-tasks',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('schedule_maintenance'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { code?: string; title?: string; area?: string; avgHours?: number; estCostInr?: number }
      if (!body.code?.trim() || !body.title?.trim()) {
        res.status(400).json({ error: 'Task code and title are required.' })
        return
      }
      const created = insertServiceTask(getDb(), req.activeOrg!.id, {
        code: body.code.trim().toUpperCase(),
        title: body.title.trim(),
        area: (body.area as 'Vehicle Health') || 'Vehicle Health',
        avgHours: Number(body.avgHours) || 1.5,
        estCostInr: Number(body.estCostInr) || 2500,
        active: true,
      })
      res.status(201).json({ serviceTask: created })
    },
  )

  router.post(
    '/fleet/modules/service-programs',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('schedule_maintenance'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { name?: string; powertrain?: 'ICE' | 'EV' | 'All'; cadence?: string; intervalKm?: number; intervalDays?: number }
      if (!body.name?.trim()) {
        res.status(400).json({ error: 'Program name is required.' })
        return
      }
      const intervalKm = Number(body.intervalKm) || 10000
      const intervalDays = Number(body.intervalDays) || 90
      const created = insertServiceProgram(getDb(), req.activeOrg!.id, {
        name: body.name.trim(),
        powertrain: body.powertrain ?? 'All',
        cadence: body.cadence?.trim() || `Every ${intervalKm.toLocaleString('en-IN')} km or ${intervalDays} days`,
        intervalKm,
        intervalDays,
        active: true,
      })
      res.status(201).json({ serviceProgram: created })
    },
  )

  router.post(
    '/fleet/modules/inspection-forms',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('schedule_maintenance'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { title?: string; itemsCount?: number; checklistItems?: string[] }
      if (!body.title?.trim()) {
        res.status(400).json({ error: 'Inspection form title is required.' })
        return
      }
      const created = insertInspectionForm(getDb(), req.activeOrg!.id, {
        title: body.title.trim(),
        itemsCount: Number(body.itemsCount) || body.checklistItems?.length || 12,
        lastUpdated: new Date().toISOString().slice(0, 10),
        active: true,
        checklistItems: body.checklistItems,
      })
      res.status(201).json({ inspectionForm: created })
    },
  )

  router.post(
    '/fleet/modules/inspection-schedules',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('schedule_maintenance'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { name?: string; frequency?: string; scope?: string; formId?: string; formTitle?: string }
      if (!body.name?.trim() || !body.frequency?.trim()) {
        res.status(400).json({ error: 'Schedule name and frequency are required.' })
        return
      }
      const created = insertInspectionSchedule(getDb(), req.activeOrg!.id, {
        name: body.name.trim(),
        frequency: body.frequency.trim(),
        scope: body.scope?.trim() || 'All Active Vehicles',
        formId: body.formId,
        formTitle: body.formTitle?.trim() || 'Commercial DVIR Pre-Trip Standard',
        active: true,
      })
      res.status(201).json({ inspectionSchedule: created })
    },
  )

  router.post(
    '/fleet/modules/recalls',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('report_issue'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as Partial<FleetRecallItem>
      if (!body.campaign?.trim() || !body.oem?.trim()) {
        res.status(400).json({ error: 'Recall campaign and OEM are required.' })
        return
      }
      const created = insertFleetRecall(getDb(), req.activeOrg!.id, {
        campaign: body.campaign.trim(),
        oem: body.oem.trim(),
        targetMake: (body.targetMake || body.oem).trim().toLowerCase(),
        severity: body.severity ?? 'high',
        status: body.status ?? 'Monitoring',
        notes: body.notes?.trim(),
        issuedDate: body.issuedDate || new Date().toISOString().slice(0, 10),
      })
      res.status(201).json({ recall: created })
    },
  )

  router.patch(
    '/fleet/modules/recalls/:recallId',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('report_issue'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { status?: FleetRecallItem['status'] }
      if (!body.status) {
        res.status(400).json({ error: 'Recall status is required.' })
        return
      }
      const ok = updateFleetRecallStatus(getDb(), req.activeOrg!.id, String(req.params.recallId), body.status)
      if (!ok) {
        res.status(404).json({ error: 'Recall notice not found.' })
        return
      }
      res.json({ ok: true })
    },
  )

  router.post(
    '/fleet/modules/api-keys',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('update_org_settings'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { label?: string; scope?: 'read_only' | 'read_write' | 'telematics_ingest' }
      if (!body.label?.trim()) {
        res.status(400).json({ error: 'API key label is required.' })
        return
      }
      const rand = crypto.randomBytes(2).toString('hex')
      const created = insertApiKey(getDb(), req.activeOrg!.id, {
        label: body.label.trim(),
        prefix: `dm_live_${rand}••••9f2e`,
        scope: body.scope ?? 'read_only',
        createdAt: new Date().toISOString(),
        lastUsedAt: 'Never',
      })
      res.status(201).json({ apiKey: created })
    },
  )

  router.delete(
    '/fleet/modules/api-keys/:keyId',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('update_org_settings'),
    (req: AuthenticatedRequest, res: Response) => {
      const ok = deleteApiKey(getDb(), req.activeOrg!.id, String(req.params.keyId))
      if (!ok) {
        res.status(404).json({ error: 'API key not found.' })
        return
      }
      res.json({ ok: true })
    },
  )

  router.post(
    '/fleet/modules/webhooks',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('update_org_settings'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { url?: string; events?: string[] }
      if (!body.url?.trim().startsWith('http')) {
        res.status(400).json({ error: 'A valid http/https webhook URL is required.' })
        return
      }
      const created = insertWebhook(getDb(), req.activeOrg!.id, {
        url: body.url.trim(),
        events: Array.isArray(body.events) && body.events.length > 0 ? body.events : ['vehicle.alert', 'work_order.updated'],
        active: true,
        lastDeliveryStatus: 200,
      })
      res.status(201).json({ webhook: created })
    },
  )

  router.patch(
    '/fleet/modules/webhooks/:webhookId',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('update_org_settings'),
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { active?: boolean }
      if (typeof body.active !== 'boolean') {
        res.status(400).json({ error: 'Boolean active state is required.' })
        return
      }
      const ok = toggleWebhookActive(getDb(), req.activeOrg!.id, String(req.params.webhookId), body.active)
      if (!ok) {
        res.status(404).json({ error: 'Webhook endpoint not found.' })
        return
      }
      res.json({ ok: true })
    },
  )

  router.post(
    '/fleet/modules/custom-dashboards',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { name?: string; widgets?: string }
      if (!body.name?.trim()) {
        res.status(400).json({ error: 'Dashboard layout name is required.' })
        return
      }
      const created = insertCustomDashboard(getDb(), req.activeOrg!.id, {
        name: body.name.trim(),
        widgets: body.widgets?.trim() || 'Fleet KPI Summary, Alerts Feed',
        defaultView: false,
      })
      res.status(201).json({ customDashboard: created })
    },
  )

  router.put(
    '/fleet/modules/settings',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        workspaceSettings?: Record<string, unknown>
        fleetioSettings?: Record<string, unknown>
        visitedIntegrations?: boolean
        visitedReports?: boolean
      }
      const updated = updateFleetWorkspaceSettings(getDb(), req.activeOrg!.id, body)
      res.json(updated)
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

  // ===================== VEHICLE FINANCE MANAGEMENT =====================
  const actorOf = (req: AuthenticatedRequest): FinanceActor => ({
    userId: req.authUser!.id,
    username: req.authUser!.username,
    fullName: req.authUser!.fullName,
    role: req.authUser!.role,
  })

  router.get(
    '/finance/workspace',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('view_finance'),
    (req: AuthenticatedRequest, res: Response) => {
      const workspace = getFinanceWorkspace(
        getDb(),
        req.activeOrg!.id,
        req.authUser!.role,
        req.activeOrg!.timezone,
      )
      res.json(workspace)
    },
  )

  router.post(
    '/finance/institutions',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('manage_bank_details'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const institution = upsertInstitution(getDb(), req.activeOrg!.id, actorOf(req), req.body)
        res.status(201).json({ institution })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to save financial institution.' })
      }
    },
  )

  router.patch(
    '/finance/institutions/:instId',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('manage_bank_details'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const institution = upsertInstitution(getDb(), req.activeOrg!.id, actorOf(req), {
          ...req.body,
          id: String(req.params.instId),
        })
        res.json({ institution })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update financial institution.' })
      }
    },
  )

  router.post(
    '/finance/records',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('add_finance_records'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const created = createVehicleFinanceRecord(getDb(), req.activeOrg!.id, actorOf(req), req.body)
        res.status(201).json(created)
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to create vehicle finance record.' })
      }
    },
  )

  router.post(
    '/finance/records/:financeId/update-terms',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('edit_finance_records'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const record = updateVehicleFinanceTerms(
          getDb(),
          req.activeOrg!.id,
          String(req.params.financeId),
          actorOf(req),
          req.body,
        )
        res.json({ record })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update loan terms.' })
      }
    },
  )

  router.post(
    '/finance/emis/:emiId/pay',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('record_finance_payments'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = recordEmiPayment(
          getDb(),
          req.activeOrg!.id,
          String(req.params.emiId),
          actorOf(req),
          req.body,
        )
        res.status(201).json(result)
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to record EMI payment.' })
      }
    },
  )

  router.post(
    '/finance/emis/:emiId/status',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('edit_finance_records'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const instalment = updateEmiStatusOrLateFee(
          getDb(),
          req.activeOrg!.id,
          String(req.params.emiId),
          actorOf(req),
          req.body,
        )
        res.json({ instalment })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to update EMI status.' })
      }
    },
  )

  router.post(
    '/finance/payments/:paymentId/reconcile',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('reconcile_finance_payments'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const payment = reconcileFinancePayment(
          getDb(),
          req.activeOrg!.id,
          String(req.params.paymentId),
          actorOf(req),
          req.body?.status ?? 'reconciled',
          req.body?.notes,
        )
        res.json({ payment })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to reconcile payment.' })
      }
    },
  )

  router.post(
    '/finance/payments/:paymentId/correct',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('reconcile_finance_payments'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const payment = correctFinancePayment(
          getDb(),
          req.activeOrg!.id,
          String(req.params.paymentId),
          actorOf(req),
          req.body,
        )
        res.json({ payment })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to correct payment.' })
      }
    },
  )

  router.post(
    '/finance/documents',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('add_finance_records'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const document = uploadFinanceDocument(getDb(), req.activeOrg!.id, actorOf(req), req.body)
        res.status(201).json({ document })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to upload finance document.' })
      }
    },
  )

  router.post(
    '/finance/documents/:docId/verify',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('reconcile_finance_payments'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const document = verifyFinanceDocument(
          getDb(),
          req.activeOrg!.id,
          String(req.params.docId),
          actorOf(req),
          req.body?.status ?? 'verified',
          req.body?.notes,
        )
        res.json({ document })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to verify finance document.' })
      }
    },
  )

  router.get(
    '/finance/documents/:docId/download',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('view_finance'),
    (req: AuthenticatedRequest, res: Response) => {
      const org = req.activeOrg!
      const docId = String(req.params.docId)
      const row = getDb()
        .prepare('SELECT * FROM finance_documents WHERE id = ? AND organization_id = ?')
        .get(docId, org.id) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Finance document not found in your organization.' })
        return
      }
      const storageKey = String(row.storage_key)
      if (storageKey.startsWith('seed/')) {
        const summaryText = [
          'DRIVEMITRA VEHICLE FINANCE DOCUMENT RECORD',
          `Title: ${String(row.title)}`,
          `Category: ${String(row.category)}`,
          `File: ${String(row.file_name)}`,
          `Verification: ${String(row.verification_status)}`,
          `Uploaded By: ${String(row.uploaded_by)} on ${String(row.uploaded_at)}`,
        ].join('\n')
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name)}.txt"`)
        res.send(summaryText)
        return
      }
      const absPath = path.join(getUploadsDir(), storageKey)
      if (!fs.existsSync(absPath)) {
        res.status(404).json({ error: 'Stored finance document file is unavailable on disk.' })
        return
      }
      res.setHeader('Content-Type', String(row.mime_type))
      res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name)}"`)
      res.sendFile(absPath)
    },
  )

  router.put(
    '/finance/settings',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('manage_finance_settings'),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const settings = updateFinanceSettings(
          getDb(),
          req.activeOrg!.id,
          actorOf(req),
          req.body?.settings ?? req.body,
          req.body?.reason,
        )
        res.json({ settings })
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to save finance settings.' })
      }
    },
  )

  router.post(
    '/finance/alerts/evaluate',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('view_finance'),
    (req: AuthenticatedRequest, res: Response) => {
      const alerts = syncFinanceAlertsInDb(getDb(), req.activeOrg!.id, req.activeOrg!.timezone)
      res.json({ alerts })
    },
  )

  router.patch(
    '/finance/alerts/:alertId/ack',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireFleetAction('acknowledge_alert'),
    (req: AuthenticatedRequest, res: Response) => {
      ackFinanceAlert(
        getDb(),
        req.activeOrg!.id,
        String(req.params.alertId),
        req.body?.mode ?? 'ack',
      )
      res.json({ ok: true })
    },
  )

  return router
}
