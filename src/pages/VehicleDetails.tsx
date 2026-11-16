import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit3, Info, Trash2, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { classifyTelemetryFreshness, TELEMETRY_SCOPE_DISCLOSURE } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  EnterpriseModal,
  formatDateTime,
  formatInr,
  formatShortDate,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'

const TABS = [
  'Overview',
  'Telemetry',
  'Trips',
  'Driver History',
  'Components',
  'Maintenance',
  'Fuel',
  'Financials',
  'Predictions',
  'Activity History',
] as const

type DigitalTwinTab = (typeof TABS)[number]

export default function VehicleDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    archivedVehicles,
    drivers,
    driverEvents,
    trips,
    fuelTransactions,
    maintenanceRecords,
    predictions,
    inspections,
    auditLogs,
    corridors,
    assignDriverToVehicle,
    decommissionVehicle,
    updateVehicle,
    scheduleMaintenance,
  } = useFleet()

  const [activeTab, setActiveTab] = useState<DigitalTwinTab>('Overview')
  const [editOpen, setEditOpen] = useState(false)

  const vehicle = vehicles.find((v) => v.id === id) ?? archivedVehicles.find((v) => v.id === id)

  const [editForm, setEditForm] = useState({
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ?? 2024,
    odometerKm: vehicle?.odometerKm ?? 0,
    dailyAvgKm: vehicle?.dailyAvgKm ?? 140,
    corridorId: vehicle?.corridorId ?? corridors[0]?.id ?? 'cor-chennai',
    insuranceProvider: vehicle?.insuranceProvider ?? '',
    insuranceExpiry: vehicle?.insuranceExpiry ?? '',
  })

  if (!vehicle) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/dashboard/fleet')} className="btn-secondary text-xs">
          <ArrowLeft className="w-4 h-4" />
          Back to Fleet
        </button>
        <EmptySectionState
          title="Vehicle record not found in active organization"
          description="The requested vehicle may belong to another organization or environment."
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

  const assignedDriver = drivers.find((d) => d.id === vehicle.assignedDriverId)
  const freshness = classifyTelemetryFreshness(vehicle.telemetry.lastUpdatedAt, vehicle.telemetry.connectionState)
  const vehicleTrips = trips.filter((t) => t.vehicleId === vehicle.id)
  const vehicleFuel = fuelTransactions.filter((f) => f.vehicleId === vehicle.id)
  const vehicleMaint = maintenanceRecords.filter((m) => m.vehicleId === vehicle.id)
  const vehiclePredictions = predictions.filter((p) => p.vehicleId === vehicle.id)
  const vehicleEvents = driverEvents.filter((e) => e.vehicleId === vehicle.id)
  const vehicleInspections = inspections.filter((i) => i.vehicleId === vehicle.id)
  const vehicleLogs = auditLogs.filter((l) => l.entityId === vehicle.id)

  const totalFuelSpend = vehicleFuel.reduce((s, f) => s + f.amountInr, 0)
  const totalMaintSpend = vehicleMaint.reduce((s, m) => s + m.costInr, 0)
  const totalLoggedKm = vehicleTrips.reduce((s, t) => s + t.distanceKm, 0)

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
    })
    setEditOpen(true)
  }

  const handleSaveSpecs = (e: React.FormEvent) => {
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
      })
      toast.success(`Updated specifications for ${vehicle.registrationNumber}`)
      setEditOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update vehicle specifications.')
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
            className="text-xs font-semibold text-[#7D6D5F] hover:text-[#625346] inline-flex items-center gap-1.5 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All Fleet Assets
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="dm-page-title tabular-nums">{vehicle.registrationNumber}</h1>
            <SeverityText severity={vehicle.healthScore <= 49 ? 'critical' : vehicle.healthScore <= 74 ? 'at-risk' : 'healthy'} />
            <SeverityText severity={freshness.freshness} label={freshness.label} />
            {vehicle.decommissioned && <SeverityText severity="moderate" label="Archived" />}
          </div>
          <p className="text-sm text-[#7D6D5F] mt-1">
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
                {drivers.filter((d) => d.status !== 'onboarding').map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          {canEdit && (
            <button type="button" onClick={handleOpenEdit} className="btn-secondary text-xs">
              <Edit3 className="w-3.5 h-3.5" />
              Edit Specifications
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

      {/* 10 Digital Twin Tabs */}
      <div className="border-b border-[#E0D4B7] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max" role="tablist" aria-label="Vehicle Digital Twin Sections">
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
                  : 'border-transparent text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="enterprise-card p-5 space-y-3">
            <h2 className="dm-card-title text-sm">Registration & Compliance</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Registration No.</dt><dd className="tabular-nums font-semibold">{vehicle.registrationNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">RC Expiry</dt><dd className="tabular-nums">{formatShortDate(vehicle.registrationExpiry)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Insurance Provider</dt><dd className="font-medium">{vehicle.insuranceProvider}</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Insurance Expiry</dt><dd className="tabular-nums">{formatShortDate(vehicle.insuranceExpiry)}</dd></div>
            </dl>
          </div>
          <div className="enterprise-card p-5 space-y-3">
            <h2 className="dm-card-title text-sm">Utilization & Service</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Odometer</dt><dd className="tabular-nums font-semibold">{vehicle.odometerKm.toLocaleString('en-IN')} km</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Daily Avg Usage</dt><dd className="tabular-nums">{vehicle.dailyAvgKm} km/day</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Last Service Date</dt><dd className="tabular-nums">{formatShortDate(vehicle.lastServiceDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Next Service Due</dt><dd className="tabular-nums">{formatShortDate(vehicle.nextServiceDueDate)}</dd></div>
            </dl>
          </div>
          <div className="enterprise-card p-5 space-y-3">
            <h2 className="dm-card-title text-sm">Assignment & Health</h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Assigned Driver</dt><dd className="font-semibold">{assignedDriver?.name ?? 'Unassigned'}</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Corridor Base</dt><dd>{vehicle.cityName}</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">{vehicle.powertrain === 'EV' ? 'Battery SOC' : 'Fuel Level'}</dt><dd className="tabular-nums">{vehicle.fuelOrSocPct}%</dd></div>
              <div className="flex justify-between"><dt className="text-[#7D6D5F]">Composite Health</dt><dd className="tabular-nums font-bold">{vehicle.healthScore}%</dd></div>
            </dl>
          </div>
        </div>
      )}

      {activeTab === 'Telemetry' && (
        <div className="enterprise-card p-6 space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-[10px] bg-[#EEE8F7] border border-[#D4C7E6] text-xs text-[#625346]">
            <Info className="w-4 h-4 text-[#6E5696] shrink-0 mt-0.5" />
            <p>{TELEMETRY_SCOPE_DISCLOSURE}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px]">
              <span className="text-[#7D6D5F] block">Telemetry Freshness</span>
              <div className="mt-1.5"><SeverityText severity={freshness.freshness} label={freshness.label} /></div>
            </div>
            <div className="p-4 bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px]">
              <span className="text-[#7D6D5F] block">GPS Accuracy</span>
              <span className="tabular-nums text-base font-bold text-[#625346] mt-1 block">±{vehicle.telemetry.gpsAccuracyMeters} m</span>
            </div>
            <div className="p-4 bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px]">
              <span className="text-[#7D6D5F] block">Signal Quality</span>
              <span className="tabular-nums text-base font-bold text-[#625346] mt-1 block">{vehicle.telemetry.signalQualityPct}%</span>
            </div>
            <div className="p-4 bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px]">
              <span className="text-[#7D6D5F] block">Motion Permission</span>
              <span className="font-semibold text-[#625346] mt-1 block">
                {vehicle.telemetry.motionPermissionGranted ? 'Granted' : 'Missing / Restricted'}
              </span>
            </div>
          </div>
          <p className="text-xs text-[#7D6D5F] tabular-nums">
            Last coordinates: {vehicle.telemetry.location.lat.toFixed(4)}, {vehicle.telemetry.location.lng.toFixed(4)} ({vehicle.telemetry.cityLabel}) · Updated {formatDateTime(vehicle.telemetry.lastUpdatedAt, activeOrganization.timezone)}
          </p>
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
                <tr><td colSpan={5} className="text-center text-[#7D6D5F] py-8">No trips logged for this vehicle.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Driver History' && (
        <div className="enterprise-card p-5 space-y-4">
          <p className="text-sm font-semibold text-[#625346]">
            Current Driver: {assignedDriver ? `${assignedDriver.name} (Safety Score ${assignedDriver.safetyScore}/100)` : 'Unassigned'}
          </p>
          <div className="divide-y divide-[#E0D4B7]/70">
            {vehicleEvents.map((ev) => (
              <div key={ev.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#625346] capitalize">{ev.eventType.replace('_', ' ')} · {ev.locationLabel}</p>
                  <p className="text-[#7D6D5F]">Speed {ev.speedKmh} km/h · GPS ±{ev.gpsAccuracyMeters}m · {formatDateTime(ev.timestamp)}</p>
                </div>
                <SeverityText severity={ev.disputeStatus === 'accepted_dismissed' ? 'normal' : ev.severity === 'high' ? 'high' : 'moderate'} label={ev.disputeStatus === 'none' ? ev.severity : ev.disputeStatus} />
              </div>
            ))}
            {vehicleEvents.length === 0 && <p className="text-xs text-[#7D6D5F]">No driving behavior events recorded.</p>}
          </div>
        </div>
      )}

      {activeTab === 'Components' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicle.components.map((comp) => (
            <div key={comp.id} className="enterprise-card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[#625346]">{comp.componentName}</h3>
                <SeverityText severity={comp.status} />
              </div>
              <p className="text-2xl font-bold text-[#625346] tabular-nums">{comp.healthScore}%</p>
              <div className="w-full h-1.5 bg-[#E0D4B7] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${comp.healthScore <= 45 ? 'bg-[#D9786C]' : comp.healthScore <= 72 ? 'bg-[#E8C65A]' : 'bg-[#789A75]'}`}
                  style={{ width: `${comp.healthScore}%` }}
                />
              </div>
              <p className="text-xs text-[#7D6D5F]">{comp.notes}</p>
              <p className="text-[11px] tabular-nums text-[#7D6D5F]">
                Wear {comp.wearRatePer1000Km}/1000km · Last serviced {comp.lastServicedAt}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Maintenance' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr><th>Service Type</th><th>Component</th><th>Workshop</th><th>Date</th><th>Cost</th><th>Status</th></tr>
            </thead>
            <tbody>
              {vehicleMaint.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold">{m.serviceType}</td>
                  <td>{m.componentName}</td>
                  <td className="text-[#7D6D5F]">{m.serviceCenter}</td>
                  <td className="tabular-nums text-xs">{formatShortDate(m.performedAt)}</td>
                  <td className="tabular-nums">{formatInr(m.costInr)}</td>
                  <td><SeverityText severity={m.status === 'completed' ? 'normal' : 'high'} label={m.status} /></td>
                </tr>
              ))}
              {vehicleMaint.length === 0 && (
                <tr><td colSpan={6} className="text-center text-[#7D6D5F] py-8">No maintenance records logged yet.</td></tr>
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
                  <td className="text-xs text-[#7D6D5F]">{f.entrySource.replace(/_/g, ' ')}</td>
                  <td><SeverityText severity={f.verificationStatus === 'needs_review' ? 'high' : 'normal'} label={f.verificationStatus.replace('_', ' ')} /></td>
                </tr>
              ))}
              {vehicleFuel.length === 0 && (
                <tr><td colSpan={6} className="text-center text-[#7D6D5F] py-8">No fuel or charging transactions logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Financials' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#7D6D5F]">Recorded Fuel / Energy</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{formatInr(totalFuelSpend)}</p>
          </div>
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#7D6D5F]">Recorded Maintenance</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{formatInr(totalMaintSpend)}</p>
          </div>
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#7D6D5F]">Logged Trip Distance</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{totalLoggedKm.toFixed(1)} km</p>
          </div>
          <div className="enterprise-card p-5">
            <span className="text-xs text-[#7D6D5F]">Monthly Revenue Baseline</span>
            <p className="text-xl font-bold text-[#625346] tabular-nums mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#789A75]" />
              {formatInr(vehicle.monthlyRevenueInr)}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'Predictions' && (
        <div className="space-y-4">
          {vehiclePredictions.map((pred) => (
            <div key={pred.id} className="enterprise-card p-5 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  {pred.insufficientData ? (
                    <SeverityText severity="moderate" label="Insufficient Data" />
                  ) : (
                    <>
                      <SeverityText severity={pred.priority} />
                      <span className="text-xs text-[#7D6D5F] tabular-nums">
                        {pred.earliestWindowDays}–{pred.latestWindowDays}d window · {Math.round(pred.confidenceScore * 100)}% conf.
                      </span>
                    </>
                  )}
                </div>
                <h3 className="font-bold text-base text-[#625346]">
                  {pred.componentName}: {pred.predictedIssue}
                </h3>
                <p className="text-xs text-[#7D6D5F]">{pred.evidenceSummary}</p>
                <p className="text-xs text-[#625346] font-medium">Action: {pred.recommendedAction}</p>
              </div>
              <div className="text-right space-y-2">
                {!pred.insufficientData && (
                  <p className="text-xs text-[#7D6D5F]">
                    Preventive {formatInr(pred.repairCostInr)} vs Delay {formatInr(pred.delayCostInr)}
                  </p>
                )}
                {pred.insufficientData ? (
                  <SeverityText severity="moderate" label="Baseline Required" />
                ) : pred.status === 'open' && canScheduleMaint ? (
                  <button
                    type="button"
                    onClick={() => {
                      scheduleMaintenance({
                        vehicleId: vehicle.id,
                        serviceType: `${pred.componentName} Preventive Service`,
                        componentName: pred.componentName,
                        serviceCenter: `${vehicle.cityName} Authorized Fleet Bay`,
                        description: pred.recommendedAction,
                        costInr: pred.repairCostInr,
                        performedAt: new Date(Date.now() + 2 * 86400000).toISOString(),
                        linkedPredictionId: pred.id,
                      })
                      toast.success(`Scheduled ${pred.componentName} service for ${vehicle.registrationNumber}`)
                    }}
                    className="btn-accent text-xs"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Schedule Service
                  </button>
                ) : (
                  <SeverityText severity="normal" label={pred.status} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Activity History' && (
        <div className="enterprise-card p-5 space-y-4">
          <h2 className="dm-card-title text-sm">Inspections & Audit Events</h2>
          <div className="divide-y divide-[#E0D4B7]/70">
            {vehicleInspections.map((ins) => (
              <div key={ins.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-[#625346]">
                    Pre-trip Inspection · Tyres: {ins.tyreCondition} · Brakes: {ins.brakeFeel}
                  </p>
                  <p className="text-[#7D6D5F]">{ins.notes || 'No issues reported'} · {formatDateTime(ins.timestamp)}</p>
                </div>
                <SeverityText severity={ins.passed ? 'normal' : 'high'} label={ins.passed ? 'Passed' : 'Flags Reported'} />
              </div>
            ))}
            {vehicleLogs.map((l) => (
              <div key={l.id} className="py-3 text-xs">
                <p className="font-semibold text-[#625346]">{l.summary}</p>
                <p className="text-[#7D6D5F]">{l.actorName} · {formatDateTime(l.timestamp)}</p>
              </div>
            ))}
            {vehicleInspections.length === 0 && vehicleLogs.length === 0 && (
              <p className="text-xs text-[#7D6D5F]">No inspection or audit logs recorded yet.</p>
            )}
          </div>
        </div>
      )}

      <EnterpriseModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Edit Specifications · ${vehicle.registrationNumber}`}
        subtitle="Updates vehicle digital twin parameters and recalculates predictive baselines"
      >
        <form onSubmit={handleSaveSpecs} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-make" className="dm-label">Manufacturer</label>
              <input
                id="edit-make"
                required
                value={editForm.make}
                onChange={(e) => setEditForm((f) => ({ ...f, make: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="edit-model" className="dm-label">Model</label>
              <input
                id="edit-model"
                required
                value={editForm.model}
                onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                className="dm-input"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="edit-year" className="dm-label">Model Year</label>
              <input
                id="edit-year"
                type="number"
                value={editForm.year}
                onChange={(e) => setEditForm((f) => ({ ...f, year: Number(e.target.value) }))}
                className="dm-input font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-odo" className="dm-label">Odometer (km)</label>
              <input
                id="edit-odo"
                type="number"
                value={editForm.odometerKm}
                onChange={(e) => setEditForm((f) => ({ ...f, odometerKm: Number(e.target.value) }))}
                className="dm-input font-mono"
              />
            </div>
            <div>
              <label htmlFor="edit-daily" className="dm-label">Avg Daily km</label>
              <input
                id="edit-daily"
                type="number"
                value={editForm.dailyAvgKm}
                onChange={(e) => setEditForm((f) => ({ ...f, dailyAvgKm: Number(e.target.value) }))}
                className="dm-input font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-corridor" className="dm-label">Corridor</label>
              <select
                id="edit-corridor"
                value={editForm.corridorId}
                onChange={(e) => setEditForm((f) => ({ ...f, corridorId: e.target.value }))}
                className="dm-input"
              >
                {corridors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="edit-ins-exp" className="dm-label">Insurance Expiry</label>
              <input
                id="edit-ins-exp"
                type="date"
                value={editForm.insuranceExpiry}
                onChange={(e) => setEditForm((f) => ({ ...f, insuranceExpiry: e.target.value }))}
                className="dm-input font-mono"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-[#E0D4B7]">
            <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-accent">Save Specifications</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
