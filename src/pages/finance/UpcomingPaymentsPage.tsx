import React, { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import { diffDaysIso } from '../../utils/financeEngine'
import type { EmiInstalment } from '../../types/finance'
import { EmiStatusBadge } from '../../components/finance/FinancePrimitives'
import RecordPaymentModal from '../../components/finance/RecordPaymentModal'

type WindowTab = '7d' | '15d' | '30d' | 'month' | 'custom'

export default function UpcomingPaymentsPage() {
  const [searchParams] = useSearchParams()
  const { activeRole, activeOrganization } = useFleet()
  const { records, instalments, todayIso } = useFinance()

  const [tab, setTab] = useState<WindowTab>((searchParams.get('view') as WindowTab) || '30d')
  const [customFrom, setCustomFrom] = useState(todayIso)
  const [customTo, setCustomTo] = useState('')
  const [payEmi, setPayEmi] = useState<EmiInstalment | null>(null)

  const canPay = canPerformAction(activeRole, 'record_finance_payments')
  const recordById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records])
  const currentMonth = todayIso.slice(0, 7)

  const items = useMemo(() => {
    return instalments
      .filter((emi) => {
        if (emi.status === 'paid' || emi.status === 'waived' || emi.status === 'cancelled') return false
        const diff = diffDaysIso(emi.dueDate, todayIso)
        if (tab === '7d') return diff >= 0 && diff <= 7
        if (tab === '15d') return diff >= 0 && diff <= 15
        if (tab === '30d') return diff >= 0 && diff <= 30
        if (tab === 'month') return emi.dueDate.startsWith(currentMonth) && diff >= 0
        if (tab === 'custom') {
          if (customFrom && emi.dueDate < customFrom) return false
          if (customTo && emi.dueDate > customTo) return false
          return true
        }
        return false
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [instalments, todayIso, tab, currentMonth, customFrom, customTo])

  const totalDueInView = items.reduce((s, i) => s + i.remainingAmount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Upcoming Payments"
        subtitle={`${activeOrganization.name} · Scheduled EMI due windows & liquidity forecast`}
      >
        <div className="px-3.5 py-2 rounded-xl bg-[#EEE8F7] border border-[#DDD3ED] text-xs font-bold text-[#625346] tabular-nums">
          {items.length} Upcoming · {formatInr(totalDueInView)}
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="p-1.5 flex flex-wrap items-center gap-1 bg-[#EEE8F7] border border-[#DDD3ED] rounded-[10px]">
          {([
            ['7d', 'Due within 7 days'],
            ['15d', 'Due within 15 days'],
            ['30d', 'Due within 30 days'],
            ['month', 'Due this month'],
            ['custom', 'Custom Date Range'],
          ] as Array<[WindowTab, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === key ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="up-from" className="text-[#958777]">From</label>
            <input id="up-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="dm-input py-1.5 text-xs w-auto tabular-nums" />
            <label htmlFor="up-to" className="text-[#958777]">To</label>
            <input id="up-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="dm-input py-1.5 text-xs w-auto tabular-nums" />
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <EmptySectionState
          title="No upcoming EMI payments in this window"
          description="Select a wider window or custom date range to review future instalments."
        />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Days Remaining</th>
                  <th>Vehicle</th>
                  <th>Bank & Loan Ref</th>
                  <th>EMI #</th>
                  <th>EMI Amount</th>
                  <th>Remaining Due</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((emi) => {
                  const rec = recordById.get(emi.financeId)
                  const daysRem = diffDaysIso(emi.dueDate, todayIso)
                  return (
                    <tr key={emi.id}>
                      <td className="tabular-nums font-semibold whitespace-nowrap">{formatShortDate(emi.dueDate)}</td>
                      <td className="tabular-nums text-xs">
                        {daysRem === 0 ? <strong className="text-[#8E6F19]">Due Today</strong> : daysRem < 0 ? `${Math.abs(daysRem)}d overdue` : `${daysRem} days`}
                      </td>
                      <td className="font-semibold whitespace-nowrap">{rec?.vehicleRegistration ?? emi.vehicleId}</td>
                      <td>
                        <p className="font-medium text-[#625346]">{rec?.bankName}</p>
                        <p className="text-[11px] font-mono text-[#958777]">{rec?.loanReferenceNumber} · {rec?.loanAccountMasked}</p>
                      </td>
                      <td className="tabular-nums">#{emi.emiNumber}</td>
                      <td className="tabular-nums">{formatInr(emi.emiAmount)}</td>
                      <td className="tabular-nums font-bold">{formatInr(emi.remainingAmount)}</td>
                      <td><EmiStatusBadge status={emi.status} /></td>
                      <td className="text-right">
                        {canPay && (
                          <button type="button" onClick={() => setPayEmi(emi)} className="btn-primary text-[11px] px-3 py-1">
                            Record Payment
                          </button>
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

      <RecordPaymentModal
        open={Boolean(payEmi)}
        onClose={() => setPayEmi(null)}
        instalment={payEmi}
        record={payEmi ? recordById.get(payEmi.financeId) ?? null : null}
      />
    </div>
  )
}
