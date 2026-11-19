import React, { useMemo, useState } from 'react'
import { Calendar as CalendarIcon, Download, List, Search } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { EmiInstalment, EmiPaymentStatus } from '../../types/finance'
import { EmiStatusBadge } from '../../components/finance/FinancePrimitives'
import { exportRowsToCsv, exportRowsToExcelHtml } from '../../utils/financeHelpers'
import RecordPaymentModal from '../../components/finance/RecordPaymentModal'
import EmiDetailModal from '../../components/finance/EmiDetailModal'

const STATUS_OPTIONS: Array<{ value: 'all' | EmiPaymentStatus; label: string }> = [
  { value: 'all', label: 'All Statuses' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'due_soon', label: 'Due Soon' },
  { value: 'due_today', label: 'Due Today' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'waived', label: 'Waived' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function EmiSchedulePage() {
  const { activeRole, activeOrganization } = useFleet()
  const { records, instalments, todayIso } = useFinance()

  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [calendarMonth, setCalendarMonth] = useState(todayIso.slice(0, 7))
  const [loanRefQuery, setLoanRefQuery] = useState('')
  const [vehicleFilter, setVehicleFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | EmiPaymentStatus>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [payEmi, setPayEmi] = useState<EmiInstalment | null>(null)
  const [detailEmi, setDetailEmi] = useState<EmiInstalment | null>(null)

  const canPay = canPerformAction(activeRole, 'record_finance_payments')
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])
  const banks = useMemo(() => Array.from(new Set(records.map((r) => r.bankName))).sort(), [records])
  const vehicleOptions = useMemo(
    () => Array.from(new Map(records.map((r) => [r.vehicleId, r.vehicleRegistration])).entries()),
    [records],
  )

  const filtered = useMemo(() => {
    const q = loanRefQuery.trim().toLowerCase()
    return instalments.filter((emi) => {
      const rec = recordById.get(emi.financeId)
      if (!rec) return false
      if (vehicleFilter !== 'all' && emi.vehicleId !== vehicleFilter) return false
      if (bankFilter !== 'all' && rec.bankName !== bankFilter) return false
      if (statusFilter !== 'all' && emi.status !== statusFilter) return false
      if (dateFrom && emi.dueDate < dateFrom) return false
      if (dateTo && emi.dueDate > dateTo) return false
      if (viewMode === 'calendar' && !emi.dueDate.startsWith(calendarMonth)) return false
      if (!q) return true
      return (
        rec.loanReferenceNumber.toLowerCase().includes(q) ||
        rec.vehicleRegistration.toLowerCase().includes(q) ||
        rec.bankName.toLowerCase().includes(q) ||
        String(emi.emiNumber) === q
      )
    })
  }, [instalments, recordById, vehicleFilter, bankFilter, statusFilter, dateFrom, dateTo, viewMode, calendarMonth, loanRefQuery])

  const buildExportRows = () =>
    filtered.map((emi) => {
      const rec = recordById.get(emi.financeId)
      return [
        `#${emi.emiNumber}`,
        rec?.vehicleRegistration ?? emi.vehicleId,
        rec?.loanReferenceNumber ?? '—',
        rec?.bankName ?? '—',
        emi.dueDate,
        emi.principalComponent,
        emi.interestComponent,
        emi.emiAmount,
        emi.amountPaid,
        emi.remainingAmount,
        emi.paymentDate ?? '—',
        emi.status,
      ]
    })

  const headers = [
    'EMI Number',
    'Vehicle',
    'Loan Reference',
    'Bank',
    'Due Date',
    'Principal Component',
    'Interest Component',
    'EMI Amount',
    'Amount Paid',
    'Remaining Amount',
    'Payment Date',
    'Payment Status',
  ]

  // Monthly calendar day grid
  const calendarDays = useMemo(() => {
    const [yStr, mStr] = calendarMonth.split('-')
    const year = Number(yStr)
    const month = Number(mStr)
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    const out: Array<{ iso: string; day: number; items: EmiInstalment[] }> = []
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${calendarMonth}-${String(d).padStart(2, '0')}`
      out.push({
        iso,
        day: d,
        items: filtered.filter((i) => i.dueDate === iso),
      })
    }
    return out
  }, [calendarMonth, filtered])

  return (
    <div className="space-y-6">
      <PageHeader
        title="EMI Schedule"
        subtitle={`${activeOrganization.name} · Amortisation instalments, principal/interest split & monthly calendar`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 ${
                viewMode === 'table' ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777]'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 ${
                viewMode === 'calendar' ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777]'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              Monthly Calendar
            </button>
          </div>
          <button
            type="button"
            onClick={() => exportRowsToCsv(`emi-schedule-${activeOrganization.code}`, headers, buildExportRows())}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => exportRowsToExcelHtml(`emi-schedule-${activeOrganization.code}`, 'DriveMitra EMI Schedule', headers, buildExportRows())}
            className="btn-secondary text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
        </div>
      </PageHeader>

      <div className="enterprise-card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 text-xs">
        <div className="relative lg:col-span-2">
          <Search className="w-3.5 h-3.5 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={loanRefQuery}
            onChange={(e) => setLoanRefQuery(e.target.value)}
            placeholder="Search loan reference, vehicle, bank..."
            aria-label="Search EMI schedule"
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
        <select aria-label="Filter by EMI status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | EmiPaymentStatus)} className="dm-input py-2 text-xs">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {viewMode === 'calendar' ? (
          <input aria-label="Calendar Month" type="month" value={calendarMonth} onChange={(e) => setCalendarMonth(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
        ) : (
          <div className="flex items-center gap-1.5">
            <input aria-label="Due Date From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
            <input aria-label="Due Date To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="dm-input py-2 text-xs tabular-nums" />
          </div>
        )}
      </div>

      {viewMode === 'calendar' ? (
        <div className="enterprise-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="dm-card-title text-sm">Monthly EMI Calendar · {calendarMonth}</h2>
            <span className="text-xs text-[#958777]">{filtered.length} EMI(s) scheduled</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {calendarDays.map((cell) => (
              <div key={cell.iso} className={`p-2.5 rounded-xl border min-h-[96px] ${cell.iso === todayIso ? 'border-[#6E5696] bg-[#EEE8F7]/40' : 'border-[#E5E5E5] bg-[#FAFAFA]'}`}>
                <div className="flex items-center justify-between text-[11px] font-bold text-[#625346] mb-1.5">
                  <span className="tabular-nums">{cell.day}</span>
                  {cell.iso === todayIso && <span className="text-[#6E5696]">Today</span>}
                </div>
                <div className="space-y-1">
                  {cell.items.map((emi) => {
                    const rec = recordById.get(emi.financeId)
                    return (
                      <button
                        key={emi.id}
                        type="button"
                        onClick={() => setDetailEmi(emi)}
                        className="w-full text-left p-1.5 rounded-lg bg-[#FFFFFF] border border-[#E5E5E5] hover:border-[#B8A3D9] text-[11px]"
                      >
                        <p className="font-bold text-[#625346] truncate">{rec?.vehicleRegistration}</p>
                        <p className="text-[#958777] tabular-nums">{formatInr(emi.emiAmount)} · #{emi.emiNumber}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptySectionState
          title="No EMI instalments match the current filters"
          description="Adjust date range, vehicle, bank, or status filters to view matching instalments."
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>EMI #</th>
                  <th>Vehicle</th>
                  <th>Loan Reference</th>
                  <th>Bank</th>
                  <th>Due Date</th>
                  <th>Principal Component</th>
                  <th>Interest Component</th>
                  <th>EMI Amount</th>
                  <th>Amount Paid</th>
                  <th>Remaining Amount</th>
                  <th>Payment Date</th>
                  <th>Payment Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emi) => {
                  const rec = recordById.get(emi.financeId)
                  return (
                    <tr key={emi.id}>
                      <td className="font-bold tabular-nums">#{emi.emiNumber}</td>
                      <td className="font-semibold whitespace-nowrap">{rec?.vehicleRegistration ?? emi.vehicleId}</td>
                      <td className="font-mono text-xs whitespace-nowrap">{rec?.loanReferenceNumber ?? '—'}</td>
                      <td className="whitespace-nowrap">{rec?.bankName ?? '—'}</td>
                      <td className="tabular-nums text-xs whitespace-nowrap">{formatShortDate(emi.dueDate)}</td>
                      <td className="tabular-nums">{formatInr(emi.principalComponent)}</td>
                      <td className="tabular-nums">{formatInr(emi.interestComponent)}</td>
                      <td className="tabular-nums font-semibold">{formatInr(emi.emiAmount)}</td>
                      <td className="tabular-nums text-[#4D6E4A]">{formatInr(emi.amountPaid)}</td>
                      <td className="tabular-nums font-semibold">{formatInr(emi.remainingAmount)}</td>
                      <td className="tabular-nums text-xs whitespace-nowrap">{emi.paymentDate ? formatShortDate(emi.paymentDate) : '—'}</td>
                      <td><EmiStatusBadge status={emi.status} /></td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button type="button" onClick={() => setDetailEmi(emi)} className="btn-secondary text-[11px] px-2.5 py-1">
                            View
                          </button>
                          {canPay && emi.status !== 'paid' && emi.status !== 'waived' && emi.status !== 'cancelled' && (
                            <button type="button" onClick={() => setPayEmi(emi)} className="btn-primary text-[11px] px-2.5 py-1">
                              Pay
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
      <EmiDetailModal
        open={Boolean(detailEmi)}
        onClose={() => setDetailEmi(null)}
        instalment={detailEmi}
        record={detailEmi ? recordById.get(detailEmi.financeId) ?? null : null}
        onOpenRecordPayment={(emi) => setPayEmi(emi)}
      />
    </div>
  )
}
