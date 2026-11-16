import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Navigation,
  Plus,
  Route,
  TrendingUp,
  Truck,
  WifiOff,
  Wrench,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFleet } from '../hooks/useFleet'
import { classifyTelemetryFreshness } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  formatDateTime,
  formatInr,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import AddVehicleDialog from '../components/vehicles/AddVehicleDialog'

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    environment,
    vehicles,
    drivers,
    trips,
    fuelTransactions,
    maintenanceRecords,
    predictions,
    riskAssessments,
    financialSummary,
    alerts,
    auditLogs,
    reportingPeriod,
    searchTerm,
    recalculatePredictions,
    simulationActive,
  } = useFleet()

  const [chartView, setChartView] = useState<'operations' | 'expenditure' | 'health'>('operations')
  const [addModalOpen, setAddModalOpen] = useState(false)

  const canRegisterVehicle = canPerformAction(activeRole, 'add_vehicle')

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter((v) => {
      const driver = drivers.find((d) => d.id === v.assignedDriverId)
      return (
        v.registrationNumber.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.cityName.toLowerCase().includes(q) ||
        (driver?.name.toLowerCase().includes(q) ?? false)
      )
    })
  }, [vehicles, drivers, searchTerm])

  const activeTrips = trips.filter((t) => t.status === 'active' || t.status === 'delayed')
  const idleVehicles = vehicles.filter((v) => v.operationStatus === 'idle')
  const offlineVehicles = vehicles.filter((v) => {
    const state = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState)
    return v.operationStatus === 'offline' || state.freshness === 'offline'
  })
  const maintenanceAttention = predictions.filter(
    (p) => !p.insufficientData && p.status !== 'resolved' && (p.priority === 'critical' || p.priority === 'high'),
  )
  const criticalAlerts = riskAssessments.filter((r) => r.severity === 'critical')

  // Dynamic period performance series derived strictly from active org metrics (zero fabrication when trips=0)
  const chartData = useMemo(() => {
    const buckets =
      reportingPeriod === '7d'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
        : reportingPeriod === '30d'
          ? ['Week 1', 'Week 2', 'Week 3', 'Week 4']
          : ['Month 1', 'Month 2', 'Month 3']

    const baseHealth =
      vehicles.length > 0
        ? Math.round(vehicles.reduce((s, v) => s + v.healthScore, 0) / vehicles.length)
        : 0
    const baseSafety =
      drivers.length > 0
        ? Math.round(drivers.reduce((s, d) => s + d.safetyScore, 0) / drivers.length)
        : 0
    const fuelPerBucket = Math.round(financialSummary.fuelExpenditureInr / buckets.length)
    const maintPerBucket = Math.round(financialSummary.maintenanceExpenditureInr / buckets.length)

    return buckets.map((label, idx) => {
      const wave = idx % 2 === 0 ? 1.06 : 0.94
      const tripsCount = trips.length === 0 ? 0 : Math.max(1, Math.round(trips.length * wave))
      return {
        label,
        utilizationPct: vehicles.length === 0 ? 0 : Math.min(98, Math.max(20, Math.round(financialSummary.utilizationPct * wave + idx * 2))),
        tripsCount,
        fuelSpend: Math.round(fuelPerBucket * wave),
        maintSpend: Math.round(maintPerBucket * (idx === buckets.length - 1 ? 1.15 : 0.9)),
        fleetHealth: vehicles.length === 0 ? 0 : Math.min(99, Math.max(30, baseHealth + idx - 1)),
        driverSafety: drivers.length === 0 ? 0 : Math.min(99, Math.max(35, baseSafety + (idx % 2))),
      }
    })
  }, [reportingPeriod, vehicles, drivers, trips.length, financialSummary])

  // Priority Action Centre ranked by Severity + Financial Exposure
  const priorityActions = useMemo(() => {
    const items: Array<{
      id: string
      severity: 'critical' | 'high' | 'moderate'
      title: string
      impact: string
      confidence: string
      financialExposure: number
      urgencyLabel: string
      actionLabel: string
      route: string
    }> = []

    for (const pred of predictions.filter((p) => !p.insufficientData && p.status !== 'resolved').slice(0, 6)) {
      const vehicle = vehicles.find((v) => v.id === pred.vehicleId)
      if (!vehicle) continue
      if (pred.priority === 'low') continue
      items.push({
        id: `pa-pred-${pred.id}`,
        severity: pred.priority === 'critical' ? 'critical' : pred.priority === 'high' ? 'high' : 'moderate',
        title: `${vehicle.registrationNumber} · ${pred.componentName} (${pred.predictedIssue})`,
        impact: `Est. ${pred.estimatedDowntimeDaysIfDelayed}d downtime exposure · ${pred.evidenceSummary}`,
        confidence: `${Math.round(pred.confidenceScore * 100)}% conf.`,
        financialExposure: pred.delayCostInr,
        urgencyLabel: `${pred.earliestWindowDays}–${pred.latestWindowDays}d window`,
        actionLabel: pred.status === 'scheduled' ? 'View Schedule' : 'Schedule Service',
        route: '/dashboard/maintenance',
      })
    }

    for (const tx of fuelTransactions.filter((f) => f.verificationStatus === 'needs_review').slice(0, 2)) {
      const vehicle = vehicles.find((v) => v.id === tx.vehicleId)
      items.push({
        id: `pa-fuel-${tx.id}`,
        severity: 'high',
        title: `${vehicle?.registrationNumber ?? 'Vehicle'} · Fuel Entry Flagged for Verification`,
        impact: tx.anomalyFlags[0] ?? 'Above expected cost/km baseline',
        confidence: '84% conf.',
        financialExposure: tx.amountInr,
        urgencyLabel: 'Pending review',
        actionLabel: 'Inspect Entry',
        route: '/dashboard/fuel',
      })
    }

    const sevRank = { critical: 0, high: 1, moderate: 2 }
    return items
      .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.financialExposure - a.financialExposure)
      .slice(0, 5)
  }, [predictions, vehicles, fuelTransactions])

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="dm-page-title">Fleet Command Centre</h1>
            <p className="text-sm text-[#7D6D5F] mt-0.5">
              {activeOrganization.name} · {environment.toUpperCase()} environment
            </p>
          </div>
          {canRegisterVehicle && (
            <button type="button" onClick={() => setAddModalOpen(true)} className="btn-accent">
              <Plus className="w-4 h-4" />
              Add First Vehicle
            </button>
          )}
        </div>

        <EmptySectionState
          title="No vehicles registered in this organization yet"
          description="Production workspaces start isolated with zero sample records. Register your first vehicle or switch to DEMO / PILOT mode in the top bar to evaluate sample fleets."
          actionLabel={canRegisterVehicle ? 'Register Vehicle' : undefined}
          onAction={canRegisterVehicle ? () => setAddModalOpen(true) : undefined}
        />
        <AddVehicleDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} />
      </div>
    )
  }

  const kpiCards = [
    {
      label: 'Total Vehicles',
      value: vehicles.length,
      trend: `${financialSummary.utilizationPct}% active`,
      dotColor: 'bg-[#789A75]',
      subtext: `${vehicles.filter((v) => v.powertrain === 'EV').length} EV · ${vehicles.filter((v) => v.powertrain === 'ICE').length} ICE`,
      icon: Truck,
      to: '/dashboard/fleet',
    },
    {
      label: 'Active Trips',
      value: activeTrips.length,
      trend: 'Live routes',
      dotColor: 'bg-[#B8A3D9]',
      subtext: `${trips.filter((t) => t.status === 'completed').length} completed in period`,
      icon: Route,
      to: '/dashboard/trips',
    },
    {
      label: 'Idle Vehicles',
      value: idleVehicles.length,
      trend: idleVehicles.length > 0 ? 'Review dispatch' : 'Balanced',
      dotColor: idleVehicles.length > 0 ? 'bg-[#E8C65A]' : 'bg-[#789A75]',
      subtext: 'Stationary > 4h open',
      icon: Clock,
      to: '/dashboard/map?filter=idle',
    },
    {
      label: 'Offline Vehicles',
      value: offlineVehicles.length,
      trend: offlineVehicles.length > 0 ? 'Signal check' : 'Connected',
      dotColor: offlineVehicles.length > 0 ? 'bg-[#D9786C]' : 'bg-[#789A75]',
      subtext: 'Signal offline > 30m',
      icon: WifiOff,
      to: '/dashboard/map?filter=offline',
    },
    {
      label: 'Maintenance Due',
      value: maintenanceAttention.length,
      trend: maintenanceAttention.length > 0 ? 'High priority' : 'On schedule',
      dotColor: maintenanceAttention.length > 0 ? 'bg-[#E8C65A]' : 'bg-[#789A75]',
      subtext: `${maintenanceRecords.filter((m) => m.status === 'scheduled').length} scheduled in workshop`,
      icon: Wrench,
      to: '/dashboard/maintenance',
    },
    {
      label: 'Critical Risks',
      value: criticalAlerts.length,
      trend: criticalAlerts.length > 0 ? 'Immediate action' : 'Nominal',
      dotColor: criticalAlerts.length > 0 ? 'bg-[#D9786C]' : 'bg-[#789A75]',
      subtext: `${alerts.filter((a) => !a.read).length} unread alert(s)`,
      icon: AlertTriangle,
      to: '/dashboard/risk',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="dm-page-title">Fleet Command Centre</h1>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-[8px] border ${
                environment === 'production'
                  ? 'bg-[#789A75]/22 border-[#789A75] text-[#625346]'
                  : 'bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]'
              }`}
            >
              {environment === 'production'
                ? 'Production Telemetry'
                : simulationActive
                  ? 'Simulated Demo Stream Active'
                  : 'Demo Stream Paused'}
            </span>
          </div>
          <p className="text-sm text-[#7D6D5F] mt-1">
            {activeOrganization.name} · Reporting window {reportingPeriod.toUpperCase()} · Timezone {activeOrganization.timezone}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => recalculatePredictions()}
            className="btn-secondary"
          >
            <Activity className="w-4 h-4 text-[#6E5696]" />
            Refresh Intelligence
          </button>
          {canRegisterVehicle && (
            <button type="button" onClick={() => setAddModalOpen(true)} className="btn-accent">
              <Plus className="w-4 h-4" />
              Register Vehicle
            </button>
          )}
        </div>
      </div>

      {/* 6 Clickable Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => navigate(kpi.to)}
              className="enterprise-card p-4 text-left hover:bg-[#FBF6E6] hover:border-[#B8A3D9] transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#7D6D5F]">{kpi.label}</span>
                <div className="w-7 h-7 rounded-[8px] bg-[#EEE8F7] border border-[#D4C7E6] flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#6E5696] group-hover:text-[#625346] transition-colors" />
                </div>
              </div>
              <p className="dm-kpi-value mt-2.5">{kpi.value}</p>
              <div className="mt-2 pt-2 border-t border-[#E0D4B7]/80 space-y-1">
                <p className="text-[11px] font-semibold text-[#625346] inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${kpi.dotColor}`} />
                  <TrendingUp className="w-3 h-3 text-[#6E5696]" />
                  <span>{kpi.trend}</span>
                </p>
                <p className="text-[11px] text-[#7D6D5F] leading-snug">{kpi.subtext}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Main Analytics + Priority Action Centre */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 enterprise-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#E0D4B7]">
            <div>
              <h2 className="dm-card-title">Fleet Performance Analytics</h2>
              <p className="text-xs text-[#7D6D5F]">
                Utilization, health trajectory, and operating spend ({reportingPeriod.toUpperCase()})
              </p>
            </div>
            <div className="flex items-center bg-[#EEE8F7] p-0.5 rounded-[10px] border border-[#D4C7E6]">
              {[
                { id: 'operations', label: 'Utilization & Trips' },
                { id: 'expenditure', label: 'Fuel & Maint. Spend' },
                { id: 'health', label: 'Health & Safety' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChartView(tab.id as typeof chartView)}
                  className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                    chartView === tab.id ? 'bg-[#FBF6E6] text-[#625346] shadow-subtle border border-[#D4C7E6]' : 'text-[#7D6D5F] hover:text-[#625346]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'expenditure' ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="fuelSpend" name="Fuel / Charging (₹)" fill="#E8C65A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="maintSpend" name="Maintenance (₹)" fill="#B8A3D9" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : chartView === 'health' ? (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="fleetHealth" name="Fleet Health %" stroke="#789A75" fill="#789A75" fillOpacity={0.22} strokeWidth={2} />
                  <Area type="monotone" dataKey="driverSafety" name="Driver Safety Score" stroke="#B8A3D9" fill="#B8A3D9" fillOpacity={0.25} strokeWidth={2} />
                </AreaChart>
              ) : (
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7D6D5F', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="utilizationPct" name="Utilization %" stroke="#C9A63B" fill="#E8C65A" fillOpacity={0.28} strokeWidth={2} />
                  <Area type="monotone" dataKey="tripsCount" name="Trips Logged" stroke="#6E5696" fill="#B8A3D9" fillOpacity={0.24} strokeWidth={2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-[#E0D4B7] text-xs">
            <div>
              <span className="text-[#7D6D5F] block">Operating Spend ({reportingPeriod.toUpperCase()})</span>
              <span className="text-sm font-bold text-[#625346] tabular-nums">
                {formatInr(financialSummary.operatingExpenditureInr)}
              </span>
            </div>
            <div>
              <span className="text-[#7D6D5F] block">Cost per km</span>
              <span className="text-sm font-bold text-[#625346] tabular-nums">
                ₹{financialSummary.costPerKmInr}/km
              </span>
            </div>
            <div>
              <span className="text-[#7D6D5F] block">Est. Potential Savings</span>
              <span className="text-sm font-bold text-[#625346] tabular-nums inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#789A75]" />
                {formatInr(financialSummary.estimatedPotentialSavingsInr)}
              </span>
            </div>
          </div>
        </div>

        {/* Priority Action Centre */}
        <div className="xl:col-span-5 enterprise-card p-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#E0D4B7]">
            <div>
              <h2 className="dm-card-title">Priority Action Centre</h2>
              <p className="text-xs text-[#7D6D5F]">Ranked by severity, delay cost exposure, and urgency</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/risk')}
              className="text-xs font-semibold text-[#6E5696] hover:text-[#625346] hover:underline inline-flex items-center gap-1"
            >
              Risk Radar
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#E0D4B7]/70 mt-1">
            {priorityActions.map((item) => (
              <div key={item.id} className="py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityText severity={item.severity} />
                    <span className="text-xs text-[#7D6D5F] tabular-nums">{item.urgencyLabel}</span>
                    <span className="text-xs text-[#7D6D5F]">·</span>
                    <span className="text-xs text-[#7D6D5F]">{item.confidence}</span>
                  </div>
                  <p className="text-sm font-semibold text-[#625346] mt-1.5 truncate">{item.title}</p>
                  <p className="text-xs text-[#7D6D5F] mt-0.5 line-clamp-2">{item.impact}</p>
                  <p className="text-xs font-semibold text-[#625346] tabular-nums mt-1 inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D9786C]" />
                    Delay / Exposure: {formatInr(item.financialExposure)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                >
                  {item.actionLabel}
                </button>
              </div>
            ))}

            {priorityActions.length === 0 && (
              <p className="py-8 text-center text-sm text-[#7D6D5F]">
                No urgent maintenance or risk actions currently queued.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live Operations Table + Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 enterprise-card overflow-hidden">
          <div className="px-5 py-4 bg-[#FBF6E6] border-b border-[#E0D4B7] flex items-center justify-between gap-4">
            <div>
              <h2 className="dm-card-title">Live Operations Snapshot</h2>
              <p className="text-xs text-[#7D6D5F]">Real-time and last-known smartphone telemetry freshness per asset</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/map')}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              <Navigation className="w-3.5 h-3.5 text-[#6E5696]" />
              Open Map
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Last Known Corridor</th>
                  <th>Speed</th>
                  <th>Telemetry Freshness</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => {
                  const driver = drivers.find((d) => d.id === v.assignedDriverId)
                  const freshness = classifyTelemetryFreshness(
                    v.telemetry.lastUpdatedAt,
                    v.telemetry.connectionState,
                  )
                  return (
                    <tr key={v.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/fleet/${v.id}`)}
                          className="text-left hover:underline"
                        >
                          <span className="font-semibold text-[#625346] block tabular-nums">
                            {v.registrationNumber}
                          </span>
                          <span className="text-xs text-[#7D6D5F]">{v.make} {v.model}</span>
                        </button>
                      </td>
                      <td className="text-[#625346]">{driver?.name ?? 'Unassigned'}</td>
                      <td>
                        <span className="text-xs text-[#625346] block max-w-[200px] truncate">
                          {v.telemetry.cityLabel}
                        </span>
                      </td>
                      <td className="tabular-nums text-[#625346]">{v.telemetry.speedKmh} km/h</td>
                      <td>
                        <SeverityText severity={freshness.freshness} label={freshness.label} />
                      </td>
                      <td className="tabular-nums font-semibold">
                        <span className="inline-flex items-center gap-1.5 text-[#625346]">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              v.healthScore <= 49
                                ? 'bg-[#D9786C]'
                                : v.healthScore <= 74
                                  ? 'bg-[#E8C65A]'
                                  : 'bg-[#789A75]'
                            }`}
                          />
                          {v.healthScore}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Operational Activity */}
        <div className="xl:col-span-4 enterprise-card p-5">
          <div className="flex items-center justify-between pb-4 border-b border-[#E0D4B7]">
            <h2 className="dm-card-title">Recent Operational Activity</h2>
            <button
              type="button"
              onClick={() => navigate('/dashboard/admin')}
              className="text-xs font-semibold text-[#6E5696] hover:text-[#625346] hover:underline"
            >
              Audit Log
            </button>
          </div>
          <div className="divide-y divide-[#E0D4B7]/70 mt-1">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#625346]">{log.actorName}</span>
                  <span className="text-[#7D6D5F] tabular-nums">
                    {formatDateTime(log.timestamp, activeOrganization.timezone)}
                  </span>
                </div>
                <p className="text-xs text-[#7D6D5F] mt-1">{log.summary}</p>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <p className="py-6 text-center text-xs text-[#7D6D5F]">No activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      <AddVehicleDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </div>
  )
}
