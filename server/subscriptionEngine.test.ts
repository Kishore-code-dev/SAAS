import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CANONICAL_SUBSCRIPTION_PLANS,
  UNLIMITED_SEAT_CAP,
  addBillingPeriod,
  computeCheckoutTotals,
  evaluateSubscriptionState,
  validateDriverOdometerAndDistance,
  verifyPaymentAttempt,
} from './subscriptionEngine.ts'

describe('Canonical Subscription, GST & Billing Engine', () => {
  it('exposes exactly Monthly (₹3,500) and Annual (₹36,000) with zero feature or seat caps', () => {
    assert.equal(CANONICAL_SUBSCRIPTION_PLANS.length, 2)
    const monthly = CANONICAL_SUBSCRIPTION_PLANS.find((p) => p.id === 'monthly')
    const annual = CANONICAL_SUBSCRIPTION_PLANS.find((p) => p.id === 'annual')
    assert.ok(monthly && annual)
    assert.equal(monthly.baseAmountInr, 3500)
    assert.equal(annual.baseAmountInr, 36000)
    assert.equal(annual.monthlyEquivalentInr, 3000)
    assert.equal(annual.savingsVsMonthlyInr, 6000)
    assert.equal(monthly.vehicleLimit, UNLIMITED_SEAT_CAP)
    assert.equal(annual.driverLimit, UNLIMITED_SEAT_CAP)
    assert.equal(annual.staffLimit, UNLIMITED_SEAT_CAP)
  })

  it('calculates exact 18% GST checkout totals', () => {
    const monthlyCheckout = computeCheckoutTotals('monthly')
    assert.equal(monthlyCheckout.baseAmountInr, 3500)
    assert.equal(monthlyCheckout.taxRatePct, 18)
    assert.equal(monthlyCheckout.taxAmountInr, 630)
    assert.equal(monthlyCheckout.totalPayableInr, 4130)

    const annualCheckout = computeCheckoutTotals('annual')
    assert.equal(annualCheckout.baseAmountInr, 36000)
    assert.equal(annualCheckout.taxRatePct, 18)
    assert.equal(annualCheckout.taxAmountInr, 6480)
    assert.equal(annualCheckout.totalPayableInr, 42480)
  })

  it('handles UTC month-end and leap-year calendar renewals accurately', () => {
    assert.equal(addBillingPeriod('2026-01-31', 'monthly'), '2026-02-28')
    assert.equal(addBillingPeriod('2024-01-31', 'monthly'), '2024-02-29')
    assert.equal(addBillingPeriod('2024-02-29', 'annual'), '2025-02-28')
    assert.equal(addBillingPeriod('2026-11-15', 'monthly'), '2026-12-15')
    assert.equal(addBillingPeriod('2026-12-15', 'monthly'), '2027-01-15')
  })

  it('rejects failed/pending/cancelled payments, amount mismatches, and duplicate references', () => {
    for (const badStatus of ['pending', 'processing', 'failed', 'cancelled', 'refunded'] as const) {
      const res = verifyPaymentAttempt({
        expectedAmountInr: 4130,
        reportedAmountInr: 4130,
        gatewayStatus: badStatus,
        currentStatus: 'pending',
        gatewayReference: `REF-${badStatus}`,
      })
      assert.equal(res.verified, false)
    }

    const mismatch = verifyPaymentAttempt({
      expectedAmountInr: 42480,
      reportedAmountInr: 4130,
      gatewayStatus: 'successful',
      currentStatus: 'pending',
      gatewayReference: 'REF-UNDERPAID',
    })
    assert.equal(mismatch.verified, false)
    assert.equal(mismatch.nextStatus, 'failed')

    const dupeRef = verifyPaymentAttempt({
      expectedAmountInr: 4130,
      reportedAmountInr: 4130,
      gatewayStatus: 'successful',
      currentStatus: 'pending',
      gatewayReference: 'PAY-DUP-1',
      existingProcessedReferences: new Set(['PAY-DUP-1']),
    })
    assert.equal(dupeRef.verified, false)

    const ok = verifyPaymentAttempt({
      expectedAmountInr: 42480,
      reportedAmountInr: 42480,
      gatewayStatus: 'successful',
      currentStatus: 'pending',
      gatewayReference: 'PAY-ANNUAL-OK',
      existingProcessedReferences: new Set(['PAY-DUP-1']),
    })
    assert.equal(ok.verified, true)
    assert.equal(ok.nextStatus, 'successful')
  })

  it('never fabricates arbitrary grace period when gracePeriodDays is 0, and honors configured grace period', () => {
    const expiredNoGrace = evaluateSubscriptionState({
      status: 'active',
      currentPeriodEnd: '2026-11-10',
      gracePeriodDays: 0,
      expiredAccessPolicy: 'read_only',
      nowDate: '2026-11-12',
    })
    assert.equal(expiredNoGrace.effectiveStatus, 'expired')
    assert.equal(expiredNoGrace.operationalAccess, 'read_only')
    assert.equal(expiredNoGrace.inGracePeriod, false)

    const inConfiguredGrace = evaluateSubscriptionState({
      status: 'active',
      currentPeriodEnd: '2026-11-10',
      gracePeriodDays: 5,
      expiredAccessPolicy: 'blocked',
      nowDate: '2026-11-12',
    })
    assert.equal(inConfiguredGrace.effectiveStatus, 'grace_period')
    assert.equal(inConfiguredGrace.operationalAccess, 'full')
    assert.equal(inConfiguredGrace.inGracePeriod, true)

    const pendingOnboarding = evaluateSubscriptionState({
      status: 'pending_payment',
      currentPeriodEnd: null,
      gracePeriodDays: 0,
      expiredAccessPolicy: 'blocked',
      nowDate: '2026-11-12',
    })
    assert.equal(pendingOnboarding.operationalAccess, 'onboarding_only')
  })

  it('validates driver trip odometer readings without fabricating distance', () => {
    const missingStart = validateDriverOdometerAndDistance({
      startOdometerKm: null,
      endOdometerKm: undefined,
      previousVehicleOdometerKm: 12000,
    })
    assert.equal(missingStart.valid, false)

    const lowerEnd = validateDriverOdometerAndDistance({
      startOdometerKm: 12500,
      endOdometerKm: 12490,
      previousVehicleOdometerKm: 12000,
    })
    assert.equal(lowerEnd.valid, false)

    const validExact = validateDriverOdometerAndDistance({
      startOdometerKm: 12500,
      endOdometerKm: 12745,
      previousVehicleOdometerKm: 12500,
      gpsEstimatedDistanceKm: 240,
    })
    assert.equal(validExact.valid, true)
    assert.equal(validExact.distanceKm, 245)
    assert.equal(validExact.flaggedInconsistent, false)

    const mismatchFlag = validateDriverOdometerAndDistance({
      startOdometerKm: 12500,
      endOdometerKm: 13200,
      previousVehicleOdometerKm: 12500,
      gpsEstimatedDistanceKm: 100,
    })
    assert.equal(mismatchFlag.valid, true)
    assert.equal(mismatchFlag.distanceKm, 700)
    assert.equal(mismatchFlag.flaggedInconsistent, true)
  })
})
