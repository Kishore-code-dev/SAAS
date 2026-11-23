import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CircleDot, Gauge, Plus, RefreshCw, TrendingUp, Users, Wallet, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EnterpriseModal, formatDateTime, formatInr, formatShortDate, SeverityText } from '../../components/ui/EnterprisePrimitives'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'

export function VehicleAssignmentsView() {
  const navigate = useNavigate()
  const { activeOrganization, activeRole, vehicles, drivers, driverAssignments, assignDriverToVehicle } = useFleet()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState(vehicles[0]?.id ?? '')
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const canAssign = canPerformAction(activeRole, 'assign_driver')

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault()
    const vId = selectedVehicleId || vehicles[0]?.id
    if (!vId) return
    try {
      assignDriverToVehicle(vId, selectedDriverId || null)
      toast.success(selectedDriverId ? 'Driver assigned to vehicle.' : 'Driver unassigned from vehicle.')
      setModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update assignment.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Assignments"
        subtitle={`${activeOrganization.name} · Active operator assignments and historical handover audit trail`}
      >
        {canAssign && (
          <button
            type="button"
            onClick={() => {
              const firstV = vehicles[0]
              setSelectedVehicleId(firstV?.id ?? '')
              setSelectedDriverId(firstV?.assignedDriverId ?? '')
              setModalOpen(true)
            }}
            className="btn-primary text-xs"
          >
            <Users className="w-4 h-4" />
            Assign / Reassign Driver
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Assigned Vehicles</span>
          <p className="dm-kpi-value mt-1">{vehicles.filter((v) => v.assignedDriverId).length}/{vehicles.length}</p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Unassigned Standby</span>
          <p className="dm-kpi-value mt-1">{vehicles.filter((v) => !v.assignedDriverId).length}</p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Assignment Events</span>
          <p className="dm-kpi-value mt-1">{driverAssignments.length}</p>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
          <h2 className="dm-card-title">Current Vehicle-Driver Matrix</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Powertrain</th>
                <th>Current Operator</th>
                <th>Driver Safety</th>
                <th>City / Corridor</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => {
                const drv = drivers.find((d) => d.id === v.assignedDriverId)
                return (
                  <tr key={v.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/fleet/vehicles/${v.id}`)}
                        className="font-semibold text-[#625346] hover:text-[#1F7A4C] flex items-center gap-1"
                      >
                        {v.registrationNumber}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-[#958777]">{v.make} {v.model}</span>
                    </td>
                    <td>{v.powertrain}</td>
                    <td>
                      {drv ? (
                        <div>
                          <span className="font-medium text-[#625346]">{drv.name}</span>
                          <span className="block text-xs text-[#958777]">{drv.mobile}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#958777]">Unassigned</span>
                      )}
                    </td>
                    <td>{drv ? `${drv.safetyScore}/100` : '—'}</td>
                    <td>{v.cityName}</td>
                    <td className="text-right">
                      {canAssign && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVehicleId(v.id)
                            setSelectedDriverId(v.assignedDriverId ?? '')
                            setModalOpen(true)
                          }}
                          className="btn-secondary text-xs px-2.5 py-1"
                        >
                          Change
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {driverAssignments.length > 0 && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <h2 className="dm-card-title">Assignment History Ledger</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Assigned At</th>
                  <th>Unassigned At</th>
                  <th>Assigned By</th>
                </tr>
              </thead>
              <tbody>
                {driverAssignments.map((a) => {
                  const drv = drivers.find((d) => d.id === a.driverId)
                  return (
                    <tr key={a.id}>
                      <td className="font-semibold">{a.vehicleRegistration}</td>
                      <td>{drv?.name ?? a.driverId}</td>
                      <td>{formatDateTime(a.assignedAt)}</td>
                      <td>{a.unassignedAt ? formatDateTime(a.unassignedAt) : <span className="text-[#1F7A4C] font-semibold">Active</span>}</td>
                      <td>{a.assignedBy}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Update Vehicle Assignment">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label htmlFor="assign-veh" className="dm-label">Vehicle</label>
            <select
              id="assign-veh"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="dm-input"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber} — {v.make} {v.model}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="assign-drv" className="dm-label">Driver</label>
            <select
              id="assign-drv"
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="dm-input"
            >
              <option value="">Unassigned</option>
              {drivers.filter((d) => d.operationalStatus === 'active').map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.licenseNumber})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Assignment</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function MeterHistoryView() {
  const { activeOrganization, activeRole, vehicles, fuelTransactions, maintenanceRecords, updateVehicle } = useFleet()
  const [modalOpen, setModalOpen] = useState(false)
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  const [newOdo, setNewOdo] = useState(vehicles[0]?.odometerKm ?? 0)
  const canEdit = canPerformAction(activeRole, 'edit_vehicle')

  const meterRows = useMemo(() => {
    const rows: Array<{
      id: string
      reg: string
      makeModel: string
      readingKm: number
      source: string
      recordedAt: string
      deltaNote: string
    }> = []

    for (const v of vehicles) {
      rows.push({
        id: `cur-${v.id}`,
        reg: v.registrationNumber,
        makeModel: `${v.make} ${v.model}`,
        readingKm: v.odometerKm,
        source: v.telemetry.source === 'smartphone_gps' ? 'GPS Telemetry' : 'Primary Meter',
        recordedAt: v.telemetry.lastUpdatedAt,
        deltaNote: `${v.dailyAvgKm} km/day avg`,
      })
    }

    for (const f of fuelTransactions) {
      const v = vehicles.find((item) => item.id === f.vehicleId)
      if (!v) continue
      rows.push({
        id: `fuel-${f.id}`,
        reg: v.registrationNumber,
        makeModel: `${v.make} ${v.model}`,
        readingKm: f.odometerKm,
        source: `Fuel Log · ${f.station}`,
        recordedAt: f.timestamp,
        deltaNote: `${f.litersOrKwh} units`,
      })
    }

    for (const m of maintenanceRecords) {
      if (!m.odometerAtServiceKm) continue
      const v = vehicles.find((item) => item.id === m.vehicleId)
      if (!v) continue
      rows.push({
        id: `maint-${m.id}`,
        reg: v.registrationNumber,
        makeModel: `${v.make} ${v.model}`,
        readingKm: m.odometerAtServiceKm,
        source: `Service · ${m.serviceType}`,
        recordedAt: m.performedAt,
        deltaNote: m.componentName,
      })
    }

    return rows.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
  }, [fuelTransactions, maintenanceRecords, vehicles])

  const handleLogMeter = (e: React.FormEvent) => {
    e.preventDefault()
    const target = vehicles.find((v) => v.id === (vehicleId || vehicles[0]?.id))
    if (!target) return
    if (newOdo < target.odometerKm) {
      toast.error(`New meter reading (${newOdo.toLocaleString()} km) cannot be lower than current reading (${target.odometerKm.toLocaleString()} km).`)
      return
    }
    try {
      updateVehicle(target.id, { odometerKm: Number(newOdo) })
      toast.success(`Updated primary odometer for ${target.registrationNumber} to ${Number(newOdo).toLocaleString('en-IN')} km.`)
      setModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to log meter reading.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meter History"
        subtitle={`${activeOrganization.name} · Primary odometer logs from GPS telemetry, fuel receipts, and workshop entries`}
      >
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              const v = vehicles[0]
              setVehicleId(v?.id ?? '')
              setNewOdo((v?.odometerKm ?? 0) + 120)
              setModalOpen(true)
            }}
            className="btn-primary text-xs"
          >
            <Plus className="w-4 h-4" />
            Add Meter Entry
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Meter Reading</th>
                <th>Source</th>
                <th>Context</th>
                <th>Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {meterRows.slice(0, 40).map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-semibold text-[#625346] block">{r.reg}</span>
                    <span className="text-xs text-[#958777]">{r.makeModel}</span>
                  </td>
                  <td className="font-bold tabular-nums">
                    <span className="inline-flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-[#1F7A4C]" />
                      {r.readingKm.toLocaleString('en-IN')} km
                    </span>
                  </td>
                  <td>{r.source}</td>
                  <td className="text-xs text-[#958777]">{r.deltaNote}</td>
                  <td className="text-xs text-[#958777]">{formatDateTime(r.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Log Primary Meter Reading">
        <form onSubmit={handleLogMeter} className="space-y-4">
          <div>
            <label htmlFor="meter-veh" className="dm-label">Vehicle</label>
            <select
              id="meter-veh"
              value={vehicleId}
              onChange={(e) => {
                setVehicleId(e.target.value)
                const found = vehicles.find((v) => v.id === e.target.value)
                if (found) setNewOdo(found.odometerKm)
              }}
              className="dm-input"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber} (Current: {v.odometerKm.toLocaleString('en-IN')} km)</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="meter-val" className="dm-label">Odometer Reading (km)</label>
            <input
              id="meter-val"
              type="number"
              min={0}
              value={newOdo}
              onChange={(e) => setNewOdo(Number(e.target.value))}
              className="dm-input tabular-nums"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Meter Entry</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function TireReadingsView() {
  const { activeOrganization, activeRole, vehicles, tyrePositions, updateTyrePosition } = useFleet()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [treadInput, setTreadInput] = useState(8.0)
  const canEdit = canPerformAction(activeRole, 'edit_vehicle') || canPerformAction(activeRole, 'schedule_maintenance')

  const editingTyre = tyrePositions.find((t) => t.id === editingId)

  const handleSaveTread = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTyre) return
    const nextStatus = treadInput <= 3 ? 'replace_soon' : treadInput <= 5.5 ? 'wear_watch' : 'healthy'
    updateTyrePosition(editingTyre.id, {
      treadDepthMm: Number(treadInput),
      status: nextStatus,
      lastInspectedAt: new Date().toISOString().slice(0, 10),
    })
    toast.success(`Updated ${editingTyre.position} tread depth to ${treadInput} mm.`)
    setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tire Readings & Axle Management"
        subtitle={`${activeOrganization.name} · Multi-axle tyre serial numbers, tread depth (mm), and replacement alerts`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Tracked Tyre Positions</span>
          <p className="dm-kpi-value mt-1">{tyrePositions.length}</p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Wear Watch</span>
          <p className="dm-kpi-value mt-1 text-[#A87F14]">
            {tyrePositions.filter((t) => t.status === 'wear_watch').length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Replace Soon</span>
          <p className="dm-kpi-value mt-1 text-[#B84E42]">
            {tyrePositions.filter((t) => t.status === 'replace_soon').length}
          </p>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Axle Position</th>
                <th>Brand / Serial</th>
                <th>Tread Depth</th>
                <th>Expected Life</th>
                <th>Condition</th>
                <th>Last Inspected</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tyrePositions.map((t) => {
                const v = vehicles.find((item) => item.id === t.vehicleId)
                return (
                  <tr key={t.id}>
                    <td className="font-semibold">{v?.registrationNumber ?? t.vehicleId}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 font-semibold">
                        <CircleDot className="w-3.5 h-3.5 text-[#1F7A4C]" />
                        {t.position}
                      </span>
                    </td>
                    <td>
                      <span className="block font-medium">{t.brand}</span>
                      <span className="text-xs text-[#958777]">{t.serialNumber}</span>
                    </td>
                    <td className="font-bold tabular-nums">{t.treadDepthMm.toFixed(1)} mm</td>
                    <td className="tabular-nums">{t.expectedLifeKm.toLocaleString('en-IN')} km</td>
                    <td>
                      <SeverityText
                        severity={t.status === 'replace_soon' ? 'critical' : t.status === 'wear_watch' ? 'high' : 'normal'}
                        label={t.status.replace('_', ' ')}
                      />
                    </td>
                    <td className="text-xs text-[#958777]">{formatShortDate(t.lastInspectedAt)}</td>
                    <td className="text-right">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(t.id)
                            setTreadInput(t.treadDepthMm)
                          }}
                          className="btn-secondary text-xs px-2.5 py-1"
                        >
                          Log Reading
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={Boolean(editingTyre)} onClose={() => setEditingId(null)} title="Update Tyre Tread Depth">
        <form onSubmit={handleSaveTread} className="space-y-4">
          <p className="text-xs text-[#958777]">
            Position: <strong>{editingTyre?.position}</strong> · Serial: <strong>{editingTyre?.serialNumber}</strong>
          </p>
          <div>
            <label htmlFor="tyre-tread" className="dm-label">Measured Tread Depth (mm)</label>
            <input
              id="tyre-tread"
              type="number"
              step="0.1"
              min={0.5}
              max={20}
              value={treadInput}
              onChange={(e) => setTreadInput(Number(e.target.value))}
              className="dm-input tabular-nums"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Reading</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

interface DriverExpenseItem {
  id: string
  driverName: string
  vehicleId: string | null
  category: string
  amountInr: number
  description: string
  expenseDate: string
  approvalStatus: 'Submitted' | 'Pending Review' | 'Approved' | 'Rejected' | 'Requires Additional Information'
  paymentStatus: 'unpaid' | 'reimbursed' | 'company_paid'
  reviewNote: string | null
  paymentReference: string | null
}

export function ExpenseHistoryView() {
  const { activeOrganization, activeRole, vehicles, fuelTransactions, maintenanceRecords, workOrders } = useFleet()
  const [driverExpenses, setDriverExpenses] = useState<DriverExpenseItem[]>([])
  const [expenseFilter, setExpenseFilter] = useState<'all' | 'pending' | 'Approved' | 'reimbursed'>('all')

  const canApproveExpense = canPerformAction(activeRole, 'approve_expense') || activeRole === 'org_admin' || activeRole === 'fleet_staff'

  const loadDriverExpenses = useCallback(async () => {
    try {
      const res = await fetch('/api/fleet/expenses', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      setDriverExpenses(data.expenses ?? [])
    } catch {
      // ignore offline
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDriverExpenses()
  }, [loadDriverExpenses])

  const handleReviewExpense = async (
    expenseId: string,
    approvalStatus: 'Approved' | 'Rejected' | 'Requires Additional Information',
  ) => {
    try {
      const res = await fetch(`/api/fleet/expenses/${expenseId}/review`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalStatus,
          reviewNote:
            approvalStatus === 'Approved'
              ? 'Receipt verified against trip corridor.'
              : approvalStatus === 'Requires Additional Information'
                ? 'Please attach clearer GST toll/repair bill.'
                : 'Out-of-policy submission.',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update expense review status')
      toast.success(`Expense marked as ${approvalStatus}`)
      void loadDriverExpenses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Expense review failed')
    }
  }

  const handlePayExpense = async (expenseId: string, paymentStatus: 'reimbursed' | 'company_paid') => {
    try {
      const res = await fetch(`/api/fleet/expenses/${expenseId}/pay`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentStatus,
          paymentReference: `SETTLE-${Date.now().toString().slice(-6)}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record reimbursement')
      toast.success(paymentStatus === 'reimbursed' ? 'Driver reimbursement recorded' : 'Marked as Company Paid')
      void loadDriverExpenses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment settlement failed')
    }
  }

  const filteredDriverExpenses = useMemo(() => {
    return driverExpenses.filter((exp) => {
      if (expenseFilter === 'all') return true
      if (expenseFilter === 'pending') {
        return exp.approvalStatus === 'Submitted' || exp.approvalStatus === 'Pending Review' || exp.approvalStatus === 'Requires Additional Information'
      }
      if (expenseFilter === 'Approved') return exp.approvalStatus === 'Approved' && exp.paymentStatus === 'unpaid'
      return exp.paymentStatus === 'reimbursed' || exp.paymentStatus === 'company_paid'
    })
  }, [driverExpenses, expenseFilter])

  const rows = useMemo(() => {
    const items: Array<{
      id: string
      date: string
      vehicle: string
      category: 'Fuel & Energy' | 'Service & Maintenance' | 'Work Order'
      vendor: string
      amountInr: number
      status: string
    }> = []

    for (const f of fuelTransactions) {
      const v = vehicles.find((x) => x.id === f.vehicleId)
      items.push({
        id: `exp-f-${f.id}`,
        date: f.timestamp,
        vehicle: v?.registrationNumber ?? f.vehicleId,
        category: 'Fuel & Energy',
        vendor: f.station,
        amountInr: f.amountInr,
        status: f.verificationStatus,
      })
    }
    for (const m of maintenanceRecords) {
      const v = vehicles.find((x) => x.id === m.vehicleId)
      items.push({
        id: `exp-m-${m.id}`,
        date: m.performedAt,
        vehicle: v?.registrationNumber ?? m.vehicleId,
        category: 'Service & Maintenance',
        vendor: m.serviceCenter,
        amountInr: m.costInr,
        status: m.paymentState ?? m.status,
      })
    }
    for (const w of workOrders) {
      const v = vehicles.find((x) => x.id === w.vehicleId)
      items.push({
        id: `exp-w-${w.id}`,
        date: w.createdAt,
        vehicle: v?.registrationNumber ?? w.vehicleId,
        category: 'Work Order',
        vendor: w.workshopName,
        amountInr: w.totalCostInr,
        status: w.paymentState,
      })
    }

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [fuelTransactions, maintenanceRecords, vehicles, workOrders])

  const totalSpend = rows.reduce((s, r) => s + r.amountInr, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense History & Driver Reimbursement"
        subtitle={`${activeOrganization.name} · Consolidated operating expenses plus separate Approval vs Reimbursement tracking for Driver Portal claims`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Total Recorded Spend</span>
          <p className="dm-kpi-value mt-1 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#1F7A4C]" />
            {formatInr(totalSpend)}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Driver Claims Submitted</span>
          <p className="dm-kpi-value mt-1">{driverExpenses.length}</p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Pending Driver Approval</span>
          <p className="dm-kpi-value mt-1">
            {driverExpenses.filter((e) => e.approvalStatus === 'Submitted' || e.approvalStatus === 'Pending Review').length}
          </p>
        </div>
      </div>

      {/* Driver Expense Submissions: Approval vs Reimbursement Queue */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="dm-card-title">Driver Expense Submissions (Approval ≠ Reimbursement)</h2>
            <p className="text-xs text-[#958777] mt-0.5">
              Expenses must be verified &amp; Approved before reimbursement or company-paid settlement can be recorded.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'pending', label: 'Needs Review' },
                { id: 'Approved', label: 'Approved (Unpaid)' },
                { id: 'reimbursed', label: 'Settled' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setExpenseFilter(f.id)}
                className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-colors ${
                  expenseFilter === f.id ? 'bg-[#FFFFFF] text-[#625346]' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Date &amp; Driver</th>
                <th>Category &amp; Details</th>
                <th>Amount</th>
                <th>Approval Status</th>
                <th>Reimbursement Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDriverExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-xs text-[#958777]">
                    No driver-submitted expenses in this filter.
                  </td>
                </tr>
              ) : (
                filteredDriverExpenses.map((exp) => {
                  const veh = vehicles.find((v) => v.id === exp.vehicleId)
                  return (
                    <tr key={exp.id}>
                      <td>
                        <p className="font-semibold text-[#625346]">{exp.driverName}</p>
                        <p className="text-[11px] text-[#958777]">
                          {formatShortDate(exp.expenseDate)} {veh ? `· ${veh.registrationNumber}` : ''}
                        </p>
                      </td>
                      <td>
                        <p className="font-medium text-[#625346] capitalize">{exp.category}</p>
                        <p className="text-[11px] text-[#958777]">{exp.description || '—'}</p>
                      </td>
                      <td className="font-bold tabular-nums">{formatInr(exp.amountInr)}</td>
                      <td>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            exp.approvalStatus === 'Approved'
                              ? 'bg-[#EDF4EC] border-[#789A75] text-[#4D6E4A]'
                              : exp.approvalStatus === 'Rejected'
                                ? 'bg-[#FCECEB] border-[#D9786C] text-[#B84E42]'
                                : 'bg-[#FCF5DE] border-[#D8B442] text-[#8E6F19]'
                          }`}
                        >
                          {exp.approvalStatus}
                        </span>
                      </td>
                      <td>
                        <span className="capitalize text-xs font-semibold text-[#625346]">
                          {exp.paymentStatus.replace('_', ' ')}
                        </span>
                        {exp.paymentReference && (
                          <p className="text-[10px] font-mono text-[#958777]">{exp.paymentReference}</p>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {canApproveExpense && exp.approvalStatus !== 'Approved' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleReviewExpense(exp.id, 'Approved')}
                                className="btn-primary text-[11px] px-2 py-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleReviewExpense(exp.id, 'Requires Additional Information')}
                                className="btn-secondary text-[11px] px-2 py-1"
                              >
                                Request Info
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleReviewExpense(exp.id, 'Rejected')}
                                className="btn-secondary text-[11px] px-2 py-1 text-[#B84E42]"
                              >
                                <XCircle className="w-3 h-3" />
                                Reject
                              </button>
                            </>
                          )}
                          {exp.approvalStatus === 'Approved' && exp.paymentStatus === 'unpaid' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handlePayExpense(exp.id, 'reimbursed')}
                                className="btn-primary text-[11px] px-2 py-1"
                              >
                                Mark Reimbursed
                              </button>
                              <button
                                type="button"
                                onClick={() => void handlePayExpense(exp.id, 'company_paid')}
                                className="btn-secondary text-[11px] px-2 py-1"
                              >
                                Company Paid
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Expense Type</th>
                <th>Vendor / Station</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs text-[#958777]">{formatShortDate(r.date)}</td>
                  <td className="font-semibold">{r.vehicle}</td>
                  <td>{r.category}</td>
                  <td>{r.vendor}</td>
                  <td className="font-bold tabular-nums">{formatInr(r.amountInr)}</td>
                  <td className="capitalize text-xs font-semibold">{r.status.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function ReplacementAnalysisView() {
  const { activeOrganization, vehicles, maintenanceRecords, predictions } = useFleet()
  const [replacementHorizonYears, setReplacementHorizonYears] = useState(6)

  const analysis = useMemo(() => {
    const currentYear = 2026
    return vehicles.map((v) => {
      const ageYears = Math.max(1, currentYear - v.year)
      const maintSpend = maintenanceRecords
        .filter((m) => m.vehicleId === v.id)
        .reduce((s, m) => s + m.costInr, 0)
      const predictedRiskCost = predictions
        .filter((p) => p.vehicleId === v.id && !p.insufficientData)
        .reduce((s, p) => s + p.delayCostInr, 0)
      const lifecycleRatio = Math.min(100, Math.round(((ageYears / replacementHorizonYears) * 0.55 + (v.odometerKm / 450000) * 0.45) * 100))
      const recommendation =
        lifecycleRatio >= 78 || v.healthScore < 55
          ? 'Evaluate Replacement'
          : lifecycleRatio >= 55
            ? 'Monitor Utilization'
            : 'Retain in Active Fleet'
      return {
        vehicle: v,
        ageYears,
        maintSpend,
        predictedRiskCost,
        lifecycleRatio,
        recommendation,
      }
    })
  }, [maintenanceRecords, predictions, replacementHorizonYears, vehicles])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Replacement Analysis"
        subtitle={`${activeOrganization.name} · Asset lifecycle modeling comparing odometer utilization, repair spend, and risk exposure`}
      >
        <div className="flex items-center gap-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5 text-[#1F7A4C]" />
          <label htmlFor="horizon-yrs" className="font-semibold">Target Lifecycle:</label>
          <select
            id="horizon-yrs"
            value={replacementHorizonYears}
            onChange={(e) => setReplacementHorizonYears(Number(e.target.value))}
            className="bg-transparent font-bold outline-none"
          >
            <option value={5}>5 Years</option>
            <option value={6}>6 Years</option>
            <option value={8}>8 Years</option>
          </select>
        </div>
      </PageHeader>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Age / Odometer</th>
                <th>Health Score</th>
                <th>Recorded Maint Spend</th>
                <th>Risk Exposure</th>
                <th>Lifecycle Used</th>
                <th>Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {analysis.map((row) => (
                <tr key={row.vehicle.id}>
                  <td>
                    <span className="font-semibold block">{row.vehicle.registrationNumber}</span>
                    <span className="text-xs text-[#958777]">{row.vehicle.make} {row.vehicle.model}</span>
                  </td>
                  <td className="tabular-nums">
                    {row.ageYears} yrs · {row.vehicle.odometerKm.toLocaleString('en-IN')} km
                  </td>
                  <td className="font-bold tabular-nums">{row.vehicle.healthScore}/100</td>
                  <td className="tabular-nums">{formatInr(row.maintSpend)}</td>
                  <td className="tabular-nums">{formatInr(row.predictedRiskCost)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-[#E5E5E5] overflow-hidden">
                        <div
                          className={`h-full ${row.lifecycleRatio >= 75 ? 'bg-[#B84E42]' : row.lifecycleRatio >= 55 ? 'bg-[#D8B442]' : 'bg-[#1F7A4C]'}`}
                          style={{ width: `${row.lifecycleRatio}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold tabular-nums">{row.lifecycleRatio}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                      row.recommendation === 'Evaluate Replacement'
                        ? 'text-[#B84E42]'
                        : row.recommendation === 'Monitor Utilization'
                          ? 'text-[#A87F14]'
                          : 'text-[#1F7A4C]'
                    }`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                      {row.recommendation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
