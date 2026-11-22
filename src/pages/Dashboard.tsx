import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Activity,
  ArrowUpRight,
  ClipboardCheck,
  Download,
  FileBarChart2,
  Fuel,
  IndianRupee,
  Layers,
  Maximize2,
  Navigation,
  Plus,
  RefreshCw,
  Satellite,
  Smartphone,
  Wrench,
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
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import {
  classifyTelemetryFreshness,
  generateCsvContent,
  isValidCoordinate,
} from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  formatDateTime,
  formatInr,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import { computeFleetBounds, summarizeFleetTrackingStatuses } from '../utils/fleetTracking'
import type { Vehicle } from '../types/fleet'

function createDashboardPinIcon(
  variant: 'lavender' | 'yellow',
  heading = 0,
  moving = false,
  highlighted = false,
) {
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

const REFRESH_STATUS_LABEL: Record<string, { text: string; classes: string }> = {
  idle: { text: 'Telemetry Synchronized', classes: 'bg-[#F5F5F7] text-[#625346] border-[#E5E5E5]' },
  refreshing: { text: 'Refreshing Intelligence…', classes: 'bg-[#EEE8F7] text-[#6E5696] border-[#DDD3ED]' },
  updated: { text: 'Updated', classes: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#B8D0B5]' },
  partially_updated: { text: 'Partially Updated', classes: 'bg-[#FDF3E7] text-[#8F6510] border-[#E8C290]' },
  no_new_data: { text: 'Up to Date', classes: 'bg-[#F5F5F7] text-[#625346] border-[#E5E5E5]' },
  failed: { text: 'Refresh Failed', classes: 'bg-[#FCECEB] text-[#A24034] border-[#E7A8A0]' },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    vehicles,
    drivers,
    trips,
    fuelTransactions,
    maintenanceRecords,
    workOrders,
    financialSummary,
    reportingPeriod,
    searchTerm,
    refreshStatus,
    lastRefreshedAt,
    refreshIntelligence,
    nowTick,
  } = useFleet()

  const [focusedMapVehicleId, setFocusedMapVehicleId] = useState<string | null>(null)
  const [mapFitNonce, setMapFitNonce] = useState(0)
  const [mapFocusNonce, setMapFocusNonce] = useState(0)
  const [mapLayer, setMapLayer] = useState<'satellite' | 'street'>('satellite')

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

  const freshnessSummary = useMemo(() => {
    const counts = { live: 0, delayed: 0, stale: 0, offline: 0 }
    for (const v of vehicles) {
      const state = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState, nowTick)
      counts[state.freshness] += 1
    }
    return counts
  }, [vehicles, nowTick])

  const openWorkOrdersCount = useMemo(
    () => workOrders.filter((w) => w.status !== 'completed' && w.status !== 'closed').length,
    [workOrders],
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

  // Operating Cost Trajectory across active ReportingPeriod buckets
  const performanceTrajectoryData = useMemo(() => {
    const allTs = [
      ...trips.map((t) => new Date(t.startTime).getTime()),
      ...fuelTransactions.map((f) => new Date(f.timestamp).getTime()),
      ...maintenanceRecords.map((m) => new Date(m.performedAt).getTime()),
    ].filter((ms) => Number.isFinite(ms))
    const anchorMs = allTs.length > 0 ? Math.max(...allTs) : nowTick
    const bucketDays = reportingPeriod === '7d' ? 2 : reportingPeriod === '90d' ? 21 : 7
    const bucketMs = bucketDays * 86400000

    return [3, 2, 1, 0].map((offset) => {
      const wStart = anchorMs - (offset + 1) * bucketMs
      const wEnd = offset === 0 ? anchorMs + 30 * 86400000 : anchorMs - offset * bucketMs
      const label = offset === 0 ? 'Current' : `P-${offset}`

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

      const estBucketKm =
        tripDistanceKm > 0
          ? tripDistanceKm
          : Math.max(1, vehicles.reduce((s, v) => s + v.dailyAvgKm * bucketDays, 0))

      const fuelCostPerKm =
        offset === 0 && financialSummary.totalDistanceKm > 0
          ? Number((financialSummary.fuelExpenditureInr / financialSummary.totalDistanceKm).toFixed(2))
          : Number((fuelSum / estBucketKm).toFixed(2))

      const totalCostPerKm =
        offset === 0
          ? financialSummary.costPerKmInr
          : Number(((fuelSum + maintSum) / estBucketKm).toFixed(2))

      return {
        period: label,
        fuelCostPerKm,
        totalCostPerKm,
      }
    })
  }, [trips, fuelTransactions, maintenanceRecords, vehicles, financialSummary, reportingPeriod, nowTick])

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

  const mapFleetSignature = useMemo(
    () => `${activeOrganization.id}:${mapVehicles.map((v) => v.id).join(',')}`,
    [activeOrganization.id, mapVehicles],
  )

  const focusedMapVehicle = useMemo(
    () =>
      mapVehicles.find((v) => v.id === focusedMapVehicleId) ??
      mapVehicles[0] ??
      null,
    [mapVehicles, focusedMapVehicleId],
  )

  const focusedDriver = useMemo(
    () => (focusedMapVehicle ? drivers.find((d) => d.id === focusedMapVehicle.assignedDriverId) ?? null : null),
    [focusedMapVehicle, drivers],
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

  const handleQuickExportCsv = () => {
    const csv = generateCsvContent(
      ['Registration', 'Make & Model', 'Corridor', 'Status', 'Odometer (km)', 'Health Score (%)', 'Assigned Driver'],
      filteredVehicles.map((v) => {
        const drv = drivers.find((d) => d.id === v.assignedDriverId)
        return [
          v.registrationNumber,
          `${v.make} ${v.model}`,
          v.cityName,
          v.operationStatus,
          v.odometerKm,
          v.healthScore,
          drv?.name ?? 'Unassigned',
        ]
      }),
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `drivemitra-fleet-snapshot-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Exported fleet command snapshot CSV.')
  }

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6 bg-[#FFFFFF]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="dm-page-title">Fleet Command Centre</h1>
            <p className="text-sm text-[#958777] mt-0.5">
              {activeOrganization.name} · Owner Operations Workspace
            </p>
          </div>
          {canRegisterVehicle && (
            <button type="button" onClick={() => navigate('/dashboard/fleet/new')} className="btn-primary">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          )}
        </div>

        <EmptySectionState
          title="No vehicles registered in this organization yet"
          description="Production workspaces start isolated with zero sample records. Register your first commercial vehicle to activate telemetry, compliance tracking, and ERP operations."
          actionLabel={canRegisterVehicle ? 'Add Vehicle' : undefined}
          onAction={canRegisterVehicle ? () => navigate('/dashboard/fleet/new') : undefined}
        />
      </div>
    )
  }

  const refreshBadge = REFRESH_STATUS_LABEL[refreshStatus] ?? REFRESH_STATUS_LABEL.idle

  const kpiCards = [
    {
      label: 'Total Active Fleet',
      value: String(vehicles.length),
      subtext: `${vehicles.filter((v) => v.powertrain === 'EV').length} EV · ${vehicles.filter((v) => v.powertrain === 'ICE').length} ICE`,
      icon: Layers,
      to: '/dashboard/fleet',
    },
    {
      label: 'Live & Delayed Telemetry',
      value: String(freshnessSummary.live + freshnessSummary.delayed),
      subtext: `${freshnessSummary.stale} stale · ${freshnessSummary.offline} offline`,
      icon: Smartphone,
      to: '/dashboard/map',
    },
    {
      label: 'Open Work Orders',
      value: String(openWorkOrdersCount),
      subtext: `${maintenanceRecords.filter((m) => m.status === 'scheduled').length} scheduled service jobs`,
      icon: Wrench,
      to: '/dashboard/work-orders',
    },
    {
      label: 'Avg ICE Fuel Efficiency',
      value: avgFuelEfficiency !== null ? `${avgFuelEfficiency} km/L` : '—',
      subtext: 'Verified fuel & charging ledger',
      icon: Fuel,
      to: '/dashboard/fuel',
    },
  ]

  return (
    <div className="space-y-8 bg-[#FFFFFF]">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="dm-page-title">Fleet Command Centre</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${refreshBadge.classes}`}
            >
              <RefreshCw className={`w-3 h-3 ${refreshStatus === 'refreshing' ? 'animate-spin' : ''}`} />
              {refreshBadge.text}
            </span>
          </div>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Last refreshed {formatDateTime(lastRefreshedAt, activeOrganization.timezone)} · {activeOrganization.timezone}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canRegisterVehicle && (
            <button type="button" onClick={() => navigate('/dashboard/fleet/new')} className="btn-primary text-xs px-3.5 py-2">
              <Plus className="w-4 h-4" />
              Add Vehicle
            </button>
          )}
          <button
            type="button"
            disabled={refreshStatus === 'refreshing'}
            onClick={() => void refreshIntelligence()}
            className="btn-accent text-xs px-3.5 py-2 disabled:opacity-60"
          >
            <Activity className="w-4 h-4 text-[#6E5696]" />
            Refresh Intelligence
          </button>
        </div>
      </div>

      {/* 4 Command Centre KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => navigate(kpi.to)}
              className="bg-[#FFFFFF] border border-[#E5E5E5] border-l-2 border-l-[#E8C65A] rounded-xl shadow-card p-5 text-left hover:border-[#B8A3D9] hover:border-l-[#E8C65A] transition-all flex flex-col justify-between"
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

      {/* SECTION 1: FLEET MONITORING */}
      <section aria-labelledby="section-fleet-monitoring" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="section-fleet-monitoring" className="dm-section-title">
              Fleet Monitoring
            </h2>
            <p className="text-xs text-[#958777]">
              Telemetry freshness ({freshnessSummary.live} Live · {freshnessSummary.delayed} Delayed · {freshnessSummary.stale} Stale · {freshnessSummary.offline} Offline) & interactive satellite tracking
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard/map')}
            className="btn-accent text-xs px-3 py-1.5"
          >
            <Navigation className="w-3.5 h-3.5 text-[#6E5696]" />
            Open Full Live Map
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Interactive Fleet Map */}
          <div className="xl:col-span-8 enterprise-card overflow-hidden">
            <div className="px-5 py-3.5 bg-[#FFFFFF] border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#625346]">
                  Live Corridor Map · Tracking {mapVehicles.length}/{vehicles.length} vehicles
                </p>
                <p className="text-xs text-[#958777] tabular-nums">
                  {mapStatusCounts.moving} Moving · {mapStatusCounts.idle + mapStatusCounts.stopped} Standby · {mapStatusCounts.delayed} Delayed · {mapStatusCounts.offline} Offline
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMapLayer((l) => (l === 'satellite' ? 'street' : 'satellite'))}
                  className="btn-secondary text-xs px-2.5 py-1.5"
                >
                  <Satellite className="w-3.5 h-3.5 text-[#6E5696]" />
                  {mapLayer === 'satellite' ? 'Satellite View' : 'Street Map'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFocusedMapVehicleId(null)
                    setMapFitNonce((n) => n + 1)
                  }}
                  className="btn-secondary text-xs px-2.5 py-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-[#6E5696]" />
                  Fit All ({mapVehicles.length})
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
                {mapLayer === 'satellite' ? (
                  <TileLayer
                    attribution="Tiles &copy; Esri"
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  />
                ) : (
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                )}
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
                      color: trip.status === 'delayed' ? '#E8C65A' : '#B8A3D9',
                      weight: 3.5,
                      opacity: 0.85,
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
                        v.id === focusedMapVehicle?.id,
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
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/fleet/vehicles/${v.id}`)}
                            className="text-xs font-semibold text-[#6E5696] hover:underline pt-1"
                          >
                            Open Vehicle Master →
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>

            {/* Quick Focus Vehicle Strip */}
            <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center gap-2 overflow-x-auto scrollbar-custom">
              <span className="text-[11px] font-semibold text-[#958777] whitespace-nowrap shrink-0">
                Quick Focus:
              </span>
              {mapVehicles.map((v) => {
                const active = focusedMapVehicle?.id === v.id
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
                    <span>{v.registrationNumber}</span>
                    <span className="text-[#958777] font-normal">· {v.cityName}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Vehicle Telemetry & Quick Dispatch Summary Card */}
          <div className="xl:col-span-4 enterprise-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <div>
                <h3 className="dm-card-title text-sm">Selected Vehicle Telemetry</h3>
                <p className="text-xs text-[#958777]">Click any map marker or focus chip</p>
              </div>
              {focusedMapVehicle && (
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/fleet/vehicles/${focusedMapVehicle.id}`)}
                  className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1"
                >
                  Open Twin
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {focusedMapVehicle ? (
              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-[#625346] tabular-nums">
                      {focusedMapVehicle.registrationNumber}
                    </p>
                    <p className="text-[#958777]">
                      {focusedMapVehicle.make} {focusedMapVehicle.model} · {focusedMapVehicle.powertrain}
                    </p>
                  </div>
                  <SeverityText
                    severity={
                      classifyTelemetryFreshness(
                        focusedMapVehicle.telemetry.lastUpdatedAt,
                        focusedMapVehicle.telemetry.connectionState,
                        nowTick,
                      ).freshness
                    }
                    label={
                      classifyTelemetryFreshness(
                        focusedMapVehicle.telemetry.lastUpdatedAt,
                        focusedMapVehicle.telemetry.connectionState,
                        nowTick,
                      ).label
                    }
                  />
                </div>

                <dl className="grid grid-cols-2 gap-3 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3">
                  <div>
                    <dt className="text-[#958777]">Assigned Driver</dt>
                    <dd className="font-semibold text-[#625346] mt-0.5 truncate">
                      {focusedDriver?.name ?? 'Unassigned'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#958777]">Corridor</dt>
                    <dd className="font-semibold text-[#625346] mt-0.5 truncate">
                      {focusedMapVehicle.telemetry.cityLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#958777]">Live Speed</dt>
                    <dd className="font-bold text-[#625346] tabular-nums mt-0.5">
                      {focusedMapVehicle.telemetry.speedKmh} km/h
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#958777]">Composite Health</dt>
                    <dd className="font-bold text-[#625346] tabular-nums mt-0.5">
                      {focusedMapVehicle.healthScore}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#958777]">Odometer</dt>
                    <dd className="font-semibold text-[#625346] tabular-nums mt-0.5">
                      {focusedMapVehicle.odometerKm.toLocaleString('en-IN')} km
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#958777]">
                      {focusedMapVehicle.powertrain === 'EV' ? 'Battery SoC' : 'Fuel Level'}
                    </dt>
                    <dd className="font-semibold text-[#625346] tabular-nums mt-0.5">
                      {focusedMapVehicle.fuelOrSocPct}%
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard/fleet/vehicles/${focusedMapVehicle.id}`)}
                    className="btn-primary flex-1 text-xs py-2"
                  >
                    Vehicle Digital Twin
                  </button>
                  {focusedDriver && (
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/drivers/${focusedDriver.id}`)}
                      className="btn-secondary flex-1 text-xs py-2"
                    >
                      Driver Master
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#958777] py-4">Select a vehicle to inspect telemetry details.</p>
            )}
          </div>
        </div>

        {/* Live Operations Snapshot Table */}
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-3.5 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center justify-between gap-4">
            <div>
              <h3 className="dm-card-title text-sm">Live Operations Snapshot</h3>
              <p className="text-xs text-[#958777]">Real-time telemetry freshness and asset assignment</p>
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
                  <th>Assigned Driver</th>
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
                          onClick={() => navigate(`/dashboard/fleet/vehicles/${v.id}`)}
                          className="text-left hover:underline"
                        >
                          <span className="font-semibold text-[#625346] block tabular-nums">
                            {v.registrationNumber}
                          </span>
                          <span className="text-xs text-[#958777]">{v.make} {v.model}</span>
                        </button>
                      </td>
                      <td className="text-[#625346]">
                        {driver ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/dashboard/drivers/${driver.id}`)}
                            className="hover:underline text-left font-medium"
                          >
                            {driver.name}
                          </button>
                        ) : (
                          'Unassigned'
                        )}
                      </td>
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
      </section>

      {/* SECTION 2: FLEET PERFORMANCE */}
      <section aria-labelledby="section-fleet-performance" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="section-fleet-performance" className="dm-section-title">
              Fleet Performance
            </h2>
            <p className="text-xs text-[#958777]">
              Utilization split and operating spend trajectory
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Donut Chart: Fleet Utilization */}
          <div className="lg:col-span-5 enterprise-card p-5 flex flex-col justify-between">
            <div>
              <h3 className="dm-card-title">Fleet Utilization</h3>
              <p className="text-xs text-[#958777] mt-0.5">
                Active trip allocation ({vehicles.length} commercial units)
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

          {/* Operating Cost Trajectory */}
          <div className="lg:col-span-7 enterprise-card p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="dm-card-title">Operating Cost Trajectory ({reportingPeriod.toUpperCase()})</h3>
                <p className="text-xs text-[#958777] mt-0.5">
                  Cost per km (₹/km) from verified fuel receipts, maintenance, and completed work orders
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/dashboard/financials')}
                className="text-xs font-semibold text-[#6E5696] hover:underline inline-flex items-center gap-1 shrink-0"
              >
                Ledger Details
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="h-52 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceTrajectoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                  <XAxis dataKey="period" tick={{ fill: '#958777', fontSize: 12 }} axisLine={false} tickLine={false} />
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
                <span className="text-[#958777] block">Operating Spend ({reportingPeriod.toUpperCase()})</span>
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
                <span className="text-[#958777] block">Distance Logged</span>
                <span className="text-sm font-bold text-[#625346] tabular-nums">
                  {financialSummary.totalDistanceKm.toLocaleString('en-IN')} km
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: ANALYSIS & REPORTS */}
      <section aria-labelledby="section-analysis-reports" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="section-analysis-reports" className="dm-section-title">
              Analysis & Reports
            </h2>
            <p className="text-xs text-[#958777]">
              Direct owner access to 5-Area Health, Work Orders, Financial Ledgers, and Exportable Audits
            </p>
          </div>
          <button type="button" onClick={handleQuickExportCsv} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5 text-[#6E5696]" />
            Export Fleet CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: '5-Area Health Intelligence',
              desc: 'Fuel, Engine, Tyre, Driver (safety/compliance), and Vehicle diagnostics.',
              icon: ClipboardCheck,
              to: '/dashboard/maintenance',
            },
            {
              title: 'Work Orders & Issues',
              desc: 'Track workshop jobs, spare parts consumption, and issue escalations.',
              icon: Wrench,
              to: '/dashboard/work-orders',
            },
            {
              title: 'Financial Ledger & Bills',
              desc: 'Separate Recorded, Verified, and Paid invoices without double-counting.',
              icon: IndianRupee,
              to: '/dashboard/financials',
            },
            {
              title: 'Enterprise Reports Center',
              desc: 'Download CSV, Print-PDF, and XLSX operational compliance bundles.',
              icon: FileBarChart2,
              to: '/dashboard/reports',
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.to)}
                className="enterprise-card p-5 text-left hover:border-[#B8A3D9] transition-colors flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-[10px] bg-[#EEE8F7] flex items-center justify-center">
                    <Icon className="w-4 h-4 text-[#6E5696]" />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-[#958777]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#625346]">{item.title}</h3>
                  <p className="text-xs text-[#958777] mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
      </section>

    </div>
  )
}
