import React, { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import { formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import {
  exportRowsToCsv,
  exportRowsToExcelHtml,
  loanTypeLabel,
  paymentMethodLabel,
} from '../../utils/financeHelpers'

type FinanceReportId =
  | 'vehicle_loan_summary'
  | 'emi_payment_summary'
  | 'monthly_emi_expenditure'
  | 'outstanding_loan_report'
  | 'overdue_emi_report'
  | 'bank_wise_finance'
  | 'vehicle_wise_finance'
  | 'principal_repayment'
  | 'interest_expenditure'
  | 'loan_completion'

const REPORT_DEFS: Array<{ id: FinanceReportId; label: string; description: string }> = [
  { id: 'vehicle_loan_summary', label: '1. Vehicle Loan Summary', description: 'Complete register of financed vehicles, banks, principal, EMI, and loan status.' },
  { id: 'emi_payment_summary', label: '2. EMI Payment Summary', description: 'All recorded EMI payment transactions, payment methods, UTR references, and reconciliation.' },
  { id: 'monthly_emi_expenditure', label: '3. Monthly EMI Expenditure', description: 'Month-by-month scheduled versus paid EMI cashflow across the fleet.' },
  { id: 'outstanding_loan_report', label: '4. Outstanding Loan Report', description: 'Active facilities ranked by remaining principal balance and pending instalments.' },
  { id: 'overdue_emi_report', label: '5. Overdue EMI Report', description: 'All unpaid past-due instalments with remaining arrears and late fees.' },
  { id: 'bank_wise_finance', label: '6. Bank-wise Finance Report', description: 'Lending exposure, facility counts, monthly EMI commitment, and principal repaid per bank.' },
  { id: 'vehicle_wise_finance', label: '7. Vehicle-wise Finance Report', description: 'Per-vehicle total financed exposure, repaid principal, interest paid, and remaining EMIs.' },
  { id: 'principal_repayment', label: '8. Principal Repayment Report', description: 'Net financed principal vs. repaid vs. outstanding principal across all agreements.' },
  { id: 'interest_expenditure', label: '9. Interest Expenditure Report', description: 'Scheduled vs. paid interest burden per loan facility and interest model.' },
  { id: 'loan_completion', label: '10. Loan Completion Report', description: 'Completed, foreclosed, and nearing-completion loans with NOC readiness status.' },
]

export default function FinanceReportsPage() {
  const { activeOrganization } = useFleet()
  const { records, instalments, payments, documents, todayIso } = useFinance()

  const [reportId, setReportId] = useState<FinanceReportId>('vehicle_loan_summary')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const banks = useMemo(() => Array.from(new Set(records.map((r) => r.bankName))).sort(), [records])
  const vehicleOptions = useMemo(
    () => Array.from(new Map(records.map((r) => [r.vehicleId, r.vehicleRegistration])).entries()),
    [records],
  )

  const filteredRecords = useMemo(
    () =>
      records.filter((r) => {
        if (vehicleFilter !== 'all' && r.vehicleId !== vehicleFilter) return false
        if (bankFilter !== 'all' && r.bankName !== bankFilter) return false
        if (dateFrom && r.loanStartDate < dateFrom) return false
        if (dateTo && r.loanStartDate > dateTo) return false
        return true
      }),
    [records, vehicleFilter, bankFilter, dateFrom, dateTo],
  )

  const recordIds = useMemo(() => new Set(filteredRecords.map((r) => r.id)), [filteredRecords])
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])

  const filteredEmis = useMemo(
    () =>
      instalments.filter((i) => {
        if (!recordIds.has(i.financeId)) return false
        if (dateFrom && i.dueDate < dateFrom) return false
        if (dateTo && i.dueDate > dateTo) return false
        return true
      }),
    [instalments, recordIds, dateFrom, dateTo],
  )

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        if (p.isCorrected) return false
        if (!recordIds.has(p.financeId)) return false
        if (dateFrom && p.paymentDate < dateFrom) return false
        if (dateTo && p.paymentDate > dateTo) return false
        return true
      }),
    [payments, recordIds, dateFrom, dateTo],
  )

  const reportData = useMemo((): {
    headers: string[]
    rows: Array<Array<string | number>>
    kpis: Array<{ label: string; value: string }>
  } => {
    switch (reportId) {
      case 'vehicle_loan_summary':
        return {
          headers: ['Vehicle', 'Bank', 'Loan Ref', 'Type', 'Start Date', 'Original Loan', 'Outstanding', 'EMI', 'Status'],
          rows: filteredRecords.map((r) => [
            r.vehicleRegistration,
            r.bankName,
            r.loanReferenceNumber,
            loanTypeLabel(r.loanType, r.customLoanTypeLabel),
            r.loanStartDate,
            r.netFinancedAmount,
            r.outstandingPrincipal,
            r.emiAmount,
            r.financeStatus,
          ]),
          kpis: [
            { label: 'Agreements', value: String(filteredRecords.length) },
            { label: 'Net Financed', value: formatInr(filteredRecords.reduce((s, r) => s + r.netFinancedAmount, 0)) },
            { label: 'Outstanding', value: formatInr(filteredRecords.reduce((s, r) => s + r.outstandingPrincipal, 0)) },
          ],
        }
      case 'emi_payment_summary':
        return {
          headers: ['Payment Date', 'Vehicle', 'Loan Ref', 'EMI #', 'Amount (INR)', 'Late Fee (INR)', 'Method', 'Transaction Ref', 'Reconciliation'],
          rows: filteredPayments.map((p) => {
            const rec = recordById.get(p.financeId)
            return [
              p.paymentDate,
              rec?.vehicleRegistration ?? p.vehicleId,
              rec?.loanReferenceNumber ?? '—',
              `#${p.emiNumber}`,
              p.amountInr,
              p.lateFeeComponentInr,
              paymentMethodLabel(p.paymentMethod),
              p.bankTransactionRef,
              p.reconciliationStatus,
            ]
          }),
          kpis: [
            { label: 'Transactions', value: String(filteredPayments.length) },
            { label: 'Total Settled', value: formatInr(filteredPayments.reduce((s, p) => s + p.amountInr, 0)) },
            { label: 'Reconciled', value: String(filteredPayments.filter((p) => p.reconciliationStatus === 'reconciled').length) },
          ],
        }
      case 'monthly_emi_expenditure': {
        const monthMap = new Map<string, { scheduled: number; paid: number; count: number }>()
        for (const emi of filteredEmis) {
          const ym = emi.dueDate.slice(0, 7)
          const cur = monthMap.get(ym) ?? { scheduled: 0, paid: 0, count: 0 }
          cur.scheduled += emi.emiAmount
          cur.paid += emi.amountPaid
          cur.count += 1
          monthMap.set(ym, cur)
        }
        const rows = Array.from(monthMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([ym, v]) => [ym, v.count, Math.round(v.scheduled), Math.round(v.paid), Math.round(Math.max(0, v.scheduled - v.paid))])
        return {
          headers: ['Month (YYYY-MM)', 'Instalments', 'Scheduled EMI (INR)', 'Paid Amount (INR)', 'Unpaid Balance (INR)'],
          rows,
          kpis: [
            { label: 'Months Covered', value: String(rows.length) },
            { label: 'Total Scheduled', value: formatInr(filteredEmis.reduce((s, e) => s + e.emiAmount, 0)) },
            { label: 'Total Paid', value: formatInr(filteredEmis.reduce((s, e) => s + e.amountPaid, 0)) },
          ],
        }
      }
      case 'outstanding_loan_report': {
        const active = filteredRecords.filter((r) => r.outstandingPrincipal > 0).sort((a, b) => b.outstandingPrincipal - a.outstandingPrincipal)
        return {
          headers: ['Vehicle', 'Bank', 'Loan Ref', 'Net Financed', 'Principal Repaid', 'Outstanding Principal', 'Remaining EMIs', 'Next Due Date'],
          rows: active.map((r) => [
            r.vehicleRegistration,
            r.bankName,
            r.loanReferenceNumber,
            r.netFinancedAmount,
            r.principalRepaid,
            r.outstandingPrincipal,
            r.remainingInstalments,
            r.nextDueDate ?? '—',
          ]),
          kpis: [
            { label: 'Active Outstanding Loans', value: String(active.length) },
            { label: 'Outstanding Principal', value: formatInr(active.reduce((s, r) => s + r.outstandingPrincipal, 0)) },
          ],
        }
      }
      case 'overdue_emi_report': {
        const overdue = filteredEmis.filter((i) => i.status === 'overdue' || (i.dueDate < todayIso && i.remainingAmount > 0.01 && i.status !== 'waived' && i.status !== 'cancelled'))
        return {
          headers: ['Vehicle', 'Bank', 'Loan Ref', 'EMI #', 'Due Date', 'EMI Amount', 'Paid', 'Late Fee', 'Remaining Due'],
          rows: overdue.map((e) => {
            const rec = recordById.get(e.financeId)
            return [
              rec?.vehicleRegistration ?? e.vehicleId,
              rec?.bankName ?? '—',
              rec?.loanReferenceNumber ?? '—',
              `#${e.emiNumber}`,
              e.dueDate,
              e.emiAmount,
              e.amountPaid,
              e.lateFeeInr,
              e.remainingAmount,
            ]
          }),
          kpis: [
            { label: 'Overdue EMIs', value: String(overdue.length) },
            { label: 'Overdue Arrears', value: formatInr(overdue.reduce((s, e) => s + e.remainingAmount, 0)) },
          ],
        }
      }
      case 'bank_wise_finance': {
        const bankMap = new Map<string, { loans: number; active: number; net: number; outstanding: number; emi: number }>()
        for (const r of filteredRecords) {
          const cur = bankMap.get(r.bankName) ?? { loans: 0, active: 0, net: 0, outstanding: 0, emi: 0 }
          cur.loans += 1
          if (r.outstandingPrincipal > 0) {
            cur.active += 1
            cur.emi += r.emiAmount
          }
          cur.net += r.netFinancedAmount
          cur.outstanding += r.outstandingPrincipal
          bankMap.set(r.bankName, cur)
        }
        const rows = Array.from(bankMap.entries()).map(([b, v]) => [b, v.loans, v.active, Math.round(v.net), Math.round(v.outstanding), Math.round(v.emi)])
        return {
          headers: ['Bank / Financier', 'Total Loans', 'Active Loans', 'Total Net Financed (INR)', 'Outstanding Principal (INR)', 'Active Monthly EMI (INR)'],
          rows,
          kpis: [
            { label: 'Banks / Financiers', value: String(rows.length) },
            { label: 'Total Outstanding', value: formatInr(filteredRecords.reduce((s, r) => s + r.outstandingPrincipal, 0)) },
          ],
        }
      }
      case 'vehicle_wise_finance': {
        const vMap = new Map<string, { reg: string; loans: number; net: number; repaid: number; outstanding: number; interest: number }>()
        for (const r of filteredRecords) {
          const cur = vMap.get(r.vehicleId) ?? { reg: r.vehicleRegistration, loans: 0, net: 0, repaid: 0, outstanding: 0, interest: 0 }
          cur.loans += 1
          cur.net += r.netFinancedAmount
          cur.repaid += r.principalRepaid
          cur.outstanding += r.outstandingPrincipal
          cur.interest += r.interestPaid
          vMap.set(r.vehicleId, cur)
        }
        const rows = Array.from(vMap.values()).map((v) => [v.reg, v.loans, Math.round(v.net), Math.round(v.repaid), Math.round(v.outstanding), Math.round(v.interest)])
        return {
          headers: ['Vehicle Number', 'Agreements', 'Total Financed (INR)', 'Principal Repaid (INR)', 'Outstanding (INR)', 'Interest Paid (INR)'],
          rows,
          kpis: [
            { label: 'Vehicles', value: String(rows.length) },
            { label: 'Total Principal Repaid', value: formatInr(filteredRecords.reduce((s, r) => s + r.principalRepaid, 0)) },
          ],
        }
      }
      case 'principal_repayment':
        return {
          headers: ['Vehicle', 'Loan Ref', 'Bank', 'Gross Asset / Principal', 'Down Payment', 'Net Financed', 'Principal Repaid', 'Outstanding Principal', 'Repayment %'],
          rows: filteredRecords.map((r) => [
            r.vehicleRegistration,
            r.loanReferenceNumber,
            r.bankName,
            r.principalAmount,
            r.downPayment,
            r.netFinancedAmount,
            r.principalRepaid,
            r.outstandingPrincipal,
            r.netFinancedAmount > 0 ? `${Math.round((r.principalRepaid / r.netFinancedAmount) * 100)}%` : '0%',
          ]),
          kpis: [
            { label: 'Net Financed', value: formatInr(filteredRecords.reduce((s, r) => s + r.netFinancedAmount, 0)) },
            { label: 'Principal Repaid', value: formatInr(filteredRecords.reduce((s, r) => s + r.principalRepaid, 0)) },
            { label: 'Outstanding', value: formatInr(filteredRecords.reduce((s, r) => s + r.outstandingPrincipal, 0)) },
          ],
        }
      case 'interest_expenditure':
        return {
          headers: ['Vehicle', 'Loan Ref', 'Bank', 'Interest Rate %', 'Scheduled Interest (INR)', 'Interest Paid (INR)', 'Remaining Interest (INR)'],
          rows: filteredRecords.map((r) => {
            const schedInt = Math.round(instalments.filter((i) => i.financeId === r.id).reduce((s, i) => s + i.interestComponent, 0))
            return [
              r.vehicleRegistration,
              r.loanReferenceNumber,
              r.bankName,
              `${r.interestRateAnnualPct}%`,
              schedInt,
              r.interestPaid,
              Math.max(0, Math.round(schedInt - r.interestPaid)),
            ]
          }),
          kpis: [
            { label: 'Total Interest Paid', value: formatInr(filteredRecords.reduce((s, r) => s + r.interestPaid, 0)) },
          ],
        }
      case 'loan_completion': {
        const candidates = filteredRecords.filter(
          (r) => r.financeStatus === 'completed' || r.financeStatus === 'foreclosed' || (r.remainingInstalments > 0 && r.remainingInstalments <= 3),
        )
        return {
          headers: ['Vehicle', 'Loan Ref', 'Bank', 'Status', 'Remaining EMIs', 'Completion Date', 'NOC Uploaded'],
          rows: candidates.map((r) => {
            const hasNoc = documents.some((d) => d.financeId === r.id && (d.category === 'noc' || d.category === 'foreclosure_letter'))
            return [
              r.vehicleRegistration,
              r.loanReferenceNumber,
              r.bankName,
              r.financeStatus,
              r.remainingInstalments,
              r.loanCompletionDate ? formatShortDate(r.loanCompletionDate) : '—',
              hasNoc ? 'Yes' : 'Pending',
            ]
          }),
          kpis: [
            { label: 'Completed / Foreclosed', value: String(candidates.filter((r) => r.financeStatus === 'completed' || r.financeStatus === 'foreclosed').length) },
            { label: 'Nearing Completion', value: String(candidates.filter((r) => r.remainingInstalments > 0).length) },
          ],
        }
      }
    }
  }, [reportId, filteredRecords, filteredPayments, filteredEmis, instalments, documents, recordById, todayIso])

  const activeDef = REPORT_DEFS.find((d) => d.id === reportId) ?? REPORT_DEFS[0]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Reports"
        subtitle={`${activeOrganization.name} · 10 specialized vehicle finance, EMI, principal & interest reports`}
      >
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => exportRowsToCsv(`${reportId}-${activeOrganization.code}`, reportData.headers, reportData.rows)}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportRowsToExcelHtml(`${reportId}-${activeOrganization.code}`, activeDef.label, reportData.headers, reportData.rows)}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button type="button" onClick={() => window.print()} className="btn-primary text-xs">
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-3 enterprise-card p-3 space-y-1 print:hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#958777] px-2.5 py-1.5">
            Select Report (10)
          </p>
          {REPORT_DEFS.map((rep) => (
            <button
              key={rep.id}
              type="button"
              onClick={() => setReportId(rep.id)}
              className={`w-full text-left px-3 py-2 rounded-[10px] text-xs font-semibold transition-colors ${
                reportId === rep.id
                  ? 'bg-[#EEE8F7] text-[#625346] border border-[#B8A3D9]'
                  : 'text-[#625346] hover:bg-[#FAFAFA] border border-transparent'
              }`}
            >
              {rep.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="enterprise-card p-4 space-y-3 print:hidden">
            <div>
              <h2 className="dm-card-title text-sm">{activeDef.label}</h2>
              <p className="text-xs text-[#958777] mt-0.5">{activeDef.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
              <select aria-label="Filter report by vehicle" value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} className="dm-input py-2 text-xs">
                <option value="all">All Vehicles</option>
                {vehicleOptions.map(([id, reg]) => (
                  <option key={id} value={id}>{reg}</option>
                ))}
              </select>
              <select aria-label="Filter report by bank" value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="dm-input py-2 text-xs">
                <option value="all">All Banks</option>
                {banks.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <input aria-label="Report date from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
              <input aria-label="Report date to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {reportData.kpis.map((k) => (
              <div key={k.label} className="enterprise-card p-4">
                <span className="text-xs text-[#958777]">{k.label}</span>
                <p className="text-lg font-bold text-[#625346] tabular-nums mt-0.5">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="enterprise-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="dm-table [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:text-[11px]">
                <thead>
                  <tr>
                    {reportData.headers.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.rows.map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className={typeof cell === 'number' ? 'tabular-nums font-semibold' : ''}>
                          {typeof cell === 'number' && !String(reportData.headers[cIdx]).includes('Loans') && !String(reportData.headers[cIdx]).includes('Instalments') && !String(reportData.headers[cIdx]).includes('Agreements') && !String(reportData.headers[cIdx]).includes('EMIs')
                            ? formatInr(cell)
                            : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {reportData.rows.length === 0 && (
                    <tr>
                      <td colSpan={reportData.headers.length} className="text-center text-xs text-[#958777] py-8">
                        No records match the selected report filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
