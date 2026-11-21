import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  FileSignature,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { formatInr } from '../../components/ui/EnterprisePrimitives'
import { ContractStatusBadge } from '../../components/contracts/ContractPrimitives'

const COLORS = ['#6E5696', '#E8C65A', '#4D6E4A', '#D9786C', '#958777', '#B8A3D9']

export default function ContractOverviewPage() {
  const navigate = useNavigate()
  const { activeOrganization, vehicles } = useFleet()
  const {
    partners,
    owners,
    contracts,
    contractVehicles,
    payments,
    deposits,
    maintenanceAllocations,
    handovers,
    alerts,
    hasPermission,
  } = useContracts()

  const [nowMs] = useState(() => Date.now())
  const stats = useMemo(() => {
    const companyOwnedCount = vehicles.filter((v) => (v.ownershipCategory ?? 'company_owned') === 'company_owned').length
    const contractedCount = vehicles.filter((v) => v.ownershipCategory === 'contracted_fleet').length
    const individualCount = vehicles.filter((v) => v.ownershipCategory === 'individual_owner').length
    const activeContracts = contracts.filter((c) => c.status === 'active')
    const pendingApproval = contracts.filter((c) => c.status === 'pending_approval')
    const expiring30d = contracts.filter((c) => {
      if (['closed', 'terminated', 'expired'].includes(c.status)) return false
      const days = Math.ceil((new Date(c.expiryDate).getTime() - nowMs) / 86400000)
      return days >= 0 && days <= 30
    })
    const expiredCount = contracts.filter((c) => c.status === 'expired' || new Date(c.expiryDate).getTime() < nowMs).length
    const totalPayable = payments.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + p.paymentAmountInr, 0)
    const totalPaid = payments.filter((p) => p.status !== 'cancelled').reduce((s, p) => s + p.paidAmountInr, 0)
    const overdueCount = payments.filter((p) => p.status === 'overdue' && p.outstandingAmountInr > 0).length
    const totalDepositHeld = deposits.reduce((s, d) => s + Math.max(0, d.paidAmountInr - d.deductedAmountInr - d.refundedAmountInr), 0)
    const pendingDepositRefunds = deposits.filter((d) => d.status === 'refund_approval' || (d.isRefundable && d.status === 'deductions')).length
    const pendingReturns = contracts.filter((c) => c.status === 'vehicle_return_pending').length
    const maintOrgCost = maintenanceAllocations.reduce((s, a) => s + a.orgShareInr, 0)
    const maintSupplierCost = maintenanceAllocations.reduce((s, a) => s + a.supplierShareInr, 0)

    return {
      companyOwnedCount,
      contractedCount,
      individualCount,
      activeContracts: activeContracts.length,
      pendingApproval: pendingApproval.length,
      expiring30d: expiring30d.length,
      expiredCount,
      totalPayable,
      totalPaid,
      overdueCount,
      totalDepositHeld,
      pendingDepositRefunds,
      pendingReturns,
      maintOrgCost,
      maintSupplierCost,
    }
  }, [contracts, deposits, maintenanceAllocations, nowMs, payments, vehicles])

  // 8 Interactive Charts Data
  const fleetByOwnershipData = [
    { name: 'Company-Owned', value: stats.companyOwnedCount, route: '/dashboard/fleet' },
    { name: 'Contracted Fleet', value: stats.contractedCount, route: '/dashboard/contracts/vehicles' },
    { name: 'Individual Owner', value: stats.individualCount, route: '/dashboard/contracts/owners' },
  ]

  const contractsByCategoryData = useMemo(() => {
    const counts = new Map<string, number>()
    contracts.forEach((c) => {
      const k = c.contractCategory.replace(/_/g, ' ')
      counts.set(k, (counts.get(k) ?? 0) + 1)
    })
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [contracts])

  const contractsByStatusData = useMemo(() => {
    const counts = new Map<string, number>()
    contracts.forEach((c) => {
      const k = c.status.replace(/_/g, ' ')
      counts.set(k, (counts.get(k) ?? 0) + 1)
    })
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
  }, [contracts])

  const supplierTypeSpendData = useMemo(() => {
    const partnerSpend = payments.filter((p) => p.supplierType === 'fleet_partner').reduce((s, p) => s + p.paymentAmountInr, 0)
    const ownerSpend = payments.filter((p) => p.supplierType === 'individual_owner').reduce((s, p) => s + p.paymentAmountInr, 0)
    return [
      { name: 'Fleet Partners', amount: partnerSpend },
      { name: 'Individual Owners', amount: ownerSpend },
    ]
  }, [payments])

  const maintAllocationData = [
    { name: 'Operating Org Share', amount: stats.maintOrgCost },
    { name: 'Supplier / Owner Share', amount: stats.maintSupplierCost },
  ]

  const depositBreakdownData = useMemo(() => {
    const paid = deposits.reduce((s, d) => s + d.paidAmountInr, 0)
    const outstanding = deposits.reduce((s, d) => s + d.outstandingAmountInr, 0)
    const deducted = deposits.reduce((s, d) => s + d.deductedAmountInr, 0)
    const refunded = deposits.reduce((s, d) => s + d.refundedAmountInr, 0)
    return [
      { name: 'Paid Held', amount: Math.max(0, paid - deducted - refunded) },
      { name: 'Outstanding', amount: outstanding },
      { name: 'Deducted', amount: deducted },
      { name: 'Refunded', amount: refunded },
    ]
  }, [deposits])

  const paymentStatusData = useMemo(() => {
    const map = new Map<string, number>()
    payments.forEach((p) => {
      const k = p.status.replace(/_/g, ' ')
      map.set(k, (map.get(k) ?? 0) + p.paymentAmountInr)
    })
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount }))
  }, [payments])

  const expiryTimelineData = useMemo(() => {
    const buckets = [
      { bucket: 'Expired / <=0d', count: 0 },
      { bucket: '1–15 Days', count: 0 },
      { bucket: '16–30 Days', count: 0 },
      { bucket: '31–90 Days', count: 0 },
      { bucket: '90+ Days', count: 0 },
    ]
    contracts.forEach((c) => {
      const days = Math.ceil((new Date(c.expiryDate).getTime() - nowMs) / 86400000)
      if (days <= 0) buckets[0].count++
      else if (days <= 15) buckets[1].count++
      else if (days <= 30) buckets[2].count++
      else if (days <= 90) buckets[3].count++
      else buckets[4].count++
    })
    return buckets
  }, [contracts, nowMs])

  const kpis = [
    { label: 'Total Fleet Vehicles', value: vehicles.length, sub: `${stats.companyOwnedCount} Co. / ${stats.contractedCount} Partner / ${stats.individualCount} Indiv.`, route: '/dashboard/fleet', icon: Car },
    { label: 'Active Contracts', value: stats.activeContracts, sub: `${contracts.length} total agreements`, route: '/dashboard/contracts/register', icon: FileSignature },
    { label: 'Fleet Partners', value: partners.filter((p) => !p.archived).length, sub: 'Third-party supplier orgs', route: '/dashboard/contracts/partners', icon: Building2 },
    { label: 'Individual Vehicle Owners', value: owners.filter((o) => !o.archived).length, sub: 'Verified single owners', route: '/dashboard/contracts/owners', icon: Users },
    { label: 'Pending Approvals', value: stats.pendingApproval, sub: 'Contracts awaiting sign-off', route: '/dashboard/contracts/register', icon: Clock },
    { label: 'Expiring <= 30 Days', value: stats.expiring30d, sub: `${stats.expiredCount} already expired`, route: '/dashboard/contracts/renewals', icon: AlertTriangle },
    { label: 'Contract Obligation', value: formatInr(stats.totalPayable), sub: `${formatInr(stats.totalPaid)} settled`, route: '/dashboard/contracts/payments', icon: Wallet },
    { label: 'Overdue Payments', value: stats.overdueCount, sub: 'Supplier invoices past due', route: '/dashboard/contracts/payments', icon: AlertTriangle },
    { label: 'Net Deposits Held', value: formatInr(stats.totalDepositHeld), sub: `${deposits.length} deposit/bond accounts`, route: '/dashboard/contracts/deposits', icon: ShieldCheck },
    { label: 'Pending Deposit Refunds', value: stats.pendingDepositRefunds, sub: 'Inspection/refund approvals', route: '/dashboard/contracts/deposits', icon: CheckCircle2 },
    { label: 'Contract Maint. Split', value: formatInr(stats.maintOrgCost + stats.maintSupplierCost), sub: `${formatInr(stats.maintSupplierCost)} supplier share`, route: '/dashboard/contracts/maintenance', icon: Wrench },
    { label: 'Handovers & Returns', value: handovers.length, sub: `${stats.pendingReturns} return pending`, route: '/dashboard/contracts/vehicles', icon: Car },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicle Contracts & Ownership Overview"
        subtitle={<>{activeOrganization.name} · Separate legal ownership, supplier agreements, deposits & split maintenance</>}
      >
        {hasPermission('create_contracts') && (
          <button
            type="button"
            onClick={() => navigate('/dashboard/contracts/register/new')}
            className="btn-accent"
          >
            <Plus className="w-4 h-4" />
            New Vehicle Contract
          </button>
        )}
        {hasPermission('manage_contract_payments') && (
          <button
            type="button"
            onClick={() => navigate('/dashboard/contracts/payments/new')}
            className="btn-secondary"
          >
            Record Payment
          </button>
        )}
      </PageHeader>

      {/* 12 Click-through KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon
          return (
            <button
              key={k.label}
              type="button"
              onClick={() => navigate(k.route)}
              className="enterprise-card p-4 text-left hover:border-[#B8A3D9] transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#958777]">{k.label}</span>
                <Icon className="w-4 h-4 text-[#6E5696] opacity-80 group-hover:opacity-100" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-[#625346] tabular-nums">{k.value}</div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#958777]">
                <span className="truncate">{k.sub}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[#6E5696]" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Priority Contract Alerts Strip */}
      {alerts.length > 0 && (
        <div className="enterprise-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="dm-card-title">Active Contract, Deposit & Expiry Alerts ({alerts.length})</h2>
            <button
              type="button"
              onClick={() => navigate('/dashboard/contracts/renewals')}
              className="text-xs font-semibold text-[#6E5696] hover:underline"
            >
              View Renewal Queue →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.slice(0, 6).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(a.actionRoute)}
                className="p-3 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#B8A3D9] text-left transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase text-[#6E5696]">{a.category}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold uppercase ${
                      a.severity === 'critical'
                        ? 'bg-[#FCECEB] text-[#A24034]'
                        : a.severity === 'high'
                          ? 'bg-[#FDF3E7] text-[#8F6510]'
                          : 'bg-[#EEE8F7] text-[#6E5696]'
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="text-xs font-bold text-[#625346] mt-1">{a.title}</p>
                <p className="text-[11px] text-[#958777] mt-0.5 line-clamp-2">{a.message}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 8 Interactive Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">1. Fleet Composition by Ownership Classification</h3>
            <button type="button" onClick={() => navigate('/dashboard/fleet')} className="text-xs text-[#6E5696] font-semibold">
              Open Fleet →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fleetByOwnershipData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {fleetByOwnershipData.map((entry, idx) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[idx % COLORS.length]}
                      className="cursor-pointer"
                      onClick={() => navigate(entry.route)}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">2. Contracts by Commercial Model</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="text-xs text-[#6E5696] font-semibold">
              Register →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contractsByCategoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#625346' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#625346' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6E5696" radius={[6, 6, 0, 0]} onClick={() => navigate('/dashboard/contracts/register')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">3. Contracts by Lifecycle Status</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="text-xs text-[#6E5696] font-semibold">
              Inspect All →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contractsByStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#625346' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#625346' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#E8C65A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">4. Contract Spend: Fleet Partners vs Individual Owners</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/payments')} className="text-xs text-[#6E5696] font-semibold">
              Payments →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={supplierTypeSpendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#625346' }} />
                <YAxis tick={{ fontSize: 11, fill: '#625346' }} />
                <Tooltip formatter={(val: unknown) => formatInr(Number(val ?? 0))} />
                <Bar dataKey="amount" fill="#4D6E4A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">5. Contract Maintenance Cost Allocation (Org vs Supplier)</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/maintenance')} className="text-xs text-[#6E5696] font-semibold">
              Allocations →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={maintAllocationData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={78} label>
                  {maintAllocationData.map((entry, idx) => (
                    <Cell key={entry.name} fill={COLORS[(idx + 1) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: unknown) => formatInr(Number(val ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">6. Security Deposit & Performance Bond Ledger</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/deposits')} className="text-xs text-[#6E5696] font-semibold">
              Deposits →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={depositBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#625346' }} />
                <YAxis tick={{ fontSize: 11, fill: '#625346' }} />
                <Tooltip formatter={(val: unknown) => formatInr(Number(val ?? 0))} />
                <Bar dataKey="amount" fill="#6E5696" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">7. Contract Payment Settlement Status Mix</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/payments')} className="text-xs text-[#6E5696] font-semibold">
              Ledger →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentStatusData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#625346' }} />
                <YAxis tick={{ fontSize: 11, fill: '#625346' }} />
                <Tooltip formatter={(val: unknown) => formatInr(Number(val ?? 0))} />
                <Bar dataKey="amount" fill="#D9786C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="dm-card-title">8. Contract Expiry Window Distribution</h3>
            <button type="button" onClick={() => navigate('/dashboard/contracts/renewals')} className="text-xs text-[#6E5696] font-semibold">
              Renewals →
            </button>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expiryTimelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#625346' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#625346' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#958777" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Active Contracts Snapshot Table */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
          <h2 className="dm-card-title">Recent Vehicle Agreements</h2>
          <button
            type="button"
            onClick={() => navigate('/dashboard/contracts/register')}
            className="text-xs font-semibold text-[#6E5696] hover:underline"
          >
            Open Full Contract Register ({contracts.length}) →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Supplier / Owner</th>
                <th>Category</th>
                <th>Vehicles</th>
                <th>Monthly / Base</th>
                <th>Expiry Date</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {contracts.slice(0, 6).map((c) => {
                const countVeh = contractVehicles.filter((v) => v.contractId === c.id).length
                return (
                  <tr key={c.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/contracts/register/${c.id}`)}
                        className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline text-left block"
                      >
                        {c.contractCode}
                      </button>
                      <span className="text-xs text-[#958777]">{c.contractName} (v{c.currentVersion})</span>
                    </td>
                    <td>
                      <span className="font-semibold text-[#625346] block">{c.supplierName}</span>
                      <span className="text-xs text-[#958777] capitalize">{c.supplierType.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="capitalize text-xs text-[#625346]">{c.contractCategory.replace(/_/g, ' ')}</td>
                    <td className="tabular-nums text-[#625346]">{countVeh}</td>
                    <td className="tabular-nums font-semibold text-[#625346]">
                      {c.financialTerms.monthlyRental > 0 ? formatInr(c.financialTerms.monthlyRental) : `${c.financialTerms.revenueSharingPct}% share`}
                    </td>
                    <td className="tabular-nums text-xs text-[#625346]">{c.expiryDate}</td>
                    <td>
                      <ContractStatusBadge status={c.status} />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/contracts/register/${c.id}`)}
                        className="btn-secondary text-xs px-3 py-1"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
