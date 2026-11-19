import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatCookieHeader,
  generateTemporaryPassword,
  getBackendRedirectForRole,
  hashPassword,
  hashToken,
  isOrganizationLoginAllowed,
  LoginRateLimiter,
  parseCookies,
  sanitizeCopilotPayloadForLlm,
  validatePasswordStrength,
  verifyPassword,
} from './authLogic.ts'

test('scrypt password hashing verifies correct password and rejects wrong password', () => {
  const hash = hashPassword('FleetOwner#2026')
  assert.ok(hash.startsWith('scrypt:'))
  assert.equal(verifyPassword('FleetOwner#2026', hash), true)
  assert.equal(verifyPassword('WrongPass#2026', hash), false)
})

test('password complexity enforces length and character classes', () => {
  assert.ok(validatePasswordStrength('short1A'))
  assert.ok(validatePasswordStrength('alllowercase123'))
  assert.ok(validatePasswordStrength('ALLUPPERCASE123'))
  assert.ok(validatePasswordStrength('NoNumbersHere'))
  assert.equal(validatePasswordStrength('StrongPass2026'), null)
})

test('temporary password generator satisfies password strength rules', () => {
  const tmp = generateTemporaryPassword()
  assert.equal(validatePasswordStrength(tmp), null)
})

test('SHA-256 token hashing and HttpOnly cookie helpers work deterministically', () => {
  const h1 = hashToken('raw-session-token-123')
  const h2 = hashToken('raw-session-token-123')
  assert.equal(h1, h2)
  assert.equal(h1.length, 64)

  const header = formatCookieHeader('dm_session', 'abc123', 3600)
  assert.ok(header.includes('HttpOnly'))
  assert.ok(header.includes('SameSite=Lax'))
  const parsed = parseCookies('foo=bar; dm_session=abc123')
  assert.equal(parsed.dm_session, 'abc123')
})

test('login rate limiter locks after max failures and resets on success', () => {
  const limiter = new LoginRateLimiter(3, 60_000)
  const key = '127.0.0.1::owner'
  assert.equal(limiter.check(key, 1000).allowed, true)
  limiter.recordFailure(key, 1000)
  limiter.recordFailure(key, 1001)
  assert.equal(limiter.check(key, 1002).allowed, true)
  limiter.recordFailure(key, 1003)
  assert.equal(limiter.check(key, 1004).allowed, false)
  limiter.recordSuccess(key)
  assert.equal(limiter.check(key, 1005).allowed, true)
})

test('organization status blocks suspended/terminated/archived logins and allows active/grace_period/payment_pending', () => {
  assert.equal(isOrganizationLoginAllowed('active').allowed, true)
  assert.equal(isOrganizationLoginAllowed('payment_pending').allowed, true)
  assert.equal(isOrganizationLoginAllowed('grace_period').allowed, true)
  assert.equal(isOrganizationLoginAllowed('suspended').allowed, false)
  assert.equal(isOrganizationLoginAllowed('terminated').allowed, false)
  assert.equal(isOrganizationLoginAllowed('archived').allowed, false)
})

test('backend role redirect strictly separates platform_admin from fleet owner roles', () => {
  assert.equal(getBackendRedirectForRole('platform_admin'), '/platform-admin')
  assert.equal(getBackendRedirectForRole('org_admin'), '/dashboard')
  assert.equal(getBackendRedirectForRole('fleet_manager'), '/dashboard')
  assert.equal(getBackendRedirectForRole('maintenance'), '/dashboard/maintenance')
  assert.equal(getBackendRedirectForRole('finance'), '/dashboard/financials')
  assert.equal(getBackendRedirectForRole('viewer'), '/dashboard')
})

test('Dhiyu PII sanitizer redacts Aadhaar, PAN, and Indian mobile numbers', () => {
  const raw = 'Driver Ramesh phone +91 98401 12345 PAN ABCDE1234F Aadhaar 1234 5678 9012'
  const clean = sanitizeCopilotPayloadForLlm(raw)
  assert.ok(!clean.includes('98401 12345'))
  assert.ok(!clean.includes('ABCDE1234F'))
  assert.ok(!clean.includes('1234 5678 9012'))
  assert.ok(clean.includes('[REDACTED_PHONE]'))
  assert.ok(clean.includes('[REDACTED_PAN]'))
  assert.ok(clean.includes('[REDACTED_AADHAAR]'))
})
