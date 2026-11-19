import type {
  AIPrediction,
  Driver,
  FuelTransaction,
  MaintenanceRecord,
  Organization,
  OrganizationRole,
  PartInventoryItem,
  RiskAssessmentItem,
  Vehicle,
  WorkOrder,
} from '../types/fleet'
import { canPerformAction } from './rbac'
import type { computeFinancialIntelligence } from './intelligenceEngine'
import { DHIYU_SCOPE_REFUSAL, isFleetManagementQuery } from './dhiyuScope.ts'

export { DHIYU_SCOPE_REFUSAL, isFleetManagementQuery }

export const FLEET_MAINTENANCE_KNOWLEDGE = `
DRIVEMITRA FLEET MANAGEMENT DOMAIN KNOWLEDGE (OWNER / OPERATIONS WORKSPACE):
1. Five Intelligence Health Areas:
   DriveMitra organizes predictive health strictly into 5 operational domains:
   - Fuel Health (consumption efficiency, cost/km anomalies, EV charging variance)
   - Engine Health (ICE thermal/oil wear, transmission/cooling, or EV traction motor & BMS thermal pack)
   - Tyre Health (multi-axle tread depth, uneven wear, alignment drift)
   - Driver Health (strictly driving safety scores, trip discipline & Indian licence/compliance readiness — NEVER medical diagnoses)
   - Vehicle Health (brakes, suspension, 12V auxiliary system, pre-trip defects, Indian RC/Fitness/PUC/Insurance validity)
2. Operational Inputs Used for Forecasting:
   - Cumulative odometer (km), daily average utilization (km/day), model year, and vehicle specs.
   - Days elapsed since last recorded workshop service, Work Orders, and Small-Issue logs.
   - Corridor road-stress indices and climate thermal exposure.
   - Telemetry motion/GPS behavior and pre-trip inspections.
3. Priority & Remaining Useful Life (RUL) Triage Windows:
   - Critical: <= 14 days RUL or critical fault — create Work Order immediately.
   - High: 15–30 days RUL — schedule within current dispatch cycle.
   - Medium: 31–65 days RUL — bundle with upcoming scheduled service.
   - Low: > 65 days RUL — monitor on baseline schedule.
4. Telemetry Honesty & Scope Boundaries:
   - Never fabricate raw physical OBD-II sensor readings (tyre PSI, oil viscosity, coolant °C) or private PII.
   - If a prediction has insufficientData=true, state clearly that baseline odometer, service, or inspection data is missing.
`

export interface CopilotContextInput {
  activeOrganization: Organization
  activeRole: OrganizationRole
  vehicles: Vehicle[]
  predictions: AIPrediction[]
  maintenanceRecords: MaintenanceRecord[]
  riskAssessments: RiskAssessmentItem[]
  drivers: Driver[]
  fuelTransactions: FuelTransaction[]
  financialSummary: ReturnType<typeof computeFinancialIntelligence>
  workOrders?: WorkOrder[]
  partsInventory?: PartInventoryItem[]
}

export function buildCopilotFleetContext(input: CopilotContextInput) {
  const activeVehicles = input.vehicles.filter((v) => !v.decommissioned)
  const canViewFinancials =
    canPerformAction(input.activeRole, 'verify_fuel') || input.activeRole === 'finance'

  const openPredictions = input.predictions
    .filter((p) => p.status !== 'resolved')
    .sort((a, b) => a.estimatedDaysToFailure - b.estimatedDaysToFailure)
    .map((p) => {
      const veh = activeVehicles.find((v) => v.id === p.vehicleId)
      return {
        predictionId: p.id,
        vehicleReg: veh?.registrationNumber ?? p.vehicleId,
        powertrain: veh?.powertrain ?? 'ICE',
        healthArea: p.healthArea ?? 'Vehicle Health',
        component: p.componentName,
        priority: p.priority,
        insufficientData: Boolean(p.insufficientData),
        estimatedDaysToFailure: p.estimatedDaysToFailure,
        windowDays: `${p.earliestWindowDays}-${p.latestWindowDays}`,
        confidencePct: Math.round(p.confidenceScore * 100),
        predictedIssue: p.predictedIssue,
        recommendedAction: p.recommendedAction,
        causalFactors: p.causalFactors.slice(0, 4).map((f) => `${f.label}: ${f.detail}`),
        repairCostInr: p.repairCostInr,
        delayCostInr: p.delayCostInr,
        costOfDelayPerDayInr: p.costOfDelayPerDayInr,
        potentialSavingsInr: p.potentialSavingsInr,
      }
    })

  const recentMaintenance = input.maintenanceRecords.slice(0, 12).map((m) => {
    const veh = input.vehicles.find((v) => v.id === m.vehicleId)
    return {
      id: m.id,
      vehicleReg: veh?.registrationNumber ?? m.vehicleId,
      component: m.componentName,
      serviceType: m.serviceType,
      status: m.status,
      serviceCenter: m.serviceCenter,
      costInr: m.costInr,
      performedAt: m.performedAt,
    }
  })

  const vehicleSummaries = activeVehicles.map((v) => ({
    reg: v.registrationNumber,
    makeModel: `${v.make} ${v.model} (${v.year})`,
    powertrain: v.powertrain,
    city: v.cityName,
    odometerKm: v.odometerKm,
    dailyAvgKm: v.dailyAvgKm,
    healthScore: v.healthScore,
    operationStatus: v.operationStatus,
    telemetryState: v.telemetry.connectionState,
    lastServiceDate: v.lastServiceDate,
  }))

  // Mask private PII before handing context to LLM
  const driverSummaries = input.drivers.map((d) => ({
    id: d.id,
    employeeCode: d.employeeCode ?? d.id,
    name: d.name,
    operationalStatus: d.operationalStatus ?? d.status,
    safetyScore: d.safetyScore,
    licenseExpiry: d.licenseExpiry,
    totalTrips: d.totalTrips,
  }))

  const riskSummaries = input.riskAssessments.slice(0, 12).map((r) => ({
    title: r.title,
    severity: r.severity,
    vehicleRegistration: r.vehicleRegistration,
    category: r.category,
    evidence: r.evidence,
  }))

  const flaggedFuelCount = input.fuelTransactions.filter(
    (t) => t.verificationStatus === 'needs_review',
  ).length

  const workOrderSummaries = (input.workOrders ?? []).slice(0, 12).map((w) => {
    const veh = activeVehicles.find((v) => v.id === w.vehicleId)
    return {
      workOrderNumber: w.workOrderNumber,
      vehicleReg: veh?.registrationNumber ?? w.vehicleId,
      title: w.title,
      healthArea: w.healthArea,
      priority: w.priority,
      status: w.status,
      totalCostInr: w.totalCostInr,
      workshopName: w.workshopName,
    }
  })

  const lowStockParts = (input.partsInventory ?? [])
    .filter((p) => p.stockQty <= p.reorderThreshold)
    .map((p) => ({
      sku: p.sku,
      name: p.name,
      stockQty: p.stockQty,
      reorderThreshold: p.reorderThreshold,
      unitCostInr: p.unitCostInr,
    }))

  return {
    organization: {
      id: input.activeOrganization.id,
      name: input.activeOrganization.name,
      code: input.activeOrganization.code,
    },
    activeRole: input.activeRole,
    fleetSummary: {
      activeVehicleCount: activeVehicles.length,
      avgHealthScore:
        activeVehicles.length > 0
          ? Math.round(activeVehicles.reduce((s, v) => s + v.healthScore, 0) / activeVehicles.length)
          : 0,
      openMaintenancePredictions: openPredictions.filter((p) => !p.insufficientData).length,
      scheduledOrCompletedServices: recentMaintenance.length,
      activeWorkOrders: (input.workOrders ?? []).filter((w) => w.status !== 'completed' && w.status !== 'closed').length,
      lowStockPartsCount: lowStockParts.length,
    },
    vehicles: vehicleSummaries,
    predictiveMaintenanceAlerts: openPredictions,
    maintenanceLedger: recentMaintenance,
    workOrders: workOrderSummaries,
    lowStockParts,
    riskRadar: riskSummaries,
    drivers: driverSummaries,
    ...(canViewFinancials
      ? {
          financials30d: {
            operatingExpenditureInr: input.financialSummary.operatingExpenditureInr,
            fuelExpenditureInr: input.financialSummary.fuelExpenditureInr,
            maintenanceExpenditureInr: input.financialSummary.maintenanceExpenditureInr,
            costPerKmInr: input.financialSummary.costPerKmInr,
            iceCostPerKmInr: input.financialSummary.iceVsEv.iceCostPerKmInr,
            evCostPerKmInr: input.financialSummary.iceVsEv.evCostPerKmInr,
            estimatedPotentialSavingsInr: input.financialSummary.estimatedPotentialSavingsInr,
            flaggedFuelEntriesForReview: flaggedFuelCount,
          },
        }
      : {
          financialAccessNote: `Role "${input.activeRole}" does not permit fuel/financial TCO ledger disclosure.`,
        }),
  }
}

export function buildMaintenanceSystemInstruction(input: CopilotContextInput): {
  systemInstruction: string
  citations: string[]
} {
  const ctx = buildCopilotFleetContext(input)
  const validOpen = ctx.predictiveMaintenanceAlerts.filter((p) => !p.insufficientData)

  const citations = [
    `Org: ${ctx.organization.code}`,
    `Fleet: ${ctx.fleetSummary.activeVehicleCount} vehicles`,
    `Open alerts: ${validOpen.length}`,
    'Engine: Dhiyu Fleet AI',
  ]

  const systemInstruction = [
    'You are Dhiyu, DriveMitra’s dedicated Fleet Management AI for fleet owners and managers.',
    'Answer concisely, clearly, and practically in plain operational language with Indian Rupee (₹) formatting when citing costs.',
    'Format responses for a narrow side drawer using short section titles and crisp bullet points (avoid wide markdown tables with pipe | characters). Include vehicle registration, 5-area health category, RUL days, preventive cost, and avoided delay cost.',
    'STRICT FLEET-ONLY BOUNDARY:',
    '- You MUST ONLY answer questions related to DriveMitra fleet management (vehicles, telemetry, trips, 5-area predictive health, work orders, parts inventory, compliance expiry, driver safety, fuel verification, risk radar, and fleet financials).',
    '- If asked anything outside fleet management, politely refuse and state that Dhiyu only supports DriveMitra fleet operations.',
    'STRICT SECURITY & TENANT RULES:',
    `- Only use data for active organization "${ctx.organization.name}" (${ctx.organization.id}). Never invent vehicles, metrics, or data from any other tenant.`,
    '- Never output Aadhaar numbers, PAN numbers, mobile phone numbers, or passwords.',
    '- If financials30d is absent (financialAccessNote present), explain clearly that the current role cannot view fuel/financial ledger costs.',
    '- Never fabricate unsupported physical OBD-II sensor values (tyre PSI, oil viscosity, coolant temperature).',
    FLEET_MAINTENANCE_KNOWLEDGE.trim(),
    'ACTIVE ORGANIZATION LIVE TELEMETRY & MAINTENANCE CONTEXT (JSON):',
    JSON.stringify(ctx),
  ].join('\n\n')

  return { systemInstruction, citations }
}
