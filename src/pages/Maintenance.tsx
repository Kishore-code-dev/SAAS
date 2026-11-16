import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Plus,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { INTELLIGENCE_MODEL_VERSION, TELEMETRY_SCOPE_DISCLOSURE } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  EnterpriseModal,
  formatDateTime,
  formatInr,
  formatShortDate,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import type { AIPrediction, ComponentCategory } from '../types/fleet'

export default function Maintenance() {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    predictions,
    maintenanceRecords,
    recalculatePredictions,
    scheduleMaintenance,
    completeMaintenance,
    resolvePrediction,
  } = useFleet()

  const [priorityFilter, setPriorityFilter] = useState<'all' | AIPrediction['priority']>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'resolved' | 'all'>('active')
  const [selectedPredId, setSelectedPredId] = useState<string | null>(predictions[0]?.id ?? null)
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [logForm, setLogForm] = useState({
    vehicleId: vehicles[0]?.id ?? '',
    serviceType: 'Scheduled Preventive Service',
    componentName: 'Brakes' as ComponentCategory | 'General Service',
    serviceCenter: 'Authorized Commercial Fleet Bay',
    description: 'Component inspection and preventive replacement',
    costInr: 4500,
    performedAt: new Date().toISOString().slice(0, 10),
  })

  const effectiveLogVehicleId = vehicles.some((v) => v.id === logForm.vehicleId)
    ? logForm.vehicleId
    : (vehicles[0]?.id ?? '')

  const canSchedule = canPerformAction(activeRole, 'schedule_maintenance')
  const canComplete = canPerformAction(activeRole, 'complete_maintenance')
  const canResolve = canPerformAction(activeRole, 'resolve_prediction')

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      const matchesPriority = priorityFilter === 'all' || p.priority === priorityFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? p.status !== 'resolved' : p.status === 'resolved')
      return matchesPriority && matchesStatus
    })
  }, [predictions, priorityFilter, statusFilter])

  const selectedPrediction = useMemo(
    () =>
      filteredPredictions.find((p) => p.id === selectedPredId) ??
      filteredPredictions[0] ??
      null,
    [filteredPredictions, selectedPredId],
  )

  const selectedVehicle = selectedPrediction
    ? vehicles.find((v) => v.id === selectedPrediction.vehicleId)
    : undefined

  const openHighOrCritical = predictions.filter(
    (p) => !p.insufficientData && p.status !== 'resolved' && (p.priority === 'critical' || p.priority === 'high'),
  )
  const totalEstimatedSavings = openHighOrCritical.reduce((s, p) => s + p.potentialSavingsInr, 0)

  const handleScheduleFromPrediction = (pred: AIPrediction) => {
    if (pred.insufficientData) {
      toast.error('Cannot schedule predictive overhaul without sufficient component telemetry.')
      return
    }
    const vehicle = vehicles.find((v) => v.id === pred.vehicleId)
    if (!vehicle) return
    try {
      scheduleMaintenance({
        vehicleId: vehicle.id,
        serviceType: `${pred.componentName} Preventive Overhaul`,
        componentName: pred.componentName,
        serviceCenter: `${vehicle.cityName} Commercial Service Bay`,
        description: pred.recommendedAction,
        costInr: pred.repairCostInr,
        performedAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        linkedPredictionId: pred.id,
      })
      toast.success(`Scheduled ${pred.componentName} service for ${vehicle.registrationNumber}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to schedule service.')
    }
  }

  const handleLogServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLogError(null)
    if (!effectiveLogVehicleId || !logForm.serviceCenter.trim()) {
      setLogError('Please select a vehicle and service center.')
      return
    }
    if (Number(logForm.costInr) < 0) {
      setLogError('Estimated service cost cannot be negative.')
      return
    }
    try {
      scheduleMaintenance({
        vehicleId: effectiveLogVehicleId,
        serviceType: logForm.serviceType,
        componentName: logForm.componentName,
        serviceCenter: logForm.serviceCenter,
        description: logForm.description,
        costInr: Number(logForm.costInr),
        performedAt: new Date(logForm.performedAt).toISOString(),
      })
      toast.success('Maintenance job scheduled in workshop ledger.')
      setLogModalOpen(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save service job.'
      setLogError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Predictive Maintenance Engine</h1>
          <p className="text-sm text-[#7D6D5F] mt-1">
            {activeOrganization.name} · Model {INTELLIGENCE_MODEL_VERSION} · 8 subsystem diagnostics
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canResolve && (
            <button
              type="button"
              onClick={() => {
                recalculatePredictions()
                toast.success('Recalculated fleet component wear predictions from latest inputs.')
              }}
              className="btn-secondary text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#6E5696]" />
              Recalculate Engine
            </button>
          )}
          {canSchedule && (
            <button
              type="button"
              onClick={() => {
                setLogError(null)
                setLogForm((f) => ({ ...f, vehicleId: vehicles[0]?.id ?? '' }))
                setLogModalOpen(true)
              }}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Schedule Maintenance
            </button>
          )}
        </div>
      </div>

      {/* Scope Disclosure */}
      <div className="lavender-surface p-4 flex items-start gap-3 text-xs text-[#625346]">
        <Info className="w-4 h-4 text-[#6E5696] shrink-0 mt-0.5" />
        <p>{TELEMETRY_SCOPE_DISCLOSURE}</p>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Critical Predictions</span>
          <p className="dm-kpi-value mt-1.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D9786C]" />
            {predictions.filter((p) => !p.insufficientData && p.status !== 'resolved' && p.priority === 'critical').length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">High Priority Windows</span>
          <p className="dm-kpi-value mt-1.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E8C65A]" />
            {predictions.filter((p) => !p.insufficientData && p.status !== 'resolved' && p.priority === 'high').length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Scheduled Workshop Jobs</span>
          <p className="dm-kpi-value mt-1.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8A3D9]" />
            {maintenanceRecords.filter((m) => m.status !== 'completed').length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#7D6D5F]">Est. Potential Savings (High/Crit)</span>
          <p className="dm-kpi-value mt-1.5 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#789A75]" />
            {formatInr(totalEstimatedSavings)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="enterprise-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#D4C7E6]">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                priorityFilter === p ? 'bg-[#FBF6E6] text-[#625346] shadow-subtle' : 'text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#D4C7E6]">
          {(['active', 'resolved', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === st ? 'bg-[#FBF6E6] text-[#625346] shadow-subtle' : 'text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {filteredPredictions.length === 0 ? (
        <EmptySectionState
          title="No predictive maintenance items match current filters"
          description="All monitored subsystems for this filter view are within healthy operating bounds."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Prediction Queue */}
          <div className="lg:col-span-5 enterprise-card divide-y divide-[#E0D4B7]/70 overflow-hidden">
            {filteredPredictions.map((pred) => {
              const vehicle = vehicles.find((v) => v.id === pred.vehicleId)
              const active = selectedPrediction?.id === pred.id
              return (
                <button
                  key={pred.id}
                  type="button"
                  onClick={() => setSelectedPredId(pred.id)}
                  className={`w-full p-4 text-left transition-colors hover:bg-[#FBF6E6] ${
                    active ? 'bg-[#EEE8F7]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SeverityText
                        severity={pred.insufficientData ? 'moderate' : pred.priority}
                        label={pred.insufficientData ? 'Insufficient Data' : undefined}
                      />
                      <span className="text-xs font-bold text-[#625346] tabular-nums">
                        {vehicle?.registrationNumber}
                      </span>
                    </div>
                    <span className="text-xs text-[#7D6D5F] tabular-nums">
                      {pred.insufficientData ? '—' : `${pred.earliestWindowDays}–${pred.latestWindowDays}d`}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[#625346] mt-1.5">
                    {pred.componentName} · {pred.predictedIssue}
                  </p>
                  {pred.insufficientData ? (
                    <p className="text-xs text-[#6E5696] font-medium mt-1.5">
                      Insufficient telemetry / service history — prediction suppressed
                    </p>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-[#7D6D5F] mt-1.5">
                      <span>Conf. {Math.round(pred.confidenceScore * 100)}%</span>
                      <span className="text-[#625346] font-semibold tabular-nums inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#789A75]" />
                        Est. save {formatInr(pred.potentialSavingsInr)}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Prediction Detail Inspector */}
          {selectedPrediction && selectedVehicle && (
            <div className="lg:col-span-7 enterprise-card p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E0D4B7]">
                <div>
                  <div className="flex items-center gap-2">
                    <SeverityText
                      severity={selectedPrediction.insufficientData ? 'moderate' : selectedPrediction.priority}
                      label={selectedPrediction.insufficientData ? 'Insufficient Data' : undefined}
                    />
                    <span className="text-xs text-[#7D6D5F] capitalize">
                      Status: {selectedPrediction.status}
                    </span>
                  </div>
                  <h2 className="dm-section-title mt-2">
                    {selectedPrediction.componentName} — {selectedPrediction.predictedIssue}
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/fleet/${selectedVehicle.id}`)}
                    className="text-xs font-semibold text-[#6E5696] hover:text-[#625346] hover:underline mt-1 tabular-nums"
                  >
                    {selectedVehicle.registrationNumber} · {selectedVehicle.make} {selectedVehicle.model}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {selectedPrediction.status === 'open' && !selectedPrediction.insufficientData && canSchedule && (
                    <button
                      type="button"
                      onClick={() => handleScheduleFromPrediction(selectedPrediction)}
                      className="btn-primary text-xs"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Schedule Service
                    </button>
                  )}
                  {selectedPrediction.status !== 'resolved' && canResolve && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          resolvePrediction(selectedPrediction.id)
                          toast.success('Prediction marked resolved.')
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Unable to resolve prediction.')
                        }
                      }}
                      className="btn-secondary text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A]" />
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {selectedPrediction.insufficientData ? (
                <div className="lavender-surface p-5 space-y-2 border-[#B8A3D9]">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#625346]">
                    <AlertCircle className="w-4 h-4 text-[#6E5696]" />
                    Insufficient data for a reliable prediction.
                  </div>
                  <p className="text-xs text-[#625346]">
                    {selectedPrediction.insufficientDataReason ??
                      'Record baseline odometer readings, service history, or reconnect smartphone telemetry before estimating failure windows.'}
                  </p>
                  <p className="text-xs text-[#7D6D5F]">
                    Recommended Action: {selectedPrediction.recommendedAction}
                  </p>
                </div>
              ) : (
                <>
                  {/* Financial Impact Comparison */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-3">
                      <span className="text-[11px] text-[#7D6D5F] block">Preventive Repair</span>
                      <span className="text-base font-bold text-[#625346] tabular-nums">
                        {formatInr(selectedPrediction.repairCostInr)}
                      </span>
                    </div>
                    <div className="bg-[#D9786C]/20 border border-[#D9786C] rounded-[10px] p-3">
                      <span className="text-[11px] text-[#625346] font-medium block">Cost of Delay</span>
                      <span className="text-base font-bold text-[#625346] tabular-nums">
                        {formatInr(selectedPrediction.delayCostInr)}
                      </span>
                    </div>
                    <div className="bg-[#789A75]/20 border border-[#789A75] rounded-[10px] p-3">
                      <span className="text-[11px] text-[#625346] font-medium block">Est. Net Savings</span>
                      <span className="text-base font-bold text-[#625346] tabular-nums">
                        {formatInr(selectedPrediction.potentialSavingsInr)}
                      </span>
                    </div>
                    <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-3">
                      <span className="text-[11px] text-[#7D6D5F] block">Downtime if Delayed</span>
                      <span className="text-base font-bold text-[#625346] tabular-nums">
                        {selectedPrediction.estimatedDowntimeDaysIfDelayed} days
                      </span>
                    </div>
                  </div>

                  {/* Confidence & Probability Windows */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4 space-y-2">
                      <p className="font-semibold text-[#625346]">Confidence & Horizon</p>
                      <p className="text-[#7D6D5F]">
                        Confidence: <strong className="text-[#625346] tabular-nums">{Math.round(selectedPrediction.confidenceScore * 100)}%</strong>{' '}
                        (Interval {Math.round(selectedPrediction.confidenceLower * 100)}%–{Math.round(selectedPrediction.confidenceUpper * 100)}%)
                      </p>
                      <p className="text-[#7D6D5F]">
                        Failure Window: <strong className="text-[#625346] tabular-nums">{selectedPrediction.earliestWindowDays}–{selectedPrediction.latestWindowDays} days</strong>{' '}
                        (Est. {formatShortDate(selectedPrediction.predictedFailureDate)})
                      </p>
                    </div>
                    <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4 space-y-2">
                      <p className="font-semibold text-[#625346]">Failure Probability Curve</p>
                      <div className="grid grid-cols-3 gap-2 tabular-nums text-[#625346]">
                        <div><span className="text-[#7D6D5F] block">7-Day</span><strong>{Math.round(selectedPrediction.failureProbability7d * 100)}%</strong></div>
                        <div><span className="text-[#7D6D5F] block">30-Day</span><strong>{Math.round(selectedPrediction.failureProbability30d * 100)}%</strong></div>
                        <div><span className="text-[#7D6D5F] block">90-Day</span><strong>{Math.round(selectedPrediction.failureProbability90d * 100)}%</strong></div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Contributing Factors */}
              <div>
                <h3 className="text-xs font-bold text-[#625346] mb-2.5">Contributing Factors & Evidence</h3>
                <p className="text-xs text-[#7D6D5F] mb-3">{selectedPrediction.evidenceSummary}</p>
                <div className="space-y-2.5">
                  {selectedPrediction.causalFactors.map((cf) => (
                    <div key={cf.factor} className="text-xs">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-[#625346]">{cf.label}</span>
                        <span className="font-semibold text-[#625346] tabular-nums">
                          {Math.round(cf.weight * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E0D4B7] rounded-full overflow-hidden">
                        <div className="h-full bg-[#B8A3D9] rounded-full" style={{ width: `${Math.round(cf.weight * 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-[#7D6D5F] mt-0.5">{cf.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendation & Model Metadata */}
              <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-4 space-y-2 text-xs">
                <p className="font-semibold text-[#625346]">Recommended Action</p>
                <p className="text-[#625346]/90">{selectedPrediction.recommendedAction}</p>
                <div className="pt-2 border-t border-[#E0D4B7] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#7D6D5F] tabular-nums">
                  <span>Model: {selectedPrediction.modelVersion}</span>
                  <span>Age: {selectedPrediction.inputFeatureSnapshot.vehicleAgeYears}y</span>
                  <span>Stress: {selectedPrediction.inputFeatureSnapshot.roadStressIndex.toFixed(2)}</span>
                  <span>Generated: {formatDateTime(selectedPrediction.generatedAt)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Workshop Maintenance Ledger */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 bg-[#FBF6E6] border-b border-[#E0D4B7] flex items-center justify-between">
          <div>
            <h2 className="dm-card-title">Workshop & Service Ledger</h2>
            <p className="text-xs text-[#7D6D5F]">Scheduled and completed service records update vehicle component health directly</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Service Type</th>
                <th>Component</th>
                <th>Workshop</th>
                <th>Date</th>
                <th>Cost</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceRecords.map((rec) => {
                const vehicle = vehicles.find((v) => v.id === rec.vehicleId)
                return (
                  <tr key={rec.id}>
                    <td className="font-semibold tabular-nums">{vehicle?.registrationNumber ?? rec.vehicleId}</td>
                    <td className="font-medium">{rec.serviceType}</td>
                    <td>{rec.componentName}</td>
                    <td className="text-[#7D6D5F]">{rec.serviceCenter}</td>
                    <td className="text-xs tabular-nums">{formatShortDate(rec.performedAt)}</td>
                    <td className="tabular-nums font-medium">{formatInr(rec.costInr)}</td>
                    <td>
                      <SeverityText severity={rec.status === 'completed' ? 'normal' : 'high'} label={rec.status.replace('_', ' ')} />
                    </td>
                    <td className="text-right">
                      {rec.status !== 'completed' ? (
                        canComplete ? (
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                completeMaintenance(rec.id)
                                toast.success('Service marked completed and component baseline restored.')
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Unable to complete service.')
                              }
                            }}
                            className="btn-secondary text-xs px-3 py-1"
                          >
                            Mark Completed
                          </button>
                        ) : (
                          <span className="text-xs text-[#7D6D5F]">Scheduled</span>
                        )
                      ) : (
                        <span className="text-xs text-[#7D6D5F]">Closed</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Maintenance Modal */}
      <EnterpriseModal
        open={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        title="Schedule Workshop Maintenance"
        subtitle="Creates a tracked maintenance record linked to the vehicle's Digital Twin"
      >
        <form onSubmit={handleLogServiceSubmit} className="space-y-4">
          {logError && (
            <div role="alert" className="p-3 rounded-[10px] bg-[#D9786C]/20 border border-[#D9786C] text-xs font-semibold text-[#625346]">
              {logError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="maint-veh" className="dm-label">Vehicle *</label>
              <select
                id="maint-veh"
                value={effectiveLogVehicleId}
                onChange={(e) => setLogForm((f) => ({ ...f, vehicleId: e.target.value }))}
                className="dm-input"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registrationNumber} · {v.model}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="maint-comp" className="dm-label">Component</label>
              <select
                id="maint-comp"
                value={logForm.componentName}
                onChange={(e) => setLogForm((f) => ({ ...f, componentName: e.target.value as ComponentCategory }))}
                className="dm-input"
              >
                {['Engine', 'Brakes', 'Tyres', 'Battery', 'Suspension', 'Transmission', 'Cooling System', 'EV Battery', 'General Service'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="maint-type" className="dm-label">Service Title *</label>
            <input
              id="maint-type"
              required
              value={logForm.serviceType}
              onChange={(e) => setLogForm((f) => ({ ...f, serviceType: e.target.value }))}
              className="dm-input"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="maint-center" className="dm-label">Service Center *</label>
              <input
                id="maint-center"
                required
                value={logForm.serviceCenter}
                onChange={(e) => setLogForm((f) => ({ ...f, serviceCenter: e.target.value }))}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="maint-cost" className="dm-label">Est. Cost (INR)</label>
              <input
                id="maint-cost"
                type="number"
                min={0}
                value={logForm.costInr}
                onChange={(e) => setLogForm((f) => ({ ...f, costInr: Number(e.target.value) }))}
                className="dm-input tabular-nums"
              />
            </div>
          </div>
          <div>
            <label htmlFor="maint-date" className="dm-label">Scheduled Date</label>
            <input
              id="maint-date"
              type="date"
              value={logForm.performedAt}
              onChange={(e) => setLogForm((f) => ({ ...f, performedAt: e.target.value }))}
              className="dm-input tabular-nums"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setLogModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Service Job</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

