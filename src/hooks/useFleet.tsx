import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type {
  AIPrediction,
  AuditLogEntry,
  ComponentCategory,
  DemoRequestSubmission,
  Driver,
  DriverBehaviorEvent,
  FuelTransaction,
  MaintenanceRecord,
  OperatingEnvironment,
  OperationalAlert,
  Organization,
  OrganizationMember,
  OrganizationRole,
  RegionalCorridor,
  ReportHistoryItem,
  ReportingPeriod,
  RiskAssessmentItem,
  SubscriptionPlanId,
  Trip,
  Vehicle,
  VehicleInspection,
} from '../types/fleet'
import {
  buildSeedDataset,
  EnvironmentDataset,
  REGIONAL_CORRIDORS,
  SUBSCRIPTION_PLANS,
} from '../data/seedOrganizations'
import {
  analyzeFuelTransactions,
  buildFleetRiskAssessments,
  computeFinancialIntelligence,
  generateFleetPredictions,
  isStaleOutOfOrderTimestamp,
  isValidCoordinate,
  normalizeRegistrationNumber,
  validateFuelTransactionInput,
  validateVehiclePayload,
} from '../utils/intelligenceEngine'
import { assertRolePermission } from '../utils/rbac'

const STORAGE_PREFIX = 'dm_env_v2_'
const ACTIVE_ENV_KEY = 'dm_active_env_v2'
const ACTIVE_ORG_KEY = 'dm_active_org_v2'
const ACTIVE_ROLE_KEY = 'dm_active_role_v2'
const SETTINGS_KEY = 'dm_workspace_settings_v2'
const DEMO_REQUESTS_KEY = 'dm_demo_requests_v2'

export interface WorkspaceSettings {
  aiConfidenceThreshold: number
  telemetryIntervalSec: number
  lowHealthAlertCutoff: number
  speedCeilingKmh: number
  privacyShareDriverLocation: boolean
  emailDigestEnabled: boolean
  criticalPushEnabled: boolean
  maintenanceReminderDays: number
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  aiConfidenceThreshold: 75,
  telemetryIntervalSec: 15,
  lowHealthAlertCutoff: 60,
  speedCeilingKmh: 80,
  privacyShareDriverLocation: true,
  emailDigestEnabled: true,
  criticalPushEnabled: true,
  maintenanceReminderDays: 7,
}

function loadDataset(env: OperatingEnvironment): EnvironmentDataset {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${env}`)
    if (raw) {
      return JSON.parse(raw) as EnvironmentDataset
    }
  } catch {
    // Fall back to fresh seed dataset
  }
  return buildSeedDataset(env)
}

function saveDataset(env: OperatingEnvironment, dataset: EnvironmentDataset) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${env}`, JSON.stringify(dataset))
  } catch {
    // Ignore storage quota errors
  }
}

export interface AddVehiclePayload {
  registrationNumber: string
  make: string
  model: string
  category: Vehicle['category']
  powertrain: Vehicle['powertrain']
  fuelType: Vehicle['fuelType']
  year: number
  odometerKm: number
  dailyAvgKm: number
  corridorId: string
  assignedDriverId: string | null
  insuranceProvider: string
  insuranceExpiry: string
  registrationExpiry: string
}

export interface FleetContextValue {
  environment: OperatingEnvironment
  setEnvironment: (env: OperatingEnvironment) => void
  resetCurrentEnvironment: () => void
  organizations: Organization[]
  activeOrganization: Organization
  setActiveOrganizationId: (orgId: string) => void
  createOrganization: (name: string, city: string, state: string) => void
  activeRole: OrganizationRole
  setActiveRole: (role: OrganizationRole) => void
  reportingPeriod: ReportingPeriod
  setReportingPeriod: (period: ReportingPeriod) => void
  searchTerm: string
  setSearchTerm: (term: string) => void
  simulationActive: boolean
  toggleSimulation: () => void
  corridors: RegionalCorridor[]
  members: OrganizationMember[]
  inviteMember: (fullName: string, email: string, role: OrganizationRole) => void
  updateMemberRole: (memberId: string, role: OrganizationRole) => void
  vehicles: Vehicle[]
  archivedVehicles: Vehicle[]
  allOrgVehiclesCount: number
  drivers: Driver[]
  driverEvents: DriverBehaviorEvent[]
  trips: Trip[]
  fuelTransactions: FuelTransaction[]
  maintenanceRecords: MaintenanceRecord[]
  inspections: VehicleInspection[]
  alerts: OperationalAlert[]
  predictions: AIPrediction[]
  riskAssessments: RiskAssessmentItem[]
  financialSummary: ReturnType<typeof computeFinancialIntelligence>
  auditLogs: AuditLogEntry[]
  reports: ReportHistoryItem[]
  settings: WorkspaceSettings
  updateSettings: (patch: Partial<WorkspaceSettings>) => void
  updateOrganizationProfile: (patch: Partial<Pick<Organization, 'name' | 'city' | 'state' | 'timezone'>>) => void
  unreadAlertCount: number
  currentDriverId: string
  setCurrentDriverId: (driverId: string) => void
  currentDriverTrip: Trip | undefined
  offlineQueuedTripsCount: number
  addVehicle: (payload: AddVehiclePayload) => Vehicle
  updateVehicle: (vehicleId: string, patch: Partial<Vehicle>) => void
  decommissionVehicle: (vehicleId: string) => void
  restoreVehicle: (vehicleId: string) => void
  assignDriverToVehicle: (vehicleId: string, driverId: string | null) => void
  addDriver: (payload: { name: string; mobile: string; email: string; licenseNumber: string; licenseExpiry: string }) => Driver
  approveOnboardingDriver: (driverId: string, approve: boolean) => void
  disputeDriverEvent: (eventId: string, reason: string) => void
  resolveDriverEventDispute: (eventId: string, decision: 'accepted_dismissed' | 'rejected_upheld', note: string) => void
  startTrip: (driverId: string, vehicleId: string, origin?: string, destination?: string, offlineMode?: boolean) => Trip | null
  endTrip: (tripId: string) => void
  scheduleTrip: (payload: { vehicleId: string; driverId: string; originAddress: string; destinationAddress: string }) => Trip | null
  syncOfflineTrips: () => number
  addFuelTransaction: (payload: Omit<FuelTransaction, 'id' | 'organizationId' | 'environment' | 'anomalyFlags' | 'verificationStatus'>) => FuelTransaction
  verifyFuelTransaction: (txId: string, status: 'verified' | 'needs_review') => void
  scheduleMaintenance: (payload: {
    vehicleId: string
    serviceType: string
    componentName: ComponentCategory | 'General Service'
    serviceCenter: string
    description: string
    costInr: number
    performedAt: string
    linkedPredictionId?: string
  }) => MaintenanceRecord
  completeMaintenance: (recordId: string) => void
  resolvePrediction: (predictionId: string) => void
  recalculatePredictions: () => void
  submitVehicleInspection: (payload: Omit<VehicleInspection, 'id' | 'organizationId' | 'environment' | 'timestamp' | 'passed'>) => VehicleInspection
  reportDriverIssue: (vehicleId: string, driverId: string, title: string, message: string, severity: 'medium' | 'high' | 'critical') => void
  markAlertRead: (alertId: string) => void
  markAllAlertsRead: () => void
  acknowledgeAlert: (alertId: string) => void
  updateSubscriptionPlan: (planId: SubscriptionPlanId) => void
  recordReportGeneration: (entry: Omit<ReportHistoryItem, 'id' | 'organizationId' | 'environment' | 'generatedAt'>) => void
  demoRequests: DemoRequestSubmission[]
  submitDemoRequest: (payload: Omit<DemoRequestSubmission, 'id' | 'submittedAt'>) => DemoRequestSubmission
  updateTelemetryState: (vehicleId: string, patch: Partial<Vehicle['telemetry']>) => void
}

const FleetContext = createContext<FleetContextValue | undefined>(undefined)

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [environment, setEnvironmentState] = useState<OperatingEnvironment>(() => {
    const saved = localStorage.getItem(ACTIVE_ENV_KEY) as OperatingEnvironment | null
    return saved === 'demo' || saved === 'pilot' || saved === 'production' ? saved : 'demo'
  })

  const [dataset, setDataset] = useState<EnvironmentDataset>(() => loadDataset(environment))

  const [activeOrganizationId, setActiveOrgState] = useState<string>(() => {
    const saved = localStorage.getItem(ACTIVE_ORG_KEY)
    return saved || loadDataset(environment).organizations[0]?.id || 'org-kaveri'
  })

  const [activeRole, setActiveRoleState] = useState<OrganizationRole>(() => {
    const saved = localStorage.getItem(ACTIVE_ROLE_KEY) as OrganizationRole | null
    return saved || 'fleet_manager'
  })

  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriod>('30d')
  const [searchTerm, setSearchTerm] = useState('')
  const [simulationActive, setSimulationActive] = useState(true)
  const [predictionStatusOverrides, setPredictionStatusOverrides] = useState<Record<string, AIPrediction['status']>>({})
  const [predictionTick, setPredictionTick] = useState<number>(() => Date.now())
  const [currentDriverId, setCurrentDriverId] = useState<string>('d-k1')
  const [settings, setSettings] = useState<WorkspaceSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<WorkspaceSettings>) } : DEFAULT_SETTINGS
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  const [demoRequests, setDemoRequests] = useState<DemoRequestSubmission[]>(() => {
    try {
      const raw = localStorage.getItem(DEMO_REQUESTS_KEY)
      return raw ? (JSON.parse(raw) as DemoRequestSubmission[]) : []
    } catch {
      return []
    }
  })

  const commitDataset = useCallback(
    (updater: (prev: EnvironmentDataset) => EnvironmentDataset) => {
      setDataset((prev) => {
        const next = updater(prev)
        saveDataset(environment, next)
        return next
      })
    },
    [environment],
  )

  const setEnvironment = useCallback((nextEnv: OperatingEnvironment) => {
    setEnvironmentState(nextEnv)
    localStorage.setItem(ACTIVE_ENV_KEY, nextEnv)
    const loaded = loadDataset(nextEnv)
    setDataset(loaded)
    const firstOrgId = loaded.organizations[0]?.id ?? 'org-prod-default'
    setActiveOrgState(firstOrgId)
    localStorage.setItem(ACTIVE_ORG_KEY, firstOrgId)
    if (loaded.drivers[0]) {
      setCurrentDriverId(loaded.drivers[0].id)
    }
  }, [])

  const resetCurrentEnvironment = useCallback(() => {
    const fresh = buildSeedDataset(environment)
    saveDataset(environment, fresh)
    setDataset(fresh)
    const firstOrgId = fresh.organizations[0]?.id ?? 'org-prod-default'
    setActiveOrgState(firstOrgId)
    localStorage.setItem(ACTIVE_ORG_KEY, firstOrgId)
    setPredictionStatusOverrides({})
    setPredictionTick(Date.now())
  }, [environment])

  const activeOrganization = useMemo(() => {
    return (
      dataset.organizations.find((o) => o.id === activeOrganizationId) ??
      dataset.organizations[0] ?? {
        id: 'org-fallback',
        name: 'DriveMitra Fleet',
        code: 'DM-01',
        city: 'Chennai',
        state: 'Tamil Nadu',
        timezone: 'Asia/Kolkata',
        currency: 'INR' as const,
        planId: 'starter' as const,
        vehicleLimit: 15,
        driverLimit: 25,
        createdAt: new Date().toISOString(),
        environment,
      }
    )
  }, [dataset.organizations, activeOrganizationId, environment])

  const setActiveOrganizationId = useCallback(
    (orgId: string) => {
      setActiveOrgState(orgId)
      localStorage.setItem(ACTIVE_ORG_KEY, orgId)
      const orgDriver = dataset.drivers.find((d) => d.organizationId === orgId)
      if (orgDriver) {
        setCurrentDriverId(orgDriver.id)
      }
    },
    [dataset.drivers],
  )

  const setActiveRole = useCallback((role: OrganizationRole) => {
    setActiveRoleState(role)
    localStorage.setItem(ACTIVE_ROLE_KEY, role)
  }, [])

  useEffect(() => {
    if (!simulationActive || environment === 'production') return
    const timer = setInterval(() => {
      setDataset((prev) => {
        const nextVehicles = prev.vehicles.map((v) => {
          if (v.decommissioned || v.operationStatus !== 'moving' || v.telemetry.connectionState !== 'connected') {
            return v
          }
          const deltaSpeed = (Math.random() - 0.5) * 4
          const speedKmh = Math.max(22, Math.min(78, Math.round(v.telemetry.speedKmh + deltaSpeed)))
          const heading = (v.telemetry.heading + Math.round((Math.random() - 0.5) * 8) + 360) % 360
          const rad = (heading * Math.PI) / 180
          const meters = (speedKmh / 3.6) * 3
          const dlat = (meters * Math.cos(rad)) / 111111
          const dlng = (meters * Math.sin(rad)) / (111111 * Math.cos((v.telemetry.location.lat * Math.PI) / 180))
          const nextLat = Number((v.telemetry.location.lat + dlat).toFixed(6))
          const nextLng = Number((v.telemetry.location.lng + dlng).toFixed(6))
          return {
            ...v,
            telemetry: {
              ...v.telemetry,
              location: isValidCoordinate(nextLat, nextLng)
                ? { lat: nextLat, lng: nextLng }
                : v.telemetry.location,
              speedKmh,
              heading,
              lastUpdatedAt: new Date().toISOString(),
            },
          }
        })
        return { ...prev, vehicles: nextVehicles }
      })
    }, 3000)

    return () => clearInterval(timer)
  }, [simulationActive, environment])

  const appendAudit = (
    logs: AuditLogEntry[],
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
  ): AuditLogEntry[] => [
    {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      organizationId: activeOrganization.id,
      environment,
      actorName: activeRole === 'driver' ? 'Driver Session' : 'Fleet Operations User',
      actorRole: activeRole,
      action,
      entityType,
      entityId,
      summary,
      timestamp: new Date().toISOString(),
    },
    ...logs,
  ]

  // Organization-isolated views
  const members = useMemo(
    () => dataset.members.filter((m) => m.organizationId === activeOrganization.id),
    [dataset.members, activeOrganization.id],
  )

  const orgAllVehicles = useMemo(
    () => dataset.vehicles.filter((v) => v.organizationId === activeOrganization.id),
    [dataset.vehicles, activeOrganization.id],
  )

  const vehicles = useMemo(
    () => orgAllVehicles.filter((v) => !v.decommissioned),
    [orgAllVehicles],
  )

  const archivedVehicles = useMemo(
    () => orgAllVehicles.filter((v) => Boolean(v.decommissioned)),
    [orgAllVehicles],
  )

  const drivers = useMemo(
    () => dataset.drivers.filter((d) => d.organizationId === activeOrganization.id),
    [dataset.drivers, activeOrganization.id],
  )

  const driverEvents = useMemo(
    () => dataset.driverEvents.filter((e) => e.organizationId === activeOrganization.id),
    [dataset.driverEvents, activeOrganization.id],
  )

  const trips = useMemo(
    () => dataset.trips.filter((t) => t.organizationId === activeOrganization.id),
    [dataset.trips, activeOrganization.id],
  )

  const rawOrgFuel = useMemo(
    () => dataset.fuelTransactions.filter((f) => f.organizationId === activeOrganization.id),
    [dataset.fuelTransactions, activeOrganization.id],
  )

  const fuelTransactions = useMemo(
    () => analyzeFuelTransactions(rawOrgFuel, vehicles),
    [rawOrgFuel, vehicles],
  )

  const maintenanceRecords = useMemo(
    () => dataset.maintenanceRecords.filter((m) => m.organizationId === activeOrganization.id),
    [dataset.maintenanceRecords, activeOrganization.id],
  )

  const inspections = useMemo(
    () => dataset.inspections.filter((i) => i.organizationId === activeOrganization.id),
    [dataset.inspections, activeOrganization.id],
  )

  const alerts = useMemo(
    () => dataset.alerts.filter((a) => a.organizationId === activeOrganization.id),
    [dataset.alerts, activeOrganization.id],
  )

  const auditLogs = useMemo(
    () => dataset.auditLogs.filter((a) => a.organizationId === activeOrganization.id),
    [dataset.auditLogs, activeOrganization.id],
  )

  const reports = useMemo(
    () => dataset.reports.filter((r) => r.organizationId === activeOrganization.id),
    [dataset.reports, activeOrganization.id],
  )

  const predictions = useMemo(() => {
    const generated = generateFleetPredictions({
      vehicles,
      corridors: REGIONAL_CORRIDORS,
      driverEvents,
      inspections,
      nowMs: predictionTick,
    })
    return generated.map((pred) => {
      const override = predictionStatusOverrides[pred.id]
      if (override) {
        return { ...pred, status: override }
      }
      const linkedMaint = maintenanceRecords.find((m) => m.linkedPredictionId === pred.id)
      if (linkedMaint) {
        const nextStatus: AIPrediction['status'] =
          linkedMaint.status === 'completed' ? 'resolved' : 'scheduled'
        return { ...pred, status: nextStatus }
      }
      return pred
    })
  }, [vehicles, driverEvents, inspections, predictionTick, predictionStatusOverrides, maintenanceRecords])

  const riskAssessments = useMemo(
    () =>
      buildFleetRiskAssessments({
        organizationId: activeOrganization.id,
        vehicles,
        predictions,
        drivers,
        driverEvents,
        fuelTransactions,
        trips,
        nowMs: predictionTick,
      }),
    [activeOrganization.id, vehicles, predictions, drivers, driverEvents, fuelTransactions, trips, predictionTick],
  )

  const financialSummary = useMemo(
    () =>
      computeFinancialIntelligence({
        vehicles,
        fuelTransactions,
        maintenanceRecords,
        predictions,
        trips,
        period: reportingPeriod,
      }),
    [vehicles, fuelTransactions, maintenanceRecords, predictions, trips, reportingPeriod],
  )

  const unreadAlertCount = useMemo(() => alerts.filter((a) => !a.read).length, [alerts])

  const currentDriverTrip = useMemo(
    () => trips.find((t) => t.driverId === currentDriverId && t.status === 'active'),
    [trips, currentDriverId],
  )

  const offlineQueuedTripsCount = useMemo(
    () => trips.filter((t) => t.offlineSynced === false).length,
    [trips],
  )

  const createOrganization = (name: string, city: string, state: string) => {
    assertRolePermission(activeRole, 'create_organization')
    if (!name.trim()) throw new Error('Organization name is required.')
    const id = `org-${Date.now()}`
    const code = `${name.trim().slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`
    const org: Organization = {
      id,
      name: name.trim(),
      code,
      city: city.trim(),
      state: state.trim(),
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      planId: 'starter',
      vehicleLimit: 15,
      driverLimit: 25,
      createdAt: new Date().toISOString(),
      environment,
    }
    commitDataset((prev) => ({
      ...prev,
      organizations: [...prev.organizations, org],
      auditLogs: appendAudit(prev.auditLogs, 'CREATED_ORGANIZATION', 'organization', id, `Created organization ${org.name}`),
    }))
    setActiveOrgState(id)
    localStorage.setItem(ACTIVE_ORG_KEY, id)
  }

  const inviteMember = (fullName: string, email: string, role: OrganizationRole) => {
    assertRolePermission(activeRole, 'manage_members')
    if (!fullName.trim() || !email.trim()) {
      throw new Error('Member name and email are required.')
    }
    const member: OrganizationMember = {
      id: `mem-${Date.now()}`,
      organizationId: activeOrganization.id,
      userId: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: 'active',
      lastActiveAt: new Date().toISOString(),
    }
    commitDataset((prev) => ({
      ...prev,
      members: [member, ...prev.members],
      auditLogs: appendAudit(prev.auditLogs, 'INVITED_MEMBER', 'member', member.id, `Added ${member.fullName} (${role})`),
    }))
  }

  const updateMemberRole = (memberId: string, role: OrganizationRole) => {
    assertRolePermission(activeRole, 'manage_members')
    commitDataset((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.id === memberId && m.organizationId === activeOrganization.id ? { ...m, role } : m,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'UPDATED_ROLE', 'member', memberId, `Changed member role to ${role}`),
    }))
  }

  const addVehicle = (payload: AddVehiclePayload): Vehicle => {
    assertRolePermission(activeRole, 'add_vehicle')
    const validationErr = validateVehiclePayload({
      registrationNumber: payload.registrationNumber,
      make: payload.make,
      model: payload.model,
      year: payload.year,
      odometerKm: payload.odometerKm,
      dailyAvgKm: payload.dailyAvgKm,
      existingVehicles: orgAllVehicles,
    })
    if (validationErr) {
      throw new Error(validationErr)
    }

    const corridor = REGIONAL_CORRIDORS.find((c) => c.id === payload.corridorId) ?? REGIONAL_CORRIDORS[0]
    const id = `v-${Date.now()}-${Math.floor(Math.random() * 100)}`
    const normalizedReg = normalizeRegistrationNumber(payload.registrationNumber)
    const baseComponents: Vehicle['components'] = [
      { id: `${id}-c1`, vehicleId: id, componentName: 'Engine', healthScore: 90, status: 'healthy', wearRatePer1000Km: payload.powertrain === 'EV' ? 0.14 : 0.38, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2027-02-01', notes: 'Baseline healthy' },
      { id: `${id}-c2`, vehicleId: id, componentName: 'Brakes', healthScore: 88, status: 'healthy', wearRatePer1000Km: 0.42, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2027-01-15', notes: 'Pad thickness baseline healthy' },
      { id: `${id}-c3`, vehicleId: id, componentName: 'Tyres', healthScore: 86, status: 'healthy', wearRatePer1000Km: 0.45, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2026-12-20', notes: 'Tread baseline healthy' },
      { id: `${id}-c4`, vehicleId: id, componentName: 'Battery', healthScore: 92, status: 'healthy', wearRatePer1000Km: 0.22, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2027-06-01', notes: '12V auxiliary system healthy' },
      { id: `${id}-c5`, vehicleId: id, componentName: 'Suspension', healthScore: 87, status: 'healthy', wearRatePer1000Km: 0.36, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2027-03-10', notes: 'Springs and dampers within range' },
      { id: `${id}-c6`, vehicleId: id, componentName: 'Transmission', healthScore: 90, status: 'healthy', wearRatePer1000Km: 0.3, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2027-05-01', notes: 'Gearbox / reduction drive smooth' },
      { id: `${id}-c7`, vehicleId: id, componentName: 'Cooling System', healthScore: 89, status: 'healthy', wearRatePer1000Km: 0.28, lastServicedAt: new Date().toISOString().slice(0, 10), predictedReplacementDate: '2027-04-01', notes: 'Coolant circulation stable' },
    ]
    if (payload.powertrain === 'EV') {
      baseComponents.push({
        id: `${id}-c8`,
        vehicleId: id,
        componentName: 'EV Battery',
        healthScore: 94,
        status: 'healthy',
        wearRatePer1000Km: 0.16,
        lastServicedAt: new Date().toISOString().slice(0, 10),
        predictedReplacementDate: '2029-01-01',
        notes: 'High-voltage pack baseline 94% SOH',
      })
    }

    const newVehicle: Vehicle = {
      id,
      organizationId: activeOrganization.id,
      environment,
      registrationNumber: normalizedReg,
      make: payload.make.trim(),
      model: payload.model.trim(),
      category: payload.category,
      powertrain: payload.powertrain,
      fuelType: payload.fuelType,
      year: payload.year,
      assignedDriverId: payload.assignedDriverId,
      odometerKm: Math.round(payload.odometerKm),
      dailyAvgKm: Math.round(payload.dailyAvgKm),
      healthScore: 89,
      operationStatus: 'stopped',
      fuelOrSocPct: 80,
      corridorId: corridor.id,
      cityName: corridor.name,
      registrationExpiry: payload.registrationExpiry,
      insuranceExpiry: payload.insuranceExpiry,
      insuranceProvider: payload.insuranceProvider,
      lastServiceDate: new Date().toISOString().slice(0, 10),
      nextServiceDueDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
      monthlyRevenueInr: 145000,
      telemetry: {
        vehicleId: id,
        location: { lat: 13.0827, lng: 80.2707 },
        cityLabel: `${corridor.name} Depot`,
        speedKmh: 0,
        heading: 0,
        gpsAccuracyMeters: 10,
        signalQualityPct: 90,
        connectionState: 'connected',
        source: 'smartphone_gps',
        lastUpdatedAt: new Date().toISOString(),
        batteryLevelPct: 88,
        motionPermissionGranted: true,
      },
      components: baseComponents,
      decommissioned: false,
    }

    commitDataset((prev) => ({
      ...prev,
      vehicles: [newVehicle, ...prev.vehicles],
      drivers: payload.assignedDriverId
        ? prev.drivers.map((d) => (d.id === payload.assignedDriverId ? { ...d, assignedVehicleId: id } : d))
        : prev.drivers,
      auditLogs: appendAudit(prev.auditLogs, 'ADDED_VEHICLE', 'vehicle', id, `Registered ${newVehicle.registrationNumber}`),
    }))
    return newVehicle
  }

  const updateVehicle = (vehicleId: string, patch: Partial<Vehicle>) => {
    assertRolePermission(activeRole, 'edit_vehicle')
    const current = orgAllVehicles.find((v) => v.id === vehicleId)
    if (!current) return
    const nextReg = patch.registrationNumber ?? current.registrationNumber
    const nextMake = patch.make ?? current.make
    const nextModel = patch.model ?? current.model
    const nextYear = patch.year ?? current.year
    const nextOdo = patch.odometerKm ?? current.odometerKm
    const nextDaily = patch.dailyAvgKm ?? current.dailyAvgKm
    const validationErr = validateVehiclePayload({
      registrationNumber: nextReg,
      make: nextMake,
      model: nextModel,
      year: nextYear,
      odometerKm: nextOdo,
      dailyAvgKm: nextDaily,
      existingVehicles: orgAllVehicles,
      excludeVehicleId: vehicleId,
    })
    if (validationErr) {
      throw new Error(validationErr)
    }

    const normalizedPatch = {
      ...patch,
      registrationNumber: normalizeRegistrationNumber(nextReg),
    }

    commitDataset((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) =>
        v.id === vehicleId && v.organizationId === activeOrganization.id ? { ...v, ...normalizedPatch } : v,
      ),
      auditLogs: appendAudit(
        prev.auditLogs,
        'UPDATED_VEHICLE',
        'vehicle',
        vehicleId,
        `Updated specifications for ${normalizeRegistrationNumber(nextReg)}`,
      ),
    }))
  }

  const decommissionVehicle = (vehicleId: string) => {
    assertRolePermission(activeRole, 'decommission_vehicle')
    const target = orgAllVehicles.find((v) => v.id === vehicleId)
    if (!target || target.decommissioned) return
    commitDataset((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) =>
        v.id === vehicleId && v.organizationId === activeOrganization.id
          ? { ...v, decommissioned: true, operationStatus: 'stopped', assignedDriverId: null }
          : v,
      ),
      drivers: prev.drivers.map((d) =>
        d.assignedVehicleId === vehicleId && d.organizationId === activeOrganization.id
          ? { ...d, assignedVehicleId: null, status: d.status === 'on_trip' ? 'available' : d.status }
          : d,
      ),
      auditLogs: appendAudit(
        prev.auditLogs,
        'DECOMMISSIONED_VEHICLE',
        'vehicle',
        vehicleId,
        `Archived ${target.registrationNumber} while preserving trip, fuel, and maintenance history`,
      ),
    }))
  }

  const restoreVehicle = (vehicleId: string) => {
    assertRolePermission(activeRole, 'restore_vehicle')
    const target = orgAllVehicles.find((v) => v.id === vehicleId && v.decommissioned)
    if (!target) return
    const conflict = vehicles.find(
      (v) => normalizeRegistrationNumber(v.registrationNumber) === normalizeRegistrationNumber(target.registrationNumber),
    )
    if (conflict) {
      throw new Error(`Cannot restore ${target.registrationNumber}: an active vehicle already uses this registration.`)
    }
    commitDataset((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) =>
        v.id === vehicleId && v.organizationId === activeOrganization.id
          ? { ...v, decommissioned: false, operationStatus: 'stopped' }
          : v,
      ),
      auditLogs: appendAudit(
        prev.auditLogs,
        'RESTORED_VEHICLE',
        'vehicle',
        vehicleId,
        `Restored ${target.registrationNumber} to active fleet`,
      ),
    }))
  }

  const assignDriverToVehicle = (vehicleId: string, driverId: string | null) => {
    assertRolePermission(activeRole, 'assign_driver')
    commitDataset((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => {
        if (v.organizationId !== activeOrganization.id) return v
        if (v.id === vehicleId) return { ...v, assignedDriverId: driverId }
        if (driverId && v.assignedDriverId === driverId) return { ...v, assignedDriverId: null }
        return v
      }),
      drivers: prev.drivers.map((d) => {
        if (d.organizationId !== activeOrganization.id) return d
        if (d.id === driverId) return { ...d, assignedVehicleId: vehicleId }
        if (d.assignedVehicleId === vehicleId) return { ...d, assignedVehicleId: null }
        return d
      }),
      auditLogs: appendAudit(prev.auditLogs, 'ASSIGNED_DRIVER', 'vehicle', vehicleId, `Assigned driver ${driverId ?? 'None'} to vehicle`),
    }))
  }

  const addDriver = (payload: { name: string; mobile: string; email: string; licenseNumber: string; licenseExpiry: string }): Driver => {
    assertRolePermission(activeRole, 'add_driver')
    if (!payload.name.trim() || !payload.licenseNumber.trim()) {
      throw new Error('Driver name and commercial license number are required.')
    }
    const driver: Driver = {
      id: `d-${Date.now()}`,
      organizationId: activeOrganization.id,
      environment,
      name: payload.name.trim(),
      mobile: payload.mobile.trim(),
      email: payload.email.trim(),
      licenseNumber: payload.licenseNumber.trim().toUpperCase(),
      licenseExpiry: payload.licenseExpiry,
      assignedVehicleId: null,
      status: 'available',
      safetyScore: 85,
      speedingScore: 86,
      brakingScore: 85,
      accelerationScore: 84,
      corneringScore: 85,
      fatigueComplianceScore: 88,
      totalTrips: 0,
      totalDistanceKm: 0,
      joinDate: new Date().toISOString().slice(0, 10),
      coachingRecommendations: ['Newly onboarded commercial driver; monitor initial 10 trips for baseline calibration.'],
      dataConfidenceNote: 'New driver baseline',
    }
    commitDataset((prev) => ({
      ...prev,
      drivers: [driver, ...prev.drivers],
      auditLogs: appendAudit(prev.auditLogs, 'ADDED_DRIVER', 'driver', driver.id, `Added driver ${driver.name}`),
    }))
    return driver
  }

  const approveOnboardingDriver = (driverId: string, approve: boolean) => {
    assertRolePermission(activeRole, 'approve_driver')
    commitDataset((prev) => ({
      ...prev,
      drivers: approve
        ? prev.drivers.map((d) =>
            d.id === driverId && d.organizationId === activeOrganization.id ? { ...d, status: 'available' } : d,
          )
        : prev.drivers.filter((d) => !(d.id === driverId && d.organizationId === activeOrganization.id)),
      auditLogs: appendAudit(
        prev.auditLogs,
        approve ? 'APPROVED_DRIVER' : 'REJECTED_DRIVER',
        'driver',
        driverId,
        approve ? 'Approved onboarding driver into active roster' : 'Declined onboarding driver application',
      ),
    }))
  }

  const disputeDriverEvent = (eventId: string, reason: string) => {
    assertRolePermission(activeRole, 'dispute_driver_event')
    commitDataset((prev) => ({
      ...prev,
      driverEvents: prev.driverEvents.map((e) =>
        e.id === eventId && e.organizationId === activeOrganization.id
          ? { ...e, disputeStatus: 'disputed', disputeReason: reason }
          : e,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'DISPUTED_EVENT', 'driver_event', eventId, reason),
    }))
  }

  const resolveDriverEventDispute = (
    eventId: string,
    decision: 'accepted_dismissed' | 'rejected_upheld',
    note: string,
  ) => {
    assertRolePermission(activeRole, 'resolve_driver_dispute')
    commitDataset((prev) => ({
      ...prev,
      driverEvents: prev.driverEvents.map((e) =>
        e.id === eventId && e.organizationId === activeOrganization.id
          ? { ...e, disputeStatus: decision, disputeResolutionNote: note }
          : e,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'RESOLVED_EVENT_DISPUTE', 'driver_event', eventId, `${decision}: ${note}`),
    }))
  }

  const startTrip = (
    driverId: string,
    vehicleId: string,
    origin = 'Depot Dispatch Point',
    destination = 'Regional Delivery Zone',
    offlineMode = false,
  ): Trip | null => {
    assertRolePermission(activeRole, 'start_own_trip')
    const vehicle = vehicles.find((v) => v.id === vehicleId && !v.decommissioned)
    if (!vehicle) return null

    // Guard against duplicate active trips on the same driver or same vehicle
    const existingActiveDriverTrip = trips.find((t) => t.driverId === driverId && t.status === 'active')
    const existingActiveVehicleTrip = trips.find((t) => t.vehicleId === vehicleId && t.status === 'active')
    if (existingActiveDriverTrip || existingActiveVehicleTrip) {
      return null
    }

    const trip: Trip = {
      id: `t-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      organizationId: activeOrganization.id,
      environment,
      vehicleId,
      driverId,
      originAddress: origin.trim() || 'Depot Dispatch Point',
      destinationAddress: destination.trim() || 'Regional Delivery Zone',
      startLocation: vehicle.telemetry.location,
      startTime: new Date().toISOString(),
      distanceKm: 0,
      durationMinutes: 0,
      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
      status: 'active',
      route: [vehicle.telemetry.location],
      speedTimeline: [{ minuteOffset: 0, label: 'Start', speedKmh: 0 }],
      stops: [],
      offlineSynced: !offlineMode,
    }
    commitDataset((prev) => ({
      ...prev,
      trips: [trip, ...prev.trips],
      vehicles: prev.vehicles.map((v) =>
        v.id === vehicleId && v.organizationId === activeOrganization.id
          ? {
              ...v,
              operationStatus: 'moving',
              telemetry: {
                ...v.telemetry,
                speedKmh: 34,
                connectionState: offlineMode ? 'intermittent' : 'connected',
                lastUpdatedAt: new Date().toISOString(),
              },
            }
          : v,
      ),
      drivers: prev.drivers.map((d) =>
        d.id === driverId && d.organizationId === activeOrganization.id ? { ...d, status: 'on_trip' } : d,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'STARTED_TRIP', 'trip', trip.id, `Trip started ${trip.originAddress} → ${trip.destinationAddress}`),
    }))
    return trip
  }

  const endTrip = (tripId: string) => {
    assertRolePermission(activeRole, 'end_trip')
    const trip = trips.find((t) => t.id === tripId)
    // Idempotency guard: never re-complete an already completed trip
    if (!trip || trip.status === 'completed') return

    const elapsedMin = Math.max(12, Math.round((Date.now() - new Date(trip.startTime).getTime()) / 60000))
    const completedKm = Math.max(8.5, trip.distanceKm || Number((elapsedMin * 0.55).toFixed(1)))
    commitDataset((prev) => ({
      ...prev,
      trips: prev.trips.map((t) =>
        t.id === tripId && t.organizationId === activeOrganization.id
          ? {
              ...t,
              status: 'completed',
              endTime: new Date().toISOString(),
              durationMinutes: elapsedMin,
              distanceKm: completedKm,
              avgSpeedKmh: Math.round((completedKm / elapsedMin) * 60),
              maxSpeedKmh: Math.max(t.maxSpeedKmh, 58),
            }
          : t,
      ),
      vehicles: prev.vehicles.map((v) =>
        v.id === trip.vehicleId && v.organizationId === activeOrganization.id
          ? {
              ...v,
              operationStatus: 'stopped',
              odometerKm: Math.round(v.odometerKm + completedKm),
              telemetry: { ...v.telemetry, speedKmh: 0, lastUpdatedAt: new Date().toISOString() },
            }
          : v,
      ),
      drivers: prev.drivers.map((d) =>
        d.id === trip.driverId && d.organizationId === activeOrganization.id
          ? {
              ...d,
              status: 'available',
              totalTrips: d.totalTrips + 1,
              totalDistanceKm: Math.round(d.totalDistanceKm + completedKm),
            }
          : d,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'COMPLETED_TRIP', 'trip', tripId, `Completed trip (${completedKm} km)`),
    }))
  }

  const scheduleTrip = (payload: {
    vehicleId: string
    driverId: string
    originAddress: string
    destinationAddress: string
  }) => {
    assertRolePermission(activeRole, 'schedule_trip')
    return startTrip(payload.driverId, payload.vehicleId, payload.originAddress, payload.destinationAddress)
  }

  const syncOfflineTrips = (): number => {
    const unsyncedTrips = trips.filter((t) => t.offlineSynced === false)
    if (unsyncedTrips.length === 0) return 0

    // Deduplicate identical queued offline trip signatures
    const seenKeys = new Set<string>()
    const duplicateIds = new Set<string>()
    for (const t of unsyncedTrips) {
      const signature = `${t.vehicleId}:${t.driverId}:${t.originAddress}:${t.destinationAddress}:${t.startTime.slice(0, 16)}`
      if (seenKeys.has(signature)) {
        duplicateIds.add(t.id)
      } else {
        seenKeys.add(signature)
      }
    }

    const uniqueSyncedCount = unsyncedTrips.length - duplicateIds.size
    commitDataset((prev) => ({
      ...prev,
      trips: prev.trips
        .filter((t) => !(t.organizationId === activeOrganization.id && duplicateIds.has(t.id)))
        .map((t) => (t.organizationId === activeOrganization.id ? { ...t, offlineSynced: true } : t)),
      auditLogs: appendAudit(
        prev.auditLogs,
        'SYNCED_OFFLINE_TRIPS',
        'trip',
        'batch',
        `Synchronized ${uniqueSyncedCount} offline queued trip(s)`,
      ),
    }))
    return uniqueSyncedCount
  }

  const addFuelTransaction = (
    payload: Omit<FuelTransaction, 'id' | 'organizationId' | 'environment' | 'anomalyFlags' | 'verificationStatus'>,
  ): FuelTransaction => {
    assertRolePermission(activeRole, 'log_fuel')
    const err = validateFuelTransactionInput({
      vehicleId: payload.vehicleId,
      amountInr: payload.amountInr,
      litersOrKwh: payload.litersOrKwh,
      unitPriceInr: payload.unitPriceInr,
      odometerKm: payload.odometerKm,
      station: payload.station,
    })
    if (err) {
      throw new Error(err)
    }

    const newTx: FuelTransaction = {
      ...payload,
      station: payload.station.trim(),
      id: `f-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      organizationId: activeOrganization.id,
      environment,
      verificationStatus: 'pending',
      anomalyFlags: [],
    }
    commitDataset((prev) => ({
      ...prev,
      fuelTransactions: [newTx, ...prev.fuelTransactions],
      auditLogs: appendAudit(prev.auditLogs, 'LOGGED_FUEL', 'fuel_transaction', newTx.id, `Logged ₹${newTx.amountInr} at ${newTx.station}`),
    }))
    return newTx
  }

  const verifyFuelTransaction = (txId: string, status: 'verified' | 'needs_review') => {
    assertRolePermission(activeRole, 'verify_fuel')
    commitDataset((prev) => ({
      ...prev,
      fuelTransactions: prev.fuelTransactions.map((tx) =>
        tx.id === txId && tx.organizationId === activeOrganization.id
          ? { ...tx, verificationStatus: status }
          : tx,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'REVIEWED_FUEL', 'fuel_transaction', txId, `Marked fuel entry as ${status}`),
    }))
  }

  const scheduleMaintenance = (payload: {
    vehicleId: string
    serviceType: string
    componentName: ComponentCategory | 'General Service'
    serviceCenter: string
    description: string
    costInr: number
    performedAt: string
    linkedPredictionId?: string
  }): MaintenanceRecord => {
    assertRolePermission(activeRole, 'schedule_maintenance')
    if (!Number.isFinite(payload.costInr) || payload.costInr < 0) {
      throw new Error('Maintenance estimate cost cannot be negative.')
    }
    const rec: MaintenanceRecord = {
      id: `m-${Date.now()}`,
      organizationId: activeOrganization.id,
      environment,
      vehicleId: payload.vehicleId,
      serviceType: payload.serviceType,
      componentName: payload.componentName,
      serviceCenter: payload.serviceCenter,
      description: payload.description,
      costInr: payload.costInr,
      downtimeDays: 1,
      partsReplaced: [],
      performedAt: payload.performedAt,
      status: 'scheduled',
      linkedPredictionId: payload.linkedPredictionId,
    }
    if (payload.linkedPredictionId) {
      setPredictionStatusOverrides((prev) => ({ ...prev, [payload.linkedPredictionId!]: 'scheduled' }))
    }
    commitDataset((prev) => ({
      ...prev,
      maintenanceRecords: [rec, ...prev.maintenanceRecords],
      auditLogs: appendAudit(prev.auditLogs, 'SCHEDULED_MAINTENANCE', 'maintenance', rec.id, `Scheduled ${payload.serviceType} at ${payload.serviceCenter}`),
    }))
    return rec
  }

  const completeMaintenance = (recordId: string) => {
    assertRolePermission(activeRole, 'complete_maintenance')
    const rec = maintenanceRecords.find((m) => m.id === recordId)
    if (!rec) return
    if (rec.linkedPredictionId) {
      setPredictionStatusOverrides((prev) => ({ ...prev, [rec.linkedPredictionId!]: 'resolved' }))
    }
    commitDataset((prev) => ({
      ...prev,
      maintenanceRecords: prev.maintenanceRecords.map((m) =>
        m.id === recordId && m.organizationId === activeOrganization.id
          ? { ...m, status: 'completed', performedAt: new Date().toISOString() }
          : m,
      ),
      vehicles: prev.vehicles.map((v) => {
        if (v.id !== rec.vehicleId || v.organizationId !== activeOrganization.id) return v
        const updatedComponents = v.components.map((c) =>
          c.componentName === rec.componentName
            ? { ...c, healthScore: Math.max(c.healthScore, 92), status: 'healthy' as const, lastServicedAt: new Date().toISOString().slice(0, 10) }
            : c,
        )
        const avg = Math.round(updatedComponents.reduce((s, c) => s + c.healthScore, 0) / updatedComponents.length)
        return {
          ...v,
          healthScore: avg,
          operationStatus: v.operationStatus === 'maintenance' ? 'stopped' : v.operationStatus,
          lastServiceDate: new Date().toISOString().slice(0, 10),
          components: updatedComponents,
        }
      }),
      auditLogs: appendAudit(prev.auditLogs, 'COMPLETED_MAINTENANCE', 'maintenance', recordId, `Completed service ${rec.serviceType}`),
    }))
  }

  const resolvePrediction = (predictionId: string) => {
    assertRolePermission(activeRole, 'resolve_prediction')
    setPredictionStatusOverrides((prev) => ({ ...prev, [predictionId]: 'resolved' }))
    commitDataset((prev) => ({
      ...prev,
      auditLogs: appendAudit(prev.auditLogs, 'RESOLVED_PREDICTION', 'ai_prediction', predictionId, 'Marked predictive maintenance alert as resolved'),
    }))
  }

  const recalculatePredictions = () => {
    setPredictionTick(Date.now())
  }

  const submitVehicleInspection = (
    payload: Omit<VehicleInspection, 'id' | 'organizationId' | 'environment' | 'timestamp' | 'passed'>,
  ): VehicleInspection => {
    assertRolePermission(activeRole, 'submit_inspection')
    const passed =
      payload.tyreCondition === 'good' &&
      payload.brakeFeel === 'normal' &&
      !payload.fluidLeaksDetected &&
      !payload.warningLightsOn &&
      !payload.batteryOrStartingIssue

    const insp: VehicleInspection = {
      ...payload,
      id: `ins-${Date.now()}`,
      organizationId: activeOrganization.id,
      environment,
      timestamp: new Date().toISOString(),
      passed,
    }
    commitDataset((prev) => ({
      ...prev,
      inspections: [insp, ...prev.inspections],
      auditLogs: appendAudit(prev.auditLogs, 'SUBMITTED_INSPECTION', 'inspection', insp.id, `Pre-trip inspection ${passed ? 'passed' : 'flagged issues'}`),
    }))
    return insp
  }

  const reportDriverIssue = (
    vehicleId: string,
    driverId: string,
    title: string,
    message: string,
    severity: 'medium' | 'high' | 'critical',
  ) => {
    assertRolePermission(activeRole, 'report_issue')
    const cleanTitle = title.trim()
    const cleanMsg = message.trim()
    const existingDuplicate = alerts.find(
      (a) =>
        !a.acknowledged &&
        a.vehicleId === vehicleId &&
        a.title.toLowerCase() === cleanTitle.toLowerCase(),
    )

    if (existingDuplicate) {
      commitDataset((prev) => ({
        ...prev,
        alerts: prev.alerts.map((a) =>
          a.id === existingDuplicate.id
            ? {
                ...a,
                message: cleanMsg || a.message,
                timestamp: new Date().toISOString(),
                read: false,
                source: a.source ?? 'Driver Mobile App',
              }
            : a,
        ),
      }))
      return
    }

    const newAlert: OperationalAlert = {
      id: `al-${Date.now()}`,
      organizationId: activeOrganization.id,
      environment,
      vehicleId,
      driverId,
      category: 'maintenance',
      severity: severity === 'medium' ? 'moderate' : severity,
      title: cleanTitle,
      message: cleanMsg,
      source: 'Driver Mobile App',
      timestamp: new Date().toISOString(),
      read: false,
      acknowledged: false,
      actionRoute: `/dashboard/fleet/${vehicleId}`,
    }
    commitDataset((prev) => ({
      ...prev,
      alerts: [newAlert, ...prev.alerts],
      auditLogs: appendAudit(prev.auditLogs, 'DRIVER_REPORTED_ISSUE', 'alert', newAlert.id, `${cleanTitle}: ${cleanMsg}`),
    }))
  }

  const markAlertRead = (alertId: string) => {
    commitDataset((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === alertId && a.organizationId === activeOrganization.id ? { ...a, read: true } : a,
      ),
    }))
  }

  const markAllAlertsRead = () => {
    commitDataset((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.organizationId === activeOrganization.id ? { ...a, read: true } : a,
      ),
    }))
  }

  const acknowledgeAlert = (alertId: string) => {
    assertRolePermission(activeRole, 'acknowledge_alert')
    commitDataset((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === alertId && a.organizationId === activeOrganization.id
          ? { ...a, read: true, acknowledged: true }
          : a,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'ACKNOWLEDGED_ALERT', 'alert', alertId, 'Acknowledged operational alert'),
    }))
  }

  const updateSubscriptionPlan = (planId: SubscriptionPlanId) => {
    assertRolePermission(activeRole, 'manage_subscription')
    const spec = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0]
    commitDataset((prev) => ({
      ...prev,
      organizations: prev.organizations.map((o) =>
        o.id === activeOrganization.id
          ? { ...o, planId, vehicleLimit: spec.vehicleLimit, driverLimit: spec.driverLimit }
          : o,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'UPDATED_SUBSCRIPTION', 'organization', activeOrganization.id, `Changed subscription tier to ${spec.name}`),
    }))
  }

  const updateOrganizationProfile = (patch: Partial<Pick<Organization, 'name' | 'city' | 'state' | 'timezone'>>) => {
    assertRolePermission(activeRole, 'update_org_settings')
    commitDataset((prev) => ({
      ...prev,
      organizations: prev.organizations.map((o) =>
        o.id === activeOrganization.id ? { ...o, ...patch } : o,
      ),
      auditLogs: appendAudit(prev.auditLogs, 'UPDATED_ORG_SETTINGS', 'organization', activeOrganization.id, 'Updated organization configuration'),
    }))
  }

  const updateSettings = (patch: Partial<WorkspaceSettings>) => {
    assertRolePermission(activeRole, 'update_global_settings')
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }

  const recordReportGeneration = (
    entry: Omit<ReportHistoryItem, 'id' | 'organizationId' | 'environment' | 'generatedAt'>,
  ) => {
    assertRolePermission(activeRole, 'export_reports')
    const item: ReportHistoryItem = {
      ...entry,
      id: `rep-${Date.now()}`,
      organizationId: activeOrganization.id,
      environment,
      generatedAt: new Date().toISOString(),
    }
    commitDataset((prev) => ({
      ...prev,
      reports: [item, ...prev.reports],
      auditLogs: appendAudit(prev.auditLogs, 'GENERATED_REPORT', 'report', item.id, `Exported ${item.title} (${item.format})`),
    }))
  }

  const submitDemoRequest = (payload: Omit<DemoRequestSubmission, 'id' | 'submittedAt'>): DemoRequestSubmission => {
    const submission: DemoRequestSubmission = {
      ...payload,
      id: `demo-req-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    }
    setDemoRequests((prev) => {
      const next = [submission, ...prev]
      localStorage.setItem(DEMO_REQUESTS_KEY, JSON.stringify(next))
      return next
    })
    return submission
  }

  const updateTelemetryState = (vehicleId: string, patch: Partial<Vehicle['telemetry']>) => {
    if (patch.location && !isValidCoordinate(patch.location.lat, patch.location.lng)) {
      return
    }
    commitDataset((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => {
        if (v.id !== vehicleId || v.organizationId !== activeOrganization.id) return v
        if (patch.lastUpdatedAt && isStaleOutOfOrderTimestamp(patch.lastUpdatedAt, v.telemetry.lastUpdatedAt)) {
          return v
        }
        return { ...v, telemetry: { ...v.telemetry, ...patch } }
      }),
    }))
  }

  const value: FleetContextValue = {
    environment,
    setEnvironment,
    resetCurrentEnvironment,
    organizations: dataset.organizations,
    activeOrganization,
    setActiveOrganizationId,
    createOrganization,
    activeRole,
    setActiveRole,
    reportingPeriod,
    setReportingPeriod,
    searchTerm,
    setSearchTerm,
    simulationActive,
    toggleSimulation: () => setSimulationActive((s) => !s),
    corridors: REGIONAL_CORRIDORS,
    members,
    inviteMember,
    updateMemberRole,
    vehicles,
    archivedVehicles,
    allOrgVehiclesCount: vehicles.length,
    drivers,
    driverEvents,
    trips,
    fuelTransactions,
    maintenanceRecords,
    inspections,
    alerts,
    predictions,
    riskAssessments,
    financialSummary,
    auditLogs,
    reports,
    settings,
    updateSettings,
    updateOrganizationProfile,
    unreadAlertCount,
    currentDriverId,
    setCurrentDriverId,
    currentDriverTrip,
    offlineQueuedTripsCount,
    addVehicle,
    updateVehicle,
    decommissionVehicle,
    restoreVehicle,
    assignDriverToVehicle,
    addDriver,
    approveOnboardingDriver,
    disputeDriverEvent,
    resolveDriverEventDispute,
    startTrip,
    endTrip,
    scheduleTrip,
    syncOfflineTrips,
    addFuelTransaction,
    verifyFuelTransaction,
    scheduleMaintenance,
    completeMaintenance,
    resolvePrediction,
    recalculatePredictions,
    submitVehicleInspection,
    reportDriverIssue,
    markAlertRead,
    markAllAlertsRead,
    acknowledgeAlert,
    updateSubscriptionPlan,
    recordReportGeneration,
    demoRequests,
    submitDemoRequest,
    updateTelemetryState,
  }

  return <FleetContext.Provider value={value}>{children}</FleetContext.Provider>
}

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used within FleetProvider')
  return ctx
}
