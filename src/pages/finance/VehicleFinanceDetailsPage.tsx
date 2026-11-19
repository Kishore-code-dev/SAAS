import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Download, FileCheck2, Lock, Upload } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatDateTime, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { EmiInstalment, FinanceDocCategory } from '../../types/finance'
import {
  EmiStatusBadge,
  FinanceStatusBadge,
  ReconciliationBadge,
} from '../../components/finance/FinancePrimitives'
import {
  DOC_CATEGORIES,
  docCategoryLabel,
  interestTypeLabel,
  loanTypeLabel,
  paymentMethodLabel,
  readFileAsBase64,
} from '../../utils/financeHelpers'
import RecordPaymentModal from '../../components/finance/RecordPaymentModal'
import EmiDetailModal from '../../components/finance/EmiDetailModal'

const DETAILS_TABS = [
  'Overview',
  'Loan Details',
  'EMI Schedule',
  'Payment History',
  'Bank Details',
  'Documents',
  'Activity History',
] as const

type DetailsTab = (typeof DETAILS_TABS)[number]

export default function VehicleFinanceDetailsPage() {
  const { financeId } = useParams()
  const navigate = useNavigate()
  const { activeRole, activeOrganization } = useFleet()
  const {
    records,
    instalments,
    payments,
    documents,
    updateHistory,
    maskedForRole,
    reconcilePayment,
    uploadFinanceDocument,
    verifyFinanceDocument,
  } = useFinance()

  const [tab, setTab] = useState<DetailsTab>('Overview')
  const [payEmi, setPayEmi] = useState<EmiInstalment | null>(null)
  const [detailEmi, setDetailEmi] = useState<EmiInstalment | null>(null)
  const [docCategory, setDocCategory] = useState<FinanceDocCategory>('bank_statements')
  const [docTitle, setDocTitle] = useState('')
  const [uploading, setUploading] = useState(false)

  const record = records.find((r) => r.id === financeId)
  const loanEmis = useMemo(
    () => instalments.filter((i) => i.financeId === financeId).sort((a, b) => a.emiNumber - b.emiNumber),
    [instalments, financeId],
  )
  const loanPayments = useMemo(
    () => payments.filter((p) => p.financeId === financeId),
    [payments, financeId],
  )
  const loanDocs = useMemo(
    () => documents.filter((d) => d.financeId === financeId),
    [documents, financeId],
  )
  const loanHistory = useMemo(
    () => updateHistory.filter((h) => h.financeId === financeId || h.entityId === financeId),
    [updateHistory, financeId],
  )

  if (!record) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="btn-secondary text-xs">
          <ArrowLeft className="w-4 h-4" />
          Back to Vehicle Finance
        </button>
        <EmptySectionState
          title="Vehicle finance record not found"
          description="The requested finance agreement does not exist in your active organization."
          actionLabel="Return to Register"
          onAction={() => navigate('/dashboard/finance/vehicles')}
        />
      </div>
    )
  }

  const canPay = canPerformAction(activeRole, 'record_finance_payments')
  const canRecon = canPerformAction(activeRole, 'reconcile_finance_payments')
  const canAddDoc = canPerformAction(activeRole, 'add_finance_records')

  const progressPct =
    record.netFinancedAmount > 0
      ? Math.min(100, Math.round((record.principalRepaid / record.netFinancedAmount) * 100))
      : 0

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const contentBase64 = await readFileAsBase64(file)
      await uploadFinanceDocument({
        financeId: record.id,
        vehicleId: record.vehicleId,
        category: docCategory,
        title: docTitle.trim() || `${docCategoryLabel(docCategory)} · ${record.vehicleRegistration}`,
        fileName: file.name,
        mimeType: file.type || 'application/pdf',
        contentBase64,
      })
      setDocTitle('')
      toast.success(`Uploaded ${file.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload document.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="text-xs font-semibold text-[#958777] hover:text-[#625346] inline-flex items-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          All Vehicle Finance Records
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate(`/dashboard/fleet/vehicles/${record.vehicleId}`)} className="btn-secondary text-xs">
            Open Vehicle Profile
          </button>
          <button type="button" onClick={() => navigate('/dashboard/settings/finance-updates')} className="btn-accent text-xs">
            Edit / Restructure in Settings
          </button>
        </div>
      </div>

      <PageHeader
        title={`${record.vehicleRegistration} · ${record.loanReferenceNumber}`}
        subtitle={`${record.vehicleMakeModel} · ${record.bankName} · ${loanTypeLabel(record.loanType, record.customLoanTypeLabel)}`}
      >
        <FinanceStatusBadge status={record.financeStatus} />
      </PageHeader>

      {maskedForRole && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#EEE8F7] border border-[#DDD3ED] text-xs text-[#625346]">
          <Lock className="w-4 h-4 text-[#6E5696] shrink-0" />
          <span>Sensitive loan account numbers and banker contact info are masked for your role.</span>
        </div>
      )}

      {/* Loan Repayment Progress + 7 Core Metrics */}
      <div className="enterprise-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="dm-card-title text-sm">Loan Repayment Progress</h2>
            <p className="text-xs text-[#958777]">
              {loanEmis.filter((i) => i.status === 'paid').length} of {record.numberOfInstalments} instalments paid
            </p>
          </div>
          <span className="text-sm font-bold text-[#6E5696] tabular-nums">{progressPct}% Principal Repaid</span>
        </div>
        <div className="w-full h-3 rounded-full bg-[#EEE8F7] overflow-hidden">
          <div className="h-full bg-[#6E5696] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-2 text-xs">
          <div>
            <span className="text-[#958777]">Original Principal</span>
            <p className="font-bold text-sm text-[#625346] tabular-nums mt-0.5">{formatInr(record.netFinancedAmount)}</p>
          </div>
          <div>
            <span className="text-[#958777]">Principal Repaid</span>
            <p className="font-bold text-sm text-[#4D6E4A] tabular-nums mt-0.5">{formatInr(record.principalRepaid)}</p>
          </div>
          <div>
            <span className="text-[#958777]">Outstanding Principal</span>
            <p className="font-bold text-sm text-[#6E5696] tabular-nums mt-0.5">{formatInr(record.outstandingPrincipal)}</p>
          </div>
          <div>
            <span className="text-[#958777]">Interest Paid</span>
            <p className="font-bold text-sm text-[#625346] tabular-nums mt-0.5">{formatInr(record.interestPaid)}</p>
          </div>
          <div>
            <span className="text-[#958777]">Remaining Instalments</span>
            <p className="font-bold text-sm text-[#625346] tabular-nums mt-0.5">{record.remainingInstalments}</p>
          </div>
          <div>
            <span className="text-[#958777]">Next Due Date</span>
            <p className="font-bold text-sm text-[#625346] tabular-nums mt-0.5">{record.nextDueDate ? formatShortDate(record.nextDueDate) : '—'}</p>
          </div>
          <div>
            <span className="text-[#958777]">Loan Completion Date</span>
            <p className="font-bold text-sm text-[#625346] tabular-nums mt-0.5">{record.loanCompletionDate ? formatShortDate(record.loanCompletionDate) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Independent Tabs */}
      <div className="border-b border-[#E5E5E5] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max" role="tablist">
          {DETAILS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? 'border-[#6E5696] text-[#625346]' : 'border-transparent text-[#958777] hover:text-[#625346]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="enterprise-card p-5 space-y-2.5">
            <h3 className="dm-card-title text-sm">Vehicle & Ownership Summary</h3>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-[#958777]">Registration</dt><dd className="font-semibold">{record.vehicleRegistration}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Make & Model</dt><dd>{record.vehicleMakeModel}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Ownership</dt><dd>{record.vehicleOwnership}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Asset Cost / Principal</dt><dd className="tabular-nums font-semibold">{formatInr(record.principalAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Down Payment</dt><dd className="tabular-nums">{formatInr(record.downPayment)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Total Paid to Date</dt><dd className="tabular-nums font-semibold text-[#4D6E4A]">{formatInr(record.totalAmountPaid)}</dd></div>
            </dl>
          </div>
          <div className="enterprise-card p-5 space-y-2.5">
            <h3 className="dm-card-title text-sm">Facility Snapshot</h3>
            <dl className="space-y-2">
              <div className="flex justify-between"><dt className="text-[#958777]">Financing Bank</dt><dd className="font-semibold">{record.bankName}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Loan Account Number</dt><dd className="font-mono">{record.loanAccountNumber}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">EMI Amount</dt><dd className="tabular-nums font-bold">{formatInr(record.emiAmount)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Interest Model</dt><dd>{record.interestRateAnnualPct}% p.a. · {interestTypeLabel(record.interestType)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Payment Mode</dt><dd>{paymentMethodLabel(record.paymentMethod)}</dd></div>
              <div className="flex justify-between"><dt className="text-[#958777]">Notes</dt><dd className="text-right max-w-xs text-[#958777]">{record.notes || '—'}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {tab === 'Loan Details' && (
        <div className="enterprise-card p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {[
            ['Loan Reference Number', record.loanReferenceNumber],
            ['Loan Account Number', record.loanAccountNumber],
            ['Loan Type', loanTypeLabel(record.loanType, record.customLoanTypeLabel)],
            ['Gross Principal', formatInr(record.principalAmount)],
            ['Down Payment', formatInr(record.downPayment)],
            ['Net Financed Principal', formatInr(record.netFinancedAmount)],
            ['Interest Rate', `${record.interestRateAnnualPct}% p.a.`],
            ['Interest Calculation Method', interestTypeLabel(record.interestType)],
            ['Loan Start Date', formatShortDate(record.loanStartDate)],
            ['Tenure / Instalments', `${record.loanTenureMonths} months / ${record.numberOfInstalments} EMIs`],
            ['First EMI Date', formatShortDate(record.firstEmiDate)],
            ['Final EMI Date', formatShortDate(record.finalEmiDate)],
            ['Processing Fees', formatInr(record.processingFees)],
            ['Other Charges', formatInr(record.otherCharges)],
            ['Default Payment Method', paymentMethodLabel(record.paymentMethod)],
          ].map(([k, v]) => (
            <div key={k} className="p-3.5 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
              <span className="text-[#958777] block">{k}</span>
              <span className="font-bold text-[#625346] tabular-nums mt-0.5 block">{v}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'EMI Schedule' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>EMI #</th>
                  <th>Due Date</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>EMI Amount</th>
                  <th>Late Fee</th>
                  <th>Paid</th>
                  <th>Remaining</th>
                  <th>Payment Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loanEmis.map((emi) => (
                  <tr key={emi.id}>
                    <td className="font-bold tabular-nums">#{emi.emiNumber}</td>
                    <td className="tabular-nums text-xs">{formatShortDate(emi.dueDate)}</td>
                    <td className="tabular-nums">{formatInr(emi.principalComponent)}</td>
                    <td className="tabular-nums">{formatInr(emi.interestComponent)}</td>
                    <td className="tabular-nums font-semibold">{formatInr(emi.emiAmount)}</td>
                    <td className="tabular-nums">{emi.lateFeeInr > 0 ? formatInr(emi.lateFeeInr) : '—'}</td>
                    <td className="tabular-nums text-[#4D6E4A]">{formatInr(emi.amountPaid)}</td>
                    <td className="tabular-nums font-semibold">{formatInr(emi.remainingAmount)}</td>
                    <td className="tabular-nums text-xs">{emi.paymentDate ? formatShortDate(emi.paymentDate) : '—'}</td>
                    <td><EmiStatusBadge status={emi.status} /></td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button type="button" onClick={() => setDetailEmi(emi)} className="btn-secondary text-[11px] px-2.5 py-1">
                          Details
                        </button>
                        {canPay && emi.status !== 'paid' && emi.status !== 'waived' && emi.status !== 'cancelled' && (
                          <button type="button" onClick={() => setPayEmi(emi)} className="btn-primary text-[11px] px-2.5 py-1">
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Payment History' && (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>EMI #</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Transaction Ref</th>
                  <th>Recorded By</th>
                  <th>Reconciliation</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loanPayments.map((p) => (
                  <tr key={p.id} className={p.isCorrected ? 'opacity-60' : ''}>
                    <td className="tabular-nums text-xs">{formatShortDate(p.paymentDate)}</td>
                    <td className="tabular-nums font-semibold">#{p.emiNumber}</td>
                    <td className="tabular-nums font-bold">{formatInr(p.amountInr)}</td>
                    <td>{paymentMethodLabel(p.paymentMethod)}</td>
                    <td className="font-mono text-xs">{p.bankTransactionRef}</td>
                    <td className="text-xs text-[#958777]">{p.recordedBy}</td>
                    <td><ReconciliationBadge status={p.reconciliationStatus} /></td>
                    <td className="text-right">
                      {canRecon && p.reconciliationStatus !== 'reconciled' && !p.isCorrected && (
                        <button
                          type="button"
                          onClick={async () => {
                            await reconcilePayment(p.id, 'reconciled', 'Reconciled from Vehicle Finance Details')
                            toast.success('Payment marked reconciled')
                          }}
                          className="btn-primary text-[11px] px-2.5 py-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Reconcile
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {loanPayments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-xs text-[#958777] py-6">No payments recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Bank Details' && (
        <div className="enterprise-card p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {[
            ['Bank Name', record.bankName],
            ['Financial Institution', record.institutionName],
            ['Branch', record.branch],
            ['Relationship Manager', record.relationshipManager],
            ['Contact Number', record.contactNumber],
            ['Email', record.email],
            ['IFSC Code', record.ifscCode || '—'],
            ['Loan Account Reference', record.loanAccountNumber],
            ['Default Payment Method', paymentMethodLabel(record.paymentMethod)],
          ].map(([k, v]) => (
            <div key={k} className="p-3.5 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
              <span className="text-[#958777] block">{k}</span>
              <span className="font-bold text-[#625346] mt-0.5 block">{v}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'Documents' && (
        <div className="enterprise-card p-6 space-y-5">
          {canAddDoc && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-4 text-xs">
              <div>
                <label htmlFor="vfd-cat" className="dm-label">Document Category</label>
                <select id="vfd-cat" value={docCategory} onChange={(e) => setDocCategory(e.target.value as FinanceDocCategory)} className="dm-input text-xs">
                  {DOC_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="vfd-title" className="dm-label">Document Title</label>
                <input id="vfd-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Q2 Bank Statement" className="dm-input text-xs" />
              </div>
              <label className="btn-primary text-xs cursor-pointer justify-center">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Upload Finance Document'}
                <input type="file" accept=".pdf,image/*" disabled={uploading} onChange={handleUpload} className="hidden" />
              </label>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Category</th>
                  <th>Version</th>
                  <th>Verification</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loanDocs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <p className="font-semibold text-[#625346]">{d.title}</p>
                      <p className="text-[11px] text-[#958777]">{d.fileName}</p>
                    </td>
                    <td className="text-xs">{docCategoryLabel(d.category)}</td>
                    <td className="tabular-nums text-xs">v{d.version}</td>
                    <td className="text-xs capitalize">{d.verificationStatus.replace(/_/g, ' ')}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <a href={`/api/finance/documents/${d.id}/download`} target="_blank" rel="noreferrer" className="btn-secondary text-[11px] px-2.5 py-1">
                          <Download className="w-3 h-3" />
                          Download
                        </a>
                        {canRecon && d.verificationStatus !== 'verified' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await verifyFinanceDocument(d.id, 'verified')
                              toast.success(`Verified ${d.title}`)
                            }}
                            className="btn-primary text-[11px] px-2.5 py-1"
                          >
                            <FileCheck2 className="w-3 h-3" />
                            Verify
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {loanDocs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-xs text-[#958777] py-6">No finance documents uploaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Activity History' && (
        <div className="enterprise-card p-5 space-y-3">
          <h3 className="dm-card-title text-sm">Finance Update & Audit History</h3>
          {loanHistory.length === 0 ? (
            <p className="text-xs text-[#958777] py-4">No audit updates recorded for this loan yet.</p>
          ) : (
            <div className="divide-y divide-[#E5E5E5] text-xs">
              {loanHistory.map((h) => (
                <div key={h.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#625346]">{h.fieldName}</p>
                    <p className="text-[#958777] mt-0.5">
                      {h.previousValue} → <span className="text-[#625346] font-semibold">{h.updatedValue}</span>
                    </p>
                    <p className="text-[11px] text-[#958777] mt-0.5">Reason: {h.updateReason}</p>
                  </div>
                  <div className="text-right text-[11px] text-[#958777]">
                    <p className="font-semibold text-[#625346]">{h.updatedBy}</p>
                    <p>{formatDateTime(h.updateDate, activeOrganization.timezone)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <RecordPaymentModal open={Boolean(payEmi)} onClose={() => setPayEmi(null)} instalment={payEmi} record={record} />
      <EmiDetailModal
        open={Boolean(detailEmi)}
        onClose={() => setDetailEmi(null)}
        instalment={detailEmi}
        record={record}
        onOpenRecordPayment={(emi) => setPayEmi(emi)}
      />
    </div>
  )
}
