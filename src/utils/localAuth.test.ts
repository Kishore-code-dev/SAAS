import test from 'node:test'
import assert from 'node:assert/strict'
import {
  authenticateLocalAccount,
  issueLocalOtpChallenge,
  OTP_TTL_MS,
  registerLocalAccount,
  validateEmailFormat,
  verifyLocalOtpChallenge,
} from './localAuth'

test('validateEmailFormat accepts standard emails and rejects malformed input', () => {
  assert.equal(validateEmailFormat('ops@kaveri.in'), true)
  assert.equal(validateEmailFormat('bad-email'), false)
  assert.equal(validateEmailFormat(''), false)
})

test('registerLocalAccount creates account locally and rejects duplicate or weak passwords', () => {
  const res1 = registerLocalAccount([], {
    email: 'Ops@Kaveri.in ',
    password: 'password123',
    fullName: 'Priya Sundar',
  })
  assert.equal(res1.error, undefined)
  assert.equal(res1.accounts.length, 1)
  assert.equal(res1.account?.email, 'ops@kaveri.in')

  const dup = registerLocalAccount(res1.accounts, {
    email: 'ops@kaveri.in',
    password: 'password123',
    fullName: 'Priya Sundar',
  })
  assert.match(dup.error ?? '', /already exists/i)

  const weak = registerLocalAccount([], {
    email: 'new@kaveri.in',
    password: '123',
    fullName: 'Test',
  })
  assert.match(weak.error ?? '', /8 characters/i)
})

test('authenticateLocalAccount verifies credentials locally and rejects unregistered or wrong passwords', () => {
  const { accounts } = registerLocalAccount([], {
    email: 'admin@kaveri.in',
    password: 'secretpassword',
    fullName: 'Karthikeyan R',
  })

  const ok = authenticateLocalAccount(accounts, {
    email: 'ADMIN@kaveri.in',
    password: 'secretpassword',
  })
  assert.equal(ok.error, undefined)
  assert.equal(ok.account?.fullName, 'Karthikeyan R')

  const wrongPw = authenticateLocalAccount(accounts, {
    email: 'admin@kaveri.in',
    password: 'wrongpassword',
  })
  assert.equal(wrongPw.error, 'Invalid email or password.')

  const unknown = authenticateLocalAccount(accounts, {
    email: 'nobody@kaveri.in',
    password: 'secretpassword',
  })
  assert.equal(unknown.error, 'Invalid email or password.')
})

test('local OTP issue and verify validates code, consumes challenge, and rejects expired/wrong codes', () => {
  const now = 1_700_000_000_000
  const issued = issueLocalOtpChallenge([], 'driver@kaveri.in', now, '482910')
  assert.equal(issued.error, undefined)
  assert.equal(issued.challenge?.code, '482910')

  const wrongCode = verifyLocalOtpChallenge(issued.challenges, [], {
    email: 'driver@kaveri.in',
    token: '999999',
    nowMs: now + 1000,
  })
  assert.match(wrongCode.error ?? '', /Invalid or expired/i)

  const expired = verifyLocalOtpChallenge(issued.challenges, [], {
    email: 'driver@kaveri.in',
    token: '482910',
    nowMs: now + OTP_TTL_MS + 1,
  })
  assert.match(expired.error ?? '', /Invalid or expired/i)

  const valid = verifyLocalOtpChallenge(issued.challenges, [], {
    email: 'driver@kaveri.in',
    token: '482910',
    nowMs: now + 5000,
  })
  assert.equal(valid.error, undefined)
  assert.equal(valid.user?.email, 'driver@kaveri.in')
  assert.equal(valid.challenges.length, 0)
})
