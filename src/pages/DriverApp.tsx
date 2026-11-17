import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Battery,
  CheckCircle2,
  ClipboardCheck,
  CloudOff,
  Fuel,
  MapPin,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldAlert,
  Smartphone,
  Square,
  Wifi,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { languageOptions } from '../i18n/translations'
import { formatDateTime, formatInr, SeverityText } from '../components/ui/EnterprisePrimitives'
import { BrandLogo } from '../components/ui/BrandLogo'

type DriverTab = 'home' | 'trips' | 'fuel' | 'inspect' | 'settings'

export default function DriverApp({ initialTab = 'home' }: { initialTab?: DriverTab }) {
  const navigate = useNavigate()
  const {
    activeOrganization,
    activeRole,
    drivers,
    vehicles,
    trips,
    fuelTransactions,
    maintenanceRecords,
    currentDriverId,
    setCurrentDriverId,
    currentDriverTrip,
    offlineQueuedTripsCount,
    startTrip,
    endTrip,
    syncOfflineTrips,
    addFuelTransaction,
    submitVehicleInspection,
    reportDriverIssue,
    updateTelemetryState,
  } = useFleet()
  const { language, setLanguage } = useTranslation()

  const [tab, setTab] = useState<DriverTab>(initialTab)
  const [offlineMode, setOfflineMode] = useState(false)
  const [gpsEnabled, setGpsEnabled] = useState(true)
  const [batteryOptExempt, setBatteryOptExempt] = useState(true)
  const [fuelError, setFuelError] = useState<string | null>(null)

  const activeDrivers = drivers.filter((d) => d.status !== 'onboarding')
  const driver = activeDrivers.find((d) => d.id === currentDriverId) ?? activeDrivers[0] ?? null
  const assignedVehicle = vehicles.find((v) => v.id === driver?.assignedVehicleId) ?? vehicles[0] ?? null
  const canSwitchDriver = activeRole !== 'driver'
  const motionEnabled = assignedVehicle?.telemetry.motionPermissionGranted ?? true

  const [tripForm, setTripForm] = useState({
    origin: 'Chennai Freight Depot',
    destination: 'Tambaram Distribution Bay',
  })

  const [fuelFormDraft, setFuelFormDraft] = useState({
    vehicleId: assignedVehicle?.id ?? '',
    station: 'Indian Oil Highway Pump',
    litersOrKwh: 30,
    amountInr: 2760,
    odometerKm: assignedVehicle?.odometerKm ? assignedVehicle.odometerKm + 40 : 48240,
    paymentMethod: 'upi' as const,
  })

  const fuelForm =
    fuelFormDraft.vehicleId === (assignedVehicle?.id ?? '')
      ? fuelFormDraft
      : {
          ...fuelFormDraft,
          vehicleId: assignedVehicle?.id ?? '',
          odometerKm: assignedVehicle?.odometerKm ? assignedVehicle.odometerKm + 40 : 48240,
        }

  const [inspForm, setInspForm] = useState({
    tyreCondition: 'good' as 'good' | 'worn' | 'critical',
    brakeFeel: 'normal' as 'normal' | 'spongy' | 'squealing',
    fluidLeaksDetected: false,
    warningLightsOn: false,
    batteryOrStartingIssue: false,
    notes: '',
  })

  const [issueForm, setIssueForm] = useState({
    title: '',
    message: '',
    severity: 'high' as 'medium' | 'high' | 'critical',
  })

  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!currentDriverTrip) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [currentDriverTrip])

  const driverTrips = driver ? trips.filter((t) => t.driverId === driver.id) : []
  const driverFuel = driver ? fuelTransactions.filter((f) => f.driverId === driver.id) : []
  const vehicleMaint = assignedVehicle
    ? maintenanceRecords.filter((m) => m.vehicleId === assignedVehicle.id)
    : []

  const handleToggleOffline = (nextOffline: boolean) => {
    setOfflineMode(nextOffline)
    if (assignedVehicle) {
      updateTelemetryState(assignedVehicle.id, {
        connectionState: nextOffline ? 'intermittent' : 'connected',
      })
    }
    toast.info(
      nextOffline
        ? 'Offline queue enabled: trips started offline will sync when signal restores.'
        : 'Network connected.',
    )
  }

  const handleToggleGps = (nextGps: boolean) => {
    setGpsEnabled(nextGps)
    if (assignedVehicle) {
      updateTelemetryState(assignedVehicle.id, {
        connectionState: nextGps ? (offlineMode ? 'intermittent' : 'connected') : 'disconnected',
      })
    }
    if (!nextGps && currentDriverTrip) {
      toast.error('GPS permission revoked mid-trip. Live telemetry is paused.')
    }
  }

  const handleToggleMotion = (nextMotion: boolean) => {
    if (assignedVehicle) {
      updateTelemetryState(assignedVehicle.id, {
        motionPermissionGranted: nextMotion,
      })
    }
    toast.info(
      nextMotion
        ? 'Accelerometer / motion sensor access enabled.'
        : 'Motion sensor disabled: automatic harsh braking/cornering penalties suspended.',
    )
  }

  const handleStartTrip = () => {
    if (!driver || !assignedVehicle) {
      toast.error('Assign a vehicle to this driver before starting a trip.')
      return
    }
    if (!gpsEnabled) {
      toast.error('Enable GPS permission before starting a tracked trip.')
      return
    }
    try {
      const created = startTrip(
        driver.id,
        assignedVehicle.id,
        tripForm.origin,
        tripForm.destination,
        offlineMode,
      )
      if (created) {
        toast.success(
          offlineMode
            ? 'Trip started in offline queue mode.'
            : 'Trip started. Driving-safety simplified mode active.',
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to start trip.')
    }
  }

  const handleEndTrip = () => {
    if (!currentDriverTrip) return
    try {
      endTrip(currentDriverTrip.id)
      toast.success('Trip completed and odometer updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to end trip.')
    }
  }

  const handleSubmitFuel = (e: React.FormEvent) => {
    e.preventDefault()
    setFuelError(null)
    if (!driver || !assignedVehicle) return
    if (Number(fuelForm.litersOrKwh) <= 0 || Number(fuelForm.amountInr) <= 0) {
      setFuelError('Quantity and amount must be greater than zero.')
      return
    }
    if (Number(fuelForm.odometerKm) < 0) {
      setFuelError('Odometer reading cannot be negative.')
      return
    }
    try {
      addFuelTransaction({
        vehicleId: assignedVehicle.id,
        driverId: driver.id,
        amountInr: Number(fuelForm.amountInr),
        litersOrKwh: Number(fuelForm.litersOrKwh),
        unitPriceInr: Number((fuelForm.amountInr / fuelForm.litersOrKwh).toFixed(2)),
        odometerKm: Number(fuelForm.odometerKm),
        station: fuelForm.station,
        location: assignedVehicle.telemetry.location,
        timestamp: new Date().toISOString(),
        paymentMethod: fuelForm.paymentMethod,
        entrySource: 'manual_driver_entry',
      })
      toast.success('Fuel entry submitted for verification.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to submit fuel log.'
      setFuelError(msg)
      toast.error(msg)
    }
  }

  const handleSubmitInspection = (e: React.FormEvent) => {
    e.preventDefault()
    if (!driver || !assignedVehicle) return
    try {
      const saved = submitVehicleInspection({
        vehicleId: assignedVehicle.id,
        driverId: driver.id,
        ...inspForm,
      })
      toast.success(
        saved.passed
          ? 'Pre-trip inspection logged: Vehicle cleared.'
          : 'Inspection logged with mechanical flags sent to fleet maintenance.',
      )
      setInspForm((s) => ({ ...s, notes: '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit inspection.')
    }
  }

  const handleReportIssue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!driver || !assignedVehicle || !issueForm.title.trim()) {
      toast.error('Please summarize the vehicle issue.')
      return
    }
    try {
      reportDriverIssue(
        assignedVehicle.id,
        driver.id,
        issueForm.title.trim(),
        issueForm.message.trim() || 'Reported from Driver Mobile Companion.',
        issueForm.severity,
      )
      toast.success('Issue reported to Fleet Command Centre.')
      setIssueForm({ title: '', message: '', severity: 'high' })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to report issue.')
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#625346] pb-24">
      {/* Compact Sticky Mobile Top Bar (< 56px, well within 15% mobile cap) */}
      <header className="sticky top-0 z-30 h-14 bg-[#FFFFFF] border-b border-[#E5E5E5] px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {canSwitchDriver && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="Back to Fleet Command Centre"
              className="p-2 -ml-1 rounded-[10px] text-[#625346] hover:bg-[#EEE8F7]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <BrandLogo size="sm" className="border border-[#E5E5E5]" />
          <div className="min-w-0">
            <p className="font-bold text-sm text-[#625346] truncate">
              Driver App
            </p>
            <p className="text-[11px] text-[#958777] truncate">{activeOrganization.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {offlineMode ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#625346] bg-[#E8C65A]/30 border border-[#D8B442] px-2.5 py-1 rounded-[8px]">
              <CloudOff className="w-3.5 h-3.5 text-[#A56021]" />
              Offline
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#625346] bg-[#789A75]/22 border border-[#789A75] px-2.5 py-1 rounded-[8px]">
              <Wifi className="w-3.5 h-3.5 text-[#4D6E4A]" />
              Online
            </span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* GPS Permission Revoked Mid-Trip Warning */}
        {!gpsEnabled && currentDriverTrip && (
          <div role="alert" className="p-3.5 rounded-xl bg-[#D9786C]/22 border border-[#D9786C] flex items-start gap-2.5 text-xs text-[#625346]">
            <AlertTriangle className="w-4 h-4 text-[#B84E42] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">GPS Permission Revoked Mid-Trip</p>
              <p className="mt-0.5">
                Live location telemetry is paused for {currentDriverTrip.originAddress} → {currentDriverTrip.destinationAddress}. Re-enable GPS in Device settings or end trip safely.
              </p>
            </div>
          </div>
        )}

        {/* Offline Queue Recovery Banner */}
        {offlineQueuedTripsCount > 0 && !offlineMode && (
          <div className="lavender-surface p-3.5 border-[#B8A3D9] flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[#625346]">
              {offlineQueuedTripsCount} offline trip(s) ready to synchronize
            </p>
            <button
              type="button"
              onClick={() => {
                const count = syncOfflineTrips()
                toast.success(`Synchronized ${count} offline trip(s).`)
              }}
              className="btn-primary text-xs px-3 py-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Sync Now
            </button>
          </div>
        )}

        {/* Active Driver Session (Locked when authenticated as Driver role) */}
        {activeDrivers.length > 0 && (
          <div className="enterprise-card p-3.5 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] text-[#958777] block">Active Driver Session</span>
              <span className="text-sm font-bold text-[#625346]">{driver?.name}</span>
            </div>
            {canSwitchDriver ? (
              <>
                <label htmlFor="driver-session-select" className="sr-only">Switch Driver</label>
                <select
                  id="driver-session-select"
                  value={driver?.id ?? ''}
                  onChange={(e) => setCurrentDriverId(e.target.value)}
                  className="dm-input py-1.5 text-xs w-auto max-w-[180px]"
                >
                  {activeDrivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </>
            ) : (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-[8px] bg-[#EEE8F7] border border-[#DDD3ED] text-[#6E5696]">
                Session Locked
              </span>
            )}
          </div>
        )}

        {tab === 'home' && (
          <>
            {/* Assigned Vehicle Card */}
            {assignedVehicle ? (
              <div className="enterprise-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs text-[#958777]">Assigned Vehicle</span>
                    <p className="text-lg font-bold text-[#625346] tabular-nums">
                      {assignedVehicle.registrationNumber}
                    </p>
                    <p className="text-xs text-[#958777]">
                      {assignedVehicle.make} {assignedVehicle.model} · {assignedVehicle.powertrain}
                    </p>
                  </div>
                  <SeverityText
                    severity={assignedVehicle.healthScore <= 49 ? 'critical' : assignedVehicle.healthScore <= 74 ? 'at-risk' : 'healthy'}
                    label={`Health ${assignedVehicle.healthScore}%`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E5E5] text-xs">
                  <div>
                    <span className="text-[#958777] block">Odometer</span>
                    <span className="font-semibold tabular-nums text-[#625346]">
                      {assignedVehicle.odometerKm.toLocaleString('en-IN')} km
                    </span>
                  </div>
                  <div>
                    <span className="text-[#958777] block">{assignedVehicle.powertrain === 'EV' ? 'Battery' : 'Fuel'}</span>
                    <span className="font-semibold tabular-nums text-[#625346]">{assignedVehicle.fuelOrSocPct}%</span>
                  </div>
                  <div>
                    <span className="text-[#958777] block">Safety Score</span>
                    <span className="font-semibold tabular-nums text-[#625346]">{driver?.safetyScore ?? 0}/100</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="enterprise-card p-6 text-center text-sm text-[#958777]">
                No vehicle assigned in active organization.
              </div>
            )}

            {/* Active Trip / Driving-Safety Simplified Mode OR Start Trip Card */}
            {currentDriverTrip ? (
              <div className="bg-[#EEE8F7] border-2 border-[#B8A3D9] text-[#625346] rounded-xl p-5 space-y-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#625346] inline-flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${gpsEnabled ? 'bg-[#789A75]' : 'bg-[#D9786C]'}`} />
                    Trip Active · Driving Safety Mode
                  </span>
                  <span className="text-xs font-medium text-[#958777]">
                    {!gpsEnabled ? 'GPS Paused' : currentDriverTrip.offlineSynced === false ? 'Offline Queued' : 'Live Sync'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#625346]">
                    {currentDriverTrip.originAddress} → {currentDriverTrip.destinationAddress}
                  </p>
                  <p className="text-xs text-[#958777] mt-1">
                    Non-essential settings are minimized while vehicle is in motion.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs bg-[#FFFFFF] border border-[#E5E5E5] rounded-[10px] p-3">
                  <div>
                    <span className="text-[#958777] block">Elapsed</span>
                    <span className="text-lg font-bold tabular-nums text-[#625346]">
                      {Math.max(1, Math.round((nowMs - new Date(currentDriverTrip.startTime).getTime()) / 60000))} min
                    </span>
                  </div>
                  <div>
                    <span className="text-[#958777] block">Distance</span>
                    <span className="text-lg font-bold tabular-nums text-[#625346]">
                      {currentDriverTrip.distanceKm} km
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleEndTrip}
                  className="btn-danger w-full min-h-[48px] text-sm font-bold"
                >
                  <Square className="w-4 h-4 fill-current text-[#B84E42]" />
                  End Trip Safely
                </button>
              </div>
            ) : (
              <div className="enterprise-card p-5 space-y-3">
                <h2 className="dm-card-title">Start Shift Trip</h2>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="drv-orig" className="dm-label">Origin</label>
                    <input
                      id="drv-orig"
                      value={tripForm.origin}
                      onChange={(e) => setTripForm((f) => ({ ...f, origin: e.target.value }))}
                      className="dm-input min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="drv-dest" className="dm-label">Destination</label>
                    <input
                      id="drv-dest"
                      value={tripForm.destination}
                      onChange={(e) => setTripForm((f) => ({ ...f, destination: e.target.value }))}
                      className="dm-input min-h-[44px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleStartTrip}
                    className="btn-primary w-full min-h-[48px] text-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Trip
                  </button>
                </div>
              </div>
            )}

            {/* Quick Issue Report */}
            <form onSubmit={handleReportIssue} className="enterprise-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#A56021]" />
                <h2 className="dm-card-title text-sm">Report Mechanical or Roadside Issue</h2>
              </div>
              <input
                value={issueForm.title}
                onChange={(e) => setIssueForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Issue summary (e.g. Brake vibration)"
                aria-label="Issue summary"
                className="dm-input min-h-[44px]"
              />
              <div className="flex items-center gap-2">
                <select
                  value={issueForm.severity}
                  onChange={(e) => setIssueForm((s) => ({ ...s, severity: e.target.value as 'medium' | 'high' | 'critical' }))}
                  aria-label="Issue severity"
                  className="dm-input min-h-[44px] w-36"
                >
                  <option value="medium">Moderate</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
                <button type="submit" className="btn-secondary flex-1 min-h-[44px] text-xs">
                  Send to Fleet Desk
                </button>
              </div>
            </form>
          </>
        )}

        {tab === 'trips' && (
          <div className="space-y-3">
            <h2 className="dm-card-title">My Trip & Service History</h2>
            {driverTrips.map((t) => (
              <div key={t.id} className="enterprise-card p-4 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#625346]">{t.originAddress} → {t.destinationAddress}</span>
                  <SeverityText severity={t.status === 'completed' ? 'normal' : 'moderate'} label={t.status} />
                </div>
                <p className="text-xs text-[#958777] tabular-nums">
                  {t.distanceKm} km · {t.durationMinutes} min · {formatDateTime(t.startTime)}
                </p>
              </div>
            ))}
            {driverTrips.length === 0 && (
              <p className="enterprise-card p-6 text-center text-xs text-[#958777]">No trips logged yet.</p>
            )}

            <h3 className="dm-card-title text-sm pt-2">Assigned Vehicle Service Log</h3>
            {vehicleMaint.map((m) => (
              <div key={m.id} className="enterprise-card p-4 text-xs space-y-1">
                <div className="flex justify-between font-semibold text-[#625346]">
                  <span>{m.serviceType}</span>
                  <span className="tabular-nums">{formatInr(m.costInr)}</span>
                </div>
                <p className="text-[#958777]">{m.serviceCenter} · {m.status}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'fuel' && (
          <div className="space-y-4">
            <form onSubmit={handleSubmitFuel} className="enterprise-card p-5 space-y-3">
              <h2 className="dm-card-title">Log Fuel or Charging Entry</h2>
              {fuelError && (
                <div role="alert" className="p-3 rounded-[10px] bg-[#D9786C]/20 border border-[#D9786C] text-xs font-semibold text-[#625346]">
                  {fuelError}
                </div>
              )}
              <div>
                <label htmlFor="m-station" className="dm-label">Station / Charger</label>
                <input id="m-station" required value={fuelForm.station} onChange={(e) => { setFuelError(null); setFuelFormDraft({ ...fuelForm, station: e.target.value }) }} className="dm-input min-h-[44px]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="m-liters" className="dm-label">Liters / kWh</label>
                  <input id="m-liters" type="number" step="0.1" min={0.1} required value={fuelForm.litersOrKwh} onChange={(e) => { setFuelError(null); setFuelFormDraft({ ...fuelForm, litersOrKwh: Number(e.target.value) }) }} className="dm-input tabular-nums min-h-[44px]" />
                </div>
                <div>
                  <label htmlFor="m-amt" className="dm-label">Amount (INR)</label>
                  <input id="m-amt" type="number" min={1} required value={fuelForm.amountInr} onChange={(e) => { setFuelError(null); setFuelFormDraft({ ...fuelForm, amountInr: Number(e.target.value) }) }} className="dm-input tabular-nums min-h-[44px]" />
                </div>
              </div>
              <div>
                <label htmlFor="m-odo" className="dm-label">Current Odometer (km)</label>
                <input id="m-odo" type="number" min={0} required value={fuelForm.odometerKm} onChange={(e) => { setFuelError(null); setFuelFormDraft({ ...fuelForm, odometerKm: Number(e.target.value) }) }} className="dm-input tabular-nums min-h-[44px]" />
              </div>
              <button type="submit" className="btn-primary w-full min-h-[48px]">Submit Fuel Log</button>
            </form>

            <div className="space-y-2">
              {driverFuel.map((f) => (
                <div key={f.id} className="enterprise-card p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#625346]">{f.station}</p>
                    <p className="text-[#958777] tabular-nums">{f.litersOrKwh} units · {f.odometerKm} km</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#625346] tabular-nums">{formatInr(f.amountInr)}</p>
                    <span className="text-[#958777] capitalize">{f.verificationStatus.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'inspect' && (
          <form onSubmit={handleSubmitInspection} className="enterprise-card p-5 space-y-4">
            <h2 className="dm-card-title">Pre-Trip Vehicle Inspection</h2>
            <div>
              <label htmlFor="insp-tyre" className="dm-label">Tyre Condition</label>
              <select id="insp-tyre" value={inspForm.tyreCondition} onChange={(e) => setInspForm((f) => ({ ...f, tyreCondition: e.target.value as typeof f.tyreCondition }))} className="dm-input min-h-[44px]">
                <option value="good">Good tread & pressure</option>
                <option value="worn">Uneven wear / low tread</option>
                <option value="critical">Cut / unsafe sidewall</option>
              </select>
            </div>
            <div>
              <label htmlFor="insp-brake" className="dm-label">Brake Pedal Feel</label>
              <select id="insp-brake" value={inspForm.brakeFeel} onChange={(e) => setInspForm((f) => ({ ...f, brakeFeel: e.target.value as typeof f.brakeFeel }))} className="dm-input min-h-[44px]">
                <option value="normal">Firm and responsive</option>
                <option value="spongy">Spongy / soft pedal</option>
                <option value="squealing">Audible grinding or squealing</option>
              </select>
            </div>
            <div className="space-y-2.5 text-sm">
              <label className="flex items-center justify-between min-h-[44px]">
                <span>Any visible fluid or oil leaks?</span>
                <input type="checkbox" checked={inspForm.fluidLeaksDetected} onChange={(e) => setInspForm((f) => ({ ...f, fluidLeaksDetected: e.target.checked }))} className="w-5 h-5 accent-[#6E5696]" />
              </label>
              <label className="flex items-center justify-between min-h-[44px]">
                <span>Dashboard warning lights active?</span>
                <input type="checkbox" checked={inspForm.warningLightsOn} onChange={(e) => setInspForm((f) => ({ ...f, warningLightsOn: e.target.checked }))} className="w-5 h-5 accent-[#6E5696]" />
              </label>
              <label className="flex items-center justify-between min-h-[44px]">
                <span>Battery / starting difficulty?</span>
                <input type="checkbox" checked={inspForm.batteryOrStartingIssue} onChange={(e) => setInspForm((f) => ({ ...f, batteryOrStartingIssue: e.target.checked }))} className="w-5 h-5 accent-[#6E5696]" />
              </label>
            </div>
            <textarea
              rows={2}
              value={inspForm.notes}
              onChange={(e) => setInspForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Optional workshop notes..."
              className="dm-input"
            />
            <button type="submit" className="btn-primary w-full min-h-[48px]">
              <CheckCircle2 className="w-4 h-4" />
              Submit Inspection
            </button>
          </form>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="enterprise-card p-5 space-y-3">
              <h2 className="dm-card-title">Device Readiness & Permissions</h2>
              <label className="flex items-center justify-between min-h-[44px] text-sm">
                <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-[#6E5696]" /> GPS Location Permission</span>
                <input type="checkbox" checked={gpsEnabled} onChange={(e) => handleToggleGps(e.target.checked)} className="w-5 h-5 accent-[#6E5696]" />
              </label>
              <label className="flex items-center justify-between min-h-[44px] text-sm">
                <span className="inline-flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-[#958777]" /> Motion / Accelerometer Access</span>
                <input type="checkbox" checked={motionEnabled} onChange={(e) => handleToggleMotion(e.target.checked)} className="w-5 h-5 accent-[#6E5696]" />
              </label>
              <label className="flex items-center justify-between min-h-[44px] text-sm">
                <span className="inline-flex items-center gap-2"><Battery className="w-4 h-4 text-[#4D6E4A]" /> Battery Optimization Exempted</span>
                <input type="checkbox" checked={batteryOptExempt} onChange={(e) => setBatteryOptExempt(e.target.checked)} className="w-5 h-5 accent-[#6E5696]" />
              </label>
              <label className="flex items-center justify-between min-h-[44px] text-sm border-t border-[#E5E5E5] pt-2">
                <span className="inline-flex items-center gap-2"><CloudOff className="w-4 h-4 text-[#A56021]" /> Simulate Offline Network Mode</span>
                <input type="checkbox" checked={offlineMode} onChange={(e) => handleToggleOffline(e.target.checked)} className="w-5 h-5 accent-[#6E5696]" />
              </label>
            </div>

            <div className="enterprise-card p-5 space-y-3">
              <h2 className="dm-card-title text-sm">Driver App Language</h2>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as typeof language)}
                aria-label="Driver app language"
                className="dm-input min-h-[44px]"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.nativeLabel} ({opt.label})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Thumb-Zone Navigation (height ~58px, well under 15% cap) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 bg-[#FFFFFF] border-t border-[#E5E5E5] px-2 py-1.5 flex items-center justify-around"
        aria-label="Driver app navigation"
      >
        {[
          { id: 'home', label: 'Shift', icon: Smartphone },
          { id: 'trips', label: 'Trips', icon: MapPin },
          { id: 'fuel', label: 'Fuel', icon: Fuel },
          { id: 'inspect', label: 'Inspect', icon: ClipboardCheck },
          { id: 'settings', label: 'Device', icon: SettingsIcon },
        ].map((item) => {
          const Icon = item.icon
          const active = tab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as DriverTab)}
              className={`min-h-[44px] min-w-[56px] px-2 rounded-[10px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
                active
                  ? 'text-[#625346] bg-[#EEE8F7] border border-[#B8A3D9]'
                  : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

