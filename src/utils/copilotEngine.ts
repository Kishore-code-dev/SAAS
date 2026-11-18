import type {
  AIPrediction,
  Driver,
  FuelTransaction,
  Organization,
  OrganizationRole,
  RiskAssessmentItem,
  Vehicle,
} from '../types/fleet'
import { canPerformAction } from './rbac'
import type { computeFinancialIntelligence } from './intelligenceEngine'

export interface CopilotQueryInput {
  query: string
  activeOrganization: Organization
  allOrganizations: Organization[]
  activeRole: OrganizationRole
  vehicles: Vehicle[]
  predictions: AIPrediction[]
  riskAssessments: RiskAssessmentItem[]
  drivers: Driver[]
  fuelTransactions: FuelTransaction[]
  financialSummary: ReturnType<typeof computeFinancialIntelligence>
}

export interface CopilotResponse {
  answer: string
  citations: string[]
  blocked: boolean
  reason?: 'rbac' | 'prompt_injection' | 'cross_org' | 'sql_probe' | 'insufficient_data' | 'empty'
}

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /reveal\s+(your\s+)?(system\s+prompt|api\s*key|secret|env|token)/i,
  /bypass\s+(rbac|security|auth|rls|permission)/i,
  /act\s+as\s+(root|superuser|system)/i,
  /jailbreak/i,
]

const SQL_PROBE_PATTERNS = [
  /\b(select\s+\*|union\s+select|drop\s+table|alter\s+table|delete\s+from|insert\s+into)\b/i,
  /information_schema|pg_catalog|supabase_key|anon_key/i,
]

export function queryFleetCopilot(input: CopilotQueryInput): CopilotResponse {
  const rawQuery = input.query.trim()
  if (!rawQuery) {
    return {
      answer: 'Enter an operational question about your active organization fleet, 5-area maintenance risk, fuel anomalies, or TCO.',
      citations: [],
      blocked: true,
      reason: 'empty',
    }
  }

  if (!canPerformAction(input.activeRole, 'use_copilot')) {
    return {
      answer: `Access denied: Role "${input.activeRole.replace('_', ' ')}" is not permitted to query Dhiyu Fleet Intelligence.`,
      citations: [`RBAC check: ${input.activeRole}`],
      blocked: true,
      reason: 'rbac',
    }
  }

  if (PROMPT_INJECTION_PATTERNS.some((rx) => rx.test(rawQuery))) {
    return {
      answer: 'Request blocked by workspace safety policy. I only answer grounded operational questions for the active organization without exposing system prompts, credentials, or bypassing permissions.',
      citations: ['Safety guard: prompt injection pattern'],
      blocked: true,
      reason: 'prompt_injection',
    }
  }

  if (SQL_PROBE_PATTERNS.some((rx) => rx.test(rawQuery))) {
    return {
      answer: 'Request blocked: raw SQL extraction and schema inspection queries are not permitted in Dhiyu.',
      citations: ['Safety guard: SQL probe pattern'],
      blocked: true,
      reason: 'sql_probe',
    }
  }

  const lower = rawQuery.toLowerCase()
  const otherOrgs = input.allOrganizations.filter((o) => o.id !== input.activeOrganization.id)
  const crossOrgMention = otherOrgs.find(
    (o) =>
      lower.includes(o.name.toLowerCase()) ||
      lower.includes(o.code.toLowerCase()) ||
      lower.includes(o.id.toLowerCase()),
  )
  if (crossOrgMention || /\ball\s+organizations\b|\bother\s+tenants\b|\bcross[- ]tenant\b/i.test(rawQuery)) {
    return {
      answer: `Organization isolation enforced: Your active session is scoped strictly to ${input.activeOrganization.name} (${input.activeOrganization.code}). Cross-tenant inspection is blocked.`,
      citations: [`Org boundary: ${input.activeOrganization.id}`],
      blocked: true,
      reason: 'cross_org',
    }
  }

  const activeVehicles = input.vehicles.filter((v) => !v.decommissioned)
  if (activeVehicles.length === 0) {
    return {
      answer: `Insufficient data in ${input.activeOrganization.name}: No active vehicles are registered yet. Add a vehicle before requesting operational analytics.`,
      citations: [`Active vehicles in ${input.activeOrganization.name}: 0`],
      blocked: false,
      reason: 'insufficient_data',
    }
  }

  if (/\b(gst\s*invoice|toll\s*fastag|(tyre|tire)\s*(psi|pressure)|cargo\s*weight|payload\s*sensor|coolant\s*temp|oil\s*pressure)\b/i.test(rawQuery)) {
    return {
      answer: `Insufficient sensor/integration data in ${input.activeOrganization.name}: Smartphone telematics does not capture live OBD-II/payload/pressure sensors or external FASTag feeds. Only GPS, motion behavior, pre-trip inspections, Work Orders, and fuel ledger records are available.`,
      citations: ['Telemetry scope boundary'],
      blocked: false,
      reason: 'insufficient_data',
    }
  }

  const matchedVehicles = activeVehicles.filter((v) => {
    const compactReg = v.registrationNumber.replace(/\s+/g, '').toLowerCase()
    const compactQuery = lower.replace(/\s+/g, '')
    return lower.includes(v.registrationNumber.toLowerCase()) || compactQuery.includes(compactReg)
  })

  if (matchedVehicles.length >= 2) {
    const [v1, v2] = matchedVehicles
    const rowFor = (v: Vehicle) => {
      const openPreds = input.predictions.filter((p) => p.vehicleId === v.id && p.status !== 'resolved' && !p.insufficientData)
      const vehCost = input.financialSummary.vehicleCostBreakdown.find((r) => r.vehicleId === v.id)
      const topPred = openPreds[0]
      return `• ${v.registrationNumber} (${v.make} ${v.model}, ${v.powertrain}): Health ${v.healthScore}%, Odometer ${v.odometerKm.toLocaleString('en-IN')} km, ${vehCost ? `₹${vehCost.costPerKmInr}/km` : 'N/A cost/km'}, ${openPreds.length} open prediction(s)${topPred ? ` (highest: ${topPred.healthArea ?? topPred.componentName} ~${topPred.estimatedDaysToFailure}d RUL)` : ''}`
    }
    return {
      answer: `Vehicle comparison within ${input.activeOrganization.name}:\n${rowFor(v1)}\n${rowFor(v2)}`,
      citations: [
        `${v1.registrationNumber}: ${v1.healthScore}% health`,
        `${v2.registrationNumber}: ${v2.healthScore}% health`,
      ],
      blocked: false,
    }
  }

  if (matchedVehicles.length === 1 && /compar|status|health|detail|about/i.test(rawQuery)) {
    const v = matchedVehicles[0]
    const openPreds = input.predictions.filter((p) => p.vehicleId === v.id && p.status !== 'resolved' && !p.insufficientData)
    const vehCost = input.financialSummary.vehicleCostBreakdown.find((r) => r.vehicleId === v.id)
    return {
      answer: `${v.registrationNumber} (${v.make} ${v.model}, ${v.powertrain}): Health ${v.healthScore}%, Odometer ${v.odometerKm.toLocaleString('en-IN')} km, Status ${v.operationStatus}, Telemetry ${v.telemetry.connectionState}${vehCost ? `, Operating cost ₹${vehCost.costPerKmInr}/km` : ''}, ${openPreds.length} open predictive item(s).`,
      citations: [`${v.id}: ${v.healthScore}%`, `Open predictions: ${openPreds.length}`],
      blocked: false,
    }
  }

  if (/maint|predict|repair|saving|component|failure|service|work\s*order/i.test(rawQuery)) {
    const validOpen = input.predictions.filter((p) => p.status !== 'resolved' && !p.insufficientData)
    if (validOpen.length === 0) {
      return {
        answer: `No high-confidence open predictive maintenance alerts exist for ${input.activeOrganization.name} right now.`,
        citations: [`Open valid predictions: 0`],
        blocked: false,
        reason: 'insufficient_data',
      }
    }
    const top = validOpen.slice(0, 3)
    const lines = top.map((p) => {
      const v = activeVehicles.find((item) => item.id === p.vehicleId)
      return `• ${v?.registrationNumber ?? p.vehicleId} (${p.healthArea ?? p.componentName} · ${p.componentName}): ${p.priority.toUpperCase()}, ~${p.estimatedDaysToFailure} days RUL, est. savings ₹${p.potentialSavingsInr.toLocaleString('en-IN')}`
    })
    return {
      answer: `${input.activeOrganization.name} has ${validOpen.length} open predictive maintenance item(s). Top priorities:\n${lines.join('\n')}`,
      citations: top.map((p) => `${p.id} (confidence ${Math.round(p.confidenceScore * 100)}%)`),
      blocked: false,
    }
  }

  if (/fuel|diesel|ev|electric|cost|tco|spend|mileage|anomal|invoice/i.test(rawQuery)) {
    if (!canPerformAction(input.activeRole, 'verify_fuel')) {
      return {
        answer: `Role "${input.activeRole.replace('_', ' ')}" does not have financial/fuel ledger visibility. Use Fleet Manager, Finance, or Org Admin to view cost intelligence.`,
        citations: [`RBAC scope: ${input.activeRole}`],
        blocked: true,
        reason: 'rbac',
      }
    }
    const flaggedCount = input.fuelTransactions.filter((t) => t.verificationStatus === 'needs_review').length
    const fin = input.financialSummary
    return {
      answer: `${input.activeOrganization.name} 30-day operating summary: ₹${fin.operatingExpenditureInr.toLocaleString('en-IN')} total spend (Fuel ₹${fin.fuelExpenditureInr.toLocaleString('en-IN')} + Maintenance ₹${fin.maintenanceExpenditureInr.toLocaleString('en-IN')}), blended ₹${fin.costPerKmInr}/km. ICE avg ₹${fin.iceVsEv.iceCostPerKmInr}/km vs EV avg ₹${fin.iceVsEv.evCostPerKmInr}/km. ${flaggedCount} fuel entry(ies) flagged for verification.`,
      citations: [
        `Fuel entries: ${input.fuelTransactions.length}`,
        `Flagged for review: ${flaggedCount}`,
      ],
      blocked: false,
    }
  }

  if (/driver|safety|coach|dispute|fatigue|speed|licence|license/i.test(rawQuery)) {
    if (input.drivers.length === 0) {
      return {
        answer: `Insufficient driver data in ${input.activeOrganization.name}: no active driver profiles logged.`,
        citations: ['Drivers: 0'],
        blocked: false,
        reason: 'insufficient_data',
      }
    }
    const lowest = [...input.drivers].sort((a, b) => a.safetyScore - b.safetyScore).slice(0, 3)
    const lines = lowest.map((d) => `• ${d.name}: Safety ${d.safetyScore}/100 (${d.totalTrips} trips, status: ${d.operationalStatus ?? d.status})`)
    return {
      answer: `Lowest safety score drivers in ${input.activeOrganization.name} requiring coaching focus:\n${lines.join('\n')}`,
      citations: lowest.map((d) => `${d.id}: ${d.safetyScore}/100`),
      blocked: false,
    }
  }

  const criticalOrHigh = input.riskAssessments.filter((r) => r.severity === 'critical' || r.severity === 'high')
  const offlineCount = activeVehicles.filter((v) => v.telemetry.connectionState === 'disconnected').length
  const avgHealth = Math.round(activeVehicles.reduce((s, v) => s + v.healthScore, 0) / activeVehicles.length)

  return {
    answer: `${input.activeOrganization.name} Fleet Snapshot: ${activeVehicles.length} active vehicles (avg health ${avgHealth}%), ${criticalOrHigh.length} critical/high operational risk(s), and ${offlineCount} vehicle(s) with disconnected telemetry.`,
    citations: [
      `Active vehicles: ${activeVehicles.length}`,
      `High/Critical risks: ${criticalOrHigh.length}`,
      `Disconnected telemetry: ${offlineCount}`,
    ],
    blocked: false,
  }
}
