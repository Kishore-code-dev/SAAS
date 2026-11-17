import React, { useMemo, useState } from 'react'
import { Check, Info, MessageSquareWarning, Plus, UserCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { evaluateDriverSafety } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  EnterpriseModal,
  formatDateTime,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'

export default function Drivers() {
  const {
    activeOrganization,
    activeRole,
    drivers,
    vehicles,
    trips,
    driverEvents,
    corridors,
    addDriver,
    approveOnboardingDriver,
    disputeDriverEvent,
    resolveDriverEventDispute,
    searchTerm,
  } = useFleet()

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(
    drivers.find((d) => d.status !== 'onboarding')?.id ?? drivers[0]?.id ?? null,
  )
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [disputeModalEventId, setDisputeModalEventId] = useState<string | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [newDriverForm, setNewDriverForm] = useState({
    name: '',
    mobile: '',
    email: '',
    licenseNumber: '',
    licenseExpiry: '2029-12-31',
  })

  const canAddDriver = canPerformAction(activeRole, 'add_driver')
  const canApproveDriver = canPerformAction(activeRole, 'approve_driver')
  const canDispute = canPerformAction(activeRole, 'dispute_driver_event')
  const canResolveDispute = canPerformAction(activeRole, 'resolve_driver_dispute')

  const onboardingQueue = drivers.filter((d) => d.status === 'onboarding')
  const activeRoster = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return drivers
      .filter((d) => d.status !== 'onboarding')
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.licenseNumber.toLowerCase().includes(q))
  }, [drivers, searchTerm])

  const selectedDriver = useMemo(
    () => activeRoster.find((d) => d.id === selectedDriverId) ?? activeRoster[0] ?? null,
    [activeRoster, selectedDriverId],
  )

  const selectedEvaluation = useMemo(() => {
    if (!selectedDriver) return null
    return evaluateDriverSafety({
      driver: selectedDriver,
      events: driverEvents,
      trips,
      corridors,
      vehicles,
    })
  }, [selectedDriver, driverEvents, trips, corridors, vehicles])

  const selectedDriverEvents = selectedDriver
    ? driverEvents.filter((e) => e.driverId === selectedDriver.id)
    : []

  const handleAddDriver = (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!newDriverForm.name.trim() || !newDriverForm.mobile.trim()) {
      setAddError('Driver name and mobile number are required.')
      return
    }
    try {
      const created = addDriver(newDriverForm)
      setSelectedDriverId(created.id)
      setAddModalOpen(false)
      setNewDriverForm({ name: '', mobile: '', email: '', licenseNumber: '', licenseExpiry: '2029-12-31' })
      toast.success(`Added ${created.name} to active driver roster.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to add driver.'
      setAddError(msg)
      toast.error(msg)
    }
  }

  const handleDisputeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!disputeModalEventId || !disputeReason.trim()) {
      toast.error('Please enter a factual explanation for the dispute.')
      return
    }
    try {
      disputeDriverEvent(disputeModalEventId, disputeReason.trim())
      setDisputeModalEventId(null)
      setDisputeReason('')
      toast.success('Dispute submitted for fleet safety review.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit dispute.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Driver Intelligence</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Explainable safety scoring with road-stress context and dispute resolution
          </p>
        </div>
        {canAddDriver && (
          <button
            type="button"
            onClick={() => {
              setAddError(null)
              setAddModalOpen(true)
            }}
            className="btn-primary text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        )}
      </div>

      {/* Onboarding Queue */}
      {onboardingQueue.length > 0 && (
        <div className="lavender-surface p-4 border-[#B8A3D9] flex flex-wrap items-center justify-between gap-4">
          {onboardingQueue.map((pending) => (
            <div key={pending.id} className="flex flex-wrap items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-[#6E5696] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[#625346]">
                    Onboarding Review: {pending.name}
                  </p>
                  <p className="text-xs text-[#958777] tabular-nums">
                    License {pending.licenseNumber} · {pending.mobile}
                  </p>
                </div>
              </div>
              {canApproveDriver && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      approveOnboardingDriver(pending.id, true)
                      toast.success(`Approved ${pending.name} into active roster.`)
                    }}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      approveOnboardingDriver(pending.id, false)
                      toast.info(`Declined onboarding for ${pending.name}.`)
                    }}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    Decline
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeRoster.length === 0 ? (
        <EmptySectionState
          title="No active drivers in this organization"
          description="Add commercial drivers to track corridor-adjusted safety scores, coaching, and trip assignments."
          actionLabel={canAddDriver ? 'Add Driver' : undefined}
          onAction={canAddDriver ? () => setAddModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Driver Roster List */}
          <div className="lg:col-span-5 enterprise-card divide-y divide-[#E5E5E5]/70 overflow-hidden">
            {activeRoster.map((drv) => {
              const vehicle = vehicles.find((v) => v.id === drv.assignedVehicleId)
              const evaluation = evaluateDriverSafety({
                driver: drv,
                events: driverEvents,
                trips,
                corridors,
                vehicles,
              })
              const selected = selectedDriver?.id === drv.id
              return (
                <button
                  key={drv.id}
                  type="button"
                  onClick={() => setSelectedDriverId(drv.id)}
                  className={`w-full p-4 text-left transition-colors hover:bg-[#FFFFFF] flex items-center justify-between gap-3 ${
                    selected ? 'bg-[#EEE8F7]' : ''
                  }`}
                >
                  <div>
                    <p className="font-semibold text-sm text-[#625346]">{drv.name}</p>
                    <p className="text-xs text-[#958777] mt-0.5">
                      {vehicle ? vehicle.registrationNumber : 'Unassigned'} · {drv.totalTrips} trips
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums text-[#625346] inline-flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          evaluation.overallScore < 65
                            ? 'bg-[#D9786C]'
                            : evaluation.overallScore < 80
                              ? 'bg-[#E8C65A]'
                              : 'bg-[#789A75]'
                        }`}
                      />
                      {evaluation.overallScore}
                    </span>
                    <span className="text-[11px] text-[#958777] block">Safety Score</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Driver Intelligence Profile & Event Disputes */}
          {selectedDriver && selectedEvaluation && (
            <div className="lg:col-span-7 enterprise-card p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
                <div>
                  <h2 className="dm-section-title">{selectedDriver.name}</h2>
                  <p className="text-xs text-[#958777] mt-0.5 tabular-nums">
                    {selectedDriver.licenseNumber} · Valid till {selectedDriver.licenseExpiry} · {selectedDriver.mobile}
                  </p>
                </div>
                <SeverityText
                  severity={selectedEvaluation.overallScore < 65 ? 'critical' : selectedEvaluation.overallScore < 80 ? 'high' : 'normal'}
                  label={`Score ${selectedEvaluation.overallScore}/100`}
                />
              </div>

              {/* Road/GPS Fairness Context */}
              <div className="bg-[#EEE8F7] border border-[#DDD3ED] rounded-[10px] p-3.5 flex items-start gap-2.5 text-xs text-[#625346]">
                <Info className="w-4 h-4 text-[#6E5696] shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[#625346]">Corridor & Sensor Context</p>
                  <p className="mt-0.5 text-[#958777]">{selectedEvaluation.roadAdjustedNote}</p>
                </div>
              </div>

              {/* 5 Explainable Safety Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                {[
                  { label: 'Speeding', val: selectedEvaluation.speedingScore },
                  { label: 'Braking', val: selectedEvaluation.brakingScore },
                  { label: 'Acceleration', val: selectedEvaluation.accelerationScore },
                  { label: 'Cornering', val: selectedEvaluation.corneringScore },
                  { label: 'Fatigue / Hours', val: selectedEvaluation.fatigueComplianceScore },
                ].map((metric) => (
                  <div key={metric.label} className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3">
                    <span className="text-[#958777] block">{metric.label}</span>
                    <span className="text-lg font-bold text-[#625346] tabular-nums mt-0.5 block">
                      {metric.val}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coaching Recommendations */}
              <div>
                <h3 className="text-xs font-bold text-[#625346] mb-2">Coaching Recommendations</h3>
                <ul className="space-y-1.5 text-xs text-[#625346] list-disc pl-4">
                  {selectedEvaluation.coachingRecommendations.map((rec) => (
                    <li key={rec}>{rec}</li>
                  ))}
                </ul>
              </div>

              {/* Telemetry Events & Challenge/Dispute Workflow */}
              <div>
                <h3 className="text-xs font-bold text-[#625346] mb-2.5">
                  Telemetry Behavior Events & Dispute Resolution ({selectedDriverEvents.length})
                </h3>
                <div className="divide-y divide-[#E5E5E5]/70 border border-[#E5E5E5] bg-[#FFFFFF]/80 rounded-[10px]">
                  {selectedDriverEvents.map((ev) => (
                    <div key={ev.id} className="p-3.5 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <SeverityText
                            severity={ev.disputeStatus === 'accepted_dismissed' ? 'normal' : ev.severity === 'high' ? 'high' : 'moderate'}
                            label={ev.eventType.replace(/_/g, ' ')}
                          />
                          <span className="font-medium text-[#625346]">{ev.locationLabel}</span>
                          {ev.mountStabilityWarning && (
                            <span className="text-[#A56021] font-semibold">· Phone mount jitter detected</span>
                          )}
                        </div>
                        <span className="text-[#958777] tabular-nums">
                          {ev.speedKmh} km/h · GPS ±{ev.gpsAccuracyMeters}m
                        </span>
                      </div>

                      {ev.disputeStatus === 'disputed' && (
                        <div className="bg-[#E8C65A]/25 border border-[#D8B442] rounded-[8px] p-2.5 text-[#625346]">
                          <p className="font-semibold">Driver Dispute Submitted:</p>
                          <p className="mt-0.5">{ev.disputeReason}</p>
                          {canResolveDispute && (
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  resolveDriverEventDispute(ev.id, 'accepted_dismissed', 'Confirmed sensor/road artifact; penalty removed.')
                                  toast.success('Dispute accepted and safety penalty removed.')
                                }}
                                className="btn-primary text-xs px-2.5 py-1"
                              >
                                Accept & Dismiss Penalty
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  resolveDriverEventDispute(ev.id, 'rejected_upheld', 'GPS & speed profile confirmed event.')
                                  toast.info('Dispute reviewed and original event upheld.')
                                }}
                                className="btn-secondary text-xs px-2.5 py-1"
                              >
                                Uphold Event
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {ev.disputeStatus === 'accepted_dismissed' && (
                        <p className="text-[#4D6E4A] font-medium">
                          Dispute accepted — excluded from driver safety penalties ({ev.disputeResolutionNote}).
                        </p>
                      )}

                      {ev.disputeStatus === 'rejected_upheld' && (
                        <p className="text-[#958777]">
                          Dispute reviewed and upheld ({ev.disputeResolutionNote}).
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[#958777]">
                        <span className="tabular-nums">{formatDateTime(ev.timestamp, activeOrganization.timezone)}</span>
                        {ev.disputeStatus === 'none' && canDispute && (
                          <button
                            type="button"
                            onClick={() => {
                              setDisputeModalEventId(ev.id)
                              setDisputeReason('')
                            }}
                            className="text-[#6E5696] hover:text-[#625346] font-semibold hover:underline inline-flex items-center gap-1"
                          >
                            <MessageSquareWarning className="w-3.5 h-3.5" />
                            Challenge / Dispute Event
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {selectedDriverEvents.length === 0 && (
                    <p className="p-6 text-center text-xs text-[#958777]">
                      No behavior events logged for this driver.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Driver Modal */}
      <EnterpriseModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Commercial Driver"
      >
        <form onSubmit={handleAddDriver} className="space-y-4">
          {addError && (
            <div role="alert" className="p-3 rounded-[10px] bg-[#D9786C]/20 border border-[#D9786C] text-xs font-semibold text-[#625346]">
              {addError}
            </div>
          )}
          <div>
            <label htmlFor="drv-name" className="dm-label">Full Name *</label>
            <input id="drv-name" required value={newDriverForm.name} onChange={(e) => setNewDriverForm((f) => ({ ...f, name: e.target.value }))} className="dm-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="drv-mobile" className="dm-label">Mobile Number *</label>
              <input id="drv-mobile" required value={newDriverForm.mobile} onChange={(e) => setNewDriverForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="+91 98400 11223" className="dm-input" />
            </div>
            <div>
              <label htmlFor="drv-email" className="dm-label">Email</label>
              <input id="drv-email" type="email" value={newDriverForm.email} onChange={(e) => setNewDriverForm((f) => ({ ...f, email: e.target.value }))} className="dm-input" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="drv-lic" className="dm-label">Commercial License No.</label>
              <input id="drv-lic" value={newDriverForm.licenseNumber} onChange={(e) => setNewDriverForm((f) => ({ ...f, licenseNumber: e.target.value }))} placeholder="TN01-2021-009912" className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="drv-exp" className="dm-label">License Expiry</label>
              <input id="drv-exp" type="date" value={newDriverForm.licenseExpiry} onChange={(e) => setNewDriverForm((f) => ({ ...f, licenseExpiry: e.target.value }))} className="dm-input tabular-nums" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Driver</button>
          </div>
        </form>
      </EnterpriseModal>

      {/* Dispute Reason Modal */}
      <EnterpriseModal
        open={Boolean(disputeModalEventId)}
        onClose={() => setDisputeModalEventId(null)}
        title="Challenge Telemetry Behavior Event"
        subtitle="Account for pothole detours, loose phone mounts, or GPS multipath spikes"
      >
        <form onSubmit={handleDisputeSubmit} className="space-y-4">
          <div>
            <label htmlFor="dispute-reason" className="dm-label">Reason for Dispute *</label>
            <textarea
              id="dispute-reason"
              rows={3}
              required
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="E.g. Emergency brake to avoid livestock crossing, or phone slipped from dashboard holder..."
              className="dm-input"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setDisputeModalEventId(null)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Submit Dispute</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

