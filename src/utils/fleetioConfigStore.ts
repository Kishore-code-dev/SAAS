import type {
  ApiKeyEntry,
  CustomDashboardLayout,
  CustomRecordEntry,
  FleetModulesDataset,
  FleetRecallItem,
  FleetToolItem,
  FleetWarrantyItem,
  FleetioSettingsState,
  InspectionFormTemplate,
  InspectionScheduleItem,
  LookupTagItem,
  Organization,
  PartInventoryItem,
  ServiceProgramItem,
  ServiceTaskCatalogItem,
  Vehicle,
  WebhookEndpoint,
  WorkOrder,
  WorkspaceSettings,
} from '../types/fleet'

export type {
  ApiKeyEntry,
  CustomDashboardLayout,
  CustomRecordEntry,
  FleetModulesDataset,
  FleetRecallItem,
  FleetToolItem,
  FleetWarrantyItem,
  FleetioSettingsState,
  InspectionFormTemplate,
  InspectionScheduleItem,
  LookupTagItem,
  ServiceProgramItem,
  ServiceTaskCatalogItem,
  WebhookEndpoint,
  WorkspaceSettings,
}

export interface OnboardingChecklistItem {
  id: string
  title: string
  description: string
  route: string
  completed: boolean
}

const STORAGE_PREFIX = 'dm.fleetio.v1'

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  aiConfidenceThreshold: 75,
  telemetryIntervalSec: 15,
  lowHealthAlertCutoff: 60,
  speedCeilingKmh: 80,
  emailDigestEnabled: true,
  criticalPushEnabled: true,
  maintenanceReminderDays: 7,
  digilockerEnabled: false,
}

export const DEFAULT_FLEETIO_SETTINGS: FleetioSettingsState = {
  appearanceTheme: 'fleetio_forest',
  compactDensity: false,
  defaultDistanceUnit: 'km',
  defaultFuelUnit: 'liters',
  currencyCode: 'INR',
  fiscalYearStart: 'April',
  autoCreateWoFromCriticalIssue: true,
  requireInspectionSignature: true,
  enforceGeofenceAlerts: true,
  faultSeverityThreshold: 'high_only',
  serviceReminderLeadDays: 14,
  serviceReminderLeadKm: 1000,
  vehicleStatuses: [
    { id: 'vs-1', name: 'Active', color: '#1F7A4C', description: 'In daily commercial operation', active: true },
    { id: 'vs-2', name: 'In Shop', color: '#D8B442', description: 'Undergoing scheduled or corrective service', active: true },
    { id: 'vs-3', name: 'Out of Service', color: '#B84E42', description: 'Grounded due to safety or compliance hold', active: true },
    { id: 'vs-4', name: 'Inactive / Archived', color: '#958777', description: 'Decommissioned or seasonal standby', active: true },
  ],
  vehicleTypes: [
    { id: 'vt-1', name: 'Light Commercial', description: 'Under 3.5T GVW intra-city distribution', active: true },
    { id: 'vt-2', name: 'Medium Truck', description: '7.5T – 16T regional freight', active: true },
    { id: 'vt-3', name: 'Heavy Truck', description: '25T – 49T multi-axle highway haulage', active: true },
    { id: 'vt-4', name: 'Delivery Van', description: 'Last-mile parcel & e-commerce cargo', active: true },
    { id: 'vt-5', name: 'Electric Cargo', description: 'Zero-emission urban EV fleet', active: true },
  ],
  issuePriorities: [
    { id: 'ip-1', name: 'Critical', color: '#B84E42', description: 'Immediate safety immobilization & WO escalation', active: true },
    { id: 'ip-2', name: 'High', color: '#D9786C', description: 'Resolve within 24–48 operational hours', active: true },
    { id: 'ip-3', name: 'Medium', color: '#D8B442', description: 'Schedule for next preventive bay slot', active: true },
    { id: 'ip-4', name: 'Low', color: '#6E5696', description: 'Minor cosmetic or non-blocking item', active: true },
  ],
  workOrderStatuses: [
    { id: 'wos-1', name: 'Draft', color: '#958777', active: true },
    { id: 'wos-2', name: 'Open', color: '#6E5696', active: true },
    { id: 'wos-3', name: 'Approved', color: '#1F7A4C', active: true },
    { id: 'wos-4', name: 'In Progress', color: '#D8B442', active: true },
    { id: 'wos-5', name: 'Waiting Parts', color: '#D9786C', active: true },
    { id: 'wos-6', name: 'Completed', color: '#4D6E4A', active: true },
  ],
  repairReasonCodes: [
    { id: 'rrc-1', name: 'PM-01 · Scheduled Preventive Maintenance', active: true },
    { id: 'rrc-2', name: 'BRK-02 · Wear & Tear / Friction', active: true },
    { id: 'rrc-3', name: 'RD-03 · Highway Pothole / Road Stress Impact', active: true },
    { id: 'rrc-4', name: 'WAR-04 · OEM Warranty Claim', active: true },
  ],
  partLocations: [
    { id: 'pl-1', name: 'Chennai Ambattur Central Bay', description: 'Primary depot warehouse', active: true },
    { id: 'pl-2', name: 'Coimbatore Peelamedu Hub', description: 'Regional spares locker', active: true },
    { id: 'pl-3', name: 'Bengaluru Peenya Depot', description: 'EV & drivetrain parts', active: true },
  ],
  partCategories: [
    { id: 'pc-1', name: 'Engine Health', active: true },
    { id: 'pc-2', name: 'Tyre Health', active: true },
    { id: 'pc-3', name: 'Vehicle Health', active: true },
    { id: 'pc-4', name: 'Consumables', active: true },
    { id: 'pc-5', name: 'Safety', active: true },
  ],
  fuelTypes: [
    { id: 'ft-1', name: 'Diesel (BS-VI)', active: true },
    { id: 'ft-2', name: 'Electric (DC Fast / AC)', active: true },
    { id: 'ft-3', name: 'CNG', active: true },
    { id: 'ft-4', name: 'Petrol', active: true },
  ],
  labels: [
    { id: 'lbl-1', name: 'Cold Chain', color: '#6E5696', active: true },
    { id: 'lbl-2', name: 'NH-44 Express', color: '#1F7A4C', active: true },
    { id: 'lbl-3', name: 'EV Pilot', color: '#4D6E4A', active: true },
    { id: 'lbl-4', name: 'High Utilization', color: '#D8B442', active: true },
  ],
}

export function buildDefaultTools(orgCity: string): FleetToolItem[] {
  return [
    {
      id: 'tool-1',
      name: 'Digital Tyre Tread & Pressure Gauge',
      serialNumber: 'DM-TL-4012',
      category: 'Tyre & Axle Diagnostics',
      assignedTo: 'Workshop Bay 1',
      location: `${orgCity} Main Depot`,
      status: 'in_service',
      purchaseCostInr: 14500,
      nextCalibrationDate: '2027-03-15',
    },
    {
      id: 'tool-2',
      name: 'OBD-II Heavy Commercial Diagnostic Scanner',
      serialNumber: 'DM-OBD-8821',
      category: 'Powertrain Diagnostics',
      assignedTo: 'Senthil Murugan',
      location: `${orgCity} Main Depot`,
      status: 'checked_out',
      purchaseCostInr: 48000,
      nextCalibrationDate: '2027-01-30',
    },
    {
      id: 'tool-3',
      name: 'Hydraulic 20T Axle Bottle Jack Set',
      serialNumber: 'DM-HYD-1190',
      category: 'Workshop Lifting',
      assignedTo: 'Mobile Breakdown Van',
      location: 'NH-44 Corridor Unit',
      status: 'in_service',
      purchaseCostInr: 22400,
      nextCalibrationDate: '2027-05-10',
    },
    {
      id: 'tool-4',
      name: 'EV High-Voltage Insulation Multimeter',
      serialNumber: 'DM-EV-305',
      category: 'EV Safety & Diagnostics',
      assignedTo: 'EV Charging Bay',
      location: `${orgCity} EV Dock`,
      status: 'maintenance',
      purchaseCostInr: 31900,
      nextCalibrationDate: '2026-12-10',
    },
  ]
}

export function buildDefaultWarranties(vehicles: Vehicle[]): FleetWarrantyItem[] {
  return vehicles.slice(0, 5).map((v, idx) => ({
    id: `war-${v.id}`,
    assetName: `${v.make} ${v.model}`,
    registrationNumber: v.registrationNumber,
    provider: v.powertrain === 'EV' ? `${v.make} EV Care Plus` : `${v.make} Commercial Shield`,
    coverageType: v.powertrain === 'EV' ? 'Battery / EV Pack' : idx % 2 === 0 ? 'Powertrain' : 'Chassis & Axle',
    startDate: `${v.year}-04-01`,
    expiryDate: `${v.year + 4}-03-31`,
    maxOdometerKm: v.powertrain === 'EV' ? 250000 : 400000,
    claimStatus: v.odometerKm > 240000 ? 'expiring_soon' : 'active',
  }))
}

export function buildDefaultCustomRecords(vehicles: Vehicle[]): CustomRecordEntry[] {
  return [
    {
      id: 'cr-1',
      recordType: 'Toll & FASTag Audit',
      vehicleOrDriver: vehicles[0]?.registrationNumber ?? 'TN 38 AB 1234',
      referenceCode: 'FTG-2026-8841',
      recordedDate: '2026-11-12',
      amountInr: 6840,
      status: 'verified',
      notes: 'Chennai–Coimbatore NH-544 toll reconciliation matched trip GPS log.',
    },
    {
      id: 'cr-2',
      recordType: 'RTO Permit Log',
      vehicleOrDriver: vehicles[1]?.registrationNumber ?? 'TN 09 CD 7788',
      referenceCode: 'NP-TN-44902',
      recordedDate: '2026-11-08',
      amountInr: 12500,
      status: 'verified',
      notes: 'Annual National Permit renewal & state border tax receipt archived.',
    },
    {
      id: 'cr-3',
      recordType: 'Cold-Chain Temp Audit',
      vehicleOrDriver: vehicles[2]?.registrationNumber ?? 'KA 01 EF 5521',
      referenceCode: 'CC-TMP-109',
      recordedDate: '2026-11-15',
      amountInr: 0,
      status: 'pending',
      notes: 'Reefer cabin maintained 3.8°C average across 410 km corridor.',
    },
  ]
}

export function computeOnboardingChecklist(params: {
  org: Organization
  vehicles: Vehicle[]
  workOrders: WorkOrder[]
  partsInventory: PartInventoryItem[]
  hasExploredIntegrations: boolean
  hasVisitedReports: boolean
}): OnboardingChecklistItem[] {
  const { org, vehicles, workOrders, partsInventory, hasExploredIntegrations, hasVisitedReports } = params
  return [
    {
      id: 'ob-1',
      title: 'Configure organization profile & timezone',
      description: 'Verify company legal details, hub city, and Asia/Kolkata reporting timezone.',
      route: '/dashboard/settings/general',
      completed: Boolean(org.name && org.city && org.timezone),
    },
    {
      id: 'ob-2',
      title: 'Register your fleet vehicles',
      description: 'Add commercial vehicles with odometer baseline and compliance expiry dates.',
      route: '/dashboard/fleet',
      completed: vehicles.length > 0,
    },
    {
      id: 'ob-3',
      title: 'Assign drivers to active vehicles',
      description: 'Link verified Indian commercial drivers to vehicles for telemetry & safety scoring.',
      route: '/dashboard/fleet/assignments',
      completed: vehicles.some((v) => Boolean(v.assignedDriverId)),
    },
    {
      id: 'ob-4',
      title: 'Review live fleet map & corridor telemetry',
      description: 'Inspect GPS markers, route corridors, and geofence status on the live map.',
      route: '/dashboard/map',
      completed: vehicles.some((v) => v.telemetry.connectionState === 'connected'),
    },
    {
      id: 'ob-5',
      title: 'Manage preventive work orders',
      description: 'Track workshop tasks, labor, and parts consumption in active work orders.',
      route: '/dashboard/work-orders',
      completed: workOrders.length > 0,
    },
    {
      id: 'ob-6',
      title: 'Stock parts & warehouse inventory',
      description: 'Maintain spare part SKUs and reorder thresholds across depot bays.',
      route: '/dashboard/inventory',
      completed: partsInventory.length > 0,
    },
    {
      id: 'ob-7',
      title: 'Connect telematics & compliance integrations',
      description: 'Configure GPS, Google Truck Routing, Open-Meteo weather, or DigiLocker KYC.',
      route: '/dashboard/integrations',
      completed: hasExploredIntegrations,
    },
    {
      id: 'ob-8',
      title: 'Generate executive fleet & ROI report',
      description: 'Export CSV/PDF fleet health, fuel efficiency, or maintenance ROI reports.',
      route: '/dashboard/reports',
      completed: hasVisitedReports,
    },
  ]
}

export function buildDefaultServiceTasks(): ServiceTaskCatalogItem[] {
  return [
    { id: 'st-1', code: 'VMRS-013-001', title: 'Front & Rear Brake Pad / Lining Replacement', area: 'Vehicle Health', avgHours: 3.5, estCostInr: 6800, active: true },
    { id: 'st-2', code: 'VMRS-045-002', title: 'Engine Oil & Dual Filter Preventive Change', area: 'Engine Health', avgHours: 1.5, estCostInr: 4200, active: true },
    { id: 'st-3', code: 'VMRS-017-004', title: 'Multi-Axle Wheel Alignment & Rotation', area: 'Tyre Health', avgHours: 2.0, estCostInr: 3100, active: true },
    { id: 'st-4', code: 'VMRS-034-009', title: 'Coolant Flush & Radiator Pressure Test', area: 'Engine Health', avgHours: 2.0, estCostInr: 2900, active: true },
    { id: 'st-5', code: 'VMRS-032-001', title: 'EV Traction Battery SOH & Thermal Loop Check', area: 'Engine Health', avgHours: 2.5, estCostInr: 3500, active: true },
  ]
}

export function buildDefaultServicePrograms(): ServiceProgramItem[] {
  return [
    {
      id: 'sp-ice',
      name: 'BS-VI Heavy & Medium Diesel Preventive Program',
      powertrain: 'ICE',
      cadence: 'Every 10,000 km or 90 days',
      intervalKm: 10000,
      intervalDays: 90,
      active: true,
    },
    {
      id: 'sp-ev',
      name: 'Electric Cargo Fleet High-Voltage & Thermal Program',
      powertrain: 'EV',
      cadence: 'Every 15,000 km or 120 days',
      intervalKm: 15000,
      intervalDays: 120,
      active: true,
    },
  ]
}

export function buildDefaultInspectionForms(): InspectionFormTemplate[] {
  return [
    { id: 'if-1', title: 'Commercial DVIR Pre-Trip Standard', itemsCount: 14, lastUpdated: '2026-10-18', active: true },
    { id: 'if-2', title: 'Multi-Axle Tyre & Brake Safety Audit', itemsCount: 18, lastUpdated: '2026-10-25', active: true },
    { id: 'if-3', title: 'EV High-Voltage & Charging Safety', itemsCount: 11, lastUpdated: '2026-11-02', active: true },
  ]
}

export function buildDefaultInspectionSchedules(vehicleCount: number): InspectionScheduleItem[] {
  return [
    { id: 'is-1', name: 'Daily Pre-Trip Roadworthiness Check', frequency: 'Every 24 Hours', scope: `All ${Math.max(1, vehicleCount)} Active Vehicles`, formId: 'if-1', formTitle: 'Commercial DVIR Pre-Trip Standard', active: true },
    { id: 'is-2', name: 'Weekly Multi-Axle Tyre & Brake Audit', frequency: 'Every 7 Days', scope: 'Medium & Heavy Trucks', formId: 'if-2', formTitle: 'Multi-Axle Tyre & Brake Safety Audit', active: true },
    { id: 'is-3', name: 'EV Battery Thermal & Port Seal Check', frequency: 'Every 14 Days', scope: 'EV Fleet Assets', formId: 'if-3', formTitle: 'EV High-Voltage & Charging Safety', active: true },
  ]
}

export function buildDefaultRecalls(): FleetRecallItem[] {
  return [
    {
      id: 'rec-1',
      campaign: 'BS-VI EGR Cooler Inspection Campaign 2026-A',
      oem: 'Tata Motors Commercial',
      targetMake: 'tata',
      severity: 'high',
      status: 'Monitoring',
      notes: 'Inspect EGR cooler thermal joint and coolant pressure during scheduled PM bay visit.',
      issuedDate: '2026-09-20',
    },
    {
      id: 'rec-2',
      campaign: 'ABS Wheel Speed Sensor Harness Clip Update',
      oem: 'Ashok Leyland',
      targetMake: 'ashok',
      severity: 'moderate',
      status: 'Scheduled',
      notes: 'Retrofit retaining clip on rear axle ABS sensor lead during brake lining check.',
      issuedDate: '2026-10-12',
    },
  ]
}

export function buildDefaultApiKeys(orgCode: string): ApiKeyEntry[] {
  return [
    {
      id: `key-${orgCode.toLowerCase()}-1`,
      label: 'OBD Telematics Ingestion Key',
      prefix: 'dm_live_89a4••••c1f2',
      scope: 'telematics_ingest',
      createdAt: '2026-08-12T10:00:00.000Z',
      lastUsedAt: '2026-11-18T11:20:00.000Z',
    },
  ]
}

export function buildDefaultWebhooks(orgCode: string): WebhookEndpoint[] {
  return [
    {
      id: `wh-${orgCode.toLowerCase()}-1`,
      url: `https://erp.${orgCode.toLowerCase().replace(/[^a-z0-9]/g, '')}.in/hooks/drivemitra-wo`,
      events: ['work_order.completed', 'issue.critical'],
      active: true,
      lastDeliveryStatus: 200,
    },
  ]
}

export function buildDefaultCustomDashboards(): CustomDashboardLayout[] {
  return [
    { id: 'cd-1', name: 'Executive Fleet Health & TCO', widgets: '5-Area Health, Open WOs, Compliance Expiry, Cost/km', defaultView: true },
    { id: 'cd-2', name: 'Workshop & Maintenance Queue', widgets: 'Overdue PM, Open Issues, Low Stock Parts', defaultView: false },
  ]
}

export function buildDefaultModulesDataset(org: Organization, vehicles: Vehicle[]): FleetModulesDataset {
  return {
    tools: buildDefaultTools(org.city),
    warranties: buildDefaultWarranties(vehicles),
    customRecords: buildDefaultCustomRecords(vehicles),
    serviceTasks: buildDefaultServiceTasks(),
    servicePrograms: buildDefaultServicePrograms(),
    inspectionForms: buildDefaultInspectionForms(),
    inspectionSchedules: buildDefaultInspectionSchedules(vehicles.length),
    recalls: buildDefaultRecalls(),
    apiKeys: buildDefaultApiKeys(org.code),
    webhooks: buildDefaultWebhooks(org.code),
    customDashboards: buildDefaultCustomDashboards(),
    fleetioSettings: DEFAULT_FLEETIO_SETTINGS,
    workspaceSettings: DEFAULT_WORKSPACE_SETTINGS,
    visitedIntegrations: true,
    visitedReports: false,
  }
}

export function loadScopedStorage<T>(orgId: string, key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}.${orgId}.${key}`)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveScopedStorage<T>(orgId: string, key: string, value: T): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}.${orgId}.${key}`, JSON.stringify(value))
  } catch {
    // storage unavailable
  }
}
