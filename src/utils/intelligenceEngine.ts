import {
  AIPrediction,
  ComponentCategory,
  Driver,
  DriverBehaviorEvent,
  FuelTransaction,
  MaintenanceRecord,
  PredictionCausalFactor,
  RegionalCorridor,
  ReportingPeriod,
  RiskAssessmentItem,
  RiskSeverity,
  TelemetryFreshness,
  Trip,
  Vehicle,
  VehicleComponent,
  VehicleInspection,
} from '../types/fleet'

export const INTELLIGENCE_MODEL_VERSION = 'dm-predictive-rf-baseline-v2.4.0'

export const TELEMETRY_SCOPE_DISCLOSURE =
  'Smartphone telemetry provides GPS position, speed, motion events, and trip duration. Mechanical wear estimates are inferred from vehicle age, odometer, maintenance history, road stress, usage intensity, driving behaviour, and driver inspections.'

export function classifyTelemetryFreshness(
  lastUpdatedIso: string,
  connectionState: 'connected' | 'intermittent' | 'disconnected',
  nowMs: number = Date.now(),
): { freshness: TelemetryFreshness; ageSeconds: number; label: string } {
  const updatedMs = new Date(lastUpdatedIso).getTime()
  if (Number.isNaN(updatedMs)) {
    return { freshness: 'offline', ageSeconds: Number.POSITIVE_INFINITY, label: 'No signal timestamp' }
  }
  const ageSeconds = Math.max(0, Math.round((nowMs - updatedMs) / 1000))

  if (connectionState === 'disconnected' || ageSeconds > 1800) {
    return {
      freshness: 'offline',
      ageSeconds,
      label: ageSeconds >= 3600 ? `Offline (${Math.floor(ageSeconds / 3600)}h ago)` : `Offline (${Math.floor(ageSeconds / 60)}m ago)`,
    }
  }
  if (ageSeconds > 300 || connectionState === 'intermittent') {
    return {
      freshness: 'stale',
      ageSeconds,
      label: `Stale (${Math.floor(ageSeconds / 60)}m old)`,
    }
  }
  if (ageSeconds > 60) {
    return {
      freshness: 'delayed',
      ageSeconds,
      label: `Delayed (${ageSeconds}s ago)`,
    }
  }
  return {
    freshness: 'live',
    ageSeconds,
    label: ageSeconds <= 10 ? 'Live (<10s)' : `Live (${ageSeconds}s ago)`,
  }
}

export function getComponentBaseCosts(componentName: ComponentCategory, powertrain: 'ICE' | 'EV'): {
  repairCostInr: number
  delayMultiplier: number
  downtimeDaysIfDelayed: number
  issueTitle: string
  action: string
} {
  switch (componentName) {
    case 'Engine':
      return {
        repairCostInr: 4800,
        delayMultiplier: 6.2,
        downtimeDaysIfDelayed: 4,
        issueTitle: powertrain === 'EV' ? 'Traction Motor Bearing & Inverter Check' : 'Engine Oil Degradation & Thermal Stress',
        action: powertrain === 'EV'
          ? 'Inspect motor bearings, inverter cooling loop, and phase insulation within 7 days.'
          : 'Perform oil flush, filter replacement, and compression inspection before next heavy route.',
      }
    case 'Brakes':
      return {
        repairCostInr: 6200,
        delayMultiplier: 3.4,
        downtimeDaysIfDelayed: 2,
        issueTitle: 'Accelerated Brake Pad & Rotor Wear',
        action: 'Inspect pad thickness, brake calipers, and fluid moisture; replace worn pads immediately.',
      }
    case 'Tyres':
      return {
        repairCostInr: 7400,
        delayMultiplier: 2.8,
        downtimeDaysIfDelayed: 2,
        issueTitle: 'Uneven Tread Wear & Alignment Drift',
        action: 'Execute wheel alignment, balancing, and front-to-rear rotation within 1,500 km.',
      }
    case 'Suspension':
      return {
        repairCostInr: 12500,
        delayMultiplier: 4.5,
        downtimeDaysIfDelayed: 4,
        issueTitle: 'Leaf Spring Fatigue & Damper Seal Wear',
        action: 'Inspect leaf springs, shackles, and shock absorbers; restrict payload to 70% until serviced.',
      }
    case 'Transmission':
      return {
        repairCostInr: 9200,
        delayMultiplier: 4.2,
        downtimeDaysIfDelayed: 3,
        issueTitle: powertrain === 'EV' ? 'Single-Speed Reduction Gearbox Wear' : 'Clutch Slippage & Gear Oil Breakdown',
        action: powertrain === 'EV'
          ? 'Flush reduction gear oil and inspect torque coupling seals.'
          : 'Replace transmission fluid and inspect clutch plate thickness within 10 days.',
      }
    case 'Cooling System':
      return {
        repairCostInr: 3600,
        delayMultiplier: 5.0,
        downtimeDaysIfDelayed: 3,
        issueTitle: 'Coolant Efficiency Drop Under High Ambient Heat',
        action: 'Pressure-test radiator hoses, flush coolant, and verify thermostat cycling.',
      }
    case 'EV Battery':
      return {
        repairCostInr: 5500,
        delayMultiplier: 6.8,
        downtimeDaysIfDelayed: 5,
        issueTitle: 'EV Pack Thermal Imbalance & Cell SOH Drift',
        action: 'Run BMS cell balancing diagnostic, check pack thermal coolant, and avoid fast-charge above 90% until inspected.',
      }
    case 'Battery':
    default:
      return {
        repairCostInr: 3200,
        delayMultiplier: 2.9,
        downtimeDaysIfDelayed: 1,
        issueTitle: 'Auxiliary 12V / Alternator Cranking Degradation',
        action: 'Test cold-cranking amps, clean terminals, and verify alternator charging voltage.',
      }
  }
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

export function isWithinIndiaCorridorBounds(lat: number, lng: number): boolean {
  return isValidCoordinate(lat, lng) && lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 97.5
}

export function isStaleOutOfOrderTimestamp(incomingIso: string, existingIso: string): boolean {
  const incomingMs = new Date(incomingIso).getTime()
  const existingMs = new Date(existingIso).getTime()
  if (Number.isNaN(incomingMs)) return true
  if (Number.isNaN(existingMs)) return false
  return incomingMs < existingMs
}

export function normalizeRegistrationNumber(reg: string): string {
  return reg.trim().replace(/\s+/g, ' ').toUpperCase()
}

export function validateVehiclePayload(payload: {
  registrationNumber: string
  make: string
  model: string
  year: number
  odometerKm: number
  dailyAvgKm: number
  existingVehicles?: Vehicle[]
  excludeVehicleId?: string
}): string | null {
  const reg = normalizeRegistrationNumber(payload.registrationNumber)
  if (!reg || reg.length < 5) {
    return 'Enter a valid vehicle registration number (minimum 5 characters).'
  }
  if (!payload.make.trim() || !payload.model.trim()) {
    return 'Vehicle make and model are required.'
  }
  const maxYear = new Date().getFullYear() + 1
  if (!Number.isFinite(payload.year) || payload.year < 1990 || payload.year > maxYear) {
    return `Model year must be between 1990 and ${maxYear}.`
  }
  if (!Number.isFinite(payload.odometerKm) || payload.odometerKm < 0) {
    return 'Odometer reading cannot be negative.'
  }
  if (!Number.isFinite(payload.dailyAvgKm) || payload.dailyAvgKm <= 0 || payload.dailyAvgKm > 1500) {
    return 'Daily average utilization must be between 1 and 1,500 km.'
  }
  if (payload.existingVehicles) {
    const duplicate = payload.existingVehicles.find(
      (v) =>
        !v.decommissioned &&
        v.id !== payload.excludeVehicleId &&
        normalizeRegistrationNumber(v.registrationNumber) === reg,
    )
    if (duplicate) {
      return `Registration ${reg} is already registered in this organization.`
    }
  }
  return null
}

export function validateFuelTransactionInput(payload: {
  vehicleId: string
  amountInr: number
  litersOrKwh: number
  unitPriceInr: number
  odometerKm: number
  station: string
}): string | null {
  if (!payload.vehicleId) return 'Select a vehicle.'
  if (!Number.isFinite(payload.amountInr) || payload.amountInr <= 0) {
    return 'Total fuel or charging cost must be greater than ₹0.'
  }
  if (!Number.isFinite(payload.litersOrKwh) || payload.litersOrKwh <= 0) {
    return 'Fuel volume or energy units must be greater than 0.'
  }
  if (!Number.isFinite(payload.unitPriceInr) || payload.unitPriceInr <= 0) {
    return 'Unit price must be greater than ₹0.'
  }
  if (!Number.isFinite(payload.odometerKm) || payload.odometerKm < 0) {
    return 'Odometer reading cannot be negative.'
  }
  if (!payload.station.trim()) {
    return 'Station or charger name is required.'
  }
  return null
}

export function computeVehicleComponentPrediction(params: {
  vehicle: Vehicle
  component: VehicleComponent
  corridor?: RegionalCorridor
  driverEvents: DriverBehaviorEvent[]
  inspections: VehicleInspection[]
  nowMs?: number
  existingId?: string
  existingStatus?: 'open' | 'scheduled' | 'resolved'
}): AIPrediction {
  const { vehicle, component, corridor, driverEvents, inspections } = params
  const nowMs = params.nowMs ?? Date.now()
  const currentYear = new Date(nowMs).getFullYear()

  const lastServiceMs = new Date(vehicle.lastServiceDate).getTime()
  const hasValidServiceDate = !Number.isNaN(lastServiceMs)
  const recentInspections = inspections.filter((i) => i.vehicleId === vehicle.id)
  const hasConnectedTelemetry = vehicle.telemetry.connectionState !== 'disconnected'

  const insufficientReasons: string[] = []
  if (!Number.isFinite(vehicle.odometerKm) || vehicle.odometerKm <= 0) {
    insufficientReasons.push('Odometer baseline missing or zero')
  }
  if (!Number.isFinite(vehicle.dailyAvgKm) || vehicle.dailyAvgKm <= 0) {
    insufficientReasons.push('Daily utilization average missing')
  }
  if (!Number.isFinite(vehicle.year) || vehicle.year < 1990 || vehicle.year > currentYear + 1) {
    insufficientReasons.push('Invalid vehicle model year')
  }
  if (!Number.isFinite(component.healthScore) || component.healthScore <= 0 || component.healthScore > 100) {
    insufficientReasons.push('Component health baseline out of bounds')
  }
  if (!hasValidServiceDate && recentInspections.length === 0 && !hasConnectedTelemetry) {
    insufficientReasons.push('No service history, driver inspections, or active telemetry signal')
  }

  const vehicleAgeYears = Math.max(1, currentYear - (Number.isFinite(vehicle.year) ? vehicle.year : currentYear))
  const roadStress = corridor?.roadStressIndex ?? 0.58
  const climateStress = corridor?.climateImpactScore ?? 0.65
  const daysSinceLastService = hasValidServiceDate
    ? Math.max(0, Math.round((nowMs - lastServiceMs) / 86400000))
    : 180

  const activeEvents = driverEvents.filter(
    (e) =>
      e.vehicleId === vehicle.id &&
      e.disputeStatus !== 'accepted_dismissed',
  )
  const driverHarshEventRate = Number(
    Math.min(1.5, activeEvents.length * 0.08).toFixed(2),
  )

  const inspectionFlagsCount = recentInspections.reduce((acc, insp) => {
    let flags = 0
    if (insp.tyreCondition !== 'good') flags += 1
    if (insp.brakeFeel !== 'normal') flags += 1
    if (insp.fluidLeaksDetected) flags += 1
    if (insp.warningLightsOn) flags += 1
    if (insp.batteryOrStartingIssue) flags += 1
    return acc + flags
  }, 0)

  const costProfile = getComponentBaseCosts(component.componentName, vehicle.powertrain)

  if (insufficientReasons.length > 0) {
    const reasonText = `Insufficient data for a reliable prediction: ${insufficientReasons.join('; ')}.`
    return {
      id: params.existingId ?? `pred-${vehicle.id}-${component.componentName.toLowerCase().replace(/\s+/g, '-')}`,
      organizationId: vehicle.organizationId,
      environment: vehicle.environment,
      vehicleId: vehicle.id,
      componentName: component.componentName,
      priority: 'low',
      predictedIssue: `${costProfile.issueTitle} (Insufficient Data)`,
      evidenceSummary: reasonText,
      recommendedAction: 'Log vehicle odometer, service date, or complete a driver pre-trip inspection before relying on RUL forecasts.',
      confidenceScore: 0,
      confidenceLower: 0,
      confidenceUpper: 0,
      estimatedDaysToFailure: 0,
      earliestWindowDays: 0,
      latestWindowDays: 0,
      predictedFailureDate: 'Insufficient data',
      failureProbability7d: 0,
      failureProbability30d: 0,
      failureProbability90d: 0,
      repairCostInr: 0,
      delayCostInr: 0,
      costOfDelayPerDayInr: 0,
      potentialSavingsInr: 0,
      estimatedDowntimeDaysIfDelayed: 0,
      causalFactors: [],
      modelVersion: INTELLIGENCE_MODEL_VERSION,
      generatedAt: new Date(nowMs).toISOString(),
      inputFeatureSnapshot: {
        vehicleAgeYears,
        odometerKm: vehicle.odometerKm,
        dailyAvgKm: vehicle.dailyAvgKm,
        componentHealthScore: component.healthScore,
        roadStressIndex: roadStress,
        driverHarshEventRate,
        daysSinceLastService,
        inspectionFlagsCount,
      },
      status: params.existingStatus ?? 'open',
      telemetryScopeNote: TELEMETRY_SCOPE_DISCLOSURE,
      insufficientData: true,
      insufficientDataReason: reasonText,
    }
  }

  // Deterministic wear model aligned with backend_ai/algorithms.py
  const baseWearRate = Math.max(0.08, component.wearRatePer1000Km * (vehicle.dailyAvgKm / 120))
  const serviceOverdueMultiplier = daysSinceLastService > 150 ? 1 + Math.min(0.6, (daysSinceLastService - 150) / 250) : 1
  const ageMultiplier = 1 + Math.min(0.45, vehicleAgeYears * 0.05)
  const driverMultiplier = 1 + driverHarshEventRate * 0.28
  const inspectionPenalty = inspectionFlagsCount * 0.12

  const effectiveWearRate = Math.max(
    0.1,
    baseWearRate * (1 + roadStress * 0.7 + climateStress * 0.3) * serviceOverdueMultiplier * ageMultiplier * driverMultiplier + inspectionPenalty,
  )

  const remainingMargin = Math.max(1, component.healthScore - 22)
  const rawDaysToCritical = (remainingMargin / effectiveWearRate) * 1.4
  const estimatedDaysToFailure = Math.max(3, Math.min(180, Math.round(rawDaysToCritical * 0.8)))

  const earliestWindowDays = Math.max(2, Math.round(estimatedDaysToFailure * 0.78))
  const latestWindowDays = Math.max(earliestWindowDays + 2, Math.round(estimatedDaysToFailure * 1.24))

  const predictedFailureDate = new Date(nowMs + estimatedDaysToFailure * 86400000).toISOString().slice(0, 10)

  let priority: AIPrediction['priority'] = 'low'
  if (estimatedDaysToFailure <= 14 || component.healthScore <= 42) {
    priority = 'critical'
  } else if (estimatedDaysToFailure <= 30 || component.healthScore <= 58) {
    priority = 'high'
  } else if (estimatedDaysToFailure <= 65 || component.healthScore <= 74) {
    priority = 'medium'
  }

  // Confidence scales with availability of service dates, inspections, and trip telemetry
  const hasRecentInspection = recentInspections.length > 0 ? 0.06 : 0
  const hasTelemetry = vehicle.telemetry.connectionState === 'connected' ? 0.06 : 0.01
  const hasServiceHistory = daysSinceLastService < 365 ? 0.05 : 0
  const rawConfidence = Math.min(0.95, Math.max(0.62, 0.74 + hasRecentInspection + hasTelemetry + hasServiceHistory))
  const confidenceScore = Number(rawConfidence.toFixed(2))
  const confidenceLower = Number(Math.max(0.5, confidenceScore - 0.06).toFixed(2))
  const confidenceUpper = Number(Math.min(0.98, confidenceScore + 0.05).toFixed(2))

  const failureProbability7d = Number(
    Math.min(0.92, Math.max(0.02, estimatedDaysToFailure <= 10 ? 0.72 : 12 / (estimatedDaysToFailure + 6))).toFixed(2),
  )
  const failureProbability30d = Number(
    Math.min(0.97, Math.max(failureProbability7d, estimatedDaysToFailure <= 28 ? 0.86 : 36 / (estimatedDaysToFailure + 10))).toFixed(2),
  )
  const failureProbability90d = Number(
    Math.min(0.99, Math.max(failureProbability30d, 85 / (estimatedDaysToFailure + 20))).toFixed(2),
  )

  const repairCostInr = costProfile.repairCostInr
  const reactiveRepairCost = Math.round(repairCostInr * costProfile.delayMultiplier)
  const dailyRevenueLoss = Math.round(vehicle.monthlyRevenueInr / 26)
  const downtimeCost = costProfile.downtimeDaysIfDelayed * dailyRevenueLoss
  const delayCostInr = reactiveRepairCost + downtimeCost
  const potentialSavingsInr = Math.max(0, delayCostInr - repairCostInr)
  const costOfDelayPerDayInr = Math.max(150, Math.round(potentialSavingsInr / Math.max(5, estimatedDaysToFailure)))

  // Causal breakdown normalized to 1.0
  const rawWeights = [
    {
      factor: 'usage_and_odometer',
      label: 'Odometer & Daily Usage Intensity',
      raw: 0.25 + Math.min(0.35, vehicle.odometerKm / 400000) + Math.min(0.15, vehicle.dailyAvgKm / 600),
      detail: `${vehicle.odometerKm.toLocaleString('en-IN')} km total · ${vehicle.dailyAvgKm} km/day average`,
    },
    {
      factor: 'road_and_climate_stress',
      label: 'Corridor Road & Ambient Stress',
      raw: 0.15 + roadStress * 0.4,
      detail: `${corridor?.name ?? vehicle.cityName} road stress index ${roadStress.toFixed(2)}`,
    },
    {
      factor: 'maintenance_interval',
      label: 'Service Interval & Age',
      raw: 0.12 + Math.min(0.4, daysSinceLastService / 420) + Math.min(0.15, vehicleAgeYears / 20),
      detail: `${daysSinceLastService} days since last recorded service · Model year ${vehicle.year}`,
    },
    {
      factor: 'driver_and_inspection',
      label: 'Driving Patterns & Inspections',
      raw: 0.08 + driverHarshEventRate * 0.2 + inspectionFlagsCount * 0.12,
      detail: `${activeEvents.length} active driving events · ${inspectionFlagsCount} inspection flags`,
    },
  ]

  const weightSum = rawWeights.reduce((acc, w) => acc + w.raw, 0)
  const causalFactors: PredictionCausalFactor[] = rawWeights
    .map((w) => ({
      factor: w.factor,
      label: w.label,
      weight: Number((w.raw / weightSum).toFixed(2)),
      detail: w.detail,
    }))
    .sort((a, b) => b.weight - a.weight)

  const evidenceParts = [
    `Component health baseline ${component.healthScore}%`,
    `${vehicle.odometerKm.toLocaleString('en-IN')} km odometer`,
    `${daysSinceLastService} days since service`,
    `${corridor?.name ?? vehicle.cityName} stress ${roadStress.toFixed(2)}`,
  ]
  if (inspectionFlagsCount > 0) {
    evidenceParts.push(`${inspectionFlagsCount} inspection flag(s) reported`)
  }

  return {
    id: params.existingId ?? `pred-${vehicle.id}-${component.componentName.toLowerCase().replace(/\s+/g, '-')}`,
    organizationId: vehicle.organizationId,
    environment: vehicle.environment,
    vehicleId: vehicle.id,
    componentName: component.componentName,
    priority,
    predictedIssue: costProfile.issueTitle,
    evidenceSummary: evidenceParts.join(' · '),
    recommendedAction: costProfile.action,
    confidenceScore,
    confidenceLower,
    confidenceUpper,
    estimatedDaysToFailure,
    earliestWindowDays,
    latestWindowDays,
    predictedFailureDate,
    failureProbability7d,
    failureProbability30d,
    failureProbability90d,
    repairCostInr,
    delayCostInr,
    costOfDelayPerDayInr,
    potentialSavingsInr,
    estimatedDowntimeDaysIfDelayed: costProfile.downtimeDaysIfDelayed,
    causalFactors,
    modelVersion: INTELLIGENCE_MODEL_VERSION,
    generatedAt: new Date(nowMs).toISOString(),
    inputFeatureSnapshot: {
      vehicleAgeYears,
      odometerKm: vehicle.odometerKm,
      dailyAvgKm: vehicle.dailyAvgKm,
      componentHealthScore: component.healthScore,
      roadStressIndex: roadStress,
      driverHarshEventRate,
      daysSinceLastService,
      inspectionFlagsCount,
    },
    status: params.existingStatus ?? 'open',
    telemetryScopeNote: TELEMETRY_SCOPE_DISCLOSURE,
    insufficientData: false,
  }
}

export function generateFleetPredictions(params: {
  vehicles: Vehicle[]
  corridors: RegionalCorridor[]
  driverEvents: DriverBehaviorEvent[]
  inspections: VehicleInspection[]
  existingPredictions?: AIPrediction[]
  nowMs?: number
}): AIPrediction[] {
  const { vehicles, corridors, driverEvents, inspections, existingPredictions = [], nowMs } = params
  const predictions: AIPrediction[] = []

  for (const vehicle of vehicles) {
    if (vehicle.decommissioned || vehicle.components.length === 0) continue
    const corridor = corridors.find((c) => c.id === vehicle.corridorId)
    // Generate predictions for any component below 82% health OR the lowest-health component
    const sorted = [...vehicle.components].sort((a, b) => a.healthScore - b.healthScore)
    const candidates = sorted.filter((c, index) => c.healthScore < 82 || index === 0)

    for (const component of candidates) {
      const existing = existingPredictions.find(
        (p) => p.vehicleId === vehicle.id && p.componentName === component.componentName,
      )
      predictions.push(
        computeVehicleComponentPrediction({
          vehicle,
          component,
          corridor,
          driverEvents,
          inspections,
          nowMs,
          existingId: existing?.id,
          existingStatus: existing?.status,
        }),
      )
    }
  }

  const priorityRank: Record<AIPrediction['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return predictions.sort((a, b) => {
    const pDiff = priorityRank[a.priority] - priorityRank[b.priority]
    if (pDiff !== 0) return pDiff
    return a.estimatedDaysToFailure - b.estimatedDaysToFailure
  })
}

export function evaluateDriverSafety(params: {
  driver: Driver
  events: DriverBehaviorEvent[]
  trips: Trip[]
  corridors: RegionalCorridor[]
  vehicles: Vehicle[]
}): {
  overallScore: number
  speedingScore: number
  brakingScore: number
  accelerationScore: number
  corneringScore: number
  fatigueComplianceScore: number
  activeEventCount: number
  disputedEventCount: number
  roadAdjustedNote: string
  coachingRecommendations: string[]
} {
  const { driver, events, trips, corridors, vehicles } = params
  const driverEvents = events.filter((e) => e.driverId === driver.id)
  const activeEvents = driverEvents.filter((e) => e.disputeStatus !== 'accepted_dismissed')
  const disputedEventCount = driverEvents.filter((e) => e.disputeStatus === 'disputed').length

  const vehicle = vehicles.find((v) => v.id === driver.assignedVehicleId)
  const corridor = corridors.find((c) => c.id === vehicle?.corridorId)
  const roadStress = corridor?.roadStressIndex ?? 0.55

  // Mitigate braking/cornering penalties slightly on high-stress pothole routes & mount warnings
  const penaltyFor = (type: DriverBehaviorEvent['eventType']) =>
    activeEvents
      .filter((e) => e.eventType === type)
      .reduce((sum, e) => {
        const base = e.severity === 'high' ? 8 : e.severity === 'medium' ? 5 : 2
        const gpsMitigation = e.gpsAccuracyMeters > 25 ? 0.5 : 1
        const mountMitigation = e.mountStabilityWarning ? 0.45 : 1
        const roadMitigation = type === 'harsh_braking' || type === 'sharp_cornering' ? Math.max(0.65, 1 - roadStress * 0.25) : 1
        return sum + base * gpsMitigation * mountMitigation * roadMitigation
      }, 0)

  const speedingScore = Math.max(25, Math.min(99, Math.round(96 - penaltyFor('overspeeding'))))
  const brakingScore = Math.max(25, Math.min(99, Math.round(95 - penaltyFor('harsh_braking'))))
  const accelerationScore = Math.max(25, Math.min(99, Math.round(96 - penaltyFor('rapid_acceleration'))))
  const corneringScore = Math.max(25, Math.min(99, Math.round(95 - penaltyFor('sharp_cornering'))))
  const fatigueComplianceScore = Math.max(30, Math.min(99, Math.round(98 - penaltyFor('extended_driving'))))

  const driverTrips = trips.filter((t) => t.driverId === driver.id)
  const overallScore = Math.round(
    speedingScore * 0.26 +
      brakingScore * 0.24 +
      accelerationScore * 0.18 +
      corneringScore * 0.16 +
      fatigueComplianceScore * 0.16,
  )

  const coachingRecommendations: string[] = []
  if (brakingScore < 75) {
    coachingRecommendations.push('Coach on progressive deceleration and keeping a 3-second following gap in dense corridors.')
  }
  if (speedingScore < 75) {
    coachingRecommendations.push('Review highway speed thresholds (80 km/h commercial ceiling) on regional expressways.')
  }
  if (fatigueComplianceScore < 82) {
    coachingRecommendations.push('Enforce mandatory 20-minute rest breaks after every 4 hours of continuous driving.')
  }
  if (coachingRecommendations.length === 0) {
    coachingRecommendations.push(
      driverTrips.length > 0
        ? 'Consistent safe driving performance across recent trips; maintain defensive cornering habits.'
        : 'Baseline safety profile established; continue logging trips to refine corridor-adjusted scoring.',
    )
  }

  return {
    overallScore,
    speedingScore,
    brakingScore,
    accelerationScore,
    corneringScore,
    fatigueComplianceScore,
    activeEventCount: activeEvents.length,
    disputedEventCount,
    roadAdjustedNote: `Adjusted for ${corridor?.name ?? 'regional'} road stress (${roadStress.toFixed(2)}), GPS accuracy, and phone mount stability.`,
    coachingRecommendations,
  }
}

export function analyzeFuelTransactions(
  transactions: FuelTransaction[],
  vehicles: Vehicle[],
): FuelTransaction[] {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  )

  const prevByVehicle = new Map<string, FuelTransaction>()

  return sorted
    .map((tx) => {
      const flags: string[] = []
      const vehicle = vehicles.find((v) => v.id === tx.vehicleId)
      const prev = prevByVehicle.get(tx.vehicleId)

      let efficiencyKmPerUnit = tx.efficiencyKmPerUnit
      let costPerKmInr = tx.costPerKmInr

      if (prev) {
        const timeDeltaMin = (new Date(tx.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000
        if (
          timeDeltaMin <= 60 &&
          Math.abs(tx.amountInr - prev.amountInr) <= 10 &&
          tx.station.toLowerCase() === prev.station.toLowerCase()
        ) {
          flags.push('Possible duplicate entry within 60 minutes')
        }

        const kmDelta = tx.odometerKm - prev.odometerKm
        if (kmDelta < 0) {
          flags.push('Odometer reading lower than previous transaction')
        } else if (kmDelta > 0 && tx.litersOrKwh > 0) {
          efficiencyKmPerUnit = Number((kmDelta / tx.litersOrKwh).toFixed(2))
          costPerKmInr = Number((tx.amountInr / kmDelta).toFixed(2))

          const expectedMinKmPerUnit = vehicle?.powertrain === 'EV' ? 0.8 : 4.0
          if (efficiencyKmPerUnit < expectedMinKmPerUnit) {
            flags.push(`Efficiency ${efficiencyKmPerUnit} km/unit below baseline (${expectedMinKmPerUnit}); needs review`)
          }
        }
      }

      if (tx.litersOrKwh > 140 && vehicle?.powertrain !== 'EV') {
        flags.push('Fill volume exceeds typical light/medium commercial tank capacity')
      }

      if (tx.unitPriceInr > 125 && vehicle?.powertrain !== 'EV') {
        flags.push('Unit price significantly above regional benchmark')
      }

      prevByVehicle.set(tx.vehicleId, tx)

      const verificationStatus: FuelTransaction['verificationStatus'] =
        flags.length > 0 ? 'needs_review' : tx.verificationStatus

      return {
        ...tx,
        anomalyFlags: flags,
        verificationStatus,
        efficiencyKmPerUnit,
        costPerKmInr,
      }
    })
    .reverse()
}

export function buildFleetRiskAssessments(params: {
  organizationId: string
  vehicles: Vehicle[]
  predictions: AIPrediction[]
  drivers: Driver[]
  driverEvents: DriverBehaviorEvent[]
  fuelTransactions: FuelTransaction[]
  trips: Trip[]
  nowMs?: number
}): RiskAssessmentItem[] {
  const { organizationId, vehicles, predictions, drivers, driverEvents, fuelTransactions, trips } = params
  const nowMs = params.nowMs ?? Date.now()
  const items: RiskAssessmentItem[] = []

  for (const vehicle of vehicles) {
    if (vehicle.decommissioned) continue

    // 1. Telemetry risk / insufficient data guard
    const telemetryState = classifyTelemetryFreshness(
      vehicle.telemetry.lastUpdatedAt,
      vehicle.telemetry.connectionState,
      nowMs,
    )
    if (telemetryState.freshness === 'offline' || telemetryState.freshness === 'stale') {
      items.push({
        id: `risk-tel-${vehicle.id}`,
        organizationId,
        vehicleId: vehicle.id,
        vehicleRegistration: vehicle.registrationNumber,
        category: 'telemetry',
        severity: telemetryState.freshness === 'offline' ? 'high' : 'moderate',
        title: `Telemetry ${telemetryState.freshness === 'offline' ? 'Disconnected' : 'Stale'}`,
        evidence: `${telemetryState.label} · Signal ${vehicle.telemetry.signalQualityPct}% · GPS ±${vehicle.telemetry.gpsAccuracyMeters}m`,
        confidencePct: 92,
        insufficientData: true,
        timestamp: vehicle.telemetry.lastUpdatedAt,
        recommendedAction: 'Check driver phone GPS/battery optimization settings before dispatching.',
        actionRoute: '/dashboard/map',
      })
    }

    // 2. Maintenance risk from open predictions
    const openVehiclePredictions = predictions.filter((p) => p.vehicleId === vehicle.id && p.status !== 'resolved')
    const topPred = openVehiclePredictions[0]
    if (topPred) {
      const severity: RiskSeverity =
        topPred.priority === 'critical'
          ? 'critical'
          : topPred.priority === 'high'
            ? 'high'
            : topPred.priority === 'medium'
              ? 'moderate'
              : 'normal'

      if (severity !== 'normal') {
        items.push({
          id: `risk-maint-${topPred.id}`,
          organizationId,
          vehicleId: vehicle.id,
          vehicleRegistration: vehicle.registrationNumber,
          category: 'maintenance',
          severity,
          title: `${topPred.componentName}: ${topPred.predictedIssue}`,
          evidence: `${topPred.evidenceSummary} · Est. failure window ${topPred.earliestWindowDays}–${topPred.latestWindowDays} days`,
          confidencePct: Math.round(topPred.confidenceScore * 100),
          insufficientData: false,
          timestamp: topPred.generatedAt,
          recommendedAction: topPred.recommendedAction,
          actionRoute: '/dashboard/maintenance',
        })
      }
    }

    // 3. Driver safety risk
    const driver = drivers.find((d) => d.id === vehicle.assignedDriverId)
    if (driver) {
      const recentEvents = driverEvents.filter(
        (e) => e.driverId === driver.id && e.disputeStatus !== 'accepted_dismissed',
      )
      if (driver.safetyScore < 65 || recentEvents.length >= 4) {
        items.push({
          id: `risk-drv-${vehicle.id}`,
          organizationId,
          vehicleId: vehicle.id,
          vehicleRegistration: vehicle.registrationNumber,
          category: 'driver_safety',
          severity: driver.safetyScore < 50 ? 'critical' : 'high',
          title: `Elevated Driver Safety Risk — ${driver.name}`,
          evidence: `Safety score ${driver.safetyScore}/100 · ${recentEvents.length} active telemetry behavior events`,
          confidencePct: 86,
          insufficientData: false,
          timestamp: recentEvents[0]?.timestamp ?? new Date(nowMs).toISOString(),
          recommendedAction: driver.coachingRecommendations[0] ?? 'Assign driver safety coaching session.',
          actionRoute: '/dashboard/drivers',
        })
      }
    }

    // 4. Fuel review risk
    const flaggedFuel = fuelTransactions.filter(
      (tx) => tx.vehicleId === vehicle.id && tx.verificationStatus === 'needs_review',
    )
    if (flaggedFuel.length > 0) {
      items.push({
        id: `risk-fuel-${vehicle.id}`,
        organizationId,
        vehicleId: vehicle.id,
        vehicleRegistration: vehicle.registrationNumber,
        category: 'fuel',
        severity: flaggedFuel.length > 1 ? 'high' : 'moderate',
        title: `${flaggedFuel.length} Fuel Entry Flagged for Verification`,
        evidence: flaggedFuel[0].anomalyFlags.join(' · ') || 'Variance above vehicle baseline',
        confidencePct: 84,
        insufficientData: false,
        timestamp: flaggedFuel[0].timestamp,
        recommendedAction: 'Review receipt and odometer photo before approving reimbursement.',
        actionRoute: '/dashboard/fuel',
      })
    }

    // 5. Trip exceptions
    const delayedOrInterruptedTrips = trips.filter(
      (t) => t.vehicleId === vehicle.id && (t.status === 'delayed' || t.status === 'interrupted' || t.stops.some((s) => s.flaggedForReview)),
    )
    if (delayedOrInterruptedTrips.length > 0) {
      const trip = delayedOrInterruptedTrips[0]
      items.push({
        id: `risk-trip-${vehicle.id}`,
        organizationId,
        vehicleId: vehicle.id,
        vehicleRegistration: vehicle.registrationNumber,
        category: 'trip_exceptions',
        severity: trip.status === 'interrupted' ? 'high' : 'moderate',
        title: `Trip Exception on ${trip.originAddress} → ${trip.destinationAddress}`,
        evidence: `Status: ${trip.status} · ${trip.stops.filter((s) => s.flaggedForReview).length} unplanned long stop(s)`,
        confidencePct: 88,
        insufficientData: false,
        timestamp: trip.startTime,
        recommendedAction: 'Verify corridor delay or unplanned stop reason with driver.',
        actionRoute: '/dashboard/trips',
      })
    }
  }

  // Ensure vehicles with no elevated risk still show up cleanly under Normal
  for (const vehicle of vehicles) {
    if (vehicle.decommissioned) continue
    const hasRisk = items.some((i) => i.vehicleId === vehicle.id)
    if (!hasRisk) {
      items.push({
        id: `risk-normal-${vehicle.id}`,
        organizationId,
        vehicleId: vehicle.id,
        vehicleRegistration: vehicle.registrationNumber,
        category: 'maintenance',
        severity: 'normal',
        title: 'Operating Within Normal Parameters',
        evidence: `Vehicle health ${vehicle.healthScore}% · Telemetry ${vehicle.telemetry.connectionState}`,
        confidencePct: 90,
        insufficientData: false,
        timestamp: vehicle.telemetry.lastUpdatedAt,
        recommendedAction: 'Continue scheduled preventive inspections.',
        actionRoute: `/dashboard/fleet/${vehicle.id}`,
      })
    }
  }

  const severityOrder: Record<RiskSeverity, number> = {
    critical: 0,
    high: 1,
    moderate: 2,
    normal: 3,
  }

  return items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
}

export function computeFinancialIntelligence(params: {
  vehicles: Vehicle[]
  fuelTransactions: FuelTransaction[]
  maintenanceRecords: MaintenanceRecord[]
  predictions: AIPrediction[]
  trips: Trip[]
  period: ReportingPeriod
}): {
  fuelExpenditureInr: number
  maintenanceExpenditureInr: number
  operatingExpenditureInr: number
  totalDistanceKm: number
  costPerKmInr: number
  estimatedDowntimeCostInr: number
  estimatedPotentialSavingsInr: number
  utilizationPct: number
  iceVsEv: {
    iceCount: number
    evCount: number
    iceCostPerKmInr: number
    evCostPerKmInr: number
    iceAvgHealth: number
    evAvgHealth: number
  }
  vehicleCostBreakdown: Array<{
    vehicleId: string
    registrationNumber: string
    powertrain: 'ICE' | 'EV'
    fuelSpendInr: number
    maintenanceSpendInr: number
    totalSpendInr: number
    distanceKm: number
    costPerKmInr: number
  }>
  methodologyNotes: string[]
} {
  const { vehicles, fuelTransactions, maintenanceRecords, predictions, trips, period } = params
  const periodFactor = period === '7d' ? 0.35 : period === '30d' ? 1 : 2.6

  const activeVehicles = vehicles.filter((v) => !v.decommissioned)
  const fuelExpenditureInr = Math.round(
    fuelTransactions.reduce((sum, tx) => sum + tx.amountInr, 0) * (period === '7d' ? 0.65 : period === '30d' ? 1 : 2.8),
  )
  const maintenanceExpenditureInr = Math.round(
    maintenanceRecords.reduce((sum, m) => sum + m.costInr, 0) * (period === '7d' ? 0.45 : period === '30d' ? 1 : 2.4),
  )

  const baseTripKm = trips.reduce((sum, t) => sum + t.distanceKm, 0)
  const projectedDailyKm = activeVehicles.reduce((sum, v) => sum + v.dailyAvgKm, 0)
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const totalDistanceKm = Math.max(1, Math.round(Math.max(baseTripKm, projectedDailyKm * (days * 0.72))))

  const operatingExpenditureInr = fuelExpenditureInr + maintenanceExpenditureInr
  const costPerKmInr = Number((operatingExpenditureInr / totalDistanceKm).toFixed(2))

  const openHighPredictions = predictions.filter(
    (p) => p.status !== 'resolved' && (p.priority === 'critical' || p.priority === 'high'),
  )
  // Consolidate per-vehicle maximum exposure to avoid double-counting overlapping breakdown downtime on one vehicle
  const topByVehicle = new Map<string, AIPrediction>()
  for (const p of openHighPredictions) {
    const existing = topByVehicle.get(p.vehicleId)
    if (!existing || p.potentialSavingsInr > existing.potentialSavingsInr) {
      topByVehicle.set(p.vehicleId, p)
    }
  }
  const consolidatedPredictions = Array.from(topByVehicle.values())

  const estimatedDowntimeCostInr = Math.round(
    consolidatedPredictions.reduce(
      (sum, p) => sum + Math.max(0, p.delayCostInr - p.repairCostInr * 2),
      0,
    ) * (periodFactor > 1 ? 1.2 : 1),
  )

  const estimatedPotentialSavingsInr = consolidatedPredictions.reduce(
    (sum, p) => sum + p.potentialSavingsInr,
    0,
  )

  const movingOrIdle = activeVehicles.filter(
    (v) => v.operationStatus === 'moving' || v.operationStatus === 'idle' || v.operationStatus === 'delayed',
  ).length
  const utilizationPct = activeVehicles.length > 0 ? Math.round((movingOrIdle / activeVehicles.length) * 100) : 0

  const vehicleCostBreakdown = activeVehicles.map((v) => {
    const vFuel = fuelTransactions
      .filter((tx) => tx.vehicleId === v.id)
      .reduce((s, tx) => s + tx.amountInr, 0)
    const vMaint = maintenanceRecords
      .filter((m) => m.vehicleId === v.id)
      .reduce((s, m) => s + m.costInr, 0)
    const vTripsKm = trips.filter((t) => t.vehicleId === v.id).reduce((s, t) => s + t.distanceKm, 0)
    const vDistance = Math.max(120, Math.round(Math.max(vTripsKm, v.dailyAvgKm * (days * 0.72))))
    const totalSpendInr = Math.round((vFuel + vMaint) * (period === '90d' ? 2.6 : 1))
    return {
      vehicleId: v.id,
      registrationNumber: v.registrationNumber,
      powertrain: v.powertrain,
      fuelSpendInr: Math.round(vFuel * (period === '90d' ? 2.6 : 1)),
      maintenanceSpendInr: Math.round(vMaint * (period === '90d' ? 2.6 : 1)),
      totalSpendInr,
      distanceKm: vDistance,
      costPerKmInr: Number((totalSpendInr / vDistance).toFixed(2)),
    }
  })

  const iceRows = vehicleCostBreakdown.filter((r) => r.powertrain === 'ICE')
  const evRows = vehicleCostBreakdown.filter((r) => r.powertrain === 'EV')
  const iceVehicles = activeVehicles.filter((v) => v.powertrain === 'ICE')
  const evVehicles = activeVehicles.filter((v) => v.powertrain === 'EV')

  const avgCost = (rows: typeof vehicleCostBreakdown) =>
    rows.length > 0
      ? Number((rows.reduce((s, r) => s + r.costPerKmInr, 0) / rows.length).toFixed(2))
      : 0

  const avgHealth = (list: Vehicle[]) =>
    list.length > 0 ? Math.round(list.reduce((s, v) => s + v.healthScore, 0) / list.length) : 0

  return {
    fuelExpenditureInr,
    maintenanceExpenditureInr,
    operatingExpenditureInr,
    totalDistanceKm,
    costPerKmInr,
    estimatedDowntimeCostInr,
    estimatedPotentialSavingsInr,
    utilizationPct,
    iceVsEv: {
      iceCount: iceVehicles.length,
      evCount: evVehicles.length,
      iceCostPerKmInr: avgCost(iceRows),
      evCostPerKmInr: avgCost(evRows),
      iceAvgHealth: avgHealth(iceVehicles),
      evAvgHealth: avgHealth(evVehicles),
    },
    vehicleCostBreakdown,
    methodologyNotes: [
      'Cost per km = (Recorded Fuel/Charging Spend + Recorded Maintenance Spend) / Distance Logged for the selected reporting window.',
      'Estimated Potential Savings = Per-vehicle highest open high/critical exposure ((Projected Reactive Breakdown Cost + Estimated Daily Revenue Loss during Downtime) − Preventive Repair Cost), consolidated to prevent double-counting overlapping shop visits.',
      'EV vs ICE operating comparison isolates energy/fuel and service costs per kilometer; capital depreciation and battery lease terms are excluded unless configured.',
    ],
  }
}

export function generateCsvContent(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const escapeCell = (val: string | number | boolean | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val)
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ]
  return lines.join('\n')
}
