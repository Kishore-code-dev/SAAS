import crypto from 'node:crypto'
import type { OrganizationRole, OrganizationStatus } from '../src/types/fleet.ts'

export const SESSION_COOKIE_NAME = 'dm_session'
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.startsWith('scrypt:')) return false
  const parts = storedHash.split(':')
  if (parts.length !== 3) return false
  const [, salt, hashHex] = parts
  try {
    const derived = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(hashHex, 'hex')
    if (derived.length !== expected.length) return false
    return crypto.timingSafeEqual(derived, expected)
  } catch {
    return false
  }
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex')
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex')
}

export function generateTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '@#$%&*!'
  const pick = (pool: string) => pool[crypto.randomInt(0, pool.length)]
  const chars = [
    pick(upper),
    pick(upper),
    pick(lower),
    pick(lower),
    pick(lower),
    pick(digits),
    pick(digits),
    pick(special),
    pick(upper + lower + digits),
    pick(upper + lower + digits),
  ]
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters long.'
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include uppercase, lowercase, and numeric characters.'
  }
  return null
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {}
  const out: Record<string, string> = {}
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    const val = part.slice(eq + 1).trim()
    try {
      out[key] = decodeURIComponent(val)
    } catch {
      out[key] = val
    }
  }
  return out
}

export function formatCookieHeader(name: string, value: string, maxAgeSeconds: number): string {
  const isProd = process.env.NODE_ENV === 'production'
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ]
  if (isProd) parts.push('Secure')
  return parts.join('; ')
}

export function isOrganizationLoginAllowed(status: OrganizationStatus): {
  allowed: boolean
  message?: string
} {
  if (status === 'suspended') {
    return {
      allowed: false,
      message: 'Your organization account is currently suspended. Contact DriveMitra support or your administrator.',
    }
  }
  if (status === 'terminated') {
    return {
      allowed: false,
      message: 'Your organization workspace has been terminated. Please contact DriveMitra billing support.',
    }
  }
  if (status === 'archived') {
    return {
      allowed: false,
      message: 'Your organization workspace is archived and read-disabled.',
    }
  }
  return { allowed: true }
}

export function getBackendRedirectForRole(role: OrganizationRole): string {
  if (role === 'platform_admin') return '/platform-admin'
  if (role === 'driver') return '/driver'
  if (role === 'maintenance') return '/dashboard/maintenance'
  if (role === 'finance') return '/dashboard/financials'
  return '/dashboard'
}

export class LoginRateLimiter {
  private attempts = new Map<string, { count: number; lockedUntilMs: number }>()
  private readonly maxAttempts: number
  private readonly windowMs: number

  constructor(maxAttempts = 6, windowMs = 5 * 60 * 1000) {
    this.maxAttempts = maxAttempts
    this.windowMs = windowMs
  }

  check(key: string, nowMs = Date.now()): { allowed: boolean; retryAfterSec: number } {
    const entry = this.attempts.get(key)
    if (!entry) return { allowed: true, retryAfterSec: 0 }
    if (entry.lockedUntilMs > nowMs) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntilMs - nowMs) / 1000) }
    }
    if (entry.lockedUntilMs > 0 && entry.lockedUntilMs <= nowMs) {
      this.attempts.delete(key)
    }
    return { allowed: true, retryAfterSec: 0 }
  }

  recordFailure(key: string, nowMs = Date.now()): void {
    const entry = this.attempts.get(key) ?? { count: 0, lockedUntilMs: 0 }
    entry.count += 1
    if (entry.count >= this.maxAttempts) {
      entry.lockedUntilMs = nowMs + this.windowMs
    }
    this.attempts.set(key, entry)
  }

  recordSuccess(key: string): void {
    this.attempts.delete(key)
  }
}

export const ALLOWED_DOCUMENT_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

export function sanitizeCopilotPayloadForLlm(rawText: string): string {
  return rawText
    .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, '[REDACTED_PAN]')
    .replace(/(?:\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}\b/g, '[REDACTED_PHONE]')
}
