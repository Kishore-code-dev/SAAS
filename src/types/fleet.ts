export type OperatingEnvironment = 'demo' | 'pilot' | 'production'

export type OrganizationRole =
  | 'platform_admin'
  | 'org_admin'
  | 'fleet_manager'
  | 'maintenance'
  | 'finance'
  | 'driver'

export type SubscriptionPlanId = 'starter' | 'growth' | 'enterprise'

export type ReportingPeriod = '7d' | '30d' | '90d'

export type FuelType = 'Diesel' | 'Petrol' | 'CNG' | 'Electric'
export type PowertrainType = 'ICE' | 'EV'

export type VehicleCategory =
  | 'Light Commercial'
  | 'Medium Truck'
  | 'Heavy Truck'
  | 'Delivery Van'
  | 'Electric Cargo'

export type VehicleOperationStatus =
  | 'moving'
  | 'idle'
  | 'stopped'
  | 'offline'
  | 'delayed'
  | 'maintenance'

export type TelemetryFreshness = 'live' | 'delayed' | 'stale' | 'offline'

export type RiskSeverity = 'critical' | 'high' | 'moderate' | 'normal'

export type RiskCategory =
  | 'maintenance'
  | 'driver_safety'
  | 'fuel'
  | 'telemetry'
  | 'trip_exceptions'

export type ComponentCategory =
  | 'Engine'
  | 'Brakes'
  | 'Tyres'
  | 'Battery'
  | 'Suspension'
  | 'Transmission'
  | 'Cooling System'
  | 'EV Battery'

export interface LatLng {
  lat: number
  lng: number
}

export interface Organization {
  id: string
  name: string
  code: string
  city: string
  state: string
  timezone: string
  currency: 'INR'
  planId: SubscriptionPlanId
  vehicleLimit: number
  driverLimit: number
  createdAt: string
  environment: OperatingEnvironment
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  fullName: string
  email: string
  role: OrganizationRole
  status: 'active' | 'invited' | 'suspended'
  lastActiveAt: string
}

export interface RegionalCorridor {
  id: string
  name: string
  region: string
  roadStressIndex: number
  climateImpactScore: number
  potholeDensity: 'low' | 'moderate' | 'high'
  avgAmbientTempC: number
}

export interface VehicleComponent {
  id: string
  vehicleId: string
  componentName: ComponentCategory
  healthScore: number
  status: 'healthy' | 'at-risk' | 'critical'
  wearRatePer1000Km: number
  lastServicedAt: string
  predictedReplacementDate: string
  notes: string
}

export interface TelemetrySnapshot {
  vehicleId: string
  location: LatLng
  cityLabel: string
  speedKmh: number
  heading: number
  gpsAccuracyMeters: number
  signalQualityPct: number
  connectionState: 'connected' | 'intermittent' | 'disconnected'
  source: 'smartphone_gps' | 'hybrid_obd' | 'simulated'
  lastUpdatedAt: string
  batteryLevelPct?: number
  motionPermissionGranted: boolean
}

export interface Vehicle {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  registrationNumber: string
  make: string
  model: string
  category: VehicleCategory
  powertrain: PowertrainType
  fuelType: FuelType
  year: number
  assignedDriverId: string | null
  odometerKm: number
  dailyAvgKm: number
  healthScore: number
  operationStatus: VehicleOperationStatus
  fuelOrSocPct: number
  corridorId: string
  cityName: string
  registrationExpiry: string
  insuranceExpiry: string
  insuranceProvider: string
  lastServiceDate: string
  nextServiceDueDate: string
  monthlyRevenueInr: number
  telemetry: TelemetrySnapshot
  components: VehicleComponent[]
  decommissioned?: boolean
}

export interface DriverBehaviorEvent {
  id: string
  organizationId: string
  driverId: string
  vehicleId: string
  tripId: string
  eventType:
    | 'harsh_braking'
    | 'rapid_acceleration'
    | 'overspeeding'
    | 'sharp_cornering'
    | 'extended_driving'
  severity: 'low' | 'medium' | 'high'
  speedKmh: number
  roadStressContext: number
  gpsAccuracyMeters: number
  mountStabilityWarning: boolean
  timestamp: string
  locationLabel: string
  disputeStatus: 'none' | 'disputed' | 'accepted_dismissed' | 'rejected_upheld'
  disputeReason?: string
  disputeResolutionNote?: string
}

export interface Driver {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  name: string
  mobile: string
  email: string
  licenseNumber: string
  licenseExpiry: string
  assignedVehicleId: string | null
  status: 'on_trip' | 'available' | 'off_duty' | 'onboarding'
  safetyScore: number
  speedingScore: number
  brakingScore: number
  accelerationScore: number
  corneringScore: number
  fatigueComplianceScore: number
  totalTrips: number
  totalDistanceKm: number
  joinDate: string
  coachingRecommendations: string[]
  dataConfidenceNote: string
}

export interface TripStop {
  id: string
  tripId: string
  location: LatLng
  address: string
  startTime: string
  endTime?: string
  durationMinutes: number
  reason: 'fuel' | 'loading' | 'rest' | 'traffic' | 'unplanned'
  flaggedForReview: boolean
}

export interface TripSpeedPoint {
  minuteOffset: number
  label: string
  speedKmh: number
}

export interface Trip {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  driverId: string
  originAddress: string
  destinationAddress: string
  startLocation: LatLng
  endLocation?: LatLng
  startTime: string
  endTime?: string
  distanceKm: number
  durationMinutes: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  status: 'active' | 'completed' | 'delayed' | 'interrupted'
  route: LatLng[]
  speedTimeline: TripSpeedPoint[]
  stops: TripStop[]
  offlineSynced?: boolean
}

export interface FuelTransaction {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  driverId: string
  tripId?: string
  amountInr: number
  litersOrKwh: number
  unitPriceInr: number
  odometerKm: number
  station: string
  location: LatLng
  timestamp: string
  paymentMethod: 'upi' | 'fleet_card' | 'cash' | 'ev_charging'
  entrySource: 'manual_driver_entry' | 'receipt_ocr' | 'station_feed'
  verificationStatus: 'verified' | 'pending' | 'needs_review'
  anomalyFlags: string[]
  efficiencyKmPerUnit?: number
  costPerKmInr?: number
}

export interface MaintenanceRecord {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  serviceType: string
  componentName: ComponentCategory | 'General Service'
  serviceCenter: string
  description: string
  costInr: number
  downtimeDays: number
  partsReplaced: string[]
  performedAt: string
  status: 'scheduled' | 'in_progress' | 'completed'
  linkedPredictionId?: string
}

export interface VehicleInspection {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  driverId: string
  timestamp: string
  tyreCondition: 'good' | 'worn' | 'critical'
  brakeFeel: 'normal' | 'spongy' | 'squealing'
  fluidLeaksDetected: boolean
  warningLightsOn: boolean
  batteryOrStartingIssue: boolean
  notes: string
  passed: boolean
}

export interface PredictionCausalFactor {
  factor: string
  label: string
  weight: number
  detail: string
}

export interface AIPrediction {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  componentName: ComponentCategory
  priority: 'low' | 'medium' | 'high' | 'critical'
  predictedIssue: string
  evidenceSummary: string
  recommendedAction: string
  confidenceScore: number
  confidenceLower: number
  confidenceUpper: number
  estimatedDaysToFailure: number
  earliestWindowDays: number
  latestWindowDays: number
  predictedFailureDate: string
  failureProbability7d: number
  failureProbability30d: number
  failureProbability90d: number
  repairCostInr: number
  delayCostInr: number
  costOfDelayPerDayInr: number
  potentialSavingsInr: number
  estimatedDowntimeDaysIfDelayed: number
  causalFactors: PredictionCausalFactor[]
  modelVersion: string
  generatedAt: string
  inputFeatureSnapshot: {
    vehicleAgeYears: number
    odometerKm: number
    dailyAvgKm: number
    componentHealthScore: number
    roadStressIndex: number
    driverHarshEventRate: number
    daysSinceLastService: number
    inspectionFlagsCount: number
  }
  status: 'open' | 'scheduled' | 'resolved'
  telemetryScopeNote: string
  insufficientData?: boolean
  insufficientDataReason?: string
}

export interface OperationalAlert {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  driverId?: string
  category: RiskCategory
  severity: RiskSeverity
  title: string
  message: string
  source?: string
  timestamp: string
  read: boolean
  acknowledged: boolean
  actionRoute: string
}

export interface RiskAssessmentItem {
  id: string
  organizationId: string
  vehicleId: string
  vehicleRegistration: string
  category: RiskCategory
  severity: RiskSeverity
  title: string
  evidence: string
  confidencePct: number
  insufficientData: boolean
  timestamp: string
  recommendedAction: string
  actionRoute: string
}

export interface AuditLogEntry {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  actorName: string
  actorRole: OrganizationRole
  action: string
  entityType: string
  entityId: string
  summary: string
  timestamp: string
}

export interface ReportHistoryItem {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  categoryId: string
  title: string
  period: ReportingPeriod
  generatedBy: string
  generatedAt: string
  format: 'CSV' | 'PDF'
  rowCount: number
}

export interface DemoRequestSubmission {
  id: string
  fullName: string
  workEmail: string
  companyName: string
  fleetSize: string
  phone: string
  notes: string
  submittedAt: string
}
