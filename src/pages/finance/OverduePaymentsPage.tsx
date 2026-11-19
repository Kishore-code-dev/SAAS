import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, EnterpriseModal, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import { diffDaysIso } from '../../utils/financeEngine'
import type { EmiInstalment } from '../../types/finance'
import { EmiStatusBadge, ReconciliationBadge } from '../../components/finance/FinancePrimitives'
import RecordPaymentModal from '../../components/finance/RecordPaymentModal'

export default function OverduePaymentsPage() {
  const { activeRole, activeOrganization } = useFleet()
  const { records, instalments, todayIso, settings, updateEmiStatusOrFee } = useFinance()

  const [payEmi, setPayEmi] = useState<EmiInstalment | null>(null)
  const [lateFeeTarget, setLateFeeTarget] = useState<EmiInstalment | null>(null)
  const [lateFeeVal, setLateFeeVal] = useState(500)
  const [lateFeeReason, setLateFeeReason] = useState('')
  const [savingFee, setSavingFee] = useState(false)

  const canPay = canPerformAction(activeRole, 'record_finance_payments')
  const canEdit = canPerformAction(activeRole, 'edit_finance_records')
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])

  const overdueItems = useMemo(
    () =>
      instalments
        .filter(
          (i) =>
            i.status !== 'paid' &&
            i.status !== 'waived' &&
            i.status !== 'cancelled' &&
            diffDaysIso(i.dueDate, todayIso) < 0 &&
            i.remainingAmount > 0.01,
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [instalments, todayIso],
  )

  const totalOverdue = overdueItems.reduce((s, i) => s + i.remainingAmount, 0)

  const handleSaveLateFee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lateFeeTarget) return
    setSavingFee(true)
    try {
      await updateEmiStatusOrFee(lateFeeTarget.id, {
        action: 'add_late_fee',
        lateFeeInr: Number(lateFeeVal),
        reason: lateFeeReason.trim() || 'Manual late fee entry confirmed on financier notice',
      })
      toast.success(`Added manual late fee of ${formatInr(lateFeeVal)} to EMI #${lateFeeTarget.emiNumber}`)
      setLateFeeTarget(null)
      setLateFeeReason('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add manual late fee.')
    } finally {
      setSavingFee(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overdue Payments"
        subtitle={`${activeOrganization.name} · Unsettled past-due EMIs, partial payments, manual late fees & resolution`}
      >
        <div className="px-3.5 py-2 rounded-xl bg-[#FCECEB] border border-[#E7A8A0] text-xs font-bold text-[#A24034] tabular-nums">
          {overdueItems.length} Overdue · {formatInr(totalOverdue)}
        </div>
      </PageHeader>

      {overdueItems.length === 0 ? (
        <EmptySectionState
          title="No overdue EMI payments"
          description="All past-due vehicle finance instalments are settled, waived, or reconciled."
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:text-[11px]">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Bank & Loan Ref</th>
                  <th>EMI #</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>EMI Amount</th>
                  <th>Manual Late Fee</th>
                  <th>Paid</th>
                  <th>Remaining Due</th>
                  <th>Status / Recon</th>
                  <th className="text-right">Resolution Actions</th>
                </tr>
              </thead>
              <tbody>
                {overdueItems.map((emi) => {
                  const rec = recordById.get(emi.financeId)
                  const daysOver = Math.abs(diffDaysIso(emi.dueDate, todayIso))
                  return (
                    <tr key={emi.id}>
                      <td className="font-bold whitespace-nowrap">{rec?.vehicleRegistration ?? emi.vehicleId}</td>
                      <td className="max-w-[165px]">
                        <p className="font-medium text-[#625346] leading-snug">{rec?.bankName}</p>
                        <p className="text-[11px] font-mono text-[#958777]">{rec?.loanReferenceNumber}</p>
                      </td>
                      <td className="tabular-nums font-semibold">#{emi.emiNumber}</td>
                      <td className="tabular-nums text-xs whitespace-nowrap">{formatShortDate(emi.dueDate)}</td>
                      <td className="tabular-nums font-bold text-[#A24034]">{daysOver}d</td>
                      <td className="tabular-nums">{formatInr(emi.emiAmount)}</td>
                      <td className="tabular-nums">{emi.lateFeeInr > 0 ? formatInr(emi.lateFeeInr) : 'None'}</td>
                      <td className="tabular-nums text-[#4D6E4A]">{formatInr(emi.amountPaid)}</td>
                      <td className="tabular-nums font-bold text-[#A24034]">{formatInr(emi.remainingAmount)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <EmiStatusBadge status={emi.status} />
                          <ReconciliationBadge status={emi.reconciliationStatus} />
                        </div>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex flex-col items-end gap-1">
                          {canPay && (
                            <button type="button" onClick={() => setPayEmi(emi)} className="btn-primary text-[11px] px-2.5 py-1">
                              Pay / Partial
                            </button>
                          )}
                          {canEdit && settings.allowManualLateFeeEntry && (
                            <button
                              type="button"
                              onClick={() => {
                                setLateFeeTarget(emi)
                                setLateFeeVal(500)
                              }}
                              className="btn-secondary text-[11px] px-2.5 py-1"
                            >
                              + Late Fee
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

      <RecordPaymentModal
        open={Boolean(payEmi)}
        onClose={() => setPayEmi(null)}
        instalment={payEmi}
        record={payEmi ? recordById.get(payEmi.financeId) ?? null : null}
      />

      <EnterpriseModal
        open={Boolean(lateFeeTarget)}
        onClose={() => setLateFeeTarget(null)}
        title={`Enter Manual Late Fee · EMI #${lateFeeTarget?.emiNumber ?? ''}`}
        subtitle="Penalties are never assumed automatically; only confirmed financier late charges are recorded."
      >
        <form onSubmit={handleSaveLateFee} className="space-y-4 text-xs">
          <div>
            <label htmlFor="ol-fee" className="dm-label">Late Fee / Bounce Charge (INR)</label>
            <input id="ol-fee" type="number" min={1} required value={lateFeeVal} onChange={(e) => setLateFeeVal(Number(e.target.value))} className="dm-input tabular-nums" />
          </div>
          <div>
            <label htmlFor="ol-rsn" className="dm-label">Supporting Reason / Advice Ref</label>
            <input id="ol-rsn" required value={lateFeeReason} onChange={(e) => setLateFeeReason(e.target.value)} placeholder="e.g. Chola bounce memo #BM-882" className="dm-input" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <button type="button" onClick={() => setLateFeeTarget(null)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" disabled={savingFee} className="btn-primary text-xs">Save Late Fee</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
