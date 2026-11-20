import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FilePlus2,
  Handshake,
  IndianRupee,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Truck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import {
  Card,
  ContractPage,
  ContractStatusBadge,
  DepositStatusBadge,
  ErrorBlock,
  Field,
  GhostButton,
  Input,
  LoadingBlock,
  OwnershipBadge,
  PaymentStatusBadge,
  PrimaryButton,
  ResponsibilityBadge,
  SectionTitle,
  Select,
  Textarea,
  dateTime,
  inr,
  shortDate,
  todayIso,
} from './ContractUi'

type Tab = 'overview' | 'vehicles' | 'financials' | 'amendments' | 'deposits' | 'payments' | 'maintenance' | 'handovers' | 'documents' | 'activity'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'financials', label: 'Financials' },
  { key: 'amendments', label: 'Amendments' },
  { key: 'deposits', label: 'Deposits' },
  { key: 'payments', label: 'Payments' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'handovers', label: 'Handovers' },
  { key: 'documents', label: 'Documents' },
  { key: 'activity', label: 'Activity' },
]

export default function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [tab, setTab] = useState<Tab>('overview')
  const [amendmentOpen, setAmendmentOpen] = useState(false)
  const [handoverOpen, setHandoverOpen] = useState(false)
  const [documentOpen, setDocumentOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [amendmentForm, setAmendmentForm] = useState({ title: '', reason: '', effectiveDate: todayIso(), expiryDate: '', monthlyRental: '' })
  const [handoverForm, setHandoverForm] = useState({
    vehicleId: '', handoverType: 'handover', handoverAt: todayIso(), odometerKm: '', fuelLevelPct: '100',
    exteriorCondition: '', interiorCondition: '', tyreCondition: '', existingDamages: '', accessories: '',
    supplierRepresentative: '', receivingRepresentative: '', notes: '',
  })
  const [docForm, setDocForm] = useState({ name: '', category: 'Agreement', reference: '' })

  const contract = data?.contracts.find((c) => c.id === contractId) ?? null

  const related = useMemo(() => {
    if (!data || !contract) return null
    return {
      amendments: data.amendments.filter((a) => a.contractId === contract.id),
      deposits: data.deposits.filter((d) => d.contractId === contract.id),
      payments: data.payments.filter((p) => p.contractId === contract.id),
      maintenance: data.maintenance.filter((m) => m.contractId === contract.id),
      handovers: data.handovers.filter((h) => h.contractId === contract.id),
      documents: data.documents.filter((d) => d.contractId === contract.id),
      activity: data.activity.filter((a) => a.contractId === contract.id),
      ownership: data.ownership.filter((o) => o.contractId === contract.id),
    }
  }, [data, contract])

  const canEdit = canPerformContractAction(activeRole, 'edit_contracts')
  const canApprove = canPerformContractAction(activeRole, 'approve_contracts')
  const canTerminate = canPerformContractAction(activeRole, 'terminate_contracts')
  const canAmend = canPerformContractAction(activeRole, 'create_amendments')
  const canHandover = canPerformContractAction(activeRole, 'record_handovers')
  const canDocs = canPerformContractAction(activeRole, 'manage_contract_documents')

  if (loading) return <ContractPage title="Contract Detail" subtitle="Loading agreement…"><LoadingBlock /></ContractPage>
  if (error) return <ContractPage title="Contract Detail" subtitle="Contract detail"><ErrorBlock message={error} onRetry={() => void refresh()} /></ContractPage>
  if (!contract || !related) {
    return (
      <ContractPage title="Contract Not Found" subtitle="This contract does not exist in the active organization.">
        <Card>
          <p className="text-sm text-[#625346]">The contract may have been removed, or it belongs to another tenant.</p>
          <PrimaryButton className="mt-4" onClick={() => navigate('/dashboard/contracts/register')}>Back to Contract Register</PrimaryButton>
        </Card>
      </ContractPage>
    )
  }

  const status = contract.status
  const changeStatus = async (next: string) => {
    try {
      await contractRequest(`/${encodeURIComponent(contract.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      toast.success(`Contract marked ${next.replace(/_/g, ' ')}.`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to change status.')
    }
  }

  const createAmendment = async () => {
    if (!amendmentForm.title.trim() || !amendmentForm.reason.trim()) { toast.error('Title and reason are required.'); return }
    const revised: Record<string, unknown> = {}
    if (amendmentForm.expiryDate) revised.expiryDate = amendmentForm.expiryDate
    if (amendmentForm.monthlyRental) revised.monthlyRentalInr = Number(amendmentForm.monthlyRental)
    if (Object.keys(revised).length === 0) { toast.error('Provide at least one revised value.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(contract.id)}/amendments`, {
        method: 'POST',
        body: JSON.stringify({ title: amendmentForm.title, reason: amendmentForm.reason, revisedValues: revised, effectiveDate: amendmentForm.effectiveDate }),
      })
      toast.success('Amendment created as draft.')
      setAmendmentOpen(false)
      setAmendmentForm({ title: '', reason: '', effectiveDate: todayIso(), expiryDate: '', monthlyRental: '' })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create amendment.')
    } finally {
      setSaving(false)
    }
  }

  const createHandover = async () => {
    if (!handoverForm.vehicleId) { toast.error('Select a vehicle.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(contract.id)}/handovers`, {
        method: 'POST',
        body: JSON.stringify({
          ...handoverForm,
          odometerKm: Number(handoverForm.odometerKm || 0),
          fuelLevelPct: Number(handoverForm.fuelLevelPct || 0),
        }),
      })
      toast.success(handoverForm.handoverType === 'return' ? 'Vehicle return recorded.' : 'Vehicle handover recorded.')
      setHandoverOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record handover.')
    } finally {
      setSaving(false)
    }
  }

  const addDocument = async () => {
    if (!docForm.name.trim()) { toast.error('Document name is required.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(contract.id)}/documents`, { method: 'POST', body: JSON.stringify(docForm) })
      toast.success('Document reference added.')
      setDocumentOpen(false)
      setDocForm({ name: '', category: 'Agreement', reference: '' })
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add document.')
    } finally {
      setSaving(false)
    }
  }

  const totalPaid = related.payments.reduce((s, p) => s + p.paidAmountInr, 0)
  const totalOutstanding = related.payments.reduce((s, p) => s + p.outstandingAmountInr, 0)
  const depositsPaid = related.deposits.reduce((s, d) => s + d.paidAmountInr, 0)
  const depositsOutstanding = related.deposits.reduce((s, d) => s + d.outstandingAmountInr, 0)
  const unsettledMaintenance = related.maintenance
    .filter((m) => m.approvalStatus === 'approved' && m.settlementStatus === 'unsettled')
    .reduce((s, m) => s + m.supplierShareInr, 0)

  return (
    <ContractPage
      title={`${contract.contractNumber} · ${contract.name}`}
      subtitle={`${contract.supplierName} · ${contract.agreementReference || 'No agreement reference'} · version ${contract.currentVersion}`}
      actions={
        <div className="flex flex-wrap items-center gap-1.5">
          <GhostButton onClick={() => navigate('/dashboard/contracts/register')}><ArrowLeft className="w-3.5 h-3.5" /> Register</GhostButton>
          {canApprove && (status === 'draft' || status === 'pending_approval' || status === 'awaiting_handover') && (
            <PrimaryButton onClick={() => void changeStatus('active')}><CheckCircle2 className="w-3.5 h-3.5" /> Approve & Activate</PrimaryButton>
          )}
          {canEdit && status === 'active' && (
            <GhostButton onClick={() => void changeStatus('temporarily_suspended')}><PauseCircle className="w-3.5 h-3.5" /> Suspend</GhostButton>
          )}
          {canEdit && status === 'temporarily_suspended' && (
            <GhostButton onClick={() => void changeStatus('active')}><PlayCircle className="w-3.5 h-3.5" /> Resume</GhostButton>
          )}
          {canEdit && status === 'renewal_pending' && (
            <GhostButton onClick={() => void changeStatus('active')}>Mark renewed</GhostButton>
          )}
          {canTerminate && (status === 'active' || status === 'renewal_pending') && (
            <GhostButton onClick={() => void changeStatus('termination_requested')}><XCircle className="w-3.5 h-3.5 text-[#B84E42]" /> Request termination</GhostButton>
          )}
          {canTerminate && status === 'termination_requested' && (
            <GhostButton onClick={() => void changeStatus('terminated')}><XCircle className="w-3.5 h-3.5 text-[#B84E42]" /> Terminate</GhostButton>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contract value (monthly)', value: inr(contract.financialTerms.monthlyRentalInr), icon: IndianRupee },
          { label: 'Paid to supplier', value: inr(totalPaid), icon: CheckCircle2 },
          { label: 'Payment outstanding', value: inr(totalOutstanding), icon: IndianRupee },
          { label: 'Deposits outstanding', value: inr(depositsOutstanding), icon: ShieldCheck },
        ].map((item) => (
          <div key={item.label} className="enterprise-card p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-[#958777]">{item.label}</span><item.icon className="w-4 h-4 text-[#958777]" /></div>
            <p className="text-lg font-bold text-[#625346] tabular-nums mt-1">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="enterprise-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ContractStatusBadge status={contract.status} />
          <OwnershipBadge type={contract.supplierType === 'fleet_partner' ? 'contracted_fleet' : 'individual_owner'} />
          <span className="text-[11px] text-[#958777]">{shortDate(contract.startDate)} → {shortDate(contract.expiryDate)} · {contract.durationMonths} months</span>
          <span className="text-[11px] text-[#958777] ml-auto">Deposits paid {inr(depositsPaid)} · Unsettled maintenance {inr(unsettledMaintenance)}</span>
        </div>
        <div className="flex flex-wrap gap-1 mt-4 border-b border-[#E5E5E5]">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`px-2.5 py-2 text-[11px] font-semibold border-b-2 -mb-px ${tab === item.key ? 'border-[#B8A3D9] text-[#625346]' : 'border-transparent text-[#958777] hover:text-[#625346]'}`}
            >
              {item.label}
              {item.key === 'amendments' && related.amendments.length > 0 && <span className="ml-1 text-[9px] text-[#958777]">{related.amendments.length}</span>}
            </button>
          ))}
        </div>

        <div className="pt-4 text-xs text-[#625346]">
          {tab === 'overview' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="rounded-lg border border-[#E5E5E5] p-3">
                  <p className="text-[10px] text-[#958777]">Description</p>
                  <p className="text-[11px] mt-1">{contract.description || 'No description recorded.'}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777]">Agreement date</p><p className="text-[11px] mt-1">{shortDate(contract.agreementDate)}</p></div>
                  <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777]">Supplier type</p><p className="text-[11px] mt-1 capitalize">{contract.supplierType.replace(/_/g, ' ')}</p></div>
                  <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777]">Created by</p><p className="text-[11px] mt-1">{contract.createdBy}</p></div>
                  <div className="rounded-lg border border-[#E5E5E5] p-3"><p className="text-[10px] text-[#958777]">Last updated</p><p className="text-[11px] mt-1">{dateTime(contract.updatedAt)}</p></div>
                </div>
              </div>
              <div>
                <SectionTitle title="Responsibility split" hint="Who bears each operating cost" />
                <div className="space-y-1.5">
                  {([
                    ['Maintenance', contract.conditions.maintenance],
                    ['Fuel', contract.conditions.fuel],
                    ['Insurance', contract.conditions.insurance],
                    ['Accident', contract.conditions.accident],
                    ['Tyres', contract.conditions.tyres],
                    ['Breakdown', contract.conditions.breakdown],
                    ['Driver', contract.conditions.driver],
                    ['Permit', contract.conditions.permit],
                    ['Fitness / PUC', contract.conditions.fitnessPuc],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-2 border-b border-[#F0F0F0] pb-1.5">
                      <span className="text-[11px] text-[#958777]">{label}</span>
                      <ResponsibilityBadge value={value} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'vehicles' && (
            <div className="space-y-2">
              {contract.vehicles.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#958777]" />
                    <div>
                      <Link to={`/dashboard/fleet/vehicles/${v.vehicleId}`} className="text-xs font-bold text-[#6E5696]">{v.vehicleRegistration}</Link>
                      <p className="text-[10px] text-[#958777]">{v.vehicleCategory || 'Vehicle'} · {v.condition || 'Condition not recorded'} · handover {shortDate(v.handoverDate)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OwnershipBadge type={v.ownershipType} />
                    <ResponsibilityBadge value={v.maintenanceResponsibility} />
                    <span className="text-[11px] tabular-nums">{v.agreedRentalInr ? inr(v.agreedRentalInr) : '—'}</span>
                    <span className={`text-[10px] font-semibold ${v.returnedAt ? 'text-[#4D6E4A]' : 'text-[#8E6F19]'}`}>{v.returnedAt ? `Returned ${shortDate(v.returnedAt)}` : 'In service'}</span>
                  </div>
                </div>
              ))}
              {canHandover && (
                <div className="flex justify-end">
                  <PrimaryButton onClick={() => { setHandoverForm({ ...handoverForm, vehicleId: contract.vehicles[0]?.vehicleId ?? '' }); setHandoverOpen(true) }}><Handshake className="w-3.5 h-3.5" /> Record handover / return</PrimaryButton>
                </div>
              )}
            </div>
          )}

          {tab === 'financials' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div>
                <SectionTitle title="Financial terms" />
                <div className="space-y-1.5">
                  {[
                    ['Fixed rental', contract.financialTerms.fixedRentalInr],
                    ['Monthly rental', contract.financialTerms.monthlyRentalInr],
                    ['Per-km rate', contract.financialTerms.perKmRateInr],
                    ['Per-trip rate', contract.financialTerms.perTripRateInr],
                    ['Advance payment', contract.financialTerms.advancePaymentInr],
                    ['Security deposit', contract.financialTerms.securityDepositInr],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex items-center justify-between border-b border-[#F0F0F0] pb-1.5">
                      <span className="text-[11px] text-[#958777]">{label}</span>
                      <span className="text-[11px] tabular-nums">{inr(Number(value))}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-1.5">
                    <span className="text-[11px] text-[#958777]">Revenue share</span>
                    <span className="text-[11px] tabular-nums">{contract.financialTerms.revenueSharePct}%</span>
                  </div>
                </div>
              </div>
              <div>
                <SectionTitle title="Commercial conditions" />
                <div className="space-y-2 text-[11px] text-[#625346]">
                  <p><span className="text-[#958777]">Payment frequency: </span>{contract.financialTerms.paymentFrequency.replace(/_/g, ' ')} · due day {contract.financialTerms.paymentDueDay}</p>
                  <p><span className="text-[#958777]">Tax treatment: </span>{contract.financialTerms.taxTreatment || '—'}</p>
                  <p><span className="text-[#958777]">Late payment: </span>{contract.financialTerms.latePaymentTerms || '—'}</p>
                  <p><span className="text-[#958777]">Deductions: </span>{contract.financialTerms.deductionConditions || '—'}</p>
                  <p><span className="text-[#958777]">Settlement: </span>{contract.financialTerms.settlementConditions || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'amendments' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#958777]">Approved amendments advance the contract version and preserve previous values.</p>
                {canAmend && <PrimaryButton onClick={() => setAmendmentOpen(true)}><FilePlus2 className="w-3.5 h-3.5" /> New Amendment</PrimaryButton>}
              </div>
              {related.amendments.length === 0 && <p className="text-[11px] text-[#958777]">No amendments recorded.</p>}
              {related.amendments.map((a) => (
                <div key={a.id} className="rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[#625346]">{a.amendmentNumber} · {a.title}</p>
                    <span className="text-[10px] font-bold uppercase text-[#8E6F19]">{a.status}</span>
                  </div>
                  <p className="text-[10px] text-[#958777] mt-0.5">{a.reason}</p>
                  <p className="text-[10px] text-[#958777] mt-0.5">Effective {shortDate(a.effectiveDate)} · created by {a.createdBy} {a.approvedBy ? `· approved by ${a.approvedBy}` : ''}</p>
                  {a.status === 'draft' && canAmend && (
                    <div className="flex justify-end mt-1">
                      <GhostButton onClick={async () => {
                        try {
                          await contractRequest(`/${encodeURIComponent(contract.id)}/amendments/${encodeURIComponent(a.id)}/submit`, { method: 'POST' })
                          toast.success('Amendment submitted.')
                          await refresh()
                        } catch (err) { toast.error(err instanceof Error ? err.message : 'Unable to submit amendment.') }
                      }}>Submit for approval</GhostButton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'deposits' && (
            <div className="space-y-2">
              {related.deposits.length === 0 && <p className="text-[11px] text-[#958777]">No deposits defined for this contract.</p>}
              {related.deposits.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div>
                    <p className="text-xs font-bold capitalize">{d.depositType.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] text-[#958777]">{d.receivingParty} · {d.documentReference || 'No document ref'} · refundable {d.refundable ? 'yes' : 'no'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] tabular-nums">{inr(d.paidAmountInr)} / {inr(d.requiredAmountInr)}</span>
                    <DepositStatusBadge status={d.status} />
                  </div>
                </div>
              ))}
              <Link to="/dashboard/contracts/deposits" className="text-[11px] font-semibold text-[#6E5696]">Manage deposits →</Link>
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-2">
              {related.payments.length === 0 && <p className="text-[11px] text-[#958777]">No payment schedules recorded.</p>}
              {related.payments.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div>
                    <p className="text-xs font-bold">{p.billingPeriod}</p>
                    <p className="text-[10px] text-[#958777]">due {shortDate(p.dueDate)} · {p.paymentReference || 'No reference'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] tabular-nums">{inr(p.paidAmountInr)} / {inr(p.amountInr)}</span>
                    <PaymentStatusBadge status={p.status} />
                  </div>
                </div>
              ))}
              <Link to="/dashboard/contracts/payments" className="text-[11px] font-semibold text-[#6E5696]">Manage payments →</Link>
            </div>
          )}

          {tab === 'maintenance' && (
            <div className="space-y-2">
              {related.maintenance.length === 0 && <p className="text-[11px] text-[#958777]">No maintenance allocations recorded.</p>}
              {related.maintenance.map((m) => (
                <div key={m.id} className="rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold">{m.vehicleRegistration} · {m.category}</p>
                    <span className="text-[10px] font-bold uppercase text-[#8E6F19]">{m.approvalStatus} / {m.settlementStatus}</span>
                  </div>
                  <p className="text-[10px] text-[#958777]">{m.description}</p>
                  <p className="text-[10px] mt-1 tabular-nums">Total {inr(m.totalCostInr)} · operating org {inr(m.operatingOrgShareInr)} · supplier {inr(m.supplierShareInr)}</p>
                </div>
              ))}
              <Link to="/dashboard/contracts/maintenance" className="text-[11px] font-semibold text-[#6E5696]">Manage maintenance →</Link>
            </div>
          )}

          {tab === 'handovers' && (
            <div className="space-y-2">
              {related.handovers.length === 0 && <p className="text-[11px] text-[#958777]">No handover or return records.</p>}
              {related.handovers.map((h) => (
                <div key={h.id} className="rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold capitalize">{h.handoverType} · {h.vehicleRegistration}</p>
                    <span className="text-[10px] text-[#958777]">{dateTime(h.handoverAt)} · {h.odometerKm.toLocaleString('en-IN')} km · fuel {h.fuelLevelPct}%</span>
                  </div>
                  <p className="text-[10px] text-[#958777]">Exterior: {h.exteriorCondition || '—'} · Tyres: {h.tyreCondition || '—'} · Damages: {h.existingDamages || 'none recorded'}</p>
                  <p className="text-[10px] text-[#958777]">Supplier rep: {h.supplierRepresentative || '—'} · Receiving rep: {h.receivingRepresentative || '—'}</p>
                </div>
              ))}
              {canHandover && (
                <div className="flex justify-end">
                  <PrimaryButton onClick={() => { setHandoverForm({ ...handoverForm, vehicleId: contract.vehicles[0]?.vehicleId ?? '' }); setHandoverOpen(true) }}><Handshake className="w-3.5 h-3.5" /> Record handover / return</PrimaryButton>
                </div>
              )}
            </div>
          )}

          {tab === 'documents' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#958777]">{related.documents.length} document references linked.</p>
                {canDocs && <PrimaryButton onClick={() => setDocumentOpen(true)}><FilePlus2 className="w-3.5 h-3.5" /> Add Document</PrimaryButton>}
              </div>
              {related.documents.length === 0 && <p className="text-[11px] text-[#958777]">No documents linked to this contract.</p>}
              {related.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div><p className="text-xs font-bold">{d.name}</p><p className="text-[10px] text-[#958777]">{d.category} · {d.reference || 'No reference'}</p></div>
                  <span className="text-[10px] text-[#958777]">{d.uploadedBy} · {shortDate(d.createdAt)}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'activity' && (
            <div className="space-y-2">
              {related.activity.length === 0 && <p className="text-[11px] text-[#958777]">No activity recorded.</p>}
              {related.activity.map((a) => (
                <div key={a.id} className="border-b border-[#F0F0F0] pb-2">
                  <p className="text-[11px] font-semibold">{a.summary}</p>
                  <p className="text-[10px] text-[#958777]">{a.actor} · {dateTime(a.createdAt)} · {a.action.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <EnterpriseModal open={amendmentOpen} onClose={() => setAmendmentOpen(false)} title="Create Contract Amendment" subtitle="Amendments are versioned. Approval applies the revised values and advances the contract version." maxWidthClass="max-w-xl">
        <div className="space-y-3">
          <Field label="Amendment title"><Input value={amendmentForm.title} onChange={(e) => setAmendmentForm({ ...amendmentForm, title: e.target.value })} placeholder="e.g. Monthly rental revision" /></Field>
          <Field label="Reason"><Textarea rows={2} value={amendmentForm.reason} onChange={(e) => setAmendmentForm({ ...amendmentForm, reason: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Effective date"><Input type="date" value={amendmentForm.effectiveDate} onChange={(e) => setAmendmentForm({ ...amendmentForm, effectiveDate: e.target.value })} /></Field>
            <Field label="Revised expiry (optional)"><Input type="date" value={amendmentForm.expiryDate} onChange={(e) => setAmendmentForm({ ...amendmentForm, expiryDate: e.target.value })} /></Field>
          </div>
          <Field label="Revised monthly rental (INR, optional)"><Input type="number" min="0" value={amendmentForm.monthlyRental} onChange={(e) => setAmendmentForm({ ...amendmentForm, monthlyRental: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setAmendmentOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void createAmendment()} disabled={saving}>{saving ? 'Creating…' : 'Create Amendment'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal open={handoverOpen} onClose={() => setHandoverOpen(false)} title="Record Handover / Return" subtitle="Odometer, fuel, condition and representative details are preserved as evidence." maxWidthClass="max-w-3xl">
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Vehicle">
              <Select value={handoverForm.vehicleId} onChange={(e) => setHandoverForm({ ...handoverForm, vehicleId: e.target.value })}>
                <option value="">Select vehicle…</option>
                {contract.vehicles.map((v) => <option key={v.vehicleId} value={v.vehicleId}>{v.vehicleRegistration}</option>)}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={handoverForm.handoverType} onChange={(e) => setHandoverForm({ ...handoverForm, handoverType: e.target.value })}>
                <option value="handover">Handover</option><option value="return">Return</option>
              </Select>
            </Field>
            <Field label="Date"><Input type="date" value={handoverForm.handoverAt} onChange={(e) => setHandoverForm({ ...handoverForm, handoverAt: e.target.value })} /></Field>
            <Field label="Odometer (km)"><Input type="number" min="0" value={handoverForm.odometerKm} onChange={(e) => setHandoverForm({ ...handoverForm, odometerKm: e.target.value })} /></Field>
            <Field label="Fuel level (%)"><Input type="number" min="0" max="100" value={handoverForm.fuelLevelPct} onChange={(e) => setHandoverForm({ ...handoverForm, fuelLevelPct: e.target.value })} /></Field>
            <Field label="Tyre condition"><Input value={handoverForm.tyreCondition} onChange={(e) => setHandoverForm({ ...handoverForm, tyreCondition: e.target.value })} /></Field>
            <Field label="Exterior condition"><Input value={handoverForm.exteriorCondition} onChange={(e) => setHandoverForm({ ...handoverForm, exteriorCondition: e.target.value })} /></Field>
            <Field label="Interior condition"><Input value={handoverForm.interiorCondition} onChange={(e) => setHandoverForm({ ...handoverForm, interiorCondition: e.target.value })} /></Field>
            <Field label="Existing damages"><Input value={handoverForm.existingDamages} onChange={(e) => setHandoverForm({ ...handoverForm, existingDamages: e.target.value })} /></Field>
            <Field label="Accessories"><Input value={handoverForm.accessories} onChange={(e) => setHandoverForm({ ...handoverForm, accessories: e.target.value })} /></Field>
            <Field label="Supplier representative"><Input value={handoverForm.supplierRepresentative} onChange={(e) => setHandoverForm({ ...handoverForm, supplierRepresentative: e.target.value })} /></Field>
            <Field label="Receiving representative"><Input value={handoverForm.receivingRepresentative} onChange={(e) => setHandoverForm({ ...handoverForm, receivingRepresentative: e.target.value })} /></Field>
          </div>
          <Field label="Notes"><Textarea rows={2} value={handoverForm.notes} onChange={(e) => setHandoverForm({ ...handoverForm, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setHandoverOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void createHandover()} disabled={saving}>{saving ? 'Recording…' : 'Record'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal open={documentOpen} onClose={() => setDocumentOpen(false)} title="Add Contract Document" subtitle="Record the document reference in the contract file.">
        <div className="space-y-3">
          <Field label="Document name"><Input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><Input value={docForm.category} onChange={(e) => setDocForm({ ...docForm, category: e.target.value })} /></Field>
            <Field label="Reference"><Input value={docForm.reference} onChange={(e) => setDocForm({ ...docForm, reference: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setDocumentOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void addDocument()} disabled={saving}>{saving ? 'Saving…' : 'Add Document'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
