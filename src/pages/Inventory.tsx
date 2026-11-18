import React, { useState } from 'react'
import { AlertTriangle, Boxes, PackageCheck, Plus, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { canPerformAction } from '../utils/rbac'
import {
  EnterpriseModal,
  formatDateTime,
  formatInr,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import type { PartInventoryItem } from '../types/fleet'

export default function Inventory() {
  const {
    activeOrganization,
    activeRole,
    partsInventory,
    suppliers,
    purchaseOrders,
    inventoryTransactions,
    addPartInventory,
    adjustPartStock,
    createPurchaseOrder,
    receivePurchaseOrderItems,
  } = useFleet()

  const [tab, setTab] = useState<'parts' | 'po' | 'suppliers' | 'audit'>('parts')
  const [addPartOpen, setAddPartOpen] = useState(false)
  const [createPoOpen, setCreatePoOpen] = useState(false)

  const [partForm, setPartForm] = useState({
    sku: '',
    name: '',
    category: 'Vehicle Health' as PartInventoryItem['category'],
    unit: 'pcs',
    stockQty: 10,
    reorderThreshold: 4,
    unitCostInr: 1200,
    warehouseLocation: `${activeOrganization.city} Main Depot Store`,
  })

  const [poSupplierId, setPoSupplierId] = useState(suppliers[0]?.id ?? '')
  const [poPartId, setPoPartId] = useState(partsInventory[0]?.id ?? '')
  const [poQty, setPoQty] = useState(6)

  const canManageInv = canPerformAction(activeRole, 'manage_inventory')
  const lowStockParts = partsInventory.filter((p) => p.stockQty <= p.reorderThreshold)

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault()
    if (!partForm.sku.trim() || !partForm.name.trim()) return
    try {
      addPartInventory({
        sku: partForm.sku.trim().toUpperCase(),
        name: partForm.name.trim(),
        category: partForm.category,
        unit: partForm.unit.trim() || 'pcs',
        stockQty: Number(partForm.stockQty),
        reorderThreshold: Number(partForm.reorderThreshold),
        unitCostInr: Number(partForm.unitCostInr),
        warehouseLocation: partForm.warehouseLocation.trim(),
      })
      toast.success(`Added spare part ${partForm.sku.toUpperCase()} to warehouse stock.`)
      setAddPartOpen(false)
      setPartForm((f) => ({ ...f, sku: '', name: '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add part.')
    }
  }

  const handleCreatePo = (e: React.FormEvent) => {
    e.preventDefault()
    const supId = poSupplierId || suppliers[0]?.id
    const pId = poPartId || partsInventory[0]?.id
    if (!supId || !pId) return
    try {
      const po = createPurchaseOrder({
        supplierId: supId,
        items: [{ partId: pId, orderedQty: Number(poQty) }],
        expectedAt: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
      })
      toast.success(`Issued Purchase Order ${po.poNumber}`)
      setCreatePoOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create Purchase Order.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Parts Inventory & Procurement</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Warehouse stock levels, Purchase Order receiving, suppliers & stock audit ledger
          </p>
        </div>
        {canManageInv && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" onClick={() => setCreatePoOpen(true)} className="btn-accent text-xs">
              <Truck className="w-3.5 h-3.5 text-[#6E5696]" />
              Issue Purchase Order
            </button>
            <button type="button" onClick={() => setAddPartOpen(true)} className="btn-primary text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Part SKU
            </button>
          </div>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Active SKUs</span>
          <p className="dm-kpi-value mt-1 flex items-center gap-2">
            <Boxes className="w-5 h-5 text-[#6E5696]" />
            {partsInventory.length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Low-Stock Reorder Alerts</span>
          <p className="dm-kpi-value mt-1 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#A24034]" />
            {lowStockParts.length}
          </p>
        </div>
        <div className="enterprise-card p-4">
          <span className="text-xs font-semibold text-[#958777]">Inventory Valuation</span>
          <p className="dm-kpi-value mt-1">
            {formatInr(partsInventory.reduce((s, p) => s + p.stockQty * p.unitCostInr, 0))}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[#E5E5E5] overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {[
            { id: 'parts', label: `Parts Stock (${partsInventory.length})` },
            { id: 'po', label: `Purchase Orders (${purchaseOrders.length})` },
            { id: 'suppliers', label: `Suppliers (${suppliers.length})` },
            { id: 'audit', label: `Stock Audit Trail (${inventoryTransactions.length})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === item.id ? 'border-[#6E5696] text-[#625346]' : 'border-transparent text-[#958777] hover:text-[#625346]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'parts' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Part Name</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Unit Cost</th>
                  <th>In Stock</th>
                  <th className="text-right">Quick Adjust</th>
                </tr>
              </thead>
              <tbody>
                {partsInventory.map((p) => {
                  const isLow = p.stockQty <= p.reorderThreshold
                  return (
                    <tr key={p.id}>
                      <td className="font-mono text-xs font-bold text-[#6E5696]">{p.sku}</td>
                      <td className="font-semibold text-[#625346]">{p.name}</td>
                      <td className="text-xs text-[#958777]">{p.category}</td>
                      <td className="text-xs text-[#958777]">{p.warehouseLocation}</td>
                      <td className="tabular-nums">{formatInr(p.unitCostInr)}</td>
                      <td>
                        <SeverityText
                          severity={p.stockQty === 0 ? 'critical' : isLow ? 'high' : 'normal'}
                          label={`${p.stockQty} ${p.unit}${isLow ? ` (Reorder ≤${p.reorderThreshold})` : ''}`}
                        />
                      </td>
                      <td className="text-right">
                        {canManageInv && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => adjustPartStock(p.id, -1, 'Manual depot issue')}
                              disabled={p.stockQty <= 0}
                              className="px-2 py-0.5 rounded border border-[#E5E5E5] text-xs font-semibold hover:bg-[#EEE8F7] disabled:opacity-40"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => adjustPartStock(p.id, 1, 'Manual bin count restock')}
                              className="px-2 py-0.5 rounded border border-[#E5E5E5] text-xs font-semibold hover:bg-[#EEE8F7]"
                            >
                              +1
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'po' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Line Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th className="text-right">Receiving</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => {
                  const hasPending = po.items.some((i) => i.receivedQty < i.orderedQty)
                  return (
                    <tr key={po.id}>
                      <td className="font-mono font-bold text-[#6E5696]">{po.poNumber}</td>
                      <td className="font-medium text-[#625346]">{po.supplierName}</td>
                      <td className="text-xs text-[#958777]">
                        {po.items.map((it) => `${it.partName} (${it.receivedQty}/${it.orderedQty})`).join(', ')}
                      </td>
                      <td className="tabular-nums font-semibold">{formatInr(po.totalAmountInr)}</td>
                      <td>
                        <SeverityText
                          severity={po.status === 'received' ? 'normal' : po.status === 'partially_received' ? 'moderate' : 'high'}
                          label={po.status.replace(/_/g, ' ')}
                        />
                      </td>
                      <td className="text-right">
                        {canManageInv && hasPending && (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const map: Record<string, number> = {}
                                po.items.forEach((it) => {
                                  const rem = it.orderedQty - it.receivedQty
                                  if (rem > 0) map[it.partId] = Math.max(1, Math.ceil(rem / 2))
                                })
                                receivePurchaseOrderItems(po.id, map)
                                toast.success(`Recorded partial receipt on ${po.poNumber} & updated warehouse stock.`)
                              }}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              Receive Partial
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const map: Record<string, number> = {}
                                po.items.forEach((it) => {
                                  const rem = it.orderedQty - it.receivedQty
                                  if (rem > 0) map[it.partId] = rem
                                })
                                receivePurchaseOrderItems(po.id, map)
                                toast.success(`Received remaining units for ${po.poNumber}.`)
                              }}
                              className="btn-primary text-[11px] px-2.5 py-1"
                            >
                              <PackageCheck className="w-3 h-3" />
                              Receive Full
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => (
            <div key={sup.id} className="enterprise-card p-5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#625346]">{sup.name}</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#EEE8F7] text-[#6E5696] font-bold">{sup.rating} ★</span>
              </div>
              <p className="text-[#958777]">{sup.city} · Lead time {sup.leadTimeDays} day(s)</p>
              <p className="text-[#625346]">Contact: {sup.contactName} ({sup.phone})</p>
              {sup.gstin && <p className="font-mono text-[11px] text-[#958777]">GSTIN: {sup.gstin}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'audit' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Part</th>
                <th>Type</th>
                <th>Delta</th>
                <th>Balance After</th>
                <th>Reference</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {inventoryTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="font-semibold text-[#625346]">{tx.partName}</td>
                  <td className="text-xs uppercase">{tx.type.replace('_', ' ')}</td>
                  <td className={`tabular-nums font-bold ${tx.quantityDelta >= 0 ? 'text-[#4D6E4A]' : 'text-[#A24034]'}`}>
                    {tx.quantityDelta >= 0 ? `+${tx.quantityDelta}` : tx.quantityDelta}
                  </td>
                  <td className="tabular-nums font-semibold">{tx.balanceAfter}</td>
                  <td className="text-xs text-[#958777]">{tx.referenceType} · {tx.referenceId}</td>
                  <td className="text-xs tabular-nums text-[#958777]">{formatDateTime(tx.timestamp)}</td>
                </tr>
              ))}
              {inventoryTransactions.length === 0 && (
                <tr><td colSpan={6} className="text-center text-xs text-[#958777] py-6">No stock movements logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <EnterpriseModal open={addPartOpen} onClose={() => setAddPartOpen(false)} title="Add Spare Part SKU">
        <form onSubmit={handleAddPart} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prt-sku" className="dm-label">SKU Code *</label>
              <input id="prt-sku" required value={partForm.sku} onChange={(e) => setPartForm((f) => ({ ...f, sku: e.target.value }))} placeholder="BRK-PAD-401" className="dm-input font-mono uppercase" />
            </div>
            <div>
              <label htmlFor="prt-cat" className="dm-label">Category</label>
              <select id="prt-cat" value={partForm.category} onChange={(e) => setPartForm((f) => ({ ...f, category: e.target.value as PartInventoryItem['category'] }))} className="dm-input">
                {['Fuel Health', 'Engine Health', 'Tyre Health', 'Vehicle Health', 'Consumables', 'Safety'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="prt-name" className="dm-label">Part Name *</label>
            <input id="prt-name" required value={partForm.name} onChange={(e) => setPartForm((f) => ({ ...f, name: e.target.value }))} className="dm-input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="prt-qty" className="dm-label">Initial Stock</label>
              <input id="prt-qty" type="number" min={0} value={partForm.stockQty} onChange={(e) => setPartForm((f) => ({ ...f, stockQty: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="prt-th" className="dm-label">Reorder At</label>
              <input id="prt-th" type="number" min={0} value={partForm.reorderThreshold} onChange={(e) => setPartForm((f) => ({ ...f, reorderThreshold: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
            <div>
              <label htmlFor="prt-cost" className="dm-label">Unit Cost (INR)</label>
              <input id="prt-cost" type="number" min={0} value={partForm.unitCostInr} onChange={(e) => setPartForm((f) => ({ ...f, unitCostInr: Number(e.target.value) }))} className="dm-input tabular-nums" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAddPartOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Part</button>
          </div>
        </form>
      </EnterpriseModal>

      <EnterpriseModal open={createPoOpen} onClose={() => setCreatePoOpen(false)} title="Issue Purchase Order">
        <form onSubmit={handleCreatePo} className="space-y-4">
          <div>
            <label htmlFor="po-sup" className="dm-label">Supplier</label>
            <select id="po-sup" value={poSupplierId || suppliers[0]?.id} onChange={(e) => setPoSupplierId(e.target.value)} className="dm-input">
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.city})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label htmlFor="po-part" className="dm-label">Spare Part</label>
              <select id="po-part" value={poPartId || partsInventory[0]?.id} onChange={(e) => setPoPartId(e.target.value)} className="dm-input">
                {partsInventory.map((p) => <option key={p.id} value={p.id}>{p.name} ({formatInr(p.unitCostInr)})</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="po-qty" className="dm-label">Order Qty</label>
              <input id="po-qty" type="number" min={1} value={poQty} onChange={(e) => setPoQty(Number(e.target.value))} className="dm-input tabular-nums" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreatePoOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Issue PO</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
