import React, { useMemo, useState } from 'react'
import { BadgeIndianRupee, Plus, ShieldCheck, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import type { DepositType } from '../../types/contracts'
import {
  ContractPage,
  DataTable,
  DepositStatusBadge,
  ErrorBlock,
  Field,
  FilterSelect,
  GhostButton,
  Input,
  LoadingBlock,
  PrimaryButton,
  Select,
  Textarea,
  Toolbar,
  inr,
  shortDate,
  todayIso,
} from './ContractUi'

const DEPOSIT_TYPES: Array<{ value: DepositType; label: string }> = [
  { value: 'refundable_security', label: 'Refundable security deposit' },
  { value: 'non_refundable_charge', label: 'Non-refundable charge' },
  { value: 'performance_bond', label: 'Performance bond' },
  { value: 'bank_guarantee', label: 'Bank guarantee' },
  { value: 'other', label: 'Other' },
]

export default function BondDepositsPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [payTarget, setPayTarget] = useState<string | null>(null)
  const [deductTarget, setDeductTarget] = useState<string | null>(null)
  const [form, setForm] = useState({ contractId: '', depositType: 'refundable_security', amount: '', receivingParty: '', refundConditions: '', documentReference: '' })
  const [payForm, setPayForm] = useState({ amount: '', reference: '', method: 'NEFT', date: todayIso() })
  const [deductForm, setDeductForm] = useState({ amount: '', reason: '', evidence: '' })
  const [saving, setSaving] = useState(false)

  const canManage = canPerformContractAction(activeRole, 'manage_security_deposits')
  const canApprove = canPerformContractAction(activeRole, 'approve_deposit_refunds')
  const deposits = data?.deposits ?? []
  const contracts = data?.contracts ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deposits.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (typeFilter !== 'all' && d.depositType !== typeFilter) return false
      if (!q) return true
      return `${d.depositType} ${d.receivingParty} ${d.paymentReference} ${d.documentReference}`.toLowerCase().includes(q)
    })
  }, [deposits, search, statusFilter, typeFilter])

  const totals = {
    required: deposits.reduce((s, d) => s + d.requiredAmountInr, 0),
    paid: deposits.reduce((s, d) => s + d.paidAmountInr, 0),
    outstanding: deposits.reduce((s, d) => s + d.outstandingAmountInr, 0),
    deductions: deposits.reduce((s, d) => s + d.deductionsInr, 0),
  }

  const create = async () => {
    if (!form.contractId || Number(form.amount || 0) <= 0) { toast.error('Select a contract and enter an amount.'); return }
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(form.contractId)}/deposits`, {
        method: 'POST',
        body: JSON.stringify({
          depositType: form.depositType,
          requiredAmountInr: Number(form.amount || 0),
          receivingParty: form.receivingParty,
          refundConditions: form.refundConditions,
          documentReference: form.documentReference,
        }),
      })
      toast.success('Deposit defined.')
      setCreateOpen(false)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to define deposit.')
    } finally {
      setSaving(false)
    }
  }

  const recordPayment = async () => {
    const deposit = deposits.find((d) => d.id === payTarget)
    if (!deposit) return
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(deposit.contractId)}/deposits/${encodeURIComponent(deposit.id)}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amountInr: Number(payForm.amount || 0),
          paymentDate: payForm.date,
          paymentReference: payForm.reference,
          paymentMethod: payForm.method,
        }),
      })
      toast.success('Deposit payment recorded.')
      setPayTarget(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record deposit payment.')
    } finally {
      setSaving(false)
    }
  }

  const recordDeduction = async () => {
    const deposit = deposits.find((d) => d.id === deductTarget)
    if (!deposit) return
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(deposit.contractId)}/deposits/${encodeURIComponent(deposit.id)}/deductions`, {
        method: 'POST',
        body: JSON.stringify({
          amountInr: Number(deductForm.amount || 0),
          reason: deductForm.reason,
          evidence: deductForm.evidence,
        }),
      })
      toast.success('Deduction recorded; refund is pending approval.')
      setDeductTarget(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record deduction.')
    } finally {
      setSaving(false)
    }
  }

  const approveRefund = async (depositId: string, contractId: string) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/deposits/${encodeURIComponent(depositId)}/refund`, { method: 'POST' })
      toast.success('Refund approved.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to approve refund.')
    }
  }

  return (
    <ContractPage
      title="Bond & Deposits"
      subtitle="Security deposits, advance rentals and performance bonds. Refunds require approved deductions and cannot silently settle themselves."
      actions={canManage ? <PrimaryButton onClick={() => { setForm({ ...form, contractId: contracts[0]?.id ?? '' }); setCreateOpen(true) }}><Plus className="w-3.5 h-3.5" /> Define Deposit</PrimaryButton> : undefined}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Deposits required', value: inr(totals.required), icon: ShieldCheck },
          { label: 'Deposits paid', value: inr(totals.paid), icon: BadgeIndianRupee },
          { label: 'Outstanding', value: inr(totals.outstanding), icon: BadgeIndianRupee },
          { label: 'Deductions recorded', value: inr(totals.deductions), icon: Undo2 },
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
        placeholder="Search deposit type, receiving party or reference"
        filters={
          <>
            <FilterSelect label="statuses" value={statusFilter} onChange={setStatusFilter} options={Array.from(new Set(deposits.map((d) => d.status))).map((value) => ({ value, label: value.replace(/_/g, ' ') }))} />
            <FilterSelect label="types" value={typeFilter} onChange={setTypeFilter} options={DEPOSIT_TYPES} />
          </>
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(d) => d.id}
          emptyTitle="No deposits recorded"
          emptyDescription="Define a security deposit or bond against a contract before recording payments and deductions."
          columns={[
            { key: 'type', label: 'Deposit', render: (d) => <div><p className="text-xs font-bold text-[#625346] capitalize">{d.depositType.replace(/_/g, ' ')}</p><p className="text-[10px] text-[#958777]">{d.refundable ? 'Refundable' : 'Non-refundable'} · {d.documentReference || 'No document ref'}</p></div> },
            { key: 'party', label: 'Receiving Party', render: (d) => <span className="text-xs">{d.receivingParty || '—'}</span> },
            { key: 'required', label: 'Required', className: 'text-right', render: (d) => <span className="text-xs tabular-nums">{inr(d.requiredAmountInr)}</span> },
            { key: 'paid', label: 'Paid', className: 'text-right', render: (d) => <span className="text-xs tabular-nums">{inr(d.paidAmountInr)}</span> },
            { key: 'outstanding', label: 'Outstanding', className: 'text-right', render: (d) => <span className={`text-xs tabular-nums font-semibold ${d.outstandingAmountInr > 0 ? 'text-[#B84E42]' : 'text-[#4D6E4A]'}`}>{inr(d.outstandingAmountInr)}</span> },
            { key: 'deductions', label: 'Deductions', className: 'text-right', render: (d) => <span className="text-xs tabular-nums">{inr(d.deductionsInr)}</span> },
            { key: 'date', label: 'Payment', render: (d) => <span className="text-[10px] text-[#958777]">{d.paymentDate ? shortDate(d.paymentDate) : '—'}<br />{d.paymentReference}</span> },
            { key: 'status', label: 'Status', render: (d) => <DepositStatusBadge status={d.status} /> },
          ]}
          actions={(d) => (
            <>
              {canManage && d.outstandingAmountInr > 0 && d.status !== 'refunded' && d.status !== 'closed' && (
                <GhostButton onClick={() => { setPayTarget(d.id); setPayForm({ amount: String(d.outstandingAmountInr), reference: '', method: 'NEFT', date: todayIso() }) }}>Pay</GhostButton>
              )}
              {canApprove && d.paidAmountInr > d.deductionsInr && d.refundable && d.status !== 'refunded' && (
                <GhostButton onClick={() => { setDeductTarget(d.id); setDeductForm({ amount: '', reason: '', evidence: '' }) }}>Deduct</GhostButton>
              )}
              {canApprove && d.status === 'deduction_pending' && d.paidAmountInr > d.deductionsInr && (
                <GhostButton onClick={() => void approveRefund(d.id, d.contractId)}>Approve refund</GhostButton>
              )}
            </>
          )}
        />
      )}

      <EnterpriseModal open={createOpen} onClose={() => setCreateOpen(false)} title="Define Deposit or Bond" subtitle="Defining a deposit does not mark it paid. Payments are recorded separately." maxWidthClass="max-w-2xl">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Contract">
              <Select value={form.contractId} onChange={(e) => setForm({ ...form, contractId: e.target.value })}>
                <option value="">Select contract…</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>{c.contractNumber} · {c.supplierName}</option>)}
              </Select>
            </Field>
            <Field label="Deposit type">
              <Select value={form.depositType} onChange={(e) => setForm({ ...form, depositType: e.target.value })}>
                {DEPOSIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Required amount (INR)"><Input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
            <Field label="Receiving party"><Input value={form.receivingParty} onChange={(e) => setForm({ ...form, receivingParty: e.target.value })} /></Field>
            <Field label="Document reference"><Input value={form.documentReference} onChange={(e) => setForm({ ...form, documentReference: e.target.value })} /></Field>
          </div>
          <Field label="Refund conditions"><Textarea rows={2} value={form.refundConditions} onChange={(e) => setForm({ ...form, refundConditions: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setCreateOpen(false)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void create()} disabled={saving}>{saving ? 'Saving…' : 'Define Deposit'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal open={Boolean(payTarget)} onClose={() => setPayTarget(null)} title="Record Deposit Payment" subtitle="Only recorded payments reduce the outstanding deposit.">
        <div className="space-y-3">
          <Field label="Amount (INR)"><Input type="number" min="1" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Payment date"><Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} /></Field>
            <Field label="Method">
              <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
                <option value="NEFT">NEFT</option><option value="RTGS">RTGS</option><option value="UPI">UPI</option><option value="Cheque">Cheque</option><option value="Cash">Cash</option>
              </Select>
            </Field>
          </div>
          <Field label="Reference"><Input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setPayTarget(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void recordPayment()} disabled={saving}>{saving ? 'Recording…' : 'Record Payment'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>

      <EnterpriseModal open={Boolean(deductTarget)} onClose={() => setDeductTarget(null)} title="Record Deposit Deduction" subtitle="A reason and evidence note are required. Deductions cannot exceed the refundable balance.">
        <div className="space-y-3">
          <Field label="Deduction amount (INR)"><Input type="number" min="1" value={deductForm.amount} onChange={(e) => setDeductForm({ ...deductForm, amount: e.target.value })} /></Field>
          <Field label="Reason"><Textarea rows={2} value={deductForm.reason} onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })} /></Field>
          <Field label="Evidence reference"><Input value={deductForm.evidence} onChange={(e) => setDeductForm({ ...deductForm, evidence: e.target.value })} placeholder="Inspection report / photo reference" /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setDeductTarget(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void recordDeduction()} disabled={saving}>{saving ? 'Recording…' : 'Record Deduction'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
