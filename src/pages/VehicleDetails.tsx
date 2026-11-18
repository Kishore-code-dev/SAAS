import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Download,
  Edit3,
  FileCheck2,
  Info,
  Lock,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import {
  classifyComplianceExpiryTier,
  classifyTelemetryFreshness,
  computeVehicleFiveAreaHealth,
  TELEMETRY_SCOPE_DISCLOSURE,
  type ComplianceExpiryTier,
} from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  EnterpriseModal,
  formatDateTime,
  formatInr,
  formatShortDate,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import type { FiveAreaHealthCategory, TyrePositionRecord } from '../types/fleet'

const TABS = [
  'Overview',
  'Technical Specs',
  'Compliance Vault',
  '5-Area Health & Tyres',
  'Work Orders & Issues',
  'Service & Bills',
  'Trips',
  'Fuel',
  'Financials',
  'Driver History',
  'Activity History',
] as const

type DigitalTwinTab = (typeof TABS)[number]

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(new Error('Failed to read selected file.'))
    reader.readAsDataURL(file)
  })
}

function tierBadgeStyle(tier: ComplianceExpiryTier) {
  if (tier === 'expired' || tier === 'critical_7d') {
    return 'bg-[#FCECEB] border-[#E7A8A0] text-[#A24034]'
  }
  if (tier === 'urgent_15d' || tier === 'upcoming_30d') {
    return 'bg-[#FDF3E7] border-[#E8C290] text-[#8F6510]'
  }
  if (tier === 'watch_60d') {
    return 'bg-[#EEE8F7] border-[#B8A3D9] text-[#6E5696]'
  }
  if (tier === 'valid') {
    return 'bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A]'
  }
  return 'bg-[#F5F5F7] border-[#E5E5E5] text-[#958777]'
}

export default function VehicleDetails() {
  const { vehicleId, id } = useParams()
  const resolvedId = vehicleId ?? id
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    archivedVehicles,
    drivers,
    driverEvents,
    driverAssignments,
    trips,
    fuelTransactions,
    maintenanceRecords,
    predictions,
    inspections,
    smallIssues,
    workOrders,
    documentVault,
    tyrePositions,
    auditLogs,
    corridors,
    assignDriverToVehicle,
    decommissionVehicle,
    updateVehicle,
    scheduleMaintenance,
    uploadDocumentToVault,
    verifyVaultDocument,
    updateTyrePosition,
    addSmallIssue,
    convertIssueToWorkOrder,
    nowTick,
  } = useFleet()

  const [activeTab, setActiveTab] = useState<DigitalTwinTab>('Overview')
  const [editOpen, setEditOpen] = useState(false)

  const vehicle = vehicles.find((v) => v.id === resolvedId) ?? archivedVehicles.find((v) => v.id === resolvedId)

  const [editForm, setEditForm] = useState({
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? 2024,
    odometerKm: vehicle?.odometerKm ?? 0,
    dailyAvgKm: vehicle?.dailyAvgKm ?? 140,
    corridorId: vehicle?.corridorId ?? corridors[0]?.id ?? 'cor-chennai',
    insuranceProvider: vehicle?.insuranceProvider ?? '',
    insuranceExpiry: vehicle?.insuranceExpiry ?? '',
    registrationExpiry: vehicle?.registrationExpiry ?? '',
    fitnessExpiry: vehicle?.fitnessExpiry ?? '',
    pucExpiry: vehicle?.pucExpiry ?? '',
    permitExpiry: vehicle?.permitExpiry ?? '',
  })

  const [specsForm, setSpecsForm] = useState({
    heightMeters: vehicle?.specs?.heightMeters ?? 3.1,
    widthMeters: vehicle?.specs?.widthMeters ?? 2.25,
    lengthMeters: vehicle?.specs?.lengthMeters ?? 6.4,
    grossVehicleWeightKg: vehicle?.specs?.grossVehicleWeightKg ?? 16200,
    axleCount: vehicle?.specs?.axleCount ?? 2,
    payloadCapacityKg: vehicle?.specs?.payloadCapacityKg ?? 9500,
    cargoType: vehicle?.specs?.cargoType ?? 'General Freight',
    hazmatClass: vehicle?.specs?.hazmatClass ?? '',
    chassisNumber: vehicle?.specs?.chassisNumber ?? '',
    engineNumber: vehicle?.specs?.engineNumber ?? '',
    emissionNorm: (vehicle?.specs?.emissionNorm ?? 'BS-VI') as 'BS-VI' | 'BS-IV' | 'EV-Zero',
  })

  const [vaultDocCat, setVaultDocCat] = useState('Registration Certificate (RC)')
  const [vaultDocTitle, setVaultDocTitle] = useState('')
  const [vaultDocExpiry, setVaultDocExpiry] = useState('')
  const [uploadingDoc, setUploadingDoc] = useState(false)

  const [issueTitle, setIssueTitle] = useState('')
  const [issueDesc, setIssueDesc] = useState('')
  const [issueArea, setIssueArea] = useState<FiveAreaHealthCategory>('Vehicle Health')
  const [issueSeverity, setIssueSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')

  const fiveAreaHealth = useMemo(() => {
    if (!vehicle) return null
    return computeVehicleFiveAreaHealth({
      vehicle,
      fuelTransactions,
      drivers,
      driverEvents,
      tyrePositions,
      inspections,
      smallIssues,
      nowMs: nowTick,
    })
  }, [vehicle, fuelTransactions, drivers, driverEvents, tyrePositions, inspections, smallIssues, nowTick])

  if (!vehicle) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/dashboard/fleet')} className="btn-secondary text-xs">
          <ArrowLeft className="w-4 h-4" />
          Back to Fleet
        </button>
        <EmptySectionState
          title="Vehicle record not found in active organization"
          description="The requested vehicle may belong to another organization or workspace."
          actionLabel="Return to Fleet"
          onAction={() => navigate('/dashboard/fleet')}
        />
      </div>
    )
  }

  const canEdit = canPerformAction(activeRole, 'edit_vehicle')
  const canAssign = canPerformAction(activeRole, 'assign_driver')
  const canDecommission = canPerformAction(activeRole, 'decommission_vehicle')
  const canScheduleMaint = canPerformAction(activeRole, 'schedule_maintenance')
  const canVerifyDocs = canPerformAction(activeRole, 'verify_documents')
  const canManageWo = canPerformAction(activeRole, 'manage_work_orders')

  const assignedDriver = drivers.find((d) => d.id === vehicle.assignedDriverId)
  const freshness = classifyTelemetryFreshness(vehicle.telemetry.lastUpdatedAt, vehicle.telemetry.connectionState, nowTick)
  const vehicleTrips = trips.filter((t) => t.vehicleId === vehicle.id)
  const vehicleFuel = fuelTransactions.filter((f) => f.vehicleId === vehicle.id)
  const vehicleMaint = maintenanceRecords.filter((m) => m.vehicleId === vehicle.id)
  const vehiclePredictions = predictions.filter((p) => p.vehicleId === vehicle.id)
  const vehicleEvents = driverEvents.filter((e) => e.vehicleId === vehicle.id)
  const vehicleAssignments = driverAssignments.filter((a) => a.vehicleId === vehicle.id)
  const vehicleInspections = inspections.filter((i) => i.vehicleId === vehicle.id)
  const vehicleIssues = smallIssues.filter((s) => s.vehicleId === vehicle.id)
  const vehicleWos = workOrders.filter((w) => w.vehicleId === vehicle.id)
  const vehicleDocs = documentVault.filter((d) => d.entityType === 'vehicle' && d.entityId === vehicle.id)
  const vehicleTyres = tyrePositions.filter((t) => t.vehicleId === vehicle.id)
  const vehicleLogs = auditLogs.filter((l) => l.entityId === vehicle.id)

  const totalFuelSpend = vehicleFuel.reduce((s, f) => s + f.amountInr, 0)
  const totalMaintSpend = vehicleMaint.reduce((s, m) => s + m.costInr, 0)
  const totalLoggedKm = vehicleTrips.reduce((s, t) => s + t.distanceKm, 0)

  const indianComplianceChecks = [
    { label: 'RC Registration', date: vehicle.registrationExpiry },
    { label: 'Motor Insurance', date: vehicle.insuranceExpiry },
    { label: 'Fitness Certificate (FC)', date: vehicle.fitnessExpiry },
    { label: 'PUC Emission', date: vehicle.pucExpiry },
    { label: 'National / State Permit', date: vehicle.permitExpiry },
  ].map((c) => ({ ...c, tierInfo: classifyComplianceExpiryTier(c.date, nowTick) }))

  const urgentComplianceCount = indianComplianceChecks.filter((c) =>
    ['expired', 'critical_7d', 'urgent_15d', 'upcoming_30d'].includes(c.tierInfo.tier),
  ).length

  const handleOpenEdit = () => {
    setEditForm({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      odometerKm: vehicle.odometerKm,
      dailyAvgKm: vehicle.dailyAvgKm,
      corridorId: vehicle.corridorId,
      insuranceProvider: vehicle.insuranceProvider,
      insuranceExpiry: vehicle.insuranceExpiry,
      registrationExpiry: vehicle.registrationExpiry,
      fitnessExpiry: vehicle.fitnessExpiry ?? '',
      pucExpiry: vehicle.pucExpiry ?? '',
      permitExpiry: vehicle.permitExpiry ?? '',
    })
    setEditOpen(true)
  }

  const handleSaveBasicModal = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const corridor = corridors.find((c) => c.id === editForm.corridorId)
      updateVehicle(vehicle.id, {
        make: editForm.make.trim(),
        model: editForm.model.trim(),
        year: Number(editForm.year),
        odometerKm: Number(editForm.odometerKm),
        dailyAvgKm: Number(editForm.dailyAvgKm),
        corridorId: editForm.corridorId,
        cityName: corridor?.name ?? vehicle.cityName,
        insuranceProvider: editForm.insuranceProvider.trim(),
        insuranceExpiry: editForm.insuranceExpiry,
        registrationExpiry: editForm.registrationExpiry,
        fitnessExpiry: editForm.fitnessExpiry || undefined,
        pucExpiry: editForm.pucExpiry || undefined,
        permitExpiry: editForm.permitExpiry || undefined,
      })
      toast.success(`Updated specifications for ${vehicle.registrationNumber}`)
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update vehicle specifications.')
    }
  }

  const handleSaveTechnicalSpecs = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) return
    try {
      updateVehicle(vehicle.id, {
        specs: {
          heightMeters: Number(specsForm.heightMeters),
          widthMeters: Number(specsForm.widthMeters),
          lengthMeters: Number(specsForm.lengthMeters),
          grossVehicleWeightKg: Number(specsForm.grossVehicleWeightKg),
          axleCount: Number(specsForm.axleCount),
          payloadCapacityKg: Number(specsForm.payloadCapacityKg),
          cargoType: specsForm.cargoType.trim() || 'General Freight',
          hazmatClass: specsForm.hazmatClass.trim() || undefined,
          chassisNumber: specsForm.chassisNumber.trim() || undefined,
          engineNumber: specsForm.engineNumber.trim() || undefined,
          emissionNorm: specsForm.emissionNorm,
        },
      })
      toast.success(`Saved heavy-truck technical specifications for ${vehicle.registrationNumber}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save technical specifications.')
    }
  }

  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5 MB maximum size.')
      return
    }
    setUploadingDoc(true)
    try {
      const contentBase64 = await readFileAsBase64(file)
      await uploadDocumentToVault({
        entityType: 'vehicle',
        entityId: vehicle.id,
        category: vaultDocCat,
        title: vaultDocTitle.trim() || `${vaultDocCat} · ${vehicle.registrationNumber}`,
        expiryDate: vaultDocExpiry || undefined,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        contentBase64,
      })
      setVaultDocTitle('')
      toast.success('Uploaded to Compliance Vault as Pending Verification (uploaded != verified).')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploadingDoc(false)
      e.target.value = ''
    }
  }

  const handleCreateSmallIssue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!issueTitle.trim()) return
    try {
      addSmallIssue({
        vehicleId: vehicle.id,
        driverId: vehicle.assignedDriverId ?? undefined,
        title: issueTitle.trim(),
        description: issueDesc.trim() || issueTitle.trim(),
        healthArea: issueArea,
        severity: issueSeverity,
        source: 'owner_manual',
      })
      setIssueTitle('')
      setIssueDesc('')
      toast.success('Logged vehicle small issue.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to log issue.')
    }
  }

  const handleDecommission = () => {
    try {
      decommissionVehicle(vehicle.id)
      toast.success(`Archived ${vehicle.registrationNumber} (historical records preserved)`)
      navigate('/dashboard/fleet')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action not permitted.')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/fleet')}
            className="text-xs font-semibold text-[#958777] hover:text-[#625346] inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Fleet Assets
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="dm-page-title tabular-nums">{vehicle.registrationNumber}</h1>
            <SeverityText severity={vehicle.healthScore <= 49 ? 'critical' : vehicle.healthScore <= 74 ? 'at-risk' : 'healthy'} />
            <SeverityText severity={freshness.freshness} label={freshness.label} />
            {urgentComplianceCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-[#FDF3E7] border-[#E8C290] text-[#8F6510]">
                <AlertTriangle className="w-3 h-3" />
                {urgentComplianceCount} Compliance Watch
              </span>
            )}
            {vehicle.decommissioned && <SeverityText severity="moderate" label="Archived" />}
          </div>
          <p className="text-sm text-[#958777] mt-1">
            {vehicle.make} {vehicle.model} ({vehicle.year}) · {vehicle.category} · {vehicle.powertrain} ({vehicle.fuelType}) · {vehicle.cityName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canAssign && !vehicle.decommissioned && (
            <div>
              <label htmlFor="assign-drv-select" className="sr-only">Assign Driver</label>
              <select
                id="assign-drv-select"
                value={vehicle.assignedDriverId ?? ''}
                onChange={(e) => {
                  try {
                    assignDriverToVehicle(vehicle.id, e.target.value || null)
                    toast.success('Updated assigned driver')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Unable to assign driver')
                  }
                }}
                className="dm-input py-2 text-xs font-medium"
              >
                <option value="">Unassigned Driver</option>
                {drivers
                  .filter((d) => d.operationalStatus === 'active')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.licenseNumber})
                    </option>
                  ))}
              </select>
            </div>
          )}
          {canEdit && (
            <button type="button" onClick={handleOpenEdit} className="btn-secondary text-xs">
              <Edit3 className="w-3.5 h-3.5" />
              Quick Edit
            </button>
          )}
          {canDecommission && !vehicle.decommissioned && (
            <button type="button" onClick={handleDecommission} className="btn-danger text-xs">
              <Trash2 className="w-3.5 h-3.5" />
              Decommission
            </button>
          )}
        </div>
      </div>

      {/* Full-Page Digital Twin Tabs */}
      <div className="border-b border-[#E5E5E5] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max" role="tablist" aria-label="Vehicle ERP Master Sections">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-[#6E5696] text-[#625346]'
                  : 'border-transparent text-[#958777] hover:text-[#625346]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'Overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="enterprise-card p-5 space-y-3">
              <h2 className="dm-card-title text-sm">Indian Statutory Compliance</h2>
              <dl className="space-y-2.5 text-xs">
                {indianComplianceChecks.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <dt className="text-[#958777]">{item.label}</dt>
                    <dd className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tierBadgeStyle(item.tierInfo.tier)}`}>
                      {item.date ? formatShortDate(item.date) : 'Not set'} · {item.tierInfo.label}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="enterprise-card p-5 space-y-3">
              <h2 className="dm-card-title text-sm">Utilization & Service Interval</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between"><dt className="text-[#958777]">Odometer</dt><dd className="tabular-nums font-semibold">{vehicle.odometerKm.toLocaleString('en-IN')} km</dd></div>
                <div className="flex justify-between"><dt className="text-[#958777]">Daily Avg Usage</dt><dd className="tabular-nums">{vehicle.dailyAvgKm} km/day</dd></div>
                <div className="flex justify-between"><dt className="text-[#958777]">Last Service Date</dt><dd className="tabular-nums">{formatShortDate(vehicle.lastServiceDate)}</dd></div>
                <div className="flex justify-between"><dt className="text-[#958777]">Next Service Due</dt><dd className="tabular-nums">{formatShortDate(vehicle.nextServiceDueDate)}</dd></div>
                {vehicle.nextServiceDueOdometerKm && (
                  <div className="flex justify-between"><dt className="text-[#958777]">Next Odometer Due</dt><dd className="tabular-nums">{vehicle.nextServiceDueOdometerKm.toLocaleString('en-IN')} km</dd></div>
                )}
              </dl>
            </div>
            <div className="enterprise-card p-5 space-y-3">
              <h2 className="dm-card-title text-sm">Assignment & Telemetry</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-[#958777]">Assigned Driver</dt>
                  <dd className="font-semibold">
                    {assignedDriver ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/drivers/${assignedDriver.id}`)}
                        className="text-[#6E5696] hover:underline"
                      >
                        {assignedDriver.name}
                      </button>
                    ) : (
                      'Unassigned'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between"><dt className="text-[#958777]">Corridor Base</dt><dd>{vehicle.cityName}</dd></div>
                <div className="flex justify-between"><dt className="text-[#958777]">{vehicle.powertrain === 'EV' ? 'Battery SOC' : 'Fuel Level'}</dt><dd className="tabular-nums">{vehicle.fuelOrSocPct}%</dd></div>
                <div className="flex justify-between"><dt className="text-[#958777]">Composite Health</dt><dd className="tabular-nums font-bold">{vehicle.healthScore}%</dd></div>
                <div className="flex justify-between"><dt className="text-[#958777]">Telemetry GPS</dt><dd className="tabular-nums">±{vehicle.telemetry.gpsAccuracyMeters}m · {vehicle.telemetry.signalQualityPct}% sig</dd></div>
              </dl>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-[10px] bg-[#EEE8F7] border border-[#DDD3ED] text-xs text-[#625346]">
            <Info className="w-4 h-4 text-[#6E5696] shrink-0 mt-0.5" />
            <p>{TELEMETRY_SCOPE_DISCLOSURE}</p>
          </div>
        </div>
      )}

      {activeTab === 'Technical Specs' && (
        <form onSubmit={handleSaveTechnicalSpecs} className="enterprise-card p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
            <div>
              <h2 className="dm-card-title text-base">Commercial Dimensions, Axle Load & Chassis Specifications</h2>
              <p className="text-xs text-[#958777]">
                Inline full-page ERP specs used by Truck Routing height/weight clearance checks
              </p>
            </div>
            {canEdit && (
              <button type="submit" className="btn-primary text-xs">
                <Save className="w-3.5 h-3.5" />
                Save Technical Specs
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label htmlFor="sp-h" className="dm-label">Height (m)</label>
              <input id="sp-h" type="number" step="0.05" disabled={!canEdit} value={specsForm.heightMeters} onChange={(e) => setSpecsForm((s) => ({ ...s, heightMeters: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-w" className="dm-label">Width (m)</label>
              <input id="sp-w" type="number" step="0.05" disabled={!canEdit} value={specsForm.widthMeters} onChange={(e) => setSpecsForm((s) => ({ ...s, widthMeters: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-l" className="dm-label">Length (m)</label>
              <input id="sp-l" type="number" step="0.1" disabled={!canEdit} value={specsForm.lengthMeters} onChange={(e) => setSpecsForm((s) => ({ ...s, lengthMeters: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-axles" className="dm-label">Axle Count</label>
              <input id="sp-axles" type="number" min={2} max={8} disabled={!canEdit} value={specsForm.axleCount} onChange={(e) => setSpecsForm((s) => ({ ...s, axleCount: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-gvw" className="dm-label">Gross Vehicle Weight (kg)</label>
              <input id="sp-gvw" type="number" disabled={!canEdit} value={specsForm.grossVehicleWeightKg} onChange={(e) => setSpecsForm((s) => ({ ...s, grossVehicleWeightKg: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-pay" className="dm-label">Payload Capacity (kg)</label>
              <input id="sp-pay" type="number" disabled={!canEdit} value={specsForm.payloadCapacityKg} onChange={(e) => setSpecsForm((s) => ({ ...s, payloadCapacityKg: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-cargo" className="dm-label">Cargo / Body Type</label>
              <input id="sp-cargo" disabled={!canEdit} value={specsForm.cargoType} onChange={(e) => setSpecsForm((s) => ({ ...s, cargoType: e.target.value }))} className="dm-input" />
            </div>
            <div>
              <label htmlFor="sp-em" className="dm-label">Emission Standard</label>
              <select id="sp-em" disabled={!canEdit} value={specsForm.emissionNorm} onChange={(e) => setSpecsForm((s) => ({ ...s, emissionNorm: e.target.value as typeof specsForm.emissionNorm }))} className="dm-input">
                <option value="BS-VI">BS-VI</option>
                <option value="BS-IV">BS-IV</option>
                <option value="EV-Zero">EV-Zero</option>
              </select>
            </div>
            <div>
              <label htmlFor="sp-chassis" className="dm-label">Chassis / VIN</label>
              <input id="sp-chassis" disabled={!canEdit} value={specsForm.chassisNumber} onChange={(e) => setSpecsForm((s) => ({ ...s, chassisNumber: e.target.value }))} className="dm-input font-mono uppercase" />
            </div>
            <div>
              <label htmlFor="sp-engine" className="dm-label">Engine / Motor Serial</label>
              <input id="sp-engine" disabled={!canEdit} value={specsForm.engineNumber} onChange={(e) => setSpecsForm((s) => ({ ...s, engineNumber: e.target.value }))} className="dm-input font-mono uppercase" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="sp-haz" className="dm-label">Hazmat Classification (Optional)</label>
              <input id="sp-haz" disabled={!canEdit} value={specsForm.hazmatClass} onChange={(e) => setSpecsForm((s) => ({ ...s, hazmatClass: e.target.value }))} placeholder="None" className="dm-input" />
            </div>
          </div>
        </form>
      )}

      {activeTab === 'Compliance Vault' && (
        <div className="enterprise-card p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-[#EEE8F7] flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-[#6E5696]" />
              </div>
              <div>
                <h2 className="dm-card-title text-base">Private Vehicle Compliance Vault</h2>
                <p className="text-xs text-[#958777]">
                  Uploads enter as <strong className="text-[#625346]">Pending Verification</strong> — uploaded status never implies verified without explicit review.
                </p>
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-4">
              <div>
                <label htmlFor="vv-cat" className="dm-label">Category</label>
                <select id="vv-cat" value={vaultDocCat} onChange={(e) => setVaultDocCat(e.target.value)} className="dm-input text-xs">
                  <option value="Registration Certificate (RC)">Registration Certificate (RC)</option>
                  <option value="Motor Insurance Policy">Motor Insurance Policy</option>
                  <option value="Fitness Certificate (FC)">Fitness Certificate (FC)</option>
                  <option value="PUC Emission Certificate">PUC Emission Certificate</option>
                  <option value="National / State Permit">National / State Permit</option>
                </select>
              </div>
              <div>
                <label htmlFor="vv-title" className="dm-label">Document Title</label>
                <input id="vv-title" value={vaultDocTitle} onChange={(e) => setVaultDocTitle(e.target.value)} placeholder="e.g. FC Renewal 2026" className="dm-input text-xs" />
              </div>
              <div>
                <label htmlFor="vv-exp" className="dm-label">Expiry Date</label>
                <input id="vv-exp" type="date" value={vaultDocExpiry} onChange={(e) => setVaultDocExpiry(e.target.value)} className="dm-input text-xs tabular-nums" />
              </div>
              <div>
                <label className="btn-primary text-xs w-full cursor-pointer justify-center">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingDoc ? 'Uploading…' : 'Upload File'}
                  <input type="file" accept=".pdf,image/*" disabled={uploadingDoc} onChange={handleVaultUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicleDocs.map((doc) => {
                  const tier = doc.expiryDate ? classifyComplianceExpiryTier(doc.expiryDate, nowTick) : null
                  return (
                    <tr key={doc.id}>
                      <td>
                        <p className="font-semibold text-[#625346]">{doc.title}</p>
                        <p className="text-[11px] text-[#958777]">{doc.fileName}</p>
                      </td>
                      <td className="text-xs">{doc.category}</td>
                      <td>
                        {tier ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${tierBadgeStyle(tier.tier)}`}>
                            {tier.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td>
                        <SeverityText
                          severity={doc.verificationStatus === 'verified' ? 'normal' : doc.verificationStatus === 'rejected' ? 'critical' : 'high'}
                          label={doc.verificationStatus.replace(/_/g, ' ')}
                        />
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          {doc.storageKey && !doc.storageKey.startsWith('seed/') && (
                            <a href={`/api/fleet/documents/${doc.id}/download`} className="btn-secondary text-[11px] px-2.5 py-1">
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                          )}
                          {canVerifyDocs && doc.verificationStatus !== 'verified' && (
                            <button
                              type="button"
                              onClick={() => {
                                verifyVaultDocument(doc.id, 'verified')
                                toast.success(`Verified ${doc.title}`)
                              }}
                              className="btn-primary text-[11px] px-2.5 py-1"
                            >
                              <FileCheck2 className="w-3 h-3" />
                              Verify
                            </button>
                          )}
                          {canVerifyDocs && doc.verificationStatus !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => {
                                verifyVaultDocument(doc.id, 'rejected', 'Needs clear scan')
                                toast.info(`Marked ${doc.title} rejected`)
                              }}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {vehicleDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-xs text-[#958777] py-6">
                      No vehicle compliance documents uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === '5-Area Health & Tyres' && fiveAreaHealth && (
        <div className="space-y-6">
          {/* 5 Core Health Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { name: 'Fuel Health', data: fiveAreaHealth.fuelHealth },
              { name: 'Engine Health', data: fiveAreaHealth.engineHealth },
              { name: 'Tyre Health', data: fiveAreaHealth.tyreHealth },
              { name: 'Driver Health', data: fiveAreaHealth.driverHealth, note: 'Safety & compliance only' },
              { name: 'Vehicle Health', data: fiveAreaHealth.vehicleHealth },
            ].map((area) => (
              <div key={area.name} className="enterprise-card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-xs text-[#625346]">{area.name}</h3>
                  <SeverityText
                    severity={area.data.status === 'insufficient_data' ? 'moderate' : area.data.status}
                    label={area.data.status === 'insufficient_data' ? 'Insufficient Data' : area.data.status}
                  />
                </div>
                <p className="text-2xl font-bold text-[#625346] tabular-nums">
                  {area.data.status === 'insufficient_data' ? '—' : `${area.data.score}%`}
                </p>
                <p className="text-[11px] text-[#958777] leading-snug">{area.data.detail}</p>
                {area.note && <p className="text-[10px] font-semibold text-[#6E5696]">{area.note}</p>}
              </div>
            ))}
          </div>

          {/* Multi-Axle Tyre Position Map */}
          <div className="enterprise-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <h2 className="dm-card-title text-base">Multi-Axle Tyre Map ({vehicleTyres.length} tracked positions)</h2>
                <p className="text-xs text-[#958777]">Track tread depth (mm) and replacement status per wheel position</p>
              </div>
            </div>
            {vehicleTyres.length === 0 ? (
              <p className="text-xs text-[#958777] py-4">No wheel-level tyre positions logged for this asset yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicleTyres.map((tyre) => (
                  <div key={tyre.id} className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-[#625346]">{tyre.position}</span>
                      <SeverityText
                        severity={tyre.status === 'replace_soon' ? 'critical' : tyre.status === 'wear_watch' ? 'high' : 'normal'}
                        label={tyre.status.replace('_', ' ')}
                      />
                    </div>
                    <p className="text-[#958777]">{tyre.brand} · Serial {tyre.serialNumber}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[#625346] font-semibold tabular-nums">Tread: {tyre.treadDepthMm} mm</span>
                      {canEdit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const nextTread = Math.max(1.5, Number((tyre.treadDepthMm - 0.5).toFixed(1)))
                              const nextStatus: TyrePositionRecord['status'] =
                                nextTread <= 3.0 ? 'replace_soon' : nextTread <= 5.5 ? 'wear_watch' : 'healthy'
                              updateTyrePosition(tyre.id, { treadDepthMm: nextTread, status: nextStatus })
                            }}
                            className="px-2 py-0.5 rounded border border-[#E5E5E5] bg-[#FFFFFF] text-[11px] font-semibold hover:bg-[#EEE8F7]"
                          >
                            -0.5mm
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateTyrePosition(tyre.id, {
                                treadDepthMm: 12.0,
                                status: 'healthy',
                                installedAtOdometerKm: vehicle.odometerKm,
                                lastInspectedAt: new Date().toISOString().slice(0, 10),
                              })
                              toast.success(`Replaced tyre at ${tyre.position}`)
                            }}
                            className="px-2 py-0.5 rounded border border-[#DDD3ED] bg-[#EEE8F7] text-[#6E5696] text-[11px] font-semibold"
                          >
                            New Tyre
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Work Orders & Issues' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 enterprise-card p-5 space-y-4">
            <h2 className="dm-card-title text-sm">Log Small Issue ({vehicleIssues.length})</h2>
            {canManageWo && (
              <form onSubmit={handleCreateSmallIssue} className="space-y-3 text-xs border-b border-[#E5E5E5] pb-4">
                <input
                  required
                  value={issueTitle}
                  onChange={(e) => setIssueTitle(e.target.value)}
                  placeholder="Issue summary (e.g. Rear left brake air leak)"
                  className="dm-input"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select value={issueArea} onChange={(e) => setIssueArea(e.target.value as FiveAreaHealthCategory)} className="dm-input">
                    {(['Fuel Health', 'Engine Health', 'Tyre Health', 'Driver Health', 'Vehicle Health'] as FiveAreaHealthCategory[]).map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <select value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value as typeof issueSeverity)} className="dm-input">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <textarea
                  rows={2}
                  value={issueDesc}
                  onChange={(e) => setIssueDesc(e.target.value)}
                  placeholder="Workshop inspection notes..."
                  className="dm-input"
                />
                <button type="submit" className="btn-primary text-xs w-full">
                  <Plus className="w-3.5 h-3.5" />
                  Log Issue
                </button>
              </form>
            )}
            <div className="space-y-2.5">
              {vehicleIssues.map((iss) => (
                <div key={iss.id} className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#625346]">{iss.title}</span>
                    <SeverityText severity={iss.severity === 'critical' ? 'critical' : iss.severity === 'high' ? 'high' : 'moderate'} label={iss.status.replace(/_/g, ' ')} />
                  </div>
                  <p className="text-[#958777]">{iss.healthArea} · {iss.description}</p>
                  {canManageWo && iss.status !== 'converted_to_wo' && iss.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => {
                        const wo = convertIssueToWorkOrder(iss.id)
                        if (wo) toast.success(`Created Work Order ${wo.workOrderNumber}`)
                      }}
                      className="btn-accent text-[11px] px-2.5 py-1"
                    >
                      <Wrench className="w-3 h-3 text-[#6E5696]" />
                      Convert to Work Order
                    </button>
                  )}
                </div>
              ))}
              {vehicleIssues.length === 0 && <p className="text-xs text-[#958777]">No small issues logged.</p>}
            </div>
          </div>

          <div className="lg:col-span-7 enterprise-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="dm-card-title text-sm">Vehicle Work Orders ({vehicleWos.length})</h2>
              <button type="button" onClick={() => navigate('/dashboard/work-orders')} className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1">
                Open Work Orders Module
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {vehicleWos.map((wo) => (
                <div key={wo.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#625346]">{wo.workOrderNumber} · {wo.title}</p>
                    <p className="text-[#958777]">{wo.workshopName} · {wo.healthArea}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#625346] tabular-nums">{formatInr(wo.totalCostInr)}</p>
                    <SeverityText severity={wo.status === 'completed' || wo.status === 'closed' ? 'normal' : 'high'} label={wo.status.replace('_', ' ')} />
                  </div>
                </div>
              ))}
              {vehicleWos.length === 0 && <p className="text-xs text-[#958777] py-4">No work orders created for this vehicle yet.</p>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Service & Bills' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr><th>Service Type</th><th>Component</th><th>Workshop</th><th>Date</th><th>Cost</th><th>Status / Payment</th></tr>
            </thead>
            <tbody>
              {vehicleMaint.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold">{m.serviceType}</td>
                  <td>{m.componentName}</td>
                  <td className="text-[#958777]">{m.serviceCenter}</td>
                  <td className="tabular-nums text-xs">{formatShortDate(m.performedAt)}</td>
                  <td className="tabular-nums">{formatInr(m.costInr)}</td>
                  <td>
                    <SeverityText
                      severity={m.status === 'completed' ? 'normal' : 'high'}
                      label={`${m.status} · ${(m.paymentState ?? 'recorded').toUpperCase()}`}
                    />
                  </td>
                </tr>
              ))}
              {vehicleMaint.length === 0 && (
                <tr><td colSpan={6} className="text-center text-[#958777] py-8">No maintenance records logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Trips' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr><th>Origin → Destination</th><th>Start Time</th><th>Distance</th><th>Avg / Max Speed</th><th>Status</th></tr>
            </thead>
            <tbody>
              {vehicleTrips.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.originAddress} → {t.destinationAddress}</td>
                  <td className="tabular-nums text-xs">{formatDateTime(t.startTime, activeOrganization.timezone)}</td>
                  <td className="tabular-nums">{t.distanceKm} km</td>
                  <td className="tabular-nums">{t.avgSpeedKmh} / {t.maxSpeedKmh} km/h</td>
                  <td><SeverityText severity={t.status === 'delayed' ? 'high' : t.status === 'completed' ? 'normal' : 'moderate'} label={t.status} /></td>
                </tr>
              ))}
              {vehicleTrips.length === 0 && (
                <tr><td colSpan={5} className="text-center text-[#958777] py-8">No trips logged for this vehicle.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Fuel' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr><th>Station</th><th>Quantity</th><th>Amount</th><th>Odometer</th><th>Source</th><th>Status</th></tr>
            </thead>
            <tbody>
              {vehicleFuel.map((f) => (
                <tr key={f.id}>
                  <td className="font-medium">{f.station}</td>
                  <td className="tabular-nums">{f.litersOrKwh} {vehicle.powertrain === 'EV' ? 'kWh' : 'L'}</td>
                  <td className="tabular-nums font-semibold">{formatInr(f.amountInr)}</td>
                  <td className="tabular-nums">{f.odometerKm.toLocaleString('en-IN')} km</td>
                  <td className="text-xs text-[#958777]">{f.entrySource.replace(/_/g, ' ')}</td>
                  <td><SeverityText severity={f.verificationStatus === 'needs_review' ? 'high' : 'normal'} label={f.verificationStatus.replace('_', ' ')} /></td>
                </tr>
              ))}
              {vehicleFuel.length === 0 && (
                <tr><td colSpan={6} className="text-center text-[#958777] py-8">No fuel or charging transactions logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Financials' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#958777]">Recorded Fuel / Energy</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{formatInr(totalFuelSpend)}</p>
          </div>
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#958777]">Recorded Maintenance</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{formatInr(totalMaintSpend)}</p>
          </div>
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#958777]">Logged Trip Distance</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{totalLoggedKm.toFixed(1)} km</p>
          </div>
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#958777]">Monthly Revenue Baseline</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{formatInr(vehicle.monthlyRevenueInr)}</p>
          </div>
        </div>
      )}

      {activeTab === 'Driver History' && (
        <div className="enterprise-card p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[#625346]">
              Current Driver: {assignedDriver ? `${assignedDriver.name} (Safety Score ${assignedDriver.safetyScore}/100)` : 'Unassigned'}
            </p>
            {assignedDriver && (
              <button type="button" onClick={() => navigate(`/dashboard/drivers/${assignedDriver.id}`)} className="btn-accent text-xs px-3 py-1.5">
                Open Driver Master
              </button>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[#625346]">Assignment Timeline ({vehicleAssignments.length})</h3>
            {vehicleAssignments.map((a) => {
              const drv = drivers.find((d) => d.id === a.driverId)
              return (
                <div key={a.id} className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] text-xs flex items-center justify-between gap-2">
                  <span><strong>{drv?.name ?? a.driverId}</strong> · {formatShortDate(a.assignedAt)} → {a.unassignedAt ? formatShortDate(a.unassignedAt) : 'Active'}</span>
                  <span className="text-[#958777]">{a.assignedBy}</span>
                </div>
              )
            })}
          </div>
          <div className="divide-y divide-[#E5E5E5]/70">
            {vehicleEvents.map((ev) => (
              <div key={ev.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#625346] capitalize">{ev.eventType.replace('_', ' ')} · {ev.locationLabel}</p>
                  <p className="text-[#958777]">Speed {ev.speedKmh} km/h · GPS ±{ev.gpsAccuracyMeters}m · {formatDateTime(ev.timestamp)}</p>
                </div>
                <SeverityText severity={ev.disputeStatus === 'accepted_dismissed' ? 'normal' : ev.severity === 'high' ? 'high' : 'moderate'} label={ev.disputeStatus === 'none' ? ev.severity : ev.disputeStatus} />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Activity History' && (
        <div className="enterprise-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="dm-card-title text-sm">Predictions, Inspections & Audit Events</h2>
            {canScheduleMaint && vehiclePredictions.some((p) => p.status === 'open' && !p.insufficientData) && (
              <button
                type="button"
                onClick={() => {
                  const top = vehiclePredictions.find((p) => p.status === 'open' && !p.insufficientData)
                  if (!top) return
                  scheduleMaintenance({
                    vehicleId: vehicle.id,
                    serviceType: `${top.componentName} Preventive Service`,
                    componentName: top.componentName,
                    serviceCenter: `${vehicle.cityName} Authorized Fleet Bay`,
                    description: top.recommendedAction,
                    costInr: top.repairCostInr,
                    performedAt: new Date(Date.now() + 2 * 86400000).toISOString(),
                    linkedPredictionId: top.id,
                  })
                  toast.success(`Scheduled preventive service for ${vehicle.registrationNumber}`)
                }}
                className="btn-accent text-xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                Schedule Top Preventive Item
              </button>
            )}
          </div>
          <div className="divide-y divide-[#E5E5E5]/70">
            {vehicleInspections.map((ins) => (
              <div key={ins.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#625346]">
                    Pre-trip Inspection · Tyres: {ins.tyreCondition} · Brakes: {ins.brakeFeel}
                  </p>
                  <p className="text-[#958777]">{ins.notes || 'No issues reported'} · {formatDateTime(ins.timestamp)}</p>
                </div>
                <SeverityText severity={ins.passed ? 'normal' : 'high'} label={ins.passed ? 'Passed' : 'Flags Reported'} />
              </div>
            ))}
            {vehicleLogs.map((l) => (
              <div key={l.id} className="py-3 text-xs">
                <p className="font-semibold text-[#625346]">{l.summary}</p>
                <p className="text-[#958777]">{l.actorName} · {formatDateTime(l.timestamp)}</p>
              </div>
            ))}
            {vehicleInspections.length === 0 && vehicleLogs.length === 0 && (
              <p className="text-xs text-[#958777]">No inspection or audit logs recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Quick Edit Modal */}
      <EnterpriseModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Vehicle & Compliance Dates · ${vehicle.registrationNumber}`}
      >
        <form onSubmit={handleSaveBasicModal} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-make" className="dm-label">Manufacturer</label>
              <input id="edit-make" required value={editForm.make} onChange={(e) => setEditForm((f) => ({ ...f, make: e.target.value }))} className="dm-input" />
            </div>
            <div>
              <label htmlFor="edit-model" className="dm-label">Model</label>
              <input id="edit-model" required value={editForm.model} onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))} className="dm-input" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-year" className="dm-label">Model Year</label>
              <input id="edit-year" type="number" value={editForm.year} onChange={(e) => setEditForm((f) => ({ ...f, year: Number(e.target.value) }))} className="dm-input font-mono" />
            </div>
            <div>
              <label htmlFor="edit-odo" className="dm-label">Odometer (km)</label>
              <input id="edit-odo" type="number" value={editForm.odometerKm} onChange={(e) => setEditForm((f) => ({ ...f, odometerKm: Number(e.target.value) }))} className="dm-input font-mono" />
            </div>
            <div>
              <label htmlFor="edit-daily" className="dm-label">Avg Daily km</label>
              <input id="edit-daily" type="number" value={editForm.dailyAvgKm} onChange={(e) => setEditForm((f) => ({ ...f, dailyAvgKm: Number(e.target.value) }))} className="dm-input font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-ins-exp" className="dm-label">Insurance Expiry</label>
              <input id="edit-ins-exp" type="date" value={editForm.insuranceExpiry} onChange={(e) => setEditForm((f) => ({ ...f, insuranceExpiry: e.target.value }))} className="dm-input font-mono" />
            </div>
            <div>
              <label htmlFor="edit-fc-exp" className="dm-label">Fitness (FC) Expiry</label>
              <input id="edit-fc-exp" type="date" value={editForm.fitnessExpiry} onChange={(e) => setEditForm((f) => ({ ...f, fitnessExpiry: e.target.value }))} className="dm-input font-mono" />
            </div>
            <div>
              <label htmlFor="edit-puc-exp" className="dm-label">PUC Expiry</label>
              <input id="edit-puc-exp" type="date" value={editForm.pucExpiry} onChange={(e) => setEditForm((f) => ({ ...f, pucExpiry: e.target.value }))} className="dm-input font-mono" />
            </div>
            <div>
              <label htmlFor="edit-perm-exp" className="dm-label">Permit Expiry</label>
              <input id="edit-perm-exp" type="date" value={editForm.permitExpiry} onChange={(e) => setEditForm((f) => ({ ...f, permitExpiry: e.target.value }))} className="dm-input font-mono" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
            <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-accent">Save Specifications</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
