import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Plus, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, MetricTile } from '../../components/ui/EnterprisePrimitives'
import { ResponsibilityBadge } from '../../components/contracts/ContractPrimitives'
import { computeMaintenanceSplit } from '../../utils/contractsEngine'
import type { ResponsibilityParty } from '../../types/contracts'

export function ContractMaintenancePage() {
  const navigate = useNavigate()
  const { contracts, maintenanceRules, maintenanceAllocations, hasPermission, updateMaintenanceAllocationStatus } =
    useContracts()
  const [busyId, setBusyId] = useState<string | null>(null)

  const totalRepair = maintenanceAllocations.reduce((s, a) => s + a.totalRepairAmountInr, 0)
  const orgTotal = maintenanceAllocations.reduce((s, a) => s + a.orgShareInr, 0)
  const supplierTotal = maintenanceAllocations.reduce((s, a) => s + a.supplierShareInr, 0)

  const handleStatus = async (allocId: string, status: 'approved' | 'settled' | 'disputed') => {
    setBusyId(allocId)
    try {
      await updateMaintenanceAllocationStatus(allocId, status)
      toast.success(`Maintenance allocation ${status}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update maintenance allocation')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Maintenance Responsibility & Split Ledger"
        subtitle="Single-transaction repair cost splitting across Company, Fleet Partner, Individual Owner, or Shared terms"
      >
        {hasPermission('manage_maintenance_responsibilities') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/maintenance/new')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Add Split Allocation / Rule
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile title="Total Contract Repairs" value={formatInr(totalRepair)} subtitle={`${maintenanceAllocations.length} allocation entries`} color="#6E5696" />
        <MetricTile title="Operating Company Share" value={formatInr(orgTotal)} subtitle="Zero duplicate ledger entries" color="#789A75" />
        <MetricTile title="Partner / Owner Share" value={formatInr(supplierTotal)} subtitle="Recoverable or supplier-borne" color="#D8B442" />
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-[#625346]">
            <Wrench className="w-4 h-4 text-[#6E5696]" />
            Single-Transaction Maintenance Cost Splits
          </div>
        </div>
        {maintenanceAllocations.length === 0 ? (
          <EmptySectionState
            title="No maintenance allocations logged"
            description="Record a third-party vehicle repair to allocate cost between company and supplier/owner."
            actionLabel={hasPermission('manage_maintenance_responsibilities') ? 'Add Split Allocation' : undefined}
            onAction={
              hasPermission('manage_maintenance_responsibilities')
                ? () => navigate('/dashboard/contracts/maintenance/new')
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle & Agreement</th>
                  <th>Total Repair</th>
                  <th>Responsibility</th>
                  <th>Company Share</th>
                  <th>Supplier Share</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceAllocations.map((a) => {
                  const c = contracts.find((x) => x.id === a.contractId)
                  const canApprove = hasPermission('approve_contract_maintenance')
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="font-bold text-xs text-[#625346]">{a.vehicleRegistration}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/register/${a.contractId}`)}
                          className="text-xs text-[#6E5696] hover:underline"
                        >
                          {c?.contractCode ?? a.contractId} · {(a.settlementMethod ?? '').replace(/_/g, ' ')}
                        </button>
                      </td>
                      <td className="text-xs font-bold tabular-nums text-[#625346]">
                        {formatInr(a.totalRepairAmountInr)}
                      </td>
                      <td>
                        <ResponsibilityBadge party={a.responsibleParty} />
                      </td>
                      <td className="text-xs tabular-nums">
                        {formatInr(a.orgShareInr)} ({a.orgSharePct}%)
                      </td>
                      <td className="text-xs tabular-nums">
                        {formatInr(a.supplierShareInr)} ({a.supplierSharePct}%)
                      </td>
                      <td className="text-xs font-semibold capitalize text-[#625346]">{a.status}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canApprove && a.status === 'pending_approval' && (
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => void handleStatus(a.id, 'approved')}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              Approve
                            </button>
                          )}
                          {canApprove && a.status === 'approved' && (
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => void handleStatus(a.id, 'settled')}
                              className="btn-primary text-[11px] px-2.5 py-1"
                            >
                              Settle
                            </button>
                          )}
                          {a.status !== 'disputed' && a.status !== 'settled' && (
                            <button
                              type="button"
                              disabled={busyId === a.id}
                              onClick={() => void handleStatus(a.id, 'disputed')}
                              className="btn-secondary text-[11px] px-2.5 py-1 text-[#A24034]"
                            >
                              Dispute
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] text-sm font-bold text-[#625346]">
          Category-Wise Contract Maintenance Responsibility Matrix ({maintenanceRules.length} rules)
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Category</th>
                <th>Default Party</th>
                <th>Org %</th>
                <th>Supplier %</th>
                <th>Pre-Approval Threshold</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceRules.map((r) => {
                const c = contracts.find((x) => x.id === r.contractId)
                return (
                  <tr key={r.id}>
                    <td className="text-xs font-semibold text-[#625346]">{c?.contractCode ?? r.contractId}</td>
                    <td className="text-xs capitalize text-[#625346]">{(r.category ?? '').replace(/_/g, ' ')}</td>
                    <td><ResponsibilityBadge party={r.responsibleParty} /></td>
                    <td className="text-xs tabular-nums">{r.orgSharePct}%</td>
                    <td className="text-xs tabular-nums">{r.supplierSharePct}%</td>
                    <td className="text-xs tabular-nums">{formatInr(r.preApprovalThresholdInr ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function ContractMaintenanceFormPage() {
  const navigate = useNavigate()
  const { contracts, saveMaintenanceRuleOrAllocation } = useContracts()
  const { vehicles } = useFleet()

  const [mode, setMode] = useState<'allocation' | 'rule'>('allocation')
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '')
  const [vehicleId, setVehicleId] = useState(
    vehicles.find((v) => (v.ownershipCategory ?? 'company_owned') !== 'company_owned')?.id ?? vehicles[0]?.id ?? '',
  )
  const [totalRepairAmountInr, setTotalRepairAmountInr] = useState(12500)
  const [responsibleParty, setResponsibleParty] = useState<ResponsibilityParty>('shared')
  const [orgSharePct, setOrgSharePct] = useState(60)
  const [settlementMethod, setSettlementMethod] = useState('deduct_from_payout')
  const [category, setCategory] = useState('engine_transmission')
  const [preApprovalThresholdInr, setPreApprovalThresholdInr] = useState(5000)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const split = useMemo(
    () =>
      computeMaintenanceSplit({
        totalRepairAmountInr,
        responsibleParty,
        orgSharePct,
      }),
    [orgSharePct, responsibleParty, totalRepairAmountInr],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!contractId) {
      setError('Please select a contract agreement.')
      return
    }
    const veh = vehicles.find((v) => v.id === vehicleId)
    setSaving(true)
    try {
      await saveMaintenanceRuleOrAllocation(
        mode === 'allocation'
          ? {
              mode: 'allocation',
              contractId,
              vehicleId,
              vehicleRegistration: veh?.registrationNumber ?? '',
              totalRepairAmountInr,
              responsibleParty,
              orgSharePct: split.orgSharePct,
              settlementMethod,
              notes,
            }
          : {
              mode: 'rule',
              contractId,
              category,
              responsibleParty,
              orgSharePct: split.orgSharePct,
              preApprovalThresholdInr,
              notes,
            },
      )
      toast.success(mode === 'allocation' ? 'Maintenance split allocation recorded' : 'Maintenance rule saved')
      navigate('/dashboard/contracts/maintenance')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save maintenance record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Add Contract Maintenance Split / Rule"
        subtitle="Record a single-transaction repair cost allocation or define category-wise maintenance responsibility"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/maintenance')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Contract Maintenance
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('allocation')}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border ${
              mode === 'allocation' ? 'bg-[#625346] text-white border-[#625346]' : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]'
            }`}
          >
            Single-Transaction Cost Split
          </button>
          <button
            type="button"
            onClick={() => setMode('rule')}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border ${
              mode === 'rule' ? 'bg-[#625346] text-white border-[#625346]' : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]'
            }`}
          >
            Category Split Rule
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Contract Agreement *</label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} className="dm-input text-xs">
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode} — {c.supplierName}
                </option>
              ))}
            </select>
          </div>
          {mode === 'allocation' ? (
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Vehicle *</label>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="dm-input text-xs">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} — {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Maintenance Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="dm-input text-xs">
                <option value="routine_service">Routine Service</option>
                <option value="engine_transmission">Engine & Transmission</option>
                <option value="tyres_battery">Tyres & Battery</option>
                <option value="accident_damage">Accident Damage</option>
                <option value="breakdown_towing">Breakdown & Towing</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Responsible Party</label>
            <select
              value={responsibleParty}
              onChange={(e) => setResponsibleParty(e.target.value as ResponsibilityParty)}
              className="dm-input text-xs"
            >
              <option value="operating_org">Operating Organization (100%)</option>
              <option value="supplier">Supplier / Owner (100%)</option>
              <option value="shared">Shared Split (Org % + Supplier %)</option>
            </select>
          </div>

          {responsibleParty === 'shared' && (
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Company Share (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={orgSharePct}
                onChange={(e) => setOrgSharePct(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
          )}

          {mode === 'allocation' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-[#625346] mb-1">Total Repair Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={totalRepairAmountInr}
                  onChange={(e) => setTotalRepairAmountInr(Number(e.target.value))}
                  className="dm-input text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#625346] mb-1">Settlement Method</label>
                <select value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value)} className="dm-input text-xs">
                  <option value="deduct_from_payout">Deduct from Supplier Payout</option>
                  <option value="supplier_reimburses">Supplier Reimburses Company</option>
                  <option value="deduct_from_deposit">Deduct from Security Deposit</option>
                  <option value="company_absorbed">Company Absorbed</option>
                </select>
              </div>
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Pre-Approval Threshold (₹)</label>
              <input
                type="number"
                min={0}
                value={preApprovalThresholdInr}
                onChange={(e) => setPreApprovalThresholdInr(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Work / Invoice Reference Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>

        {mode === 'allocation' && (
          <div className="p-4 rounded-[10px] bg-[#FAFAFA] border border-[#E5E5E5] grid grid-cols-3 gap-4 text-xs">
            <div>
              <div className="text-[#958777]">Single Repair Total</div>
              <div className="text-base font-bold text-[#625346] tabular-nums">{formatInr(totalRepairAmountInr)}</div>
            </div>
            <div>
              <div className="text-[#958777]">Company Share ({split.orgSharePct}%)</div>
              <div className="text-base font-bold text-[#6E5696] tabular-nums">{formatInr(split.orgShareInr)}</div>
            </div>
            <div>
              <div className="text-[#958777]">Supplier Share ({split.supplierSharePct}%)</div>
              <div className="text-base font-bold text-[#8F6510] tabular-nums">{formatInr(split.supplierShareInr)}</div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/maintenance')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Maintenance Entry'}
          </button>
        </div>
      </form>
    </div>
  )
}
