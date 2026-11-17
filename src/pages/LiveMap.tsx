import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  MapStyleToggle,
  SatelliteTileLayers,
  type MapBaseStyle,
} from '../components/map/SatelliteTileLayers'
import {
  BatteryCharging,
  Clock,
  Compass,
  Crosshair,
  Fuel,
  Layers,
  MapPin,
  Maximize2,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Signal,
  Tag,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import {
  classifyTelemetryFreshness,
  isValidCoordinate,
  isWithinIndiaCorridorBounds,
} from '../utils/intelligenceEngine'
import {
  computeFleetBounds,
  DEFAULT_GEOFENCE_ZONES,
  estimateTripProgress,
  findActiveGeofenceForLocation,
  GeofenceZone,
  interpolateRoutePoint,
  summarizeFleetTrackingStatuses,
} from '../utils/fleetTracking'
import {
  EnterpriseModal,
  formatDateTime,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'
import type { Vehicle, VehicleOperationStatus } from '../types/fleet'

const CUSTOM_GEOFENCE_PREFIX = 'dm_geofences_v1_'

function loadCustomGeofences(orgId: string): GeofenceZone[] {
  try {
    const raw = localStorage.getItem(`${CUSTOM_GEOFENCE_PREFIX}${orgId}`)
    return raw ? (JSON.parse(raw) as GeofenceZone[]) : []
  } catch {
    return []
  }
}

function saveCustomGeofences(orgId: string, zones: GeofenceZone[]) {
  try {
    localStorage.setItem(`${CUSTOM_GEOFENCE_PREFIX}${orgId}`, JSON.stringify(zones))
  } catch {
    // Ignore storage quota errors
  }
}

function getStatusPinPalette(status: VehicleOperationStatus) {
  if (status === 'moving') {
    return { bg: '#789A75', fg: '#FFFFFF', ring: '#4D6E4A' }
  }
  if (status === 'idle' || status === 'delayed') {
    return { bg: '#E8C65A', fg: '#625346', ring: '#A56021' }
  }
  if (status === 'offline') {
    return { bg: '#D9786C', fg: '#FFFFFF', ring: '#B84E42' }
  }
  return { bg: '#B8A3D9', fg: '#FFFFFF', ring: '#6E5696' }
}

function createVehicleMarkerIcon(
  vehicle: Vehicle,
  selected: boolean,
  showLabel: boolean,
  labelPlacement: 'below' | 'above' = 'below',
) {
  const palette = getStatusPinPalette(vehicle.operationStatus)
  const size = selected ? 34 : 26
  const isMoving = vehicle.operationStatus === 'moving'
  const innerSvg = isMoving
    ? `<svg width="13" height="13" viewBox="0 0 24 24" style="transform:rotate(${vehicle.telemetry.heading}deg);" fill="${palette.fg}" aria-hidden="true"><path d="M12 2L19 20L12 16L5 20L12 2Z"/></svg>`
    : `<span style="width:7px;height:7px;border-radius:9999px;background:${palette.fg};display:block;"></span>`

  const posStyle = labelPlacement === 'above' ? `bottom:${size + 4}px;` : `top:${size + 4}px;`
  const labelHtml = showLabel
    ? `<div style="position:absolute;${posStyle}left:50%;transform:translateX(-50%);background:#FFFFFF;color:#625346;border:1px solid ${selected ? '#6E5696' : '#E5E5E5'};border-radius:6px;padding:1px 6px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(98,83,70,0.16);font-family:'Plus Jakarta Sans',sans-serif;font-variant-numeric:tabular-nums;">${vehicle.registrationNumber}${isMoving ? ` · ${vehicle.telemetry.speedKmh} km/h` : ''}</div>`
    : ''

  return L.divIcon({
    className: 'dm-vehicle-pin',
    html: `<div style="position:relative;width:${size}px;height:${size}px;"><div style="width:${size}px;height:${size}px;border-radius:9999px;background:${palette.bg};border:2.5px solid #FFFFFF;box-shadow:${selected ? '0 0 0 3px rgba(110,86,150,0.42), ' : ''}0 2px 8px rgba(98,83,70,0.28);display:flex;align-items:center;justify-content:center;">${innerSvg}</div>${labelHtml}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function createPlaybackIcon(headingDeg: number) {
  return L.divIcon({
    className: 'dm-playback-pin',
    html: `<div style="width:28px;height:28px;border-radius:9999px;background:#E8C65A;border:3px solid #625346;box-shadow:0 3px 10px rgba(98,83,70,0.35);display:flex;align-items:center;justify-content:center;"><svg width="13" height="13" viewBox="0 0 24 24" style="transform:rotate(${headingDeg}deg);" fill="#625346" aria-hidden="true"><path d="M12 2L19 20L12 16L5 20L12 2Z"/></svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
  fleetBounds,
  fleetViewSignature,
  skipInitialFit,
  fitFleetNonce,
  focusTarget,
  focusVehicleNonce,
  followSelected,
  followedVehicle,
  clusterFocus,
  onZoomChange,
}: {
  fleetBounds: [[number, number], [number, number]]
  fleetViewSignature: string
  skipInitialFit: boolean
  fitFleetNonce: number
  focusTarget: { lat: number; lng: number } | null
  focusVehicleNonce: number
  followSelected: boolean
  followedVehicle: Vehicle | null
  clusterFocus: { lat: number; lng: number; zoom: number } | null
  onZoomChange: (zoom: number) => void
}) {
  const map = useMap()

  useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom())
    },
  })

  // Fit entire fleet bounds on initial load, org/filter change, or explicit "Fit All Fleet" click
  useEffect(() => {
    if (skipInitialFit && fitFleetNonce === 0) return
    if (typeof map.fitBounds === 'function') {
      map.fitBounds(fleetBounds, { padding: [40, 40], maxZoom: 11, animate: fitFleetNonce > 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitFleetNonce, fleetViewSignature, map])

  // Fly to a single vehicle ONLY when explicitly requested by user click (never on telemetry tick)
  useEffect(() => {
    if (
      focusVehicleNonce > 0 &&
      focusTarget &&
      isValidCoordinate(focusTarget.lat, focusTarget.lng) &&
      typeof map.flyTo === 'function'
    ) {
      map.flyTo([focusTarget.lat, focusTarget.lng], 12, { duration: 0.55 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusVehicleNonce, map])

  // Optional live auto-follow mode when explicitly toggled ON by dispatcher
  useEffect(() => {
    if (
      followSelected &&
      followedVehicle &&
      isValidCoordinate(followedVehicle.telemetry.location.lat, followedVehicle.telemetry.location.lng) &&
      typeof map.panTo === 'function'
    ) {
      map.panTo([followedVehicle.telemetry.location.lat, followedVehicle.telemetry.location.lng], {
        animate: true,
      })
    }
  }, [
    followSelected,
    followedVehicle,
    followedVehicle?.telemetry.location.lat,
    followedVehicle?.telemetry.location.lng,
    map,
  ])

  useEffect(() => {
    if (clusterFocus && typeof map.flyTo === 'function') {
      map.flyTo([clusterFocus.lat, clusterFocus.lng], clusterFocus.zoom, { duration: 0.5 })
    }
  }, [clusterFocus, map])

  return null
}

type FilterOption = 'all' | 'moving' | 'idle' | 'stopped' | 'delayed' | 'maintenance' | 'offline'

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
    nowTick,
  } = useFleet()

  const initialFilter = (searchParams.get('filter') as FilterOption) || 'all'
  const initialVehicleParam = searchParams.get('vehicle')
  const [statusFilter, setStatusFilter] = useState<FilterOption>(
    ['all', 'moving', 'idle', 'stopped', 'delayed', 'maintenance', 'offline'].includes(initialFilter)
      ? initialFilter
      : 'all',
  )
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    initialVehicleParam && vehicles.some((v) => v.id === initialVehicleParam)
      ? initialVehicleParam
      : null,
  )
  const [panelTab, setPanelTab] = useState<'roster' | 'inspector'>(
    initialVehicleParam ? 'inspector' : 'roster',
  )
  const [fitFleetNonce, setFitFleetNonce] = useState(0)
  const [focusVehicleNonce, setFocusVehicleNonce] = useState(initialVehicleParam ? 1 : 0)
  const [followSelected, setFollowSelected] = useState(false)
  const [clusterFocus, setClusterFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const [zoomLevel, setZoomLevel] = useState<number>(7)
  const [showRoutes, setShowRoutes] = useState<boolean>(true)
  const [showGeofences, setShowGeofences] = useState<boolean>(true)
  const [showLabels, setShowLabels] = useState<boolean>(true)
  const [clusterPins, setClusterPins] = useState<boolean>(false)
  const [mapStyle, setMapStyle] = useState<MapBaseStyle>('hybrid')

  // Route playback state (Fleetx-inspired route history playback)
  const [playbackPct, setPlaybackPct] = useState<number>(100)
  const [playbackPlaying, setPlaybackPlaying] = useState<boolean>(false)

  // Geofences (default regional corridor hubs + user-defined custom geofences keyed by org)
  const [customGeofencesByOrg, setCustomGeofencesByOrg] = useState<Record<string, GeofenceZone[]>>({})
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false)
  const [newGfName, setNewGfName] = useState('')
  const [newGfRadiusKm, setNewGfRadiusKm] = useState('5')
  const [newGfLat, setNewGfLat] = useState('')
  const [newGfLng, setNewGfLng] = useState('')

  const customGeofences = useMemo(
    () => customGeofencesByOrg[activeOrganization.id] ?? loadCustomGeofences(activeOrganization.id),
    [customGeofencesByOrg, activeOrganization.id],
  )

  const allGeofences = useMemo(
    () => [...DEFAULT_GEOFENCE_ZONES, ...customGeofences],
    [customGeofences],
  )

  const statusCounts = useMemo(
    () => summarizeFleetTrackingStatuses(vehicles, nowTick),
    [vehicles, nowTick],
  )

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return vehicles.filter((v) => {
      const freshness = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState, nowTick)
      const matchesStatus =
        statusFilter === 'all' ||
        v.operationStatus === statusFilter ||
        (statusFilter === 'offline' && freshness.freshness === 'offline')
      const driver = drivers.find((d) => d.id === v.assignedDriverId)
      const matchesSearch =
        !q ||
        v.registrationNumber.toLowerCase().includes(q) ||
        v.cityName.toLowerCase().includes(q) ||
        v.telemetry.cityLabel.toLowerCase().includes(q) ||
        (driver?.name.toLowerCase().includes(q) ?? false)
      return matchesStatus && matchesSearch
    })
  }, [vehicles, drivers, statusFilter, searchTerm, nowTick])

  const mappableVehicles = useMemo(
    () => filteredVehicles.filter((v) => isValidCoordinate(v.telemetry.location.lat, v.telemetry.location.lng)),
    [filteredVehicles],
  )

  const fleetBoundsSummary = useMemo(
    () => computeFleetBounds(mappableVehicles.map((v) => v.telemetry.location)),
    [mappableVehicles],
  )

  const fleetViewSignature = useMemo(
    () => `${activeOrganization.id}:${statusFilter}:${mappableVehicles.map((v) => v.id).join(',')}`,
    [activeOrganization.id, statusFilter, mappableVehicles],
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

  const selectedVehicleTrip = useMemo(() => {
    if (!selectedVehicle) return null
    return (
      trips.find((t) => t.vehicleId === selectedVehicle.id && (t.status === 'active' || t.status === 'delayed')) ??
      trips.find((t) => t.vehicleId === selectedVehicle.id) ??
      null
    )
  }, [trips, selectedVehicle])

  const playbackMarkerState = useMemo(() => {
    if (!selectedVehicleTrip || selectedVehicleTrip.route.length < 2) return null
    return interpolateRoutePoint(selectedVehicleTrip.route, playbackPct)
  }, [selectedVehicleTrip, playbackPct])

  useEffect(() => {
    if (!playbackPlaying) return
    const timer = window.setInterval(() => {
      setPlaybackPct((prev) => {
        if (prev >= 100) {
          setPlaybackPlaying(false)
          return 100
        }
        return Math.min(100, prev + 4)
      })
    }, 260)
    return () => window.clearInterval(timer)
  }, [playbackPlaying])

  // Render every individual vehicle by default so nothing hides; cluster only if explicitly enabled on larger fleets
  const clusteredEntries = useMemo(() => {
    if (!clusterPins || zoomLevel >= 8 || mappableVehicles.length <= 12) {
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
  }, [mappableVehicles, zoomLevel, clusterPins])

  const selectedDriver = selectedVehicle
    ? drivers.find((d) => d.id === selectedVehicle.assignedDriverId)
    : undefined
  const selectedFreshness = selectedVehicle
    ? classifyTelemetryFreshness(selectedVehicle.telemetry.lastUpdatedAt, selectedVehicle.telemetry.connectionState, nowTick)
    : null
  const selectedOutOfIndiaBounds = selectedVehicle
    ? !isWithinIndiaCorridorBounds(selectedVehicle.telemetry.location.lat, selectedVehicle.telemetry.location.lng)
    : false
  const selectedGeofence = selectedVehicle
    ? findActiveGeofenceForLocation(selectedVehicle.telemetry.location, allGeofences)
    : null
  const selectedTripProgress = selectedVehicleTrip
    ? estimateTripProgress(selectedVehicleTrip, selectedVehicle ?? undefined)
    : null

  const handleSelectAndFocusVehicle = (vehicleId: string, flyToVehicle = true) => {
    if (vehicleId !== selectedVehicleId) {
      setPlaybackPlaying(false)
      setPlaybackPct(100)
      setFollowSelected(false)
    }
    setSelectedVehicleId(vehicleId)
    setPanelTab('inspector')
    if (flyToVehicle) {
      setFocusVehicleNonce((n) => n + 1)
    }
  }

  const handleFitAllFleet = () => {
    setFollowSelected(false)
    setFitFleetNonce((n) => n + 1)
  }

  const openCreateGeofenceModal = () => {
    const anchor = selectedVehicle?.telemetry.location ?? mappableVehicles[0]?.telemetry.location ?? { lat: 13.0674, lng: 80.2376 }
    setNewGfName(selectedVehicle ? `${selectedVehicle.cityName} Custom Checkpoint` : 'Custom Depot Perimeter')
    setNewGfLat(String(anchor.lat))
    setNewGfLng(String(anchor.lng))
    setNewGfRadiusKm('6')
    setGeofenceModalOpen(true)
  }

  const handleCreateGeofence = (e: React.FormEvent) => {
    e.preventDefault()
    const lat = Number(newGfLat)
    const lng = Number(newGfLng)
    const radiusKm = Number(newGfRadiusKm)
    if (!newGfName.trim() || !isValidCoordinate(lat, lng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
      toast.error('Enter a valid geofence name, coordinates, and radius.')
      return
    }
    const zone: GeofenceZone = {
      id: `gf-custom-${Date.now()}`,
      name: newGfName.trim(),
      corridorId: selectedVehicle?.corridorId ?? 'custom',
      center: { lat, lng },
      radiusMeters: Math.round(radiusKm * 1000),
      kind: 'custom',
    }
    const updated = [...customGeofences, zone]
    setCustomGeofencesByOrg((prev) => ({ ...prev, [activeOrganization.id]: updated }))
    saveCustomGeofences(activeOrganization.id, updated)
    setShowGeofences(true)
    setGeofenceModalOpen(false)
    toast.success(`Geofence "${zone.name}" added (${radiusKm} km radius).`)
  }

  const filterOptions: Array<{ id: FilterOption; label: string; count: number }> = [
    { id: 'all', label: 'All', count: statusCounts.all },
    { id: 'moving', label: 'Moving', count: statusCounts.moving },
    { id: 'idle', label: 'Idle', count: statusCounts.idle },
    { id: 'stopped', label: 'Stopped', count: statusCounts.stopped },
    { id: 'delayed', label: 'Delayed', count: statusCounts.delayed },
    { id: 'maintenance', label: 'Maint', count: statusCounts.maintenance },
    { id: 'offline', label: 'Offline', count: statusCounts.offline },
  ]

  return (
    <div className="space-y-4">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="dm-page-title">Live Operations Map</h1>
            <span className="text-xs font-medium text-[#958777] tabular-nums">
              · Tracking {mappableVehicles.length}/{vehicles.length} fleet assets
            </span>
          </div>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Multi-vehicle GPS tracking, depot geofences, and route playback
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleFitAllFleet}
            className="btn-primary text-xs px-3 py-2"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit All Fleet ({mappableVehicles.length})
          </button>
          <button
            type="button"
            onClick={openCreateGeofenceModal}
            className="btn-accent text-xs px-3 py-2"
          >
            <Plus className="w-3.5 h-3.5 text-[#6E5696]" />
            Add Geofence
          </button>
          <button
            type="button"
            onClick={toggleSimulation}
            className="btn-secondary text-xs px-3 py-2"
          >
            {simulationActive ? <Pause className="w-3.5 h-3.5 text-[#6E5696]" /> : <Play className="w-3.5 h-3.5 text-[#4D6E4A]" />}
            {simulationActive ? 'Pause Stream' : 'Resume Stream'}
          </button>
        </div>
      </div>

      {/* Filter Tabs, Layer Toggles & Search Bar */}
      <div className="enterprise-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
          {filterOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStatusFilter(opt.id)}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                statusFilter === opt.id
                  ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle border border-[#DDD3ED]'
                  : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              {opt.label} ({opt.count})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          <button
            type="button"
            onClick={() => setShowRoutes((r) => !r)}
            className={`px-2.5 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              showRoutes ? 'bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]' : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#958777]'
            }`}
          >
            <RouteIcon className="w-3.5 h-3.5 text-[#6E5696]" />
            Routes
          </button>
          <button
            type="button"
            onClick={() => setShowGeofences((g) => !g)}
            className={`px-2.5 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              showGeofences ? 'bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]' : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#958777]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#6E5696]" />
            Geofences
          </button>
          <button
            type="button"
            onClick={() => setShowLabels((l) => !l)}
            className={`px-2.5 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              showLabels ? 'bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]' : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#958777]'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-[#6E5696]" />
            Labels
          </button>
          <button
            type="button"
            onClick={() => setClusterPins((c) => !c)}
            className={`px-2.5 py-1.5 rounded-[8px] text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              clusterPins ? 'bg-[#EEE8F7] border-[#B8A3D9] text-[#625346]' : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#958777]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#6E5696]" />
            Cluster
          </button>

          <div className="relative flex-1 sm:w-56 min-w-[180px]">
            <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Registration, city, driver..."
              aria-label="Filter map vehicles"
              className="dm-input pl-9 py-1.5 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Split: Interactive Multi-Vehicle Map (8 cols) + Fleet Tracking Workbench (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 enterprise-card overflow-hidden relative min-h-[520px] h-[620px]">
          <MapContainer
            center={fleetBoundsSummary.center}
            zoom={fleetBoundsSummary.singlePointZoom}
            className={`w-full h-full z-10 ${mapStyle === 'street' ? 'dm-map-street' : 'dm-map-satellite'}`}
          >
            <SatelliteTileLayers style={mapStyle} />
            <MapController
              fleetBounds={fleetBoundsSummary.bounds}
              fleetViewSignature={fleetViewSignature}
              skipInitialFit={Boolean(initialVehicleParam)}
              fitFleetNonce={fitFleetNonce}
              focusTarget={selectedVehicle ? selectedVehicle.telemetry.location : null}
              focusVehicleNonce={focusVehicleNonce}
              followSelected={followSelected && Boolean(selectedVehicle)}
              followedVehicle={selectedVehicle}
              clusterFocus={clusterFocus}
              onZoomChange={setZoomLevel}
            />

            {/* Depot & Corridor Geofences */}
            {showGeofences &&
              allGeofences.map((zone) => (
                <Circle
                  key={zone.id}
                  center={[zone.center.lat, zone.center.lng]}
                  radius={zone.radiusMeters}
                  pathOptions={{
                    color:
                      zone.kind === 'custom'
                        ? '#F4C542'
                        : mapStyle === 'street'
                          ? '#B8A3D9'
                          : '#DDD3ED',
                    fillColor: zone.kind === 'custom' ? '#E8C65A' : '#EEE8F7',
                    fillOpacity: mapStyle === 'street' ? 0.22 : 0.16,
                    weight: 1.75,
                    dashArray: zone.kind === 'hub' ? undefined : '5 5',
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#625346]">{zone.name}</p>
                      <p className="text-[#958777] capitalize">
                        {zone.kind} geofence · {(zone.radiusMeters / 1000).toFixed(1)} km radius
                      </p>
                    </div>
                  </Popup>
                </Circle>
              ))}

            {/* Active & Delayed Route Polylines */}
            {showRoutes &&
              activeRoutes.map((trip) => {
                const isSelectedTrip = selectedVehicle?.id === trip.vehicleId
                return (
                  <Polyline
                    key={trip.id}
                    positions={trip.route
                      .filter((pt) => isValidCoordinate(pt.lat, pt.lng))
                      .map((pt) => [pt.lat, pt.lng] as [number, number])}
                    pathOptions={{
                      color:
                        trip.status === 'delayed'
                          ? '#F4C542'
                          : mapStyle === 'street'
                            ? '#6E5696'
                            : '#C4B5FD',
                      weight: isSelectedTrip ? 5 : 3.5,
                      opacity: isSelectedTrip ? 0.95 : 0.85,
                    }}
                  />
                )
              })}

            {/* Completed / Selected Trip Route Polyline for Playback */}
            {showRoutes &&
              selectedVehicleTrip &&
              selectedVehicleTrip.status === 'completed' &&
              selectedVehicleTrip.route.length >= 2 && (
                <Polyline
                  positions={selectedVehicleTrip.route
                    .filter((pt) => isValidCoordinate(pt.lat, pt.lng))
                    .map((pt) => [pt.lat, pt.lng] as [number, number])}
                  pathOptions={{
                    color: mapStyle === 'street' ? '#6E5696' : '#DDD3ED',
                    weight: 4,
                    dashArray: '6 6',
                    opacity: 0.9,
                  }}
                />
              )}

            {/* Playback Position Indicator along Selected Trip */}
            {playbackMarkerState && playbackPct < 100 && (
              <Marker
                position={[playbackMarkerState.position.lat, playbackMarkerState.position.lng]}
                icon={createPlaybackIcon(playbackMarkerState.headingDeg)}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-[#625346]">Route Playback ({playbackPct}%)</p>
                    <p className="text-[#958777] tabular-nums">
                      {playbackMarkerState.position.lat.toFixed(4)}, {playbackMarkerState.position.lng.toFixed(4)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* All Fleet Vehicle Markers */}
            {clusteredEntries.map((entry) =>
              entry.type === 'cluster' ? (
                <Marker
                  key={entry.key}
                  position={[entry.lat, entry.lng]}
                  icon={createClusterIcon(entry.vehicles.length)}
                  eventHandlers={{
                    click: () => {
                      setClusterFocus({ lat: entry.lat, lng: entry.lng, zoom: Math.max(9, zoomLevel + 2) })
                    },
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <p className="font-bold text-[#625346]">{entry.vehicles.length} Vehicles in Cluster</p>
                      {entry.vehicles.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleSelectAndFocusVehicle(v.id)}
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
                    entry.vehicle,
                    entry.vehicle.id === selectedVehicleId,
                    showLabels,
                    mappableVehicles.some(
                      (other) =>
                        other.id !== entry.vehicle.id &&
                        other.telemetry.location.lat < entry.lat &&
                        entry.lat - other.telemetry.location.lat < 0.25 &&
                        Math.abs(other.telemetry.location.lng - entry.lng) < 0.45,
                    )
                      ? 'above'
                      : 'below',
                  )}
                  eventHandlers={{
                    click: () => handleSelectAndFocusVehicle(entry.vehicle.id, false),
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1.5 min-w-[190px]">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[#625346] tabular-nums">{entry.vehicle.registrationNumber}</p>
                        <span className="capitalize font-semibold text-[#6E5696]">
                          {entry.vehicle.operationStatus}
                        </span>
                      </div>
                      <p className="text-[#958777]">
                        {drivers.find((d) => d.id === entry.vehicle.assignedDriverId)?.name ?? 'Unassigned'} · {entry.vehicle.cityName}
                      </p>
                      <p className="tabular-nums font-medium text-[#625346]">
                        Speed: {entry.vehicle.telemetry.speedKmh} km/h · {entry.vehicle.powertrain === 'EV' ? 'SoC' : 'Fuel'} {entry.vehicle.fuelOrSocPct}%
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectAndFocusVehicle(entry.vehicle.id, true)}
                          className="text-xs font-semibold text-[#6E5696] hover:underline"
                        >
                          Zoom & Inspect
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/fleet/${entry.vehicle.id}`)}
                          className="text-xs font-semibold text-[#625346] hover:underline"
                        >
                          Digital Twin
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ),
            )}
          </MapContainer>

          {/* Floating Map Layer Switcher & Fit All Control */}
          <div className="absolute top-3 right-3 z-20 flex flex-wrap items-center justify-end gap-2">
            <MapStyleToggle value={mapStyle} onChange={setMapStyle} compact />
            {selectedVehicle && (
              <button
                type="button"
                onClick={handleFitAllFleet}
                className="bg-[#FFFFFF]/95 hover:bg-[#EEE8F7] border border-[#E5E5E5] rounded-[8px] px-2.5 py-1.5 text-xs font-semibold text-[#625346] shadow-subtle inline-flex items-center gap-1.5"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#6E5696]" />
                Show All ({mappableVehicles.length})
              </button>
            )}
          </div>

          <div className="absolute bottom-3 left-3 z-20 hidden sm:flex items-center gap-3 bg-[#FFFFFF]/95 border border-[#E5E5E5] rounded-[10px] px-3 py-1.5 text-[11px] font-medium text-[#625346] shadow-subtle">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#789A75]" /> Moving
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E8C65A]" /> Idle / Delayed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#B8A3D9]" /> Stopped / Maint
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D9786C]" /> Offline
            </span>
          </div>

          {mappableVehicles.length === 0 && (
            <div className="absolute inset-x-6 bottom-6 z-20 bg-[#FFFFFF]/95 border border-[#DDD3ED] rounded-xl p-4 shadow-elevated text-center">
              <p className="text-sm font-bold text-[#625346]">No matching vehicles with valid GPS coordinates</p>
              <p className="text-xs text-[#958777] mt-1">
                Clear active status/search filters or verify smartphone GPS permissions on driver devices.
              </p>
            </div>
          )}
        </div>

        {/* Right Fleet Tracking Workbench (Roster + Selected Vehicle Telemetry & Route Playback) */}
        <div className="lg:col-span-4 enterprise-card flex flex-col h-[620px] overflow-hidden">
          {/* Panel Mode Switcher */}
          <div className="p-3 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPanelTab('roster')}
              className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap tabular-nums ${
                panelTab === 'roster'
                  ? 'bg-[#FFFFFF] text-[#625346] border border-[#DDD3ED] shadow-subtle'
                  : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              Fleet Roster ({filteredVehicles.length})
            </button>
            <button
              type="button"
              onClick={() => setPanelTab('inspector')}
              className={`flex-1 py-1.5 px-3 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                panelTab === 'inspector'
                  ? 'bg-[#FFFFFF] text-[#625346] border border-[#DDD3ED] shadow-subtle'
                  : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              {selectedVehicle ? selectedVehicle.registrationNumber : 'Telemetry Inspector'}
            </button>
          </div>

          {panelTab === 'roster' ? (
            <div className="flex-1 overflow-y-auto scrollbar-custom divide-y divide-[#E5E5E5]/80">
              {filteredVehicles.map((v) => {
                const drv = drivers.find((d) => d.id === v.assignedDriverId)
                const freshness = classifyTelemetryFreshness(v.telemetry.lastUpdatedAt, v.telemetry.connectionState, nowTick)
                const zoneMatch = findActiveGeofenceForLocation(v.telemetry.location, allGeofences)
                const isSelected = v.id === selectedVehicleId
                const pin = getStatusPinPalette(v.operationStatus)

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleSelectAndFocusVehicle(v.id, true)}
                    className={`w-full p-3.5 text-left transition-colors hover:bg-[#EEE8F7]/60 ${
                      isSelected ? 'bg-[#EEE8F7]' : 'bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: pin.bg }}
                        />
                        <span className="font-bold text-xs text-[#625346] tabular-nums truncate">
                          {v.registrationNumber}
                        </span>
                        <span className="text-[11px] text-[#958777] whitespace-nowrap">
                          · {v.powertrain}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-[#625346] tabular-nums whitespace-nowrap">
                        {v.telemetry.speedKmh} km/h
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-[#958777]">
                      <span className="truncate">{drv?.name ?? 'Unassigned'} · {v.cityName}</span>
                      <span className="capitalize font-medium text-[#625346] whitespace-nowrap">
                        {v.operationStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px] text-[#958777]">
                      <span className="truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#6E5696] shrink-0" />
                        {zoneMatch ? zoneMatch.zone.name : v.telemetry.cityLabel}
                      </span>
                      <span className="tabular-nums whitespace-nowrap shrink-0">
                        {v.powertrain === 'EV' ? 'SoC' : 'Fuel'} {v.fuelOrSocPct}% · {freshness.freshness}
                      </span>
                    </div>
                  </button>
                )
              })}
              {filteredVehicles.length === 0 && (
                <div className="p-8 text-center text-xs text-[#958777]">
                  No vehicles match the active status or search filter.
                </div>
              )}
            </div>
          ) : selectedVehicle && selectedFreshness ? (
            <div className="flex-1 overflow-y-auto scrollbar-custom p-4 space-y-4">
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#E5E5E5]">
                <div>
                  <p className="font-bold text-lg text-[#625346] tabular-nums">
                    {selectedVehicle.registrationNumber}
                  </p>
                  <p className="text-xs text-[#958777]">
                    {selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.powertrain} · {selectedVehicle.cityName}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFollowSelected((f) => !f)}
                    title="Auto-follow vehicle on map"
                    className={`px-2 py-1 rounded-[8px] text-[11px] font-semibold border transition-colors inline-flex items-center gap-1 ${
                      followSelected
                        ? 'bg-[#E8C65A] border-[#D8B442] text-[#625346]'
                        : 'bg-[#FFFFFF] border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7]'
                    }`}
                  >
                    <Crosshair className="w-3 h-3" />
                    {followSelected ? 'Following' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVehicleId(null)
                      setFollowSelected(false)
                      setPanelTab('roster')
                    }}
                    aria-label="Clear selected vehicle"
                    className="p-1 rounded-lg text-[#958777] hover:text-[#625346] hover:bg-[#EEE8F7]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <SeverityText severity={selectedFreshness.freshness} label={selectedFreshness.label} />
                <span className="text-xs font-semibold text-[#625346] capitalize">
                  Status: {selectedVehicle.operationStatus}
                </span>
              </div>

              {selectedOutOfIndiaBounds && (
                <div className="p-2.5 rounded-[10px] bg-[#E8C65A]/30 border border-[#D8B442] text-xs font-semibold text-[#625346]">
                  Coordinates fall outside configured regional India corridor bounds. Verify GPS signal calibration.
                </div>
              )}

              {/* Live Geofence Membership Card */}
              <div className="p-3 rounded-[10px] bg-[#EEE8F7]/65 border border-[#DDD3ED] text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#625346] inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#6E5696]" />
                    Geofence Status
                  </span>
                  <span className="font-semibold text-[#6E5696]">
                    {selectedGeofence ? 'Inside Zone' : 'In Transit'}
                  </span>
                </div>
                <p className="text-[#958777] mt-1">
                  {selectedGeofence
                    ? `${selectedGeofence.zone.name} (${(selectedGeofence.distanceMeters / 1000).toFixed(1)} km from center)`
                    : selectedVehicle.telemetry.cityLabel}
                </p>
              </div>

              {/* Core Telemetry Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-2.5">
                  <span className="text-[#958777] block">Assigned Driver</span>
                  <span className="font-semibold text-[#625346] mt-0.5 block truncate">
                    {selectedDriver?.name ?? 'Unassigned'}
                  </span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-2.5">
                  <span className="text-[#958777] block">Speed & Heading</span>
                  <span className="font-bold text-[#625346] tabular-nums mt-0.5 inline-flex items-center gap-1">
                    {selectedVehicle.telemetry.speedKmh} km/h
                    <Compass className="w-3 h-3 text-[#6E5696]" /> {selectedVehicle.telemetry.heading}°
                  </span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-2.5">
                  <span className="text-[#958777] block">
                    {selectedVehicle.powertrain === 'EV' ? 'Battery SoC' : 'Fuel Level'}
                  </span>
                  <span className="font-semibold text-[#625346] tabular-nums mt-0.5 inline-flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-[#6E5696]" /> {selectedVehicle.fuelOrSocPct}%
                  </span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-2.5">
                  <span className="text-[#958777] block">GPS Accuracy</span>
                  <span className="font-semibold text-[#625346] tabular-nums mt-0.5 block">
                    ±{selectedVehicle.telemetry.gpsAccuracyMeters} m
                  </span>
                </div>
              </div>

              {/* Fleetx-style Trip Progress & Route History Playback */}
              {selectedVehicleTrip && (
                <div className="p-3 rounded-[10px] bg-[#FAFAFA] border border-[#E5E5E5] space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#625346] inline-flex items-center gap-1.5">
                      <RouteIcon className="w-3.5 h-3.5 text-[#6E5696]" />
                      Route & Trip Playback
                    </span>
                    <span className="text-[11px] font-semibold capitalize text-[#6E5696]">
                      {selectedVehicleTrip.status}
                    </span>
                  </div>
                  <p className="text-[#625346] font-medium">
                    {selectedVehicleTrip.originAddress} → {selectedVehicleTrip.destinationAddress}
                  </p>
                  {selectedTripProgress && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-[#958777] tabular-nums">
                        <span>
                          {selectedVehicleTrip.distanceKm} km covered · {selectedVehicleTrip.durationMinutes}m elapsed
                        </span>
                        {selectedTripProgress.etaMinutes !== null && selectedTripProgress.etaMinutes > 0 && (
                          <span className="font-semibold text-[#625346] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#6E5696]" />
                            ETA ~{selectedTripProgress.etaMinutes}m
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#E5E5E5] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#E8C65A]"
                          style={{ width: `${selectedTripProgress.completionPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedVehicleTrip.route.length >= 2 && (
                    <div className="pt-2 border-t border-[#E5E5E5] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (playbackPct >= 100) setPlaybackPct(0)
                              setPlaybackPlaying((p) => !p)
                            }}
                            className="btn-primary text-[11px] px-2.5 py-1"
                          >
                            {playbackPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            {playbackPlaying ? 'Pause' : 'Play Route'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPlaybackPlaying(false)
                              setPlaybackPct(0)
                            }}
                            className="btn-secondary text-[11px] px-2 py-1"
                            aria-label="Reset route playback"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[11px] font-semibold text-[#625346] tabular-nums">
                          {playbackPct}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={playbackPct}
                        aria-label="Route playback timeline"
                        onChange={(e) => {
                          setPlaybackPlaying(false)
                          setPlaybackPct(Number(e.target.value))
                        }}
                        className="w-full accent-[#6E5696] cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Smartphone Diagnostics */}
              <div className="space-y-2 text-xs pt-2 border-t border-[#E5E5E5]">
                <div className="flex items-center justify-between">
                  <span className="text-[#958777] inline-flex items-center gap-1.5">
                    <Signal className="w-3.5 h-3.5" /> Signal Quality
                  </span>
                  <span className="font-semibold text-[#625346] tabular-nums">
                    {selectedVehicle.telemetry.signalQualityPct}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#958777] inline-flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" /> Connection State
                  </span>
                  <span className="font-semibold text-[#625346] capitalize">
                    {selectedVehicle.telemetry.connectionState}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#958777] inline-flex items-center gap-1.5">
                    <BatteryCharging className="w-3.5 h-3.5" /> Driver Phone Battery
                  </span>
                  <span className="font-semibold text-[#625346] tabular-nums">
                    {selectedVehicle.telemetry.batteryLevelPct ?? '—'}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#958777]">Last Telemetry Update</span>
                  <span className="text-[#625346] tabular-nums">
                    {formatDateTime(selectedVehicle.telemetry.lastUpdatedAt, activeOrganization.timezone)}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAndFocusVehicle(selectedVehicle.id, true)}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  <Crosshair className="w-3.5 h-3.5 text-[#6E5696]" />
                  Center
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/dashboard/fleet/${selectedVehicle.id}`)}
                  className="btn-accent flex-1 text-xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Open Digital Twin
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <p className="text-sm font-semibold text-[#625346]">No vehicle selected</p>
              <p className="text-xs text-[#958777]">
                Click any marker on the map or pick an asset from the Fleet Roster to inspect live speed, geofence status, and route playback.
              </p>
              <button
                type="button"
                onClick={() => setPanelTab('roster')}
                className="btn-accent text-xs"
              >
                Browse Fleet Roster ({filteredVehicles.length})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Geofence Modal */}
      <EnterpriseModal
        open={geofenceModalOpen}
        onClose={() => setGeofenceModalOpen(false)}
        title="Add Geofence Perimeter"
        subtitle="Create a virtual boundary around a depot, warehouse, or client delivery checkpoint."
      >
        <form onSubmit={handleCreateGeofence} className="space-y-4">
          <div>
            <label htmlFor="gf-name" className="dm-label">Zone Name *</label>
            <input
              id="gf-name"
              required
              value={newGfName}
              onChange={(e) => setNewGfName(e.target.value)}
              placeholder="e.g., Sriperumbudur Warehouse Gate"
              className="dm-input"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="gf-lat" className="dm-label">Latitude *</label>
              <input
                id="gf-lat"
                type="number"
                step="any"
                required
                value={newGfLat}
                onChange={(e) => setNewGfLat(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="gf-lng" className="dm-label">Longitude *</label>
              <input
                id="gf-lng"
                type="number"
                step="any"
                required
                value={newGfLng}
                onChange={(e) => setNewGfLng(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="gf-rad" className="dm-label">Radius (km) *</label>
              <input
                id="gf-rad"
                type="number"
                min={0.5}
                max={50}
                step="0.5"
                required
                value={newGfRadiusKm}
                onChange={(e) => setNewGfRadiusKm(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <button type="button" onClick={() => setGeofenceModalOpen(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save Geofence
            </button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
