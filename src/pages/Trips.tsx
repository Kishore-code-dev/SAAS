import React, { useMemo, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Plus, Route as RouteIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { generateCsvContent, isValidCoordinate } from '../utils/intelligenceEngine'
import { canPerformAction } from '../utils/rbac'
import {
  EmptySectionState,
  EnterpriseModal,
  formatDateTime,
  SeverityText,
} from '../components/ui/EnterprisePrimitives'

export default function Trips() {
  const {
    activeOrganization,
    activeRole,
    trips,
    vehicles,
    drivers,
    driverEvents,
    scheduleTrip,
    endTrip,
  } = useFleet()

  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'delayed'>('all')
  const [selectedTripId, setSelectedTripId] = useState<string | null>(trips[0]?.id ?? null)
  const [dispatchOpen, setDispatchOpen] = useState(false)
  const [dispatchError, setDispatchError] = useState<string | null>(null)
  const [dispatchForm, setDispatchForm] = useState({
    vehicleId: vehicles[0]?.id ?? '',
    driverId: drivers.find((d) => d.operationalStatus === 'active')?.id ?? '',
    originAddress: 'Chennai Freight Depot',
    destinationAddress: 'Coimbatore Distribution Hub',
  })
  const [truckCheck, setTruckCheck] = useState<{
    loading: boolean
    tripId: string | null
    available?: boolean
    mode?: string
    distanceKm?: number | null
    durationSeconds?: number | null
    message?: string
  }>({ loading: false, tripId: null })

  const effectiveDispatchVehicleId = vehicles.some((v) => v.id === dispatchForm.vehicleId)
    ? dispatchForm.vehicleId
    : (vehicles[0]?.id ?? '')
  const activeDriversList = drivers.filter((d) => d.operationalStatus === 'active')
  const effectiveDispatchDriverId = activeDriversList.some((d) => d.id === dispatchForm.driverId)
    ? dispatchForm.driverId
    : (activeDriversList[0]?.id ?? '')

  const canDispatch = canPerformAction(activeRole, 'schedule_trip')
  const canEnd = canPerformAction(activeRole, 'end_trip')

  const filteredTrips = useMemo(() => {
    return trips.filter((t) => statusFilter === 'all' || t.status === statusFilter)
  }, [trips, statusFilter])

  const selectedTrip = useMemo(
    () => filteredTrips.find((t) => t.id === selectedTripId) ?? filteredTrips[0] ?? null,
    [filteredTrips, selectedTripId],
  )

  const handleCheckCommercialTruckRoute = async () => {
    if (!selectedTrip) return
    const veh = vehicles.find((v) => v.id === selectedTrip.vehicleId)
    setTruckCheck({ loading: true, tripId: selectedTrip.id })
    try {
      const origin = isValidCoordinate(selectedTrip.startLocation.lat, selectedTrip.startLocation.lng)
        ? selectedTrip.startLocation
        : { lat: 13.0827, lng: 80.2707 }
      const endPt = selectedTrip.endLocation ?? selectedTrip.route[selectedTrip.route.length - 1]
      const destination =
        endPt && isValidCoordinate(endPt.lat, endPt.lng) ? endPt : { lat: 11.0168, lng: 76.9558 }

      const res = await fetch('/api/routing/truck', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          specs: veh?.specs,
        }),
      })
      const data = await res.json()
      setTruckCheck({
        loading: false,
        tripId: selectedTrip.id,
        available: Boolean(data.available),
        mode: data.mode,
        distanceKm: data.distanceKm,
        durationSeconds: data.durationSeconds,
        message: data.message,
      })
    } catch {
      setTruckCheck({
        loading: false,
        tripId: selectedTrip.id,
        available: false,
        mode: 'highway_geometry_unverified',
        message: 'Unable to reach commercial truck routing check; highway geometry shown is not restriction-verified.',
      })
    }
  }

  const handleExportCsv = () => {
    const csv = generateCsvContent(
      ['Trip ID', 'Vehicle', 'Driver', 'Origin', 'Destination', 'Distance (km)', 'Duration (min)', 'Avg Speed', 'Max Speed', 'Status', 'Start Time'],
      filteredTrips.map((t) => {
        const v = vehicles.find((x) => x.id === t.vehicleId)
        const d = drivers.find((x) => x.id === t.driverId)
        return [
          t.id,
          v?.registrationNumber ?? t.vehicleId,
          d?.name ?? t.driverId,
          t.originAddress,
          t.destinationAddress,
          t.distanceKm,
          t.durationMinutes,
          t.avgSpeedKmh,
          t.maxSpeedKmh,
          t.status,
          t.startTime,
        ]
      }),
    )
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeOrganization.code.toLowerCase()}-trips.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported trips CSV.')
  }

  const handleScheduleDispatch = (e: React.FormEvent) => {
    e.preventDefault()
    setDispatchError(null)
    if (!effectiveDispatchVehicleId || !effectiveDispatchDriverId || !dispatchForm.originAddress.trim()) {
      setDispatchError('Vehicle, active driver, and origin are required.')
      return
    }
    try {
      const created = scheduleTrip({
        ...dispatchForm,
        vehicleId: effectiveDispatchVehicleId,
        driverId: effectiveDispatchDriverId,
      })
      if (created) {
        setSelectedTripId(created.id)
        toast.success('Trip dispatched and live tracking started.')
        setDispatchOpen(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to dispatch trip.'
      setDispatchError(msg)
      toast.error(msg)
    }
  }

  const validStart = selectedTrip
    ? isValidCoordinate(selectedTrip.startLocation.lat, selectedTrip.startLocation.lng)
    : false
  const validRoutePositions = selectedTrip
    ? selectedTrip.route
        .filter((p) => isValidCoordinate(p.lat, p.lng))
        .map((p) => [p.lat, p.lng] as [number, number])
    : []

  const selectedVehicle = selectedTrip ? vehicles.find((v) => v.id === selectedTrip.vehicleId) : undefined

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Trip Intelligence</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Route trajectories, commercial truck clearance checks, speed profiles, and stop logs
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={handleExportCsv} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {canDispatch && (
            <button
              type="button"
              onClick={() => {
                setDispatchError(null)
                setDispatchForm((f) => ({
                  ...f,
                  vehicleId: vehicles[0]?.id ?? '',
                  driverId: drivers.find((d) => d.operationalStatus === 'active')?.id ?? '',
                }))
                setDispatchOpen(true)
              }}
              className="btn-primary text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Dispatch Trip
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-1.5 flex items-center gap-1 w-fit bg-[#EEE8F7] border border-[#DDD3ED] rounded-[10px]">
        {(['all', 'active', 'delayed', 'completed'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize transition-colors whitespace-nowrap ${
              statusFilter === st ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777] hover:text-[#625346]'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {filteredTrips.length === 0 ? (
        <EmptySectionState
          title="No trips logged for selected filter"
          description="Dispatch a trip from the Owner Command Console to start live corridor tracking and telemetry."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Trips List */}
          <div className="xl:col-span-5 enterprise-card divide-y divide-[#E5E5E5]/70 overflow-hidden">
            {filteredTrips.map((trip) => {
              const v = vehicles.find((x) => x.id === trip.vehicleId)
              const d = drivers.find((x) => x.id === trip.driverId)
              const active = selectedTrip?.id === trip.id
              return (
                <button
                  key={trip.id}
                  type="button"
                  onClick={() => setSelectedTripId(trip.id)}
                  className={`w-full p-4 text-left transition-colors hover:bg-[#FFFFFF] ${
                    active ? 'bg-[#EEE8F7]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#625346] tabular-nums">
                      {v?.registrationNumber ?? trip.vehicleId}
                    </span>
                    <SeverityText
                      severity={trip.status === 'delayed' ? 'high' : trip.status === 'completed' ? 'normal' : 'moderate'}
                      label={trip.status}
                    />
                  </div>
                  <p className="text-sm font-semibold text-[#625346] mt-1">
                    {trip.originAddress} → {trip.destinationAddress}
                  </p>
                  <div className="flex items-center justify-between text-xs text-[#958777] mt-1.5">
                    <span>{d?.name ?? 'Driver'}</span>
                    <span className="tabular-nums">
                      {trip.distanceKm} km · {trip.durationMinutes} min
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Detailed Trip Drawer */}
          {selectedTrip && (
            <div className="xl:col-span-7 enterprise-card p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
                <div>
                  <div className="flex items-center gap-2">
                    <RouteIcon className="w-4 h-4 text-[#6E5696]" />
                    <span className="text-xs text-[#958777] tabular-nums">{selectedTrip.id}</span>
                  </div>
                  <h2 className="dm-card-title text-lg mt-1">
                    {selectedTrip.originAddress} → {selectedTrip.destinationAddress}
                  </h2>
                  <p className="text-xs text-[#958777] mt-0.5">
                    Started {formatDateTime(selectedTrip.startTime, activeOrganization.timezone)}
                    {selectedTrip.offlineSynced === false ? ' · Offline Queue Pending Sync' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={truckCheck.loading}
                    onClick={() => void handleCheckCommercialTruckRoute()}
                    className="btn-secondary text-xs"
                  >
                    {truckCheck.loading && truckCheck.tripId === selectedTrip.id
                      ? 'Checking Clearance...'
                      : 'Check Truck Route Clearance'}
                  </button>
                  {selectedTrip.status === 'active' && canEnd && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          endTrip(selectedTrip.id)
                          toast.success('Trip marked completed and odometer updated.')
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Unable to complete trip.')
                        }
                      }}
                      className="btn-primary text-xs"
                    >
                      Complete Trip
                    </button>
                  )}
                </div>
              </div>

              {truckCheck.tripId === selectedTrip.id && truckCheck.message && (
                <div
                  className={`rounded-[10px] border p-3.5 text-xs ${
                    truckCheck.available
                      ? 'bg-[#789A75]/15 border-[#789A75] text-[#625346]'
                      : 'bg-[#E8C65A]/20 border-[#D8B442] text-[#625346]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span>
                      {truckCheck.available
                        ? 'Commercial Truck Route Verified'
                        : 'Corridor Geometry Only — Restrictions NOT Verified'}
                    </span>
                    {selectedVehicle?.specs && (
                      <span className="tabular-nums text-[11px] font-semibold">
                        H {selectedVehicle.specs.heightMeters ?? '—'}m · GVW {selectedVehicle.specs.grossVehicleWeightKg ?? '—'} kg · {selectedVehicle.specs.axleCount ?? '—'} Axles
                      </span>
                    )}
                  </div>
                  <p className="mt-1 leading-relaxed">{truckCheck.message}</p>
                  {typeof truckCheck.distanceKm === 'number' && (
                    <p className="mt-1 font-semibold tabular-nums">
                      Routed Distance: {truckCheck.distanceKm} km
                      {typeof truckCheck.durationSeconds === 'number'
                        ? ` · Est. Travel ${Math.round(truckCheck.durationSeconds / 60)} min`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3">
                  <span className="text-[#958777] block">Distance</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{selectedTrip.distanceKm} km</span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3">
                  <span className="text-[#958777] block">Duration</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{selectedTrip.durationMinutes} min</span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3">
                  <span className="text-[#958777] block">Avg Speed</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{selectedTrip.avgSpeedKmh} km/h</span>
                </div>
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3">
                  <span className="text-[#958777] block">Max Speed</span>
                  <span className="text-base font-bold text-[#625346] tabular-nums">{selectedTrip.maxSpeedKmh} km/h</span>
                </div>
              </div>

              {/* Route Map */}
              <div className="h-56 rounded-xl overflow-hidden border border-[#E5E5E5]">
                {validStart ? (
                  <MapContainer
                    key={selectedTrip.id}
                    center={[selectedTrip.startLocation.lat, selectedTrip.startLocation.lng]}
                    zoom={10}
                    className="w-full h-full"
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {validRoutePositions.length >= 2 && (
                      <Polyline
                        positions={validRoutePositions}
                        pathOptions={{ color: '#6E5696', weight: 4 }}
                      />
                    )}
                    <Marker position={[selectedTrip.startLocation.lat, selectedTrip.startLocation.lng]} />
                  </MapContainer>
                ) : (
                  <div className="w-full h-full bg-[#EEE8F7]/60 flex items-center justify-center p-4 text-xs text-[#958777]">
                    Route GPS coordinates unavailable or invalid for this trip.
                  </div>
                )}
              </div>

              {/* Speed Timeline */}
              <div>
                <h3 className="text-xs font-bold text-[#625346] mb-2">Speed Timeline (km/h)</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedTrip.speedTimeline}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#958777', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#958777', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="speedKmh" name="Speed (km/h)" stroke="#D8B442" fill="#E8C65A" fillOpacity={0.28} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Stops & Events */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3.5">
                  <p className="font-bold text-[#625346] mb-2">Recorded Stops ({selectedTrip.stops.length})</p>
                  {selectedTrip.stops.map((st) => (
                    <div key={st.id} className="py-1.5 border-t border-[#E5E5E5]/70 first:border-0">
                      <p className="font-medium text-[#625346]">{st.address}</p>
                      <p className="text-[#958777] capitalize tabular-nums">
                        {st.reason} · {st.durationMinutes} min · {st.location.lat.toFixed(3)}, {st.location.lng.toFixed(3)}
                      </p>
                    </div>
                  ))}
                  {selectedTrip.stops.length === 0 && <p className="text-[#958777]">No intermediate stops recorded.</p>}
                </div>

                <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3.5">
                  <p className="font-bold text-[#625346] mb-2">Behavior Events on Trip</p>
                  {driverEvents
                    .filter((ev) => ev.tripId === selectedTrip.id)
                    .map((ev) => (
                      <div key={ev.id} className="py-1.5 border-t border-[#E5E5E5]/70 first:border-0">
                        <p className="font-medium text-[#625346] capitalize">{ev.eventType.replace(/_/g, ' ')}</p>
                        <p className="text-[#958777]">{ev.locationLabel} · {ev.speedKmh} km/h</p>
                      </div>
                    ))}
                  {driverEvents.filter((ev) => ev.tripId === selectedTrip.id).length === 0 && (
                    <p className="text-[#958777]">No behavior exceptions logged.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dispatch Trip Modal */}
      <EnterpriseModal open={dispatchOpen} onClose={() => setDispatchOpen(false)} title="Dispatch New Trip">
        <form onSubmit={handleScheduleDispatch} className="space-y-4">
          {dispatchError && (
            <div role="alert" className="p-3 rounded-[10px] bg-[#D9786C]/20 border border-[#D9786C] text-xs font-semibold text-[#625346]">
              {dispatchError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="disp-veh" className="dm-label">Vehicle *</label>
              <select id="disp-veh" value={effectiveDispatchVehicleId} onChange={(e) => setDispatchForm((f) => ({ ...f, vehicleId: e.target.value }))} className="dm-input">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.registrationNumber}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="disp-drv" className="dm-label">Active Driver *</label>
              <select id="disp-drv" value={effectiveDispatchDriverId} onChange={(e) => setDispatchForm((f) => ({ ...f, driverId: e.target.value }))} className="dm-input">
                {activeDriversList.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="disp-orig" className="dm-label">Origin *</label>
            <input id="disp-orig" required value={dispatchForm.originAddress} onChange={(e) => setDispatchForm((f) => ({ ...f, originAddress: e.target.value }))} className="dm-input" />
          </div>
          <div>
            <label htmlFor="disp-dest" className="dm-label">Destination *</label>
            <input id="disp-dest" required value={dispatchForm.destinationAddress} onChange={(e) => setDispatchForm((f) => ({ ...f, destinationAddress: e.target.value }))} className="dm-input" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setDispatchOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Start Dispatch</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

