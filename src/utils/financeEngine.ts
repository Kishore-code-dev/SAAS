import type {
  EmiInstalment,
  EmiPaymentStatus,
  FinanceAlertEvent,
  FinanceDocumentItem,
  FinanceInterestType,
  FinanceNotificationSettings,
  FinancePaymentTransaction,
  VehicleFinanceRecord,
  VehicleFinanceStatus,
} from '../types/finance'

export function roundInr(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function maskAccountNumber(raw: string | null | undefined): string {
  const clean = (raw ?? '').trim()
  if (!clean) return '••••'
  if (clean.length <= 4) return '•'.repeat(clean.length)
  return `${'•'.repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`
}

export function getTodayIsoInTz(timeZone = 'Asia/Kolkata', nowMs = Date.now()): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(new Date(nowMs))
  } catch {
    return new Date(nowMs).toISOString().slice(0, 10)
  }
}

export function addMonthsIso(isoDate: string, monthsToAdd: number): string {
  const [yStr, mStr, dStr] = isoDate.slice(0, 10).split('-')
  const year = Number(yStr)
  const monthIdx = Number(mStr) - 1
  const day = Number(dStr)
  if (!Number.isFinite(year) || !Number.isFinite(monthIdx) || !Number.isFinite(day)) {
    return isoDate.slice(0, 10)
  }
  const targetMonthTotal = year * 12 + monthIdx + monthsToAdd
  const targetYear = Math.floor(targetMonthTotal / 12)
  const targetMonthIdx = ((targetMonthTotal % 12) + 12) % 12
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIdx + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, daysInTargetMonth)
  const mm = String(targetMonthIdx + 1).padStart(2, '0')
  const dd = String(clampedDay).padStart(2, '0')
  return `${targetYear}-${mm}-${dd}`
}

export function diffDaysIso(targetIso: string, baseIso: string): number {
  const t = Date.parse(`${targetIso.slice(0, 10)}T00:00:00Z`)
  const b = Date.parse(`${baseIso.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(t) || !Number.isFinite(b)) return 0
  return Math.round((t - b) / 86400000)
}

export interface ScheduleGenerationInput {
  organizationId: string
  financeId: string
  vehicleId: string
  netFinancedAmount: number
  interestRateAnnualPct: number
  interestType: FinanceInterestType
  numberOfInstalments: number
  firstEmiDate: string
  customEmiAmount?: number
  startingEmiNumber?: number
  nowIso?: string
}

export function computeStandardEmiAmount(
  principal: number,
  annualRatePct: number,
  instalments: number,
  interestType: FinanceInterestType,
  customEmiAmount?: number,
): number {
  const p = Math.max(0, Number(principal) || 0)
  const n = Math.max(1, Math.round(Number(instalments) || 1))
  const annualR = Math.max(0, Number(annualRatePct) || 0)
  const monthlyRate = annualR / 12 / 100

  if ((interestType === 'custom' || interestType === 'lease_fixed') && customEmiAmount && customEmiAmount > 0) {
    return roundInr(customEmiAmount)
  }
  if (interestType === 'flat_rate') {
    const totalInterest = p * (annualR / 100) * (n / 12)
    return roundInr((p + totalInterest) / n)
  }
  if (interestType === 'interest_only_balloon') {
    return roundInr(p * monthlyRate)
  }
  if (monthlyRate === 0) {
    return roundInr(p / n)
  }
  const factor = Math.pow(1 + monthlyRate, n)
  return roundInr((p * monthlyRate * factor) / (factor - 1))
}

export function generateAmortisationSchedule(input: ScheduleGenerationInput): {
  emiAmount: number
  finalEmiDate: string
  instalments: EmiInstalment[]
} {
  const p = roundInr(Math.max(0, input.netFinancedAmount))
  const n = Math.max(1, Math.round(input.numberOfInstalments))
  const annualRate = Math.max(0, input.interestRateAnnualPct)
  const monthlyRate = annualRate / 12 / 100
  const startNum = input.startingEmiNumber ?? 1
  const nowIso = input.nowIso ?? new Date().toISOString()

  const baseEmi = computeStandardEmiAmount(
    p,
    annualRate,
    n,
    input.interestType,
    input.customEmiAmount,
  )

  const instalments: EmiInstalment[] = []
  let remainingPrincipal = p

  const flatMonthlyPrincipal = roundInr(p / n)
  const flatTotalInterest = roundInr(p * (annualRate / 100) * (n / 12))
  const flatMonthlyInterest = roundInr(flatTotalInterest / n)

  for (let i = 0; i < n; i++) {
    const dueDate = addMonthsIso(input.firstEmiDate, i)
    const opening = roundInr(remainingPrincipal)
    const isLast = i === n - 1
    let principalComp = 0
    let interestComp = 0
    let emiAmt = baseEmi

    if (input.interestType === 'flat_rate') {
      principalComp = isLast ? roundInr(remainingPrincipal) : flatMonthlyPrincipal
      interestComp = isLast
        ? roundInr(Math.max(0, flatTotalInterest - flatMonthlyInterest * (n - 1)))
        : flatMonthlyInterest
      emiAmt = roundInr(principalComp + interestComp)
    } else if (input.interestType === 'interest_only_balloon') {
      interestComp = roundInr(opening * monthlyRate)
      principalComp = isLast ? opening : 0
      emiAmt = roundInr(principalComp + interestComp)
    } else if (input.interestType === 'lease_fixed') {
      interestComp = monthlyRate > 0 ? roundInr(opening * monthlyRate) : 0
      principalComp = isLast ? opening : roundInr(Math.min(opening, Math.max(0, baseEmi - interestComp)))
      if (isLast && baseEmi >= opening + interestComp) {
        emiAmt = roundInr(opening + interestComp)
      } else {
        emiAmt = roundInr(principalComp + interestComp)
      }
    } else {
      // reducing_balance or custom
      interestComp = roundInr(opening * monthlyRate)
      if (isLast) {
        principalComp = opening
        emiAmt = roundInr(principalComp + interestComp)
      } else {
        principalComp = roundInr(Math.min(opening, Math.max(0, baseEmi - interestComp)))
        emiAmt = roundInr(principalComp + interestComp)
      }
    }

    remainingPrincipal = roundInr(Math.max(0, remainingPrincipal - principalComp))

    instalments.push({
      id: `emi-${input.financeId}-${startNum + i}`,
      organizationId: input.organizationId,
      financeId: input.financeId,
      vehicleId: input.vehicleId,
      emiNumber: startNum + i,
      dueDate,
      openingPrincipal: opening,
      principalComponent: principalComp,
      interestComponent: interestComp,
      emiAmount: emiAmt,
      lateFeeInr: 0,
      amountPaid: 0,
      remainingAmount: emiAmt,
      paymentDate: null,
      status: 'upcoming',
      reconciliationStatus: 'pending',
      updatedAt: nowIso,
    })
  }

  return {
    emiAmount: baseEmi,
    finalEmiDate: instalments[instalments.length - 1]?.dueDate ?? input.firstEmiDate,
    instalments,
  }
}

export function deriveEmiStatus(
  emi: Pick<EmiInstalment, 'dueDate' | 'emiAmount' | 'lateFeeInr' | 'amountPaid' | 'remainingAmount' | 'status'>,
  todayIso: string,
  dueSoonWindowDays = 7,
): EmiPaymentStatus {
  // Never overwrite explicit terminal manual statuses
  if (emi.status === 'paid' || emi.status === 'waived' || emi.status === 'cancelled') {
    return emi.status
  }
  const totalDue = roundInr(emi.emiAmount + (emi.lateFeeInr || 0))
  const remaining = roundInr(Math.max(0, totalDue - emi.amountPaid))

  if (remaining <= 0.01 && emi.amountPaid > 0) {
    return 'paid'
  }
  if (emi.amountPaid > 0.01 && remaining > 0.01) {
    return 'partially_paid'
  }

  const diff = diffDaysIso(emi.dueDate, todayIso)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'due_today'
  if (diff <= dueSoonWindowDays) return 'due_soon'
  return 'upcoming'
}

export function applyEmiPaymentCalculation(
  emi: EmiInstalment,
  paymentAmountInr: number,
  manualLateFeeInr: number,
  paymentDate: string,
  allowPartial: boolean,
): {
  updatedEmi: EmiInstalment
  appliedToLateFee: number
  appliedToInstalment: number
} {
  if (emi.status === 'paid' || emi.status === 'waived' || emi.status === 'cancelled') {
    throw new Error(`EMI #${emi.emiNumber} is already ${emi.status} and cannot accept another payment.`)
  }
  const addLateFee = roundInr(Math.max(0, manualLateFeeInr || 0))
  const nextLateFee = roundInr((emi.lateFeeInr || 0) + addLateFee)
  const totalLiability = roundInr(emi.emiAmount + nextLateFee)
  const currentlyRemaining = roundInr(Math.max(0, totalLiability - emi.amountPaid))
  const payAmt = roundInr(Number(paymentAmountInr) || 0)

  if (payAmt <= 0) {
    throw new Error('Payment amount must be greater than zero.')
  }
  if (!allowPartial && payAmt + 0.01 < currentlyRemaining) {
    throw new Error(`Partial payments are disabled by organization finance defaults. Full remaining amount ₹${currentlyRemaining} is required.`)
  }
  if (payAmt > currentlyRemaining + 0.01) {
    throw new Error(`Payment amount (₹${payAmt}) exceeds remaining EMI balance (₹${currentlyRemaining}) and cannot double-pay an EMI.`)
  }

  const nextPaid = roundInr(Math.min(totalLiability, emi.amountPaid + payAmt))
  const nextRemaining = roundInr(Math.max(0, totalLiability - nextPaid))
  const nextStatus: EmiPaymentStatus = nextRemaining <= 0.01 ? 'paid' : 'partially_paid'

  return {
    updatedEmi: {
      ...emi,
      lateFeeInr: nextLateFee,
      amountPaid: nextPaid,
      remainingAmount: nextRemaining,
      paymentDate: paymentDate.slice(0, 10),
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    },
    appliedToLateFee: Math.min(payAmt, addLateFee),
    appliedToInstalment: roundInr(Math.max(0, payAmt - Math.min(payAmt, addLateFee))),
  }
}

export function buildRestructuredSchedule(params: {
  record: VehicleFinanceRecord
  existingInstalments: EmiInstalment[]
  newInterestRateAnnualPct: number
  newInterestType: FinanceInterestType
  newRemainingInstalmentsCount: number
  effectiveNextDueDate: string
  customEmiAmount?: number
}): {
  preservedInstalments: EmiInstalment[]
  newInstalments: EmiInstalment[]
  newEmiAmount: number
  newFinalEmiDate: string
  remainingPrincipalToRestructure: number
} {
  const preservedStatuses = new Set<EmiPaymentStatus>(['paid', 'partially_paid', 'waived', 'cancelled'])
  const preservedInstalments = params.existingInstalments
    .filter((i) => preservedStatuses.has(i.status))
    .sort((a, b) => a.emiNumber - b.emiNumber)

  // Compute principal already settled (full for paid, pro-rata for partially paid)
  let principalSettled = 0
  for (const inst of preservedInstalments) {
    if (inst.status === 'paid') {
      principalSettled += inst.principalComponent
    } else if (inst.status === 'partially_paid' && inst.emiAmount > 0) {
      const ratio = Math.min(1, inst.amountPaid / inst.emiAmount)
      principalSettled += inst.principalComponent * ratio
    }
  }

  const remainingPrincipalToRestructure = roundInr(
    Math.max(0, params.record.netFinancedAmount - principalSettled),
  )
  const highestEmiNum = preservedInstalments.reduce((mx, i) => Math.max(mx, i.emiNumber), 0)

  const generated = generateAmortisationSchedule({
    organizationId: params.record.organizationId,
    financeId: params.record.id,
    vehicleId: params.record.vehicleId,
    netFinancedAmount: remainingPrincipalToRestructure,
    interestRateAnnualPct: params.newInterestRateAnnualPct,
    interestType: params.newInterestType,
    numberOfInstalments: params.newRemainingInstalmentsCount,
    firstEmiDate: params.effectiveNextDueDate,
    customEmiAmount: params.customEmiAmount,
    startingEmiNumber: highestEmiNum + 1,
  })

  return {
    preservedInstalments,
    newInstalments: generated.instalments,
    newEmiAmount: generated.emiAmount,
    newFinalEmiDate: generated.finalEmiDate,
    remainingPrincipalToRestructure,
  }
}

export function summarizeVehicleFinanceRecord(
  record: VehicleFinanceRecord,
  instalments: EmiInstalment[],
  payments: FinancePaymentTransaction[],
  todayIso: string,
  dueSoonWindowDays = 7,
): VehicleFinanceRecord {
  const refreshed = instalments
    .filter((i) => i.financeId === record.id)
    .map((i) => {
      const status = deriveEmiStatus(i, todayIso, dueSoonWindowDays)
      const remaining = roundInr(Math.max(0, i.emiAmount + (i.lateFeeInr || 0) - i.amountPaid))
      return { ...i, status, remainingAmount: remaining }
    })
    .sort((a, b) => a.emiNumber - b.emiNumber)

  let principalRepaid = 0
  let interestPaid = 0
  let totalPaid = 0
  let overdueCount = 0
  let overdueAmount = 0

  for (const inst of refreshed) {
    if (inst.status === 'paid') {
      principalRepaid += inst.principalComponent
      interestPaid += inst.interestComponent
    } else if (inst.status === 'partially_paid' && inst.emiAmount > 0) {
      const ratio = Math.min(1, inst.amountPaid / inst.emiAmount)
      principalRepaid += inst.principalComponent * ratio
      interestPaid += inst.interestComponent * ratio
    }
    totalPaid += inst.amountPaid

    const isPastDue = diffDaysIso(inst.dueDate, todayIso) < 0
    if (
      inst.status !== 'paid' &&
      inst.status !== 'waived' &&
      inst.status !== 'cancelled' &&
      isPastDue &&
      inst.remainingAmount > 0.01
    ) {
      overdueCount += 1
      overdueAmount += inst.remainingAmount
    }
  }

  // If foreclosed/completed payments exist beyond instalment paid sums, reconcile from transactions if needed
  const nonReversedPayments = payments.filter((p) => p.financeId === record.id && !p.isCorrected)
  const txSum = roundInr(nonReversedPayments.reduce((s, p) => s + p.amountInr, 0))
  const effectiveTotalPaid = Math.max(roundInr(totalPaid), txSum)

  const openInstalments = refreshed.filter(
    (i) => i.status !== 'paid' && i.status !== 'waived' && i.status !== 'cancelled',
  )

  let outstandingPrincipal = roundInr(Math.max(0, record.netFinancedAmount - principalRepaid))
  if (record.financeStatus === 'foreclosed' || record.financeStatus === 'completed' || record.financeStatus === 'cancelled') {
    outstandingPrincipal = 0
  }

  let derivedStatus: VehicleFinanceStatus = record.financeStatus
  if (
    record.financeStatus !== 'foreclosed' &&
    record.financeStatus !== 'cancelled'
  ) {
    if (refreshed.length > 0 && openInstalments.length === 0) {
      derivedStatus = 'completed'
      outstandingPrincipal = 0
    } else if (overdueCount > 0) {
      derivedStatus = 'overdue'
    } else if (refreshed.some((i) => i.status === 'partially_paid')) {
      derivedStatus = 'partially_paid'
    } else if (record.financeStatus === 'restructured') {
      derivedStatus = 'restructured'
    } else {
      derivedStatus = 'active'
    }
  }

  const nextOpen = openInstalments[0]
  const lastInstalment = refreshed[refreshed.length - 1]

  return {
    ...record,
    financeStatus: derivedStatus,
    outstandingPrincipal,
    principalRepaid: roundInr(
      record.financeStatus === 'foreclosed' || derivedStatus === 'completed'
        ? record.netFinancedAmount
        : principalRepaid,
    ),
    interestPaid: roundInr(interestPaid),
    totalAmountPaid: roundInr(effectiveTotalPaid),
    remainingInstalments:
      derivedStatus === 'completed' || derivedStatus === 'foreclosed' || derivedStatus === 'cancelled'
        ? 0
        : openInstalments.length,
    nextDueDate:
      derivedStatus === 'completed' || derivedStatus === 'foreclosed' || derivedStatus === 'cancelled'
        ? null
        : nextOpen?.dueDate ?? null,
    loanCompletionDate: lastInstalment?.dueDate ?? record.finalEmiDate,
    overdueCount,
    overdueAmount: roundInr(overdueAmount),
  }
}

export function evaluateFinanceAlerts(params: {
  organizationId: string
  records: VehicleFinanceRecord[]
  instalments: EmiInstalment[]
  documents: FinanceDocumentItem[]
  settings: FinanceNotificationSettings
  existingAlerts?: FinanceAlertEvent[]
  todayIso: string
}): FinanceAlertEvent[] {
  const existingMap = new Map((params.existingAlerts ?? []).map((a) => [a.id, a]))
  const channelParts = []
  if (params.settings.inAppEnabled) channelParts.push('In-App')
  if (params.settings.emailEnabled) {
    channelParts.push(
      params.settings.smtpConfigured ? 'Email' : 'Email (SMTP not configured)',
    )
  }
  const channelSummary = channelParts.join(' + ') || 'In-App'
  const out: FinanceAlertEvent[] = []
  const reminderSet = new Set(params.settings.reminderDaysBefore)

  const pushAlert = (candidate: Omit<FinanceAlertEvent, 'read' | 'acknowledged' | 'channelSummary'>) => {
    const prev = existingMap.get(candidate.id)
    out.push({
      ...candidate,
      channelSummary,
      read: prev?.read ?? false,
      acknowledged: prev?.acknowledged ?? false,
    })
  }

  for (const rec of params.records) {
    if (rec.financeStatus === 'cancelled') continue

    const recEmis = params.instalments.filter((i) => i.financeId === rec.id)
    for (const emi of recEmis) {
      const status = deriveEmiStatus(emi, params.todayIso, params.settings.dueSoonWindowDays)
      if (status === 'paid' || status === 'waived' || status === 'cancelled') continue

      const daysUntil = diffDaysIso(emi.dueDate, params.todayIso)
      if (daysUntil < 0 && params.settings.notifyAfterDueDate) {
        pushAlert({
          id: `falt-overdue-${emi.id}`,
          organizationId: params.organizationId,
          financeId: rec.id,
          emiId: emi.id,
          vehicleId: rec.vehicleId,
          alertType: 'emi_overdue',
          severity: Math.abs(daysUntil) >= params.settings.overdueEscalationDays ? 'critical' : 'high',
          title: `Overdue EMI #${emi.emiNumber} · ${rec.vehicleRegistration}`,
          message: `EMI #${emi.emiNumber} of ₹${Math.round(emi.remainingAmount).toLocaleString('en-IN')} (${rec.bankName}) was due on ${emi.dueDate} (${Math.abs(daysUntil)}d overdue).`,
          actionRoute: '/dashboard/finance/overdue',
          createdAt: `${params.todayIso}T09:00:00.000Z`,
        })
      } else if (daysUntil >= 0 && reminderSet.has(daysUntil)) {
        pushAlert({
          id: `falt-rem-${emi.id}-${daysUntil}`,
          organizationId: params.organizationId,
          financeId: rec.id,
          emiId: emi.id,
          vehicleId: rec.vehicleId,
          alertType: 'emi_due_reminder',
          severity: daysUntil <= 1 ? 'high' : 'moderate',
          title:
            daysUntil === 0
              ? `EMI Due Today · ${rec.vehicleRegistration}`
              : `EMI Due in ${daysUntil}d · ${rec.vehicleRegistration}`,
          message: `EMI #${emi.emiNumber} of ₹${Math.round(emi.remainingAmount).toLocaleString('en-IN')} to ${rec.bankName} is due on ${emi.dueDate}.`,
          actionRoute: '/dashboard/finance/upcoming',
          createdAt: `${params.todayIso}T09:00:00.000Z`,
        })
      }
    }

    if (rec.financeStatus === 'completed') {
      pushAlert({
        id: `falt-complete-${rec.id}`,
        organizationId: params.organizationId,
        financeId: rec.id,
        vehicleId: rec.vehicleId,
        alertType: 'loan_completed',
        severity: 'normal',
        title: `Loan Completed · ${rec.vehicleRegistration}`,
        message: `All instalments for ${rec.loanReferenceNumber} (${rec.bankName}) are paid. Collect NOC & update RC hypothecation.`,
        actionRoute: `/dashboard/finance/vehicles/${rec.id}`,
        createdAt: `${params.todayIso}T09:00:00.000Z`,
      })
    } else if (
      rec.remainingInstalments > 0 &&
      rec.remainingInstalments <= 2 &&
      rec.financeStatus !== 'foreclosed'
    ) {
      pushAlert({
        id: `falt-nearing-${rec.id}`,
        organizationId: params.organizationId,
        financeId: rec.id,
        vehicleId: rec.vehicleId,
        alertType: 'loan_nearing_completion',
        severity: 'moderate',
        title: `Loan Nearing Completion · ${rec.vehicleRegistration}`,
        message: `Only ${rec.remainingInstalments} EMI instalment(s) remain on ${rec.loanReferenceNumber} (${rec.bankName}). Prepare NOC request.`,
        actionRoute: `/dashboard/finance/vehicles/${rec.id}`,
        createdAt: `${params.todayIso}T09:00:00.000Z`,
      })
    }

    const loanDocs = params.documents.filter((d) => d.financeId === rec.id)
    const hasAgreement = loanDocs.some((d) => d.category === 'loan_agreement')
    const hasSanction = loanDocs.some((d) => d.category === 'loan_sanction_letter')
    if (!hasAgreement || !hasSanction) {
      const missingList = [
        !hasAgreement ? 'Loan Agreement' : null,
        !hasSanction ? 'Sanction Letter' : null,
      ]
        .filter(Boolean)
        .join(' & ')
      pushAlert({
        id: `falt-missing-doc-${rec.id}`,
        organizationId: params.organizationId,
        financeId: rec.id,
        vehicleId: rec.vehicleId,
        alertType: 'finance_doc_missing',
        severity: 'moderate',
        title: `Finance Document Missing · ${rec.vehicleRegistration}`,
        message: `${missingList} missing for loan ${rec.loanReferenceNumber} (${rec.bankName}).`,
        actionRoute: '/dashboard/finance/documents',
        createdAt: `${params.todayIso}T09:00:00.000Z`,
      })
    }
  }

  for (const doc of params.documents) {
    if (doc.requiresRenewal || (doc.expiryDate && diffDaysIso(doc.expiryDate, params.todayIso) <= 30)) {
      pushAlert({
        id: `falt-doc-renew-${doc.id}`,
        organizationId: params.organizationId,
        financeId: doc.financeId,
        vehicleId: doc.vehicleId,
        alertType: 'finance_doc_renewal',
        severity: doc.expiryDate && diffDaysIso(doc.expiryDate, params.todayIso) < 0 ? 'high' : 'moderate',
        title: `Finance Document Renewal Due · ${doc.title}`,
        message: `${doc.title} (${doc.fileName})${doc.expiryDate ? ` expires/due on ${doc.expiryDate}` : ' is flagged for renewal'}.`,
        actionRoute: '/dashboard/finance/documents',
        createdAt: `${params.todayIso}T09:00:00.000Z`,
      })
    }
  }

  // Also carry forward recent persistent operational finance alerts (payment_reconciled, partial_payment_recorded, loan_info_updated)
  for (const prev of params.existingAlerts ?? []) {
    if (
      (prev.alertType === 'payment_reconciled' ||
        prev.alertType === 'partial_payment_recorded' ||
        prev.alertType === 'loan_info_updated') &&
      !out.some((a) => a.id === prev.id)
    ) {
      out.push({ ...prev, channelSummary })
    }
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function maskFinanceWorkspaceForRole(
  record: VehicleFinanceRecord,
  canViewUnmasked: boolean,
): VehicleFinanceRecord {
  if (canViewUnmasked) return record
  return {
    ...record,
    loanAccountNumber: record.loanAccountMasked || maskAccountNumber(record.loanAccountNumber),
    contactNumber: '••••••••••',
    email: '***@protected',
  }
}
