import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'
import { MapPin, Navigation2, Clock, CheckCircle2, AlertTriangle, Camera, Fuel, Receipt, ExternalLink, ChevronRight, Play, Pause, Flag, MapPin as MapPinIcon, Truck, Navigation, Check, X, Loader2 } from 'lucide-react'
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

export default function DriverTrips() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { trips, vehicles, drivers, endTrip, scheduleTrip } = useFleet()
  const [filter, setFilter] = useState<TripStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const myTrips = trips.filter((t) => t.driverId === user?.id)
  const filteredTrips = filter === 'all' ? myTrips : myTrips.filter((t) => t.status === filter)

  const handleStartTrip = async (tripId: string) => {
    setActionLoading(tripId)
    try {
      // For starting a trip, we'd need a start trip function
      // For now, navigate to detail page where driver can start
      toast.success('Opening trip details')
      navigate(`/driver/trips/${tripId}`)
    } catch (err) {
      toast.error('Failed to open trip')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteTrip = async (tripId: string) => {
    setActionLoading(tripId)
    try {
      endTrip(tripId)
      toast.success('Trip completed')
    } catch (err) {
      toast.error('Failed to complete trip')
    } finally {
      setActionLoading(null)
    }
  }

  const getVehicle = (vehicleId: string) => vehicles.find((v) => v.id === vehicleId)
  const getDriver = (driverId: string) => drivers.find((d) => d.id === driverId)

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#625346]">My Trips</h1>
          <p className="text-sm text-[#958777]">View and manage your assigned trips</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-2">
        <div className="flex flex-wrap gap-1">
          {(['all', 'scheduled', 'active', 'completed', 'delayed', 'interrupted'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === status
                  ? 'bg-[#6E5696] text-white shadow-sm'
                  : 'text-[#958777] hover:bg-[#F7F5F2] hover:text-[#625346]'
              }`}
            >
              {status === 'all' ? 'All' : STATUS_CONFIG[status as TripStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* Trips List */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        {filteredTrips.length === 0 ? (
          <div className="py-12 text-center">
            <MapPin className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
            <h3 className="font-semibold text-[#625346]">
              {filter === 'all' ? 'No trips assigned yet' : `No ${filter} trips`}
            </h3>
            <p className="text-sm text-[#958777] mt-1">
              {filter === 'all' ? 'Your upcoming assignments will appear here' : 'Try a different filter'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E5]">
            {filteredTrips
              .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
              .map((trip) => {
                const vehicle = getVehicle(trip.vehicleId)
                const config = STATUS_CONFIG[trip.status as TripStatus] || STATUS_CONFIG.scheduled
                const StatusIcon = config.icon
                const canStart = trip.status === 'scheduled'
                const canComplete = trip.status === 'active'

                return (
                  <div key={trip.id} className="p-4 hover:bg-[#FAFAFA] transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${config.bg} ${config.color}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-[#625346] truncate">
                              {trip.originAddress} → {trip.destinationAddress}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-[#958777]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDateTime(trip.startTime)}
                            </span>
                            {vehicle && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5" />
                                {vehicle.registrationNumber}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPinIcon className="w-3.5 h-3.5" />
                              {trip.plannedDistanceKm || trip.distanceKm || 0} km
                            </span>
                          </div>
                          {trip.status === 'active' && (
                            <p className="text-xs text-[#6E5696] mt-1 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              In progress since {formatDateTime(trip.startTime)}
                            </p>
                          )}
                          {trip.status === 'completed' && trip.endTime && (
                            <p className="text-xs text-[#1F7A4C] mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Completed: {formatDateTime(trip.endTime)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:ml-4">
                        {canStart && (
                          <button
                            onClick={() => handleStartTrip(trip.id)}
                            disabled={actionLoading === trip.id}
                            className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                          >
                            {actionLoading === trip.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="w-4 h-4" />
                                Start
                              </>
                            )}
                          </button>
                        )}
                        {canComplete && (
                          <button
                            onClick={() => handleCompleteTrip(trip.id)}
                            disabled={actionLoading === trip.id}
                            className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
                          >
                            {actionLoading === trip.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle2 className="w-4 h-4" />
                                Complete
                              </>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/driver/trips/${trip.id}`)}
                          className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="hidden sm:inline">Details</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}