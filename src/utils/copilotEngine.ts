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
      answer: 'Enter an operational question about your active organization fleet, maintenance risk, fuel anomalies, or TCO.',
      citations: [],
      blocked: true,
      reason: 'empty',
    }
  }

  if (!canPerformAction(input.activeRole, 'use_copilot')) {
    return {
      answer: `Access denied: Role "${input.activeRole.replace('_', ' ')}" is not permitted to query Fleet Intelligence Copilot.`,
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
      answer: 'Request blocked: raw SQL extraction and schema inspection queries are not permitted in Fleet Copilot.',
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
      answer: `Organization isolation enforced: Your active session is scoped strictly to ${input.activeOrganization.name} (${input.activeOrganization.code}). Switch organization in the top bar if you are authorized to inspect another tenant.`,
      citations: [`Org boundary: ${input.activeOrganization.id}`],
      blocked: true,
      reason: 'cross_org',
    }
  }

  const activeVehicles = input.vehicles.filter((v) => !v.decommissioned)
  if (activeVehicles.length === 0) {
    return {
      answer: `Insufficient data in ${input.activeOrganization.name}: No active vehicles are registered yet. Add a vehicle or load a pilot fleet before requesting operational analytics.`,
      citations: [`Active vehicles in ${input.activeOrganization.name}: 0`],
      blocked: false,
      reason: 'insufficient_data',
    }
  }

  // Maintenance / failure / savings intent
  if (/maint|predict|repair|saving|component|failure|service/i.test(rawQuery)) {
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
      return `• ${v?.registrationNumber ?? p.vehicleId} (${p.componentName}): ${p.priority.toUpperCase()}, ~${p.estimatedDaysToFailure} days RUL, est. savings ₹${p.potentialSavingsInr.toLocaleString('en-IN')}`
    })
    return {
      answer: `${input.activeOrganization.name} has ${validOpen.length} open predictive maintenance item(s). Top priorities:\n${lines.join('\n')}`,
      citations: top.map((p) => `${p.id} (confidence ${Math.round(p.confidenceScore * 100)}%)`),
      blocked: false,
    }
  }

  // Fuel / financial / EV vs ICE / cost intent
  if (/fuel|diesel|ev|electric|cost|tco|spend|mileage|anomal/i.test(rawQuery)) {
    if (!canPerformAction(input.activeRole, 'verify_fuel') && input.activeRole === 'maintenance') {
      return {
        answer: `Role "${input.activeRole}" does not have financial/fuel ledger visibility. Switch to Fleet Manager, Finance, or Org Admin to view cost intelligence.`,
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

  // Driver / safety intent
  if (/driver|safety|coach|dispute|fatigue|speed/i.test(rawQuery)) {
    if (input.drivers.length === 0) {
      return {
        answer: `Insufficient driver data in ${input.activeOrganization.name}: no active driver profiles logged.`,
        citations: ['Drivers: 0'],
        blocked: false,
        reason: 'insufficient_data',
      }
    }
    const lowest = [...input.drivers].sort((a, b) => a.safetyScore - b.safetyScore).slice(0, 3)
    const lines = lowest.map((d) => `• ${d.name}: Safety ${d.safetyScore}/100 (${d.totalTrips} trips, status: ${d.status})`)
    return {
      answer: `Lowest safety score drivers in ${input.activeOrganization.name} requiring coaching focus:\n${lines.join('\n')}`,
      citations: lowest.map((d) => `${d.id}: ${d.safetyScore}/100`),
      blocked: false,
    }
  }

  // Risk / telemetry / health overview
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
