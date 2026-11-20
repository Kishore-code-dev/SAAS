import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'
import { MapPin, Navigation2, Clock, CheckCircle2, AlertTriangle, Camera, Fuel, Receipt, ExternalLink, ChevronRight, Play, Pause, Flag, MapPin as MapPinIcon, Truck, Navigation, Check, X, Loader2, ArrowLeft, Camera as CameraIcon, ImageIcon, MapPin as LocationIcon, Zap, Battery, Thermometer, Shield, FileText, RefreshCw } from 'lucide-react'
import { formatShortDate, formatDateTime } from '../../components/ui/EnterprisePrimitives'
import { toast } from 'sonner'

type TripStatus = 'scheduled' | 'active' | 'completed' | 'delayed' | 'interrupted'

const STATUS_CONFIG: Record<TripStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', icon: Clock, color: 'text-[#6E5696]', bg: 'bg-[#EEE8F7]' },
  active: { label: 'Active', icon: Navigation, color: 'text-[#8F6510]', bg: 'bg-[#FEF3C7]' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-[#1F7A4C]', bg: 'bg-[#ECFDF5]' },
  delayed: { label: 'Delayed', icon: AlertTriangle, color: 'text-[#B84E42]', bg: 'bg-[#FEF2F2]' },
  interrupted: { label: 'Interrupted', icon: X, color: 'text-[#B84E42]', bg: 'bg-[#FEF2F2]' },
}

export default function DriverTripDetail() {
  const { tripId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { trips, vehicles, drivers, endTrip, addFuelTransaction } = useFleet()
  const [trip, setTrip] = useState<typeof trips[0] | null>(null)
  const [vehicle, setVehicle] = useState<typeof vehicles[0] | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showStartOdometer, setShowStartOdometer] = useState(false)
  const [showEndOdometer, setShowEndOdometer] = useState(false)
  const [startOdometer, setStartOdometer] = useState('')
  const [endOdometer, setEndOdometer] = useState('')

  useEffect(() => {
    if (!tripId) return
    const foundTrip = trips.find((t) => t.id === tripId)
    if (foundTrip) {
      setTrip(foundTrip)
      const v = vehicles.find((veh) => veh.id === foundTrip.vehicleId)
      if (v) setVehicle(v)
    }
    setLoading(false)
  }, [tripId, trips, vehicles])

  const handleStartTrip = async () => {
    if (!trip || !startOdometer) return
    setActionLoading(true)
    try {
      // Trip start would be handled by scheduling or updating
      // For now, just navigate back
      toast.success('Trip started (demo)')
      setShowStartOdometer(false)
    } catch (err) {
      toast.error('Failed to start trip')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCompleteTrip = async () => {
    if (!trip || !endOdometer) return
    setActionLoading(true)
    try {
      endTrip(trip.id)
      toast.success('Trip completed')
      setShowEndOdometer(false)
      navigate('/driver/trips')
    } catch (err) {
      toast.error('Failed to complete trip')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#EEE8F7] border-t-[#6E5696] rounded-full animate-spin" />
          <p className="text-sm text-[#958777]">Loading trip details...</p>
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="p-4 text-center">
        <AlertTriangle className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
        <h3 className="font-semibold text-[#625346]">Trip not found</h3>
        <button onClick={() => navigate('/driver/trips')} className="btn-primary mt-4">Back to Trips</button>
      </div>
    )
  }

  const config = STATUS_CONFIG[trip.status as TripStatus] || STATUS_CONFIG.scheduled
  const StatusIcon = config.icon
  const canStart = trip.status === 'scheduled'
  const canComplete = trip.status === 'active'
  const isActive = trip.status === 'active'

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/driver/trips')} className="p-2 rounded-lg hover:bg-[#F0EEE9] text-[#958777]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[#625346]">{trip.originAddress} → {trip.destinationAddress}</h1>
          <p className="text-sm text-[#958777]">{trip.id}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.color} flex items-center gap-1`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {config.label}
        </div>
      </div>

      {/* Trip Overview Card */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#958777] uppercase tracking-wider">From</p>
            <p className="font-medium text-[#625346] mt-1">{trip.originAddress}</p>
          </div>
          <div>
            <p className="text-xs text-[#958777] uppercase tracking-wider">To</p>
            <p className="font-medium text-[#625346] mt-1">{trip.destinationAddress}</p>
          </div>
          <div>
            <p className="text-xs text-[#958777] uppercase tracking-wider">Planned Start</p>
            <p className="font-medium text-[#625346] mt-1">{formatDateTime(trip.startTime)}</p>
          </div>
          <div>
            <p className="text-xs text-[#958777] uppercase tracking-wider">Planned End</p>
            <p className="font-medium text-[#625346] mt-1">{formatDateTime(trip.endTime || trip.startTime)}</p>
          </div>
          {trip.status === 'active' && (
            <div>
              <p className="text-xs text-[#958777] uppercase tracking-wider">Started</p>
              <p className="font-medium text-[#1F7A4C] mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {formatDateTime(trip.startTime)}
              </p>
            </div>
          )}
          {trip.status === 'completed' && trip.endTime && (
            <div>
              <p className="text-xs text-[#958777] uppercase tracking-wider">Completed</p>
              <p className="font-medium text-[#1F7A4C] mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {formatDateTime(trip.endTime)}
              </p>
            </div>
          )}
          {trip.plannedDistanceKm && (
            <div>
              <p className="text-xs text-[#958777] uppercase tracking-wider">Est. Distance</p>
              <p className="font-medium text-[#625346] mt-1">{trip.plannedDistanceKm} km</p>
            </div>
          )}
          {trip.distanceKm && (
            <div>
              <p className="text-xs text-[#958777] uppercase tracking-wider">Actual Distance</p>
              <p className="font-medium text-[#1F7A4C] mt-1">{trip.distanceKm} km</p>
            </div>
          )}
        </div>
      </div>

      {/* Vehicle Info */}
      {vehicle && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#EEE8F7] flex items-center justify-center">
              <Truck className="w-6 h-6 text-[#6E5696]" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[#625346]">{vehicle.registrationNumber}</h3>
              <p className="text-sm text-[#958777]">{vehicle.make} {vehicle.model} · {vehicle.powertrain}</p>
              <p className="text-xs text-[#958777] mt-1">Odometer: {vehicle.odometerKm?.toLocaleString('en-IN')} km</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              vehicle.operationStatus === 'moving' || vehicle.operationStatus === 'idle' ? 'bg-[#ECFDF5] text-[#1F7A4C]' :
              vehicle.operationStatus === 'maintenance' ? 'bg-[#FEF3C7] text-[#8F6510]' :
              'bg-[#F3F4F6] text-[#6B7280]'
            }`}>
              {vehicle.operationStatus.replace('_', ' ')}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {canStart && !showStartOdometer && (
          <button
            onClick={() => setShowStartOdometer(true)}
            className="w-full btn-primary py-3 text-lg flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Trip
          </button>
        )}

        {showStartOdometer && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-4">
            <h3 className="font-semibold text-[#625346]">Record Starting Odometer</h3>
            <p className="text-sm text-[#958777]">Take a photo of the odometer before starting the trip</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                value={startOdometer}
                onChange={(e) => setStartOdometer(e.target.value)}
                placeholder="Odometer reading (km)"
                className="flex-1 dm-input text-xl font-mono tabular-nums text-center"
                min={vehicle?.odometerKm || 0}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowStartOdometer(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartTrip}
                  disabled={actionLoading || !startOdometer || Number(startOdometer) < (vehicle?.odometerKm || 0)}
                  className="flex-1 btn-primary"
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Start Trip'}
                </button>
              </div>
            </div>
            <button
              onClick={() => {}}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <CameraIcon className="w-4 h-4" />
              Capture Odometer Photo
            </button>
          </div>
        )}

        {canComplete && !showEndOdometer && (
          <button
            onClick={() => setShowEndOdometer(true)}
            className="w-full btn-success py-3 text-lg flex items-center justify-center gap-2"
            style={{ backgroundColor: '#1F7A4C', borderColor: '#1F7A4C' }}
          >
            <CheckCircle2 className="w-5 h-5" />
            Complete Trip
          </button>
        )}

        {showEndOdometer && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 space-y-4">
            <h3 className="font-semibold text-[#625346]">Record Ending Odometer</h3>
            <p className="text-sm text-[#958777]">Take a photo of the odometer after completing the trip</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                value={endOdometer}
                onChange={(e) => setEndOdometer(e.target.value)}
                placeholder="Odometer reading (km)"
                className="flex-1 dm-input text-xl font-mono tabular-nums text-center"
                min={Number(startOdometer) || (vehicle?.odometerKm || 0)}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setShowEndOdometer(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteTrip}
                  disabled={actionLoading || !endOdometer || Number(endOdometer) < (Number(startOdometer) || vehicle?.odometerKm || 0)}
                  className="flex-1"
                  style={{ backgroundColor: '#1F7A4C', borderColor: '#1F7A4C' }}
                >
                  {actionLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Complete Trip'}
                </button>
              </div>
            </div>
            <button
              onClick={() => {}}
              className="w-full btn-secondary flex items-center justify-center gap-2"
            >
              <CameraIcon className="w-4 h-4" />
              Capture Odometer Photo
            </button>
          </div>
        )}

        {isActive && (
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/driver/trips/${trip.id}/navigate`)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Navigation2 className="w-4 h-4" />
              Navigation
            </button>
            <button
              onClick={() => navigate(`/driver/trips/${trip.id}/fuel`)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Fuel className="w-4 h-4" />
              Log Fuel
            </button>
            <button
              onClick={() => navigate(`/driver/trips/${trip.id}/expenses`)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <Receipt className="w-4 h-4" />
              Add Expense
            </button>
          </div>
        )}

        {trip.status === 'completed' && (
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-[#1F7A4C]" />
              <div>
                <p className="font-medium text-[#1F7A4C]">Trip Completed</p>
                <p className="text-sm text-[#065F46]">This trip has been marked as completed. You can view the summary and submit any pending expenses or fuel logs.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5]">
          <h3 className="font-semibold text-[#625346]">Trip Actions</h3>
        </div>
        <div className="divide-y divide-[#E5E5E5]">
          <button
            onClick={() => navigate(`/driver/trips/${trip.id}/fuel`)}
            className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#FAFAFA] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
              <Fuel className="w-5 h-5 text-[#1F7A4C]" />
            </div>
            <div>
              <p className="font-medium text-[#625346]">Log Fuel</p>
              <p className="text-xs text-[#958777]">Record refuelling for this trip</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D1D5DB] ml-auto" />
          </button>
          <button
            onClick={() => navigate(`/driver/trips/${trip.id}/expenses`)}
            className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#FAFAFA] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#EEE8F7] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-[#6E5696]" />
            </div>
            <div>
              <p className="font-medium text-[#625346]">Add Expense</p>
              <p className="text-xs text-[#958777]">Submit tolls, parking, meals</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D1D5DB] ml-auto" />
          </button>
          <button
            onClick={() => navigate(`/driver/trips/${trip.id}/issues`)}
            className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#FAFAFA] transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-[#B84E42]" />
            </div>
            <div>
              <p className="font-medium text-[#625346]">Report Issue</p>
              <p className="text-xs text-[#958777]">Vehicle problem during trip</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D1D5DB] ml-auto" />
          </button>
        </div>
      </div>
    </div>
  )
}