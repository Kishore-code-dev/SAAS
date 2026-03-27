import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  Vehicle, Driver, Trip, FuelTransaction, Alert, MaintenanceRecord, DriverScore, UserRole,
  VEHICLES, DRIVERS, TRIPS, FUEL_TRANSACTIONS, ALERTS, DRIVER_SCORES, MAINTENANCE, LatLng
} from '../data/fleetData'

interface FleetState {
  vehicles: Vehicle[]
  drivers: Driver[]
  trips: Trip[]
  fuelTransactions: FuelTransaction[]
  alerts: Alert[]
  maintenance: MaintenanceRecord[]
  driverScores: DriverScore[]
  userRole: UserRole
  currentDriverId: string | null
  setUserRole: (role: UserRole) => void
  setCurrentDriverId: (id: string | null) => void
  addFuelTransaction: (tx: Omit<FuelTransaction, 'id'>) => void
  markAlertRead: (id: string) => void
  markAllAlertsRead: () => void
  unreadAlertCount: number
  totalFuelToday: number
  activeTripsCount: number
  onlineDriversCount: number
  getDriverScore: (driverId: string) => DriverScore | undefined
  getVehicleDriver: (vehicleId: string) => Driver | undefined
  startTrip: (driverId: string, vehicleId: string) => void
  endTrip: (tripId: string) => void
  currentDriverTrip: Trip | undefined
  searchTerm: string
  setSearchTerm: (term: string) => void
  aiSyncActive: boolean
  toggleAiSync: () => void
}

const FleetContext = createContext<FleetState | undefined>(undefined)

export function FleetProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>(VEHICLES)
  const [drivers] = useState<Driver[]>(DRIVERS)
  const [trips, setTrips] = useState<Trip[]>(TRIPS)
  const [fuelTransactions, setFuelTransactions] = useState<FuelTransaction[]>(FUEL_TRANSACTIONS)
  const [alerts, setAlerts] = useState<Alert[]>(ALERTS)
  const [maintenance] = useState<MaintenanceRecord[]>(MAINTENANCE)
  const [driverScores] = useState<DriverScore[]>(DRIVER_SCORES)
  const [userRole, setUserRole] = useState<UserRole>('admin')
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [aiSyncActive, setAiSyncActive] = useState(true)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(Date.now())

  // ─── Simulate live GPS movement ────────────────────────────────────────────
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>
    const step = () => {
      const now = Date.now()
      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      setVehicles(prev => prev.map(v => {
        if (v.status !== 'active') return v
        const speed = v.speed + (Math.random() - 0.5) * 5
        const clampedSpeed = Math.max(20, Math.min(90, speed))
        const meters = (clampedSpeed / 3.6) * dt
        const headingVariance = (Math.random() - 0.5) * 8
        const heading = (v.heading + headingVariance + 360) % 360
        const rads = (heading * Math.PI) / 180
        const dlat = (meters * Math.cos(rads)) / 111111
        const dlng = (meters * Math.sin(rads)) / (111111 * Math.cos(v.location.lat * Math.PI / 180))
        return {
          ...v,
          location: { lat: v.location.lat + dlat, lng: v.location.lng + dlng },
          speed: Math.round(clampedSpeed),
          heading,
          lastSeen: new Date()
        }
      }))
    }

    intervalId = setInterval(step, 2000)
    return () => clearInterval(intervalId)
  }, [])

  const unreadAlertCount = alerts.filter(a => !a.read).length

  const totalFuelToday = fuelTransactions.filter(tx => {
    const today = new Date()
    return tx.timestamp.toDateString() === today.toDateString()
  }).reduce((sum, tx) => sum + tx.amount, 0)

  const activeTripsCount = trips.filter(t => t.status === 'active').length
  const onlineDriversCount = drivers.filter(d => d.status === 'online' || d.status === 'on_trip').length

  const getDriverScore = (driverId: string) => driverScores.find(s => s.driverId === driverId)
  const getVehicleDriver = (vehicleId: string) => drivers.find(d => d.vehicleId === vehicleId)

  const markAlertRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))
  }

  const markAllAlertsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  }

  const addFuelTransaction = (tx: Omit<FuelTransaction, 'id'>) => {
    const newTx: FuelTransaction = { ...tx, id: `f${Date.now()}` }
    setFuelTransactions(prev => [newTx, ...prev])
  }

  const startTrip = (driverId: string, vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return
    const newTrip: Trip = {
      id: `t${Date.now()}`,
      vehicleId, driverId,
      startLocation: vehicle.location,
      startAddress: 'Current Location',
      startTime: new Date(),
      distance: 0, duration: 0,
      status: 'active',
      route: [vehicle.location],
      stops: []
    }
    setTrips(prev => [newTrip, ...prev])
    setVehicles(prev => prev.map(v => v.id === vehicleId ? { ...v, status: 'active' } : v))
  }

  const endTrip = (tripId: string) => {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, status: 'completed', endTime: new Date() } : t))
  }

  const currentDriverTrip = currentDriverId
    ? trips.find(t => t.driverId === currentDriverId && t.status === 'active')
    : undefined

  return (
    <FleetContext.Provider value={{
      vehicles, drivers, trips, fuelTransactions, alerts, maintenance, driverScores,
      userRole, currentDriverId, setUserRole, setCurrentDriverId,
      addFuelTransaction, markAlertRead, markAllAlertsRead,
      unreadAlertCount, totalFuelToday, activeTripsCount, onlineDriversCount,
      getDriverScore, getVehicleDriver, startTrip, endTrip, currentDriverTrip,
      searchTerm, setSearchTerm, aiSyncActive, toggleAiSync: () => setAiSyncActive(!aiSyncActive)
    }}>
      {children}
    </FleetContext.Provider>
  )
}

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used within FleetProvider')
  return ctx
}
