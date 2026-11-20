import React, { useMemo, useState } from 'react'
import { Building2, Mail, MapPin, Phone, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useContractWorkspace, contractRequest } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import type { FleetPartner } from '../../types/contracts'
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
  Textarea,
  Toolbar,
  inr,
  shortDate,
} from './ContractUi'

const emptyPartner = {
  companyName: '',
  registrationNumber: '',
  gstin: '',
  contactPerson: '',
  mobile: '',
  email: '',
  registeredAddress: '',
  operatingLocation: '',
  bankAccountMasked: '',
  bankIfsc: '',
  notes: '',
}

export default function FleetPartnersPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'vehicles' | 'contracts' | 'payments' | 'maintenance' | 'documents' | 'activity'>('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FleetPartner | null>(null)
  const [form, setForm] = useState(emptyPartner)
  const [saving, setSaving] = useState(false)

  const canManage = canPerformContractAction(activeRole, 'manage_suppliers')
  const partners = data?.partners ?? []
  const selected = partners.find((p) => p.id === selectedId) ?? partners[0] ?? null

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return partners.filter((p) => !q || `${p.companyName} ${p.gstin} ${p.contactPerson} ${p.mobile} ${p.email}`.toLowerCase().includes(q))
  }, [partners, search])

  const analytics = (partnerId: string) => {
    if (!data) return null
    const contracts = data.contracts.filter((c) => c.fleetPartnerId === partnerId)
    const contractIds = new Set(contracts.map((c) => c.id))
    const vehicles = contracts.flatMap((c) => c.vehicles)
    const payments = data.payments.filter((p) => contractIds.has(p.contractId))
    const deposits = data.deposits.filter((d) => contractIds.has(d.contractId))
    const maintenance = data.maintenance.filter((m) => contractIds.has(m.contractId))
    return {
      contracts,
      vehicles,
      payments,
      deposits,
      maintenance,
      totalRental: contracts.reduce((s, c) => s + c.financialTerms.monthlyRentalInr, 0),
      outstanding: payments.reduce((s, p) => s + p.outstandingAmountInr, 0),
      depositsHeld: deposits.reduce((s, d) => s + d.paidAmountInr, 0),
      settlements: maintenance.filter((m) => m.settlementStatus === 'unsettled').reduce((s, m) => s + m.supplierShareInr, 0),
    }
  }

  const openCreate = () => { setEditing(null); setForm(emptyPartner); setModalOpen(true) }
  const openEdit = (partner: FleetPartner) => {
    setEditing(partner)
    setForm({
      companyName: partner.companyName,
      registrationNumber: partner.registrationNumber,
      gstin: partner.gstin,
      contactPerson: partner.contactPerson,
      mobile: partner.mobile,
      email: partner.email,
      registeredAddress: partner.registeredAddress,
      operatingLocation: partner.operatingLocation,
      bankAccountMasked: partner.bankAccountMasked,
      bankIfsc: partner.bankIfsc,
      notes: partner.notes,
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.companyName.trim()) { toast.error('Company name is required.'); return }
    setSaving(true)
    try {
      if (editing) {
        await contractRequest(`/partners/${encodeURIComponent(editing.id)}`, { method: 'PATCH', body: JSON.stringify(form) })
        toast.success('Fleet partner updated.')
      } else {
        await contractRequest('/partners', { method: 'POST', body: JSON.stringify(form) })
        toast.success('Fleet partner added.')
      }
      setModalOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save fleet partner.')
    } finally {
      setSaving(false)
    }
  }

  const profile = selected ? analytics(selected.id) : null

  return (
    <ContractPage
      title="Fleet Partners"
      subtitle="Supplier organisations that provide contracted vehicles. One partner can hold multiple agreements and supply multiple vehicles."
      actions={canManage ? <PrimaryButton onClick={openCreate}><Plus className="w-3.5 h-3.5" /> Add Fleet Partner</PrimaryButton> : undefined}
    >
      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <div className="grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] gap-4 items-start">
          <div className="space-y-3">
            <Toolbar search={search} onSearch={setSearch} placeholder="Search company, GSTIN, contact or mobile" />
            <DataTable
              rows={filtered}
              rowKey={(p) => p.id}
              pageSize={8}
              onRowClick={(p) => { setSelectedId(p.id); setTab('overview') }}
              emptyTitle="No fleet partners yet"
              emptyDescription="Add a supplier organisation before creating a contracted-fleet agreement."
              columns={[
                {
                  key: 'name',
                  label: 'Partner',
                  render: (p) => (
                    <div>
                      <p className="text-xs font-bold text-[#625346]">{p.companyName}</p>
                      <p className="text-[10px] text-[#958777]">{p.gstin || 'GSTIN not recorded'} · {p.operatingLocation || p.registeredAddress}</p>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: 'Status',
                  render: (p) => <span className={`text-[10px] font-bold uppercase ${p.status === 'active' ? 'text-[#4D6E4A]' : 'text-[#B84E42]'}`}>{p.status}</span>,
                },
                {
                  key: 'vehicles',
                  label: 'Vehicles',
                  render: (p) => <span className="text-xs tabular-nums">{analytics(p.id)?.vehicles.length ?? 0}</span>,
                },
              ]}
            />
          </div>

          {selected && profile ? (
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-[#EEE8F7] text-[#5B4579] flex items-center justify-center"><Building2 className="w-4 h-4" /></div>
                    <div>
                      <h2 className="text-sm font-bold text-[#625346]">{selected.companyName}</h2>
                      <p className="text-[10px] text-[#958777]">{selected.registrationNumber || 'Registration not recorded'} · {selected.gstin || 'GSTIN not recorded'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-[#958777]">
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {selected.mobile || '—'}</span>
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {selected.email || '—'}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {selected.operatingLocation || '—'}</span>
                  </div>
                </div>
                {canManage && <GhostButton onClick={() => openEdit(selected)}>Edit partner</GhostButton>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {[
                  { label: 'Vehicles supplied', value: profile.vehicles.length },
                  { label: 'Active contracts', value: profile.contracts.filter((c) => c.status === 'active').length },
                  { label: 'Monthly commitment', value: inr(profile.totalRental) },
                  { label: 'Outstanding', value: inr(profile.outstanding) },
                  { label: 'Deposits held', value: inr(profile.depositsHeld) },
                  { label: 'Settlements due', value: inr(profile.settlements) },
                  { label: 'Expired contracts', value: profile.contracts.filter((c) => c.status === 'expired' || c.status === 'closed').length },
                  { label: 'Maintenance records', value: profile.maintenance.length },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-[#FAF7EF] px-2.5 py-2">
                    <p className="text-[10px] text-[#958777]">{item.label}</p>
                    <p className="text-xs font-bold text-[#625346] tabular-nums mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1 mt-4 border-b border-[#E5E5E5]">
                {(['overview', 'vehicles', 'contracts', 'payments', 'maintenance', 'documents', 'activity'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setTab(item)}
                    className={`px-2.5 py-2 text-[11px] font-semibold capitalize border-b-2 -mb-px ${tab === item ? 'border-[#B8A3D9] text-[#625346]' : 'border-transparent text-[#958777] hover:text-[#625346]'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="pt-3 text-xs text-[#625346] space-y-2">
                {tab === 'overview' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-[#958777]">{selected.notes || 'No internal notes recorded.'}</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777]">Registered address</p><p className="text-[11px] mt-1">{selected.registeredAddress || '—'}</p></div>
                      <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777]">Bank details (masked)</p><p className="text-[11px] mt-1 inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> {selected.bankAccountMasked || '—'} · {selected.bankIfsc || '—'}</p></div>
                    </div>
                  </div>
                )}
                {tab === 'vehicles' && (profile.vehicles.length ? profile.vehicles.map((v) => (
                  <div key={v.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2">
                    <span className="font-semibold">{v.vehicleRegistration}</span>
                    <OwnershipBadge type={v.ownershipType} />
                  </div>
                )) : <p className="text-[11px] text-[#958777]">No vehicles supplied yet.</p>)}
                {tab === 'contracts' && (profile.contracts.length ? profile.contracts.map((c) => (
                  <a key={c.id} href={`/dashboard/contracts/${c.id}`} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2 hover:bg-[#FAF7EF]">
                    <span><span className="font-semibold">{c.contractNumber}</span> · {c.name}</span>
                    <ContractStatusBadge status={c.status} />
                  </a>
                )) : <p className="text-[11px] text-[#958777]">No contracts yet.</p>)}
                {tab === 'payments' && (profile.payments.length ? profile.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2">
                    <span>{p.billingPeriod} · due {shortDate(p.dueDate)}</span>
                    <span className="tabular-nums">{inr(p.amountInr)}</span>
                  </div>
                )) : <p className="text-[11px] text-[#958777]">No payments recorded.</p>)}
                {tab === 'maintenance' && (profile.maintenance.length ? profile.maintenance.map((m) => (
                  <div key={m.id} className="border border-[#E5E5E5] rounded-lg px-3 py-2">
                    <p className="font-semibold">{m.vehicleRegistration} · {m.category}</p>
                    <p className="text-[10px] text-[#958777]">{m.description}</p>
                    <p className="text-[10px] mt-1">Supplier share {inr(m.supplierShareInr)} · {m.settlementStatus}</p>
                  </div>
                )) : <p className="text-[11px] text-[#958777]">No maintenance allocations.</p>)}
                {tab === 'documents' && ((data?.documents ?? []).filter((d) => profile.contracts.some((c) => c.id === d.contractId)).length ? (data?.documents ?? []).filter((d) => profile.contracts.some((c) => c.id === d.contractId)).map((d) => (
                  <div key={d.id} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2">
                    <span>{d.name}</span><span className="text-[10px] text-[#958777]">{d.category}</span>
                  </div>
                )) : <p className="text-[11px] text-[#958777]">No documents linked.</p>)}
                {tab === 'activity' && ((data?.activity ?? []).filter((a) => a.contractId === '' || profile.contracts.some((c) => c.id === a.contractId)).slice(0, 30).map((a) => (
                  <div key={a.id} className="border-b border-[#F0F0F0] pb-1.5">
                    <p className="text-[11px]">{a.summary}</p>
                    <p className="text-[10px] text-[#958777]">{a.actor} · {shortDate(a.createdAt)}</p>
                  </div>
                )))}
              </div>
            </Card>
          ) : (
            <Card><SectionTitle title="Select a fleet partner" hint="Choose a supplier from the directory to view its contracts, vehicles and settlement position." /></Card>
          )}
        </div>
      )}

      <EnterpriseModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Fleet Partner' : 'Add Fleet Partner'} subtitle="Duplicate GSTINs are rejected within the same operating organization." maxWidthClass="max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-3 max-h-[65vh] overflow-y-auto pr-1">
          <Field label="Company name"><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></Field>
          <Field label="Registration number"><Input value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} /></Field>
          <Field label="GSTIN"><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Contact person"><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></Field>
          <Field label="Mobile"><Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Operating location"><Input value={form.operatingLocation} onChange={(e) => setForm({ ...form, operatingLocation: e.target.value })} /></Field>
          <Field label="Bank account (masked)"><Input value={form.bankAccountMasked} onChange={(e) => setForm({ ...form, bankAccountMasked: e.target.value })} placeholder="XXXX XXXX 4412" /></Field>
          <Field label="Bank IFSC"><Input value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} /></Field>
          <Field label="Registered address"><Textarea rows={2} value={form.registeredAddress} onChange={(e) => setForm({ ...form, registeredAddress: e.target.value })} /></Field>
          <Field label="Internal notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setModalOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Partner'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
