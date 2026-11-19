import type { OrganizationRole } from '../types/fleet'

export interface LocalAccountRecord {
  id: string
  email: string
  fullName: string
  passwordHash: string
  role: OrganizationRole
  createdAt: string
}

export interface LocalAuthUser {
  id: string
  email: string
  user_metadata: {
    full_name: string
    role: OrganizationRole
  }
}

export interface LocalAuthSession {
  access_token: string
  user: LocalAuthUser
  issuedAt: string
}

export interface LocalOtpChallenge {
  email: string
  code: string
  expiresAtMs: number
}

export const OTP_TTL_MS = 5 * 60 * 1000

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export function hashPasswordLocal(password: string, email: string): string {
  const input = `${email.trim().toLowerCase()}::${password}::dm_local_v1`
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i)
    h1 ^= c
    h1 = Math.imul(h1, 0x01000193)
    h2 ^= c + i
    h2 = Math.imul(h2, 0x85ebca6b)
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`
}

export function toLocalAuthUser(record: Pick<LocalAccountRecord, 'id' | 'email' | 'fullName' | 'role'>): LocalAuthUser {
  return {
    id: record.id,
    email: record.email,
    user_metadata: {
      full_name: record.fullName,
      role: record.role,
    },
  }
}

export function registerLocalAccount(
  accounts: LocalAccountRecord[],
  params: { email: string; password: string; fullName: string; role?: OrganizationRole; nowIso?: string },
): { accounts: LocalAccountRecord[]; account?: LocalAccountRecord; error?: string } {
  const cleanEmail = params.email.trim().toLowerCase()
  const cleanName = params.fullName.trim()

  if (!validateEmailFormat(cleanEmail)) {
    return { accounts, error: 'Enter a valid work email address.' }
  }
  if (!cleanName) {
    return { accounts, error: 'Full name is required to create a workspace.' }
  }
  if (!params.password || params.password.length < 8) {
    return { accounts, error: 'Password must be at least 8 characters long.' }
  }
  if (accounts.some((a) => a.email === cleanEmail)) {
    return { accounts, error: 'An account with this email already exists. Please sign in.' }
  }

  const created: LocalAccountRecord = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: cleanEmail,
    fullName: cleanName,
    passwordHash: hashPasswordLocal(params.password, cleanEmail),
    role: params.role ?? 'fleet_manager',
    createdAt: params.nowIso ?? new Date().toISOString(),
  }

  return {
    accounts: [...accounts, created],
    account: created,
  }
}

export function authenticateLocalAccount(
  accounts: LocalAccountRecord[],
  params: { email: string; password: string },
): { account?: LocalAccountRecord; error?: string } {
  const cleanEmail = params.email.trim().toLowerCase()
  if (!validateEmailFormat(cleanEmail)) {
    return { error: 'Enter a valid work email address.' }
  }
  if (!params.password || params.password.length < 6) {
    return { error: 'Enter your password (minimum 6 characters).' }
  }

  const found = accounts.find((a) => a.email === cleanEmail)
  if (!found || found.passwordHash !== hashPasswordLocal(params.password, cleanEmail)) {
    return { error: 'Invalid email or password.' }
  }

  return { account: found }
}

export function generateSixDigitOtp(): string {
  const num = Math.floor(100000 + Math.random() * 900000)
  return String(num)
}

export function issueLocalOtpChallenge(
  challenges: LocalOtpChallenge[],
  email: string,
  nowMs = Date.now(),
  explicitCode?: string,
): { challenges: LocalOtpChallenge[]; challenge?: LocalOtpChallenge; error?: string } {
  const cleanEmail = email.trim().toLowerCase()
  if (!validateEmailFormat(cleanEmail)) {
    return { challenges, error: 'Enter a valid work email address.' }
  }

  const code = explicitCode ?? generateSixDigitOtp()
  const challenge: LocalOtpChallenge = {
    email: cleanEmail,
    code,
    expiresAtMs: nowMs + OTP_TTL_MS,
  }

  const filtered = challenges.filter((c) => c.email !== cleanEmail && c.expiresAtMs > nowMs)
  return {
    challenges: [...filtered, challenge],
    challenge,
  }
}

export function verifyLocalOtpChallenge(
  challenges: LocalOtpChallenge[],
  accounts: LocalAccountRecord[],
  params: { email: string; token: string; nowMs?: number },
): { challenges: LocalOtpChallenge[]; user?: LocalAuthUser; error?: string } {
  const cleanEmail = params.email.trim().toLowerCase()
  const cleanToken = params.token.trim()
  const nowMs = params.nowMs ?? Date.now()

  if (!validateEmailFormat(cleanEmail)) {
    return { challenges, error: 'Enter a valid email address.' }
  }
  if (!/^\d{6}$/.test(cleanToken)) {
    return { challenges, error: 'Enter the 6-digit verification code.' }
  }

  const match = challenges.find((c) => c.email === cleanEmail)
  if (!match || match.expiresAtMs < nowMs || match.code !== cleanToken) {
    return { challenges, error: 'Invalid or expired verification code.' }
  }

  const existingAccount = accounts.find((a) => a.email === cleanEmail)
  const fallbackName = cleanEmail
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())

  const user = existingAccount
    ? toLocalAuthUser(existingAccount)
    : toLocalAuthUser({
        id: `otp-${Date.now()}`,
        email: cleanEmail,
        fullName: fallbackName || 'Fleet Operator',
        role: 'fleet_manager',
      })

  return {
    challenges: challenges.filter((c) => c.email !== cleanEmail),
    user,
  }
}
