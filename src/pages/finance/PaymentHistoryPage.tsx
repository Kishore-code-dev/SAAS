import React, { useMemo, useState } from 'react'
import { CheckCircle2, Download, Edit3, FileText, Plus, Search, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, EnterpriseModal, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { EmiInstalment, FinancePaymentMethod, FinancePaymentTransaction, ReconciliationStatus } from '../../types/finance'
import { ReconciliationBadge } from '../../components/finance/FinancePrimitives'
import { exportRowsToCsv, exportRowsToExcelHtml, paymentMethodLabel } from '../../utils/financeHelpers'
import RecordPaymentModal from '../../components/finance/RecordPaymentModal'

export default function PaymentHistoryPage() {
  const { activeRole, activeOrganization } = useFleet()
  const {
    records,
    instalments,
    payments,
    reconcilePayment,
    correctPayment,
  } = useFinance()

  const [query, setQuery] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [reconFilter, setReconFilter] = useState<'all' | ReconciliationStatus>('all')
  const [methodFilter, setMethodFilter] = useState<'all' | FinancePaymentMethod>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Record Payment picker modal state
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedFinanceId, setSelectedFinanceId] = useState<string>('')
  const [selectedEmiId, setSelectedEmiId] = useState<string>('')
  const [payModalEmi, setPayModalEmi] = useState<EmiInstalment | null>(null)

  // Correction modal state
  const [correcting, setCorrecting] = useState<FinancePaymentTransaction | null>(null)
  const [corrAmount, setCorrAmount] = useState<number>(0)
  const [corrRef, setCorrRef] = useState('')
  const [corrReason, setCorrReason] = useState('')
  const [savingCorr, setSavingCorr] = useState(false)

  const canPay = canPerformAction(activeRole, 'record_finance_payments')
  const canRecon = canPerformAction(activeRole, 'reconcile_finance_payments')

  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])
  const banks = useMemo(() => Array.from(new Set(records.map((r) => r.bankName))).sort(), [records])
  const vehicleOptions = useMemo(
    () => Array.from(new Map(records.map((r) => [r.vehicleId, r.vehicleRegistration])).entries()),
    [records],
  )

  const openLoans = useMemo(
    () => records.filter((r) => r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed' && r.financeStatus !== 'cancelled'),
    [records],
  )

  const selectableEmis = useMemo(() => {
    const finId = selectedFinanceId || openLoans[0]?.id || ''
    return instalments
      .filter((i) => i.financeId === finId && i.status !== 'paid' && i.status !== 'waived' && i.status !== 'cancelled')
      .sort((a, b) => a.emiNumber - b.emiNumber)
  }, [instalments, selectedFinanceId, openLoans])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return payments.filter((p) => {
      const rec = recordById.get(p.financeId)
      if (vehicleFilter !== 'all' && p.vehicleId !== vehicleFilter) return false
      if (bankFilter !== 'all' && rec?.bankName !== bankFilter) return false
      if (reconFilter !== 'all' && p.reconciliationStatus !== reconFilter) return false
      if (methodFilter !== 'all' && p.paymentMethod !== methodFilter) return false
      if (dateFrom && p.paymentDate < dateFrom) return false
      if (dateTo && p.paymentDate > dateTo) return false
      if (!q) return true
      return (
        (rec?.vehicleRegistration ?? '').toLowerCase().includes(q) ||
        (rec?.loanReferenceNumber ?? '').toLowerCase().includes(q) ||
        (rec?.bankName ?? '').toLowerCase().includes(q) ||
        p.bankTransactionRef.toLowerCase().includes(q) ||
        p.recordedBy.toLowerCase().includes(q)
      )
    })
  }, [payments, recordById, vehicleFilter, bankFilter, reconFilter, methodFilter, dateFrom, dateTo, query])

  const summary = useMemo(() => {
    const activeRows = filtered.filter((p) => !p.isCorrected)
    return {
      totalPaid: activeRows.reduce((s, p) => s + p.amountInr, 0),
      reconciledCount: activeRows.filter((p) => p.reconciliationStatus === 'reconciled').length,
      pendingCount: activeRows.filter((p) => p.reconciliationStatus === 'pending').length,
      discrepancyCount: activeRows.filter((p) => p.reconciliationStatus === 'discrepancy').length,
    }
  }, [filtered])

  const headers = [
    'Payment Date',
    'Vehicle',
    'Loan Reference',
    'Bank',
    'EMI Number',
    'Payment Amount (INR)',
    'Late Fee (INR)',
    'Method',
    'Transaction Ref',
    'Reconciliation',
    'Recorded By',
    'Audit Status',
  ]

  const buildRows = () =>
    filtered.map((p) => {
      const rec = recordById.get(p.financeId)
      return [
        p.paymentDate,
        rec?.vehicleRegistration ?? p.vehicleId,
        rec?.loanReferenceNumber ?? '—',
        rec?.bankName ?? '—',
        `#${p.emiNumber}`,
        p.amountInr,
        p.lateFeeComponentInr,
        paymentMethodLabel(p.paymentMethod),
        p.bankTransactionRef,
        p.reconciliationStatus,
        p.recordedBy,
        p.isCorrected ? 'Superseded by correction' : 'Active',
      ]
    })

  const handleOpenPicker = () => {
    const firstLoan = openLoans[0]
    setSelectedFinanceId(firstLoan?.id ?? '')
    const firstEmi = firstLoan
      ? instalments
          .filter((i) => i.financeId === firstLoan.id && i.status !== 'paid' && i.status !== 'waived' && i.status !== 'cancelled')
          .sort((a, b) => a.emiNumber - b.emiNumber)[0]
      : undefined
    setSelectedEmiId(firstEmi?.id ?? '')
    setPickerOpen(true)
  }

  const handleOpenCorrection = (p: FinancePaymentTransaction) => {
    setCorrecting(p)
    setCorrAmount(p.amountInr)
    setCorrRef(p.bankTransactionRef)
    setCorrReason('')
  }

  const submitCorrection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!correcting) return
    if (!corrReason.trim()) {
      toast.error('Audit reason is required to correct a recorded payment.')
      return
    }
    setSavingCorr(true)
    try {
      await correctPayment(correcting.id, {
        correctedAmountInr: Number(corrAmount),
        bankTransactionRef: corrRef.trim(),
        reason: corrReason.trim(),
      })
      toast.success(`Posted audit-logged correction for EMI #${correcting.emiNumber}`)
      setCorrecting(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to post payment correction.')
    } finally {
      setSavingCorr(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        subtitle={`${activeOrganization.name} · Immutable EMI settlement ledger, bank reconciliation & audit corrections`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportRowsToCsv(`finance-payments-${activeOrganization.code}`, headers, buildRows())}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportRowsToExcelHtml(`finance-payments-${activeOrganization.code}`, 'DriveMitra Payment History', headers, buildRows())}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          {canPay && (
            <button type="button" onClick={handleOpenPicker} className="btn-primary text-xs">
              <Plus className="w-3.5 h-3.5" />
              Record Payment
            </button>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="enterprise-card p-4">
          <p className="text-xs text-[#958777]">Active Ledger Total</p>
          <p className="text-xl font-bold text-[#625346] tabular-nums mt-1">{formatInr(summary.totalPaid)}</p>
        </div>
        <div className="enterprise-card p-4">
          <p className="text-xs text-[#958777]">Reconciled</p>
          <p className="text-xl font-bold text-[#4D6E4A] tabular-nums mt-1">{summary.reconciledCount}</p>
        </div>
        <div className="enterprise-card p-4">
          <p className="text-xs text-[#958777]">Pending Reconciliation</p>
          <p className="text-xl font-bold text-[#8F6510] tabular-nums mt-1">{summary.pendingCount}</p>
        </div>
        <div className="enterprise-card p-4">
          <p className="text-xs text-[#958777]">Flagged Discrepancies</p>
          <p className="text-xl font-bold text-[#A24034] tabular-nums mt-1">{summary.discrepancyCount}</p>
        </div>
      </div>

      <div className="enterprise-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 text-xs">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vehicle, loan ref, UTR, actor..."
            aria-label="Search payment history"
            className="dm-input pl-9 py-2 text-xs"
          />
        </div>
        <select aria-label="Filter by vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="dm-input py-2 text-xs">
          <option value="all">All Vehicles</option>
          {vehicleOptions.map(([id, reg]) => (
            <option key={id} value={id}>{reg}</option>
          ))}
        </select>
        <select aria-label="Filter by bank" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="dm-input py-2 text-xs">
          <option value="all">All Banks</option>
          {banks.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select aria-label="Filter by reconciliation status" value={reconFilter} onChange={(e) => setReconFilter(e.target.value as 'all' | ReconciliationStatus)} className="dm-input py-2 text-xs">
          <option value="all">All Reconciliation</option>
          <option value="reconciled">Reconciled</option>
          <option value="pending">Pending Recon</option>
          <option value="discrepancy">Discrepancy</option>
        </select>
        <select aria-label="Filter by payment method" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value as 'all' | FinancePaymentMethod)} className="dm-input py-2 text-xs">
          <option value="all">All Methods</option>
          <option value="nach">NACH</option>
          <option value="ecs">ECS</option>
          <option value="neft">NEFT</option>
          <option value="rtgs">RTGS</option>
          <option value="imps">IMPS</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
          <option value="cash">Cash</option>
          <option value="bank_transfer">Bank Transfer</option>
        </select>
        <div className="flex items-center gap-1.5">
          <input aria-label="From date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
          <input aria-label="To date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptySectionState
          title="No payment transactions match the current filters"
          description="Record an EMI payment or clear filters to inspect payment history."
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Loan Reference</th>
                  <th>EMI #</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Transaction Ref</th>
                  <th>Receipt</th>
                  <th>Reconciliation</th>
                  <th>Recorded By</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const rec = recordById.get(p.financeId)
                  return (
                    <tr key={p.id} className={p.isCorrected ? 'opacity-60 bg-[#FAFAFA]' : ''}>
                      <td className="tabular-nums text-xs whitespace-nowrap">{formatShortDate(p.paymentDate)}</td>
                      <td className="font-semibold whitespace-nowrap">{rec?.vehicleRegistration ?? p.vehicleId}</td>
                      <td className="font-mono text-xs whitespace-nowrap">{rec?.loanReferenceNumber ?? '—'}</td>
                      <td className="tabular-nums font-semibold">#{p.emiNumber}</td>
                      <td className="tabular-nums font-bold whitespace-nowrap">
                        {formatInr(p.amountInr)}
                        {p.lateFeeComponentInr > 0 && (
                          <span className="block text-[10px] font-normal text-[#958777]">incl. {formatInr(p.lateFeeComponentInr)} fee</span>
                        )}
                      </td>
                      <td className="text-xs whitespace-nowrap">{paymentMethodLabel(p.paymentMethod)}</td>
                      <td className="font-mono text-xs whitespace-nowrap">
                        {p.bankTransactionRef}
                        {p.isCorrected && <span className="block text-[10px] font-sans text-[#A24034]">Corrected / Superseded</span>}
                      </td>
                      <td className="whitespace-nowrap">
                        {p.receiptDocId ? (
                          <a
                            href={`/api/finance/documents/${p.receiptDocId}/download`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E5696] hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {p.receiptFileName || 'Receipt'}
                          </a>
                        ) : (
                          <span className="text-xs text-[#958777]">—</span>
                        )}
                      </td>
                      <td><ReconciliationBadge status={p.reconciliationStatus} /></td>
                      <td className="text-xs text-[#958777] whitespace-nowrap">{p.recordedBy}</td>
                      <td className="text-right whitespace-nowrap">
                        {canRecon && !p.isCorrected && (
                          <div className="inline-flex items-center gap-1.5">
                            {p.reconciliationStatus !== 'reconciled' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await reconcilePayment(p.id, 'reconciled', 'Verified against bank statement')
                                  toast.success(`Reconciled ${p.bankTransactionRef}`)
                                }}
                                className="btn-primary text-[11px] px-2.5 py-1"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Reconcile
                              </button>
                            )}
                            {p.reconciliationStatus !== 'discrepancy' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await reconcilePayment(p.id, 'discrepancy', 'Bank statement amount mismatch flagged')
                                  toast.warning(`Flagged discrepancy on ${p.bankTransactionRef}`)
                                }}
                                className="btn-secondary text-[11px] px-2 py-1"
                              >
                                <ShieldAlert className="w-3 h-3 text-[#B84E42]" />
                                Flag
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenCorrection(p)}
                              className="btn-secondary text-[11px] px-2 py-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Correct
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loan / EMI selector before opening RecordPaymentModal */}
      <EnterpriseModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select Loan & Open EMI"
        subtitle="Choose the financed vehicle and instalment to record payment against"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <div>
            <label htmlFor="ph-loan" className="dm-label">Financed Vehicle / Loan</label>
            <select
              id="ph-loan"
              value={selectedFinanceId}
              onChange={(e) => {
                const nextFin = e.target.value
                setSelectedFinanceId(nextFin)
                const nextFirst = instalments
                  .filter((i) => i.financeId === nextFin && i.status !== 'paid' && i.status !== 'waived' && i.status !== 'cancelled')
                  .sort((a, b) => a.emiNumber - b.emiNumber)[0]
                setSelectedEmiId(nextFirst?.id ?? '')
              }}
              className="dm-input text-xs"
            >
              {openLoans.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicleRegistration} · {r.loanReferenceNumber} ({r.bankName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ph-emi" className="dm-label">Open EMI Instalment</label>
            <select
              id="ph-emi"
              value={selectedEmiId}
              onChange={(e) => setSelectedEmiId(e.target.value)}
              className="dm-input text-xs"
            >
              {selectableEmis.map((emi) => (
                <option key={emi.id} value={emi.id}>
                  EMI #{emi.emiNumber} · Due {formatShortDate(emi.dueDate)} · Remaining {formatInr(emi.remainingAmount)} ({emi.status.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <button type="button" onClick={() => setPickerOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button
              type="button"
              disabled={!selectedEmiId}
              onClick={() => {
                const chosen = instalments.find((i) => i.id === selectedEmiId) ?? null
                setPickerOpen(false)
                setPayModalEmi(chosen)
              }}
              className="btn-primary text-xs"
            >
              Continue to Payment
            </button>
          </div>
        </div>
      </EnterpriseModal>

      <RecordPaymentModal
        open={Boolean(payModalEmi)}
        onClose={() => setPayModalEmi(null)}
        instalment={payModalEmi}
        record={payModalEmi ? recordById.get(payModalEmi.financeId) ?? null : null}
      />

      <EnterpriseModal
        open={Boolean(correcting)}
        onClose={() => setCorrecting(null)}
        title={correcting ? `Audit-Logged Payment Correction · EMI #${correcting.emiNumber}` : 'Payment Correction'}
        subtitle="Supersedes original entry and records an audit trail adjustment"
        maxWidthClass="max-w-md"
      >
        {correcting && (
          <form onSubmit={submitCorrection} className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
              <p className="text-[#958777]">Original Recorded Amount</p>
              <p className="font-bold text-[#625346] tabular-nums">{formatInr(correcting.amountInr)} · Ref {correcting.bankTransactionRef}</p>
            </div>
            <div>
              <label htmlFor="corr-amt" className="dm-label">Corrected Amount (INR)</label>
              <input
                id="corr-amt"
                type="number"
                step="0.01"
                min={1}
                required
                value={corrAmount}
                onChange={(e) => setCorrAmount(Number(e.target.value))}
                className="dm-input text-xs tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="corr-ref" className="dm-label">Corrected Bank Transaction Ref</label>
              <input
                id="corr-ref"
                required
                value={corrRef}
                onChange={(e) => setCorrRef(e.target.value)}
                className="dm-input text-xs font-mono"
              />
            </div>
            <div>
              <label htmlFor="corr-reason" className="dm-label">Audit Reason (Mandatory)</label>
              <textarea
                id="corr-reason"
                rows={2}
                required
                value={corrReason}
                onChange={(e) => setCorrReason(e.target.value)}
                placeholder="e.g. Bank reversed ₹2,000 surcharge or corrected UTR entry"
                className="dm-input text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
              <button type="button" onClick={() => setCorrecting(null)} className="btn-secondary text-xs">Cancel</button>
              <button type="submit" disabled={savingCorr} className="btn-primary text-xs">
                {savingCorr ? 'Posting...' : 'Post Audit Correction'}
              </button>
            </div>
          </form>
        )}
      </EnterpriseModal>
    </div>
  )
}
