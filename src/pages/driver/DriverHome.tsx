import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'
import { Truck, MapPin, Fuel, Clock, AlertTriangle, CheckCircle2, Navigation2, Camera, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { formatShortDate, formatDateTime } from '../../components/ui/EnterprisePrimitives'
import { toast } from 'sonner'

export default function DriverHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { activeOrganization, vehicles, drivers, trips, addFuelTransaction } = useFleet()

  const [assignedVehicle, setAssignedVehicle] = useState<typeof vehicles[0] | null>(null)
  const [assignedDriver, setAssignedDriver] = useState<typeof drivers[0] | null>(null)
  const [upcomingTrip, setUpcomingTrip] = useState<typeof trips[0] | null>(null)
  const [activeTrip, setActiveTrip] = useState<typeof trips[0] | null>(null)
  const [loading, setLoading] = useState(true)
  const [quickActionsLoading, setQuickActionsLoading] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const driver = drivers.find((d) => d.id === user.id)
    if (driver) {
      setAssignedDriver(driver)
      if (driver.assignedVehicleId) {
        const vehicle = vehicles.find((v) => v.id === driver.assignedVehicleId)
        if (vehicle) setAssignedVehicle(vehicle)
      }
    }

    // Find upcoming and active trips for this driver
    const now = new Date()
    const myTrips = trips.filter((t) => t.driverId === user.id)
    const upcoming = myTrips
      .filter((t) => t.status === 'scheduled')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
    const active = myTrips.find((t) => t.status === 'active')
    if (upcoming) setUpcomingTrip(upcoming)
    if (active) setActiveTrip(active)
    setLoading(false)
  }, [user, drivers, vehicles, trips])

  const handleStartTrip = async (tripId: string) => {
    setQuickActionsLoading(tripId)
    try {
      // TODO: Call trip start API
      toast.success('Trip started successfully')
      navigate(`/driver/trips/${tripId}`)
    } catch (err) {
      toast.error('Failed to start trip')
    } finally {
      setQuickActionsLoading(null)
    }
  }

  const handleOpenFuelLog = () => {
    navigate('/driver/fuel')
  }

  const handleReportIssue = () => {
    navigate('/driver/maintenance')
  }

  const handleOpenTrip = (tripId: string) => {
    navigate(`/driver/trips/${tripId}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-[#EEE8F7] border-t-[#6E5696] rounded-full animate-spin" />
          <p className="text-sm text-[#958777]">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-[#6E5696] to-[#5A457A] rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Welcome back, {user?.fullName?.split(' ')[0] || 'Driver'}</h1>
            <p className="text-[#E8DFFC] mt-1">{activeOrganization?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
              {assignedVehicle ? `${assignedVehicle.registrationNumber} · ${assignedVehicle.make} ${assignedVehicle.model}` : 'No vehicle assigned'}
            </span>
          </div>
        </div>
      </div>

      {/* Assigned Vehicle Card */}
      {assignedVehicle && (
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-[#EEE8F7] flex items-center justify-center">
                <Truck className="w-7 h-7 text-[#6E5696]" />
              </div>
              <div>
                <h2 className="font-bold text-[#625346] text-lg">{assignedVehicle.registrationNumber}</h2>
                <p className="text-sm text-[#958777]">{assignedVehicle.make} {assignedVehicle.model} · {assignedVehicle.powertrain}</p>
                <p className="text-xs text-[#958777] mt-1">Odometer: {assignedVehicle.odometerKm?.toLocaleString('en-IN')} km</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                assignedVehicle.operationStatus === 'moving' || assignedVehicle.operationStatus === 'idle' ? 'bg-[#ECFDF5] text-[#1F7A4C]' :
                assignedVehicle.operationStatus === 'maintenance' ? 'bg-[#FEF3C7] text-[#8F6510]' :
                'bg-[#F3F4F6] text-[#6B7280]'
              }`}>
                {assignedVehicle.operationStatus.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Active Trip - Most Prominent */}
      {activeTrip && (
        <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#8F6510]" />
              <h2 className="font-bold text-[#625346]">Active Trip</h2>
            </div>
            <span className="px-2 py-1 bg-[#8F6510] text-white text-xs font-semibold rounded-full">IN PROGRESS</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[#958777]">From</p>
              <p className="font-medium text-[#625346]">{activeTrip.originAddress}</p>
            </div>
            <div>
              <p className="text-[#958777]">To</p>
              <p className="font-medium text-[#625346]">{activeTrip.destinationAddress}</p>
            </div>
            <div>
              <p className="text-[#958777]">Started</p>
              <p className="font-medium text-[#625346]">{formatDateTime(activeTrip.startTime)}</p>
            </div>
            <div>
              <p className="text-[#958777]">Distance</p>
              <p className="font-medium text-[#625346]">{activeTrip.distanceKm || 0} km</p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => handleOpenTrip(activeTrip.id)}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              <Navigation2 className="w-4 h-4" />
              Continue Trip
            </button>
            <button
              onClick={() => handleReportIssue()}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Report Issue
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Trip */}
      {!activeTrip && upcomingTrip && (
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#6E5696]" />
              <h2 className="font-bold text-[#625346]">Upcoming Trip</h2>
            </div>
            <span className="px-2 py-1 bg-[#EEE8F7] text-[#6E5696] text-xs font-semibold rounded-full">PLANNED</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-[#958777]">From</p>
              <p className="font-medium text-[#625346]">{upcomingTrip.originAddress}</p>
            </div>
            <div>
              <p className="text-[#958777]">To</p>
              <p className="font-medium text-[#625346]">{upcomingTrip.destinationAddress}</p>
            </div>
            <div>
              <p className="text-[#958777]">Starts</p>
              <p className="font-medium text-[#625346]">{formatDateTime(upcomingTrip.startTime)}</p>
            </div>
            <div>
              <p className="text-[#958777]">Est. Distance</p>
              <p className="font-medium text-[#625346]">{upcomingTrip.plannedDistanceKm || 0} km</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleStartTrip(upcomingTrip.id)}
              disabled={quickActionsLoading === upcomingTrip.id}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {quickActionsLoading === upcomingTrip.id ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Navigation2 className="w-4 h-4" />
                  Start Trip
                </>
              )}
            </button>
            <button
              onClick={() => handleOpenTrip(upcomingTrip.id)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              View Details
            </button>
          </div>
        </div>
      )}

      {!activeTrip && !upcomingTrip && (
        <div className="bg-white border border-[#E5E5E5] rounded-xl p-8 text-center">
          <MapPin className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
          <h3 className="font-semibold text-[#625346]">No Active or Upcoming Trips</h3>
          <p className="text-sm text-[#958777] mt-1">Your next assignment will appear here</p>
        </div>
      )}

      {/* Quick Actions Grid */}
      <div>
        <h3 className="font-semibold text-[#625346] mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleOpenFuelLog}
            className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col items-center gap-2 text-center hover:border-[#D1D5DB] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] flex items-center justify-center">
              <Fuel className="w-6 h-6 text-[#1F7A4C]" />
            </div>
            <span className="font-medium text-[#625346] text-sm">Log Fuel</span>
            <span className="text-xs text-[#958777]">Record refuelling</span>
          </button>

          <button
            onClick={handleReportIssue}
            className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col items-center gap-2 text-center hover:border-[#D1D5DB] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#B84E42]" />
            </div>
            <span className="font-medium text-[#625346] text-sm">Report Issue</span>
            <span className="text-xs text-[#958777]">Vehicle problem</span>
          </button>

          <button
            onClick={() => navigate('/driver/expenses')}
            className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col items-center gap-2 text-center hover:border-[#D1D5DB] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#EEE8F7] flex items-center justify-center">
              <Camera className="w-6 h-6 text-[#6E5696]" />
            </div>
            <span className="font-medium text-[#625346] text-sm">Add Expense</span>
            <span className="text-xs text-[#958777]">Submit receipt</span>
          </button>

          <button
            onClick={() => navigate('/driver/trips')}
            className="bg-white border border-[#E5E5E5] rounded-xl p-4 flex flex-col items-center gap-2 text-center hover:border-[#D1D5DB] transition-colors"
          >
            <div className="w-12 h-12 rounded-xl bg-[#F0F9FF] flex items-center justify-center">
              <MapPin className="w-6 h-6 text-[#0369A1]" />
            </div>
            <span className="font-medium text-[#625346] text-sm">All Trips</span>
            <span className="text-xs text-[#958777]">View history</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="font-semibold text-[#625346]">Recent Activity</h3>
          <button
            onClick={() => navigate('/driver/trips')}
            className="text-sm text-[#6E5696] font-medium hover:underline"
          >
            View all
          </button>
        </div>
        <div className="divide-y divide-[#E5E5E5]">
          {[
            activeTrip && { type: 'trip', title: `Trip started: ${activeTrip.originAddress} → ${activeTrip.destinationAddress}`, time: activeTrip.startTime, Icon: Navigation2, color: 'text-[#8F6510]' },
            upcomingTrip && { type: 'trip', title: `Upcoming: ${upcomingTrip.originAddress} → ${upcomingTrip.destinationAddress}`, time: upcomingTrip.startTime, Icon: MapPin, color: 'text-[#6E5696]' },
          ].filter(Boolean).slice(0, 3).map((item, idx) => {
            const IconComponent = item!.Icon
            return (
              <div key={idx} className="px-5 py-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item!.color} bg-opacity-10`}>
                  <IconComponent className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#625346] truncate">{item!.title}</p>
                  <p className="text-xs text-[#958777]">{item!.time ? formatDateTime(item!.time) : 'Pending'}</p>
                </div>
              </div>
            )
          })}
          {!activeTrip && !upcomingTrip && (
            <div className="px-5 py-8 text-center text-[#958777] text-sm">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  )
}