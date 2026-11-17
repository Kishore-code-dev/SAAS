import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Cpu,
  Fuel,
  Layers,
  Maximize2,
  Navigation,
  Plus,
  Smartphone,
} from 'lucide-react'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFleet } from '../hooks/useFleet'
import { classifyTelemetryFreshness, isValidCoordinate } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  formatDateTime,
  formatInr,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import { computeFleetBounds, summarizeFleetTrackingStatuses } from '../utils/fleetTracking'
import type { Vehicle } from '../types/fleet'
import AddVehicleDialog from '../components/vehicles/AddVehicleDialog'

function createDashboardPinIcon(variant: 'lavender' | 'yellow', heading = 0, moving = false, highlighted = false) {
  const fill = variant === 'yellow' ? '#E8C65A' : '#B8A3D9'
  const ring = variant === 'yellow' ? '#625346' : '#6E5696'
  const size = highlighted ? 28 : 22
  const inner = moving
    ? `<svg width="11" height="11" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);" fill="${ring}" aria-hidden="true"><path d="M12 2L19 20L12 16L5 20L12 2Z"/></svg>`
    : `<span style="width:6px;height:6px;border-radius:9999px;background:${ring};"></span>`

  return L.divIcon({
    className: 'dm-dashboard-gps-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${fill};border:2.5px solid #FFFFFF;box-shadow:${highlighted ? '0 0 0 3px rgba(110,86,150,0.35), ' : ''}0 2px 8px rgba(98,83,70,0.28);display:flex;align-items:center;justify-content:center;">${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function DashboardMapController({
  bounds,
  fleetSignature,
  fitNonce,
  focusedVehicle,
  focusNonce,
}: {
  bounds: [[number, number], [number, number]]
  fleetSignature: string
  fitNonce: number
  focusedVehicle: Vehicle | null
  focusNonce: number
}) {
  const map = useMap()

  useEffect(() => {
    if (typeof map.fitBounds === 'function') {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 11, animate: fitNonce > 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce, fleetSignature, map])

  useEffect(() => {
    if (focusNonce > 0 && focusedVehicle && typeof map.flyTo === 'function') {
      map.flyTo([focusedVehicle.telemetry.location.lat, focusedVehicle.telemetry.location.lng], 12, {
        duration: 0.5,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce, map])

  return null
}

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
    financialSummary,
    alerts,
    reportingPeriod,
    searchTerm,
    recalculatePredictions,
    simulationActive,
    nowTick,
  } = useFleet()

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [focusedMapVehicleId, setFocusedMapVehicleId] = useState<string | null>(null)
  const [mapFitNonce, setMapFitNonce] = useState(0)
  const [mapFocusNonce, setMapFocusNonce] = useState(0)
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

  const activeSmartphonesCount = useMemo(
    () =>
      vehicles.filter((v) => {
        const state = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState, nowTick)
        return state.freshness === 'live' || state.freshness === 'delayed'
      }).length,
    [vehicles, nowTick],
  )

  const avgFuelEfficiency = useMemo(() => {
    const iceEntries = fuelTransactions.filter((tx) => {
      const veh = vehicles.find((v) => v.id === tx.vehicleId)
      return (
        tx.paymentMethod !== 'ev_charging' &&
        veh?.powertrain !== 'EV' &&
        typeof tx.efficiencyKmPerUnit === 'number' &&
        tx.efficiencyKmPerUnit > 0
      )
    })
    if (iceEntries.length === 0) return null
    const avg = iceEntries.reduce((s, tx) => s + (tx.efficiencyKmPerUnit ?? 0), 0) / iceEntries.length
    return Number(avg.toFixed(1))
  }, [fuelTransactions, vehicles])

  const maintenanceAttention = useMemo(
    () =>
      predictions.filter(
        (p) => !p.insufficientData && p.status !== 'resolved' && (p.priority === 'critical' || p.priority === 'high'),
      ),
    [predictions],
  )

  const topPrediction = useMemo(() => {
    const ranked = [...predictions]
      .filter((p) => !p.insufficientData && p.status !== 'resolved')
      .sort((a, b) => b.confidenceScore - a.confidenceScore || b.delayCostInr - a.delayCostInr)
    return ranked[0] ?? null
  }, [predictions])

  const topPredictionVehicle = useMemo(
    () => (topPrediction ? vehicles.find((v) => v.id === topPrediction.vehicleId) ?? null : null),
    [topPrediction, vehicles],
  )

  // Donut Chart Data: Fleet Utilization breakdown
  const utilizationDonutData = useMemo(() => {
    const movingCount = vehicles.filter((v) => v.operationStatus === 'moving').length
    const idleCount = vehicles.filter((v) => v.operationStatus === 'idle' || v.operationStatus === 'stopped').length
    const offlineMaintCount = Math.max(0, vehicles.length - movingCount - idleCount)
    return [
      { name: 'Active Trips', value: movingCount, color: '#E8C65A' },
      { name: 'Standby / Idle', value: idleCount, color: '#B8A3D9' },
      { name: 'Offline / Service', value: offlineMaintCount, color: '#E5E5E5' },
    ].filter((seg) => seg.value > 0)
  }, [vehicles])

  // Weekly Financial Forensics: cost/km trajectory derived from UPI/OCR fuel & maintenance records
  const weeklyForensicsData = useMemo(() => {
    const allTs = [
      ...trips.map((t) => new Date(t.startTime).getTime()),
      ...fuelTransactions.map((f) => new Date(f.timestamp).getTime()),
      ...maintenanceRecords.map((m) => new Date(m.performedAt).getTime()),
    ].filter((ms) => Number.isFinite(ms))
    const anchorMs = allTs.length > 0 ? Math.max(...allTs) : nowTick
    const weekMs = 7 * 86400000

    return [3, 2, 1, 0].map((offset) => {
      const wStart = anchorMs - (offset + 1) * weekMs
      const wEnd = offset === 0 ? anchorMs + 30 * 86400000 : anchorMs - offset * weekMs
      const label = offset === 0 ? 'Current' : `W-${offset}`

      const fuelSum = fuelTransactions
        .filter((f) => {
          const ms = new Date(f.timestamp).getTime()
          return Number.isFinite(ms) && ms >= wStart && ms < wEnd
        })
        .reduce((s, f) => s + f.amountInr, 0)

      const maintSum = maintenanceRecords
        .filter((m) => {
          const ms = new Date(m.performedAt).getTime()
          return Number.isFinite(ms) && ms >= wStart && ms < wEnd
        })
        .reduce((s, m) => s + m.costInr, 0)

      const tripDistanceKm = trips
        .filter((t) => {
          const ms = new Date(t.startTime).getTime()
          return Number.isFinite(ms) && ms >= wStart && ms < wEnd
        })
        .reduce((s, t) => s + Math.max(t.distanceKm, 1), 0)

      const estWeeklyKm =
        tripDistanceKm > 0
          ? tripDistanceKm
          : Math.max(1, vehicles.reduce((s, v) => s + v.dailyAvgKm * 7, 0))

      const fuelCostPerKm =
        offset === 0 && financialSummary.totalDistanceKm > 0
          ? Number((financialSummary.fuelExpenditureInr / financialSummary.totalDistanceKm).toFixed(2))
          : Number((fuelSum / estWeeklyKm).toFixed(2))

      const totalCostPerKm =
        offset === 0
          ? financialSummary.costPerKmInr
          : Number(((fuelSum + maintSum) / estWeeklyKm).toFixed(2))

      return {
        week: label,
        fuelCostPerKm,
        totalCostPerKm,
      }
    })
  }, [trips, fuelTransactions, maintenanceRecords, vehicles, financialSummary, nowTick])

  const mapVehicles = useMemo(
    () =>
      filteredVehicles.filter((v) =>
        isValidCoordinate(v.telemetry.location.lat, v.telemetry.location.lng),
      ),
    [filteredVehicles],
  )

  const fleetBoundsSummary = useMemo(
    () => computeFleetBounds(mapVehicles.map((v) => v.telemetry.location)),
    [mapVehicles],
  )

  // Stable key that updates only when the set of tracked vehicle IDs or org changes (not every 3s micro-tick)
  const mapFleetSignature = useMemo(
    () => `${activeOrganization.id}:${mapVehicles.map((v) => v.id).join(',')}`,
    [activeOrganization.id, mapVehicles],
  )

  const focusedMapVehicle = useMemo(
    () => mapVehicles.find((v) => v.id === focusedMapVehicleId) ?? null,
    [mapVehicles, focusedMapVehicleId],
  )

  const mapStatusCounts = useMemo(
    () => summarizeFleetTrackingStatuses(mapVehicles, nowTick),
    [mapVehicles, nowTick],
  )

  const activeMapRoutes = useMemo(
    () =>
      trips.filter(
        (t) =>
          (t.status === 'active' || t.status === 'delayed') &&
          mapVehicles.some((v) => v.id === t.vehicleId) &&
          t.route.filter((pt) => isValidCoordinate(pt.lat, pt.lng)).length >= 2,
      ),
    [trips, mapVehicles],
  )

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6 bg-[#FFFFFF]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="dm-page-title">Fleet Command Centre</h1>
            <p className="text-sm text-[#958777] mt-0.5">
              {activeOrganization.name} · {environment.toUpperCase()} environment
            </p>
          </div>
          {canRegisterVehicle && (
            <button type="button" onClick={() => setAddModalOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          )}
        </div>

        <EmptySectionState
          title="No vehicles registered in this organization yet"
          description="Production workspaces start isolated with zero sample records. Register your first asset or switch to DEMO / PILOT mode in the top bar to evaluate sample fleets."
          actionLabel={canRegisterVehicle ? 'Add Vehicle' : undefined}
          onAction={canRegisterVehicle ? () => setAddModalOpen(true) : undefined}
        />
        <AddVehicleDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} />
      </div>
    )
  }

  const kpiCards = [
    {
      label: 'Total Fleet',
      value: String(vehicles.length),
      subtext: `${vehicles.filter((v) => v.powertrain === 'EV').length} EV · ${vehicles.filter((v) => v.powertrain === 'ICE').length} ICE`,
      icon: Layers,
      to: '/dashboard/fleet',
    },
    {
      label: 'Active Smartphones',
      value: String(activeSmartphonesCount),
      subtext: 'Software-only GPS & motion nodes',
      icon: Smartphone,
      to: '/dashboard/map',
    },
    {
      label: 'Fuel Efficiency',
      value: avgFuelEfficiency !== null ? `${avgFuelEfficiency} km/L` : '—',
      subtext: 'UPI & OCR receipt verification',
      icon: Fuel,
      to: '/dashboard/fuel',
    },
    {
      label: 'Maintenance Alerts',
      value: String(maintenanceAttention.length),
      subtext: `${maintenanceRecords.filter((m) => m.status === 'scheduled').length} scheduled service windows`,
      icon: AlertTriangle,
      to: '/dashboard/maintenance',
    },
  ]

  const recentAlertsList = alerts.slice(0, 4)

  const getAlertPillStyle = (severity: string) => {
    if (severity === 'critical') {
      return {
        label: 'Critical',
        classes: 'bg-[#FCECEB] border-[#E7A8A0] text-[#625346]',
      }
    }
    if (severity === 'high' || severity === 'warning') {
      return {
        label: 'Warning',
        classes: 'bg-[#FDF3E7] border-[#E8C290] text-[#625346]',
      }
    }
    return {
      label: 'Nominal',
      classes: 'bg-[#EDF4EC] border-[#B8D0B5] text-[#625346]',
    }
  }

  return (
    <div className="space-y-6 bg-[#FFFFFF]">
      {/* Page Title & Secondary Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="dm-page-title">Fleet Command Centre</h1>
            <span className="text-xs font-medium text-[#958777]">
              · {environment === 'production' ? 'Production Telemetry' : simulationActive ? 'Live Software Telemetry' : 'Stream Paused'}
            </span>
          </div>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Reporting window {reportingPeriod.toUpperCase()} · Timezone {activeOrganization.timezone}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => recalculatePredictions()}
            className="btn-accent text-xs px-3.5 py-2"
          >
            <Activity className="w-4 h-4 text-[#6E5696]" />
            Refresh Intelligence
          </button>
        </div>
      </div>

      {/* 4 Elevated White KPI Cards with 2px Golden Yellow Left Accent Border */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => navigate(kpi.to)}
              className="bg-[#FFFFFF] border border-[#E5E5E5] border-l-2 border-l-[#E8C65A] rounded-xl shadow-card p-5 text-left hover:border-[#B8A3D9] hover:border-l-[#E8C65A] transition-all flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#958777]">{kpi.label}</span>
                <div className="w-8 h-8 rounded-[10px] bg-[#EEE8F7] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-[#6E5696]" />
                </div>
              </div>
              <p className="dm-kpi-value mt-3">{kpi.value}</p>
              <p className="text-xs text-[#958777] mt-2 leading-snug">{kpi.subtext}</p>
            </button>
          )
        })}
      </div>

      {/* Main Workspace Grid: Left (Charts + Live GPS Map) & Right Side Panel (Predictive AI + Recent Alerts) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-6">
          {/* Data Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Donut Chart: Fleet Utilization */}
            <div className="lg:col-span-5 enterprise-card p-5 flex flex-col justify-between">
              <div>
                <h2 className="dm-card-title">Fleet Utilization</h2>
                <p className="text-xs text-[#958777] mt-0.5">
                  Active smartphone trip allocation ({vehicles.length} units)
                </p>
              </div>

              <div className="relative h-52 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={utilizationDonutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    >
                      {utilizationDonutData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-[#625346] tabular-nums">
                    {financialSummary.utilizationPct}%
                  </span>
                  <span className="text-[11px] font-medium text-[#958777]">Active</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 pt-3 border-t border-[#E5E5E5] text-xs">
                {utilizationDonutData.map((seg) => (
                  <div key={seg.name} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-[#958777]">
                      {seg.name === 'Active Trips' ? 'Active' : seg.name === 'Standby / Idle' ? 'Standby' : 'Offline'}
                    </span>
                    <span className="font-semibold text-[#625346] tabular-nums">{seg.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Smooth Line Chart: Weekly Financial Forensics */}
            <div className="lg:col-span-7 enterprise-card p-5 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="dm-card-title">Weekly Financial Forensics</h2>
                  <p className="text-xs text-[#958777] mt-0.5">
                    Cost per km (₹/km) via UPI & OCR ledger telemetry
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/financials')}
                  className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1 shrink-0"
                >
                  Details
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="h-52 mt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyForensicsData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                    <XAxis dataKey="week" tick={{ fill: '#958777', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#958777', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="totalCostPerKm"
                      name="Total Ops (₹/km)"
                      stroke="#B8A3D9"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#B8A3D9', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="fuelCostPerKm"
                      name="Fuel / Energy (₹/km)"
                      stroke="#E8C65A"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#E8C65A', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-[#E5E5E5] text-xs">
                <div>
                  <span className="text-[#958777] block">Operating Spend</span>
                  <span className="text-sm font-bold text-[#625346] tabular-nums">
                    {formatInr(financialSummary.operatingExpenditureInr)}
                  </span>
                </div>
                <div>
                  <span className="text-[#958777] block">Blended Cost / km</span>
                  <span className="text-sm font-bold text-[#625346] tabular-nums">
                    ₹{financialSummary.costPerKmInr}/km
                  </span>
                </div>
                <div>
                  <span className="text-[#958777] block">Potential Savings</span>
                  <span className="text-sm font-bold text-[#625346] tabular-nums">
                    {formatInr(financialSummary.estimatedPotentialSavingsInr)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Smartphone GPS Map Widget */}
          <div className="enterprise-card overflow-hidden">
            <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="dm-card-title">Live Smartphone GPS Map</h2>
                  <span className="text-xs font-medium text-[#958777] tabular-nums">
                    · Tracking {mapVehicles.length}/{vehicles.length} vehicles
                  </span>
                </div>
                <p className="text-xs text-[#958777] mt-0.5 tabular-nums">
                  {mapStatusCounts.moving} Moving · {mapStatusCounts.idle + mapStatusCounts.stopped} Standby · {mapStatusCounts.delayed} Delayed · {mapStatusCounts.offline} Offline
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="hidden sm:flex items-center gap-3 text-xs text-[#958777] mr-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B8A3D9] border border-[#6E5696]" />
                    Moving
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#E8C65A] border border-[#625346]" />
                    Standby / Alert
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFocusedMapVehicleId(null)
                    setMapFitNonce((n) => n + 1)
                  }}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#6E5696]" />
                  Fit All ({mapVehicles.length})
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/map')}
                  className="btn-accent text-xs px-3 py-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 text-[#6E5696]" />
                  Open Full Map
                </button>
              </div>
            </div>

            <div className="h-[360px] w-full relative bg-[#F5F5F7]">
              <MapContainer
                center={fleetBoundsSummary.center}
                zoom={fleetBoundsSummary.singlePointZoom}
                scrollWheelZoom={false}
                className="w-full h-full z-0"
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <DashboardMapController
                  bounds={fleetBoundsSummary.bounds}
                  fleetSignature={mapFleetSignature}
                  fitNonce={mapFitNonce}
                  focusedVehicle={focusedMapVehicle}
                  focusNonce={mapFocusNonce}
                />
                {activeMapRoutes.map((trip) => (
                  <Polyline
                    key={trip.id}
                    positions={trip.route
                      .filter((pt) => isValidCoordinate(pt.lat, pt.lng))
                      .map((pt) => [pt.lat, pt.lng] as [number, number])}
                    pathOptions={{
                      color: trip.status === 'delayed' ? '#D8B442' : '#6E5696',
                      weight: 3,
                      opacity: 0.72,
                    }}
                  />
                ))}
                {mapVehicles.map((v) => {
                  const driver = drivers.find((d) => d.id === v.assignedDriverId)
                  const freshness = classifyTelemetryFreshness(
                    v.telemetry.lastUpdatedAt,
                    v.telemetry.connectionState,
                    nowTick,
                  )
                  const pinVariant = v.operationStatus === 'moving' ? 'lavender' : 'yellow'
                  return (
                    <Marker
                      key={v.id}
                      position={[v.telemetry.location.lat, v.telemetry.location.lng]}
                      icon={createDashboardPinIcon(
                        pinVariant,
                        v.telemetry.heading,
                        v.operationStatus === 'moving',
                        v.id === focusedMapVehicleId,
                      )}
                      eventHandlers={{
                        click: () => setFocusedMapVehicleId(v.id),
                      }}
                    >
                      <Popup>
                        <div className="space-y-1 text-xs min-w-[190px]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-[#625346] tabular-nums">{v.registrationNumber}</p>
                            <span className="text-[11px] font-semibold capitalize text-[#6E5696]">
                              {v.operationStatus}
                            </span>
                          </div>
                          <p className="text-[#958777]">{driver?.name ?? 'Unassigned'} · {v.cityName}</p>
                          <p className="text-[#625346] tabular-nums">
                            {v.telemetry.speedKmh} km/h · {v.powertrain === 'EV' ? 'SoC' : 'Fuel'} {v.fuelOrSocPct}% · {freshness.label}
                          </p>
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/map?vehicle=${v.id}`)}
                              className="text-xs font-semibold text-[#6E5696] hover:underline"
                            >
                              Track Live
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/dashboard/fleet/${v.id}`)}
                              className="text-xs font-semibold text-[#625346] hover:underline"
                            >
                              Digital Twin
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>

            {/* Quick Fleet Locator Strip */}
            <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center gap-2 overflow-x-auto scrollbar-custom">
              <span className="text-[11px] font-semibold text-[#958777] whitespace-nowrap shrink-0">
                Quick Focus:
              </span>
              {mapVehicles.map((v) => {
                const active = focusedMapVehicleId === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setFocusedMapVehicleId(v.id)
                      setMapFocusNonce((n) => n + 1)
                    }}
                    className={`px-2.5 py-1 rounded-[8px] text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors tabular-nums inline-flex items-center gap-1.5 ${
                      active
                        ? 'bg-[#E8C65A] border-[#D8B442] text-[#625346]'
                        : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7] hover:border-[#B8A3D9]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          v.operationStatus === 'moving'
                            ? '#789A75'
                            : v.operationStatus === 'offline'
                              ? '#D9786C'
                              : '#E8C65A',
                      }}
                    />
                    <span>{v.registrationNumber}</span>
                    <span className="text-[#958777] font-normal">· {v.cityName}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Live Telemetry Snapshot Table */}
          <div className="enterprise-card overflow-hidden">
            <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center justify-between gap-4">
              <div>
                <h2 className="dm-card-title">Live Operations Snapshot</h2>
                <p className="text-xs text-[#958777]">Real-time smartphone telemetry freshness per asset</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/fleet')}
                className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1"
              >
                All Assets
                <ArrowUpRight className="w-3.5 h-3.5" />
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
                      nowTick,
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
                            <span className="text-xs text-[#958777]">{v.make} {v.model}</span>
                          </button>
                        </td>
                        <td className="text-[#625346]">{driver?.name ?? 'Unassigned'}</td>
                        <td>
                          <span className="text-xs text-[#958777] block max-w-[200px] truncate">
                            {v.telemetry.cityLabel}
                          </span>
                        </td>
                        <td className="tabular-nums text-[#625346]">{v.telemetry.speedKmh} km/h</td>
                        <td>
                          <SeverityText severity={freshness.freshness} label={freshness.label} />
                        </td>
                        <td className="tabular-nums font-semibold text-[#625346]">{v.healthScore}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side Panel: Predictive Maintenance + Recent Alerts */}
        <div className="xl:col-span-4 space-y-6">
          {/* Predictive Maintenance Card */}
          <div className="enterprise-card p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E5E5]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-[10px] bg-[#EEE8F7] flex items-center justify-center shrink-0">
                  <Cpu className="w-4 h-4 text-[#6E5696]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#625346] leading-tight">
                    Predictive Maintenance
                  </h2>
                  <p className="text-xs text-[#958777] truncate">Software-only wear forecasting</p>
                </div>
              </div>
              {topPrediction && (
                <span className="px-2.5 py-1 rounded-full bg-[#E8C65A] border border-[#D8B442] text-[#625346] text-[11px] font-bold tabular-nums whitespace-nowrap shrink-0">
                  {Math.round(topPrediction.confidenceScore * 100)}% Confidence
                </span>
              )}
            </div>

            {topPrediction && topPredictionVehicle ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-[#625346]">
                    {topPredictionVehicle.registrationNumber} · {topPrediction.componentName}
                  </p>
                  <p className="text-xs text-[#958777] mt-0.5">
                    {topPrediction.predictedIssue} · {topPrediction.earliestWindowDays}–{topPrediction.latestWindowDays}d window
                  </p>
                </div>

                {/* Subtle Golden Yellow Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-[#958777]">Component Health Baseline</span>
                    <span className="font-semibold text-[#625346] tabular-nums">
                      {topPredictionVehicle.healthScore}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F0F0F0] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#E8C65A]"
                      style={{ width: `${Math.max(10, Math.min(100, topPredictionVehicle.healthScore))}%` }}
                    />
                  </div>
                </div>

                {/* Explainable AI Evidence Bullet List */}
                <div className="pt-2 border-t border-[#E5E5E5]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#625346] mb-2.5">
                    Explainable AI
                  </h3>
                  <ul className="space-y-2 text-xs text-[#625346] list-disc pl-4">
                    {(topPrediction.causalFactors.length > 0
                      ? topPrediction.causalFactors.slice(0, 4).map((cf) => ({
                          title: cf.label,
                          detail: cf.detail,
                        }))
                      : [
                          {
                            title: 'Odometer Utilization',
                            detail: `${topPredictionVehicle.odometerKm.toLocaleString('en-IN')} km cumulative duty cycle`,
                          },
                          {
                            title: 'Corridor Stress Index',
                            detail: topPrediction.evidenceSummary,
                          },
                        ]
                    ).map((item, idx) => (
                      <li key={`${item.title}-${idx}`} className="leading-relaxed">
                        <span className="font-semibold text-[#625346]">{item.title}:</span>{' '}
                        <span className="text-[#958777]">{item.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 flex items-center justify-between text-xs border-t border-[#E5E5E5]">
                  <span className="text-[#958777]">Delay Cost Exposure</span>
                  <span className="font-bold text-[#625346] tabular-nums">
                    {formatInr(topPrediction.delayCostInr)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/dashboard/maintenance')}
                  className="btn-accent w-full text-xs"
                >
                  Open Maintenance Intelligence
                </button>
              </div>
            ) : (
              <p className="text-xs text-[#958777] py-4">
                All fleet subsystems are operating within nominal service windows.
              </p>
            )}
          </div>

          {/* Recent Alerts List */}
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5]">
              <div>
                <h2 className="dm-card-title">Recent Alerts</h2>
                <p className="text-xs text-[#958777]">Real-time anomaly & risk feed</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/alerts')}
                className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1"
              >
                View All
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#E5E5E5] mt-1">
              {recentAlertsList.map((al) => {
                const pill = getAlertPillStyle(al.severity)
                return (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => navigate(al.actionRoute)}
                    className="w-full py-3.5 text-left hover:bg-[#FAFAFA] transition-colors rounded-lg px-1 -mx-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${pill.classes}`}
                      >
                        {pill.label}
                      </span>
                      <span className="text-[11px] text-[#958777] tabular-nums">
                        {formatDateTime(al.timestamp, activeOrganization.timezone)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#625346] mt-1.5 line-clamp-1">
                      {al.title}
                    </p>
                    <p className="text-xs text-[#958777] mt-0.5 line-clamp-2">{al.message}</p>
                  </button>
                )
              })}
              {recentAlertsList.length === 0 && (
                <p className="py-6 text-center text-xs text-[#958777]">
                  No operational alerts currently queued.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddVehicleDialog open={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </div>
  )
}
