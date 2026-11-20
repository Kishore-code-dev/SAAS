import React, { useMemo, useState } from 'react'
import { CheckCircle2, Plus, ReceiptText, Wallet } from 'lucide-react'
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
  PAYMENT_STATUS_OPTIONS,
  PaymentStatusBadge,
  PrimaryButton,
  Select,
  Toolbar,
  inr,
  shortDate,
  todayIso,
} from './ContractUi'

export default function ContractPaymentsPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<string | null>(null)
  const [form, setForm] = useState({ contractId: '', billingPeriod: new Date().toISOString().slice(0, 7), dueDate: todayIso(), amount: '', reference: '' })
  const [payForm, setPayForm] = useState({ amount: '', reference: '' })
  const [saving, setSaving] = useState(false)

  const canManage = canPerformContractAction(activeRole, 'manage_contract_payments')
  const canApprove = canPerformContractAction(activeRole, 'approve_contract_payments')
  const payments = data?.payments ?? []
  const contracts = data?.contracts ?? []
  const supplierNames = Array.from(new Set(payments.map((p) => p.supplierName)))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (supplierFilter !== 'all' && p.supplierName !== supplierFilter) return false
      if (!q) return true
      return `${p.billingPeriod} ${p.supplierName} ${p.paymentReference} ${p.receiptReference}`.toLowerCase().includes(q)
    })
  }, [payments, search, statusFilter, supplierFilter])

  const totals = {
    due: payments.reduce((s, p) => s + p.amountInr, 0),
    paid: payments.reduce((s, p) => s + p.paidAmountInr, 0),
    outstanding: payments.reduce((s, p) => s + p.outstandingAmountInr, 0),
    overdue: payments.filter((p) => p.status === 'overdue' || (p.status !== 'paid' && p.dueDate < todayIso())).length,
  }

  const openCreate = () => {
    setForm({ contractId: contracts[0]?.id ?? '', billingPeriod: new Date().toISOString().slice(0, 7), dueDate: todayIso(), amount: '', reference: '' })
    setCreateOpen(true)
  }

  const create = async () => {
    if (!form.contractId) { toast.error('Select a contract.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(form.contractId)}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          billingPeriod: form.billingPeriod,
          dueDate: form.dueDate,
          amountInr: Number(form.amount || 0),
          status: 'pending_approval',
          paymentReference: form.reference,
        }),
      })
      toast.success('Payment schedule created for approval.')
      setCreateOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create payment.')
    } finally {
      setSaving(false)
    }
  }

  const update = async (contractId: string, paymentId: string, body: Record<string, unknown>) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/payments/${encodeURIComponent(paymentId)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast.success('Payment updated.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update payment.')
    }
  }

  const submitPayment = async () => {
    if (!payTarget) return
    const payment = payments.find((p) => p.id === payTarget)
    if (!payment) return
    setSaving(true)
    try {
      await update(payment.contractId, payment.id, {
        status: 'paid',
        paidAmountInr: Number(payForm.amount || 0),
        paymentReference: payForm.reference,
      })
      setPayTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ContractPage
      title="Contract Payments"
      subtitle="Rental, per-km, per-trip and settlement obligations. Payment status never advances merely because a due date passed."
      actions={canManage ? <PrimaryButton onClick={openCreate}><Plus className="w-3.5 h-3.5" /> New Payment Schedule</PrimaryButton> : undefined}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total scheduled', value: inr(totals.due), icon: ReceiptText },
          { label: 'Paid to date', value: inr(totals.paid), icon: CheckCircle2 },
          { label: 'Outstanding', value: inr(totals.outstanding), icon: Wallet },
          { label: 'Overdue entries', value: totals.overdue, icon: Wallet },
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
        placeholder="Search billing period, supplier or payment reference"
        filters={
          <>
            <FilterSelect label="statuses" value={statusFilter} onChange={setStatusFilter} options={PAYMENT_STATUS_OPTIONS} />
            <FilterSelect label="suppliers" value={supplierFilter} onChange={setSupplierFilter} options={supplierNames.map((s) => ({ value: s, label: s }))} />
          </>
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(p) => p.id}
          emptyTitle="No payments recorded"
          emptyDescription="Create a payment schedule against an active contract to begin settlement tracking."
          columns={[
            { key: 'period', label: 'Billing Period', render: (p) => <div><p className="text-xs font-bold text-[#625346]">{p.billingPeriod}</p><p className="text-[10px] text-[#958777]">due {shortDate(p.dueDate)}</p></div> },
            { key: 'supplier', label: 'Supplier', render: (p) => <span className="text-xs">{p.supplierName}</span> },
            { key: 'amount', label: 'Amount', className: 'text-right', render: (p) => <span className="text-xs tabular-nums">{inr(p.amountInr)}</span> },
            { key: 'paid', label: 'Paid', className: 'text-right', render: (p) => <span className="text-xs tabular-nums">{inr(p.paidAmountInr)}</span> },
            { key: 'outstanding', label: 'Outstanding', className: 'text-right', render: (p) => <span className={`text-xs tabular-nums font-semibold ${p.outstandingAmountInr > 0 ? 'text-[#B84E42]' : 'text-[#4D6E4A]'}`}>{inr(p.outstandingAmountInr)}</span> },
            { key: 'status', label: 'Status', render: (p) => <PaymentStatusBadge status={p.status} /> },
            { key: 'reference', label: 'Reference', render: (p) => <span className="text-[10px] text-[#958777]">{p.paymentReference || p.receiptReference || '—'}</span> },
          ]}
          actions={(p) => (
            <>
              {canApprove && p.status === 'pending_approval' && (
                <GhostButton onClick={() => void update(p.contractId, p.id, { status: 'approved' })} aria-label="Approve payment"><CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A]" /></GhostButton>
              )}
              {canManage && p.status !== 'paid' && p.status !== 'cancelled' && p.status !== 'reconciled' && (
                <GhostButton onClick={() => { setPayTarget(p.id); setPayForm({ amount: String(p.outstandingAmountInr), reference: '' }) }}>Record</GhostButton>
              )}
            </>
          )}
        />
      )}

      <EnterpriseModal open={createOpen} onClose={() => setCreateOpen(false)} title="New Payment Schedule" subtitle="Schedules remain unapproved until an authorised approver signs off.">
        <div className="space-y-3">
          <Field label="Contract">
            <Select value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })}>
              <option value="">Select contract…</option>
              {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNumber} · {c.supplierName}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing period (YYYY-MM)"><Input value={form.billingPeriod} onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })} placeholder="2026-11" /></Field>
            <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
          <Field label="Amount (INR)"><Input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Reference / note"><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void create()} disabled={saving}>{saving ? 'Saving…' : 'Create Schedule'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal open={Boolean(payTarget)} onClose={() => setPayTarget(null)} title="Record Payment" subtitle="Only recorded payments reduce the outstanding balance.">
        <div className="space-y-3">
          <Field label="Amount paid (INR)"><Input type="number" min="1" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
          <Field label="Payment reference"><Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder="NEFT / UTR reference" /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setPayTarget(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void submitPayment()} disabled={saving}>{saving ? 'Recording…' : 'Record Payment'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
