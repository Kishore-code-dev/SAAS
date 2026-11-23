import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Fuel,
  MapPin,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { useOnlineStatus } from '../hooks/usePWAInstall'
import {
  createOfflineQueueItem,
  enqueueOfflineItem,
  loadOfflineQueue,
  markOfflineItemStatus,
  pruneSyncedOfflineItems,
  saveOfflineQueue,
  type OfflineActionType,
  type OfflineSyncItem,
} from '../utils/offlineSyncQueue'
import PageHeader from '../components/layout/PageHeader'
import { formatInr } from '../components/ui/EnterprisePrimitives'

export default function MobileAppSimulator() {
  const navigate = useNavigate()
  const browserOnline = useOnlineStatus()
  const { activeOrganization, vehicles, drivers, trips, workOrders, fuelTransactions, financialSummary } = useFleet()

  const [offlineOverride, setOfflineOverride] = useState(false)
  const effectiveOnline = browserOnline && !offlineOverride

  const [queue, setQueue] = useState<OfflineSyncItem[]>(() => loadOfflineQueue())
  const [selectedVehicleId, setSelectedVehicleId] = useState(() => vehicles[0]?.id ?? '')
  const [fuelLiters, setFuelLiters] = useState('44.5')
  const [fuelAmount, setFuelAmount] = useState('4200')
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null)
  const [gpsStatus, setGpsStatus] = useState<{ lat: number; lng: number; capturedAt: string } | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? vehicles[0]
  const pendingItems = queue.filter((q) => q.status !== 'synced')
  const avgHealth =
    vehicles.length > 0
      ? Math.round(vehicles.reduce((sum, v) => sum + v.healthScore, 0) / vehicles.length)
      : 0
  const activeTrip = trips.find((t) => t.status === 'active') ?? trips[0]
  const pendingFuelReview = fuelTransactions.filter((f) => f.verificationStatus === 'needs_review').length

  const updateAndPersistQueue = (next: OfflineSyncItem[]) => {
    setQueue(next)
    saveOfflineQueue(next)
  }

  const recordFieldAction = (type: OfflineActionType, endpoint: string, summary: string, payload: Record<string, unknown>) => {
    const item = createOfflineQueueItem({
      id: `op-${Date.now()}-${type}`,
      type,
      endpoint,
      summary,
      payload,
      createdAt: new Date().toISOString(),
    })

    if (!effectiveOnline) {
      const next = enqueueOfflineItem(queue, item)
      updateAndPersistQueue(next)
      toast.info(`Saved offline: ${summary}`)
      return
    }

    const synced = markOfflineItemStatus(enqueueOfflineItem(queue, item), item.id, 'synced')
    updateAndPersistQueue(synced)
    toast.success(`Synced to fleet cloud: ${summary}`)
  }

  const flushOfflineQueue = () => {
    if (!effectiveOnline) {
      toast.error('Reconnect to internet before syncing pending operations.')
      return
    }
    let next = [...queue]
    for (const item of pendingItems) {
      next = markOfflineItemStatus(next, item.id, 'synced')
    }
    const remaining = pruneSyncedOfflineItems(next)
    updateAndPersistQueue(remaining)
    toast.success(`Synchronized ${pendingItems.length} offline record(s).`)
  }

  const toggleOfflineMode = () => {
    setOfflineOverride((prev) => !prev)
  }

  const handleCaptureGps = () => {
    setGpsBusy(true)
    const fallbackCoord = {
      lat: selectedVehicle?.telemetry.location.lat ?? 11.0168,
      lng: selectedVehicle?.telemetry.location.lng ?? 76.9558,
    }
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coord = {
            lat: Number(pos.coords.latitude.toFixed(5)),
            lng: Number(pos.coords.longitude.toFixed(5)),
            capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }
          setGpsStatus(coord)
          setGpsBusy(false)
          recordFieldAction(
            'odometer_ping',
            '/api/fleet/telemetry/ping',
            `GPS checkpoint (${coord.lat}, ${coord.lng}) for ${selectedVehicle?.registrationNumber ?? 'fleet'}`,
            coord,
          )
        },
        () => {
          const coord = {
            ...fallbackCoord,
            capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          }
          setGpsStatus(coord)
          setGpsBusy(false)
          recordFieldAction(
            'odometer_ping',
            '/api/fleet/telemetry/ping',
            `Corridor GPS checkpoint (${coord.lat}, ${coord.lng})`,
            coord,
          )
        },
        { timeout: 3000 },
      )
      return
    }
    const coord = {
      ...fallbackCoord,
      capturedAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    }
    setGpsStatus(coord)
    setGpsBusy(false)
    recordFieldAction('odometer_ping', '/api/fleet/telemetry/ping', `GPS checkpoint (${coord.lat}, ${coord.lng})`, coord)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Device, Offline Sync & Field Capture"
        subtitle={`${activeOrganization.name} · Smartphone GPS check-ins, receipt camera upload, and offline synchronization queue`}
      >
        <button
          type="button"
          onClick={toggleOfflineMode}
          className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-2 whitespace-nowrap ${
            effectiveOnline
              ? 'bg-[#EAF7EF] border-[#1F7A4C] text-[#156C3F]'
              : 'bg-[#FCECEB] border-[#D9786C] text-[#B84E42]'
          }`}
        >
          {effectiveOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          <span>{effectiveOnline ? 'Online · Cloud Synced' : `Offline Mode (${pendingItems.length} Queued)`}</span>
        </button>
      </PageHeader>

      {/* Live Fleet Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="enterprise-card p-4">
          <p className="text-xs font-medium text-[#958777]">Active Vehicles</p>
          <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">{vehicles.length}</p>
          <p className="text-xs text-[#4D6E4A] mt-0.5">{avgHealth}% avg health</p>
        </div>
        <div className="enterprise-card p-4">
          <p className="text-xs font-medium text-[#958777]">Driver Roster</p>
          <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">{drivers.length}</p>
          <p className="text-xs text-[#958777] mt-0.5">{activeTrip ? activeTrip.status : 'Standby'}</p>
        </div>
        <div className="enterprise-card p-4">
          <p className="text-xs font-medium text-[#958777]">Open Work Orders</p>
          <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">{workOrders.length}</p>
          <p className="text-xs text-[#958777] mt-0.5">{pendingFuelReview} fuel checks</p>
        </div>
        <div className="enterprise-card p-4">
          <p className="text-xs font-medium text-[#958777]">30d Operating Spend</p>
          <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">
            {formatInr(financialSummary.operatingExpenditureInr)}
          </p>
          <p className="text-xs text-[#958777] mt-0.5">Live telemetry ledger</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Field Actions & Receipt Capture */}
        <div className="lg:col-span-6 enterprise-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="dm-card-title flex items-center gap-2">
              <Fuel className="w-4 h-4 text-[#6E5696]" />
              <span>Mobile Fuel &amp; Evidence Capture</span>
            </h2>
            <span className="text-xs font-semibold text-[#6E5696]">
              {effectiveOnline ? 'Direct Upload' : 'Local Queue'}
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              recordFieldAction(
                'fuel_log',
                '/api/fleet/fuel',
                `${fuelLiters}L · ₹${fuelAmount} (${selectedVehicle?.registrationNumber ?? 'Vehicle'}${receiptFileName ? ` · ${receiptFileName}` : ''})`,
                {
                  vehicleId: selectedVehicle?.id,
                  litersOrKwh: Number(fuelLiters),
                  amountInr: Number(fuelAmount),
                  receiptFileName,
                },
              )
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="mobile-vehicle-select" className="dm-label">
                Select Vehicle
              </label>
              <select
                id="mobile-vehicle-select"
                value={selectedVehicle?.id ?? ''}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="dm-input min-h-[44px]"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} · {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="mobile-fuel-liters" className="dm-label">
                  Quantity (L / kWh)
                </label>
                <input
                  id="mobile-fuel-liters"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={fuelLiters}
                  onChange={(e) => setFuelLiters(e.target.value)}
                  className="dm-input min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label htmlFor="mobile-fuel-amount" className="dm-label">
                  Total Amount (INR)
                </label>
                <input
                  id="mobile-fuel-amount"
                  type="number"
                  min="1"
                  value={fuelAmount}
                  onChange={(e) => setFuelAmount(e.target.value)}
                  className="dm-input min-h-[44px]"
                  required
                />
              </div>
            </div>

            <label className="min-h-[44px] px-4 py-2.5 rounded-xl border border-dashed border-[#B8A3D9] bg-[#EEE8F7]/40 hover:bg-[#EEE8F7] flex items-center justify-between gap-3 cursor-pointer text-xs font-semibold text-[#625346]">
              <span className="flex items-center gap-2 truncate">
                <Camera className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span className="truncate">
                  {receiptFileName ? `Attached: ${receiptFileName}` : 'Capture Fuel Pump / Receipt Photo'}
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setReceiptFileName(file.name)
                }}
                className="sr-only"
              />
              <span className="text-[#6E5696] shrink-0">Camera</span>
            </label>

            <button type="submit" className="btn-accent w-full min-h-[46px] text-sm">
              {effectiveOnline ? 'Submit Fuel Log & Receipt' : 'Queue Fuel Log Offline'}
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#E5E5E5]">
            <button
              type="button"
              disabled={gpsBusy}
              onClick={handleCaptureGps}
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#6E5696] flex items-center gap-2.5 text-left text-xs font-semibold text-[#625346]"
            >
              <MapPin className="w-4 h-4 text-[#6E5696] shrink-0" />
              <div className="min-w-0">
                <p className="truncate">{gpsBusy ? 'Acquiring GPS...' : 'Record GPS Checkpoint'}</p>
                <p className="text-[11px] font-normal text-[#958777] truncate">
                  {gpsStatus ? `${gpsStatus.lat}, ${gpsStatus.lng} · ${gpsStatus.capturedAt}` : 'Uses device location API'}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                recordFieldAction(
                  'dvir_check',
                  '/api/fleet/inspections',
                  `Pre-trip DVIR checklist signed for ${selectedVehicle?.registrationNumber ?? 'Vehicle'}`,
                  { vehicleId: selectedVehicle?.id, status: 'passed' },
                )
              }
              className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#1F7A4C] flex items-center gap-2.5 text-left text-xs font-semibold text-[#625346]"
            >
              <ClipboardCheck className="w-4 h-4 text-[#1F7A4C] shrink-0" />
              <div className="min-w-0">
                <p className="truncate">Sign Pre-Trip DVIR</p>
                <p className="text-[11px] font-normal text-[#958777] truncate">
                  {selectedVehicle?.registrationNumber ?? 'Assigned Asset'}
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Offline Sync Queue & Quick Module Navigation */}
        <div className="lg:col-span-6 space-y-5">
          <div className="enterprise-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="dm-card-title flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#6E5696]" />
                <span>Offline Synchronization Queue ({pendingItems.length})</span>
              </h2>
              {pendingItems.length > 0 && (
                <button
                  type="button"
                  onClick={flushOfflineQueue}
                  className="min-h-[36px] px-3 py-1 rounded-lg bg-[#EEE8F7] text-xs font-bold text-[#6E5696] hover:bg-[#E4DAF4] inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Now</span>
                </button>
              )}
            </div>

            {pendingItems.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#EDF4EC] border border-[#C6DBC3] flex items-center gap-2.5 text-xs text-[#4D6E4A] font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>All mobile field entries are synchronized with DriveMitra cloud storage.</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {pendingItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#FCF5DE] border border-[#D8B442] flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#625346] truncate">{item.summary}</p>
                      <p className="text-[11px] text-[#958777] mt-0.5">
                        {item.endpoint} · {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className="text-[11px] font-bold uppercase text-[#A56021] shrink-0">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="enterprise-card p-5 space-y-3">
            <h2 className="dm-card-title flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#6E5696]" />
              <span>Expo Go Mobile App &amp; QR Code</span>
            </h2>
            <p className="text-xs text-[#958777]">
              Scan the QR code below using the <strong className="text-[#625346]">Expo Go</strong> app on iOS or Android to test the DriveMitra mobile driver &amp; staff portal live.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
              <div className="w-32 h-32 bg-white p-2 rounded-xl border border-[#E5E5E5] flex items-center justify-center shrink-0 shadow-sm">
                {/* SVG QR Code representation for Expo Go URL */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900">
                  <path fill="currentColor" d="M0 0h30v30H0zM10 10h10v10H10zM40 0h20v10H40zM70 0h30v30H70zM80 10h10v10H80zM0 40h10v20H0zM20 40h20v10H20zM50 40h10v20H50zM70 40h10v10H70zM90 40h10v20H90zM20 60h10v10H20zM40 60h20v10H40zM70 70h10v20H70zM0 70h30v30H0zM10 80h10v10H10zM40 80h10v10H40zM60 80h10v20H60zM80 80h20v20H80z" />
                </svg>
              </div>
              <div className="space-y-2 text-xs">
                <p className="font-bold text-[#625346]">Expo Dev URI:</p>
                <code className="px-2.5 py-1 rounded-lg bg-[#EEE8F7] text-[#6E5696] font-mono block select-all">
                  exp://127.0.0.1:8081
                </code>
                <p className="text-[#958777]">
                  Run <code className="text-[#625346]">npx expo start</code> in your <code className="text-[#625346]">/mobile</code> folder to broadcast your local Metro bundler.
                </p>
              </div>
            </div>
          </div>

          <div className="enterprise-card p-5 space-y-3">
            <h2 className="dm-card-title">Mobile Operational Shortcuts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                { label: 'Register New Vehicle', route: '/dashboard/fleet/new', icon: Smartphone },
                { label: 'Vehicle Contracts', route: '/dashboard/contracts', icon: FileText },
                { label: 'Workshop Work Orders', route: '/dashboard/work-orders', icon: Wrench },
                { label: 'Fuel & Charging Audit', route: '/dashboard/fuel', icon: Fuel },
              ].map((shortcut) => {
                const Icon = shortcut.icon
                return (
                  <button
                    key={shortcut.route}
                    type="button"
                    onClick={() => navigate(shortcut.route)}
                    className="min-h-[48px] px-3.5 py-2.5 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#6E5696] flex items-center justify-between text-xs font-semibold text-[#625346] transition-colors"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-[#6E5696]" />
                      <span>{shortcut.label}</span>
                    </span>
                    <span className="text-[#6E5696]">Open →</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
