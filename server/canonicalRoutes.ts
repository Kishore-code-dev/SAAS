import crypto from 'node:crypto'
import express, { type Response, type Router } from 'express'
import type {
  DriverExpenseCategory,
  DriverExpenseStatus,
  StaffPermissionMatrix,
  SubscriptionPaymentStatus,
} from '../src/types/fleet.ts'
import {
  DEFAULT_STAFF_PERMISSION_MATRIX,
  normalizeStaffPermissions,
} from '../src/utils/staffPermissions.ts'
import {
  formatCookieHeader,
  generateOpaqueToken,
  generateTemporaryPassword,
  hashPassword,
  hashToken,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  validatePasswordStrength,
} from './authLogic.ts'
import {
  loadOrgSubscription,
  recordStaffActivity,
  requireActiveOrganization,
  requireAuth,
  requireDriverRole,
  requireModulePermission,
  requirePaidActiveSubscription,
  requirePasswordChanged,
  requirePlatformAdmin,
  type AuthenticatedRequest,
} from './authMiddleware.ts'
import { getDb, mapOrgRow, mapSaasInvoiceRow } from './db.ts'
import { getOrgFleetDataset, saveOrgFleetDataset } from './fleetDb.ts'
import {
  emitNotification,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications.ts'
import {
  CANONICAL_SUBSCRIPTION_PLANS,
  UNLIMITED_SEAT_CAP,
  addBillingPeriod,
  computeCheckoutTotals,
  normalizePlanId,
  validateDriverOdometerAndDistance,
  verifyPaymentAttempt,
} from './subscriptionEngine.ts'

const ALLOWED_EXPENSE_CATEGORIES: DriverExpenseCategory[] = [
  'Fuel',
  'Toll',
  'Parking',
  'Repairs',
  'Loading and Unloading',
  'Other Approved Expenses',
]

function syncDriverDatasetToRelationalAndBlob(
  orgId: string,
  mutator: (dataset: ReturnType<typeof getOrgFleetDataset>) => void,
): ReturnType<typeof getOrgFleetDataset> {
  const db = getDb()
  const ds = getOrgFleetDataset(db, orgId)
  mutator(ds)
  saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)
  return ds
}

export function buildCanonicalRouter(): Router {
  const router = express.Router()

  // ===================== NOTIFICATIONS =====================
  router.get('/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb()
    const unreadOnly = req.query.unreadOnly === 'true'
    const items = listNotificationsForUser(db, req.authUser!, { unreadOnly, limit: 80 })
    const unreadCount = items.filter((i) => !i.isRead).length
    res.json({ notifications: items, unreadCount })
  })

  router.patch('/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const ok = markNotificationRead(getDb(), String(req.params.id), req.authUser!)
    if (!ok) {
      res.status(404).json({ error: 'Notification not found or access denied.' })
      return
    }
    res.json({ ok: true })
  })

  router.post('/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const updated = markAllNotificationsRead(getDb(), req.authUser!)
    res.json({ ok: true, updated })
  })

  // ===================== ONBOARDING WIZARD (MANDATORY 1 STAFF RULE) =====================
  router.get(
    '/onboarding/state',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const staffRows = db
        .prepare('SELECT * FROM staff_profiles WHERE organization_id = ? ORDER BY created_at ASC')
        .all(org.id) as Array<Record<string, unknown>>
      const pendingInvites = db
        .prepare("SELECT * FROM invitations WHERE organization_id = ? AND target_type = 'staff'")
        .all(org.id) as Array<Record<string, unknown>>
      const ds = getOrgFleetDataset(db, org.id)
      const subInfo = loadOrgSubscription(org.id, org)

      const staffProfiles = staffRows.map((r) => ({
        id: String(r.id),
        organizationId: String(r.organization_id),
        userId: r.user_id ? String(r.user_id) : null,
        fullName: String(r.full_name),
        email: String(r.email),
        mobile: r.mobile ? String(r.mobile) : null,
        employeeCode: r.employee_code ? String(r.employee_code) : undefined,
        designation: String(r.designation),
        department: r.department ? String(r.department) : undefined,
        employmentStatus: String(r.employment_status),
        accountStatus: String(r.account_status),
        createdAt: String(r.created_at),
      }))

      // Critical Rule: Fleet Owner NEVER counts toward the mandatory >= 1 staff requirement
      const requiredStaffSatisfied = staffProfiles.length >= 1

      res.json({
        organization: org,
        onboardingCompleted: Boolean(org.onboardingCompleted),
        onboardingStep: org.onboardingStep ?? 1,
        staffProfiles,
        staffInvitationsCount: pendingInvites.length,
        requiredStaffSatisfied,
        driversCount: ds.drivers.length,
        subscription: subInfo.subscription,
        plans: CANONICAL_SUBSCRIPTION_PLANS,
      })
    },
  )

  router.patch(
    '/onboarding/organization',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owner can update organization onboarding details.' })
        return
      }
      const db = getDb()
      const org = req.activeOrg!
      const body = req.body as {
        name?: string
        businessType?: string
        city?: string
        state?: string
        gstin?: string
        ownerPhone?: string
      }

      const nextName = typeof body.name === 'string' && body.name.trim().length >= 2 ? body.name.trim() : org.name
      const nextBiz = typeof body.businessType === 'string' && body.businessType.trim() ? body.businessType.trim() : (org.businessType ?? 'Transport')
      const nextCity = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : org.city
      const nextState = typeof body.state === 'string' && body.state.trim() ? body.state.trim() : org.state
      const nextGstin = typeof body.gstin === 'string' ? (body.gstin.trim().toUpperCase() || null) : (org.gstin ?? null)
      const nextPhone = typeof body.ownerPhone === 'string' ? (body.ownerPhone.trim() || null) : (org.ownerPhone ?? null)

      const nextStep = Math.max(2, org.onboardingStep ?? 1)
      db.prepare(`
        UPDATE organizations
        SET name = ?, business_type = ?, city = ?, state = ?, gstin = ?, owner_phone = ?, onboarding_step = ?
        WHERE id = ?
      `).run(nextName, nextBiz, nextCity, nextState, nextGstin, nextPhone, nextStep, org.id)

      const updatedOrg = mapOrgRow(
        db.prepare('SELECT * FROM organizations WHERE id = ?').get(org.id) as Record<string, unknown>,
      )
      res.json({ organization: updatedOrg, onboardingStep: nextStep })
    },
  )

  router.post(
    '/onboarding/staff',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owner can add mandatory onboarding staff.' })
        return
      }
      const db = getDb()
      const org = req.activeOrg!
      const body = req.body as {
        fullName?: string
        email?: string
        mobile?: string
        designation?: string
        department?: string
        sendInvite?: boolean
        permissions?: StaffPermissionMatrix
      }

      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : ''
      const designation = typeof body.designation === 'string' && body.designation.trim() ? body.designation.trim() : 'Operations Coordinator'
      const department = typeof body.department === 'string' && body.department.trim() ? body.department.trim() : 'Operations'

      if (fullName.length < 2 || !email.includes('@')) {
        res.status(400).json({ error: 'Staff full name and valid email address are required.' })
        return
      }

      // Guardrail: owner email cannot be reused as the required staff member
      if (email === req.authUser!.email.toLowerCase()) {
        res.status(400).json({
          error: 'Fleet Owner cannot be added as the required staff member. Add a distinct staff team member.',
        })
        return
      }

      const nowIso = new Date().toISOString()
      const staffId = `stf-${crypto.randomUUID().slice(0, 8)}`
      const empCode = `STF-${Math.floor(1000 + Math.random() * 8999)}`
      const sendInvite = body.sendInvite !== false
      const accountStatus = sendInvite ? 'invitation_pending' : 'draft'
      const perms = body.permissions ? normalizeStaffPermissions(body.permissions) : DEFAULT_STAFF_PERMISSION_MATRIX

      db.prepare(`
        INSERT INTO staff_profiles (
          id, organization_id, user_id, full_name, email, mobile, employee_code,
          designation, department, employment_status, account_status, created_by, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(
        staffId,
        org.id,
        fullName,
        email,
        mobile || null,
        empCode,
        designation,
        department,
        accountStatus,
        req.authUser!.id,
        nowIso,
        nowIso,
      )

      let invitation: Record<string, unknown> | null = null
      if (sendInvite) {
        const rawToken = generateOpaqueToken(20)
        const tokenHash = hashToken(rawToken)
        const inviteId = `inv-${crypto.randomUUID().slice(0, 8)}`
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString()
        db.prepare(`
          INSERT INTO invitations (
            id, organization_id, target_type, target_record_id, email, mobile, full_name,
            role, token_hash, raw_token_preview, status, permissions_json, invited_by, expires_at, created_at
          ) VALUES (?, ?, 'staff', ?, ?, ?, ?, 'fleet_staff', ?, ?, 'pending', ?, ?, ?, ?)
        `).run(
          inviteId,
          org.id,
          staffId,
          email,
          mobile || null,
          fullName,
          tokenHash,
          rawToken,
          JSON.stringify(perms),
          req.authUser!.id,
          expiresAt,
          nowIso,
        )
        invitation = {
          id: inviteId,
          status: 'Staff Invitation Pending',
          inviteToken: rawToken,
          inviteUrl: `/invite/${rawToken}`,
          expiresAt,
        }
      }

      const nextStep = Math.max(3, org.onboardingStep ?? 2)
      db.prepare('UPDATE organizations SET onboarding_step = ? WHERE id = ?').run(nextStep, org.id)

      recordStaffActivity(req, {
        action: 'CREATE_ONBOARDING_STAFF',
        module: 'staff',
        recordId: staffId,
        newValue: { fullName, email, designation, accountStatus },
      })

      res.status(201).json({
        staffProfile: {
          id: staffId,
          organizationId: org.id,
          userId: null,
          fullName,
          email,
          mobile: mobile || null,
          employeeCode: empCode,
          designation,
          department,
          employmentStatus: 'active',
          accountStatus,
          createdAt: nowIso,
        },
        invitation,
        requiredStaffSatisfied: true,
        onboardingStep: nextStep,
      })
    },
  )

  router.post(
    '/onboarding/drivers',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owner can add drivers during onboarding.' })
        return
      }
      const org = req.activeOrg!
      const body = req.body as {
        skip?: boolean
        name?: string
        mobile?: string
        email?: string
        licenseNumber?: string
        licenseExpiry?: string
      }

      const db = getDb()
      if (body.skip) {
        const nextStep = Math.max(4, org.onboardingStep ?? 3)
        db.prepare('UPDATE organizations SET onboarding_step = ? WHERE id = ?').run(nextStep, org.id)
        res.json({ skipped: true, onboardingStep: nextStep })
        return
      }

      const name = typeof body.name === 'string' ? body.name.trim() : ''
      const mobile = typeof body.mobile === 'string' ? body.mobile.trim() : ''
      const licenseNumber = typeof body.licenseNumber === 'string' ? body.licenseNumber.trim().toUpperCase() : ''
      if (name.length < 2 || !mobile || !licenseNumber) {
        res.status(400).json({ error: 'Driver name, mobile number, and license number are required (or choose Skip).' })
        return
      }

      const driverId = `drv-${crypto.randomUUID().slice(0, 8)}`
      syncDriverDatasetToRelationalAndBlob(org.id, (ds) => {
        ds.drivers.push({
          id: driverId,
          organizationId: org.id,
          environment: 'production',
          name,
          mobile,
          email: body.email?.trim().toLowerCase() || `${driverId}@drivers.local`,
          licenseNumber,
          licenseExpiry: body.licenseExpiry || '2029-12-31',
          city: org.city,
          state: org.state,
          operationalStatus: 'active',
          status: 'available',
          safetyScore: 95,
          speedingScore: 95,
          brakingScore: 95,
          accelerationScore: 95,
          corneringScore: 95,
          fatigueComplianceScore: 95,
          totalTrips: 0,
          totalDistanceKm: 0,
          joinDate: new Date().toISOString().slice(0, 10),
          coachingRecommendations: [],
          dataConfidenceNote: 'Onboarding baseline',
          assignedVehicleId: null,
        })
      })

      const nextStep = Math.max(4, org.onboardingStep ?? 3)
      db.prepare('UPDATE organizations SET onboarding_step = ? WHERE id = ?').run(nextStep, org.id)
      res.status(201).json({ driverId, name, licenseNumber, onboardingStep: nextStep })
    },
  )

  // ===================== INVITATION INSPECTION & ACCEPTANCE (STAFF OR DRIVER) =====================
  router.get('/invitations/:token', (req, res: Response) => {
    const rawToken = String(req.params.token || '').trim()
    if (!rawToken) {
      res.status(400).json({ error: 'Invitation token is required.' })
      return
    }
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM invitations WHERE token_hash = ?')
      .get(hashToken(rawToken)) as Record<string, unknown> | undefined

    if (!row) {
      res.status(404).json({ error: 'Invitation link is invalid or has been revoked.' })
      return
    }
    const orgRow = db
      .prepare('SELECT id, name, code, city, state FROM organizations WHERE id = ?')
      .get(String(row.organization_id)) as Record<string, unknown> | undefined

    res.json({
      invitation: {
        id: String(row.id),
        targetType: String(row.target_type),
        fullName: String(row.full_name),
        email: String(row.email),
        mobile: row.mobile ? String(row.mobile) : null,
        role: String(row.role),
        status: String(row.status),
        expiresAt: String(row.expires_at),
        organizationName: orgRow ? String(orgRow.name) : 'DriveMitra Fleet',
        organizationCode: orgRow ? String(orgRow.code) : '',
      },
    })
  })

  router.post('/invitations/:token/accept', (req, res: Response) => {
    const rawToken = String(req.params.token || '').trim()
    const body = req.body as { username?: string; password?: string; fullName?: string }
    const password = typeof body.password === 'string' ? body.password : ''
    const strengthErr = validatePasswordStrength(password)
    if (strengthErr) {
      res.status(400).json({ error: strengthErr })
      return
    }

    const db = getDb()
    const inv = db
      .prepare('SELECT * FROM invitations WHERE token_hash = ?')
      .get(hashToken(rawToken)) as Record<string, unknown> | undefined

    if (!inv) {
      res.status(404).json({ error: 'Invitation link is invalid.' })
      return
    }
    if (String(inv.status) !== 'pending') {
      res.status(400).json({ error: `This invitation is already ${String(inv.status)}.` })
      return
    }
    if (new Date(String(inv.expires_at)).getTime() <= Date.now()) {
      db.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").run(String(inv.id))
      res.status(400).json({ error: 'Invitation link has expired. Ask your Fleet Owner to resend it.' })
      return
    }

    const orgId = String(inv.organization_id)
    const targetType = String(inv.target_type)
    const targetRecordId = String(inv.target_record_id)
    const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim() : String(inv.full_name)
    const email = String(inv.email).toLowerCase()
    const requestedUsername =
      typeof body.username === 'string' && body.username.trim().length >= 3
        ? body.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
        : email.split('@')[0].replace(/[^a-z0-9.]/g, '')

    const existingUsername = db
      .prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?')
      .get(requestedUsername, email) as { id?: string } | undefined

    const username = existingUsername?.id
      ? `${requestedUsername}.${Math.floor(10 + Math.random() * 89)}`
      : requestedUsername

    const userId = `u-${crypto.randomUUID().slice(0, 8)}`
    const nowIso = new Date().toISOString()

    if (targetType === 'driver') {
      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          driver_id, mobile, staff_profile_id, password_change_required, status, created_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, 'driver', ?, ?, ?, NULL, 0, 'active', ?, ?)
      `).run(
        userId,
        username,
        email,
        fullName,
        hashPassword(password),
        orgId,
        targetRecordId,
        inv.mobile ? String(inv.mobile) : null,
        nowIso,
        nowIso,
      )
    } else {
      db.prepare(`
        INSERT INTO users (
          id, username, email, full_name, password_hash, role, organization_id,
          driver_id, mobile, staff_profile_id, password_change_required, status, created_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, 'fleet_staff', ?, NULL, ?, ?, 0, 'active', ?, ?)
      `).run(
        userId,
        username,
        email,
        fullName,
        hashPassword(password),
        orgId,
        inv.mobile ? String(inv.mobile) : null,
        targetRecordId,
        nowIso,
        nowIso,
      )

      db.prepare(`
        UPDATE staff_profiles
        SET user_id = ?, account_status = 'active', updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(userId, nowIso, targetRecordId, orgId)

      const parsedPerms = inv.permissions_json
        ? normalizeStaffPermissions(JSON.parse(String(inv.permissions_json)))
        : DEFAULT_STAFF_PERMISSION_MATRIX

      db.prepare(`
        INSERT OR REPLACE INTO user_permissions (
          id, organization_id, user_id, staff_profile_id, permissions_json, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `prm-${userId}`,
        orgId,
        userId,
        targetRecordId,
        JSON.stringify(parsedPerms),
        String(inv.invited_by),
        nowIso,
      )
    }

    db.prepare("UPDATE invitations SET status = 'accepted', accepted_at = ? WHERE id = ?").run(nowIso, String(inv.id))

    emitNotification(db, {
      organizationId: orgId,
      recipientRole: 'org_admin',
      eventType: targetType === 'driver' ? 'DRIVER_INVITE_ACCEPTED' : 'STAFF_INVITE_ACCEPTED',
      title: `${fullName} accepted invitation`,
      message: `${fullName} (${username}) activated their ${targetType === 'driver' ? 'Driver Portal' : 'Fleet Staff'} account.`,
      module: targetType === 'driver' ? 'drivers' : 'staff',
      entityId: targetRecordId,
      actionUrl: targetType === 'driver' ? '/dashboard/drivers' : '/dashboard/staff',
      severity: 'success',
    })

    const rawSessionToken = generateOpaqueToken(32)
    db.prepare(`
      INSERT INTO auth_sessions (id, user_id, organization_id, token_hash, revoked, expires_at, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      orgId,
      hashToken(rawSessionToken),
      new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      nowIso,
    )

    res.setHeader(
      'Set-Cookie',
      formatCookieHeader(SESSION_COOKIE_NAME, rawSessionToken, Math.floor(SESSION_TTL_MS / 1000)),
    )
    res.status(201).json({
      ok: true,
      username,
      role: targetType === 'driver' ? 'driver' : 'fleet_staff',
      redirectTo: targetType === 'driver' ? '/driver' : '/dashboard',
    })
  })

  // ===================== STAFF DIRECTORY & 31-MODULE RBAC MATRIX =====================
  router.get(
    '/staff',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('staff', 'view'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const profiles = db
        .prepare('SELECT * FROM staff_profiles WHERE organization_id = ? ORDER BY created_at DESC')
        .all(orgId) as Array<Record<string, unknown>>
      const permsRows = db
        .prepare('SELECT * FROM user_permissions WHERE organization_id = ?')
        .all(orgId) as Array<Record<string, unknown>>
      const invRows = db
        .prepare("SELECT * FROM invitations WHERE organization_id = ? AND target_type = 'staff' ORDER BY created_at DESC")
        .all(orgId) as Array<Record<string, unknown>>
      const usersRows = db
        .prepare('SELECT id, username, role, status, last_login_at FROM users WHERE organization_id = ?')
        .all(orgId) as Array<Record<string, unknown>>
      const logs = db
        .prepare('SELECT * FROM staff_activity_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 80')
        .all(orgId) as Array<Record<string, unknown>>

      const permsByStaff = new Map<string, StaffPermissionMatrix>()
      const permsByUser = new Map<string, StaffPermissionMatrix>()
      for (const p of permsRows) {
        try {
          const norm = normalizeStaffPermissions(JSON.parse(String(p.permissions_json)))
          if (p.staff_profile_id) permsByStaff.set(String(p.staff_profile_id), norm)
          permsByUser.set(String(p.user_id), norm)
        } catch {
          // skip
        }
      }

      const usersById = new Map(usersRows.map((u) => [String(u.id), u]))
      const latestInviteByStaff = new Map<string, Record<string, unknown>>()
      for (const inv of invRows) {
        const key = String(inv.target_record_id)
        if (!latestInviteByStaff.has(key)) latestInviteByStaff.set(key, inv)
      }

      const staffList = profiles.map((p) => {
        const id = String(p.id)
        const userId = p.user_id ? String(p.user_id) : null
        const userRow = userId ? usersById.get(userId) : undefined
        const inv = latestInviteByStaff.get(id)
        const invPerms =
          inv?.permissions_json && typeof inv.permissions_json === 'string'
            ? normalizeStaffPermissions(JSON.parse(inv.permissions_json))
            : DEFAULT_STAFF_PERMISSION_MATRIX

        return {
          id,
          organizationId: orgId,
          userId,
          username: userRow ? String(userRow.username) : undefined,
          role: userRow ? String(userRow.role) : 'fleet_staff',
          lastLoginAt: userRow?.last_login_at ? String(userRow.last_login_at) : null,
          fullName: String(p.full_name),
          email: String(p.email),
          mobile: p.mobile ? String(p.mobile) : null,
          employeeCode: p.employee_code ? String(p.employee_code) : undefined,
          designation: String(p.designation),
          department: p.department ? String(p.department) : undefined,
          employmentStatus: String(p.employment_status),
          accountStatus: String(p.account_status),
          permissions:
            (userId && permsByUser.get(userId)) ||
            permsByStaff.get(id) ||
            invPerms,
          pendingInviteToken:
            inv && String(inv.status) === 'pending' && inv.raw_token_preview
              ? String(inv.raw_token_preview)
              : null,
          createdAt: String(p.created_at),
          updatedAt: String(p.updated_at),
        }
      })

      res.json({
        staff: staffList,
        activityLogs: logs.map((l) => ({
          id: String(l.id),
          organizationId: String(l.organization_id),
          staffUserId: String(l.staff_user_id),
          staffName: String(l.staff_name),
          action: String(l.action),
          module: String(l.module),
          recordId: l.record_id ? String(l.record_id) : null,
          previousValueJson: l.previous_value_json ? String(l.previous_value_json) : null,
          newValueJson: l.new_value_json ? String(l.new_value_json) : null,
          deviceInfo: l.device_info ? String(l.device_info) : undefined,
          timestamp: String(l.created_at),
        })),
      })
    },
  )

  router.post(
    '/staff',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requirePaidActiveSubscription(),
    requireModulePermission('staff', 'add'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const body = req.body as {
        fullName?: string
        email?: string
        mobile?: string
        designation?: string
        department?: string
        createCredentialsDirectly?: boolean
        sendInvite?: boolean
        permissions?: StaffPermissionMatrix
      }
      const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
      const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
      if (fullName.length < 2 || !email.includes('@')) {
        res.status(400).json({ error: 'Valid full name and work email are required.' })
        return
      }

      const nowIso = new Date().toISOString()
      const staffId = `stf-${crypto.randomUUID().slice(0, 8)}`
      const empCode = `STF-${Math.floor(1000 + Math.random() * 8999)}`
      const perms = body.permissions
        ? normalizeStaffPermissions(body.permissions)
        : DEFAULT_STAFF_PERMISSION_MATRIX

      let userId: string | null = null
      let temporaryCredentials: { username: string; temporaryPassword: string } | null = null
      let accountStatus: string = 'draft'
      let pendingInviteToken: string | null = null

      if (body.createCredentialsDirectly) {
        const baseUsername = email.split('@')[0].replace(/[^a-z0-9.]/g, '') || 'staff'
        const dupe = db.prepare('SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?').get(baseUsername, email)
        const username = dupe ? `${baseUsername}.${Math.floor(10 + Math.random() * 89)}` : baseUsername
        const tempPass = generateTemporaryPassword()
        userId = `u-${crypto.randomUUID().slice(0, 8)}`
        accountStatus = 'active'

        db.prepare(`
          INSERT INTO users (
            id, username, email, full_name, password_hash, role, organization_id,
            driver_id, mobile, staff_profile_id, password_change_required, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'fleet_staff', ?, NULL, ?, ?, 1, 'active', ?)
        `).run(
          userId,
          username,
          email,
          fullName,
          hashPassword(tempPass),
          org.id,
          body.mobile?.trim() || null,
          staffId,
          nowIso,
        )
        temporaryCredentials = { username, temporaryPassword: tempPass }
      }

      db.prepare(`
        INSERT INTO staff_profiles (
          id, organization_id, user_id, full_name, email, mobile, employee_code,
          designation, department, employment_status, account_status, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(
        staffId,
        org.id,
        userId,
        fullName,
        email,
        body.mobile?.trim() || null,
        empCode,
        body.designation?.trim() || 'Fleet Staff',
        body.department?.trim() || 'Operations',
        accountStatus,
        req.authUser!.id,
        nowIso,
        nowIso,
      )

      if (userId) {
        db.prepare(`
          INSERT INTO user_permissions (
            id, organization_id, user_id, staff_profile_id, permissions_json, updated_by, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`prm-${userId}`, org.id, userId, staffId, JSON.stringify(perms), req.authUser!.id, nowIso)
      } else if (body.sendInvite !== false) {
        const rawToken = generateOpaqueToken(20)
        pendingInviteToken = rawToken
        accountStatus = 'invitation_pending'
        db.prepare("UPDATE staff_profiles SET account_status = 'invitation_pending' WHERE id = ?").run(staffId)
        db.prepare(`
          INSERT INTO invitations (
            id, organization_id, target_type, target_record_id, email, mobile, full_name,
            role, token_hash, raw_token_preview, status, permissions_json, invited_by, expires_at, created_at
          ) VALUES (?, ?, 'staff', ?, ?, ?, ?, 'fleet_staff', ?, ?, 'pending', ?, ?, ?, ?)
        `).run(
          `inv-${crypto.randomUUID().slice(0, 8)}`,
          org.id,
          staffId,
          email,
          body.mobile?.trim() || null,
          fullName,
          hashToken(rawToken),
          rawToken,
          JSON.stringify(perms),
          req.authUser!.id,
          new Date(Date.now() + 7 * 86400000).toISOString(),
          nowIso,
        )
      }

      recordStaffActivity(req, {
        action: 'CREATE_STAFF',
        module: 'staff',
        recordId: staffId,
        newValue: { fullName, email, accountStatus },
      })

      res.status(201).json({
        staff: {
          id: staffId,
          organizationId: org.id,
          userId,
          fullName,
          email,
          mobile: body.mobile?.trim() || null,
          employeeCode: empCode,
          designation: body.designation?.trim() || 'Fleet Staff',
          department: body.department?.trim() || 'Operations',
          employmentStatus: 'active',
          accountStatus,
          permissions: perms,
          pendingInviteToken,
          createdAt: nowIso,
        },
        temporaryCredentials,
      })
    },
  )

  router.post(
    '/staff/:staffId/invite',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('staff', 'manage'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const staffId = String(req.params.staffId)
      const row = db
        .prepare('SELECT * FROM staff_profiles WHERE id = ? AND organization_id = ?')
        .get(staffId, org.id) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Staff profile not found.' })
        return
      }
      if (row.user_id) {
        res.status(400).json({ error: 'Staff member already has an active login account.' })
        return
      }

      const rawToken = generateOpaqueToken(20)
      const nowIso = new Date().toISOString()
      db.prepare("UPDATE invitations SET status = 'revoked' WHERE organization_id = ? AND target_record_id = ? AND status = 'pending'").run(
        org.id,
        staffId,
      )
      db.prepare(`
        INSERT INTO invitations (
          id, organization_id, target_type, target_record_id, email, mobile, full_name,
          role, token_hash, raw_token_preview, status, permissions_json, invited_by, expires_at, created_at
        ) VALUES (?, ?, 'staff', ?, ?, ?, ?, 'fleet_staff', ?, ?, 'pending', ?, ?, ?, ?)
      `).run(
        `inv-${crypto.randomUUID().slice(0, 8)}`,
        org.id,
        staffId,
        String(row.email),
        row.mobile ? String(row.mobile) : null,
        String(row.full_name),
        hashToken(rawToken),
        rawToken,
        JSON.stringify(DEFAULT_STAFF_PERMISSION_MATRIX),
        req.authUser!.id,
        new Date(Date.now() + 7 * 86400000).toISOString(),
        nowIso,
      )
      db.prepare("UPDATE staff_profiles SET account_status = 'invitation_pending', updated_at = ? WHERE id = ?").run(nowIso, staffId)

      res.json({
        ok: true,
        inviteToken: rawToken,
        inviteUrl: `/invite/${rawToken}`,
        accountStatus: 'invitation_pending',
      })
    },
  )

  router.put(
    '/staff/:staffId/permissions',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('staff', 'manage'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const staffId = String(req.params.staffId)
      const row = db
        .prepare('SELECT * FROM staff_profiles WHERE id = ? AND organization_id = ?')
        .get(staffId, org.id) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Staff profile not found.' })
        return
      }

      const body = req.body as { permissions?: StaffPermissionMatrix }
      const nextPerms = normalizeStaffPermissions(body.permissions)
      const nowIso = new Date().toISOString()

      if (row.user_id) {
        const userId = String(row.user_id)
        const prevRow = db.prepare('SELECT permissions_json FROM user_permissions WHERE user_id = ?').get(userId) as
          | { permissions_json?: string }
          | undefined

        db.prepare(`
          INSERT OR REPLACE INTO user_permissions (
            id, organization_id, user_id, staff_profile_id, permissions_json, updated_by, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`prm-${userId}`, org.id, userId, staffId, JSON.stringify(nextPerms), req.authUser!.id, nowIso)

        recordStaffActivity(req, {
          action: 'UPDATE_STAFF_PERMISSIONS',
          module: 'staff',
          recordId: staffId,
          previousValue: prevRow?.permissions_json ? JSON.parse(prevRow.permissions_json) : null,
          newValue: nextPerms,
        })

        emitNotification(db, {
          organizationId: org.id,
          recipientUserId: userId,
          eventType: 'STAFF_PERMISSIONS_UPDATED',
          title: 'Your workspace permissions were updated',
          message: `${req.authUser!.fullName} updated your 31-module role access matrix. Changes take effect immediately.`,
          module: 'staff',
          entityId: staffId,
          actionUrl: '/dashboard',
          severity: 'info',
        })
      }

      db.prepare("UPDATE invitations SET permissions_json = ? WHERE organization_id = ? AND target_record_id = ? AND status = 'pending'").run(
        JSON.stringify(nextPerms),
        org.id,
        staffId,
      )

      res.json({ ok: true, staffId, permissions: nextPerms })
    },
  )

  router.patch(
    '/staff/:staffId/status',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('staff', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const staffId = String(req.params.staffId)
      const body = req.body as { accountStatus?: 'active' | 'suspended' | 'deactivated'; employmentStatus?: 'active' | 'on_leave' | 'exited' }
      const row = db
        .prepare('SELECT * FROM staff_profiles WHERE id = ? AND organization_id = ?')
        .get(staffId, org.id) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Staff profile not found.' })
        return
      }

      const nowIso = new Date().toISOString()
      const nextAcct = body.accountStatus ?? String(row.account_status)
      const nextEmp = body.employmentStatus ?? String(row.employment_status)

      db.prepare('UPDATE staff_profiles SET account_status = ?, employment_status = ?, updated_at = ? WHERE id = ?').run(
        nextAcct,
        nextEmp,
        nowIso,
        staffId,
      )

      if (row.user_id) {
        const userId = String(row.user_id)
        const userStatus = nextAcct === 'active' ? 'active' : 'suspended'
        db.prepare('UPDATE users SET status = ? WHERE id = ?').run(userStatus, userId)
        if (nextAcct !== 'active') {
          db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(userId)
        }
      }

      recordStaffActivity(req, {
        action: 'UPDATE_STAFF_STATUS',
        module: 'staff',
        recordId: staffId,
        previousValue: { accountStatus: row.account_status, employmentStatus: row.employment_status },
        newValue: { accountStatus: nextAcct, employmentStatus: nextEmp },
      })

      res.json({ ok: true, staffId, accountStatus: nextAcct, employmentStatus: nextEmp })
    },
  )

  router.get(
    '/staff/activity-logs',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('staff', 'view'),
    (req: AuthenticatedRequest, res: Response) => {
      const rows = getDb()
        .prepare('SELECT * FROM staff_activity_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 120')
        .all(req.activeOrg!.id) as Array<Record<string, unknown>>
      res.json({ activityLogs: rows })
    },
  )

  // ===================== DRIVER RECORD != DRIVER LOGIN MANAGEMENT =====================
  router.get(
    '/fleet/driver-accounts',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('drivers', 'view'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const users = db
        .prepare("SELECT id, username, email, full_name, driver_id, status, last_login_at, created_at FROM users WHERE organization_id = ? AND role = 'driver'")
        .all(orgId) as Array<Record<string, unknown>>
      const invites = db
        .prepare("SELECT id, target_record_id, status, raw_token_preview, expires_at FROM invitations WHERE organization_id = ? AND target_type = 'driver' ORDER BY created_at DESC")
        .all(orgId) as Array<Record<string, unknown>>

      res.json({
        accounts: users.map((u) => ({
          userId: String(u.id),
          driverId: String(u.driver_id),
          username: String(u.username),
          email: String(u.email),
          fullName: String(u.full_name),
          status: String(u.status),
          lastLoginAt: u.last_login_at ? String(u.last_login_at) : null,
        })),
        pendingInvites: invites
          .filter((i) => String(i.status) === 'pending')
          .map((i) => ({
            invitationId: String(i.id),
            driverId: String(i.target_record_id),
            inviteToken: String(i.raw_token_preview || ''),
            expiresAt: String(i.expires_at),
          })),
      })
    },
  )

  router.post(
    '/fleet/drivers/:driverId/invite',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requirePaidActiveSubscription(),
    requireModulePermission('drivers', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const driverId = String(req.params.driverId)
      const ds = getOrgFleetDataset(db, org.id)
      const driver = ds.drivers.find((d) => d.id === driverId)
      if (!driver) {
        res.status(404).json({ error: 'Driver record not found in your organization.' })
        return
      }

      const body = req.body as { createCredentialsDirectly?: boolean; password?: string }
      const existingUser = db
        .prepare('SELECT * FROM users WHERE organization_id = ? AND driver_id = ?')
        .get(org.id, driverId) as Record<string, unknown> | undefined
      const nowIso = new Date().toISOString()

      if (body.createCredentialsDirectly) {
        if (existingUser) {
          db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(String(existingUser.id))
          res.json({
            ok: true,
            driverId,
            userId: String(existingUser.id),
            username: String(existingUser.username),
            status: 'active',
          })
          return
        }
        const base = driver.name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'driver'
        const dupe = db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(base)
        const username = dupe ? `${base}.${Math.floor(10 + Math.random() * 89)}` : base
        const password = typeof body.password === 'string' && body.password.length >= 8 ? body.password : generateTemporaryPassword()
        const userId = `u-${crypto.randomUUID().slice(0, 8)}`
        db.prepare(`
          INSERT INTO users (
            id, username, email, full_name, password_hash, role, organization_id,
            driver_id, mobile, staff_profile_id, password_change_required, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'driver', ?, ?, ?, NULL, ?, 'active', ?)
        `).run(
          userId,
          username,
          driver.email || `${username}@drivers.drivemitra.in`,
          driver.name,
          hashPassword(password),
          org.id,
          driver.id,
          driver.mobile,
          body.password ? 0 : 1,
          nowIso,
        )
        res.status(201).json({
          ok: true,
          driverId,
          userId,
          temporaryCredentials: { username, temporaryPassword: password },
        })
        return
      }

      const rawToken = generateOpaqueToken(20)
      db.prepare("UPDATE invitations SET status = 'revoked' WHERE organization_id = ? AND target_record_id = ? AND status = 'pending'").run(
        org.id,
        driverId,
      )
      db.prepare(`
        INSERT INTO invitations (
          id, organization_id, target_type, target_record_id, email, mobile, full_name,
          role, token_hash, raw_token_preview, status, permissions_json, invited_by, expires_at, created_at
        ) VALUES (?, ?, 'driver', ?, ?, ?, ?, 'driver', ?, ?, 'pending', NULL, ?, ?, ?)
      `).run(
        `inv-${crypto.randomUUID().slice(0, 8)}`,
        org.id,
        driverId,
        driver.email || `${driverId}@drivers.local`,
        driver.mobile,
        driver.name,
        hashToken(rawToken),
        rawToken,
        req.authUser!.id,
        new Date(Date.now() + 7 * 86400000).toISOString(),
        nowIso,
      )

      res.status(201).json({
        ok: true,
        driverId,
        inviteToken: rawToken,
        inviteUrl: `/invite/${rawToken}`,
        status: 'Driver Invitation Pending',
      })
    },
  )

  router.patch(
    '/fleet/drivers/:driverId/account-status',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requireModulePermission('drivers', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = String(req.params.driverId)
      const body = req.body as { status?: 'active' | 'deactivated' | 'suspended' }
      const nextStatus = body.status === 'active' ? 'active' : 'deactivated'

      const userRow = db
        .prepare("SELECT * FROM users WHERE organization_id = ? AND driver_id = ? AND role = 'driver'")
        .get(orgId, driverId) as Record<string, unknown> | undefined
      if (!userRow) {
        res.status(404).json({ error: 'This driver does not have a Driver Portal login account yet.' })
        return
      }

      const userId = String(userRow.id)
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run(nextStatus, userId)
      if (nextStatus !== 'active') {
        db.prepare('UPDATE auth_sessions SET revoked = 1 WHERE user_id = ? AND revoked = 0').run(userId)
      }

      recordStaffActivity(req, {
        action: nextStatus === 'active' ? 'REACTIVATE_DRIVER_LOGIN' : 'DEACTIVATE_DRIVER_LOGIN',
        module: 'drivers',
        recordId: driverId,
        newValue: { loginStatus: nextStatus, driverRecordPreserved: true },
      })

      res.json({
        ok: true,
        driverId,
        loginStatus: nextStatus,
        driverRecordPreserved: true,
      })
    },
  )

  // ===================== DRIVER PORTAL ENDPOINTS (STRICT ISOLATION) =====================
  router.get(
    '/driver/home',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const driverId = req.authUser!.driverId!
      const ds = getOrgFleetDataset(db, org.id)
      const driver = ds.drivers.find((d) => d.id === driverId)
      if (!driver) {
        res.status(404).json({ error: 'Linked driver profile not found.' })
        return
      }

      const assignedVehicle = ds.vehicles.find(
        (v) => v.assignedDriverId === driver.id || v.id === driver.assignedVehicleId,
      ) ?? null
      const myTrips = ds.trips.filter((t) => t.driverId === driver.id)
      const activeTrip = myTrips.find((t) => t.status === 'In Progress' || t.status === 'active') ?? null
      const upcomingTrips = myTrips.filter((t) =>
        t.status === 'Assigned' || t.status === 'Accepted' || t.status === 'Ready to Start' || t.status === 'scheduled',
      )
      const myIssues = ds.smallIssues.filter((i) => i.driverId === driver.id || (assignedVehicle && i.vehicleId === assignedVehicle.id))
      const expenseRows = db
        .prepare('SELECT * FROM driver_expenses WHERE organization_id = ? AND driver_id = ? ORDER BY created_at DESC LIMIT 20')
        .all(org.id, driver.id) as Array<Record<string, unknown>>
      const unreadCount = listNotificationsForUser(db, req.authUser!, { unreadOnly: true }).length

      res.json({
        organization: { id: org.id, name: org.name, city: org.city, state: org.state },
        driver: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          email: driver.email,
          employeeCode: driver.employeeCode,
          licenseNumber: driver.licenseNumber,
          licenseExpiry: driver.licenseExpiry,
          safetyScore: driver.safetyScore,
          status: driver.status,
          city: driver.city,
        },
        assignedVehicle: assignedVehicle
          ? {
              id: assignedVehicle.id,
              registrationNumber: assignedVehicle.registrationNumber,
              make: assignedVehicle.make,
              model: assignedVehicle.model,
              fuelType: assignedVehicle.fuelType,
              powertrain: assignedVehicle.powertrain,
              odometerKm: assignedVehicle.odometerKm,
              operationStatus: assignedVehicle.operationStatus,
              fuelOrSocPct: assignedVehicle.fuelOrSocPct,
              lastServiceDate: assignedVehicle.lastServiceDate,
              nextServiceDueDate: assignedVehicle.nextServiceDueDate,
              insuranceExpiry: assignedVehicle.insuranceExpiry,
              pucExpiry: assignedVehicle.pucExpiry,
              fitnessExpiry: assignedVehicle.fitnessExpiry,
            }
          : null,
        activeTrip,
        upcomingTrips,
        stats: {
          totalMyTrips: myTrips.length,
          completedMyTrips: myTrips.filter((t) => t.status === 'Completed' || t.status === 'completed').length,
          openIssuesCount: myIssues.filter((i) => i.status !== 'resolved').length,
          pendingExpensesCount: expenseRows.filter((e) => e.approval_status === 'Submitted' || e.approval_status === 'Pending Review').length,
          unreadNotifications: unreadCount,
        },
      })
    },
  )

  router.get(
    '/driver/vehicle',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const driver = ds.drivers.find((d) => d.id === req.authUser!.driverId)
      const vehicle = ds.vehicles.find(
        (v) => v.assignedDriverId === req.authUser!.driverId || v.id === driver?.assignedVehicleId,
      )
      if (!vehicle) {
        res.json({ assignedVehicle: null })
        return
      }
      // Strictly non-financial vehicle summary only
      res.json({
        assignedVehicle: {
          id: vehicle.id,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
          category: vehicle.category,
          powertrain: vehicle.powertrain,
          fuelType: vehicle.fuelType,
          year: vehicle.year,
          odometerKm: vehicle.odometerKm,
          operationStatus: vehicle.operationStatus,
          fuelOrSocPct: vehicle.fuelOrSocPct,
          corridorId: vehicle.corridorId,
          cityName: vehicle.cityName,
          registrationExpiry: vehicle.registrationExpiry,
          insuranceExpiry: vehicle.insuranceExpiry,
          fitnessExpiry: vehicle.fitnessExpiry,
          pucExpiry: vehicle.pucExpiry,
          permitExpiry: vehicle.permitExpiry,
          lastServiceDate: vehicle.lastServiceDate,
          nextServiceDueDate: vehicle.nextServiceDueDate,
          nextServiceDueOdometerKm: vehicle.nextServiceDueOdometerKm,
        },
      })
    },
  )

  router.get(
    '/driver/trips',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const myTrips = ds.trips.filter((t) => t.driverId === req.authUser!.driverId)
      res.json({ trips: myTrips })
    },
  )

  router.patch(
    '/driver/trips/:tripId/status',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const tripId = String(req.params.tripId)
      const body = req.body as { status?: string; note?: string }
      const allowedStatuses = new Set(['Accepted', 'Ready to Start', 'On Hold', 'Cancelled'])
      if (!body.status || !allowedStatuses.has(body.status)) {
        res.status(400).json({ error: 'Use /start or /end for live trip odometer execution, or a valid status (Accepted, Ready to Start, On Hold, Cancelled).' })
        return
      }

      let foundTrip: Record<string, unknown> | null = null
      let errorMsg: string | null = null
      syncDriverDatasetToRelationalAndBlob(orgId, (ds) => {
        const idx = ds.trips.findIndex((t) => t.id === tripId && t.driverId === driverId)
        if (idx === -1) {
          errorMsg = 'Trip not found or not assigned to your driver account.'
          return
        }
        ds.trips[idx] = {
          ...ds.trips[idx],
          status: body.status as typeof ds.trips[number]['status'],
          driverNotes: body.note?.trim() || ds.trips[idx].driverNotes,
        }
        foundTrip = ds.trips[idx] as unknown as Record<string, unknown>
      })

      if (errorMsg || !foundTrip) {
        res.status(404).json({ error: errorMsg ?? 'Trip not found.' })
        return
      }
      res.json({ trip: foundTrip })
    },
  )

  router.post(
    '/driver/trips/:tripId/start',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const tripId = String(req.params.tripId)
      const body = req.body as { startOdometerKm?: number; notes?: string }
      const ds = getOrgFleetDataset(db, orgId)

      const tripIdx = ds.trips.findIndex((t) => t.id === tripId && t.driverId === driverId)
      if (tripIdx === -1) {
        res.status(404).json({ error: 'Trip not found or not assigned to your driver account.' })
        return
      }

      const activeForDriver = ds.trips.find(
        (t) => t.driverId === driverId && t.id !== tripId && (t.status === 'In Progress' || t.status === 'active'),
      )
      if (activeForDriver) {
        res.status(409).json({ error: `Finish active trip ${activeForDriver.id} before starting another trip.` })
        return
      }

      const trip = ds.trips[tripIdx]
      const vehicleIdx = ds.vehicles.findIndex((v) => v.id === trip.vehicleId)
      const vehicle = vehicleIdx >= 0 ? ds.vehicles[vehicleIdx] : undefined

      const odoCheck = validateDriverOdometerAndDistance({
        startOdometerKm: Number(body.startOdometerKm),
        endOdometerKm: undefined,
        previousVehicleOdometerKm: vehicle?.odometerKm ?? null,
      })

      if (!odoCheck.valid) {
        res.status(400).json({ error: odoCheck.error })
        return
      }

      const startKm = Number(body.startOdometerKm)
      ds.trips[tripIdx] = {
        ...trip,
        status: 'In Progress',
        odometerStart: startKm,
        odometerFlag: odoCheck.flaggedInconsistent ? 'inconsistent' : 'verified',
        odometerFlagReason: odoCheck.flagReason ?? undefined,
        driverNotes: body.notes?.trim() || trip.driverNotes,
        startedAt: new Date().toISOString(),
        startedByUserId: req.authUser!.id,
      }
      if (vehicleIdx >= 0) {
        ds.vehicles[vehicleIdx] = {
          ...ds.vehicles[vehicleIdx],
          odometerKm: Math.max(ds.vehicles[vehicleIdx].odometerKm, startKm),
          operationStatus: 'moving',
        }
      }

      saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)

      emitNotification(db, {
        organizationId: orgId,
        recipientRole: 'org_admin',
        eventType: 'TRIP_STARTED',
        title: `Trip started: ${trip.originAddress || trip.origin || 'Origin'} → ${trip.destinationAddress || trip.destination || 'Destination'}`,
        message: `${req.authUser!.fullName} started trip ${trip.id} at ${startKm.toLocaleString('en-IN')} km.`,
        module: 'trips',
        entityId: trip.id,
        actionUrl: '/dashboard/trips',
        severity: odoCheck.flaggedInconsistent ? 'warning' : 'info',
      })

      res.json({ trip: ds.trips[tripIdx], odometerCheck: odoCheck })
    },
  )

  router.post(
    '/driver/trips/:tripId/end',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const tripId = String(req.params.tripId)
      const body = req.body as { endOdometerKm?: number; notes?: string }
      const ds = getOrgFleetDataset(db, orgId)

      const tripIdx = ds.trips.findIndex((t) => t.id === tripId && t.driverId === driverId)
      if (tripIdx === -1) {
        res.status(404).json({ error: 'Trip not found or not assigned to your driver account.' })
        return
      }

      const trip = ds.trips[tripIdx]
      const startKm = trip.odometerStart
      if (startKm == null) {
        res.status(400).json({ error: 'Trip does not have a recorded start odometer reading. Start the trip first.' })
        return
      }

      const vehicleIdx = ds.vehicles.findIndex((v) => v.id === trip.vehicleId)
      const endKm = body.endOdometerKm == null ? null : Number(body.endOdometerKm)
      const odoCheck = validateDriverOdometerAndDistance({
        startOdometerKm: startKm,
        endOdometerKm: endKm,
        previousVehicleOdometerKm: vehicleIdx >= 0 ? ds.vehicles[vehicleIdx].odometerKm : null,
        gpsEstimatedDistanceKm: trip.distanceKm > 0 ? trip.distanceKm : null,
      })

      if (!odoCheck.valid || odoCheck.distanceKm == null) {
        res.status(400).json({ error: odoCheck.error || 'Valid end odometer reading is required.' })
        return
      }

      const completedAt = new Date().toISOString()
      ds.trips[tripIdx] = {
        ...trip,
        status: 'Completed',
        odometerEnd: endKm!,
        distanceKm: odoCheck.distanceKm,
        odometerFlag: odoCheck.flaggedInconsistent ? 'inconsistent' : 'verified',
        odometerFlagReason: odoCheck.flagReason ?? undefined,
        driverNotes: body.notes?.trim() || trip.driverNotes,
        completedAt,
        completedByUserId: req.authUser!.id,
      }

      if (vehicleIdx >= 0) {
        ds.vehicles[vehicleIdx] = {
          ...ds.vehicles[vehicleIdx],
          odometerKm: Math.max(ds.vehicles[vehicleIdx].odometerKm, endKm!),
          operationStatus: 'stopped',
        }
      }

      saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)

      emitNotification(db, {
        organizationId: orgId,
        recipientRole: 'org_admin',
        eventType: 'TRIP_COMPLETED',
        title: `Trip completed: ${trip.originAddress || trip.origin || 'Origin'} → ${trip.destinationAddress || trip.destination || 'Destination'}`,
        message: `${req.authUser!.fullName} completed ${odoCheck.distanceKm} km (${startKm} → ${endKm}).`,
        module: 'trips',
        entityId: trip.id,
        actionUrl: '/dashboard/trips',
        severity: odoCheck.flaggedInconsistent ? 'warning' : 'success',
      })

      res.json({ trip: ds.trips[tripIdx], odometerCheck: odoCheck })
    },
  )

  router.get(
    '/driver/fuel',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const fuelLogs = ds.fuelTransactions.filter((f) => f.driverId === req.authUser!.driverId)
      res.json({ fuelLogs })
    },
  )

  router.post(
    '/driver/fuel',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const body = req.body as {
        vehicleId?: string
        tripId?: string
        fuelType?: string
        quantityLitresOrKwh?: number
        amountInr?: number
        odometerKm?: number
        station?: string
        receiptCode?: string
      }

      const qty = Number(body.quantityLitresOrKwh)
      const amount = Number(body.amountInr)
      const odo = Number(body.odometerKm)
      if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(odo) || odo < 0) {
        res.status(400).json({ error: 'Positive fuel quantity, total cost (INR), and valid odometer reading are required.' })
        return
      }

      const ds = getOrgFleetDataset(db, orgId)
      const driver = ds.drivers.find((d) => d.id === driverId)
      const vehicle = ds.vehicles.find(
        (v) => (body.vehicleId && v.id === body.vehicleId) || v.assignedDriverId === driverId || v.id === driver?.assignedVehicleId,
      )
      if (!vehicle) {
        res.status(400).json({ error: 'No assigned vehicle found to log fuel against.' })
        return
      }

      const stationLabel = body.station?.trim() || `${orgId} Route Station`
      const receiptRef = body.receiptCode?.trim() || `RCP-${Math.floor(10000 + Math.random() * 89999)}`
      const unitPrice = Math.round((amount / qty) * 100) / 100
      const fuelEntry = {
        id: `fuel-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: orgId,
        environment: 'production' as const,
        vehicleId: vehicle.id,
        driverId,
        tripId: body.tripId || undefined,
        amountInr: amount,
        litersOrKwh: qty,
        unitPriceInr: unitPrice,
        odometerKm: odo,
        station: stationLabel,
        location: vehicle.telemetry?.location ?? { lat: 13.0827, lng: 80.2707 },
        timestamp: new Date().toISOString(),
        paymentMethod: (vehicle.fuelType === 'Electric' ? 'ev_charging' : 'upi') as 'ev_charging' | 'upi',
        entrySource: 'owner_entry' as const,
        verificationStatus: 'pending' as const,
        paymentState: 'recorded' as const,
        anomalyFlags: [],
      }
      ds.fuelTransactions.unshift(fuelEntry)

      // Also record an auditable expense record in driver_expenses
      const expId = `dexp-${crypto.randomUUID().slice(0, 8)}`
      const nowIso = new Date().toISOString()
      db.prepare(`
        INSERT INTO driver_expenses (
          id, organization_id, driver_id, vehicle_id, trip_id, category, amount_inr,
          expense_date, odometer_km, location, description, receipt_url,
          approval_status, payment_status, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'Fuel', ?, ?, ?, ?, ?, ?, 'Pending Review', 'unpaid', ?, ?, ?)
      `).run(
        expId,
        orgId,
        driverId,
        vehicle.id,
        body.tripId || null,
        amount,
        nowIso.slice(0, 10),
        odo,
        stationLabel,
        `${qty} ${vehicle.fuelType === 'Electric' ? 'kWh' : 'L'} @ ${stationLabel} (${receiptRef})`,
        receiptRef,
        req.authUser!.id,
        nowIso,
        nowIso,
      )

      saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)

      emitNotification(db, {
        organizationId: orgId,
        recipientRole: 'org_admin',
        eventType: 'FUEL_LOG_SUBMITTED',
        title: `Fuel entry awaiting verification (${vehicle.registrationNumber})`,
        message: `${req.authUser!.fullName} submitted ₹${amount.toLocaleString('en-IN')} fuel log at ${odo} km.`,
        module: 'expense_history',
        entityId: expId,
        actionUrl: '/dashboard/fleet/expenses',
        severity: 'info',
      })

      res.status(201).json({ fuelTransaction: fuelEntry, expenseId: expId })
    },
  )

  router.get(
    '/driver/expenses',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const rows = getDb()
        .prepare('SELECT * FROM driver_expenses WHERE organization_id = ? AND driver_id = ? ORDER BY created_at DESC')
        .all(req.activeOrg!.id, req.authUser!.driverId!) as Array<Record<string, unknown>>
      res.json({ expenses: rows.map(mapDriverExpenseRow) })
    },
  )

  router.post(
    '/driver/expenses',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const body = req.body as {
        vehicleId?: string
        tripId?: string
        category?: DriverExpenseCategory
        amountInr?: number
        expenseDate?: string
        odometerKm?: number
        location?: string
        description?: string
        receiptUrl?: string
        submitImmediately?: boolean
      }

      const category = body.category && ALLOWED_EXPENSE_CATEGORIES.includes(body.category)
        ? body.category
        : 'Other Approved Expenses'
      const amount = Number(body.amountInr)
      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ error: 'Expense amount in INR must be greater than zero.' })
        return
      }

      const ds = getOrgFleetDataset(db, orgId)
      const assignedVehicle = ds.vehicles.find((v) => v.assignedDriverId === driverId)
      const expId = `dexp-${crypto.randomUUID().slice(0, 8)}`
      const nowIso = new Date().toISOString()
      const status: DriverExpenseStatus = body.submitImmediately === false ? 'Draft' : 'Submitted'

      db.prepare(`
        INSERT INTO driver_expenses (
          id, organization_id, driver_id, vehicle_id, trip_id, category, amount_inr,
          expense_date, odometer_km, location, description, receipt_url,
          approval_status, payment_status, created_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?)
      `).run(
        expId,
        orgId,
        driverId,
        body.vehicleId || assignedVehicle?.id || null,
        body.tripId || null,
        category,
        amount,
        body.expenseDate || nowIso.slice(0, 10),
        body.odometerKm != null ? Number(body.odometerKm) : null,
        body.location?.trim() || null,
        body.description?.trim() || '',
        body.receiptUrl?.trim() || null,
        status,
        req.authUser!.id,
        nowIso,
        nowIso,
      )

      if (status === 'Submitted') {
        emitNotification(db, {
          organizationId: orgId,
          recipientRole: 'org_admin',
          eventType: 'DRIVER_EXPENSE_SUBMITTED',
          title: `New driver ${category} expense (₹${amount.toLocaleString('en-IN')})`,
          message: `${req.authUser!.fullName} submitted a ${category} expense awaiting approval.`,
          module: 'expense_history',
          entityId: expId,
          actionUrl: '/dashboard/fleet/expenses',
          severity: 'info',
        })
      }

      const created = db.prepare('SELECT * FROM driver_expenses WHERE id = ?').get(expId) as Record<string, unknown>
      res.status(201).json({ expense: mapDriverExpenseRow(created) })
    },
  )

  router.get(
    '/driver/inspections',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const driver = ds.drivers.find((d) => d.id === req.authUser!.driverId)
      const items = ds.inspections.filter(
        (ins) => ins.driverId === req.authUser!.driverId || ins.inspectorName === driver?.name || (driver?.assignedVehicleId && ins.vehicleId === driver.assignedVehicleId),
      )
      res.json({ inspections: items })
    },
  )

  router.post(
    '/driver/inspections',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const body = req.body as {
        vehicleId?: string
        tyreCondition?: 'good' | 'worn' | 'critical'
        brakeFeel?: 'normal' | 'spongy' | 'squealing'
        fluidLeaksDetected?: boolean
        warningLightsOn?: boolean
        batteryOrStartingIssue?: boolean
        defectsFound?: string[]
        status?: 'Passed' | 'Failed' | 'Advisory'
        notes?: string
      }

      const ds = getOrgFleetDataset(db, orgId)
      const driver = ds.drivers.find((d) => d.id === driverId)
      const vehicle = ds.vehicles.find(
        (v) => (body.vehicleId && v.id === body.vehicleId) || v.assignedDriverId === driverId || v.id === driver?.assignedVehicleId,
      )
      if (!vehicle) {
        res.status(400).json({ error: 'No assigned vehicle found for inspection.' })
        return
      }

      const defects = Array.isArray(body.defectsFound) ? body.defectsFound.filter((d) => d.trim()) : []
      const tyreCondition = body.tyreCondition ?? (defects.some((d) => /tyre|tire/i.test(d)) ? 'critical' : 'good')
      const brakeFeel = body.brakeFeel ?? (defects.some((d) => /brake/i.test(d)) ? 'spongy' : 'normal')
      const fluidLeaksDetected = Boolean(body.fluidLeaksDetected || defects.some((d) => /leak|fluid|oil/i.test(d)))
      const warningLightsOn = Boolean(body.warningLightsOn || defects.some((d) => /light|warning|engine/i.test(d)))
      const batteryOrStartingIssue = Boolean(body.batteryOrStartingIssue || defects.some((d) => /battery|start/i.test(d)))
      const passed =
        body.status === 'Failed'
          ? false
          : tyreCondition === 'good' &&
            brakeFeel === 'normal' &&
            !fluidLeaksDetected &&
            !warningLightsOn &&
            !batteryOrStartingIssue &&
            defects.length === 0

      const ins = {
        id: `ins-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: orgId,
        environment: 'production' as const,
        vehicleId: vehicle.id,
        driverId,
        inspectorName: driver?.name ?? req.authUser!.fullName,
        timestamp: new Date().toISOString(),
        tyreCondition,
        brakeFeel,
        fluidLeaksDetected,
        warningLightsOn,
        batteryOrStartingIssue,
        notes: body.notes?.trim() || (defects.length ? defects.join('; ') : 'Pre-trip DVIR passed cleanly'),
        passed,
      }

      ds.inspections.unshift(ins)
      saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)

      if (!passed) {
        emitNotification(db, {
          organizationId: orgId,
          recipientRole: 'org_admin',
          eventType: 'DVIR_FAILED',
          title: `Inspection defect reported: ${vehicle.registrationNumber}`,
          message: `${driver?.name ?? req.authUser!.fullName} reported defect(s) during vehicle inspection.`,
          module: 'inspections',
          entityId: ins.id,
          actionUrl: '/dashboard/inspections',
          severity: 'critical',
        })
      }

      res.status(201).json({ inspection: ins })
    },
  )

  router.get(
    '/driver/issues',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const issues = ds.smallIssues.filter((i) => i.driverId === req.authUser!.driverId)
      res.json({ issues })
    },
  )

  router.post(
    '/driver/issues',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const body = req.body as {
        vehicleId?: string
        category?: string
        severity?: 'low' | 'medium' | 'high' | 'critical'
        title?: string
        description?: string
      }

      if (!body.title?.trim() || !body.description?.trim()) {
        res.status(400).json({ error: 'Issue title and description are required.' })
        return
      }

      const ds = getOrgFleetDataset(db, orgId)
      const driver = ds.drivers.find((d) => d.id === driverId)
      const vehicle = ds.vehicles.find(
        (v) => (body.vehicleId && v.id === body.vehicleId) || v.assignedDriverId === driverId || v.id === driver?.assignedVehicleId,
      )
      if (!vehicle) {
        res.status(400).json({ error: 'No assigned vehicle found to report an issue against.' })
        return
      }

      const issue = {
        id: `iss-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: orgId,
        vehicleId: vehicle.id,
        driverId,
        reportedAt: new Date().toISOString(),
        reportedBy: req.authUser!.fullName,
        healthArea: (body.category || 'Vehicle Health') as typeof ds.smallIssues[number]['healthArea'],
        severity: (body.severity || 'medium') as typeof ds.smallIssues[number]['severity'],
        title: body.title.trim(),
        description: body.description.trim(),
        status: 'open' as const,
        source: 'owner_manual' as const,
      }
      ds.smallIssues.unshift(issue)
      saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)

      emitNotification(db, {
        organizationId: orgId,
        recipientRole: 'org_admin',
        eventType: 'DRIVER_ISSUE_REPORTED',
        title: `Driver reported issue (${vehicle.registrationNumber})`,
        message: `${req.authUser!.fullName}: ${issue.title}`,
        module: 'issues',
        entityId: issue.id,
        actionUrl: '/dashboard/issues',
        severity: issue.severity === 'critical' || issue.severity === 'high' ? 'critical' : 'warning',
      })

      res.status(201).json({ issue })
    },
  )

  router.get(
    '/driver/documents',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const driver = ds.drivers.find((d) => d.id === req.authUser!.driverId)
      const vehicle = ds.vehicles.find(
        (v) => v.assignedDriverId === req.authUser!.driverId || v.id === driver?.assignedVehicleId,
      )
      // Strictly filter OUT financial invoices, contracts, and unrelated drivers
      const docs = ds.documentVault.filter(
        (doc) =>
          (doc.entityType === 'driver' && doc.entityId === req.authUser!.driverId) ||
          (vehicle && doc.entityType === 'vehicle' && doc.entityId === vehicle.id && doc.category !== 'Invoice'),
      )
      res.json({
        documents: docs,
        driverCompliance: driver
          ? {
              licenseNumber: driver.licenseNumber,
              licenseExpiry: driver.licenseExpiry,
              badgeNumber: driver.badgeNumber,
            }
          : null,
        vehicleCompliance: vehicle
          ? {
              registrationNumber: vehicle.registrationNumber,
              registrationExpiry: vehicle.registrationExpiry,
              insuranceExpiry: vehicle.insuranceExpiry,
              fitnessExpiry: vehicle.fitnessExpiry,
              pucExpiry: vehicle.pucExpiry,
              permitExpiry: vehicle.permitExpiry,
            }
          : null,
      })
    },
  )

  router.get(
    '/driver/profile',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const ds = getOrgFleetDataset(getDb(), req.activeOrg!.id)
      const driver = ds.drivers.find((d) => d.id === req.authUser!.driverId)
      if (!driver) {
        res.status(404).json({ error: 'Driver profile not found.' })
        return
      }
      res.json({
        profile: {
          id: driver.id,
          name: driver.name,
          mobile: driver.mobile,
          alternateMobile: driver.alternateMobile,
          email: driver.email,
          employeeCode: driver.employeeCode,
          city: driver.city,
          state: driver.state,
          bloodGroup: driver.bloodGroup,
          emergencyContactName: driver.emergencyContactName,
          emergencyContactRelation: driver.emergencyContactRelation,
          emergencyContactPhone: driver.emergencyContactPhone,
          licenseNumber: driver.licenseNumber,
          licenseExpiry: driver.licenseExpiry,
          safetyScore: driver.safetyScore,
          status: driver.status,
        },
      })
    },
  )

  router.patch(
    '/driver/profile',
    requireAuth,
    requirePasswordChanged,
    requireDriverRole,
    (req: AuthenticatedRequest, res: Response) => {
      const orgId = req.activeOrg!.id
      const driverId = req.authUser!.driverId!
      const body = req.body as {
        mobile?: string
        alternateMobile?: string
        emergencyContactName?: string
        emergencyContactRelation?: string
        emergencyContactPhone?: string
      }

      let updatedDriver: Record<string, unknown> | null = null
      syncDriverDatasetToRelationalAndBlob(orgId, (ds) => {
        const idx = ds.drivers.findIndex((d) => d.id === driverId)
        if (idx === -1) return
        ds.drivers[idx] = {
          ...ds.drivers[idx],
          mobile: body.mobile?.trim() || ds.drivers[idx].mobile,
          alternateMobile: body.alternateMobile?.trim() ?? ds.drivers[idx].alternateMobile,
          emergencyContactName: body.emergencyContactName?.trim() ?? ds.drivers[idx].emergencyContactName,
          emergencyContactRelation: body.emergencyContactRelation?.trim() ?? ds.drivers[idx].emergencyContactRelation,
          emergencyContactPhone: body.emergencyContactPhone?.trim() ?? ds.drivers[idx].emergencyContactPhone,
        }
        updatedDriver = ds.drivers[idx] as unknown as Record<string, unknown>
      })

      if (!updatedDriver) {
        res.status(404).json({ error: 'Driver record not found.' })
        return
      }
      res.json({ profile: updatedDriver })
    },
  )

  // ===================== OWNER / STAFF EXPENSE VERIFICATION VS REIMBURSEMENT =====================
  router.get(
    '/fleet/expenses',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requirePaidActiveSubscription(),
    requireModulePermission('expense_history', 'view'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const rows = db
        .prepare('SELECT * FROM driver_expenses WHERE organization_id = ? ORDER BY created_at DESC')
        .all(req.activeOrg!.id) as Array<Record<string, unknown>>
      res.json({ expenses: rows.map(mapDriverExpenseRow) })
    },
  )

  router.patch(
    '/fleet/expenses/:id/review',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requirePaidActiveSubscription(),
    requireModulePermission('expense_history', 'approve'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const expId = String(req.params.id)
      const body = req.body as {
        approvalStatus?: 'Approved' | 'Rejected' | 'Requires Additional Information'
        reviewNote?: string
      }
      const allowed = new Set(['Approved', 'Rejected', 'Requires Additional Information'])
      if (!body.approvalStatus || !allowed.has(body.approvalStatus)) {
        res.status(400).json({ error: 'approvalStatus must be Approved, Rejected, or Requires Additional Information.' })
        return
      }

      const row = db
        .prepare('SELECT * FROM driver_expenses WHERE id = ? AND organization_id = ?')
        .get(expId, orgId) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Expense submission not found.' })
        return
      }

      const nowIso = new Date().toISOString()
      db.prepare(`
        UPDATE driver_expenses
        SET approval_status = ?, reviewed_by = ?, reviewed_at = ?, review_note = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(body.approvalStatus, req.authUser!.fullName, nowIso, body.reviewNote?.trim() || null, nowIso, expId, orgId)

      const driverUser = db
        .prepare("SELECT id FROM users WHERE organization_id = ? AND driver_id = ? AND role = 'driver'")
        .get(orgId, String(row.driver_id)) as { id?: string } | undefined

      if (driverUser?.id) {
        emitNotification(db, {
          organizationId: orgId,
          recipientUserId: driverUser.id,
          eventType: 'EXPENSE_REVIEWED',
          title: `Expense ${body.approvalStatus}`,
          message: `Your ${String(row.category)} expense (₹${Number(row.amount_inr).toLocaleString('en-IN')}) was marked ${body.approvalStatus}.`,
          module: 'expense_history',
          entityId: expId,
          actionUrl: '/driver/expenses',
          severity: body.approvalStatus === 'Approved' ? 'success' : 'warning',
        })
      }

      recordStaffActivity(req, {
        action: `EXPENSE_${body.approvalStatus.toUpperCase()}`,
        module: 'expense_history',
        recordId: expId,
        previousValue: { approvalStatus: row.approval_status },
        newValue: { approvalStatus: body.approvalStatus, reviewNote: body.reviewNote },
      })

      const updated = db.prepare('SELECT * FROM driver_expenses WHERE id = ?').get(expId) as Record<string, unknown>
      res.json({ expense: mapDriverExpenseRow(updated) })
    },
  )

  router.patch(
    '/fleet/expenses/:id/pay',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requirePaidActiveSubscription(),
    requireModulePermission('finance', 'edit'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const expId = String(req.params.id)
      const body = req.body as { paymentStatus?: 'reimbursed' | 'company_paid'; paymentReference?: string }

      const row = db
        .prepare('SELECT * FROM driver_expenses WHERE id = ? AND organization_id = ?')
        .get(expId, orgId) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Expense submission not found.' })
        return
      }
      if (String(row.approval_status) !== 'Approved') {
        res.status(400).json({ error: 'Expense must be Approved before reimbursement/settlement payment can be recorded.' })
        return
      }

      const nextPay = body.paymentStatus === 'company_paid' ? 'company_paid' : 'reimbursed'
      const nowIso = new Date().toISOString()
      db.prepare(`
        UPDATE driver_expenses
        SET payment_status = ?, paid_by = ?, paid_at = ?, payment_reference = ?, updated_at = ?
        WHERE id = ? AND organization_id = ?
      `).run(nextPay, req.authUser!.fullName, nowIso, body.paymentReference?.trim() || `REIMB-${Date.now()}`, nowIso, expId, orgId)

      const updated = db.prepare('SELECT * FROM driver_expenses WHERE id = ?').get(expId) as Record<string, unknown>
      res.json({ expense: mapDriverExpenseRow(updated) })
    },
  )

  // ===================== WORK ORDER COMPLETION (CROSS-MODULE LINKAGE) =====================
  router.post(
    '/fleet/work-orders/:workOrderId/complete',
    requireAuth,
    requirePasswordChanged,
    requireActiveOrganization,
    requirePaidActiveSubscription(),
    requireModulePermission('work_orders', 'manage'),
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = req.activeOrg!.id
      const woId = String(req.params.workOrderId)
      const body = req.body as {
        actualCostInr?: number
        odometerKm?: number
        notes?: string
        workshopName?: string
      }

      const ds = getOrgFleetDataset(db, orgId)
      const woIdx = ds.workOrders.findIndex((w) => w.id === woId)
      if (woIdx === -1) {
        res.status(404).json({ error: 'Work order not found.' })
        return
      }

      const wo = ds.workOrders[woIdx]
      const nowDate = new Date().toISOString().slice(0, 10)
      const costInr = Number(body.actualCostInr ?? wo.totalCostInr) || 0
      const vehicleIdx = ds.vehicles.findIndex((v) => v.id === wo.vehicleId)
      const odometerKm = Number(body.odometerKm) || (vehicleIdx >= 0 ? ds.vehicles[vehicleIdx].odometerKm : 0)

      ds.workOrders[woIdx] = {
        ...wo,
        status: 'completed',
        totalCostInr: costInr,
        completedAt: nowDate,
      }

      const maintenanceRecord = {
        id: `mnt-${crypto.randomUUID().slice(0, 8)}`,
        organizationId: orgId,
        environment: 'production' as const,
        vehicleId: wo.vehicleId,
        performedAt: nowDate,
        odometerAtServiceKm: odometerKm,
        serviceType: 'Scheduled PM',
        componentName: 'General Service' as const,
        description: `${wo.title}${body.notes ? ` — ${body.notes.trim()}` : ''}`,
        costInr,
        serviceCenter: body.workshopName?.trim() || wo.workshopName || 'Authorized Workshop',
        workshopId: wo.workshopId,
        downtimeDays: 1,
        partsReplaced: wo.parts.map((p) => p.partName),
        status: 'completed' as const,
        linkedWorkOrderId: wo.id,
      }
      ds.maintenanceRecords.unshift(maintenanceRecord)

      // Update any matching ServiceScheduleReminder on this vehicle
      ds.serviceSchedules = ds.serviceSchedules.map((sch) =>
        sch.vehicleId === wo.vehicleId && sch.status !== 'completed'
          ? {
              ...sch,
              status: 'completed' as const,
              dueDate: addBillingPeriod(nowDate, 'monthly'),
              dueOdometerKm: odometerKm + 10000,
            }
          : sch,
      )

      if (vehicleIdx >= 0) {
        ds.vehicles[vehicleIdx] = {
          ...ds.vehicles[vehicleIdx],
          lastServiceDate: nowDate,
          operationStatus: ds.vehicles[vehicleIdx].operationStatus === 'maintenance' ? 'stopped' : ds.vehicles[vehicleIdx].operationStatus,
        }
      }

      saveOrgFleetDataset(db, orgId, ds as unknown as Record<string, unknown>, false)

      recordStaffActivity(req, {
        action: 'WORK_ORDER_COMPLETED',
        module: 'work_orders',
        recordId: woId,
        newValue: { costInr, maintenanceRecordId: maintenanceRecord.id },
      })

      res.json({ workOrder: ds.workOrders[woIdx], maintenanceRecord })
    },
  )

  // ===================== CANONICAL SUBSCRIPTION, GST CHECKOUT & GATEWAY VERIFICATION =====================
  router.get('/subscription/plans', (_req, res: Response) => {
    res.json({ plans: CANONICAL_SUBSCRIPTION_PLANS })
  })

  router.get(
    '/subscription/current',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const org = req.activeOrg!
      const subInfo = loadOrgSubscription(org.id, org)
      const payments = db
        .prepare('SELECT * FROM subscription_payments WHERE organization_id = ? ORDER BY created_at DESC')
        .all(org.id) as Array<Record<string, unknown>>
      const invoices = db
        .prepare('SELECT * FROM saas_billing_invoices WHERE organization_id = ? ORDER BY issued_at DESC')
        .all(org.id) as Array<Record<string, unknown>>

      res.json({
        organization: org,
        subscription: subInfo.subscription,
        operationalAccess: subInfo.operationalAccess,
        plans: CANONICAL_SUBSCRIPTION_PLANS,
        payments: payments.map(mapSubscriptionPaymentRow),
        invoices: invoices.map(mapSaasInvoiceRow),
      })
    },
  )

  router.post(
    '/subscription/checkout',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owners can initiate subscription checkout.' })
        return
      }
      const db = getDb()
      const org = req.activeOrg!
      const body = req.body as { planId?: string; paymentMethod?: string }
      const planId = normalizePlanId(body.planId)

      // Enforce mandatory >= 1 staff before allowing initial subscription checkout completion
      if (!org.onboardingCompleted) {
        const staffCount = db
          .prepare('SELECT COUNT(*) AS count FROM staff_profiles WHERE organization_id = ?')
          .get(org.id) as { count: number }
        if (staffCount.count < 1) {
          res.status(400).json({
            code: 'MANDATORY_STAFF_REQUIRED',
            error: 'Add at least 1 Staff Member before proceeding to subscription checkout (Fleet Owner does not count).',
          })
          return
        }
      }

      const totals = computeCheckoutTotals(planId)
      const nowIso = new Date().toISOString()
      const paymentId = `spay-${crypto.randomUUID().slice(0, 8)}`
      const subId = `sub-${org.id}`

      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?, billing_frequency = ?, base_amount_inr = ?, tax_amount_inr = ?, total_amount_inr = ?, updated_at = ?
        WHERE organization_id = ?
      `).run(
        planId,
        planId,
        totals.baseAmountInr,
        totals.taxAmountInr,
        totals.totalPayableInr,
        nowIso,
        org.id,
      )

      db.prepare(`
        INSERT INTO subscription_payments (
          id, organization_id, subscription_id, plan_id, billing_cycle,
          base_amount_inr, tax_amount_inr, total_amount_inr, reported_amount_inr,
          payment_method, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'pending', ?, ?)
      `).run(
        paymentId,
        org.id,
        subId,
        planId,
        planId,
        totals.baseAmountInr,
        totals.taxAmountInr,
        totals.totalPayableInr,
        body.paymentMethod?.trim() || 'UPI / Razorpay',
        nowIso,
        nowIso,
      )

      db.prepare('UPDATE organizations SET onboarding_step = MAX(onboarding_step, 5) WHERE id = ?').run(org.id)

      const createdPayment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(paymentId) as Record<string, unknown>
      res.status(201).json({
        checkout: totals,
        payment: mapSubscriptionPaymentRow(createdPayment),
      })
    },
  )

  router.post(
    '/subscription/payments/:paymentId/submit',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owners can submit payment attempts.' })
        return
      }
      const db = getDb()
      const org = req.activeOrg!
      const paymentId = String(req.params.paymentId)
      const row = db
        .prepare('SELECT * FROM subscription_payments WHERE id = ? AND organization_id = ?')
        .get(paymentId, org.id) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Checkout payment record not found.' })
        return
      }

      const body = req.body as {
        outcome?: 'submitted_for_verification' | 'pending' | 'processing' | 'failed' | 'cancelled'
        gatewayReference?: string
        reportedAmountInr?: number
        failureReason?: string
      }

      const nowIso = new Date().toISOString()
      const currentStatus = String(row.status) as SubscriptionPaymentStatus
      if (currentStatus === 'successful' || currentStatus === 'refunded') {
        res.status(409).json({ error: `Payment ${paymentId} is already ${currentStatus}.` })
        return
      }

      const gatewayRef =
        body.gatewayReference?.trim() || `GW-${org.code}-${Date.now().toString(36).toUpperCase()}`
      const outcome = body.outcome ?? 'submitted_for_verification'

      if (outcome === 'failed' || outcome === 'cancelled' || outcome === 'pending' || outcome === 'processing') {
        const nextStatus: SubscriptionPaymentStatus = outcome
        const reason =
          body.failureReason?.trim() ||
          `Gateway reported ${outcome}. Workspace remains pending until verified payment succeeds.`

        db.prepare(`
          UPDATE subscription_payments
          SET status = ?, gateway_reference = ?, reported_amount_inr = ?, failure_reason = ?, updated_at = ?
          WHERE id = ?
        `).run(nextStatus, gatewayRef, body.reportedAmountInr ?? null, reason, nowIso, paymentId)

        db.prepare(`
          INSERT INTO subscription_events (id, organization_id, subscription_id, event_type, actor_user_id, details_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          `sevt-${crypto.randomUUID().slice(0, 8)}`,
          org.id,
          String(row.subscription_id),
          `PAYMENT_${nextStatus.toUpperCase()}`,
          req.authUser!.id,
          JSON.stringify({ paymentId, gatewayRef, reason }),
          nowIso,
        )

        const updatedPay = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(paymentId) as Record<string, unknown>
        res.status(400).json({
          activated: false,
          error: reason,
          payment: mapSubscriptionPaymentRow(updatedPay),
        })
        return
      }

      // Guardrail: Payment submitted moves to pending_verification (or verified by Platform Admin / server check — NEVER unconditionally activated on unverified client payload)
      const reportedAmount =
        body.reportedAmountInr !== undefined ? Number(body.reportedAmountInr) : Number(row.total_amount_inr)

      if (Math.round(reportedAmount) !== Math.round(Number(row.total_amount_inr))) {
        const mismatchReason = `Amount mismatch detected: expected ₹${row.total_amount_inr}, submitted ₹${reportedAmount}.`
        db.prepare(`
          UPDATE subscription_payments
          SET status = 'failed', gateway_reference = ?, reported_amount_inr = ?, failure_reason = ?, updated_at = ?
          WHERE id = ?
        `).run(gatewayRef, reportedAmount, mismatchReason, nowIso, paymentId)
        res.status(400).json({ activated: false, error: mismatchReason })
        return
      }

      db.prepare(`
        UPDATE subscription_payments
        SET status = 'pending_verification', gateway_reference = ?, reported_amount_inr = ?, updated_at = ?
        WHERE id = ?
      `).run(gatewayRef, reportedAmount, nowIso, paymentId)

      db.prepare(`
        UPDATE subscriptions
        SET status = CASE WHEN status = 'active' THEN 'active' ELSE 'pending_verification' END, updated_at = ?
        WHERE organization_id = ?
      `).run(nowIso, org.id)

      db.prepare('UPDATE organizations SET onboarding_step = 6 WHERE id = ?').run(org.id)

      emitNotification(db, {
        recipientRole: 'platform_admin',
        eventType: 'PAYMENT_VERIFICATION_REQUIRED',
        title: `Subscription payment pending verification (${org.name})`,
        message: `${org.name} submitted ₹${Number(row.total_amount_inr).toLocaleString('en-IN')} (${String(row.plan_id)}) ref ${gatewayRef}.`,
        module: 'subscription',
        entityId: paymentId,
        actionUrl: '/platform-admin',
        severity: 'warning',
      })

      const updatedPay = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(paymentId) as Record<string, unknown>
      res.json({
        activated: false,
        awaitingPlatformVerification: true,
        message: 'Payment proof recorded and queued for Platform Admin verification. Operational modules unlock once verified.',
        payment: mapSubscriptionPaymentRow(updatedPay),
      })
    },
  )

  router.post(
    '/subscription/change-frequency',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owners can change billing frequency.' })
        return
      }
      const db = getDb()
      const org = req.activeOrg!
      const body = req.body as { planId?: string }
      const targetPlan = normalizePlanId(body.planId)
      const totals = computeCheckoutTotals(targetPlan)
      const nowIso = new Date().toISOString()

      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?, billing_frequency = ?, base_amount_inr = ?, tax_amount_inr = ?, total_amount_inr = ?, updated_at = ?
        WHERE organization_id = ?
      `).run(
        targetPlan,
        targetPlan,
        totals.baseAmountInr,
        totals.taxAmountInr,
        totals.totalPayableInr,
        nowIso,
        org.id,
      )

      db.prepare(`
        UPDATE organizations
        SET plan_id = ?, billing_frequency = ?, vehicle_limit = ?, driver_limit = ?
        WHERE id = ?
      `).run(targetPlan, targetPlan, UNLIMITED_SEAT_CAP, UNLIMITED_SEAT_CAP, org.id)

      res.json({
        ok: true,
        targetPlan,
        nextRenewalQuote: totals,
        subscription: loadOrgSubscription(org.id, org).subscription,
      })
    },
  )

  router.post(
    '/subscription/cancel',
    requireAuth,
    requireActiveOrganization,
    (req: AuthenticatedRequest, res: Response) => {
      if (req.authUser!.role !== 'org_admin') {
        res.status(403).json({ error: 'Only Fleet Owners can cancel subscriptions.' })
        return
      }
      const db = getDb()
      const org = req.activeOrg!
      const nowIso = new Date().toISOString()

      db.prepare(`
        UPDATE subscriptions
        SET cancel_at_period_end = 1, auto_renew = 0, cancelled_at = ?, updated_at = ?
        WHERE organization_id = ?
      `).run(nowIso, nowIso, org.id)

      db.prepare(`
        INSERT INTO subscription_events (id, organization_id, subscription_id, event_type, actor_user_id, details_json, created_at)
        VALUES (?, ?, ?, 'SUBSCRIPTION_CANCEL_SCHEDULED', ?, ?, ?)
      `).run(
        `sevt-${crypto.randomUUID().slice(0, 8)}`,
        org.id,
        `sub-${org.id}`,
        req.authUser!.id,
        JSON.stringify({ cancelAtPeriodEnd: true }),
        nowIso,
      )

      res.json({
        ok: true,
        message: 'Auto-renewal disabled. Workspace remains active through the end of the current paid period.',
        subscription: loadOrgSubscription(org.id, org).subscription,
      })
    },
  )

  // ===================== PLATFORM ADMIN GOVERNANCE EXTENSIONS =====================
  router.get(
    '/platform-admin/payments',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const rows = db
        .prepare(`
          SELECT sp.*, o.name AS organization_name, o.code AS organization_code, o.status AS organization_status
          FROM subscription_payments sp
          JOIN organizations o ON o.id = sp.organization_id
          ORDER BY sp.created_at DESC
        `)
        .all() as Array<Record<string, unknown>>

      res.json({
        payments: rows.map((r) => ({
          ...mapSubscriptionPaymentRow(r),
          organizationName: String(r.organization_name),
          organizationCode: String(r.organization_code),
          organizationStatus: String(r.organization_status),
        })),
      })
    },
  )

  router.post(
    '/platform-admin/payments/:paymentId/verify',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const paymentId = String(req.params.paymentId)
      const body = req.body as {
        decision?: 'approve' | 'reject' | 'refund'
        gatewayStatus?: SubscriptionPaymentStatus
        reportedAmountInr?: number
        reason?: string
      }

      const row = db
        .prepare('SELECT * FROM subscription_payments WHERE id = ?')
        .get(paymentId) as Record<string, unknown> | undefined
      if (!row) {
        res.status(404).json({ error: 'Subscription payment record not found.' })
        return
      }

      const orgId = String(row.organization_id)
      const orgRow = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as Record<string, unknown> | undefined
      if (!orgRow) {
        res.status(404).json({ error: 'Organization not found.' })
        return
      }
      const org = mapOrgRow(orgRow)
      const nowIso = new Date().toISOString()
      const todayIso = nowIso.slice(0, 10)
      const decision = body.decision ?? 'approve'

      if (decision === 'refund') {
        if (String(row.status) !== 'successful') {
          res.status(400).json({ error: 'Only verified successful payments can be refunded.' })
          return
        }
        db.prepare("UPDATE subscription_payments SET status = 'refunded', failure_reason = ?, updated_at = ? WHERE id = ?").run(
          body.reason?.trim() || 'Refunded by Platform Admin.',
          nowIso,
          paymentId,
        )
        db.prepare("UPDATE subscriptions SET status = 'pending_payment', updated_at = ? WHERE organization_id = ?").run(nowIso, orgId)
        db.prepare("UPDATE organizations SET status = 'payment_pending', payment_status = 'cancelled' WHERE id = ?").run(orgId)
        emitNotification(db, {
          organizationId: orgId,
          recipientRole: 'org_admin',
          eventType: 'SUBSCRIPTION_PAYMENT_REFUNDED',
          title: 'Subscription payment refunded',
          message: `Payment ${paymentId} (₹${Number(row.total_amount_inr).toLocaleString('en-IN')}) was refunded.`,
          module: 'subscription',
          entityId: paymentId,
          actionUrl: '/dashboard/subscription',
          severity: 'warning',
        })
        res.json({ ok: true, status: 'refunded' })
        return
      }

      if (decision === 'reject') {
        const reason = body.reason?.trim() || 'Payment verification rejected by Platform Admin.'
        db.prepare("UPDATE subscription_payments SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ?").run(
          reason,
          nowIso,
          paymentId,
        )
        db.prepare("UPDATE subscriptions SET status = 'pending_payment', updated_at = ? WHERE organization_id = ?").run(nowIso, orgId)
        emitNotification(db, {
          organizationId: orgId,
          recipientRole: 'org_admin',
          eventType: 'SUBSCRIPTION_PAYMENT_REJECTED',
          title: 'Subscription payment verification failed',
          message: reason,
          module: 'subscription',
          entityId: paymentId,
          actionUrl: '/dashboard/subscription',
          severity: 'critical',
        })
        res.json({ ok: true, status: 'failed' })
        return
      }

      // Decision: approve — enforce strict verification + idempotency + amount matching
      const prevProcessed = db
        .prepare("SELECT gateway_reference FROM subscription_payments WHERE status = 'successful' AND id != ? AND gateway_reference IS NOT NULL")
        .all(paymentId) as Array<{ gateway_reference: string }>
      const existingRefs = new Set(prevProcessed.map((p) => p.gateway_reference))

      const verification = verifyPaymentAttempt({
        expectedAmountInr: Number(row.total_amount_inr),
        reportedAmountInr:
          body.reportedAmountInr !== undefined
            ? Number(body.reportedAmountInr)
            : Number(row.reported_amount_inr ?? row.total_amount_inr),
        gatewayStatus: body.gatewayStatus ?? 'successful',
        currentStatus: String(row.status) as SubscriptionPaymentStatus,
        gatewayReference: row.gateway_reference ? String(row.gateway_reference) : null,
        existingProcessedReferences: existingRefs,
      })

      if (!verification.verified) {
        db.prepare('UPDATE subscription_payments SET status = ?, failure_reason = ?, updated_at = ? WHERE id = ?').run(
          verification.nextStatus,
          verification.reason,
          nowIso,
          paymentId,
        )
        res.status(400).json({ verified: false, error: verification.reason })
        return
      }

      const cycle = String(row.billing_cycle) === 'annual' ? 'annual' : 'monthly'
      const subRow = db.prepare('SELECT current_period_end FROM subscriptions WHERE organization_id = ?').get(orgId) as
        | { current_period_end?: string | null }
        | undefined
      const anchorStart =
        subRow?.current_period_end && subRow.current_period_end > todayIso
          ? subRow.current_period_end
          : todayIso
      const nextPeriodEnd = addBillingPeriod(anchorStart, cycle)
      const invoiceId = `sinv-${crypto.randomUUID().slice(0, 8)}`
      const invoiceNum = `DM-${org.code}-${todayIso.replace(/-/g, '').slice(0, 6)}-${Math.floor(100 + Math.random() * 899)}`

      db.prepare(`
        UPDATE subscription_payments
        SET status = 'successful', invoice_id = ?, verified_by = ?, verified_at = ?, failure_reason = NULL, updated_at = ?
        WHERE id = ?
      `).run(invoiceId, req.authUser!.username, nowIso, nowIso, paymentId)

      db.prepare(`
        UPDATE subscriptions
        SET plan_id = ?, billing_frequency = ?, status = 'active',
            current_period_start = ?, current_period_end = ?, cancel_at_period_end = 0, updated_at = ?
        WHERE organization_id = ?
      `).run(cycle, cycle, todayIso, nextPeriodEnd, nowIso, orgId)

      db.prepare(`
        UPDATE organizations
        SET plan_id = ?, billing_frequency = ?, vehicle_limit = ?, driver_limit = ?,
            status = 'active', payment_status = 'paid', onboarding_completed = 1, onboarding_step = 6,
            subscription_start_date = ?, subscription_expiry_date = ?
        WHERE id = ?
      `).run(cycle, cycle, UNLIMITED_SEAT_CAP, UNLIMITED_SEAT_CAP, todayIso, nextPeriodEnd, orgId)

      db.prepare(`
        INSERT INTO saas_billing_invoices (
          id, organization_id, invoice_number, plan_id, billing_cycle,
          base_amount_inr, gst_inr, total_inr, status, period_start, period_end, issued_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)
      `).run(
        invoiceId,
        orgId,
        invoiceNum,
        cycle,
        cycle,
        Number(row.base_amount_inr),
        Number(row.tax_amount_inr),
        Number(row.total_amount_inr),
        todayIso,
        nextPeriodEnd,
        nowIso,
        `Verified ${cycle.toUpperCase()} subscription payment (${String(row.gateway_reference || paymentId)})`,
      )

      db.prepare(`
        INSERT INTO platform_admin_audit_logs (
          id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
        ) VALUES (?, ?, ?, 'VERIFY_SUBSCRIPTION_PAYMENT', ?, ?, ?, ?, ?)
      `).run(
        `paud-${crypto.randomUUID().slice(0, 8)}`,
        req.authUser!.id,
        req.authUser!.username,
        orgId,
        org.name,
        body.reason?.trim() || `Verified ₹${Number(row.total_amount_inr).toLocaleString('en-IN')} payment & activated workspace.`,
        JSON.stringify({ paymentId, invoiceId, cycle, nextPeriodEnd }),
        nowIso,
      )

      emitNotification(db, {
        organizationId: orgId,
        recipientRole: 'org_admin',
        eventType: 'SUBSCRIPTION_ACTIVATED',
        title: `Subscription Activated (${cycle === 'annual' ? 'Annual Plan' : 'Monthly Plan'})`,
        message: `Your payment of ₹${Number(row.total_amount_inr).toLocaleString('en-IN')} was verified. Full DriveMitra access is unlocked until ${nextPeriodEnd}.`,
        module: 'subscription',
        entityId: invoiceId,
        actionUrl: '/dashboard',
        severity: 'success',
      })

      res.json({
        verified: true,
        status: 'active',
        currentPeriodEnd: nextPeriodEnd,
        invoiceNumber: invoiceNum,
      })
    },
  )

  router.patch(
    '/platform-admin/organizations/:orgId/grace-policy',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const orgId = String(req.params.orgId)
      const body = req.body as {
        gracePeriodDays?: number
        expiredAccessPolicy?: 'read_only' | 'blocked'
        currentPeriodEnd?: string
      }
      const graceDays = Math.max(0, Math.min(60, Number(body.gracePeriodDays ?? 0)))
      const policy = body.expiredAccessPolicy === 'blocked' ? 'blocked' : 'read_only'
      const nowIso = new Date().toISOString()

      db.prepare(`
        UPDATE subscriptions
        SET grace_period_days = ?, expired_access_policy = ?,
            current_period_end = COALESCE(?, current_period_end), updated_at = ?
        WHERE organization_id = ?
      `).run(graceDays, policy, body.currentPeriodEnd || null, nowIso, orgId)

      db.prepare(`
        UPDATE organizations
        SET grace_period_days = ?, expired_access_policy = ?,
            subscription_expiry_date = COALESCE(?, subscription_expiry_date)
        WHERE id = ?
      `).run(graceDays, policy, body.currentPeriodEnd || null, orgId)

      res.json({ ok: true, gracePeriodDays: graceDays, expiredAccessPolicy: policy })
    },
  )

  router.get(
    '/platform-admin/integrations',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      const rows = getDb()
        .prepare('SELECT * FROM platform_integrations_config ORDER BY category ASC, name ASC')
        .all() as Array<Record<string, unknown>>
      res.json({
        integrations: rows.map((r) => ({
          id: String(r.id),
          providerKey: String(r.provider_key),
          name: String(r.name),
          category: String(r.category),
          status: String(r.status),
          config: JSON.parse(String(r.config_json || '{}')),
          updatedBy: r.updated_by ? String(r.updated_by) : null,
          updatedAt: String(r.updated_at),
        })),
      })
    },
  )

  router.put(
    '/platform-admin/integrations/:providerKey',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const providerKey = String(req.params.providerKey)
      const body = req.body as { status?: string; config?: Record<string, unknown> }
      const existing = db
        .prepare('SELECT * FROM platform_integrations_config WHERE provider_key = ?')
        .get(providerKey) as Record<string, unknown> | undefined
      if (!existing) {
        res.status(404).json({ error: 'Platform integration provider not found.' })
        return
      }
      const nowIso = new Date().toISOString()
      const nextStatus = body.status || String(existing.status)
      const nextConfig = body.config ? JSON.stringify(body.config) : String(existing.config_json)
      db.prepare(`
        UPDATE platform_integrations_config
        SET status = ?, config_json = ?, updated_by = ?, updated_at = ?
        WHERE provider_key = ?
      `).run(nextStatus, nextConfig, req.authUser!.username, nowIso, providerKey)

      res.json({ ok: true, providerKey, status: nextStatus })
    },
  )

  router.get(
    '/platform-admin/monitoring',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (_req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const pendingVerifications = db
        .prepare("SELECT COUNT(*) AS count FROM subscription_payments WHERE status = 'pending_verification'")
        .get() as { count: number }
      const failedPayments = db
        .prepare("SELECT COUNT(*) AS count FROM subscription_payments WHERE status = 'failed'")
        .get() as { count: number }
      const activeSessions = db
        .prepare('SELECT COUNT(*) AS count FROM auth_sessions WHERE revoked = 0')
        .get() as { count: number }
      const orgStatuses = db
        .prepare('SELECT status, COUNT(*) AS count FROM organizations GROUP BY status')
        .all() as Array<{ status: string; count: number }>
      const supportSessions = db
        .prepare('SELECT * FROM platform_support_sessions ORDER BY started_at DESC LIMIT 20')
        .all() as Array<Record<string, unknown>>

      res.json({
        health: 'healthy',
        timestamp: new Date().toISOString(),
        pendingPaymentVerifications: pendingVerifications.count,
        failedPaymentAttempts: failedPayments.count,
        activeAuthSessions: activeSessions.count,
        organizationStatusBreakdown: orgStatuses,
        recentSupportSessions: supportSessions,
      })
    },
  )

  router.post(
    '/platform-admin/support-access',
    requireAuth,
    requirePasswordChanged,
    requirePlatformAdmin,
    (req: AuthenticatedRequest, res: Response) => {
      const db = getDb()
      const body = req.body as { organizationId?: string; reason?: string }
      if (!body.organizationId || !body.reason || body.reason.trim().length < 5) {
        res.status(400).json({ error: 'Target organizationId and support reason (min 5 chars) are required.' })
        return
      }
      const org = db.prepare('SELECT id, name FROM organizations WHERE id = ?').get(body.organizationId) as
        | { id: string; name: string }
        | undefined
      if (!org) {
        res.status(404).json({ error: 'Target organization not found.' })
        return
      }
      const id = `psup-${crypto.randomUUID().slice(0, 8)}`
      const nowIso = new Date().toISOString()
      db.prepare(`
        INSERT INTO platform_support_sessions (
          id, platform_admin_id, platform_admin_username, organization_id, reason, started_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, req.authUser!.id, req.authUser!.username, org.id, body.reason.trim(), nowIso)

      db.prepare(`
        INSERT INTO platform_admin_audit_logs (
          id, actor_user_id, actor_username, action, target_org_id, target_org_name, reason, metadata_json, created_at
        ) VALUES (?, ?, ?, 'SUPPORT_ACCESS_SESSION', ?, ?, ?, ?, ?)
      `).run(
        `paud-${crypto.randomUUID().slice(0, 8)}`,
        req.authUser!.id,
        req.authUser!.username,
        org.id,
        org.name,
        body.reason.trim(),
        JSON.stringify({ supportSessionId: id }),
        nowIso,
      )

      res.status(201).json({ id, organizationId: org.id, organizationName: org.name, startedAt: nowIso })
    },
  )

  return router
}

function mapDriverExpenseRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    driverId: String(row.driver_id),
    vehicleId: row.vehicle_id ? String(row.vehicle_id) : null,
    tripId: row.trip_id ? String(row.trip_id) : null,
    category: String(row.category),
    amountInr: Number(row.amount_inr),
    expenseDate: String(row.expense_date),
    odometerKm: row.odometer_km != null ? Number(row.odometer_km) : null,
    location: row.location ? String(row.location) : null,
    description: row.description ? String(row.description) : '',
    receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    approvalStatus: String(row.approval_status),
    paymentStatus: String(row.payment_status),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    reviewNote: row.review_note ? String(row.review_note) : null,
    paidBy: row.paid_by ? String(row.paid_by) : null,
    paidAt: row.paid_at ? String(row.paid_at) : null,
    paymentReference: row.payment_reference ? String(row.payment_reference) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapSubscriptionPaymentRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    subscriptionId: String(row.subscription_id),
    planId: String(row.plan_id) === 'annual' ? 'annual' : 'monthly',
    billingCycle: String(row.billing_cycle) === 'annual' ? 'annual' : 'monthly',
    baseAmountInr: Number(row.base_amount_inr),
    taxAmountInr: Number(row.tax_amount_inr),
    totalAmountInr: Number(row.total_amount_inr),
    reportedAmountInr: row.reported_amount_inr != null ? Number(row.reported_amount_inr) : null,
    paymentMethod: String(row.payment_method),
    status: String(row.status),
    gatewayReference: row.gateway_reference ? String(row.gateway_reference) : null,
    invoiceId: row.invoice_id ? String(row.invoice_id) : null,
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    verifiedAt: row.verified_at ? String(row.verified_at) : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
