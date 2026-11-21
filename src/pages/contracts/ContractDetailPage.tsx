import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GitBranch,
  History,
  Plus,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wallet,
  Wrench,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatDateTime, formatInr } from '../../components/ui/EnterprisePrimitives'
import {
  AmendmentDiffTable,
  ContractPaymentStatusBadge,
  ContractStatusBadge,
  DepositStatusBadge,
  ResponsibilityBadge,
} from '../../components/contracts/ContractPrimitives'

type TabId =
  | 'overview'
  | 'vehicles'
  | 'amendments'
  | 'payments'
  | 'deposits'
  | 'maintenance'
  | 'handovers'
  | 'documents'
  | 'history'

export default function ContractDetailPage() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const { refreshFleet } = useFleet()
  const {
    contracts,
    contractVehicles,
    versions,
    amendments,
    payments,
    deposits,
    maintenanceRules,
    maintenanceAllocations,
    handovers,
    documents,
    history,
    changeContractStatus,
    reviewAmendment,
    hasPermission,
  } = useContracts()

  const [tab, setTab] = useState<TabId>('overview')
  const [closureOverrideNote, setClosureOverrideNote] = useState('')
  const [busy, setBusy] = useState(false)

  const contract = contracts.find((c) => c.id === contractId)
  if (!contract) {
    return (
      <div className="space-y-4">
        <PageHeader title="Contract Not Found" subtitle="The requested agreement does not exist in this organization." />
        <EmptySectionState
          title="Contract Unavailable"
          description="Return to the Contract Register to view active or draft agreements."
          actionLabel="Back to Register"
          onAction={() => navigate('/dashboard/contracts/register')}
        />
      </div>
    )
  }

  const links = contractVehicles.filter((v) => v.contractId === contract.id)
  const cVersions = versions.filter((v) => v.contractId === contract.id)
  const cAmendments = amendments.filter((a) => a.contractId === contract.id)
  const cPayments = payments.filter((p) => p.contractId === contract.id)
  const cDeposits = deposits.filter((d) => d.contractId === contract.id)
  const cRules = maintenanceRules.filter((r) => r.contractId === contract.id)
  const cAllocs = maintenanceAllocations.filter((a) => a.contractId === contract.id)
  const cHandovers = handovers.filter((h) => h.contractId === contract.id)
  const cDocs = documents.filter((d) => d.contractId === contract.id || d.entityId === contract.id)
  const cHistory = history.filter((h) => h.contractId === contract.id)

  const handleStatusChange = async (next: Parameters<typeof changeContractStatus>[1], reason?: string) => {
    setBusy(true)
    try {
      await changeContractStatus(contract.id, next, reason, closureOverrideNote.trim() || undefined)
      await refreshFleet()
      toast.success(`Contract transitioned to ${next.replace(/_/g, ' ')}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update contract status.')
    } finally {
      setBusy(false)
    }
  }

  const handleReviewAmendment = async (amendmentId: string, decision: 'submit' | 'approve' | 'reject') => {
    setBusy(true)
    try {
      await reviewAmendment(amendmentId, decision)
      toast.success(`Amendment ${decision} completed.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to process amendment.')
    } finally {
      setBusy(false)
    }
  }

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview & Terms' },
    { id: 'vehicles', label: 'Vehicles', count: links.length },
    { id: 'amendments', label: 'Versions & Amendments', count: cAmendments.length },
    { id: 'payments', label: 'Payments', count: cPayments.length },
    { id: 'deposits', label: 'Deposits', count: cDeposits.length },
    { id: 'maintenance', label: 'Maintenance', count: cAllocs.length },
    { id: 'handovers', label: 'Handovers', count: cHandovers.length },
    { id: 'documents', label: 'Documents', count: cDocs.length },
    { id: 'history', label: 'History', count: cHistory.length },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${contract.contractCode} — ${contract.contractName}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{contract.supplierName}</span>
            <span>·</span>
            <span className="capitalize">{contract.supplierType.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span>Version v{contract.currentVersion}</span>
            <ContractStatusBadge status={contract.status} />
          </span>
        }
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Register
        </button>

        {contract.status === 'draft' && hasPermission('submit_contracts') && (
          <button type="button" disabled={busy} onClick={() => void handleStatusChange('pending_approval', 'Submitted by user')} className="btn-accent">
            Submit for Approval
          </button>
        )}

        {contract.status === 'pending_approval' && hasPermission('approve_contracts') && (
          <button type="button" disabled={busy} onClick={() => void handleStatusChange('active', 'Approved by authorized approver')} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            Approve Contract
          </button>
        )}

        {contract.status === 'pending_approval' && hasPermission('reject_contracts') && (
          <button type="button" disabled={busy} onClick={() => void handleStatusChange('terminated', 'Rejected during approval')} className="btn-danger">
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        )}

        {hasPermission('create_amendments') && ['active', 'renewal_pending', 'awaiting_handover'].includes(contract.status) && (
          <button
            type="button"
            onClick={() => navigate(`/dashboard/contracts/register/${contract.id}/amend`)}
            className="btn-secondary"
          >
            <GitBranch className="w-4 h-4" />
            Amend Contract
          </button>
        )}

        {hasPermission('renew_contracts') && ['active', 'renewal_pending', 'expired'].includes(contract.status) && (
          <button
            type="button"
            onClick={() => navigate(`/dashboard/contracts/register/${contract.id}/renew`)}
            className="btn-primary"
          >
            <RefreshCw className="w-4 h-4" />
            Renew
          </button>
        )}
      </PageHeader>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#E5E5E5] pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-[#EEE8F7] text-[#6E5696] border border-[#B8A3D9]'
                : 'text-[#958777] hover:bg-[#FAFAFA] hover:text-[#625346] border border-transparent'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white/80 text-[10px] tabular-nums">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="enterprise-card p-5 lg:col-span-2 space-y-4">
            <h2 className="dm-card-title">Agreement Terms &amp; Commercial Structure</h2>
            <p className="text-xs text-[#958777] leading-relaxed">{contract.description || 'No description provided.'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E5E5E5] text-xs">
              <div>
                <span className="text-[#958777] block">Monthly / Fixed Rental</span>
                <span className="font-bold text-[#625346]">{formatInr(contract.financialTerms.monthlyRental || 0)}</span>
              </div>
              <div>
                <span className="text-[#958777] block">Per-Km / Per-Trip</span>
                <span className="font-bold text-[#625346]">
                  {formatInr(contract.financialTerms.perKmRate || 0)}/km · {formatInr(contract.financialTerms.perTripRate || 0)}/trip
                </span>
              </div>
              <div>
                <span className="text-[#958777] block">Revenue Share</span>
                <span className="font-bold text-[#625346]">{contract.financialTerms.revenueSharingPct || 0}%</span>
              </div>
              <div>
                <span className="text-[#958777] block">Start Date</span>
                <span className="font-bold text-[#625346]">{contract.startDate}</span>
              </div>
              <div>
                <span className="text-[#958777] block">Expiry Date</span>
                <span className="font-bold text-[#625346]">{contract.expiryDate}</span>
              </div>
              <div>
                <span className="text-[#958777] block">Payment Frequency</span>
                <span className="font-bold text-[#625346] capitalize">{(contract.financialTerms.paymentFrequency || 'monthly').replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-[#958777] block">Maintenance</span>
                <ResponsibilityBadge party={contract.contractConditions.maintenanceResponsibility} />
              </div>
              <div>
                <span className="text-[#958777] block">Fuel</span>
                <ResponsibilityBadge party={contract.contractConditions.fuelResponsibility} />
              </div>
              <div>
                <span className="text-[#958777] block">Insurance</span>
                <ResponsibilityBadge party={contract.contractConditions.insuranceResponsibility} />
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-[8px] bg-[#FAFAFA] border border-[#E5E5E5]">
                <span className="font-bold text-[#625346] block mb-1">Downtime &amp; Replacement</span>
                <span className="text-[#958777]">{contract.contractConditions.downtimeConditions}</span>
              </div>
              <div className="p-3 rounded-[8px] bg-[#FAFAFA] border border-[#E5E5E5]">
                <span className="font-bold text-[#625346] block mb-1">Return &amp; Termination</span>
                <span className="text-[#958777]">{contract.contractConditions.vehicleReturnConditions}</span>
              </div>
            </div>
          </div>

          <div className="enterprise-card p-5 space-y-4">
            <h2 className="dm-card-title">Lifecycle &amp; Closure Controls</h2>
            <div className="text-xs space-y-2 text-[#958777]">
              <div>Created by: <strong className="text-[#625346]">{contract.createdBy}</strong></div>
              <div>Approved by: <strong className="text-[#625346]">{contract.approvedBy ?? 'Pending'}</strong></div>
              <div>Ref Number: <strong className="text-[#625346]">{contract.agreementRefNumber}</strong></div>
            </div>
            {hasPermission('terminate_contracts') && contract.status !== 'closed' && (
              <div className="pt-3 border-t border-[#E5E5E5] space-y-2.5">
                {contract.status === 'active' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleStatusChange('vehicle_return_pending', 'Initiated contract end & return inspection')}
                    className="btn-secondary w-full text-xs"
                  >
                    Initiate Vehicle Return
                  </button>
                )}
                <input
                  value={closureOverrideNote}
                  onChange={(e) => setClosureOverrideNote(e.target.value)}
                  placeholder="Optional authorized closure exception note..."
                  className="dm-input text-xs"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleStatusChange('closed', 'Final contract closure')}
                  className="btn-danger w-full text-xs"
                >
                  Close Contract (Checks Pending Dues/Return)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'vehicles' && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
            <h2 className="dm-card-title flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#6E5696]" />
              Linked Contract Vehicles ({links.length})
            </h2>
            {hasPermission('manage_contract_vehicles') && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/vehicles/handover/new?contractId=${contract.id}`)}
                className="btn-accent text-xs px-3 py-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Handover
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Rental / Rate</th>
                  <th>Maintenance</th>
                  <th>Initial Odo</th>
                  <th>Handover Date</th>
                  <th>Link Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id}>
                    <td className="font-bold text-[#625346]">{l.vehicleRegistration}</td>
                    <td className="text-xs tabular-nums">
                      {l.agreedMonthlyRental > 0 ? `${formatInr(l.agreedMonthlyRental)}/mo` : `${formatInr(l.agreedPerKmRate)}/km`}
                    </td>
                    <td><ResponsibilityBadge party={l.maintenanceResponsibility} /></td>
                    <td className="tabular-nums text-xs">{l.initialOdometerKm.toLocaleString('en-IN')} km</td>
                    <td className="tabular-nums text-xs">{l.handoverDate}</td>
                    <td className="text-xs capitalize font-semibold text-[#625346]">{l.vehicleContractStatus.replace(/_/g, ' ')}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/fleet/vehicles/${l.vehicleId}`)}
                        className="btn-secondary text-xs px-2.5 py-1"
                      >
                        Inspect Twin
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'amendments' && (
        <div className="space-y-5">
          <div className="enterprise-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="dm-card-title">Contract Versions (Historical Versions Preserved)</h2>
              {hasPermission('create_amendments') && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/contracts/register/${contract.id}/amend`)}
                  className="btn-accent text-xs px-3 py-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Amendment
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cVersions.map((v) => (
                <div key={v.id} className="p-3.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#625346]">Version v{v.versionNumber}</span>
                    <span className="text-[#958777]">Effective {v.effectiveDate}</span>
                  </div>
                  <div className="text-[#625346]">
                    Monthly Rental: <strong>{formatInr(v.financialTerms.monthlyRental || 0)}</strong> · Expiry: <strong>{v.expiryDate}</strong>
                  </div>
                  <div className="text-[#958777]">{v.notes}</div>
                </div>
              ))}
            </div>
          </div>

          {cAmendments.map((am) => (
            <div key={am.id} className="enterprise-card p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-[#6E5696]">{am.amendmentCode}</span>
                  <h3 className="text-sm font-bold text-[#625346]">{am.title}</h3>
                  <p className="text-xs text-[#958777]">{am.reason} · Effective {am.effectiveDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED] capitalize">
                    {am.approvalStatus}
                  </span>
                  {am.approvalStatus === 'draft' && hasPermission('create_amendments') && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleReviewAmendment(am.id, 'submit')}
                      className="btn-secondary text-xs px-3 py-1"
                    >
                      Submit
                    </button>
                  )}
                  {am.approvalStatus === 'submitted' && hasPermission('approve_amendments') && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReviewAmendment(am.id, 'approve')}
                        className="btn-accent text-xs px-3 py-1"
                      >
                        Approve &amp; Activate Version
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReviewAmendment(am.id, 'reject')}
                        className="btn-danger text-xs px-3 py-1"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
              <AmendmentDiffTable amendment={am} />
            </div>
          ))}
        </div>
      )}

      {tab === 'payments' && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
            <h2 className="dm-card-title flex items-center gap-2">
              <Wallet className="w-4 h-4 text-[#6E5696]" />
              Contract Payment Ledger
            </h2>
            {hasPermission('manage_contract_payments') && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/payments/new?contractId=${contract.id}`)}
                className="btn-accent text-xs px-3 py-1.5"
              >
                Record Payment
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Tx Code</th>
                  <th>Period &amp; Version</th>
                  <th>Amount</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-bold text-[#625346]">{p.transactionCode}</td>
                    <td className="text-xs">{p.billingPeriod} (v{p.contractVersion})</td>
                    <td className="tabular-nums font-semibold">{formatInr(p.paymentAmountInr)}</td>
                    <td className="tabular-nums text-[#4D6E4A]">{formatInr(p.paidAmountInr)}</td>
                    <td className="tabular-nums text-[#A24034]">{formatInr(p.outstandingAmountInr)}</td>
                    <td><ContractPaymentStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'deposits' && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
            <h2 className="dm-card-title flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#6E5696]" />
              Security Deposits &amp; Bonds
            </h2>
            {hasPermission('manage_security_deposits') && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/deposits/new?contractId=${contract.id}`)}
                className="btn-accent text-xs px-3 py-1.5"
              >
                Add Deposit / Bond
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Deposit Code</th>
                  <th>Required</th>
                  <th>Paid</th>
                  <th>Deducted</th>
                  <th>Refunded</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {cDeposits.map((d) => (
                  <tr key={d.id}>
                    <td className="font-bold text-[#625346]">{d.depositCode}</td>
                    <td className="tabular-nums">{formatInr(d.requiredAmountInr)}</td>
                    <td className="tabular-nums">{formatInr(d.paidAmountInr)}</td>
                    <td className="tabular-nums text-[#A24034]">{formatInr(d.deductedAmountInr)}</td>
                    <td className="tabular-nums text-[#4D6E4A]">{formatInr(d.refundedAmountInr)}</td>
                    <td><DepositStatusBadge status={d.status} /></td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/contracts/deposits/${d.id}`)}
                        className="btn-secondary text-xs px-2.5 py-1"
                      >
                        Manage Lifecycle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="enterprise-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="dm-card-title flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[#6E5696]" />
              Maintenance Responsibility Rules &amp; Single-Transaction Splits
            </h2>
            {hasPermission('manage_maintenance_responsibilities') && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/maintenance/new?contractId=${contract.id}`)}
                className="btn-accent text-xs px-3 py-1.5"
              >
                Log Split / Rule
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cRules.map((r) => (
              <div key={r.id} className="p-3 rounded-[8px] bg-[#FAFAFA] border border-[#E5E5E5] text-xs">
                <div className="flex items-center justify-between font-bold text-[#625346]">
                  <span className="capitalize">{r.maintenanceCategory.replace(/_/g, ' ')}</span>
                  <span>{r.orgSharePct}% Org / {r.supplierSharePct}% Supplier</span>
                </div>
                <p className="text-[#958777] mt-1">{r.notes}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle &amp; Repair</th>
                  <th>Total</th>
                  <th>Org Share</th>
                  <th>Supplier Share</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cAllocs.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-bold text-[#625346]">{a.vehicleRegistration}</div>
                      <div className="text-xs text-[#958777]">{a.description}</div>
                    </td>
                    <td className="tabular-nums font-semibold">{formatInr(a.totalRepairAmountInr)}</td>
                    <td className="tabular-nums text-[#6E5696]">{formatInr(a.orgShareInr)}</td>
                    <td className="tabular-nums text-[#8F6510]">{formatInr(a.supplierShareInr)}</td>
                    <td className="capitalize text-xs font-semibold">{a.settlementStatus.replace(/_/g, ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'handovers' && (
        <div className="enterprise-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="dm-card-title flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#6E5696]" />
              Vehicle Handover &amp; Return Inspections
            </h2>
            {hasPermission('manage_contract_vehicles') && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/vehicles/handover/new?contractId=${contract.id}`)}
                className="btn-accent text-xs px-3 py-1.5"
              >
                New Handover / Return
              </button>
            )}
          </div>
          <div className="space-y-3">
            {cHandovers.map((h) => (
              <div key={h.id} className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs space-y-1">
                  <div className="font-bold text-[#625346]">
                    {h.handoverCode} · {h.vehicleRegistration} ({h.recordType.replace(/_/g, ' ')})
                  </div>
                  <div className="text-[#958777]">
                    Odometer: {h.odometerKm.toLocaleString('en-IN')} km · Fuel: {h.fuelLevelPct}% · Exterior: {h.exteriorCondition}
                  </div>
                </div>
                {h.recordType === 'initial_handover' && (
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/contracts/vehicles/return/${h.id}`)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Record Return Comparison
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="enterprise-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="dm-card-title flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#6E5696]" />
              Contract Documents ({cDocs.length})
            </h2>
            {hasPermission('manage_contract_documents') && (
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/documents/upload?contractId=${contract.id}`)}
                className="btn-accent text-xs px-3 py-1.5"
              >
                Upload Document
              </button>
            )}
          </div>
          <div className="space-y-2">
            {cDocs.map((d) => (
              <div key={d.id} className="p-3 rounded-[8px] border border-[#E5E5E5] flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-[#625346] block">{d.title}</span>
                  <span className="text-[#958777]">{d.category} · {d.fileName}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#EDF4EC] text-[#4D6E4A] border border-[#C7DEC4] capitalize font-semibold">
                  {d.verificationStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="enterprise-card p-5 space-y-3">
          <h2 className="dm-card-title flex items-center gap-2">
            <History className="w-4 h-4 text-[#6E5696]" />
            Immutable Contract Audit History
          </h2>
          {cHistory.map((h) => (
            <div key={h.id} className="p-3 rounded-[8px] bg-[#FAFAFA] border border-[#E5E5E5] text-xs flex flex-wrap justify-between gap-2">
              <div>
                <span className="font-bold text-[#625346]">{h.action}</span>
                <p className="text-[#958777] mt-0.5">{h.summary}</p>
              </div>
              <div className="text-right text-[#958777]">
                <span className="font-semibold text-[#625346] block">{h.actorName} ({h.actorRole})</span>
                <span>{formatDateTime(h.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
