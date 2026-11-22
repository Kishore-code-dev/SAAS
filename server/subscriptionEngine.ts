import type {
  BillingFrequency,
  CanonicalSubscriptionStatus,
  SubscriptionPaymentStatus,
  SubscriptionPlanId,
} from '../types/fleet'

export interface CanonicalPlanSpec {
  id: 'monthly' | 'annual'
  name: string
  tagline: string
  billingFrequency: BillingFrequency
  baseAmountInr: number
  gstRatePct: number
  taxAmountInr: number
  totalPayableInr: number
  monthlyEquivalentInr: number
  savingsVsMonthlyInr: number
  savingsPercent: number
  vehicleLimit: number
  driverLimit: number
  staffLimit: number
  limitLabel: string
  features: string[]
}

export const GST_RATE_PCT = 18
export const UNLIMITED_SEAT_CAP = -1

export const CANONICAL_SUBSCRIPTION_PLANS: CanonicalPlanSpec[] = [
  {
    id: 'monthly',
    name: 'Monthly Plan',
    tagline: 'Full DriveMitra Fleet Intelligence SaaS billed every month with zero usage caps.',
    billingFrequency: 'monthly',
    baseAmountInr: 3500,
    gstRatePct: 18,
    taxAmountInr: 630,
    totalPayableInr: 4130,
    monthlyEquivalentInr: 3500,
    savingsVsMonthlyInr: 0,
    savingsPercent: 0,
    vehicleLimit: UNLIMITED_SEAT_CAP,
    driverLimit: UNLIMITED_SEAT_CAP,
    staffLimit: UNLIMITED_SEAT_CAP,
    limitLabel: 'Unlimited vehicles, drivers & staff',
    features: [
      'Unlimited commercial vehicles, drivers & staff seats',
      'Live GPS corridor monitoring & Driver Mobile Portal',
      '5-Area Predictive Health & Risk Radar analytics',
      'Granular 31-module Staff RBAC & activity audit logs',
      'Maintenance, Work Orders, Parts Inventory & Vehicle Finance',
      'Fuel & Driver Expense verification with GST tax invoices',
    ],
  },
  {
    id: 'annual',
    name: 'Annual Plan',
    tagline: 'Identical unrestricted fleet ERP capabilities billed annually with ₹6,000 yearly savings.',
    billingFrequency: 'annual',
    baseAmountInr: 36000,
    gstRatePct: 18,
    taxAmountInr: 6480,
    totalPayableInr: 42480,
    monthlyEquivalentInr: 3000,
    savingsVsMonthlyInr: 6000,
    savingsPercent: 14.29,
    vehicleLimit: UNLIMITED_SEAT_CAP,
    driverLimit: UNLIMITED_SEAT_CAP,
    staffLimit: UNLIMITED_SEAT_CAP,
    limitLabel: 'Unlimited vehicles, drivers & staff',
    features: [
      'Save ₹6,000 / year (14.29% savings — ₹3,000/month eq.)',
      'Unlimited commercial vehicles, drivers & staff seats',
      'Live GPS corridor monitoring & Driver Mobile Portal',
      '5-Area Predictive Health & Risk Radar analytics',
      'Granular 31-module Staff RBAC & activity audit logs',
      'Maintenance, Work Orders, Parts Inventory & Vehicle Finance',
    ],
  },
]

export function normalizePlanId(planId: SubscriptionPlanId | string | null | undefined, billingFrequency?: string): 'monthly' | 'annual' {
  if (planId === 'annual' || billingFrequency === 'annual') return 'annual'
  if (planId === 'monthly') return 'monthly'
  if (planId === 'enterprise') return 'annual'
  return 'monthly'
}

export function getCanonicalPlan(planId: SubscriptionPlanId | string | null | undefined): CanonicalPlanSpec {
  const norm = normalizePlanId(planId)
  return CANONICAL_SUBSCRIPTION_PLANS.find((p) => p.id === norm) ?? CANONICAL_SUBSCRIPTION_PLANS[0]
}

export function computeCheckoutTotals(planId: 'monthly' | 'annual'): {
  plan: CanonicalPlanSpec
  baseAmountInr: number
  taxRatePct: number
  taxAmountInr: number
  totalPayableInr: number
} {
  const plan = getCanonicalPlan(planId)
  const baseAmountInr = plan.baseAmountInr
  const taxRatePct = GST_RATE_PCT
  const taxAmountInr = Math.round((baseAmountInr * taxRatePct) / 100)
  const totalPayableInr = baseAmountInr + taxAmountInr
  return {
    plan,
    baseAmountInr,
    taxRatePct,
    taxAmountInr,
    totalPayableInr,
  }
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInUtcMonth(year: number, monthIndex0: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return days[((monthIndex0 % 12) + 12) % 12]
}

/**
 * Pure UTC calendar billing period advancement handling month-end and leap years:
 * - 2026-01-31 + 1 month -> 2026-02-28
 * - 2024-01-31 + 1 month -> 2024-02-29
 * - 2024-02-29 + 1 year -> 2025-02-28
 */
export function addBillingPeriod(isoDate: string, frequency: BillingFrequency): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim())
  if (!match) {
    throw new Error(`Invalid ISO calendar date "${isoDate}".`)
  }
  let year = Number(match[1])
  let month0 = Number(match[2]) - 1
  const day = Number(match[3])

  if (frequency === 'annual') {
    year += 1
  } else {
    month0 += 1
    if (month0 >= 12) {
      year += Math.floor(month0 / 12)
      month0 = month0 % 12
    }
  }

  const maxDay = daysInUtcMonth(year, month0)
  const clampedDay = Math.min(day, maxDay)
  return `${String(year).padStart(4, '0')}-${String(month0 + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

export interface PaymentVerificationInput {
  expectedAmountInr: number
  reportedAmountInr: number
  gatewayStatus: SubscriptionPaymentStatus
  currentStatus: SubscriptionPaymentStatus
  gatewayReference?: string | null
  existingProcessedReferences?: Set<string>
}

export function verifyPaymentAttempt(input: PaymentVerificationInput): {
  verified: boolean
  nextStatus: SubscriptionPaymentStatus
  reason: string
} {
  if (input.currentStatus === 'successful' || input.currentStatus === 'refunded') {
    return {
      verified: false,
      nextStatus: input.currentStatus,
      reason: `Payment is already finalized with status "${input.currentStatus}". Duplicate processing rejected.`,
    }
  }

  if (
    input.gatewayReference &&
    input.existingProcessedReferences?.has(input.gatewayReference)
  ) {
    return {
      verified: false,
      nextStatus: input.currentStatus,
      reason: `Duplicate gateway reference "${input.gatewayReference}" already processed (idempotency violation).`,
    }
  }

  if (input.gatewayStatus !== 'successful') {
    return {
      verified: false,
      nextStatus: input.gatewayStatus,
      reason: `Gateway reported status "${input.gatewayStatus}". Subscription cannot activate without verified successful payment.`,
    }
  }

  if (Math.round(input.reportedAmountInr) !== Math.round(input.expectedAmountInr)) {
    return {
      verified: false,
      nextStatus: 'failed',
      reason: `Payment amount mismatch: expected ₹${input.expectedAmountInr}, received ₹${input.reportedAmountInr}.`,
    }
  }

  return {
    verified: true,
    nextStatus: 'successful',
    reason: 'Payment signature and payable amount verified.',
  }
}

export function evaluateSubscriptionState(input: {
  status: CanonicalSubscriptionStatus
  currentPeriodEnd: string | null
  gracePeriodDays: number
  expiredAccessPolicy: 'read_only' | 'blocked'
  nowDate?: string
}): {
  effectiveStatus: CanonicalSubscriptionStatus
  operationalAccess: 'full' | 'read_only' | 'blocked' | 'onboarding_only'
  daysRemaining: number | null
  inGracePeriod: boolean
} {
  const today = (input.nowDate ?? new Date().toISOString().slice(0, 10)).slice(0, 10)

  if (input.status === 'pending_payment' || input.status === 'pending_verification') {
    return {
      effectiveStatus: input.status,
      operationalAccess: 'onboarding_only',
      daysRemaining: null,
      inGracePeriod: false,
    }
  }

  if (input.status === 'suspended' || input.status === 'cancelled') {
    return {
      effectiveStatus: input.status,
      operationalAccess: input.status === 'cancelled' && input.currentPeriodEnd && today <= input.currentPeriodEnd
        ? 'full'
        : input.expiredAccessPolicy === 'blocked'
          ? 'blocked'
          : 'read_only',
      daysRemaining: null,
      inGracePeriod: false,
    }
  }

  if (!input.currentPeriodEnd) {
    return {
      effectiveStatus: input.status,
      operationalAccess: input.status === 'active' ? 'full' : 'read_only',
      daysRemaining: null,
      inGracePeriod: false,
    }
  }

  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const endMs = Date.parse(`${input.currentPeriodEnd.slice(0, 10)}T00:00:00Z`)
  const daysRemaining = Math.floor((endMs - todayMs) / 86400000)

  if (daysRemaining >= 0) {
    return {
      effectiveStatus: daysRemaining <= 7 ? 'renewal_due' : 'active',
      operationalAccess: 'full',
      daysRemaining,
      inGracePeriod: false,
    }
  }

  const overdueDays = Math.abs(daysRemaining)
  // Guardrail: never invent an arbitrary grace period if gracePeriodDays is 0
  if (input.gracePeriodDays > 0 && overdueDays <= input.gracePeriodDays) {
    return {
      effectiveStatus: 'grace_period',
      operationalAccess: 'full',
      daysRemaining: 0,
      inGracePeriod: true,
    }
  }

  return {
    effectiveStatus: 'expired',
    operationalAccess: input.expiredAccessPolicy === 'blocked' ? 'blocked' : 'read_only',
    daysRemaining,
    inGracePeriod: false,
  }
}

export function validateDriverOdometerAndDistance(input: {
  startOdometerKm: number | null | undefined
  endOdometerKm: number | null | undefined
  previousVehicleOdometerKm: number | null | undefined
  gpsEstimatedDistanceKm?: number | null
}): {
  valid: boolean
  distanceKm: number | null
  flaggedInconsistent: boolean
  flagReason: string | null
  error?: string
} {
  if (input.startOdometerKm == null || !Number.isFinite(input.startOdometerKm) || input.startOdometerKm < 0) {
    return {
      valid: false,
      distanceKm: null,
      flaggedInconsistent: true,
      flagReason: 'Start odometer reading is required and must be zero or positive.',
      error: 'Start odometer reading is required and must be zero or positive.',
    }
  }

  if (input.endOdometerKm === undefined) {
    // Validating trip start only
    if (
      input.previousVehicleOdometerKm != null &&
      input.startOdometerKm < input.previousVehicleOdometerKm
    ) {
      return {
        valid: true,
        distanceKm: null,
        flaggedInconsistent: true,
        flagReason: `Entered start odometer (${input.startOdometerKm} km) is lower than vehicle's previous odometer (${input.previousVehicleOdometerKm} km). Flagged for supervisor review.`,
      }
    }
    return { valid: true, distanceKm: null, flaggedInconsistent: false, flagReason: null }
  }

  if (input.endOdometerKm == null || !Number.isFinite(input.endOdometerKm)) {
    return {
      valid: false,
      distanceKm: null,
      flaggedInconsistent: true,
      flagReason: 'End odometer reading is missing.',
      error: 'End odometer reading is required to complete the trip.',
    }
  }

  if (input.endOdometerKm < input.startOdometerKm) {
    return {
      valid: false,
      distanceKm: null,
      flaggedInconsistent: true,
      flagReason: `End odometer (${input.endOdometerKm} km) cannot be lower than start odometer (${input.startOdometerKm} km).`,
      error: `End odometer (${input.endOdometerKm} km) cannot be lower than start odometer (${input.startOdometerKm} km).`,
    }
  }

  const actualDistance = Number((input.endOdometerKm - input.startOdometerKm).toFixed(1))
  let flaggedInconsistent = false
  let flagReason: string | null = null

  if (
    input.previousVehicleOdometerKm != null &&
    input.startOdometerKm < input.previousVehicleOdometerKm
  ) {
    flaggedInconsistent = true
    flagReason = `Start odometer (${input.startOdometerKm} km) below prior vehicle reading (${input.previousVehicleOdometerKm} km).`
  } else if (
    input.gpsEstimatedDistanceKm != null &&
    input.gpsEstimatedDistanceKm > 5 &&
    actualDistance > 0 &&
    Math.abs(actualDistance - input.gpsEstimatedDistanceKm) / Math.max(actualDistance, input.gpsEstimatedDistanceKm) > 0.45
  ) {
    flaggedInconsistent = true
    flagReason = `Odometer distance (${actualDistance} km) differs significantly from GPS corridor distance (${input.gpsEstimatedDistanceKm} km).`
  }

  return {
    valid: true,
    distanceKm: actualDistance,
    flaggedInconsistent,
    flagReason,
  }
}
