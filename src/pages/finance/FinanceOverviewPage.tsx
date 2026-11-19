import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertOctagon,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Landmark,
  Plus,
  TrendingDown,
  Truck,
  Wallet,
} from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import { formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import { diffDaysIso } from '../../utils/financeEngine'
import AddVehicleFinanceModal from '../../components/finance/AddVehicleFinanceModal'
import { EmiStatusBadge, FinanceStatusBadge } from '../../components/finance/FinancePrimitives'

const CHART_COLORS = ['#6E5696', '#E8C65A', '#789A75', '#D9786C', '#958777', '#B8A3D9']

export default function FinanceOverviewPage() {
  const navigate = useNavigate()
  const { activeRole, activeOrganization } = useFleet()
  const { records, instalments, payments, todayIso, loading } = useFinance()
  const [addOpen, setAddOpen] = useState(false)

  const canAdd = canPerformAction(activeRole, 'add_finance_records')
  const currentMonth = todayIso.slice(0, 7)

  const kpis = useMemo(() => {
    const activeLoans = records.filter((r) => r.financeStatus !== 'cancelled')
    const financedVehicleCount = new Set(activeLoans.filter((r) => r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed').map((r) => r.vehicleId)).size
    const totalLoanAmount = activeLoans.reduce((s, r) => s + r.netFinancedAmount, 0)
    const totalOutstanding = activeLoans.reduce((s, r) => s + r.outstandingPrincipal, 0)
    const totalEmiAmount = activeLoans
      .filter((r) => r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed')
      .reduce((s, r) => s + r.emiAmount, 0)
    const emisThisMonth = instalments.filter(
      (i) => i.dueDate.startsWith(currentMonth) && i.status !== 'cancelled' && i.status !== 'waived',
    )
    const upcoming30 = instalments.filter((i) => {
      if (i.status === 'paid' || i.status === 'waived' || i.status === 'cancelled') return false
      const d = diffDaysIso(i.dueDate, todayIso)
      return d >= 0 && d <= 30
    })
    const overdueEmis = instalments.filter(
      (i) => i.status !== 'paid' && i.status !== 'waived' && i.status !== 'cancelled' && diffDaysIso(i.dueDate, todayIso) < 0 && i.remainingAmount > 0.01,
    )
    const completedLoans = records.filter((r) => r.financeStatus === 'completed' || r.financeStatus === 'foreclosed')

    const totalPaid = records.reduce((s, r) => s + r.totalAmountPaid, 0)
    const principalRepaid = records.reduce((s, r) => s + r.principalRepaid, 0)
    const interestPaid = records.reduce((s, r) => s + r.interestPaid, 0)
    const monthlyExpenditure = emisThisMonth.reduce((s, i) => s + i.amountPaid, 0) || totalEmiAmount
    const repaymentPct = totalLoanAmount > 0 ? Math.min(100, Math.round((principalRepaid / totalLoanAmount) * 100)) : 0

    return {
      financedVehicleCount,
      totalLoanAmount,
      totalOutstanding,
      totalEmiAmount,
      emisThisMonthCount: emisThisMonth.length,
      emisThisMonthAmt: emisThisMonth.reduce((s, i) => s + i.emiAmount, 0),
      upcomingCount: upcoming30.length,
      upcomingAmt: upcoming30.reduce((s, i) => s + i.remainingAmount, 0),
      overdueCount: overdueEmis.length,
      overdueAmt: overdueEmis.reduce((s, i) => s + i.remainingAmount, 0),
      completedCount: completedLoans.length,
      totalPaid,
      principalRepaid,
      interestPaid,
      monthlyExpenditure,
      repaymentPct,
      overdueEmis,
    }
  }, [records, instalments, currentMonth, todayIso])

  // Chart 1 & 2 & 3: Monthly series (last 6 months + next 3 months)
  const monthlySeries = useMemo(() => {
    const map = new Map<string, { month: string; emiDue: number; paid: number; principal: number; interest: number }>()
    for (const i of instalments) {
      if (i.status === 'cancelled' || i.status === 'waived') continue
      const ym = i.dueDate.slice(0, 7)
      const prev = map.get(ym) ?? { month: ym, emiDue: 0, paid: 0, principal: 0, interest: 0 }
      prev.emiDue += Math.round(i.emiAmount)
      prev.paid += Math.round(i.amountPaid)
      if (i.status === 'paid' || i.status === 'partially_paid') {
        const ratio = i.emiAmount > 0 ? Math.min(1, i.amountPaid / i.emiAmount) : 0
        prev.principal += Math.round(i.principalComponent * ratio)
        prev.interest += Math.round(i.interestComponent * ratio)
      }
      map.set(ym, prev)
    }
    const sorted = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month))
    // Keep window around current month
    const curIdx = sorted.findIndex((m) => m.month >= currentMonth)
    const start = Math.max(0, (curIdx === -1 ? sorted.length - 6 : curIdx - 4))
    const slice = sorted.slice(start, start + 8)
    const initialBalance = records.reduce((s, r) => s + r.netFinancedAmount, 0)
    return slice.reduce<Array<{ month: string; emiDue: number; paid: number; principal: number; interest: number; outstanding: number }>>(
      (acc, row) => {
        const prevBalance = acc.length > 0 ? acc[acc.length - 1].outstanding : initialBalance
        const nextBalance = Math.max(0, prevBalance - row.principal)
        acc.push({ ...row, outstanding: Math.round(nextBalance) })
        return acc
      },
      [],
    )
  }, [instalments, currentMonth, records])

  // Chart 4: Loan repayment progress per loan
  const loanProgressSeries = useMemo(
    () =>
      records
        .filter((r) => r.financeStatus !== 'cancelled')
        .slice(0, 8)
        .map((r) => ({
          financeId: r.id,
          name: r.vehicleRegistration,
          repaidPct: r.netFinancedAmount > 0 ? Math.round((r.principalRepaid / r.netFinancedAmount) * 100) : 0,
          outstanding: Math.round(r.outstandingPrincipal),
        })),
    [records],
  )

  // Chart 5: Finance distribution by vehicle
  const vehicleDistribution = useMemo(() => {
    const byVehicle = new Map<string, { vehicleId: string; name: string; financed: number; outstanding: number; emi: number; count: number }>()
    for (const r of records) {
      if (r.financeStatus === 'cancelled') continue
      const prev = byVehicle.get(r.vehicleId) ?? {
        vehicleId: r.vehicleId,
        name: r.vehicleRegistration,
        financed: 0,
        outstanding: 0,
        emi: 0,
        count: 0,
      }
      prev.financed += Math.round(r.netFinancedAmount)
      prev.outstanding += Math.round(r.outstandingPrincipal)
      if (r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed') {
        prev.emi += Math.round(r.emiAmount)
      }
      prev.count += 1
      byVehicle.set(r.vehicleId, prev)
    }
    return Array.from(byVehicle.values())
  }, [records])

  const bankBreakdown = useMemo(() => {
    const byBank = new Map<string, { bankName: string; loans: number; financed: number; outstanding: number; emi: number }>()
    for (const r of records) {
      if (r.financeStatus === 'cancelled') continue
      const prev = byBank.get(r.bankName) ?? { bankName: r.bankName, loans: 0, financed: 0, outstanding: 0, emi: 0 }
      prev.loans += 1
      prev.financed += r.netFinancedAmount
      prev.outstanding += r.outstandingPrincipal
      if (r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed') prev.emi += r.emiAmount
      byBank.set(r.bankName, prev)
    }
    return Array.from(byBank.values())
  }, [records])

  const calendarItems = useMemo(
    () =>
      instalments
        .filter((i) => i.dueDate.startsWith(currentMonth) && i.status !== 'cancelled')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [instalments, currentMonth],
  )

  const summaryCards = [
    { label: 'Total Financed Vehicles', value: kpis.financedVehicleCount, sub: `${records.length} total agreements`, icon: Truck, route: '/dashboard/finance/vehicles', tone: 'text-[#6E5696] bg-[#EEE8F7]' },
    { label: 'Total Loan Amount', value: formatInr(kpis.totalLoanAmount), sub: 'Net financed principal', icon: Landmark, route: '/dashboard/finance/vehicles', tone: 'text-[#625346] bg-[#FAFAFA]' },
    { label: 'Total Outstanding Principal', value: formatInr(kpis.totalOutstanding), sub: `${100 - kpis.repaymentPct}% remaining`, icon: TrendingDown, route: '/dashboard/finance/reports?report=outstanding_loan', tone: 'text-[#6E5696] bg-[#EEE8F7]' },
    { label: 'Total Monthly EMI', value: formatInr(kpis.totalEmiAmount), sub: 'Active commitments', icon: Wallet, route: '/dashboard/finance/emis', tone: 'text-[#8E6F19] bg-[#FCF5DE]' },
    { label: 'EMIs Due This Month', value: `${kpis.emisThisMonthCount} · ${formatInr(kpis.emisThisMonthAmt)}`, sub: currentMonth, icon: Calendar, route: '/dashboard/finance/upcoming?view=month', tone: 'text-[#625346] bg-[#FAFAFA]' },
    { label: 'Upcoming Payments (30d)', value: `${kpis.upcomingCount} · ${formatInr(kpis.upcomingAmt)}`, sub: 'Next 30 days', icon: CreditCard, route: '/dashboard/finance/upcoming', tone: 'text-[#6E5696] bg-[#EEE8F7]' },
    { label: 'Overdue EMIs', value: `${kpis.overdueCount} · ${formatInr(kpis.overdueAmt)}`, sub: kpis.overdueCount > 0 ? 'Action required' : 'All current', icon: AlertOctagon, route: '/dashboard/finance/overdue', tone: kpis.overdueCount > 0 ? 'text-[#B84E42] bg-[#FCECEB]' : 'text-[#4D6E4A] bg-[#EDF4EC]' },
    { label: 'Completed / Closed Loans', value: kpis.completedCount, sub: 'Paid or foreclosed', icon: CheckCircle2, route: '/dashboard/finance/vehicles?status=completed', tone: 'text-[#4D6E4A] bg-[#EDF4EC]' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Overview"
        subtitle={`${activeOrganization.name} · Vehicle loans, EMI obligations, principal repayment & financier exposure`}
      >
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/dashboard/finance/reports')} className="btn-secondary text-xs">
            Finance Reports
          </button>
          {canAdd && (
            <button type="button" onClick={() => setAddOpen(true)} className="btn-primary text-xs">
              <Plus className="w-4 h-4" />
              Add Vehicle Finance
            </button>
          )}
        </div>
      </PageHeader>

      {loading && records.length === 0 ? (
        <div className="enterprise-card p-8 text-center text-xs text-[#958777]">Loading vehicle finance portfolio...</div>
      ) : (
        <>
          {/* 8 Clickable Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((c) => {
              const Icon = c.icon
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => navigate(c.route)}
                  className="enterprise-card p-4 text-left hover:border-[#B8A3D9] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-[#958777]">{c.label}</span>
                    <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${c.tone}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="text-lg font-bold text-[#625346] tabular-nums mt-2 flex items-center justify-between gap-2">
                    <span className="truncate">{c.value}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#958777] group-hover:text-[#6E5696] shrink-0" />
                  </p>
                  <p className="text-[11px] text-[#958777] mt-1">{c.sub}</p>
                </button>
              )
            })}
          </div>

          {/* Financial Overview Strip */}
          <div className="enterprise-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-center">
            <div>
              <span className="text-xs text-[#958777]">Monthly EMI Expenditure (This Month)</span>
              <p className="text-xl font-bold text-[#625346] tabular-nums mt-0.5">{formatInr(kpis.monthlyExpenditure)}</p>
            </div>
            <div>
              <span className="text-xs text-[#958777]">Total Amount Paid (Principal + Interest)</span>
              <p className="text-xl font-bold text-[#4D6E4A] tabular-nums mt-0.5">{formatInr(kpis.totalPaid)}</p>
              <p className="text-[11px] text-[#958777] tabular-nums">
                Principal {formatInr(kpis.principalRepaid)} · Interest {formatInr(kpis.interestPaid)}
              </p>
            </div>
            <div>
              <span className="text-xs text-[#958777]">Remaining Loan Balance</span>
              <p className="text-xl font-bold text-[#625346] tabular-nums mt-0.5">{formatInr(kpis.totalOutstanding)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-[#625346]">Loan Repayment Progress</span>
                <span className="font-bold text-[#6E5696] tabular-nums">{kpis.repaymentPct}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[#EEE8F7] overflow-hidden">
                <div className="h-full bg-[#6E5696] rounded-full transition-all" style={{ width: `${kpis.repaymentPct}%` }} />
              </div>
              <p className="text-[11px] text-[#958777] mt-1">{payments.filter((p) => !p.isCorrected).length} payment transactions logged</p>
            </div>
          </div>

          {/* Charts Row 1: Monthly EMI Expenditure & Principal vs Interest */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="dm-card-title text-sm">Monthly EMI Expenditure</h2>
                  <p className="text-xs text-[#958777]">Scheduled EMI vs recorded payments (click bar to inspect schedule)</p>
                </div>
                <button type="button" onClick={() => navigate('/dashboard/finance/emis')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Open EMI Schedule
                </button>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries} onClick={() => navigate('/dashboard/finance/emis')}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#958777' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#958777' }} tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} />
                    <Tooltip formatter={(val) => formatInr(Number(val))} />
                    <Bar dataKey="emiDue" name="Scheduled EMI" fill="#B8A3D9" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="paid" name="Amount Paid" fill="#6E5696" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="dm-card-title text-sm">Principal vs Interest Paid</h2>
                  <p className="text-xs text-[#958777]">Monthly amortisation split across settled instalments</p>
                </div>
                <button type="button" onClick={() => navigate('/dashboard/finance/payments')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Payment History
                </button>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries} onClick={() => navigate('/dashboard/finance/payments')}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#958777' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#958777' }} tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} />
                    <Tooltip formatter={(val) => formatInr(Number(val))} />
                    <Bar dataKey="principal" name="Principal Paid" stackId="a" fill="#789A75" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="interest" name="Interest Paid" stackId="a" fill="#E8C65A" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: Outstanding Balance, Loan Repayment Progress, Vehicle Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="dm-card-title text-sm">Outstanding Loan Balance</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/reports')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Report
                </button>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlySeries} onClick={() => navigate('/dashboard/finance/vehicles')}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#958777' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#958777' }} tickFormatter={(v) => `₹${Math.round(Number(v) / 100000)}L`} />
                    <Tooltip formatter={(val) => formatInr(Number(val))} />
                    <Area type="monotone" dataKey="outstanding" name="Outstanding Principal" stroke="#6E5696" fill="#EEE8F7" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="dm-card-title text-sm">Loan Repayment Progress (%)</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  All Loans
                </button>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={loanProgressSeries}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#958777' }} />
                    <YAxis type="category" dataKey="name" width={95} tick={{ fontSize: 11, fill: '#625346' }} />
                    <Tooltip formatter={(val) => `${val}% repaid`} />
                    <Bar
                      dataKey="repaidPct"
                      name="Repaid %"
                      fill="#6E5696"
                      radius={[0, 4, 4, 0]}
                      onClick={(entry) => {
                        const row = entry as unknown as { financeId?: string }
                        if (row?.financeId) navigate(`/dashboard/finance/vehicles/${row.financeId}`)
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="dm-card-title text-sm">Finance Distribution by Vehicle</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Breakdown
                </button>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={vehicleDistribution}
                      dataKey="financed"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={78}
                      paddingAngle={2}
                      onClick={(entry) => {
                        const row = entry as unknown as { vehicleId?: string }
                        if (row?.vehicleId) navigate(`/dashboard/fleet/vehicles/${row.vehicleId}`)
                      }}
                    >
                      {vehicleDistribution.map((entry, idx) => (
                        <Cell key={entry.vehicleId} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatInr(Number(val))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Upcoming EMI Calendar & Overdue Payment Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
                <h2 className="dm-card-title text-sm">Upcoming EMI Calendar ({currentMonth})</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/emis')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Full Calendar
                </button>
              </div>
              {calendarItems.length === 0 ? (
                <p className="text-xs text-[#958777] py-4">No EMI instalments due in {currentMonth}.</p>
              ) : (
                <div className="divide-y divide-[#E5E5E5] text-xs">
                  {calendarItems.slice(0, 6).map((emi) => {
                    const rec = records.find((r) => r.id === emi.financeId)
                    return (
                      <button
                        key={emi.id}
                        type="button"
                        onClick={() => navigate('/dashboard/finance/emis')}
                        className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFAFA] px-2 rounded-lg transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-[#625346]">
                            {formatShortDate(emi.dueDate)} · {rec?.vehicleRegistration ?? emi.vehicleId} (EMI #{emi.emiNumber})
                          </p>
                          <p className="text-[11px] text-[#958777]">{rec?.bankName ?? 'Bank'} · {rec?.loanReferenceNumber}</p>
                        </div>
                        <div className="text-right flex items-center gap-2.5">
                          <span className="font-bold text-[#625346] tabular-nums">{formatInr(emi.emiAmount)}</span>
                          <EmiStatusBadge status={emi.status} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="enterprise-card p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
                <h2 className="dm-card-title text-sm">Overdue Payment Summary</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/overdue')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Manage Overdue
                </button>
              </div>
              {kpis.overdueEmis.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#4D6E4A]">
                  Zero overdue EMI instalments across all financed vehicles.
                </div>
              ) : (
                <div className="divide-y divide-[#E5E5E5] text-xs">
                  {kpis.overdueEmis.map((emi) => {
                    const rec = records.find((r) => r.id === emi.financeId)
                    const daysOver = Math.abs(diffDaysIso(emi.dueDate, todayIso))
                    return (
                      <button
                        key={emi.id}
                        type="button"
                        onClick={() => navigate('/dashboard/finance/overdue')}
                        className="w-full py-2.5 flex items-center justify-between gap-3 text-left hover:bg-[#FCECEB]/30 px-2 rounded-lg transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-[#625346]">
                            {rec?.vehicleRegistration} · EMI #{emi.emiNumber} ({daysOver}d overdue)
                          </p>
                          <p className="text-[11px] text-[#958777]">{rec?.bankName} · Due {formatShortDate(emi.dueDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#A24034] tabular-nums">{formatInr(emi.remainingAmount)}</p>
                          <EmiStatusBadge status={emi.status} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Vehicle-wise & Bank-wise Breakdowns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="enterprise-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
                <h2 className="dm-card-title text-sm">Vehicle-wise Finance Breakdown</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  View Register
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Vehicle</th>
                      <th>Financed</th>
                      <th>Outstanding</th>
                      <th>Active EMI</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.filter((r) => r.financeStatus !== 'cancelled').map((r) => (
                      <tr key={r.id} onClick={() => navigate(`/dashboard/finance/vehicles/${r.id}`)} className="cursor-pointer">
                        <td>
                          <p className="font-semibold text-[#625346]">{r.vehicleRegistration}</p>
                          <p className="text-[11px] text-[#958777]">{r.bankName}</p>
                        </td>
                        <td className="tabular-nums">{formatInr(r.netFinancedAmount)}</td>
                        <td className="tabular-nums font-semibold">{formatInr(r.outstandingPrincipal)}</td>
                        <td className="tabular-nums">{formatInr(r.emiAmount)}</td>
                        <td><FinanceStatusBadge status={r.financeStatus} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="enterprise-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
                <h2 className="dm-card-title text-sm">Bank-wise Loan Breakdown</h2>
                <button type="button" onClick={() => navigate('/dashboard/finance/banks')} className="text-xs font-semibold text-[#6E5696] hover:underline">
                  Banks Directory
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Bank / Financier</th>
                      <th>Loans</th>
                      <th>Total Financed</th>
                      <th>Outstanding</th>
                      <th>Monthly EMI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankBreakdown.map((b) => (
                      <tr key={b.bankName} onClick={() => navigate('/dashboard/finance/banks')} className="cursor-pointer">
                        <td className="font-semibold text-[#625346]">{b.bankName}</td>
                        <td className="tabular-nums">{b.loans}</td>
                        <td className="tabular-nums">{formatInr(b.financed)}</td>
                        <td className="tabular-nums font-semibold">{formatInr(b.outstanding)}</td>
                        <td className="tabular-nums">{formatInr(b.emi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <AddVehicleFinanceModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
