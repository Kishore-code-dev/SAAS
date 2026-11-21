import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, MetricTile } from '../../components/ui/EnterprisePrimitives'
import { DepositStatusBadge } from '../../components/contracts/ContractPrimitives'
import { computeDepositSummary, getDepositStatusOrder } from '../../utils/contractsEngine'

export function BondDepositsPage() {
  const navigate = useNavigate()
  const { deposits, contracts, hasPermission } = useContracts()

  const totalHeld = deposits.reduce((s, d) => s + d.paidAmountInr, 0)
  const totalDeducted = deposits.reduce((s, d) => s + d.deductedAmountInr, 0)
  const totalNetRefundable = deposits.reduce((s, d) => s + d.netRefundableInr, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Bonds & Refundable Deposits"
        subtitle="10-stage escrow lifecycle tracking, authorized damage deductions, top-ups, and final refund settlements"
      >
        {hasPermission('manage_security_deposits') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/deposits/new')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Create Security Deposit
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile title="Total Deposits Held" value={formatInr(totalHeld)} subtitle={`${deposits.length} deposit record(s)`} color="#6E5696" />
        <MetricTile title="Authorized Deductions" value={formatInr(totalDeducted)} subtitle="Damage, repair & overdue offsets" color="#D8B442" />
        <MetricTile title="Net Refundable Balance" value={formatInr(totalNetRefundable)} subtitle="Paid minus deductions & settled refunds" color="#4D6E4A" />
      </div>

      {deposits.length === 0 ? (
        <EmptySectionState
          title="No security deposits recorded"
          description="Create a security deposit or bond agreement tied to an active third-party vehicle contract."
          actionLabel={hasPermission('manage_security_deposits') ? 'Create Security Deposit' : undefined}
          onAction={hasPermission('manage_security_deposits') ? () => navigate('/dashboard/contracts/deposits/new') : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Deposit & Contract</th>
                  <th>Supplier</th>
                  <th>Held By</th>
                  <th>Required / Paid</th>
                  <th>Deductions</th>
                  <th>Net Refundable</th>
                  <th>Lifecycle Stage</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => {
                  const c = contracts.find((x) => x.id === d.contractId)
                  return (
                    <tr key={d.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/deposits/${d.id}`)}
                          className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline block text-left"
                        >
                          {d.depositCode}
                        </button>
                        <span className="text-xs text-[#958777]">{c?.contractCode ?? d.contractId} · {d.depositType.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="text-xs font-semibold text-[#625346]">{d.supplierName}</td>
                      <td className="text-xs capitalize text-[#625346]">{(d.heldBy ?? '').replace(/_/g, ' ')}</td>
                      <td className="text-xs tabular-nums">
                        <div className="font-semibold text-[#625346]">{formatInr(d.paidAmountInr)}</div>
                        <div className="text-[#958777]">of {formatInr(d.requiredAmountInr)}</div>
                      </td>
                      <td className="text-xs tabular-nums text-[#A24034] font-semibold">
                        {formatInr(d.deductedAmountInr)}
                      </td>
                      <td className="text-xs tabular-nums text-[#4D6E4A] font-bold">
                        {formatInr(d.netRefundableInr ?? 0)}
                      </td>
                      <td>
                        <DepositStatusBadge status={d.status} />
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/deposits/${d.id}`)}
                          className="btn-secondary text-xs px-3 py-1.5"
                        >
                          Manage Lifecycle
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

export function DepositFormPage() {
  const navigate = useNavigate()
  const { contracts, createDeposit } = useContracts()
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '')
  const [depositType, setDepositType] = useState('security_deposit')
  const [heldBy, setHeldBy] = useState('operating_company')
  const [requiredAmountInr, setRequiredAmountInr] = useState(50000)
  const [paidAmountInr, setPaidAmountInr] = useState(50000)
  const [paymentMode, setPaymentMode] = useState('NEFT')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [isRefundable, setIsRefundable] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!contractId) {
      setError('Select a contract agreement first.')
      return
    }
    setSaving(true)
    try {
      const dep = await createDeposit({
        contractId,
        depositType,
        heldBy,
        requiredAmountInr,
        paidAmountInr,
        paymentMode,
        referenceNumber,
        isRefundable,
        notes,
      })
      toast.success('Security deposit registered')
      navigate(`/dashboard/contracts/deposits/${dep.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save deposit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Create Security Deposit / Bond"
        subtitle="Establish refundable or performance bond security linked to a contract agreement"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/deposits')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Deposits
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Contract Agreement *</label>
            <select value={contractId} onChange={(e) => setContractId(e.target.value)} className="dm-input text-xs">
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode} — {c.contractName} ({c.supplierName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Bond / Deposit Type</label>
            <select value={depositType} onChange={(e) => setDepositType(e.target.value)} className="dm-input text-xs">
              <option value="security_deposit">Security Deposit</option>
              <option value="performance_bond">Performance Bond</option>
              <option value="bank_guarantee">Bank Guarantee</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Held By</label>
            <select value={heldBy} onChange={(e) => setHeldBy(e.target.value)} className="dm-input text-xs">
              <option value="operating_company">Operating Company Escrow</option>
              <option value="supplier_escrow">Supplier Escrow</option>
              <option value="bank_guarantee">Bank Guarantee Instrument</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Required Amount (₹)</label>
            <input type="number" min={1} required value={requiredAmountInr} onChange={(e) => setRequiredAmountInr(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Paid Amount (₹)</label>
            <input type="number" min={0} value={paidAmountInr} onChange={(e) => setPaidAmountInr(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Payment Mode</label>
            <input value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">UTR / BG Reference</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="dm-input text-xs" />
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#625346]">
              <input type="checkbox" checked={isRefundable} onChange={(e) => setIsRefundable(e.target.checked)} />
              Refundable upon contract closure & vehicle return clearance
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Terms & Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/deposits')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving...' : 'Create Security Deposit'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function DepositDetailPage() {
  const { depositId } = useParams()
  const navigate = useNavigate()
  const { deposits, deductions, contracts, hasPermission, updateDeposit } = useContracts()

  const deposit = deposits.find((d) => d.id === depositId)
  const [deductAmount, setDeductAmount] = useState(2500)
  const [deductReason, setDeductReason] = useState('')
  const [deductCategory, setDeductCategory] = useState('damage_repair')
  const [topupAmount, setTopupAmount] = useState(10000)
  const [refundRef, setRefundRef] = useState('')
  const [busy, setBusy] = useState(false)

  if (!deposit) {
    return (
      <EmptySectionState
        title="Security deposit not found"
        description="This bond/deposit record could not be located."
        actionLabel="Back to Deposits"
        onAction={() => navigate('/dashboard/contracts/deposits')}
      />
    )
  }

  const contract = contracts.find((c) => c.id === deposit.contractId)
  const depDeductions = deductions.filter((x) => x.depositId === deposit.id)
  const summary = computeDepositSummary(deposit, depDeductions)
  const stages = getDepositStatusOrder()
  const currentIdx = stages.indexOf(deposit.status)

  const handleDeduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deductReason.trim()) {
      toast.error('Please enter a reason & evidence note for the deduction.')
      return
    }
    setBusy(true)
    try {
      await updateDeposit(deposit.id, 'deduct', {
        amountInr: deductAmount,
        category: deductCategory,
        reason: deductReason,
        evidenceRef: `EVD-${Date.now()}`,
      })
      toast.success('Deduction authorized and applied to deposit')
      setDeductReason('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to apply deduction')
    } finally {
      setBusy(false)
    }
  }

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await updateDeposit(deposit.id, 'topup', { amountInr: topupAmount })
      toast.success('Deposit top-up recorded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to top up deposit')
    } finally {
      setBusy(false)
    }
  }

  const handleRefundAction = async (action: 'approve_refund' | 'settle_refund') => {
    setBusy(true)
    try {
      await updateDeposit(deposit.id, action, {
        amountInr: summary.netRefundableInr,
        referenceNumber: refundRef || `REF-${Date.now()}`,
      })
      toast.success(action === 'approve_refund' ? 'Refund approved' : 'Refund settled and deposit closed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to process refund action')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Deposit ${deposit.depositCode}`}
        subtitle={`${deposit.supplierName} · Contract ${contract?.contractCode ?? deposit.contractId}`}
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/deposits')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          All Deposits
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile label="Required Deposit" value={formatInr(deposit.requiredAmountInr)} hint={`Paid: ${formatInr(deposit.paidAmountInr)}`} />
        <MetricTile label="Shortfall Pending" value={formatInr(summary.outstandingPaymentInr)} tone={summary.outstandingPaymentInr > 0 ? 'warning' : 'success'} />
        <MetricTile label="Total Deductions" value={formatInr(summary.totalDeductions)} hint={`${depDeductions.length} authorized entry(ies)`} tone="danger" />
        <MetricTile label="Net Refundable" value={formatInr(summary.netRefundableInr)} hint={`Refunded: ${formatInr(deposit.refundedAmountInr)}`} tone="success" />
      </div>

      <div className="enterprise-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#625346] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#6E5696]" />
            10-Stage Security Deposit Lifecycle
          </h2>
          <DepositStatusBadge status={deposit.status} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 text-[11px]">
          {stages.map((st, idx) => (
            <div
              key={st}
              className={`p-2 rounded-[8px] border text-center capitalize font-semibold ${
                idx <= currentIdx
                  ? 'bg-[#EEE8F7] border-[#6E5696]/40 text-[#6E5696]'
                  : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#958777]'
              }`}
            >
              {idx + 1}. {st.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasPermission('approve_deposit_refunds') && deposit.status !== 'closed' && (
          <form onSubmit={handleDeduct} className="enterprise-card p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#625346]">Authorize Deposit Deduction</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#625346] mb-1">Deduction Category</label>
                <select value={deductCategory} onChange={(e) => setDeductCategory(e.target.value)} className="dm-input text-xs">
                  <option value="damage_repair">Damage Repair</option>
                  <option value="missing_accessories">Missing Accessories</option>
                  <option value="unpaid_challans">Unpaid Challans / Tolls</option>
                  <option value="contract_shortfall">Contract Shortfall</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#625346] mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={deductAmount}
                  onChange={(e) => setDeductAmount(Number(e.target.value))}
                  className="dm-input text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Reason & Inspection Evidence *</label>
              <input
                required
                value={deductReason}
                onChange={(e) => setDeductReason(e.target.value)}
                placeholder="e.g., Missing spare tyre & rear bumper dent per return handover"
                className="dm-input text-xs"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-primary text-xs">
              Apply Deduction
            </button>
          </form>
        )}

        <div className="enterprise-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-[#625346]">Top-Up & Refund Settlement</h3>
          {hasPermission('manage_security_deposits') && deposit.status !== 'closed' && (
            <form onSubmit={handleTopup} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#625346] mb-1">Top-Up Paid Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  className="dm-input text-xs"
                />
              </div>
              <button type="submit" disabled={busy} className="btn-secondary text-xs py-2">
                Record Top-Up
              </button>
            </form>
          )}

          {hasPermission('approve_deposit_refunds') && deposit.isRefundable && deposit.status !== 'closed' && (
            <div className="border-t border-[#E5E5E5] pt-3 space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#625346] mb-1">Refund Settlement Reference</label>
                <input
                  value={refundRef}
                  onChange={(e) => setRefundRef(e.target.value)}
                  placeholder="NEFT / UTR Ref"
                  className="dm-input text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {deposit.status !== 'refund_payment' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRefundAction('approve_refund')}
                    className="btn-secondary text-xs"
                  >
                    Approve Net Refund ({formatInr(summary.netRefundableInr)})
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRefundAction('settle_refund')}
                  className="btn-accent text-xs"
                >
                  Settle Refund & Close Deposit
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#E5E5E5] text-sm font-bold text-[#625346]">
          Deduction Audit Trail ({depDeductions.length})
        </div>
        {depDeductions.length === 0 ? (
          <div className="p-5 text-xs text-[#958777]">No deductions recorded against this security deposit.</div>
        ) : (
          <table className="dm-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Reason & Evidence</th>
                <th>Amount</th>
                <th>Approved By</th>
              </tr>
            </thead>
            <tbody>
              {depDeductions.map((x) => (
                <tr key={x.id}>
                  <td className="text-xs capitalize font-semibold">{x.category.replace(/_/g, ' ')}</td>
                  <td className="text-xs">{x.reason} ({x.evidenceRef})</td>
                  <td className="text-xs font-bold text-[#A24034] tabular-nums">{formatInr(x.amountInr)}</td>
                  <td className="text-xs text-[#958777]">{x.approvedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
