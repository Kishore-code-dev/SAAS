import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { IdCard, Plus, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import type { IndividualVehicleOwner } from '../../types/contracts'
import {
  Card,
  ContractPage,
  ContractStatusBadge,
  DataTable,
  ErrorBlock,
  Field,
  GhostButton,
  Input,
  LoadingBlock,
  OwnershipBadge,
  PrimaryButton,
  SectionTitle,
  Select,
  Textarea,
  Toolbar,
  inr,
  shortDate,
} from './ContractUi'

const emptyOwner = {
  fullName: '',
  mobile: '',
  email: '',
  address: '',
  identityVerificationStatus: 'pending',
  identityDocumentType: 'Aadhaar',
  identityDocumentMasked: '',
  bankAccountMasked: '',
  bankIfsc: '',
  paymentPreference: 'bank_transfer',
  notes: '',
}

export default function IndividualOwnersPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'vehicles' | 'contracts' | 'payments' | 'deposits' | 'documents' | 'activity'>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<IndividualVehicleOwner | null>(null)
  const [form, setForm] = useState(emptyOwner)
  const [saving, setSaving] = useState(false)

  const canManage = canPerformContractAction(activeRole, 'manage_individual_owners')
  const owners = data?.owners ?? []
  const selected = owners.find((o) => o.id === selectedId) ?? owners[0] ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return owners.filter((o) => !q || `${o.fullName} ${o.mobile} ${o.email} ${o.identityDocumentMasked}`.toLowerCase().includes(q))
  }, [owners, search])

  const profile = (ownerId: string) => {
    if (!data) return null
    const contracts = data.contracts.filter((c) => c.individualOwnerId === ownerId)
    const ids = new Set(contracts.map((c) => c.id))
    return {
      contracts,
      vehicles: contracts.flatMap((c) => c.vehicles),
      payments: data.payments.filter((p) => ids.has(p.contractId)),
      deposits: data.deposits.filter((d) => ids.has(d.contractId)),
      documents: data.documents.filter((d) => ids.has(d.contractId)),
      activity: data.activity.filter((a) => ids.has(a.contractId)),
      totalRental: contracts.reduce((s, c) => s + c.financialTerms.monthlyRentalInr, 0),
      outstanding: data.payments.filter((p) => ids.has(p.contractId)).reduce((s, p) => s + p.outstandingAmountInr, 0),
      depositsHeld: data.deposits.filter((d) => ids.has(d.contractId)).reduce((s, d) => s + d.paidAmountInr, 0),
    }
  }

  const openCreate = () => { setEditing(null); setForm(emptyOwner); setModalOpen(true) }
  const openEdit = (owner: IndividualVehicleOwner) => {
    setEditing(owner)
    setForm({
      fullName: owner.fullName,
      mobile: owner.mobile,
      email: owner.email,
      address: owner.address,
      identityVerificationStatus: owner.identityVerificationStatus,
      identityDocumentType: owner.identityDocumentType,
      identityDocumentMasked: owner.identityDocumentMasked,
      bankAccountMasked: owner.bankAccountMasked,
      bankIfsc: owner.bankIfsc,
      paymentPreference: owner.paymentPreference,
      notes: owner.notes,
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.fullName.trim()) { toast.error('Owner name is required.'); return }
    setSaving(true)
    try {
      if (editing) {
        await contractRequest(`/owners/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(form) })
        toast.success('Individual owner updated.')
      } else {
        await contractRequest('/owners', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Individual owner added.')
      }
      setModalOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save owner.')
    } finally {
      setSaving(false)
    }
  }

  const detail = selected ? profile(selected.id) : null

  return (
    <ContractPage
      title="Individual Vehicle Owners"
      subtitle="Independent owners who supply vehicles. Owners are separate records from drivers and platform users; identity and bank data stay masked."
      actions={canManage ? <PrimaryButton onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Add Individual Owner</PrimaryButton> : undefined}
    >
      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-4 items-start">
          <div className="space-y-3">
            <Toolbar search={search} onSearch={setSearch} placeholder="Search owner, mobile, email or masked ID" />
            <DataTable
              rows={filtered}
              rowKey={(o) => o.id}
              pageSize={8}
              onRowClick={(o) => { setSelectedId(o.id); setTab('overview') }}
              emptyTitle="No individual owners yet"
              emptyDescription="Add an independent vehicle owner before creating an individually supplied vehicle agreement."
              columns={[
                {
                  key: 'owner',
                  label: 'Owner',
                  render: (o) => (
                    <div>
                      <p className="text-xs font-bold text-[#625346]">{o.fullName}</p>
                      <p className="text-[10px] text-[#958777]">{o.mobile || '—'} · {o.identityVerificationStatus}</p>
                    </div>
                  ),
                },
                { key: 'vehicles', label: 'Vehicles', render: (o) => <span className="text-xs tabular-nums">{profile(o.id)?.vehicles.length ?? 0}</span> },
                { key: 'status', label: 'Status', render: (o) => <OwnershipBadge type="individual_owner" /> },
              ]}
            />
          </div>

          {selected && detail ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-[#FCF5DE] text-[#8E6F19] flex items-center justify-center"><UserRound className="w-4 h-4" /></div>
                  <div>
                    <h2 className="text-sm font-bold text-[#625346]">{selected.fullName}</h2>
                    <p className="text-[10px] text-[#958777]">{selected.mobile || '—'} · {selected.email || '—'}</p>
                  </div>
                </div>
                {canManage && <GhostButton onClick={() => openEdit(selected)}>Edit owner</GhostButton>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {[
                  { label: 'Vehicles supplied', value: detail.vehicles.length },
                  { label: 'Contracts', value: detail.contracts.length },
                  { label: 'Monthly commitment', value: inr(detail.totalRental) },
                  { label: 'Outstanding', value: inr(detail.outstanding) },
                  { label: 'Deposits held', value: inr(detail.depositsHeld) },
                  { label: 'Identity', value: selected.identityVerificationStatus },
                  { label: 'Payment preference', value: selected.paymentPreference.replace(/_/g, ' ') },
                  { label: 'Documents', value: detail.documents.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-[#FAF7EF] px-2.5 py-2">
                    <p className="text-[10px] text-[#958777]">{item.label}</p>
                    <p className="text-xs font-bold text-[#625346] mt-0.5 capitalize">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1 mt-4 border-b border-[#E5E5E5]">
                {(['overview', 'vehicles', 'contracts', 'payments', 'deposits', 'documents', 'activity'] as const).map((item) => (
                  <button key={item} type="button" onClick={() => setTab(item)} className={`px-2.5 py-2 text-[11px] font-semibold capitalize border-b-2 -mb-px ${tab === item ? 'border-[#B8A3D9] text-[#625346]' : 'border-transparent text-[#958777] hover:text-[#625346]'}`}>{item}</button>
                ))}
              </div>

              <div className="pt-3 text-xs text-[#625346] space-y-2">
                {tab === 'overview' && (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-[#E5E5E5] p-3">
                      <p className="text-[10px] text-[#958777]">Address</p><p className="text-[11px] mt-1">{selected.address || '—'}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777] inline-flex items-center gap-1"><IdCard className="w-3 h-3" /> Identity (masked)</p><p className="text-[11px] mt-1">{selected.identityDocumentType} · {selected.identityDocumentMasked || '—'}</p></div>
                      <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777] inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Bank (masked)</p><p className="text-[11px] mt-1">{selected.bankAccountMasked || '—'} · {selected.bankIfsc || '—'}</p></div>
                    </div>
                    <p className="text-[11px] text-[#958777]">{selected.notes || 'No internal notes recorded.'}</p>
                  </div>
                )}
                {tab === 'vehicles' && (detail.vehicles.length ? detail.vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2">
                    <Link to={`/dashboard/fleet/vehicles/${v.vehicleId}`} className="font-semibold text-[#6E5696]">{v.vehicleRegistration}</Link>
                    <span className="text-[10px] text-[#958777]">{v.vehicleCategory} · {v.condition}</span>
                  </div>
                )) : <p className="text-[11px] text-[#958777]">No vehicles supplied yet.</p>)}
                {tab === 'contracts' && (detail.contracts.length ? detail.contracts.map((c) => (
                  <Link key={c.id} to={`/dashboard/contracts/${c.id}`} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2 hover:bg-[#FAF7EF]">
                    <span><span className="font-semibold">{c.contractNumber}</span> · {c.name}</span>
                    <ContractStatusBadge status={c.status} />
                  </Link>
                )) : <p className="text-[11px] text-[#958777]">No contracts yet.</p>)}
                {tab === 'payments' && (detail.payments.length ? detail.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2"><span>{p.billingPeriod} · due {shortDate(p.dueDate)}</span><span className="tabular-nums">{inr(p.amountInr)}</span></div>
                )) : <p className="text-[11px] text-[#958777]">No payments recorded.</p>)}
                {tab === 'deposits' && (detail.deposits.length ? detail.deposits.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2"><span>{d.depositType.replace(/_/g, ' ')}</span><span className="tabular-nums">paid {inr(d.paidAmountInr)} / {inr(d.requiredAmountInr)}</span></div>
                )) : <p className="text-[11px] text-[#958777]">No deposits recorded.</p>)}
                {tab === 'documents' && (detail.documents.length ? detail.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2"><span>{d.name}</span><span className="text-[10px] text-[#958777]">{d.category}</span></div>
                )) : <p className="text-[11px] text-[#958777]">No documents linked.</p>)}
                {tab === 'activity' && (detail.activity.length ? detail.activity.slice(0, 30).map((a) => (
                  <div key={a.id} className="border-b border-[#F0F0F0] pb-1.5"><p className="text-[11px]">{a.summary}</p><p className="text-[10px] text-[#958777]">{a.actor} · {shortDate(a.createdAt)}</p></div>
                )) : <p className="text-[11px] text-[#958777]">No activity yet.</p>)}
              </div>
            </Card>
          ) : (
            <Card><SectionTitle title="Select an individual owner" hint="Choose an owner to inspect supplied vehicles, contracts and deposits." /></Card>
          )}
        </div>
      )}

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Individual Owner' : 'Add Individual Owner'} subtitle="Identity and bank details are stored masked for role-based access." maxWidthClass="max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <Field label="Full name"><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Identity verification">
            <Select value={form.identityVerificationStatus} onChange={(e) => setForm({ ...form, identityVerificationStatus: e.target.value })}>
              <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
            </Select>
          </Field>
          <Field label="Identity document type"><Input value={form.identityDocumentType} onChange={(e) => setForm({ ...form, identityDocumentType: e.target.value })} /></Field>
          <Field label="Identity document (masked)"><Input value={form.identityDocumentMasked} onChange={(e) => setForm({ ...form, identityDocumentMasked: e.target.value })} placeholder="XXXX-XXXX-7712" /></Field>
          <Field label="Bank account (masked)"><Input value={form.bankAccountMasked} onChange={(e) => setForm({ ...form, bankAccountMasked: e.target.value })} /></Field>
          <Field label="Bank IFSC"><Input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} /></Field>
          <Field label="Payment preference">
            <Select value={form.paymentPreference} onChange={(e) => setForm({ ...form, paymentPreference: e.target.value })}>
              <option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cash">Cash</option><option value="cheque">Cheque</option>
            </Select>
          </Field>
          <Field label="Address"><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setModalOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Owner'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
