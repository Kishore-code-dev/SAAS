import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  BatteryCharging,
  Pause,
  Play,
  Radio,
  Search,
  Signal,
  Truck,
  X,
} from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import { classifyTelemetryFreshness, isValidCoordinate } from '../utils/intelligenceEngine'
import { formatDateTime, SeverityText } from '../components/ui/EnterprisePrimitives'
import type { Vehicle, VehicleOperationStatus } from '../types/fleet'

function createVehicleMarkerIcon(status: VehicleOperationStatus, selected: boolean) {
  const color =
    status === 'moving'
      ? '#789A75'
      : status === 'idle' || status === 'delayed'
        ? '#E8C65A'
        : status === 'offline'
          ? '#D9786C'
          : '#B8A3D9'

  return L.divIcon({
    className: 'dm-vehicle-pin',
    html: `<div style="width:${selected ? 34 : 26}px;height:${selected ? 34 : 26}px;border-radius:9999px;background:${color};border:3px solid #FBF6E6;box-shadow:0 2px 8px rgba(98,83,70,0.28);display:flex;align-items:center;justify-content:center;color:#625346;font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:700;">●</div>`,
    iconSize: [selected ? 34 : 26, selected ? 34 : 26],
    iconAnchor: [selected ? 17 : 13, selected ? 17 : 13],
  })
}

function createClusterIcon(count: number) {
  return L.divIcon({
    className: 'dm-cluster-pin',
    html: `<div style="width:36px;height:36px;border-radius:9999px;background:#EEE8F7;color:#625346;border:2.5px solid #B8A3D9;box-shadow:0 3px 10px rgba(98,83,70,0.25);display:flex;align-items:center;justify-content:center;font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;">${count}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

function MapController({
  selectedVehicle,
  onZoomChange,
}: {
  selectedVehicle: Vehicle | null
  onZoomChange: (zoom: number) => void
}) {
  const map = useMap()

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom())
    },
  })

  useEffect(() => {
    if (
      selectedVehicle &&
      isValidCoordinate(selectedVehicle.telemetry.location.lat, selectedVehicle.telemetry.location.lng)
    ) {
      map.flyTo([selectedVehicle.telemetry.location.lat, selectedVehicle.telemetry.location.lng], 12, {
        duration: 0.6,
      })
    }
  }, [selectedVehicle, map])

  return null
}

type FilterOption = 'all' | 'moving' | 'idle' | 'stopped' | 'offline' | 'delayed'

export default function LiveMap() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    activeOrganization,
    vehicles,
    drivers,
    trips,
    simulationActive,
    toggleSimulation,
    searchTerm,
    setSearchTerm,
  } = useFleet()

  const initialFilter = (searchParams.get('filter') as FilterOption) || 'all'
  const [statusFilter, setStatusFilter] = useState<FilterOption>(
    ['all', 'moving', 'idle', 'stopped', 'offline', 'delayed'].includes(initialFilter) ? initialFilter : 'all',
  )
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(vehicles[0]?.id ?? null)
  const [zoomLevel, setZoomLevel] = useState<number>(7)
  const [showRoutes, setShowRoutes] = useState<boolean>(true)

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return vehicles.filter((v) => {
      const freshness = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState)
      const matchesStatus =
        statusFilter === 'all' ||
        v.operationStatus === statusFilter ||
        (statusFilter === 'offline' && freshness.freshness === 'offline')
      const driver = drivers.find((d) => d.id === v.assignedDriverId)
      const matchesSearch =
        !q ||
        v.registrationNumber.toLowerCase().includes(q) ||
        v.cityName.toLowerCase().includes(q) ||
        (driver?.name.toLowerCase().includes(q) ?? false)
      return matchesStatus && matchesSearch
    })
  }, [vehicles, drivers, statusFilter, searchTerm])

  const mappableVehicles = useMemo(
    () => filteredVehicles.filter((v) => isValidCoordinate(v.telemetry.location.lat, v.telemetry.location.lng)),
    [filteredVehicles],
  )

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  )

  const activeRoutes = useMemo(
    () =>
      trips.filter(
        (t) =>
          (t.status === 'active' || t.status === 'delayed') &&
          mappableVehicles.some((v) => v.id === t.vehicleId) &&
          t.route.filter((pt) => isValidCoordinate(pt.lat, pt.lng)).length >= 2,
      ),
    [trips, mappableVehicles],
  )

  // Deterministic grid clustering when zoomed out (zoom <= 7)
  const clusteredEntries = useMemo(() => {
    if (zoomLevel >= 8 || mappableVehicles.length <= 3) {
      return mappableVehicles.map((v) => ({
        type: 'single' as const,
        vehicle: v,
        lat: v.telemetry.location.lat,
        lng: v.telemetry.location.lng,
      }))
    }
    const cellSize = 0.7
    const buckets = new Map<string, Vehicle[]>()
    for (const v of mappableVehicles) {
      const gx = Math.round(v.telemetry.location.lat / cellSize)
      const gy = Math.round(v.telemetry.location.lng / cellSize)
      const key = `${gx}:${gy}`
      const arr = buckets.get(key) ?? []
      arr.push(v)
      buckets.set(key, arr)
    }
    const result: Array<
      | { type: 'single'; vehicle: Vehicle; lat: number; lng: number }
      | { type: 'cluster'; key: string; vehicles: Vehicle[]; lat: number; lng: number }
    > = []
    buckets.forEach((group, key) => {
      if (group.length === 1) {
        result.push({
          type: 'single',
          vehicle: group[0],
          lat: group[0].telemetry.location.lat,
          lng: group[0].telemetry.location.lng,
        })
      } else {
        const avgLat = group.reduce((s, x) => s + x.telemetry.location.lat, 0) / group.length
        const avgLng = group.reduce((s, x) => s + x.telemetry.location.lng, 0) / group.length
        result.push({ type: 'cluster', key, vehicles: group, lat: avgLat, lng: avgLng })
      }
    })
    return result
  }, [mappableVehicles, zoomLevel])

  const mapCenter: [number, number] = useMemo(() => {
    if (mappableVehicles.length > 0) {
      return [mappableVehicles[0].telemetry.location.lat, mappableVehicles[0].telemetry.location.lng]
    }
    return [11.9416, 78.8072]
  }, [mappableVehicles])

  const selectedDriver = selectedVehicle
    ? drivers.find((d) => d.id === selectedVehicle.assignedDriverId)
    : undefined
  const selectedTrip = selectedVehicle
    ? trips.find((t) => t.vehicleId === selectedVehicle.id && (t.status === 'active' || t.status === 'delayed'))
    : undefined
  const selectedFreshness = selectedVehicle
    ? classifyTelemetryFreshness(selectedVehicle.telemetry.lastUpdatedAt, selectedVehicle.telemetry.connectionState)
    : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Live Operations Map</h1>
          <p className="text-sm text-[#7D6D5F] mt-1">
            {activeOrganization.name} · Clustered corridor view with telemetry freshness indicators
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowRoutes((r) => !r)}
            className="btn-secondary text-xs px-3 py-2"
          >
            {showRoutes ? 'Hide Route Polylines' : 'Show Route Polylines'}
          </button>
          <button
            type="button"
            onClick={toggleSimulation}
            className="btn-secondary text-xs px-3 py-2"
          >
            {simulationActive ? <Pause className="w-3.5 h-3.5 text-[#6E5696]" /> : <Play className="w-3.5 h-3.5 text-[#4D6E4A]" />}
            {simulationActive ? 'Pause Demo Stream' : 'Resume Demo Stream'}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="enterprise-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#D4C7E6]">
          {(['all', 'moving', 'idle', 'stopped', 'delayed', 'offline'] as FilterOption[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setStatusFilter(opt)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
                statusFilter === opt ? 'bg-[#FBF6E6] text-[#625346] shadow-subtle border border-[#D4C7E6]' : 'text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#7D6D5F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter registration, city, driver..."
            aria-label="Filter map vehicles"
            className="dm-input pl-9 py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Map + Detail Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 enterprise-card overflow-hidden relative min-h-[480px] h-[560px]">
          <MapContainer center={mapCenter} zoom={7} className="w-full h-full z-10">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapController selectedVehicle={selectedVehicle} onZoomChange={setZoomLevel} />

            {showRoutes &&
              activeRoutes.map((trip) => (
                <Polyline
                  key={trip.id}
                  positions={trip.route
                    .filter((pt) => isValidCoordinate(pt.lat, pt.lng))
                    .map((pt) => [pt.lat, pt.lng] as [number, number])}
                  pathOptions={{
                    color: trip.status === 'delayed' ? '#C9A63B' : '#6E5696',
                    weight: 4,
                    opacity: 0.85,
                  }}
                />
              ))}

            {clusteredEntries.map((entry) =>
              entry.type === 'cluster' ? (
                <Marker
                  key={entry.key}
                  position={[entry.lat, entry.lng]}
                  icon={createClusterIcon(entry.vehicles.length)}
                  eventHandlers={{
                    click: () => setSelectedVehicleId(entry.vehicles[0].id),
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#625346]">{entry.vehicles.length} Vehicles in Cluster</p>
                      {entry.vehicles.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVehicleId(v.id)}
                          className="block text-[#6E5696] hover:text-[#625346] hover:underline font-semibold"
                        >
                          {v.registrationNumber} ({v.operationStatus})
                        </button>
                      ))}
                    </div>
                  </Popup>
                </Marker>
              ) : (
                <Marker
                  key={entry.vehicle.id}
                  position={[entry.lat, entry.lng]}
                  icon={createVehicleMarkerIcon(
                    entry.vehicle.operationStatus,
                    entry.vehicle.id === selectedVehicleId,
                  )}
                  eventHandlers={{
                    click: () => setSelectedVehicleId(entry.vehicle.id),
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#625346]">{entry.vehicle.registrationNumber}</p>
                      <p className="text-[#7D6D5F]">{entry.vehicle.telemetry.cityLabel}</p>
                      <p className="tabular-nums font-medium text-[#625346]">Speed: {entry.vehicle.telemetry.speedKmh} km/h</p>
                    </div>
                  </Popup>
                </Marker>
              ),
            )}
          </MapContainer>

          {mappableVehicles.length === 0 && (
            <div className="absolute inset-x-6 bottom-6 z-20 bg-[#FBF6E6]/95 border border-[#D4C7E6] rounded-xl p-4 shadow-elevated text-center">
              <p className="text-sm font-bold text-[#625346]">No matching vehicles with valid GPS coordinates</p>
              <p className="text-xs text-[#7D6D5F] mt-1">
                Clear active status/search filters or verify smartphone GPS permissions on driver devices.
              </p>
            </div>
          )}
        </div>

        {/* Right Vehicle Detail Drawer / List */}
        <div className="lg:col-span-4 enterprise-card p-5 flex flex-col justify-between">
          {selectedVehicle && selectedFreshness ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E0D4B7]">
                <div>
                  <p className="font-bold text-lg text-[#625346] tabular-nums">
                    {selectedVehicle.registrationNumber}
                  </p>
                  <p className="text-xs text-[#7D6D5F]">
                    {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.powertrain}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVehicleId(null)}
                  aria-label="Clear selected vehicle"
                  className="p-1 rounded-lg text-[#7D6D5F] hover:text-[#625346] hover:bg-[#EEE8F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <SeverityText severity={selectedFreshness.freshness} label={selectedFreshness.label} />
                <span className="text-xs font-medium text-[#7D6D5F] capitalize">
                  Status: {selectedVehicle.operationStatus}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-3">
                  <span className="text-[#7D6D5F] block">Assigned Driver</span>
                  <span className="font-semibold text-[#625346] mt-0.5 block">
                    {selectedDriver?.name ?? 'Unassigned'}
                  </span>
                </div>
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-3">
                  <span className="text-[#7D6D5F] block">Current Speed</span>
                  <span className="font-bold text-[#625346] tabular-nums mt-0.5 block">
                    {selectedVehicle.telemetry.speedKmh} km/h
                  </span>
                </div>
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-3">
                  <span className="text-[#7D6D5F] block">Active Trip Duration</span>
                  <span className="font-semibold text-[#625346] tabular-nums mt-0.5 block">
                    {selectedTrip ? `${selectedTrip.durationMinutes} min` : 'No active trip'}
                  </span>
                </div>
                <div className="bg-[#FBF6E6] border border-[#E0D4B7] rounded-[10px] p-3">
                  <span className="text-[#7D6D5F] block">GPS Accuracy</span>
                  <span className="font-semibold text-[#625346] tabular-nums mt-0.5 block">
                    ±{selectedVehicle.telemetry.gpsAccuracyMeters} m
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-[#E0D4B7]">
                <div className="flex items-center justify-between">
                  <span className="text-[#7D6D5F] inline-flex items-center gap-1.5">
                    <Signal className="w-3.5 h-3.5" /> Signal Quality
                  </span>
                  <span className="font-semibold text-[#625346] tabular-nums">
                    {selectedVehicle.telemetry.signalQualityPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7D6D5F] inline-flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" /> Connection State
                  </span>
                  <span className="font-semibold text-[#625346] capitalize">
                    {selectedVehicle.telemetry.connectionState}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7D6D5F] inline-flex items-center gap-1.5">
                    <BatteryCharging className="w-3.5 h-3.5" /> Driver Phone Battery
                  </span>
                  <span className="font-semibold text-[#625346] tabular-nums">
                    {selectedVehicle.telemetry.batteryLevelPct ?? '—'}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7D6D5F]">Last Telemetry Update</span>
                  <span className="text-[#625346] tabular-nums">
                    {formatDateTime(selectedVehicle.telemetry.lastUpdatedAt, activeOrganization.timezone)}
                  </span>
                </div>
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/fleet/${selectedVehicle.id}`)}
                  className="btn-accent flex-1 text-xs"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Open Digital Twin
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-[#7D6D5F]">
              Select a vehicle marker or list row to inspect telemetry freshness and route status.
            </div>
          )}

          {/* Compact Vehicle Switcher List */}
          <div className="mt-5 pt-4 border-t border-[#E0D4B7]">
            <p className="text-xs font-semibold text-[#7D6D5F] mb-2">
              Visible Fleet ({filteredVehicles.length})
            </p>
            <div className="max-h-40 overflow-y-auto scrollbar-custom divide-y divide-[#E0D4B7]/70">
              {filteredVehicles.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(v.id)}
                  className={`w-full py-2 px-2.5 text-left flex items-center justify-between text-xs rounded-[8px] hover:bg-[#EEE8F7] transition-colors ${
                    v.id === selectedVehicleId ? 'bg-[#E8C65A]/45 font-semibold text-[#625346]' : 'text-[#625346]'
                  }`}
                >
                  <span className="tabular-nums">{v.registrationNumber}</span>
                  <span className="text-[#7D6D5F] capitalize">{v.operationStatus}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
