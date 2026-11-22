export type OperatingEnvironment = 'production'

export type OrganizationRole =
  | 'platform_admin'
  | 'org_admin'
  | 'fleet_staff'
  | 'driver'
  | 'fleet_manager'
  | 'maintenance'
  | 'finance'
  | 'viewer'

export type OrganizationStatus =
  | 'active'
  | 'payment_pending'
  | 'grace_period'
  | 'suspended'
  | 'terminated'
  | 'archived'

export type SubscriptionPlanId = 'monthly' | 'annual' | 'starter' | 'growth' | 'enterprise'
export type BillingFrequency = 'monthly' | 'annual'

export type BusinessType =
  | 'Transport'
  | 'Logistics'
  | 'Passenger Transport'
  | 'Goods Transportation'
  | 'School/Staff Transportation'
  | 'Construction Fleet'
  | 'Other'

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

export type RefreshStatus =
  | 'idle'
  | 'refreshing'
  | 'updated'
  | 'partially_updated'
  | 'no_new_data'
  | 'failed'

export type RiskSeverity = 'critical' | 'high' | 'moderate' | 'normal'

export type RiskCategory =
  | 'maintenance'
  | 'driver_safety'
  | 'fuel'
  | 'telemetry'
  | 'trip_exceptions'
  | 'compliance_expiry'
  | 'inspection_defects'
  | 'climate_corridor'
  | 'inventory_shortage'
  | 'financial_variance'

export type FiveAreaHealthCategory =
  | 'Fuel Health'
  | 'Engine Health'
  | 'Tyre Health'
  | 'Driver Health'
  | 'Vehicle Health'

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
  status: OrganizationStatus
  paymentStatus: 'paid' | 'pending' | 'overdue' | 'grace' | 'cancelled'
  subscriptionStartDate: string
  subscriptionExpiryDate: string
  gracePeriodUntil?: string
  suspensionReason?: string
  ownerName?: string
  ownerEmail?: string
  ownerPhone?: string
  gstin?: string
  businessType?: BusinessType
  onboardingCompleted?: boolean
  onboardingStep?: number
  billingFrequency?: BillingFrequency
  gracePeriodDays?: number
  expiredAccessPolicy?: 'read_only' | 'blocked'
  createdAt: string
  environment: OperatingEnvironment
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  username?: string
  fullName: string
  email: string
  role: OrganizationRole
  status: 'active' | 'invited' | 'suspended' | 'invitation_pending' | 'deactivated' | 'draft'
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

export interface VehicleTechnicalSpecs {
  heightMeters: number
  widthMeters: number
  lengthMeters: number
  grossVehicleWeightKg: number
  axleCount: number
  payloadCapacityKg: number
  cargoType: string
  hazmatClass?: string
  chassisNumber?: string
  engineNumber?: string
  emissionNorm?: 'BS-VI' | 'BS-IV' | 'EV-Zero'
}

export type DocumentVerificationStatus =
  | 'uploaded'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'expired'

export interface DocumentVaultItem {
  id: string
  organizationId: string
  entityType: 'vehicle' | 'driver'
  entityId: string
  category: string
  title: string
  documentNumber?: string
  maskedNumber?: string
  issuingAuthority?: string
  issuedDate?: string
  expiryDate?: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  storageKey: string
  verificationStatus: DocumentVerificationStatus
  verifiedBy?: string
  verifiedAt?: string
  rejectionReason?: string
  uploadedBy: string
  uploadedAt: string
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

export interface VehicleFiveAreaHealth {
  fuelHealth: { score: number; status: 'healthy' | 'at-risk' | 'critical' | 'insufficient_data'; detail: string }
  engineHealth: { score: number; status: 'healthy' | 'at-risk' | 'critical' | 'insufficient_data'; detail: string }
  tyreHealth: { score: number; status: 'healthy' | 'at-risk' | 'critical' | 'insufficient_data'; detail: string }
  driverHealth: { score: number; status: 'healthy' | 'at-risk' | 'critical' | 'insufficient_data'; detail: string }
  vehicleHealth: { score: number; status: 'healthy' | 'at-risk' | 'critical' | 'insufficient_data'; detail: string }
}

export interface TyrePositionRecord {
  id: string
  vehicleId: string
  position: string // e.g., 'FL', 'FR', 'RL-Outer', 'RL-Inner', 'RR-Outer', 'RR-Inner'
  brand: string
  serialNumber: string
  treadDepthMm: number
  pressurePsi?: number
  temperatureC?: number
  installedAtOdometerKm: number
  expectedLifeKm: number
  status: 'healthy' | 'wear_watch' | 'replace_soon'
  lastInspectedAt: string
}

export type VehicleOwnershipCategory =
  | 'company_owned'
  | 'contracted_fleet'
  | 'individual_owner'

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
  fitnessExpiry?: string
  pucExpiry?: string
  permitExpiry?: string
  lastServiceDate: string
  nextServiceDueDate: string
  nextServiceDueOdometerKm?: number
  monthlyRevenueInr: number
  ownershipCategory?: VehicleOwnershipCategory
  legalOwnerName?: string
  fleetPartnerId?: string | null
  individualOwnerId?: string | null
  activeContractId?: string | null
  specs?: VehicleTechnicalSpecs
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

export type IndianLicenseCategory = 'LMV-TR' | 'TRANS' | 'HGMV' | 'HPMV' | 'HTV' | 'MGV'

export type DriverOperationalStatus = 'active' | 'inactive' | 'suspended' | 'archived'

export interface DriverAssignmentHistoryItem {
  id: string
  organizationId: string
  driverId: string
  vehicleId: string
  vehicleRegistration: string
  assignedAt: string
  unassignedAt?: string
  assignedBy: string
  notes?: string
}

export interface Driver {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  employeeCode?: string
  name: string
  mobile: string
  alternateMobile?: string
  email: string
  dateOfBirth?: string
  city?: string
  state?: string
  address?: string
  bloodGroup?: string
  emergencyContactName?: string
  emergencyContactRelation?: string
  emergencyContactPhone?: string
  licenseNumber: string
  licenseCategories?: IndianLicenseCategory[]
  licenseIssuingRto?: string
  licenseIssueDate?: string
  licenseExpiry: string
  hazmatEndorsed?: boolean
  hazmatExpiry?: string
  aadhaarMasked?: string
  panMasked?: string
  medicalFitnessExpiry?: string
  policeVerificationStatus?: 'pending' | 'verified' | 'expired' | 'not_submitted'
  digilockerStatus?: 'not_connected' | 'disabled_by_admin' | 'verified' | 'error'
  assignedVehicleId: string | null
  operationalStatus: DriverOperationalStatus
  status: 'on_trip' | 'available' | 'off_duty' | 'suspended' | 'archived'
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
  origin?: string
  destination?: string
  startLocation: LatLng
  endLocation?: LatLng
  startTime: string
  endTime?: string
  startedAt?: string
  startedByUserId?: string
  completedAt?: string
  completedByUserId?: string
  odometerStart?: number
  odometerEnd?: number
  odometerFlag?: 'verified' | 'inconsistent'
  odometerFlagReason?: string
  driverNotes?: string
  distanceKm: number
  plannedDistanceKm?: number
  durationMinutes: number
  plannedDurationMinutes?: number
  avgSpeedKmh: number
  maxSpeedKmh: number
  status:
    | 'scheduled'
    | 'active'
    | 'completed'
    | 'delayed'
    | 'interrupted'
    | 'Assigned'
    | 'Accepted'
    | 'Ready to Start'
    | 'In Progress'
    | 'On Hold'
    | 'Completed'
    | 'Cancelled'
  truckRoutingMode?: 'google_truck_verified' | 'google_truck_partial_restrictions' | 'highway_geometry_unverified'
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
  entrySource: 'owner_entry' | 'receipt_ocr' | 'station_feed'
  verificationStatus: 'verified' | 'pending' | 'needs_review'
  paymentState?: 'recorded' | 'verified' | 'paid'
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
  workshopId?: string
  description: string
  costInr: number
  paymentState?: 'recorded' | 'verified' | 'paid'
  billNumber?: string
  billFileName?: string
  downtimeDays: number
  partsReplaced: string[]
  performedAt: string
  odometerAtServiceKm?: number
  status: 'scheduled' | 'in_progress' | 'completed'
  linkedPredictionId?: string
  linkedWorkOrderId?: string
}

export interface ServiceScheduleReminder {
  id: string
  organizationId: string
  vehicleId: string
  title: string
  healthArea: FiveAreaHealthCategory
  intervalDays: number
  intervalKm: number
  dueDate: string
  dueOdometerKm: number
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'upcoming' | 'due_soon' | 'overdue' | 'completed'
}

export interface SmallIssueLog {
  id: string
  organizationId: string
  vehicleId: string
  driverId?: string
  title: string
  description: string
  healthArea: FiveAreaHealthCategory
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'triaged' | 'converted_to_wo' | 'resolved'
  source: 'owner_manual' | 'inspection_defect' | 'predictive_alert'
  reportedBy: string
  reportedAt: string
  linkedWorkOrderId?: string
}

export type WorkOrderStatus =
  | 'draft'
  | 'open'
  | 'approved'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'closed'

export interface WorkOrderPartLine {
  partId: string
  partName: string
  sku: string
  quantity: number
  unitCostInr: number
  totalCostInr: number
  consumedFromStock: boolean
}

export interface WorkOrder {
  id: string
  organizationId: string
  workOrderNumber: string
  vehicleId: string
  workshopId?: string
  workshopName: string
  title: string
  description: string
  healthArea: FiveAreaHealthCategory
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: WorkOrderStatus
  linkedIssueIds: string[]
  tasks: Array<{ id: string; title: string; completed: boolean }>
  parts: WorkOrderPartLine[]
  laborCostInr: number
  partsCostInr: number
  totalCostInr: number
  paymentState: 'recorded' | 'verified' | 'paid'
  createdBy: string
  createdAt: string
  scheduledFor?: string
  completedAt?: string
}

export interface PartInventoryItem {
  id: string
  organizationId: string
  sku: string
  name: string
  category: FiveAreaHealthCategory | 'Consumables' | 'Safety'
  unit: string
  stockQty: number
  reorderThreshold: number
  unitCostInr: number
  preferredSupplierId?: string
  warehouseLocation: string
  updatedAt: string
}

export interface SupplierRecord {
  id: string
  organizationId: string
  name: string
  gstin?: string
  city: string
  contactName: string
  phone: string
  email: string
  leadTimeDays: number
  rating: number
}

export interface PurchaseOrder {
  id: string
  organizationId: string
  poNumber: string
  supplierId: string
  supplierName: string
  status: 'draft' | 'issued' | 'partially_received' | 'received' | 'cancelled'
  items: Array<{
    partId: string
    partName: string
    sku: string
    orderedQty: number
    receivedQty: number
    unitCostInr: number
  }>
  totalAmountInr: number
  paymentState: 'recorded' | 'verified' | 'paid'
  createdAt: string
  expectedAt?: string
}

export interface InventoryTransaction {
  id: string
  organizationId: string
  partId: string
  partName: string
  type: 'po_receive' | 'wo_consume' | 'manual_adjust'
  quantityDelta: number
  balanceAfter: number
  referenceType: 'purchase_order' | 'work_order' | 'audit'
  referenceId: string
  performedBy: string
  timestamp: string
}

export interface WorkshopVendor {
  id: string
  organizationId: string
  name: string
  city: string
  specialties: FiveAreaHealthCategory[]
  contactPhone: string
  slaTurnaroundHours: number
  avgTurnaroundHours: number
  completedJobsCount: number
  totalSpendInr: number
  rating: number
}

export interface FinancialInvoice {
  id: string
  organizationId: string
  invoiceNumber: string
  vendorName: string
  category: 'maintenance' | 'parts_po' | 'fuel' | 'insurance' | 'compliance'
  vehicleId?: string
  referenceId?: string
  amountInr: number
  paidAmountInr: number
  status: 'recorded' | 'verified' | 'partially_paid' | 'paid'
  dueDate: string
  issuedDate: string
  notes?: string
}

export interface PaymentRecord {
  id: string
  organizationId: string
  invoiceId: string
  invoiceNumber: string
  amountInr: number
  paymentMethod: 'neft' | 'rtgs' | 'upi' | 'fleet_card' | 'cheque'
  referenceNumber: string
  paidAt: string
  recordedBy: string
}

export interface VehicleInspection {
  id: string
  organizationId: string
  environment: OperatingEnvironment
  vehicleId: string
  driverId: string
  inspectorName?: string
  timestamp: string
  tyreCondition: 'good' | 'worn' | 'critical'
  brakeFeel: 'normal' | 'spongy' | 'squealing'
  fluidLeaksDetected: boolean
  warningLightsOn: boolean
  batteryOrStartingIssue: boolean
  notes: string
  passed: boolean
  linkedIssueIds?: string[]
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
  healthArea?: FiveAreaHealthCategory
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
  reason?: string
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
  format: 'CSV' | 'PDF' | 'XLSX'
  rowCount: number
}

export interface FleetToolItem {
  id: string
  organizationId?: string
  name: string
  serialNumber: string
  category: string
  assignedTo: string
  location: string
  status: 'in_service' | 'checked_out' | 'maintenance' | 'retired'
  purchaseCostInr: number
  nextCalibrationDate: string
}

export interface FleetWarrantyItem {
  id: string
  organizationId?: string
  vehicleId?: string
  assetName: string
  registrationNumber: string
  provider: string
  coverageType: 'Powertrain' | 'Battery / EV Pack' | 'Chassis & Axle' | 'Tyre Casing' | 'Component'
  startDate: string
  expiryDate: string
  maxOdometerKm: number
  claimStatus: 'active' | 'expiring_soon' | 'claimed' | 'expired'
}

export interface CustomRecordEntry {
  id: string
  organizationId?: string
  recordType: 'Toll & FASTag Audit' | 'RTO Permit Log' | 'Cold-Chain Temp Audit' | 'Driver Uniform & Kit'
  vehicleOrDriver: string
  referenceCode: string
  recordedDate: string
  amountInr: number
  status: 'verified' | 'pending' | 'flagged'
  notes: string
}

export interface ApiKeyEntry {
  id: string
  organizationId?: string
  label: string
  prefix: string
  scope: 'read_only' | 'read_write' | 'telematics_ingest'
  createdAt: string
  lastUsedAt: string
}

export interface WebhookEndpoint {
  id: string
  organizationId?: string
  url: string
  events: string[]
  active: boolean
  lastDeliveryStatus: number
}

export interface LookupTagItem {
  id: string
  name: string
  color?: string
  description?: string
  active: boolean
}

export interface CustomDashboardLayout {
  id: string
  organizationId?: string
  name: string
  widgets: string
  defaultView: boolean
}

export interface ServiceTaskCatalogItem {
  id: string
  organizationId?: string
  code: string
  title: string
  area: FiveAreaHealthCategory
  avgHours: number
  estCostInr: number
  active: boolean
}

export interface ServiceProgramItem {
  id: string
  organizationId?: string
  name: string
  powertrain: 'ICE' | 'EV' | 'All'
  cadence: string
  intervalKm: number
  intervalDays: number
  active: boolean
}

export interface InspectionFormTemplate {
  id: string
  organizationId?: string
  title: string
  itemsCount: number
  lastUpdated: string
  active: boolean
  checklistItems?: string[]
}

export interface InspectionScheduleItem {
  id: string
  organizationId?: string
  name: string
  frequency: string
  scope: string
  formId?: string
  formTitle: string
  active: boolean
}

export interface FleetRecallItem {
  id: string
  organizationId?: string
  campaign: string
  oem: string
  targetMake: string
  severity: RiskSeverity
  status: 'Monitoring' | 'Scheduled' | 'In Progress' | 'Completed'
  notes?: string
  issuedDate: string
}

export interface WorkspaceSettings {
  aiConfidenceThreshold: number
  telemetryIntervalSec: number
  lowHealthAlertCutoff: number
  speedCeilingKmh: number
  emailDigestEnabled: boolean
  criticalPushEnabled: boolean
  maintenanceReminderDays: number
  digilockerEnabled: boolean
}

export interface FleetioSettingsState {
  appearanceTheme: 'fleetio_forest' | 'lavender_enterprise'
  compactDensity: boolean
  defaultDistanceUnit: 'km' | 'mi'
  defaultFuelUnit: 'liters' | 'gallons'
  currencyCode: 'INR'
  fiscalYearStart: 'April' | 'January'
  autoCreateWoFromCriticalIssue: boolean
  requireInspectionSignature: boolean
  enforceGeofenceAlerts: boolean
  faultSeverityThreshold: 'all' | 'high_only' | 'critical_only'
  serviceReminderLeadDays: number
  serviceReminderLeadKm: number
  vehicleStatuses: LookupTagItem[]
  vehicleTypes: LookupTagItem[]
  issuePriorities: LookupTagItem[]
  workOrderStatuses: LookupTagItem[]
  repairReasonCodes: LookupTagItem[]
  partLocations: LookupTagItem[]
  partCategories: LookupTagItem[]
  fuelTypes: LookupTagItem[]
  labels: LookupTagItem[]
}

export interface FleetModulesDataset {
  tools: FleetToolItem[]
  warranties: FleetWarrantyItem[]
  customRecords: CustomRecordEntry[]
  serviceTasks: ServiceTaskCatalogItem[]
  servicePrograms: ServiceProgramItem[]
  inspectionForms: InspectionFormTemplate[]
  inspectionSchedules: InspectionScheduleItem[]
  recalls: FleetRecallItem[]
  apiKeys: ApiKeyEntry[]
  webhooks: WebhookEndpoint[]
  customDashboards: CustomDashboardLayout[]
  fleetioSettings: FleetioSettingsState
  workspaceSettings: WorkspaceSettings
  visitedIntegrations: boolean
  visitedReports: boolean
}

export type PermissionModuleKey =
  | 'dashboard'
  | 'live_monitoring'
  | 'vehicles'
  | 'drivers'
  | 'staff'
  | 'trips'
  | 'assignments'
  | 'meter_history'
  | 'tyre_readings'
  | 'expense_history'
  | 'replacement_analysis'
  | 'tools_equipment'
  | 'inspections'
  | 'issues'
  | 'reminders'
  | 'maintenance'
  | 'work_orders'
  | 'contacts'
  | 'vendors'
  | 'parts_inventory'
  | 'fuel_history'
  | 'charging_history'
  | 'places'
  | 'documents'
  | 'warranties'
  | 'custom_records'
  | 'vehicle_contracts'
  | 'finance'
  | 'reports'
  | 'settings'
  | 'integrations'

export type PermissionAction =
  | 'view'
  | 'add'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'manage'

export type SensitivePermissionKey =
  | 'viewBankDetails'
  | 'modifyContractRates'
  | 'releaseDeposits'
  | 'approveContractAmendments'
  | 'viewFinancialLedgers'

export type ModulePermissionEntry = Record<PermissionAction, boolean>

export interface StaffPermissionMatrix {
  modules: Record<PermissionModuleKey, ModulePermissionEntry>
  sensitive: Record<SensitivePermissionKey, boolean>
}

export type StaffAccountStatus =
  | 'draft'
  | 'invitation_pending'
  | 'active'
  | 'suspended'
  | 'deactivated'

export interface StaffProfile {
  id: string
  organizationId: string
  userId: string | null
  fullName: string
  mobile: string
  email: string
  jobTitle: string
  department: string
  branchLocation: string
  employeeCode: string
  employmentStatus: 'active' | 'on_leave' | 'terminated'
  accountStatus: StaffAccountStatus
  username?: string
  invitationToken?: string
  invitationSentAt?: string
  invitedBy?: string
  permissions: StaffPermissionMatrix
  createdAt: string
  updatedAt: string
}

export interface StaffActivityLog {
  id: string
  organizationId: string
  staffId: string
  staffName: string
  action: string
  module: string
  recordId: string | null
  previousValueJson: string | null
  newValueJson: string | null
  timestamp: string
  deviceInfo: string
}

export type CanonicalSubscriptionStatus =
  | 'pending_payment'
  | 'pending_verification'
  | 'active'
  | 'renewal_due'
  | 'past_due'
  | 'grace_period'
  | 'expired'
  | 'suspended'
  | 'cancelled'

export type SubscriptionPaymentStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'successful'
  | 'failed'
  | 'cancelled'
  | 'refunded'
  | 'partially_refunded'

export interface SubscriptionRecord {
  id: string
  organizationId: string
  planId: 'monthly' | 'annual'
  billingFrequency: BillingFrequency
  status: CanonicalSubscriptionStatus
  baseAmountInr: number
  taxRatePct: number
  taxAmountInr: number
  totalPayableInr: number
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  gracePeriodDays: number
  expiredAccessPolicy: 'read_only' | 'blocked'
  cancelAtPeriodEnd: boolean
  cancellationReason: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPaymentRecord {
  id: string
  subscriptionId: string
  organizationId: string
  planId: 'monthly' | 'annual'
  billingFrequency: BillingFrequency
  baseAmountInr: number
  taxAmountInr: number
  totalAmountInr: number
  status: SubscriptionPaymentStatus
  paymentMethod: string
  gatewayReference: string | null
  idempotencyKey: string | null
  failureReason: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DriverExpenseCategory =
  | 'Fuel'
  | 'Toll'
  | 'Parking'
  | 'Repairs'
  | 'Loading and Unloading'
  | 'Other Approved Expenses'

export type DriverExpenseStatus =
  | 'Draft'
  | 'Submitted'
  | 'Pending Review'
  | 'Approved'
  | 'Rejected'
  | 'Requires Additional Information'

export interface DriverExpenseSubmission {
  id: string
  organizationId: string
  driverId: string
  vehicleId: string | null
  tripId: string | null
  category: DriverExpenseCategory
  amountInr: number
  odometerKm: number | null
  receiptFileName: string | null
  notes: string
  status: DriverExpenseStatus
  paymentState: 'unpaid' | 'reimbursed' | 'company_paid'
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export interface AppNotification {
  id: string
  organizationId: string | null
  targetRole: string | null
  targetUserId: string | null
  category: string
  title: string
  message: string
  actionRoute: string
  entityType: string | null
  entityId: string | null
  read: boolean
  createdAt: string
}


