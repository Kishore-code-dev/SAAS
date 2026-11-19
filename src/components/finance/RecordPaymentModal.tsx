import React, { useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { EnterpriseModal, formatInr, formatShortDate } from '../ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { EmiInstalment, FinancePaymentMethod, VehicleFinanceRecord } from '../../types/finance'
import { EmiStatusBadge } from './FinancePrimitives'
import { readFileAsBase64 } from '../../utils/financeHelpers'

function RecordPaymentForm({
  onClose,
  instalment,
  record,
}: {
  onClose: () => void
  instalment: EmiInstalment
  record: VehicleFinanceRecord
}) {
  const { activeRole } = useFleet()
  const { settings, todayIso, recordEmiPayment } = useFinance()

  const defaultRef = `UTR-${record.loanReferenceNumber.replace(/[^A-Z0-9]/gi, '').slice(-4) || 'FIN'}-${String(instalment.emiNumber).padStart(2, '0')}`
  const [amountInr, setAmountInr] = useState<number>(instalment.remainingAmount)
  const [manualLateFeeInr, setManualLateFeeInr] = useState<number>(0)
  const [paymentDate, setPaymentDate] = useState<string>(todayIso)
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod>(record.paymentMethod ?? 'neft')
  const [bankTransactionRef, setBankTransactionRef] = useState<string>(defaultRef)
  const [notes, setNotes] = useState<string>('')
  const [receipt, setReceipt] = useState<{ fileName: string; mimeType: string; contentBase64: string } | undefined>()
  const [saving, setSaving] = useState(false)

  const canAddLateFee =
    settings.allowManualLateFeeEntry &&
    (canPerformAction(activeRole, 'edit_finance_records') || canPerformAction(activeRole, 'reconcile_finance_payments'))

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const contentBase64 = await readFileAsBase64(file)
      setReceipt({ fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 })
      toast.success(`Attached receipt: ${file.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to attach receipt.')
    } finally {
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await recordEmiPayment(instalment.id, {
        amountInr: Number(amountInr),
        manualLateFeeInr: canAddLateFee ? Number(manualLateFeeInr || 0) : 0,
        paymentDate,
        paymentMethod,
        bankTransactionRef,
        notes,
        receiptUpload: receipt,
      })
      toast.success(`Recorded payment of ${formatInr(amountInr)} for EMI #${instalment.emiNumber}`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record payment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div className="p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[#958777]">Due {formatShortDate(instalment.dueDate)} · EMI {formatInr(instalment.emiAmount)}</p>
          <p className="font-bold text-sm text-[#625346] tabular-nums mt-0.5">
            Remaining Balance: {formatInr(instalment.remainingAmount)}
          </p>
        </div>
        <EmiStatusBadge status={instalment.status} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="rp-amt" className="dm-label">Payment Amount (INR)</label>
          <input
            id="rp-amt"
            type="number"
            step="0.01"
            min={1}
            required
            value={amountInr}
            onChange={(e) => setAmountInr(Number(e.target.value))}
            className="dm-input text-xs tabular-nums"
          />
          {settings.partialPaymentRule === 'allow_partial' && amountInr < instalment.remainingAmount && (
            <span className="text-[11px] text-[#6E5696]">Partial payment will leave {formatInr(instalment.remainingAmount + (Number(manualLateFeeInr) || 0) - amountInr)} due.</span>
          )}
        </div>
        <div>
          <label htmlFor="rp-date" className="dm-label">Payment Date</label>
          <input id="rp-date" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="dm-input text-xs tabular-nums" />
        </div>
        <div>
          <label htmlFor="rp-method" className="dm-label">Payment Method</label>
          <select id="rp-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
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
        </div>
        <div>
          <label htmlFor="rp-ref" className="dm-label">Bank Transaction / UTR Ref</label>
          <input id="rp-ref" required value={bankTransactionRef} onChange={(e) => setBankTransactionRef(e.target.value)} className="dm-input text-xs font-mono" />
        </div>
        {canAddLateFee && (
          <div>
            <label htmlFor="rp-late" className="dm-label">Manual Late Fee / Penalty (INR, optional)</label>
            <input
              id="rp-late"
              type="number"
              min={0}
              value={manualLateFeeInr}
              onChange={(e) => setManualLateFeeInr(Number(e.target.value))}
              className="dm-input text-xs tabular-nums"
            />
          </div>
        )}
        <div>
          <span className="dm-label">Receipt Attachment (Optional)</span>
          <label className="btn-secondary text-xs w-full cursor-pointer justify-center">
            <Upload className="w-3.5 h-3.5" />
            {receipt ? receipt.fileName : 'Upload Receipt PDF/Image'}
            <input type="file" accept=".pdf,image/*" onChange={handleReceipt} className="hidden" />
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="rp-notes" className="dm-label">Notes</label>
        <textarea id="rp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Bank settlement remarks..." className="dm-input text-xs" />
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E5E5]">
        <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary text-xs">
          {saving ? 'Recording...' : 'Confirm Payment'}
        </button>
      </div>
    </form>
  )
}

export default function RecordPaymentModal({
  open,
  onClose,
  instalment,
  record,
}: {
  open: boolean
  onClose: () => void
  instalment: EmiInstalment | null
  record: VehicleFinanceRecord | null
}) {
  if (!instalment || !record) return null

  return (
    <EnterpriseModal
      open={open}
      onClose={onClose}
      title={`Record EMI Payment · EMI #${instalment.emiNumber}`}
      subtitle={`${record.vehicleRegistration} · ${record.bankName} · ${record.loanReferenceNumber}`}
      maxWidthClass="max-w-xl"
    >
      <RecordPaymentForm
        key={`${instalment.id}-${instalment.remainingAmount}`}
        onClose={onClose}
        instalment={instalment}
        record={record}
      />
    </EnterpriseModal>
  )
}
