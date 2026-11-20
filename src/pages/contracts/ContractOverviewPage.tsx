import React from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeIndianRupee,
  Building2,
  CalendarClock,
  FileSignature,
  Handshake,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react'
import { KpiCard } from '../../components/ui/EnterprisePrimitives'
import { useContractWorkspace } from '../../hooks/useContracts'
import {
  BarRow,
  Card,
  ContractPage,
  ContractStatusBadge,
  ErrorBlock,
  LoadingBlock,
  OwnershipBadge,
  SectionTitle,
  inr,
  shortDate,
} from './ContractUi'

export default function ContractOverviewPage() {
  const { data, overview, loading, error, refresh } = useContractWorkspace()

  if (loading) return <ContractPage title="Contract Overview" subtitle="Loading ownership and contract intelligence…"><LoadingBlock /></ContractPage>
  if (error) return <ContractPage title="Contract Overview" subtitle="Vehicle ownership, supplier and contract performance"><ErrorBlock message={error} onRetry={() => void refresh()} /></ContractPage>

  const k = overview?.kpis
  const maxSupplier = Math.max(1, ...(overview?.contractedBySupplier.map((s) => s.count) ?? [1]))
  const maxDeposit = Math.max(1, ...(overview?.depositDistribution.map((d) => d.amountInr) ?? [1]))
  const maxMaintenance = Math.max(1, ...(overview?.maintenanceByParty.map((d) => d.amountInr) ?? [1]))

  const kpis = [
    { label: 'Active Contracts', value: k?.activeContracts ?? 0, icon: FileSignature, tone: 'purple' as const, to: '/dashboard/contracts/register?status=active' },
    { label: 'Contracted Vehicles', value: k?.contractedVehicles ?? 0, icon: Truck, tone: 'cocoa' as const, to: '/dashboard/contracts/vehicles?ownership=contracted_fleet' },
    { label: 'Individual-Owner Vehicles', value: k?.individualOwnerVehicles ?? 0, icon: UserRound, tone: 'yellow' as const, to: '/dashboard/contracts/vehicles?ownership=individual_owner' },
    { label: 'Fleet Partners', value: k?.fleetPartners ?? 0, icon: Building2, tone: 'sage' as const, to: '/dashboard/contracts/partners' },
    { label: 'Expiring in 30 Days', value: k?.expiringWithin30Days ?? 0, icon: CalendarClock, tone: 'coral' as const, to: '/dashboard/contracts/renewals' },
    { label: 'Pending Approvals', value: k?.pendingApprovals ?? 0, icon: AlertTriangle, tone: 'yellow' as const, to: '/dashboard/contracts/register?status=pending_approval' },
    { label: 'Pending Handovers', value: k?.pendingHandovers ?? 0, icon: Handshake, tone: 'purple' as const, to: '/dashboard/contracts/register?status=awaiting_handover' },
    { label: 'Outstanding Payments', value: inr(k?.outstandingPaymentsInr ?? 0), icon: Wallet, tone: 'coral' as const, to: '/dashboard/contracts/payments' },
    { label: 'Total Security Deposits', value: inr(k?.totalSecurityDepositsInr ?? 0), icon: ShieldCheck, tone: 'sage' as const, to: '/dashboard/contracts/deposits' },
    { label: 'Outstanding Deposits', value: inr(k?.outstandingDepositsInr ?? 0), icon: BadgeIndianRupee, tone: 'yellow' as const, to: '/dashboard/contracts/deposits' },
    { label: 'Maintenance Settlements', value: inr(k?.pendingMaintenanceSettlementsInr ?? 0), icon: RefreshCw, tone: 'purple' as const, to: '/dashboard/contracts/maintenance' },
    { label: 'Vehicles Awaiting Return', value: k?.vehiclesAwaitingReturn ?? 0, icon: Truck, tone: 'coral' as const, to: '/dashboard/contracts/register?status=vehicle_return_pending' },
  ]

  const recent = (data?.contracts ?? []).slice(0, 5)

  return (
    <ContractPage
      title="Contract Overview"
      subtitle="Ownership mix, supplier commitments, contract exposure and settlement health — all values from persisted records."
      actions={<Link to="/dashboard/contracts/register" className="btn-primary text-xs">Open Contract Register</Link>}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <Link key={kpi.label} to={kpi.to} className="block focus:outline-none focus:ring-2 focus:ring-[#B8A3D9]/50 rounded-xl">
            <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} tone={kpi.tone} />
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <SectionTitle title="Ownership Distribution" hint="Company-owned vs contracted vs individually supplied" />
          <div className="space-y-3">
            {(overview?.ownershipDistribution ?? []).map((row) => (
              <div key={row.ownershipType} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <OwnershipBadge type={row.ownershipType} />
                  <span className="text-xs font-bold text-[#625346] tabular-nums">{row.count}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[#958777] mt-3">Ownership classification is stored separately from operational control.</p>
        </Card>

        <Card>
          <SectionTitle title="Contracted Vehicles by Supplier" />
          <div className="space-y-3">
            {(overview?.contractedBySupplier ?? []).length === 0 && <p className="text-xs text-[#958777]">No supplier contracts yet.</p>}
            {(overview?.contractedBySupplier ?? []).map((row) => (
              <BarRow key={row.supplier} label={row.supplier} value={row.count} max={maxSupplier} />
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Contract Expiry Timeline" hint="Active agreements by expiry window" />
          <div className="space-y-3">
            {(overview?.expiryTimeline ?? []).map((row) => (
              <BarRow key={row.bucket} label={row.bucket} value={row.count} max={Math.max(1, ...(overview?.expiryTimeline.map((e) => e.count) ?? [1]))} />
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Monthly Contract Expenditure" hint="Rental payments and operating-org maintenance share (last 6 months)" />
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead><tr><th>Month</th><th className="text-right">Rental</th><th className="text-right">Maintenance</th></tr></thead>
              <tbody>
                {(overview?.monthlyExpenditure ?? []).map((row) => (
                  <tr key={row.month}>
                    <td className="text-xs font-semibold">{row.month}</td>
                    <td className="text-right tabular-nums text-xs">{inr(row.rentalInr)}</td>
                    <td className="text-right tabular-nums text-xs">{inr(row.maintenanceInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Deposit & Maintenance Exposure" hint="Security instruments and responsibility split" />
          <div className="space-y-3">
            {(overview?.depositDistribution ?? []).map((row) => (
              <BarRow key={row.depositType} label={row.depositType.replace(/_/g, ' ')} value={row.amountInr} max={maxDeposit} suffix=" INR" />
            ))}
            <div className="pt-2 border-t border-[#E5E5E5] space-y-3">
              {(overview?.maintenanceByParty ?? []).map((row) => (
                <BarRow key={row.party} label={row.party} value={row.amountInr} max={maxMaintenance} suffix=" INR" />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle title="Contracted Fleet Utilization" hint="Active vehicles as a share of supplied vehicles" />
          <div className="space-y-3">
            {(overview?.utilization ?? []).length === 0 && <p className="text-xs text-[#958777]">No supplier utilization data yet.</p>}
            {(overview?.utilization ?? []).map((row) => (
              <BarRow key={row.supplier} label={`${row.supplier} (${row.active}/${row.contracted})`} value={row.utilizationPct} max={100} suffix="%" />
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Recent Contracts" action={<Link to="/dashboard/contracts/register" className="text-[11px] font-semibold text-[#6E5696]">View all</Link>} />
          <div className="space-y-2">
            {recent.length === 0 && <p className="text-xs text-[#958777]">No contracts created yet.</p>}
            {recent.map((contract) => (
              <Link key={contract.id} to={`/dashboard/contracts/${contract.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2 hover:bg-[#FAF7EF]">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#625346] truncate">{contract.contractNumber} · {contract.name}</p>
                  <p className="text-[10px] text-[#958777] truncate">{contract.supplierName} · expires {shortDate(contract.expiryDate)}</p>
                </div>
                <ContractStatusBadge status={contract.status} />
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </ContractPage>
  )
}
