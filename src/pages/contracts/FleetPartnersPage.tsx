import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, Edit3, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, MetricTile } from '../../components/ui/EnterprisePrimitives'
import {
  ContractPaymentStatusBadge,
  ContractStatusBadge,
  ResponsibilityBadge,
} from '../../components/contracts/ContractPrimitives'

export function FleetPartnersListPage() {
  const navigate = useNavigate()
  const { partners, contracts, contractVehicles, payments, hasPermission } = useContracts()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return partners.filter((p) => {
      const mQ =
        !query ||
        p.companyName.toLowerCase().includes(query) ||
        p.partnerCode.toLowerCase().includes(query) ||
        p.gstin.toLowerCase().includes(query) ||
        (p.city ?? '').toLowerCase().includes(query)
      const mS = statusFilter === 'all' || p.status === statusFilter
      return mQ && mS
    })
  }, [partners, q, statusFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Partners (Commercial Fleet Suppliers)"
        subtitle="Verified commercial fleet leasing and supply partners with KYC, GSTIN, masked settlement accounts, and SLA tracking"
      >
        {hasPermission('manage_suppliers') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/partners/new')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Add Fleet Partner
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile title="Registered Partners" value={partners.length} subtitle="Duplicate GSTIN/Reg blocked" color="#6E5696" />
        <MetricTile
          title="Active Partner Agreements"
          value={contracts.filter((c) => c.supplierType === 'fleet_partner' && c.status === 'active').length}
          subtitle="Live commercial fleet contracts"
          color="#4D6E4A"
        />
        <MetricTile
          title="Supplied Vehicles"
          value={contractVehicles.filter((l) => contracts.some((c) => c.id === l.contractId && c.supplierType === 'fleet_partner')).length}
          subtitle="Under active partner control"
          color="#D8B442"
        />
      </div>

      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="dm-input py-1.5 text-xs w-44"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="suspended">Suspended</option>
        </select>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search partner, code, GSTIN..."
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No fleet partners found"
          description="Register a commercial fleet supplier to link multi-vehicle contracts."
          actionLabel={hasPermission('manage_suppliers') ? 'Add Fleet Partner' : undefined}
          onAction={hasPermission('manage_suppliers') ? () => navigate('/dashboard/contracts/partners/new') : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Partner & Code</th>
                  <th>Primary Contact</th>
                  <th>GSTIN / Reg</th>
                  <th>Active Contracts</th>
                  <th>Total Paid</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const pContracts = contracts.filter((c) => c.fleetPartnerId === p.id)
                  const pPaid = payments
                    .filter((pay) => pContracts.some((c) => c.id === pay.contractId))
                    .reduce((s, pay) => s + pay.paidAmountInr, 0)
                  return (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/partners/${p.id}`)}
                          className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline block text-left"
                        >
                          {p.companyName}
                        </button>
                        <span className="text-xs text-[#958777]">{p.partnerCode} · {p.city}, {p.state}</span>
                      </td>
                      <td className="text-xs">
                        <div className="font-semibold text-[#625346]">{p.contactPerson}</div>
                        <div className="text-[#958777]">{p.mobile} · {p.email}</div>
                      </td>
                      <td className="text-xs text-[#625346]">
                        <div>{p.gstin}</div>
                        <div className="text-[#958777]">{p.businessRegistrationNo}</div>
                      </td>
                      <td className="text-xs font-semibold text-[#625346] tabular-nums">{pContracts.length}</td>
                      <td className="text-xs font-semibold text-[#625346] tabular-nums">{formatInr(pPaid)}</td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border capitalize bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]">
                          {p.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/partners/${p.id}`)}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          7-Tab Profile
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function FleetPartnerFormPage() {
  const navigate = useNavigate()
  const { partnerId } = useParams()
  const { partners, savePartner } = useContracts()
  const existing = partnerId ? partners.find((p) => p.id === partnerId) : undefined

  const [companyName, setCompanyName] = useState(existing?.companyName ?? '')
  const [businessRegistrationNo, setBusinessRegistrationNo] = useState(existing?.businessRegistrationNo ?? '')
  const [gstin, setGstin] = useState(existing?.gstin ?? '')
  const [panNumber, setPanNumber] = useState(existing?.panNumber ?? '')
  const [contactPerson, setContactPerson] = useState(existing?.contactPerson ?? '')
  const [mobile, setMobile] = useState(existing?.mobile ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [city, setCity] = useState(existing?.city ?? 'Chennai')
  const [stateName, setStateName] = useState(existing?.state ?? 'Tamil Nadu')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [bankName, setBankName] = useState(existing?.bankName ?? 'HDFC Bank')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState(existing?.ifscCode ?? '')
  const [slaTargetUptimePct, setSlaTargetUptimePct] = useState(existing?.slaTargetUptimePct ?? 95)
  const [status, setStatus] = useState<'active' | 'on_hold' | 'inactive'>(existing?.status ?? 'active')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = await savePartner({
        id: existing?.id,
        companyName,
        businessRegistrationNo,
        gstin,
        panNumber,
        contactPerson,
        mobile,
        email,
        city,
        state: stateName,
        address,
        bankName,
        bankAccountNumber: bankAccountNumber || undefined,
        ifscCode,
        slaTargetUptimePct,
        status,
        notes,
      })
      toast.success(existing ? 'Fleet Partner updated' : 'Fleet Partner registered')
      navigate(`/dashboard/contracts/partners/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Fleet Partner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={existing ? `Edit Fleet Partner — ${existing.companyName}` : 'Add Fleet Partner'}
        subtitle="Commercial fleet supply partner onboarding with duplicate GSTIN and registration checks"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/partners')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Partners
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Company Legal Name *</label>
            <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Business Registration / CIN *</label>
            <input required value={businessRegistrationNo} onChange={(e) => setBusinessRegistrationNo(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">GSTIN *</label>
            <input required value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">PAN Number</label>
            <input value={panNumber} onChange={(e) => setPanNumber(e.target.value.toUpperCase())} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Primary Contact Person *</label>
            <input required value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Mobile *</label>
            <input required value={mobile} onChange={(e) => setMobile(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Email *</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">SLA Uptime Target (%)</label>
            <input type="number" min={50} max={100} value={slaTargetUptimePct} onChange={(e) => setSlaTargetUptimePct(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">State</label>
            <input value={stateName} onChange={(e) => setStateName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Registered Office Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Settlement Bank Name</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">
              Bank Account Number {existing ? `(Current: ${existing.bankAccountMasked})` : '*'}
            </label>
            <input
              required={!existing}
              placeholder="Masked automatically for non-finance viewers"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">IFSC Code</label>
            <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'on_hold' | 'inactive')} className="dm-input text-xs">
              <option value="active">Active</option>
              <option value="on_hold">On Hold</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Compliance / Contract Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/partners')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving...' : existing ? 'Update Fleet Partner' : 'Register Fleet Partner'}
          </button>
        </div>
      </form>
    </div>
  )
}

const PARTNER_TABS = [
  { id: 'overview', label: '1. Overview' },
  { id: 'contracts', label: '2. Contracts' },
  { id: 'vehicles', label: '3. Vehicles' },
  { id: 'payments', label: '4. Payments' },
  { id: 'maintenance', label: '5. Maintenance Split' },
  { id: 'documents', label: '6. Documents' },
  { id: 'history', label: '7. Audit History' },
] as const

export function FleetPartnerDetailPage() {
  const { partnerId } = useParams()
  const navigate = useNavigate()
  const {
    partners,
    contracts,
    contractVehicles,
    payments,
    maintenanceAllocations,
    documents,
    history,
    hasPermission,
  } = useContracts()
  const { vehicles } = useFleet()
  const [tab, setTab] = useState<(typeof PARTNER_TABS)[number]['id']>('overview')

  const partner = partners.find((p) => p.id === partnerId)
  if (!partner) {
    return (
      <EmptySectionState
        title="Fleet Partner not found"
        description="This supplier record may not exist in the current organization."
        actionLabel="Back to Fleet Partners"
        onAction={() => navigate('/dashboard/contracts/partners')}
      />
    )
  }

  const pContracts = contracts.filter((c) => c.fleetPartnerId === partner.id)
  const contractIds = new Set(pContracts.map((c) => c.id))
  const pVehicles = contractVehicles.filter((l) => contractIds.has(l.contractId))
  const pPayments = payments.filter((pay) => contractIds.has(pay.contractId))
  const pMaint = maintenanceAllocations.filter((m) => contractIds.has(m.contractId))
  const pDocs = documents.filter((d) => d.contractId && contractIds.has(d.contractId))
  const pHistory = history.filter((h) => ((h.contractId && contractIds.has(h.contractId)) || h.entityId === partner.id))

  return (
    <div className="space-y-6">
      <PageHeader
        title={partner.companyName}
        subtitle={`${partner.partnerCode} · GSTIN ${partner.gstin} · Primary Contact: ${partner.contactPerson} (${partner.mobile})`}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/dashboard/contracts/partners')} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            All Partners
          </button>
          {hasPermission('manage_suppliers') && (
            <button
              type="button"
              onClick={() => navigate(`/dashboard/contracts/partners/${partner.id}/edit`)}
              className="btn-primary"
            >
              <Edit3 className="w-4 h-4" />
              Edit Partner
            </button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E5E5] pb-2">
        {PARTNER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors ${
              tab === t.id
                ? 'bg-[#625346] text-white border-[#625346]'
                : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5] hover:bg-[#F2F2F2]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="enterprise-card p-5 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-[#625346] mb-2">
              <Building2 className="w-4 h-4 text-[#6E5696]" />
              Corporate & KYC Profile
            </div>
            <div><span className="text-[#958777]">Business Reg:</span> <span className="font-semibold text-[#625346]">{partner.businessRegistrationNo}</span></div>
            <div><span className="text-[#958777]">GSTIN:</span> <span className="font-semibold text-[#625346]">{partner.gstin}</span></div>
            <div><span className="text-[#958777]">Location:</span> <span className="font-semibold text-[#625346]">{partner.address}, {partner.city}, {partner.state}</span></div>
            <div><span className="text-[#958777]">SLA Target Uptime:</span> <span className="font-semibold text-[#4D6E4A]">{partner.slaTargetUptimePct}%</span></div>
            <div><span className="text-[#958777]">Notes:</span> <span className="text-[#625346]">{partner.notes || 'None'}</span></div>
          </div>
          <div className="enterprise-card p-5 space-y-2 text-xs">
            <h3 className="text-sm font-bold text-[#625346] mb-2">Settlement & Role-Masked Banking</h3>
            <div><span className="text-[#958777]">Bank:</span> <span className="font-semibold text-[#625346]">{partner.bankName}</span></div>
            <div><span className="text-[#958777]">Account:</span> <span className="font-semibold text-[#625346]">{partner.bankAccountMasked}</span></div>
            <div><span className="text-[#958777]">IFSC:</span> <span className="font-semibold text-[#625346]">{partner.ifscCode}</span></div>
            <div><span className="text-[#958777]">Total Contract Paid:</span> <span className="font-bold text-[#625346]">{formatInr(pPayments.reduce((s, x) => s + x.paidAmountInr, 0))}</span></div>
          </div>
        </div>
      )}

      {tab === 'contracts' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Category</th>
                <th>Term</th>
                <th>Monthly Rental</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pContracts.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/contracts/register/${c.id}`)}
                      className="font-bold text-[#6E5696] hover:underline"
                    >
                      {c.contractCode} — {c.contractName}
                    </button>
                  </td>
                  <td className="text-xs capitalize">{c.contractCategory.replace(/_/g, ' ')}</td>
                  <td className="text-xs tabular-nums">{c.startDate} → {c.expiryDate}</td>
                  <td className="text-xs font-semibold tabular-nums">{formatInr(c.financialTerms.monthlyRental)}</td>
                  <td><ContractStatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Registration</th>
                <th>Make / Model</th>
                <th>Start Date</th>
                <th>Contract Status</th>
              </tr>
            </thead>
            <tbody>
              {pVehicles.map((l) => {
                const v = vehicles.find((x) => x.id === l.vehicleId)
                return (
                  <tr key={l.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/fleet/vehicles/${l.vehicleId}`)}
                        className="font-bold text-[#6E5696] hover:underline"
                      >
                        {l.vehicleRegistration}
                      </button>
                    </td>
                    <td className="text-xs">{v ? `${v.make} ${v.model}` : 'Linked Asset'}</td>
                    <td className="text-xs tabular-nums">{l.assignedStartDate}</td>
                    <td className="text-xs capitalize">{l.vehicleContractStatus}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Period</th>
                <th>Payable</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pPayments.map((pay) => (
                <tr key={pay.id}>
                  <td className="font-semibold text-xs">{pay.transactionCode}</td>
                  <td className="text-xs">{pay.billingPeriod}</td>
                  <td className="text-xs tabular-nums">{formatInr(pay.payableAmountInr ?? pay.paymentAmountInr ?? 0)}</td>
                  <td className="text-xs tabular-nums">{formatInr(pay.paidAmountInr)}</td>
                  <td className="text-xs tabular-nums">{formatInr(pay.outstandingAmountInr)}</td>
                  <td><ContractPaymentStatusBadge status={pay.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Repair Total</th>
                <th>Responsibility</th>
                <th>Org Share</th>
                <th>Partner Share</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pMaint.map((m) => (
                <tr key={m.id}>
                  <td className="font-semibold text-xs">{m.vehicleRegistration}</td>
                  <td className="text-xs font-semibold tabular-nums">{formatInr(m.totalRepairAmountInr)}</td>
                  <td><ResponsibilityBadge party={m.responsibleParty} /></td>
                  <td className="text-xs tabular-nums">{formatInr(m.orgShareInr)}</td>
                  <td className="text-xs tabular-nums">{formatInr(m.supplierShareInr)}</td>
                  <td className="text-xs capitalize">{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'documents' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {pDocs.map((d) => (
                <tr key={d.id}>
                  <td className="font-semibold text-xs">{d.title}</td>
                  <td className="text-xs capitalize">{(d.documentType ?? d.category ?? 'document').replace(/_/g, ' ')}</td>
                  <td className="text-xs">{d.uploadedAt.slice(0, 10)}</td>
                  <td className="text-xs capitalize font-semibold">{d.verificationStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="enterprise-card p-5 space-y-2.5">
          {pHistory.length === 0 ? (
            <p className="text-xs text-[#958777]">No audit trail records logged yet.</p>
          ) : (
            pHistory.map((h) => (
              <div key={h.id} className="border-b border-[#F2F2F2] pb-2 text-xs flex justify-between gap-4">
                <div>
                  <div className="font-semibold text-[#625346]">{h.summary}</div>
                  <div className="text-[#958777]">By {h.actorName} ({h.actorRole})</div>
                </div>
                <span className="text-[#958777] whitespace-nowrap">{((h.createdAt ?? h.timestamp) ?? '').slice(0, 16).replace('T', ' ')}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
