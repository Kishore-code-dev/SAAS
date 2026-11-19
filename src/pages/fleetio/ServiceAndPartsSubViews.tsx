import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BatteryCharging, CheckCircle2, ClipboardList, Minus, Package, Plus, Truck, Wrench, Zap } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EnterpriseModal, formatDateTime, formatInr, formatShortDate, SeverityText } from '../../components/ui/EnterprisePrimitives'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { FiveAreaHealthCategory, ServiceProgramItem } from '../../types/fleet'

export function InspectionsSubView({ tab }: { tab: 'failures' | 'schedules' | 'forms' }) {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    drivers,
    inspections,
    inspectionSchedules,
    inspectionForms,
    addInspectionSchedule,
    addInspectionForm,
    addSmallIssue,
    convertIssueToWorkOrder,
  } = useFleet()
  const canWo = canPerformAction(activeRole, 'manage_work_orders')
  const canSchedule = canPerformAction(activeRole, 'schedule_maintenance')
  const [schedModalOpen, setSchedModalOpen] = useState(false)
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [schedForm, setSchedForm] = useState({ name: '', frequency: 'Every 7 Days', scope: 'All Active Vehicles', formTitle: inspectionForms[0]?.title ?? 'Commercial DVIR Pre-Trip Standard' })
  const [templateForm, setTemplateForm] = useState({ title: '', itemsCount: 12 })

  if (tab === 'failures') {
    const failed = inspections.filter((i) => !i.passed)
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inspection Item Failures"
          subtitle={`${activeOrganization.name} · Failed pre-trip checklist items requiring workshop triage or Work Order creation`}
        />
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Inspector / Driver</th>
                  <th>Failed Findings</th>
                  <th>Timestamp</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((ins) => {
                  const v = vehicles.find((x) => x.id === ins.vehicleId)
                  const d = drivers.find((x) => x.id === ins.driverId)
                  const findings = [
                    ins.tyreCondition !== 'good' ? `Tyres: ${ins.tyreCondition}` : null,
                    ins.brakeFeel !== 'normal' ? `Brakes: ${ins.brakeFeel}` : null,
                    ins.fluidLeaksDetected ? 'Fluid leak' : null,
                    ins.warningLightsOn ? 'MIL Warning Light' : null,
                    ins.batteryOrStartingIssue ? 'Battery/Starting issue' : null,
                  ].filter(Boolean)
                  return (
                    <tr key={ins.id}>
                      <td className="font-semibold">{v?.registrationNumber ?? ins.vehicleId}</td>
                      <td>{ins.inspectorName ?? d?.name ?? 'Inspector'}</td>
                      <td className="text-xs font-medium text-[#B84E42]">{findings.join(' · ') || ins.notes}</td>
                      <td className="text-xs text-[#958777]">{formatDateTime(ins.timestamp)}</td>
                      <td className="text-right">
                        {canWo && (
                          <button
                            type="button"
                            onClick={() => {
                              const iss = addSmallIssue({
                                vehicleId: ins.vehicleId,
                                driverId: ins.driverId,
                                title: `Inspection Failure: ${findings[0] ?? 'Checklist Defect'}`,
                                description: ins.notes || findings.join(', '),
                                healthArea: ins.tyreCondition !== 'good' ? 'Tyre Health' : 'Vehicle Health',
                                severity: 'high',
                                source: 'inspection_defect',
                              })
                              const wo = convertIssueToWorkOrder(iss.id)
                              if (wo) toast.success(`Created Work Order ${wo.workOrderNumber}`)
                            }}
                            className="btn-accent text-xs px-2.5 py-1"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Create Work Order
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {failed.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-xs text-[#958777]">
                      No unresolved inspection item failures.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  if (tab === 'schedules') {
    const handleAddSchedule = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!schedForm.name.trim()) return
      const matched = inspectionForms.find((f) => f.title === schedForm.formTitle)
      await addInspectionSchedule({
        name: schedForm.name.trim(),
        frequency: schedForm.frequency.trim(),
        scope: schedForm.scope.trim(),
        formId: matched?.id,
        formTitle: schedForm.formTitle,
        active: true,
      })
      toast.success('Inspection schedule saved.')
      setSchedModalOpen(false)
      setSchedForm((f) => ({ ...f, name: '' }))
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title="Inspection Schedules"
          subtitle={`${activeOrganization.name} · Recurring safety and roadworthiness inspection cadences`}
        >
          <div className="flex items-center gap-2">
            {canSchedule && (
              <button type="button" onClick={() => setSchedModalOpen(true)} className="btn-primary text-xs">
                <Plus className="w-4 h-4" />
                Add Schedule
              </button>
            )}
            <button type="button" onClick={() => navigate('/dashboard/inspections')} className="btn-secondary text-xs">
              Open Inspection Queue
            </button>
          </div>
        </PageHeader>
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Schedule Name</th>
                  <th>Frequency</th>
                  <th>Assigned Scope</th>
                  <th>Form Template</th>
                </tr>
              </thead>
              <tbody>
                {inspectionSchedules.map((s) => (
                  <tr key={s.id}>
                    <td className="font-semibold">{s.name}</td>
                    <td>{s.frequency}</td>
                    <td>{s.scope}</td>
                    <td className="text-xs font-medium text-[#1F7A4C]">{s.formTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <EnterpriseModal open={schedModalOpen} onClose={() => setSchedModalOpen(false)} title="Create Inspection Schedule">
          <form onSubmit={handleAddSchedule} className="space-y-4">
            <div>
              <label htmlFor="is-name" className="dm-label">Schedule Name</label>
              <input id="is-name" value={schedForm.name} onChange={(e) => setSchedForm({ ...schedForm, name: e.target.value })} placeholder="Weekly Cold-Chain Reefer Check" className="dm-input" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="is-freq" className="dm-label">Frequency</label>
                <input id="is-freq" value={schedForm.frequency} onChange={(e) => setSchedForm({ ...schedForm, frequency: e.target.value })} className="dm-input" required />
              </div>
              <div>
                <label htmlFor="is-scope" className="dm-label">Assigned Scope</label>
                <input id="is-scope" value={schedForm.scope} onChange={(e) => setSchedForm({ ...schedForm, scope: e.target.value })} className="dm-input" required />
              </div>
            </div>
            <div>
              <label htmlFor="is-form" className="dm-label">Checklist Template</label>
              <select id="is-form" value={schedForm.formTitle} onChange={(e) => setSchedForm({ ...schedForm, formTitle: e.target.value })} className="dm-input">
                {inspectionForms.map((f) => (
                  <option key={f.id} value={f.title}>{f.title}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSchedModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Schedule</button>
            </div>
          </form>
        </EnterpriseModal>
      </div>
    )
  }

  const handleAddForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!templateForm.title.trim()) return
    await addInspectionForm({
      title: templateForm.title.trim(),
      itemsCount: Number(templateForm.itemsCount) || 12,
      lastUpdated: new Date().toISOString().slice(0, 10),
      active: true,
    })
    toast.success('Inspection form template created.')
    setFormModalOpen(false)
    setTemplateForm({ title: '', itemsCount: 12 })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspection Forms"
        subtitle={`${activeOrganization.name} · Standardized inspection checklists for ICE and EV commercial vehicles`}
      >
        <div className="flex items-center gap-2">
          {canSchedule && (
            <button type="button" onClick={() => setFormModalOpen(true)} className="btn-primary text-xs">
              <Plus className="w-4 h-4" />
              New Form
            </button>
          )}
          <button type="button" onClick={() => navigate('/dashboard/inspections')} className="btn-secondary text-xs">
            Log Inspection Now
          </button>
        </div>
      </PageHeader>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {inspectionForms.map((f) => (
          <div key={f.id} className="enterprise-card p-5 space-y-2">
            <div className="flex items-center justify-between">
              <ClipboardList className="w-5 h-5 text-[#1F7A4C]" />
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-[#EAF7EF] text-[#156C3F]">Active</span>
            </div>
            <h3 className="text-sm font-bold text-[#625346]">{f.title}</h3>
            <p className="text-xs text-[#958777]">{f.itemsCount} checklist items · Updated {formatShortDate(f.lastUpdated)}</p>
          </div>
        ))}
      </div>

      <EnterpriseModal open={formModalOpen} onClose={() => setFormModalOpen(false)} title="Create Inspection Form Template">
        <form onSubmit={handleAddForm} className="space-y-4">
          <div>
            <label htmlFor="if-title" className="dm-label">Form Title</label>
            <input id="if-title" value={templateForm.title} onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })} placeholder="Hazmat Tanker Pre-Dispatch Audit" className="dm-input" required />
          </div>
          <div>
            <label htmlFor="if-count" className="dm-label">Checklist Items Count</label>
            <input id="if-count" type="number" min={1} max={100} value={templateForm.itemsCount} onChange={(e) => setTemplateForm({ ...templateForm, itemsCount: Number(e.target.value) })} className="dm-input tabular-nums" required />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Form</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function ServiceSubView({ tab }: { tab: 'tasks' | 'programs' }) {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    serviceSchedules,
    serviceTasks,
    servicePrograms,
    addServiceTask,
    addServiceProgram,
  } = useFleet()
  const canSchedule = canPerformAction(activeRole, 'schedule_maintenance')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [progModalOpen, setProgModalOpen] = useState(false)
  const [taskForm, setTaskForm] = useState({
    code: '',
    title: '',
    area: 'Vehicle Health' as FiveAreaHealthCategory,
    avgHours: 2.0,
    estCostInr: 4500,
  })
  const [progForm, setProgForm] = useState({
    name: '',
    powertrain: 'All' as ServiceProgramItem['powertrain'],
    intervalKm: 10000,
    intervalDays: 90,
  })

  if (tab === 'tasks') {
    const handleAddTask = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!taskForm.code.trim() || !taskForm.title.trim()) return
      await addServiceTask({
        code: taskForm.code.trim().toUpperCase(),
        title: taskForm.title.trim(),
        area: taskForm.area,
        avgHours: Number(taskForm.avgHours) || 1.5,
        estCostInr: Number(taskForm.estCostInr) || 2500,
        active: true,
      })
      toast.success('Service task added to VMRS catalog.')
      setTaskModalOpen(false)
      setTaskForm((f) => ({ ...f, code: '', title: '' }))
    }

    return (
      <div className="space-y-6">
        <PageHeader
          title="Service Tasks"
          subtitle={`${activeOrganization.name} · Standardized VMRS service task catalog used in Work Orders and schedules`}
        >
          <div className="flex items-center gap-2">
            {canSchedule && (
              <button type="button" onClick={() => setTaskModalOpen(true)} className="btn-primary text-xs">
                <Plus className="w-4 h-4" />
                Add Task
              </button>
            )}
            <button type="button" onClick={() => navigate('/dashboard/work-orders')} className="btn-secondary text-xs">
              Create Work Order
            </button>
          </div>
        </PageHeader>
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Task Code</th>
                  <th>Task Name</th>
                  <th>Health Area</th>
                  <th>Est. Labor</th>
                  <th>Standard Cost</th>
                </tr>
              </thead>
              <tbody>
                {serviceTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs font-semibold">{t.code}</td>
                    <td className="font-semibold">{t.title}</td>
                    <td>{t.area}</td>
                    <td className="tabular-nums">{t.avgHours} hrs</td>
                    <td className="tabular-nums font-semibold">{formatInr(t.estCostInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <EnterpriseModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} title="Add VMRS Service Task">
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="st-code" className="dm-label">VMRS Code</label>
                <input id="st-code" value={taskForm.code} onChange={(e) => setTaskForm({ ...taskForm, code: e.target.value })} placeholder="VMRS-024-003" className="dm-input" required />
              </div>
              <div>
                <label htmlFor="st-area" className="dm-label">Health Area</label>
                <select id="st-area" value={taskForm.area} onChange={(e) => setTaskForm({ ...taskForm, area: e.target.value as FiveAreaHealthCategory })} className="dm-input">
                  <option value="Vehicle Health">Vehicle Health</option>
                  <option value="Engine Health">Engine Health</option>
                  <option value="Tyre Health">Tyre Health</option>
                  <option value="Fuel Health">Fuel Health</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="st-title" className="dm-label">Task Name</label>
              <input id="st-title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="Clutch Release Bearing & Cylinder Kit" className="dm-input" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="st-hrs" className="dm-label">Estimated Labor (hrs)</label>
                <input id="st-hrs" type="number" step="0.5" min={0.5} value={taskForm.avgHours} onChange={(e) => setTaskForm({ ...taskForm, avgHours: Number(e.target.value) })} className="dm-input tabular-nums" />
              </div>
              <div>
                <label htmlFor="st-cost" className="dm-label">Standard Cost (₹)</label>
                <input id="st-cost" type="number" min={100} value={taskForm.estCostInr} onChange={(e) => setTaskForm({ ...taskForm, estCostInr: Number(e.target.value) })} className="dm-input tabular-nums" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTaskModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" className="btn-primary text-xs">Save Task</button>
            </div>
          </form>
        </EnterpriseModal>
      </div>
    )
  }

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!progForm.name.trim()) return
    await addServiceProgram({
      name: progForm.name.trim(),
      powertrain: progForm.powertrain,
      cadence: `Every ${Number(progForm.intervalKm).toLocaleString('en-IN')} km or ${progForm.intervalDays} days`,
      intervalKm: Number(progForm.intervalKm) || 10000,
      intervalDays: Number(progForm.intervalDays) || 90,
      active: true,
    })
    toast.success('Preventive service program created.')
    setProgModalOpen(false)
    setProgForm((f) => ({ ...f, name: '' }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Service Programs"
        subtitle={`${activeOrganization.name} · Fleet-wide preventive maintenance programs grouped by powertrain`}
      >
        <div className="flex items-center gap-2">
          {canSchedule && (
            <button type="button" onClick={() => setProgModalOpen(true)} className="btn-primary text-xs">
              <Plus className="w-4 h-4" />
              New Program
            </button>
          )}
          <button type="button" onClick={() => navigate('/dashboard/maintenance')} className="btn-secondary text-xs">
            Open Service History
          </button>
        </div>
      </PageHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {servicePrograms.map((p) => {
          const enrolledVehicles =
            p.powertrain === 'All'
              ? vehicles.length
              : vehicles.filter((v) => v.powertrain === p.powertrain).length
          return (
            <div key={p.id} className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1F7A4C]">Active Program · {p.powertrain}</span>
                <CheckCircle2 className="w-4 h-4 text-[#1F7A4C]" />
              </div>
              <h3 className="text-base font-bold text-[#625346]">{p.name}</h3>
              <p className="text-xs text-[#958777]">Cadence: {p.cadence}</p>
              <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-between text-xs font-semibold">
                <span>{enrolledVehicles} enrolled vehicles</span>
                <span>{serviceSchedules.length} active reminders</span>
              </div>
            </div>
          )
        })}
      </div>

      <EnterpriseModal open={progModalOpen} onClose={() => setProgModalOpen(false)} title="Create Service Program">
        <form onSubmit={handleAddProgram} className="space-y-4">
          <div>
            <label htmlFor="sp-name" className="dm-label">Program Name</label>
            <input id="sp-name" value={progForm.name} onChange={(e) => setProgForm({ ...progForm, name: e.target.value })} placeholder="CNG City Van 7,500 km Preventive Track" className="dm-input" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="sp-pt" className="dm-label">Powertrain</label>
              <select id="sp-pt" value={progForm.powertrain} onChange={(e) => setProgForm({ ...progForm, powertrain: e.target.value as ServiceProgramItem['powertrain'] })} className="dm-input">
                <option value="All">All</option>
                <option value="ICE">ICE</option>
                <option value="EV">EV</option>
              </select>
            </div>
            <div>
              <label htmlFor="sp-km" className="dm-label">Interval (km)</label>
              <input id="sp-km" type="number" min={1000} value={progForm.intervalKm} onChange={(e) => setProgForm({ ...progForm, intervalKm: Number(e.target.value) })} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="sp-days" className="dm-label">Interval (days)</label>
              <input id="sp-days" type="number" min={15} value={progForm.intervalDays} onChange={(e) => setProgForm({ ...progForm, intervalDays: Number(e.target.value) })} className="dm-input tabular-nums" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProgModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Program</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

export function InventorySubView({ tab }: { tab: 'bulk' | 'po' }) {
  const {
    activeOrganization,
    activeRole,
    partsInventory,
    purchaseOrders,
    adjustPartStock,
    receivePurchaseOrderItems,
  } = useFleet()
  const canManage = canPerformAction(activeRole, 'manage_inventory')

  if (tab === 'po') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Purchase Orders"
          subtitle={`${activeOrganization.name} · Spare part procurement orders and warehouse receiving`}
        />
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Line Items</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="font-semibold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#1F7A4C]" />
                      {po.poNumber}
                    </td>
                    <td>{po.supplierName}</td>
                    <td className="text-xs">{po.items.map((i) => `${i.partName} (${i.receivedQty}/${i.orderedQty})`).join(', ')}</td>
                    <td className="font-bold tabular-nums">{formatInr(po.totalAmountInr)}</td>
                    <td>
                      <SeverityText
                        severity={po.status === 'received' ? 'normal' : 'moderate'}
                        label={po.status.replace('_', ' ')}
                      />
                    </td>
                    <td className="text-right">
                      {canManage && po.status !== 'received' && po.status !== 'cancelled' && (
                        <button
                          type="button"
                          onClick={() => {
                            const map: Record<string, number> = {}
                            for (const item of po.items) {
                              const rem = item.orderedQty - item.receivedQty
                              if (rem > 0) map[item.partId] = rem
                            }
                            receivePurchaseOrderItems(po.id, map)
                            toast.success(`Received remaining items for ${po.poNumber}`)
                          }}
                          className="btn-primary text-xs px-2.5 py-1"
                        >
                          Receive All
                        </button>
                      )}
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bulk Manage Parts"
        subtitle={`${activeOrganization.name} · Fast warehouse cycle-count adjustments across all spare part SKUs`}
      />
      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>SKU / Part</th>
                <th>Category</th>
                <th>Warehouse Location</th>
                <th>On Hand</th>
                <th>Reorder Level</th>
                <th className="text-right">Quick Adjust</th>
              </tr>
            </thead>
            <tbody>
              {partsInventory.map((p) => (
                <tr key={p.id}>
                  <td>
                    <span className="font-semibold flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-[#1F7A4C]" />
                      {p.name}
                    </span>
                    <span className="text-xs text-[#958777]">{p.sku}</span>
                  </td>
                  <td>{p.category}</td>
                  <td className="text-xs">{p.warehouseLocation}</td>
                  <td className="font-bold tabular-nums">{p.stockQty} {p.unit}</td>
                  <td className="tabular-nums text-xs">{p.reorderThreshold} {p.unit}</td>
                  <td className="text-right">
                    {canManage && (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label={`Decrease stock for ${p.name}`}
                          onClick={() => {
                            if (p.stockQty <= 0) return
                            adjustPartStock(p.id, -1, 'Bulk cycle count decrement')
                            toast.success(`Adjusted ${p.sku} (-1)`)
                          }}
                          className="p-1.5 rounded border border-[#E5E5E5] hover:bg-[#FAFAFA]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Increase stock for ${p.name}`}
                          onClick={() => {
                            adjustPartStock(p.id, 1, 'Bulk cycle count increment')
                            toast.success(`Adjusted ${p.sku} (+1)`)
                          }}
                          className="p-1.5 rounded border border-[#E5E5E5] hover:bg-[#EAF7EF] text-[#1F7A4C]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
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

export function ChargingHistoryView() {
  const { activeOrganization, activeRole, vehicles, drivers, fuelTransactions, addFuelTransaction } = useFleet()
  const [modalOpen, setModalOpen] = useState(false)
  const evVehicles = vehicles.filter((v) => v.powertrain === 'EV')
  const [form, setForm] = useState({
    vehicleId: evVehicles[0]?.id ?? vehicles[0]?.id ?? '',
    kwh: 42,
    costInr: 720,
    station: `${activeOrganization.city} DC Fast Charger`,
    odometerKm: evVehicles[0]?.odometerKm ?? vehicles[0]?.odometerKm ?? 10000,
  })
  const canLog = canPerformAction(activeRole, 'log_fuel')

  const chargingSessions = fuelTransactions.filter(
    (f) => f.paymentMethod === 'ev_charging' || vehicles.find((v) => v.id === f.vehicleId)?.powertrain === 'EV',
  )

  const handleLogCharging = (e: React.FormEvent) => {
    e.preventDefault()
    const v = vehicles.find((x) => x.id === (form.vehicleId || vehicles[0]?.id))
    if (!v) return
    try {
      addFuelTransaction({
        vehicleId: v.id,
        driverId: v.assignedDriverId ?? drivers[0]?.id ?? '',
        amountInr: Number(form.costInr),
        litersOrKwh: Number(form.kwh),
        unitPriceInr: Number((form.costInr / Math.max(1, form.kwh)).toFixed(2)),
        odometerKm: Number(form.odometerKm),
        station: form.station.trim(),
        location: v.telemetry.location,
        timestamp: new Date().toISOString(),
        paymentMethod: 'ev_charging',
        entrySource: 'owner_entry',
      })
      toast.success(`Logged EV charging session for ${v.registrationNumber}`)
      setModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to log charging session.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="EV Charging History"
        subtitle={`${activeOrganization.name} · DC fast & depot AC charging sessions, kWh energy cost, and battery SOC tracking`}
      >
        {canLog && (
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary text-xs">
            <Zap className="w-4 h-4" />
            Log Charging Session
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Active EV Vehicles</span>
          <p className="dm-kpi-value mt-1 flex items-center gap-2">
            <BatteryCharging className="w-5 h-5 text-[#1F7A4C]" />
            {evVehicles.length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Charging Sessions</span>
          <p className="dm-kpi-value mt-1">{chargingSessions.length}</p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Total Energy Delivered</span>
          <p className="dm-kpi-value mt-1">
            {chargingSessions.reduce((s, c) => s + c.litersOrKwh, 0).toFixed(1)} kWh
          </p>
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Charging Station</th>
                <th>Energy (kWh)</th>
                <th>Cost</th>
                <th>Odometer</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {chargingSessions.map((c) => {
                const v = vehicles.find((x) => x.id === c.vehicleId)
                return (
                  <tr key={c.id}>
                    <td className="font-semibold">{v?.registrationNumber ?? c.vehicleId}</td>
                    <td>{c.station}</td>
                    <td className="tabular-nums font-bold">{c.litersOrKwh} kWh</td>
                    <td className="tabular-nums">{formatInr(c.amountInr)}</td>
                    <td className="tabular-nums">{c.odometerKm.toLocaleString('en-IN')} km</td>
                    <td className="text-xs text-[#958777]">{formatDateTime(c.timestamp)}</td>
                  </tr>
                )
              })}
              {chargingSessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-xs text-[#958777]">
                    No EV charging sessions recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title="Log EV Charging Session">
        <form onSubmit={handleLogCharging} className="space-y-4">
          <div>
            <label htmlFor="chg-veh" className="dm-label">Vehicle</label>
            <select id="chg-veh" value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} className="dm-input">
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.registrationNumber} ({v.powertrain})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="chg-kwh" className="dm-label">Energy (kWh)</label>
              <input id="chg-kwh" type="number" min={1} value={form.kwh} onChange={(e) => setForm({ ...form, kwh: Number(e.target.value) })} className="dm-input tabular-nums" required />
            </div>
            <div>
              <label htmlFor="chg-cost" className="dm-label">Total Cost (₹)</label>
              <input id="chg-cost" type="number" min={1} value={form.costInr} onChange={(e) => setForm({ ...form, costInr: Number(e.target.value) })} className="dm-input tabular-nums" required />
            </div>
          </div>
          <div>
            <label htmlFor="chg-station" className="dm-label">Charging Hub</label>
            <input id="chg-station" value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} className="dm-input" required />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" className="btn-primary text-xs">Save Session</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
