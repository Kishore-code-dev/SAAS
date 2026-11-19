import React, { useState } from 'react'
import { toast } from 'sonner'
import { EnterpriseModal, formatInr, formatShortDate } from '../ui/EnterprisePrimitives'
import { useFleet } from '../../hooks/useFleet'
import { useFinance } from '../../hooks/useFinance'
import { canPerformAction } from '../../utils/rbac'
import type { EmiInstalment, VehicleFinanceRecord } from '../../types/finance'
import { EmiStatusBadge, ReconciliationBadge } from './FinancePrimitives'

export default function EmiDetailModal({
  open,
  onClose,
  instalment,
  record,
  onOpenRecordPayment,
}: {
  open: boolean
  onClose: () => void
  instalment: EmiInstalment | null
  record: VehicleFinanceRecord | null
  onOpenRecordPayment: (emi: EmiInstalment) => void
}) {
  const { activeRole } = useFleet()
  const { payments, updateEmiStatusOrFee } = useFinance()
  const [lateFeeInput, setLateFeeInput] = useState(500)
  const [reasonInput, setReasonInput] = useState('')
  const [busy, setBusy] = useState(false)

  if (!instalment || !record) return null

  const canPay =
    canPerformAction(activeRole, 'record_finance_payments') &&
    instalment.status !== 'paid' &&
    instalment.status !== 'waived' &&
    instalment.status !== 'cancelled'
  const canEdit = canPerformAction(activeRole, 'edit_finance_records')

  const relatedPayments = payments.filter((p) => p.emiId === instalment.id)

  const handleAction = async (action: 'waive' | 'cancel' | 'add_late_fee') => {
    if (!reasonInput.trim()) {
      toast.error('Enter an audit reason before applying this adjustment.')
      return
    }
    setBusy(true)
    try {
      await updateEmiStatusOrFee(instalment.id, {
        action,
        lateFeeInr: action === 'add_late_fee' ? Number(lateFeeInput) : undefined,
        reason: reasonInput.trim(),
      })
      toast.success(`Updated EMI #${instalment.emiNumber}`)
      setReasonInput('')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update EMI.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <EnterpriseModal
      open={open}
      onClose={onClose}
      title={`EMI #${instalment.emiNumber} Details · ${record.vehicleRegistration}`}
      subtitle={`${record.bankName} · ${record.loanReferenceNumber}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
          <div>
            <p className="text-[#958777]">Due Date: <strong className="text-[#625346]">{formatShortDate(instalment.dueDate)}</strong></p>
            <p className="text-[#958777] mt-0.5">Opening Principal: <strong className="text-[#625346] tabular-nums">{formatInr(instalment.openingPrincipal)}</strong></p>
          </div>
          <div className="flex items-center gap-2">
            <EmiStatusBadge status={instalment.status} />
            <ReconciliationBadge status={instalment.reconciliationStatus} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#958777]">Principal Component</span>
            <p className="text-sm font-bold text-[#625346] tabular-nums mt-0.5">{formatInr(instalment.principalComponent)}</p>
          </div>
          <div className="p-3 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#958777]">Interest Component</span>
            <p className="text-sm font-bold text-[#625346] tabular-nums mt-0.5">{formatInr(instalment.interestComponent)}</p>
          </div>
          <div className="p-3 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#958777]">Base EMI Amount</span>
            <p className="text-sm font-bold text-[#625346] tabular-nums mt-0.5">{formatInr(instalment.emiAmount)}</p>
          </div>
          <div className="p-3 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#958777]">Manual Late Fee</span>
            <p className="text-sm font-bold text-[#625346] tabular-nums mt-0.5">{formatInr(instalment.lateFeeInr)}</p>
          </div>
          <div className="p-3 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#958777]">Amount Paid</span>
            <p className="text-sm font-bold text-[#4D6E4A] tabular-nums mt-0.5">{formatInr(instalment.amountPaid)}</p>
          </div>
          <div className="p-3 rounded-xl border border-[#E5E5E5]">
            <span className="text-[#958777]">Remaining Due</span>
            <p className="text-sm font-bold text-[#A24034] tabular-nums mt-0.5">{formatInr(instalment.remainingAmount)}</p>
          </div>
        </div>

        {relatedPayments.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-bold text-[#625346]">Payments Recorded Against This EMI</h4>
            <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-xl">
              {relatedPayments.map((p) => (
                <div key={p.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#625346] tabular-nums">
                      {formatInr(p.amountInr)} · {p.paymentMethod.toUpperCase()} · {p.bankTransactionRef}
                    </p>
                    <p className="text-[11px] text-[#958777]">{formatShortDate(p.paymentDate)} · By {p.recordedBy}</p>
                  </div>
                  <ReconciliationBadge status={p.reconciliationStatus} />
                </div>
              ))}
            </div>
          </div>
        )}

        {canEdit && instalment.status !== 'paid' && instalment.status !== 'cancelled' && (
          <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-3">
            <h4 className="font-bold text-[#625346]">Authorized Adjustment (Audit Logged)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label htmlFor="ed-lf" className="dm-label">Manual Late Fee (INR)</label>
                <input
                  id="ed-lf"
                  type="number"
                  min={1}
                  value={lateFeeInput}
                  onChange={(e) => setLateFeeInput(Number(e.target.value))}
                  className="dm-input text-xs tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ed-rsn" className="dm-label">Adjustment Reason</label>
                <input
                  id="ed-rsn"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g. Bank bounce charge confirmed on statement"
                  className="dm-input text-xs"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void handleAction('add_late_fee')} className="btn-secondary text-xs">
                Add Manual Late Fee
              </button>
              <button type="button" disabled={busy} onClick={() => void handleAction('waive')} className="btn-secondary text-xs">
                Waive Instalment
              </button>
              <button type="button" disabled={busy} onClick={() => void handleAction('cancel')} className="btn-danger text-xs">
                Cancel Instalment
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">Close</button>
          {canPay && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenRecordPayment(instalment)
              }}
              className="btn-primary text-xs"
            >
              Record Payment ({formatInr(instalment.remainingAmount)})
            </button>
          )}
        </div>
      </div>
    </EnterpriseModal>
  )
}
