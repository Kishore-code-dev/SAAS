import crypto from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import type { AppNotification, OrganizationRole } from '../src/types/fleet.ts'

export interface EmitNotificationInput {
  organizationId?: string | null
  recipientUserId?: string | null
  recipientRole?: OrganizationRole | null
  eventType: string
  title: string
  message: string
  module: string
  entityType?: string | null
  entityId?: string | null
  actionUrl?: string | null
  severity?: 'info' | 'warning' | 'critical' | 'success'
}

function mapNotificationRow(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    recipientUserId: row.recipient_user_id ? String(row.recipient_user_id) : null,
    recipientRole: row.recipient_role ? (String(row.recipient_role) as OrganizationRole) : null,
    eventType: String(row.event_type),
    title: String(row.title),
    message: String(row.message),
    module: String(row.module),
    entityType: row.entity_type ? String(row.entity_type) : null,
    entityId: row.entity_id ? String(row.entity_id) : null,
    actionUrl: row.action_url ? String(row.action_url) : null,
    severity: (String(row.severity || 'info') as AppNotification['severity']),
    isRead: Number(row.is_read) === 1,
    readAt: row.read_at ? String(row.read_at) : null,
    createdAt: String(row.created_at),
  }
}

export function emitNotification(db: DatabaseSync, input: EmitNotificationInput): AppNotification {
  const id = `ntf-${crypto.randomUUID().slice(0, 12)}`
  const createdAt = new Date().toISOString()
  db.prepare(`
    INSERT INTO notifications (
      id, organization_id, recipient_user_id, recipient_role, event_type,
      title, message, module, entity_type, entity_id, action_url, severity,
      is_read, read_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
  `).run(
    id,
    input.organizationId ?? null,
    input.recipientUserId ?? null,
    input.recipientRole ?? null,
    input.eventType,
    input.title,
    input.message,
    input.module,
    input.entityType ?? null,
    input.entityId ?? null,
    input.actionUrl ?? null,
    input.severity ?? 'info',
    createdAt,
  )

  return {
    id,
    organizationId: input.organizationId ?? null,
    recipientUserId: input.recipientUserId ?? null,
    recipientRole: input.recipientRole ?? null,
    eventType: input.eventType,
    title: input.title,
    message: input.message,
    module: input.module,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actionUrl: input.actionUrl ?? null,
    severity: input.severity ?? 'info',
    isRead: false,
    readAt: null,
    createdAt,
  }
}

export function listNotificationsForUser(
  db: DatabaseSync,
  user: { id: string; role: OrganizationRole; organizationId: string | null },
  options: { unreadOnly?: boolean; limit?: number } = {},
): AppNotification[] {
  const limit = Math.min(200, Math.max(1, options.limit ?? 50))
  let rows: Array<Record<string, unknown>>

  if (user.role === 'platform_admin') {
    rows = db
      .prepare(`
        SELECT * FROM notifications
        WHERE (recipient_user_id = ? OR recipient_role = 'platform_admin')
        ${options.unreadOnly ? 'AND is_read = 0' : ''}
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(user.id, limit) as Array<Record<string, unknown>>
  } else if (user.role === 'driver') {
    rows = db
      .prepare(`
        SELECT * FROM notifications
        WHERE organization_id = ?
          AND (recipient_user_id = ? OR (recipient_user_id IS NULL AND recipient_role = 'driver'))
        ${options.unreadOnly ? 'AND is_read = 0' : ''}
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(user.organizationId ?? '', user.id, limit) as Array<Record<string, unknown>>
  } else {
    rows = db
      .prepare(`
        SELECT * FROM notifications
        WHERE organization_id = ?
          AND (
            recipient_user_id = ?
            OR (recipient_user_id IS NULL AND (recipient_role IS NULL OR recipient_role = ?))
          )
        ${options.unreadOnly ? 'AND is_read = 0' : ''}
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(user.organizationId ?? '', user.id, user.role, limit) as Array<Record<string, unknown>>
  }

  return rows.map(mapNotificationRow)
}

export function markNotificationRead(
  db: DatabaseSync,
  notificationId: string,
  user: { id: string; role: OrganizationRole; organizationId: string | null },
): boolean {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId) as
    | Record<string, unknown>
    | undefined
  if (!row) return false
  const ntf = mapNotificationRow(row)

  const allowed =
    ntf.recipientUserId === user.id ||
    (user.role === 'platform_admin' && ntf.recipientRole === 'platform_admin') ||
    (ntf.organizationId !== null &&
      ntf.organizationId === user.organizationId &&
      (ntf.recipientRole === null || ntf.recipientRole === user.role))

  if (!allowed) return false

  db.prepare('UPDATE notifications SET is_read = 1, read_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    notificationId,
  )
  return true
}

export function markAllNotificationsRead(
  db: DatabaseSync,
  user: { id: string; role: OrganizationRole; organizationId: string | null },
): number {
  const now = new Date().toISOString()
  if (user.role === 'platform_admin') {
    const res = db
      .prepare(
        "UPDATE notifications SET is_read = 1, read_at = ? WHERE is_read = 0 AND (recipient_user_id = ? OR recipient_role = 'platform_admin')",
      )
      .run(now, user.id)
    return Number(res.changes ?? 0)
  }

  const res = db
    .prepare(
      `
      UPDATE notifications
      SET is_read = 1, read_at = ?
      WHERE is_read = 0
        AND organization_id = ?
        AND (
          recipient_user_id = ?
          OR (recipient_user_id IS NULL AND (recipient_role IS NULL OR recipient_role = ?))
        )
    `,
    )
    .run(now, user.organizationId ?? '', user.id, user.role)
  return Number(res.changes ?? 0)
}
