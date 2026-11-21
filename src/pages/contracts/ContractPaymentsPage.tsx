import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, MetricTile } from '../../components/ui/EnterprisePrimitives'
import { ContractPaymentStatusBadge } from '../../components/contracts/ContractPrimitives'

export function ContractPaymentsPage() {
  const navigate = useNavigate()
  const { payments, contracts, hasPermission, updatePayment } = useContracts()
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    return payments.filter((p) => {
      const mQ =
        !query ||
        p.transactionCode.toLowerCase().includes(query) ||
        p.supplierName.toLowerCase().includes(query) ||
        p.billingPeriod.toLowerCase().includes(query)
      const mS = statusFilter === 'all' || p.status === statusFilter
      return mQ && mS
    })
  }, [payments, q, statusFilter])

  const totalPayable = payments.reduce((s, p) => s + (p.payableAmountInr ?? 0), 0)
  const totalPaid = payments.reduce((s, p) => s + (p.paidAmountInr ?? 0), 0)
  const totalOutstanding = payments.reduce((s, p) => s + (p.outstandingAmountInr ?? 0), 0)
  const overdueCount = payments.filter((p) => p.status === 'overdue').length

  const runAction = async (
    paymentId: string,
    action: 'approve' | 'reconcile' | 'dispute' | 'settle_balance',
    additionalPaidInr?: number,
  ) => {
    setBusyId(paymentId)
    try {
      await updatePayment(paymentId, action, undefined, additionalPaidInr)
      toast.success(`Payment updated (${action.replace(/_/g, ' ')})`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update payment')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Payments & Supplier Settlements"
        subtitle="Rental payables, revenue shares, penalties, deductions, and reconciliation across third-party contracts"
      >
        {hasPermission('manage_contract_payments') && (
          <button type="button" onClick={() => navigate('/dashboard/contracts/payments/new')} className="btn-accent">
            <Plus className="w-4 h-4" />
            Record Contract Payment
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile title="Total Payable" value={formatInr(totalPayable)} subtitle="Gross contract billing" color="#6E5696" />
        <MetricTile title="Total Paid / Settled" value={formatInr(totalPaid)} subtitle="Verified disbursements" color="#4D6E4A" />
        <MetricTile
          title="Outstanding Balance"
          value={formatInr(totalOutstanding)}
          subtitle="Payable minus paid"
          color={totalOutstanding > 0 ? '#D8B442' : '#4D6E4A'}
        />
        <MetricTile
          title="Overdue Cycles"
          value={overdueCount}
          subtitle="Past due-date payouts"
          color={overdueCount > 0 ? '#B84E42' : '#4D6E4A'}
        />
      </div>

      <div className="enterprise-card p-3.5 flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="dm-input py-1.5 text-xs w-48"
        >
          <option value="all">All Payment Statuses</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="approved">Approved</option>
          <option value="partially_paid">Partially Paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="disputed">Disputed</option>
          <option value="reconciled">Reconciled</option>
        </select>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search txn code, supplier, period..."
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No contract payments found"
          description="Record a supplier or individual owner contract payment."
          actionLabel={hasPermission('manage_contract_payments') ? 'Record Contract Payment' : undefined}
          onAction={hasPermission('manage_contract_payments') ? () => navigate('/dashboard/contracts/payments/new') : undefined}
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Transaction & Agreement</th>
                  <th>Supplier</th>
                  <th>Billing Period & Due</th>
                  <th>Payable / Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th className="text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const c = contracts.find((x) => x.id === p.contractId)
                  const canApprove = hasPermission('approve_contract_payments')
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-bold text-[#625346] text-xs">{p.transactionCode}</div>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/register/${p.contractId}`)}
                          className="text-xs text-[#6E5696] hover:underline"
                        >
                          {c?.contractCode ?? p.contractId} · {(p.paymentType ?? '').replace(/_/g, ' ')}
                        </button>
                      </td>
                      <td className="text-xs font-semibold text-[#625346]">{p.supplierName}</td>
                      <td className="text-xs">
                        <div>{p.billingPeriod}</div>
                        <div className="text-[#958777]">Due: {p.dueDate}</div>
                      </td>
                      <td className="text-xs tabular-nums">
                        <div className="font-semibold text-[#625346]">{formatInr(p.payableAmountInr)}</div>
                        <div className="text-[#4D6E4A]">Paid: {formatInr(p.paidAmountInr)}</div>
                      </td>
                      <td className="text-xs font-bold tabular-nums text-[#A24034]">
                        {formatInr(p.outstandingAmountInr)}
                      </td>
                      <td>
                        <ContractPaymentStatusBadge status={p.status} />
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          {canApprove && p.status === 'pending_approval' && (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void runAction(p.id, 'approve')}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              Approve
                            </button>
                          )}
                          {canApprove && p.outstandingAmountInr > 0 && (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void runAction(p.id, 'settle_balance', p.outstandingAmountInr)}
                              className="btn-primary text-[11px] px-2.5 py-1"
                            >
                              Settle Balance
                            </button>
                          )}
                          {canApprove && p.status === 'paid' && (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void runAction(p.id, 'reconcile')}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              Reconcile
                            </button>
                          )}
                          {p.status !== 'disputed' && p.status !== 'reconciled' && (
                            <button
                              type="button"
                              disabled={busyId === p.id}
                              onClick={() => void runAction(p.id, 'dispute')}
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
        </div>
      )}
    </div>
  )
}

export function ContractPaymentFormPage() {
  const navigate = useNavigate()
  const { contracts, recordPayment } = useContracts()
  const [contractId, setContractId] = useState(contracts[0]?.id ?? '')
  const [paymentType, setPaymentType] = useState('monthly_rental')
  const [billingPeriod, setBillingPeriod] = useState('Nov 2026')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [payableAmountInr, setPayableAmountInr] = useState(55000)
  const [paidAmountInr, setPaidAmountInr] = useState(55000)
  const [deductionsInr, setDeductionsInr] = useState(0)
  const [penaltiesInr, setPenaltiesInr] = useState(0)
  const [paymentMode, setPaymentMode] = useState('NEFT')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!contractId) {
      setError('Please select a contract agreement.')
      return
    }
    setSaving(true)
    try {
      await recordPayment({
        contractId,
        paymentType,
        billingPeriod,
        dueDate,
        payableAmountInr,
        paidAmountInr,
        deductionsInr,
        penaltiesInr,
        paymentMode,
        referenceNumber,
        notes,
      })
      toast.success('Contract payment recorded')
      navigate('/dashboard/contracts/payments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record contract payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Record Contract Payment"
        subtitle="Log monthly rental, per-km payout, or variable share settlement against a third-party agreement"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/payments')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Payments
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
            <label className="block text-xs font-semibold text-[#625346] mb-1">Payment Type</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="dm-input text-xs">
              <option value="monthly_rental">Monthly Rental</option>
              <option value="per_km_settlement">Per-Km Settlement</option>
              <option value="revenue_share">Revenue Share</option>
              <option value="maintenance_reimbursement">Maintenance Reimbursement</option>
              <option value="advance">Advance</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Billing Period *</label>
            <input required value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Due Date *</label>
            <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Payment Mode</label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="dm-input text-xs">
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
              <option value="IMPS">IMPS</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Payable Amount (₹) *</label>
            <input type="number" min={1} required value={payableAmountInr} onChange={(e) => setPayableAmountInr(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Paid Amount (₹)</label>
            <input type="number" min={0} value={paidAmountInr} onChange={(e) => setPaidAmountInr(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Deductions (₹)</label>
            <input type="number" min={0} value={deductionsInr} onChange={(e) => setDeductionsInr(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Penalties (₹)</label>
            <input type="number" min={0} value={penaltiesInr} onChange={(e) => setPenaltiesInr(Number(e.target.value))} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">UTR / Reference Number</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/payments')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}
