import React, { useMemo, useState } from 'react'
import { CheckCircle2, CircleDollarSign, Plus, Wrench, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import {
  ContractPage,
  DataTable,
  ErrorBlock,
  Field,
  FilterSelect,
  GhostButton,
  Input,
  LoadingBlock,
  PrimaryButton,
  ResponsibilityBadge,
  Select,
  Textarea,
  Toolbar,
  inr,
  shortDate,
} from './ContractUi'

export default function ContractMaintenancePage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [approvalFilter, setApprovalFilter] = useState('all')
  const [settlementFilter, setSettlementFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    contractId: '',
    vehicleId: '',
    category: 'General',
    description: '',
    total: '',
    orgShare: '',
    supplierShare: '',
    responsibility: 'shared',
  })
  const [saving, setSaving] = useState(false)

  const canManage = canPerformContractAction(activeRole, 'manage_contract_maintenance')
  const canApprove = canPerformContractAction(activeRole, 'approve_contract_maintenance')
  const allocations = data?.maintenance ?? []
  const contracts = data?.contracts ?? []
  const activeContract = contracts.find((c) => c.id === form.contractId) ?? contracts[0]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allocations.filter((m) => {
      if (approvalFilter !== 'all' && m.approvalStatus !== approvalFilter) return false
      if (settlementFilter !== 'all' && m.settlementStatus !== settlementFilter) return false
      if (!q) return true
      return `${m.vehicleRegistration} ${m.category} ${m.description}`.toLowerCase().includes(q)
    })
  }, [allocations, search, approvalFilter, settlementFilter])

  const totals = {
    total: allocations.reduce((s, m) => s + m.totalCostInr, 0),
    org: allocations.reduce((s, m) => s + m.operatingOrgShareInr, 0),
    supplier: allocations.reduce((s, m) => s + m.supplierShareInr, 0),
    unsettled: allocations
      .filter((m) => m.approvalStatus === 'approved' && m.settlementStatus === 'unsettled')
      .reduce((s, m) => s + m.supplierShareInr, 0),
  }

  const decide = async (contractId: string, allocationId: string, approve: boolean) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/maintenance/${encodeURIComponent(allocationId)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
      })
      toast.success(approve ? 'Maintenance allocation approved.' : 'Maintenance allocation rejected.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update allocation.')
    }
  }

  const settle = async (contractId: string, allocationId: string) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/maintenance/${encodeURIComponent(allocationId)}/settle`, { method: 'POST' })
      toast.success('Supplier share settled.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to settle allocation.')
    }
  }

  const create = async () => {
    const total = Number(form.total || 0)
    const orgShare = Number(form.orgShare || 0)
    const supplierShare = Number(form.supplierShare || 0)
    if (!form.contractId || !form.vehicleId) { toast.error('Select a contract and vehicle.'); return }
    if (total <= 0) { toast.error('Total cost must be greater than zero.'); return }
    if (orgShare + supplierShare !== total) { toast.error('Shares must add up to the total cost.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(form.contractId)}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: form.vehicleId,
          category: form.category,
          description: form.description,
          totalCostInr: total,
          operatingOrgShareInr: orgShare,
          supplierShareInr: supplierShare,
          responsibility: form.responsibility,
        }),
      })
      toast.success('Maintenance allocation created for approval.')
      setCreateOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create allocation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ContractPage
      title="Contract Maintenance"
      subtitle="Maintenance cost split between the operating organization and the supplier. Settlement follows approval, never the reverse."
      actions={canManage ? <PrimaryButton onClick={() => { setForm({ ...form, contractId: contracts[0]?.id ?? '', vehicleId: contracts[0]?.vehicles[0]?.vehicleId ?? '' }); setCreateOpen(true) }}><Plus className="w-3.5 h-3.5" /> Allocate Cost</PrimaryButton> : undefined}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total maintenance', value: inr(totals.total), icon: Wrench },
          { label: 'Operating org share', value: inr(totals.org), icon: CircleDollarSign },
          { label: 'Supplier share', value: inr(totals.supplier), icon: CircleDollarSign },
          { label: 'Unsettled supplier share', value: inr(totals.unsettled), icon: CircleDollarSign },
        ].map((item) => (
          <div key={item.label} className="enterprise-card p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-[#958777]">{item.label}</span><item.icon className="w-4 h-4 text-[#958777]" /></div>
            <p className="text-lg font-bold text-[#625346] tabular-nums mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search registration, category or description"
        filters={
          <>
            <FilterSelect label="approval" value={approvalFilter} onChange={setApprovalFilter} options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} />
            <FilterSelect label="settlement" value={settlementFilter} onChange={setSettlementFilter} options={[{ value: 'unsettled', label: 'Unsettled' }, { value: 'settled', label: 'Settled' }]} />
          </>
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(m) => m.id}
          emptyTitle="No maintenance allocations"
          emptyDescription="Allocate a work-order cost to split responsibility between the operating organization and the supplier."
          columns={[
            { key: 'vehicle', label: 'Vehicle / Work', render: (m) => <div><p className="text-xs font-bold text-[#625346]">{m.vehicleRegistration}</p><p className="text-[10px] text-[#958777]">{m.category} · {shortDate(m.createdAt)}</p></div> },
            { key: 'description', label: 'Description', render: (m) => <span className="text-[11px] text-[#958777] line-clamp-2 max-w-[220px] block">{m.description}</span> },
            { key: 'total', label: 'Total', className: 'text-right', render: (m) => <span className="text-xs tabular-nums">{inr(m.totalCostInr)}</span> },
            { key: 'org', label: 'Operating Org', className: 'text-right', render: (m) => <span className="text-xs tabular-nums">{inr(m.operatingOrgShareInr)}</span> },
            { key: 'supplier', label: 'Supplier', className: 'text-right', render: (m) => <span className="text-xs tabular-nums">{inr(m.supplierShareInr)}</span> },
            { key: 'responsibility', label: 'Responsibility', render: (m) => <ResponsibilityBadge value={m.responsibility} /> },
            { key: 'approval', label: 'Approval', render: (m) => <span className={`text-[10px] font-bold uppercase ${m.approvalStatus === 'approved' ? 'text-[#4D6E4A]' : m.approvalStatus === 'rejected' ? 'text-[#B84E42]' : 'text-[#8E6F19]'}`}>{m.approvalStatus}</span> },
            { key: 'settlement', label: 'Settlement', render: (m) => <span className={`text-[10px] font-bold uppercase ${m.settlementStatus === 'settled' ? 'text-[#4D6E4A]' : 'text-[#8E6F19]'}`}>{m.settlementStatus}</span> },
          ]}
          actions={(m) => (
            <>
              {canApprove && m.approvalStatus === 'pending' && (
                <>
                  <GhostButton onClick={() => void decide(m.contractId, m.id, true)} aria-label="Approve allocation"><CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A]" /></GhostButton>
                  <GhostButton onClick={() => void decide(m.contractId, m.id, false)} aria-label="Reject allocation"><XCircle className="w-3.5 h-3.5 text-[#B84E42]" /></GhostButton>
                </>
              )}
              {canApprove && m.approvalStatus === 'approved' && m.settlementStatus === 'unsettled' && (
                <GhostButton onClick={() => void settle(m.contractId, m.id)}>Settle</GhostButton>
              )}
            </>
          )}
        />
      )}

      <EnterpriseModal open={createOpen} onClose={() => setCreateOpen(false)} title="Allocate Maintenance Cost" subtitle="The split must equal the total. Supplier settlement is blocked until approval." maxWidthClass="max-w-2xl">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Contract">
              <Select value={form.contractId} onChange={(e) => {
                const contract = contracts.find((c) => c.id === e.target.value)
                setForm({ ...form, contractId: e.target.value, vehicleId: contract?.vehicles[0]?.vehicleId ?? '' })
              }}>
                <option value="">Select contract…</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNumber} · {c.supplierName}</option>)}
              </Select>
            </Field>
            <Field label="Vehicle">
              <Select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">Select vehicle…</option>
                {(activeContract?.vehicles ?? []).map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.vehicleRegistration}</option>)}
              </Select>
            </Field>
            <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Responsibility">
              <Select value={form.responsibility} onChange={(e) => setForm({ ...form, responsibility: e.target.value })}>
                <option value="shared">Shared</option><option value="operating_org">Operating organization</option><option value="supplier">Supplier</option>
              </Select>
            </Field>
            <Field label="Total cost (INR)"><Input type="number" min="1" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} /></Field>
            <Field label="Operating org share (INR)"><Input type="number" min="0" value={form.orgShare} onChange={(e) => setForm({ ...form, orgShare: e.target.value })} /></Field>
            <Field label="Supplier share (INR)"><Input type="number" min="0" value={form.supplierShare} onChange={(e) => setForm({ ...form, supplierShare: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void create()} disabled={saving}>{saving ? 'Saving…' : 'Create Allocation'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
