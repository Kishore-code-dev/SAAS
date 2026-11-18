import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, CheckSquare, PackagePlus, Plus, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  EnterpriseModal,
  formatInr,
  formatShortDate,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import type { FiveAreaHealthCategory, WorkOrder, WorkOrderStatus } from '../types/fleet'

const WO_STATUS_FLOW: WorkOrderStatus[] = [
  'draft',
  'open',
  'approved',
  'in_progress',
  'waiting_parts',
  'completed',
  'closed',
]

export default function WorkOrders() {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    workOrders,
    workshops,
    partsInventory,
    createWorkOrder,
    updateWorkOrderStatus,
    addWorkOrderPart,
  } = useFleet()

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | WorkOrderStatus>('all')
  const [selectedWoId, setSelectedWoId] = useState<string | null>(workOrders[0]?.id ?? null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [partPickId, setPartPickId] = useState<string>(partsInventory[0]?.id ?? '')
  const [partPickQty, setPartPickQty] = useState(1)

  const [newWoForm, setNewWoForm] = useState({
    vehicleId: vehicles[0]?.id ?? '',
    title: '',
    description: '',
    healthArea: 'Vehicle Health' as FiveAreaHealthCategory,
    priority: 'medium' as WorkOrder['priority'],
    workshopId: workshops[0]?.id ?? '',
    laborCostInr: 2500,
    tasksText: 'Inspect assembly\nRoad test & torque check',
  })

  const canManage = canPerformAction(activeRole, 'manage_work_orders')

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'active') return wo.status !== 'completed' && wo.status !== 'closed'
      return wo.status === statusFilter
    })
  }, [workOrders, statusFilter])

  const selectedWo = useMemo(
    () => filteredWorkOrders.find((w) => w.id === selectedWoId) ?? filteredWorkOrders[0] ?? null,
    [filteredWorkOrders, selectedWoId],
  )

  const selectedVehicle = selectedWo ? vehicles.find((v) => v.id === selectedWo.vehicleId) : undefined

  const handleCreateWo = (e: React.FormEvent) => {
    e.preventDefault()
    const targetVeh = newWoForm.vehicleId || vehicles[0]?.id
    if (!targetVeh || !newWoForm.title.trim()) return
    const ws = workshops.find((w) => w.id === newWoForm.workshopId)
    try {
      const created = createWorkOrder({
        vehicleId: targetVeh,
        title: newWoForm.title.trim(),
        description: newWoForm.description.trim() || newWoForm.title.trim(),
        healthArea: newWoForm.healthArea,
        priority: newWoForm.priority,
        workshopId: ws?.id,
        workshopName: ws?.name ?? `${activeOrganization.city} Authorized Service Bay`,
        laborCostInr: Number(newWoForm.laborCostInr),
        tasks: newWoForm.tasksText
          .split('\n')
          .map((t) => t.trim())
          .filter(Boolean),
      })
      setSelectedWoId(created.id)
      setCreateModalOpen(false)
      setNewWoForm((f) => ({ ...f, title: '', description: '' }))
      toast.success(`Created Work Order ${created.workOrderNumber}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create Work Order.')
    }
  }

  const handleAllocatePart = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedWo || !partPickId) return
    try {
      addWorkOrderPart(selectedWo.id, partPickId, Number(partPickQty))
      toast.success('Allocated spare part from warehouse inventory & updated Work Order total.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to allocate part.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Workshop Work Orders</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Full job lifecycle (`draft → approved → in_progress → completed`) with real-time parts stock deduction
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={() => setCreateModalOpen(true)} className="btn-primary text-xs">
            <Plus className="w-4 h-4" />
            New Work Order
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="enterprise-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
          {(['all', 'active', 'draft', 'open', 'in_progress', 'waiting_parts', 'completed'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors ${
                statusFilter === st ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => navigate('/dashboard/inventory')} className="text-xs font-semibold text-[#6E5696] hover:underline">
          Check Parts Stock →
        </button>
      </div>

      {filteredWorkOrders.length === 0 ? (
        <EmptySectionState
          title="No work orders match this filter"
          description="Create a workshop work order or escalate a defect from Inspections or Small-Issue Logs."
          actionLabel={canManage ? 'New Work Order' : undefined}
          onAction={canManage ? () => setCreateModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Work Order Queue */}
          <div className="lg:col-span-5 enterprise-card divide-y divide-[#E5E5E5]/70 overflow-hidden">
            {filteredWorkOrders.map((wo) => {
              const veh = vehicles.find((v) => v.id === wo.vehicleId)
              const active = selectedWo?.id === wo.id
              return (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => setSelectedWoId(wo.id)}
                  className={`w-full p-4 text-left hover:bg-[#FAFAFA] transition-colors ${
                    active ? 'bg-[#EEE8F7]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#6E5696] tabular-nums">{wo.workOrderNumber}</span>
                    <SeverityText
                      severity={wo.status === 'completed' || wo.status === 'closed' ? 'normal' : wo.priority === 'critical' ? 'critical' : 'high'}
                      label={wo.status.replace('_', ' ')}
                    />
                  </div>
                  <p className="text-sm font-semibold text-[#625346] mt-1">{wo.title}</p>
                  <div className="flex items-center justify-between text-xs text-[#958777] mt-1">
                    <span>{veh?.registrationNumber ?? wo.vehicleId} · {wo.healthArea}</span>
                    <span className="font-bold text-[#625346] tabular-nums">{formatInr(wo.totalCostInr)}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected Work Order Inspector */}
          {selectedWo && (
            <div className="lg:col-span-7 enterprise-card p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#EEE8F7] text-[#6E5696] tabular-nums">
                      {selectedWo.workOrderNumber}
                    </span>
                    <SeverityText
                      severity={selectedWo.status === 'completed' || selectedWo.status === 'closed' ? 'normal' : 'high'}
                      label={selectedWo.status.replace('_', ' ')}
                    />
                  </div>
                  <h2 className="dm-section-title mt-2">{selectedWo.title}</h2>
                  <p className="text-xs text-[#958777] mt-1">
                    {selectedVehicle?.registrationNumber ?? selectedWo.vehicleId} · {selectedWo.workshopName} · Created {formatShortDate(selectedWo.createdAt)}
                  </p>
                </div>

                {canManage && (
                  <div>
                    <label htmlFor="wo-status-sel" className="sr-only">Update Work Order Status</label>
                    <select
                      id="wo-status-sel"
                      value={selectedWo.status}
                      onChange={(e) => {
                        updateWorkOrderStatus(selectedWo.id, e.target.value as WorkOrderStatus)
                        toast.success(`Updated ${selectedWo.workOrderNumber} to ${e.target.value.replace('_', ' ')}`)
                      }}
                      className="dm-input text-xs font-semibold capitalize"
                    >
                      {WO_STATUS_FLOW.map((st) => (
                        <option key={st} value={st}>{st.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <p className="text-xs text-[#625346] bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3.5">
                {selectedWo.description}
              </p>

              {/* Financial Cost Rollup */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-[#E5E5E5]">
                  <span className="text-[#958777] block">Labor & Workshop Fee</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{formatInr(selectedWo.laborCostInr)}</span>
                </div>
                <div className="p-3 rounded-xl border border-[#E5E5E5]">
                  <span className="text-[#958777] block">Allocated Parts</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{formatInr(selectedWo.partsCostInr)}</span>
                </div>
                <div className="p-3 rounded-xl border border-[#DDD3ED] bg-[#EEE8F7]/60">
                  <span className="text-[#6E5696] font-semibold block">Total Work Order Cost</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{formatInr(selectedWo.totalCostInr)}</span>
                </div>
              </div>

              {/* Tasks */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#625346] flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-[#6E5696]" />
                  Job Checklist ({selectedWo.tasks.length})
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {selectedWo.tasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[#625346] bg-[#FAFAFA] px-3 py-2 rounded-lg border border-[#E5E5E5]">
                      <Wrench className="w-3 h-3 text-[#6E5696]" />
                      <span>{t.title}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Spare Parts Allocation */}
              <div className="space-y-3 pt-2 border-t border-[#E5E5E5]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#625346]">Spare Parts Consumed from Stock ({selectedWo.parts.length})</h3>
                  <button type="button" onClick={() => navigate('/dashboard/financials')} className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1">
                    Financial Ledger ({selectedWo.paymentState})
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>

                {selectedWo.parts.length > 0 && (
                  <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-xl text-xs">
                    {selectedWo.parts.map((line, i) => (
                      <div key={`${line.partId}-${i}`} className="px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-[#625346]">{line.partName}</span>
                          <span className="text-[#958777] ml-2 font-mono">{line.sku}</span>
                        </div>
                        <span className="tabular-nums font-semibold text-[#625346]">
                          {line.quantity} × {formatInr(line.unitCostInr)} = {formatInr(line.totalCostInr)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {canManage && partsInventory.length > 0 && (
                  <form onSubmit={handleAllocatePart} className="flex flex-wrap items-end gap-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3 text-xs">
                    <div className="flex-1 min-w-[180px]">
                      <label htmlFor="wo-part-pick" className="dm-label">Consume Part from Warehouse</label>
                      <select id="wo-part-pick" value={partPickId} onChange={(e) => setPartPickId(e.target.value)} className="dm-input text-xs">
                        {partsInventory.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.stockQty} {p.unit} avail · {formatInr(p.unitCostInr)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-20">
                      <label htmlFor="wo-part-qty" className="dm-label">Qty</label>
                      <input id="wo-part-qty" type="number" min={1} value={partPickQty} onChange={(e) => setPartPickQty(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
                    </div>
                    <button type="submit" className="btn-accent text-xs px-3 py-2">
                      <PackagePlus className="w-3.5 h-3.5 text-[#6E5696]" />
                      Allocate Stock
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Work Order Modal */}
      <EnterpriseModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Create Workshop Work Order">
        <form onSubmit={handleCreateWo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="wo-veh" className="dm-label">Vehicle *</label>
              <select id="wo-veh" value={newWoForm.vehicleId || vehicles[0]?.id} onChange={(e) => setNewWoForm((f) => ({ ...f, vehicleId: e.target.value }))} className="dm-input">
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNumber} · {v.model}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="wo-area" className="dm-label">5-Area Health Category</label>
              <select id="wo-area" value={newWoForm.healthArea} onChange={(e) => setNewWoForm((f) => ({ ...f, healthArea: e.target.value as FiveAreaHealthCategory }))} className="dm-input">
                {(['Fuel Health', 'Engine Health', 'Tyre Health', 'Driver Health', 'Vehicle Health'] as FiveAreaHealthCategory[]).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="wo-title" className="dm-label">Work Order Title *</label>
            <input id="wo-title" required value={newWoForm.title} onChange={(e) => setNewWoForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Rear Axle Brake Lining & Drum Service" className="dm-input" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="wo-pri" className="dm-label">Priority</label>
              <select id="wo-pri" value={newWoForm.priority} onChange={(e) => setNewWoForm((f) => ({ ...f, priority: e.target.value as WorkOrder['priority'] }))} className="dm-input">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label htmlFor="wo-ws" className="dm-label">Workshop</label>
              <select id="wo-ws" value={newWoForm.workshopId} onChange={(e) => setNewWoForm((f) => ({ ...f, workshopId: e.target.value }))} className="dm-input">
                {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="wo-labor" className="dm-label">Labor Fee (INR)</label>
              <input id="wo-labor" type="number" min={0} value={newWoForm.laborCostInr} onChange={(e) => setNewWoForm((f) => ({ ...f, laborCostInr: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
          </div>
          <div>
            <label htmlFor="wo-tasks" className="dm-label">Tasks (one per line)</label>
            <textarea id="wo-tasks" rows={3} value={newWoForm.tasksText} onChange={(e) => setNewWoForm((f) => ({ ...f, tasksText: e.target.value }))} className="dm-input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Work Order</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
