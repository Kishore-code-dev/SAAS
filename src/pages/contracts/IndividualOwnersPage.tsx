import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Edit3, Plus, Search, ShieldCheck, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, MetricTile } from '../../components/ui/EnterprisePrimitives'
import {
  ContractPaymentStatusBadge,
  ContractStatusBadge,
  DepositStatusBadge,
} from '../../components/contracts/ContractPrimitives'

export function IndividualOwnersListPage() {
  const navigate = useNavigate()
  const { owners, contracts, payments, hasPermission } = useContracts()
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return owners.filter(
      (o) =>
        !query ||
        o.fullName.toLowerCase().includes(query) ||
        o.ownerCode.toLowerCase().includes(query) ||
        o.mobile.toLowerCase().includes(query) ||
        (o.city ?? '').toLowerCase().includes(query),
    )
  }, [owners, q])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Individual Vehicle Owners"
        subtitle="Verified single-vehicle owners leased into operations with role-masked KYC (PAN/Aadhaar) and bank details"
      >
        {hasPermission('manage_individual_owners') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/owners/new')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Add Individual Owner
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile title="Individual Owners" value={owners.length} subtitle="PAN & Aadhaar duplicate-checked" color="#6E5696" />
        <MetricTile
          title="Active Owner Contracts"
          value={contracts.filter((c) => c.supplierType === 'individual_owner' && c.status === 'active').length}
          subtitle="Live individual owner agreements"
          color="#4D6E4A"
        />
        <MetricTile
          title="Total Owner Payouts"
          value={formatInr(
            payments
              .filter((pay) => contracts.some((c) => c.id === pay.contractId && c.supplierType === 'individual_owner'))
              .reduce((s, p) => s + p.paidAmountInr, 0),
          )}
          subtitle="Settled rental / share payouts"
          color="#D8B442"
        />
      </div>

      <div className="enterprise-card p-3.5 flex items-center justify-between gap-3">
        <span className="text-xs text-[#958777] flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-[#4D6E4A]" />
          Sensitive PAN, Aadhaar & bank numbers are role-masked automatically for non-financial staff
        </span>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search owner name, code, mobile..."
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No individual owners found"
          description="Register an individual owner to attach single-owner vehicles under contract."
          actionLabel={hasPermission('manage_individual_owners') ? 'Add Individual Owner' : undefined}
          onAction={hasPermission('manage_individual_owners') ? () => navigate('/dashboard/contracts/owners/new') : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Owner & Code</th>
                  <th>Contact</th>
                  <th>Masked KYC</th>
                  <th>Bank Account</th>
                  <th>Contracts</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const oContracts = contracts.filter((c) => c.individualOwnerId === o.id)
                  return (
                    <tr key={o.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/owners/${o.id}`)}
                          className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline block text-left"
                        >
                          {o.fullName}
                        </button>
                        <span className="text-xs text-[#958777]">{o.ownerCode} · {o.city}, {o.state}</span>
                      </td>
                      <td className="text-xs">
                        <div>{o.mobile}</div>
                        <div className="text-[#958777]">{o.email}</div>
                      </td>
                      <td className="text-xs text-[#625346]">
                        <div>PAN: {o.panMasked}</div>
                        <div className="text-[#958777]">Aadhaar: {o.aadhaarMasked}</div>
                      </td>
                      <td className="text-xs text-[#625346]">
                        <div>{o.bankName}</div>
                        <div className="text-[#958777]">{o.bankAccountMasked}</div>
                      </td>
                      <td className="text-xs font-semibold tabular-nums">{oContracts.length}</td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border capitalize bg-[#EDF4EC] text-[#4D6E4A] border-[#C7DEC4]">
                          {o.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/owners/${o.id}`)}
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

export function IndividualOwnerFormPage() {
  const navigate = useNavigate()
  const { ownerId } = useParams()
  const { owners, saveOwner } = useContracts()
  const existing = ownerId ? owners.find((o) => o.id === ownerId) : undefined

  const [fullName, setFullName] = useState(existing?.fullName ?? '')
  const [mobile, setMobile] = useState(existing?.mobile ?? '')
  const [email, setEmail] = useState(existing?.email ?? '')
  const [city, setCity] = useState(existing?.city ?? 'Coimbatore')
  const [stateName, setStateName] = useState(existing?.state ?? 'Tamil Nadu')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [panNumber, setPanNumber] = useState('')
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [drivingLicenseNo, setDrivingLicenseNo] = useState(existing?.drivingLicenseNo ?? '')
  const [bankName, setBankName] = useState(existing?.bankName ?? 'State Bank of India')
  const [bankAccountNumber, setBankAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState(existing?.ifscCode ?? '')
  const [emergencyContact, setEmergencyContact] = useState(existing?.emergencyContact ?? '')
  const [payoutCycle, setPayoutCycle] = useState(existing?.payoutCycle ?? 'Monthly (5th of month)')
  const [status, setStatus] = useState<'active' | 'on_hold' | 'inactive'>(existing?.status ?? 'active')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const saved = await saveOwner({
        id: existing?.id,
        fullName,
        mobile,
        email,
        city,
        state: stateName,
        address,
        panNumber: panNumber || undefined,
        aadhaarNumber: aadhaarNumber || undefined,
        drivingLicenseNo,
        bankName,
        bankAccountNumber: bankAccountNumber || undefined,
        ifscCode,
        emergencyContact,
        payoutCycle,
        status,
        notes,
      })
      toast.success(existing ? 'Individual Owner updated' : 'Individual Owner registered')
      navigate(`/dashboard/contracts/owners/${saved.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save Individual Owner')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={existing ? `Edit Individual Owner — ${existing.fullName}` : 'Add Individual Vehicle Owner'}
        subtitle="Role-masked PAN, Aadhaar, and bank settlement details with duplicate identity protection"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/owners')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Owners
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
            <label className="block text-xs font-semibold text-[#625346] mb-1">Full Legal Name *</label>
            <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Mobile *</label>
            <input required value={mobile} onChange={(e) => setMobile(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Emergency Contact</label>
            <input value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">
              PAN {existing ? `(Current: ${existing.panMasked})` : '*'}
            </label>
            <input
              required={!existing}
              placeholder="ABCDE1234F (stored masked)"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">
              Aadhaar {existing ? `(Current: ${existing.aadhaarMasked})` : '*'}
            </label>
            <input
              required={!existing}
              placeholder="12-digit Aadhaar (stored masked)"
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Driving License No (Optional)</label>
            <input value={drivingLicenseNo} onChange={(e) => setDrivingLicenseNo(e.target.value.toUpperCase())} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Payout Cycle</label>
            <input value={payoutCycle} onChange={(e) => setPayoutCycle(e.target.value)} className="dm-input text-xs" />
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
            <label className="block text-xs font-semibold text-[#625346] mb-1">Residential Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Bank Name</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">
              Bank Account Number {existing ? `(Current: ${existing.bankAccountMasked})` : '*'}
            </label>
            <input
              required={!existing}
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
            <label className="block text-xs font-semibold text-[#625346] mb-1">Owner Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/owners')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving...' : existing ? 'Update Owner' : 'Register Owner'}
          </button>
        </div>
      </form>
    </div>
  )
}

const OWNER_TABS = [
  { id: 'overview', label: '1. Overview' },
  { id: 'contracts', label: '2. Contracts' },
  { id: 'vehicles', label: '3. Vehicles' },
  { id: 'payments', label: '4. Payouts' },
  { id: 'deposits', label: '5. Deposits & Bonds' },
  { id: 'documents', label: '6. Documents' },
  { id: 'history', label: '7. Audit History' },
] as const

export function IndividualOwnerDetailPage() {
  const { ownerId } = useParams()
  const navigate = useNavigate()
  const {
    owners,
    contracts,
    contractVehicles,
    payments,
    deposits,
    documents,
    history,
    hasPermission,
  } = useContracts()
  const { vehicles } = useFleet()
  const [tab, setTab] = useState<(typeof OWNER_TABS)[number]['id']>('overview')

  const owner = owners.find((o) => o.id === ownerId)
  if (!owner) {
    return (
      <EmptySectionState
        title="Individual Owner not found"
        description="The requested owner profile could not be found."
        actionLabel="Back to Individual Owners"
        onAction={() => navigate('/dashboard/contracts/owners')}
      />
    )
  }

  const oContracts = contracts.filter((c) => c.individualOwnerId === owner.id)
  const cIds = new Set(oContracts.map((c) => c.id))
  const oVehicles = contractVehicles.filter((l) => cIds.has(l.contractId))
  const oPayments = payments.filter((p) => cIds.has(p.contractId))
  const oDeposits = deposits.filter((d) => cIds.has(d.contractId))
  const oDocs = documents.filter((d) => d.contractId && cIds.has(d.contractId))
  const oHistory = history.filter((h) => (h.contractId && cIds.has(h.contractId)) || h.entityId === owner.id)

  return (
    <div className="space-y-6">
      <PageHeader
        title={owner.fullName}
        subtitle={`${owner.ownerCode} · ${owner.city}, ${owner.state} · Payout: ${owner.payoutCycle}`}
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate('/dashboard/contracts/owners')} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            All Owners
          </button>
          {hasPermission('manage_individual_owners') && (
            <button
              type="button"
              onClick={() => navigate(`/dashboard/contracts/owners/${owner.id}/edit`)}
              className="btn-primary"
            >
              <Edit3 className="w-4 h-4" />
              Edit Owner
            </button>
          )}
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E5E5] pb-2">
        {OWNER_TABS.map((t) => (
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
              <UserCheck className="w-4 h-4 text-[#8F6510]" />
              Owner Contact & KYC Identity
            </div>
            <div><span className="text-[#958777]">Mobile:</span> <span className="font-semibold text-[#625346]">{owner.mobile}</span></div>
            <div><span className="text-[#958777]">Email:</span> <span className="font-semibold text-[#625346]">{owner.email}</span></div>
            <div><span className="text-[#958777]">PAN:</span> <span className="font-semibold text-[#625346]">{owner.panMasked}</span></div>
            <div><span className="text-[#958777]">Aadhaar:</span> <span className="font-semibold text-[#625346]">{owner.aadhaarMasked}</span></div>
            <div><span className="text-[#958777]">Address:</span> <span className="text-[#625346]">{owner.address}, {owner.city}</span></div>
          </div>
          <div className="enterprise-card p-5 space-y-2 text-xs">
            <h3 className="text-sm font-bold text-[#625346] mb-2">Bank & Payout Summary</h3>
            <div><span className="text-[#958777]">Bank:</span> <span className="font-semibold text-[#625346]">{owner.bankName}</span></div>
            <div><span className="text-[#958777]">Account:</span> <span className="font-semibold text-[#625346]">{owner.bankAccountMasked}</span></div>
            <div><span className="text-[#958777]">IFSC:</span> <span className="font-semibold text-[#625346]">{owner.ifscCode}</span></div>
            <div><span className="text-[#958777]">Total Paid:</span> <span className="font-bold text-[#625346]">{formatInr(oPayments.reduce((s, p) => s + p.paidAmountInr, 0))}</span></div>
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
                <th>Monthly Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {oContracts.map((c) => (
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
                <th>Model</th>
                <th>Assigned Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {oVehicles.map((l) => {
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
                <th>Txn</th>
                <th>Billing Period</th>
                <th>Payable</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {oPayments.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold text-xs">{p.transactionCode}</td>
                  <td className="text-xs">{p.billingPeriod}</td>
                  <td className="text-xs tabular-nums">{formatInr(p.payableAmountInr ?? p.paymentAmountInr ?? 0)}</td>
                  <td className="text-xs tabular-nums">{formatInr(p.paidAmountInr)}</td>
                  <td><ContractPaymentStatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'deposits' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Deposit Code</th>
                <th>Required</th>
                <th>Paid</th>
                <th>Net Refundable</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {oDeposits.map((d) => (
                <tr key={d.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/contracts/deposits/${d.id}`)}
                      className="font-bold text-[#6E5696] hover:underline"
                    >
                      {d.depositCode}
                    </button>
                  </td>
                  <td className="text-xs tabular-nums">{formatInr(d.requiredAmountInr)}</td>
                  <td className="text-xs tabular-nums">{formatInr(d.paidAmountInr)}</td>
                  <td className="text-xs font-semibold tabular-nums">{formatInr(d.netRefundableInr ?? 0)}</td>
                  <td><DepositStatusBadge status={d.status} /></td>
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
              {oDocs.map((d) => (
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
        <div className="enterprise-card p-5 space-y-2">
          {oHistory.map((h) => (
            <div key={h.id} className="border-b border-[#F2F2F2] pb-2 text-xs flex justify-between gap-4">
              <div>
                <div className="font-semibold text-[#625346]">{h.summary}</div>
                <div className="text-[#958777]">By {h.actorName}</div>
              </div>
              <span className="text-[#958777]">{((h.createdAt ?? h.timestamp) ?? '').slice(0, 16).replace('T', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
