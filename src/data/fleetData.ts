// DriveMitra Core Data Stores & Types
// All simulation data for vehicles, trips, fuel, drivers, alerts

export type VehicleStatus = 'active' | 'idle' | 'stopped' | 'offline'
export type UserRole = 'admin' | 'driver'
export type AlertType = 'overspeeding' | 'harsh_braking' | 'idle' | 'suspicious_stop' | 'missing_receipt' | 'route_deviation'
export type StopReason = 'fuel' | 'food' | 'restroom' | 'inspection' | 'traffic' | 'other'
export type PaymentMethod = 'upi' | 'googlepay' | 'phonepe' | 'paytm' | 'cash'

export interface LatLng { lat: number; lng: number }

export interface Vehicle {
  id: string
  registrationNo: string
  model: string
  type: 'truck' | 'van' | 'tempo'
  driverId: string | null
  status: VehicleStatus
  location: LatLng
  speed: number // km/h
  heading: number // degrees
  fuelLevel: number // 0-100%
  odometer: number // km
  lastSeen: Date
  color: string
}

export interface Driver {
  id: string
  name: string
  mobile: string
  email: string
  vehicleId: string | null
  safetyScore: number // 0-100
  avatar: string
  status: 'online' | 'offline' | 'on_trip'
  totalTrips: number
  totalDistance: number
  role: UserRole
  joinDate: Date
}

export interface Trip {
  id: string
  vehicleId: string
  driverId: string
  startLocation: LatLng
  endLocation?: LatLng
  startAddress: string
  endAddress?: string
  startTime: Date
  endTime?: Date
  distance: number // km
  duration: number // minutes
  status: 'active' | 'completed'
  route: LatLng[]
  stops: Stop[]
}

export interface Stop {
  id: string
  tripId: string
  location: LatLng
  address: string
  startTime: Date
  endTime?: Date
  duration: number // minutes
  reason: StopReason | null
  isLong: boolean // > 10 min
  isSuspicious: boolean
}

export interface FuelTransaction {
  id: string
  vehicleId: string
  driverId: string
  amount: number // INR
  liters: number
  pricePerLiter: number
  station: string
  location: LatLng
  timestamp: Date
  paymentMethod: PaymentMethod
  receiptUrl?: string
  verified: boolean
}

export interface MaintenanceRecord {
  id: string
  vehicleId: string
  serviceCenter: string
  amount: number
  date: Date
  serviceType: string
  description: string
  receiptUrl?: string
  verified: boolean
  flagged: boolean
}

export interface Alert {
  id: string
  type: AlertType
  vehicleId: string
  driverId: string
  severity: 'low' | 'medium' | 'high'
  message: string
  timestamp: Date
  read: boolean
  location?: LatLng
}

export interface DriverScore {
  driverId: string
  overall: number
  speeding: number
  braking: number
  acceleration: number
  cornering: number
  phoneUsage: number
}

// ─── SIMULATED FLEET DATA ─────────────────────────────────────────────────────

export const VEHICLES: Vehicle[] = [
  {
    id: 'v001', registrationNo: 'TN 38 AB 1234', model: 'Tata Ace Gold', type: 'tempo',
    driverId: 'd001', status: 'active',
    location: { lat: 13.0827, lng: 80.2707 }, // Chennai
    speed: 42, heading: 45, fuelLevel: 72, odometer: 45230, lastSeen: new Date(), color: '#0078FF'
  },
  {
    id: 'v002', registrationNo: 'TN 07 CD 5678', model: 'Mahindra Bolero Pickup', type: 'truck',
    driverId: 'd002', status: 'active',
    location: { lat: 9.9252, lng: 78.1198 }, // Madurai
    speed: 65, heading: 120, fuelLevel: 45, odometer: 89120, lastSeen: new Date(), color: '#00DCA0'
  },
  {
    id: 'v003', registrationNo: 'KA 01 EF 9012', model: 'Ashok Leyland Dost', type: 'truck',
    driverId: 'd003', status: 'stopped',
    location: { lat: 12.9716, lng: 77.5946 }, // Bengaluru
    speed: 0, heading: 180, fuelLevel: 88, odometer: 32450, lastSeen: new Date(), color: '#FF4646'
  },
  {
    id: 'v004', registrationNo: 'TN 39 GH 3456', model: 'Tata 407', type: 'truck',
    driverId: 'd004', status: 'idle',
    location: { lat: 11.0168, lng: 76.9558 }, // Coimbatore
    speed: 0, heading: 90, fuelLevel: 31, odometer: 121000, lastSeen: new Date(), color: '#FFA600'
  },
  {
    id: 'v005', registrationNo: 'TN 22 IJ 7890', model: 'Force Traveller', type: 'van',
    driverId: null, status: 'offline',
    location: { lat: 10.8505, lng: 76.2711 }, // Thrissur
    speed: 0, heading: 0, fuelLevel: 55, odometer: 67800, lastSeen: new Date(Date.now() - 3600000), color: '#9B59B6'
  },
]

export const DRIVERS: Driver[] = [
  {
    id: 'd001', name: 'Rajesh Kumar', mobile: '+91 98401 12345', email: 'rajesh@fleet.in',
    vehicleId: 'v001', safetyScore: 87, avatar: 'https://i.pravatar.cc/150?u=d001', status: 'on_trip',
    totalTrips: 1243, totalDistance: 89450, role: 'driver',
    joinDate: new Date('2022-03-15')
  },
  {
    id: 'd002', name: 'Murugan S', mobile: '+91 94450 67890', email: 'murugan@fleet.in',
    vehicleId: 'v002', safetyScore: 72, avatar: 'https://i.pravatar.cc/150?u=d002', status: 'on_trip',
    totalTrips: 892, totalDistance: 71230, role: 'driver',
    joinDate: new Date('2021-07-20')
  },
  {
    id: 'd003', name: 'Ravi Shankar', mobile: '+91 99001 34567', email: 'ravi@fleet.in',
    vehicleId: 'v003', safetyScore: 61, avatar: 'https://i.pravatar.cc/150?u=d003', status: 'online',
    totalTrips: 450, totalDistance: 32100, role: 'driver',
    joinDate: new Date('2023-01-10')
  },
  {
    id: 'd004', name: 'Anbu Selvan', mobile: '+91 82200 89012', email: 'anbu@fleet.in',
    vehicleId: 'v004', safetyScore: 94, avatar: 'https://i.pravatar.cc/150?u=d004', status: 'online',
    totalTrips: 2100, totalDistance: 181000, role: 'driver',
    joinDate: new Date('2020-06-01')
  },
]

export const TRIPS: Trip[] = [
  {
    id: 't001', vehicleId: 'v001', driverId: 'd001',
    startLocation: { lat: 13.0827, lng: 80.2707 },
    endLocation: undefined,
    startAddress: 'Koyambedu, Chennai',
    startTime: new Date(Date.now() - 90 * 60000),
    distance: 48, duration: 90, status: 'active',
    route: [
      { lat: 13.0827, lng: 80.2707 },
      { lat: 13.0500, lng: 80.2100 },
      { lat: 13.0200, lng: 80.1800 },
    ],
    stops: [
      {
        id: 's001', tripId: 't001',
        location: { lat: 13.0500, lng: 80.2100 },
        address: 'Indian Oil, Tambaram',
        startTime: new Date(Date.now() - 60 * 60000),
        endTime: new Date(Date.now() - 52 * 60000),
        duration: 8, reason: 'fuel', isLong: false, isSuspicious: false
      }
    ]
  },
  {
    id: 't002', vehicleId: 'v002', driverId: 'd002',
    startLocation: { lat: 9.9252, lng: 78.1198 },
    startAddress: 'Mattuthavani Bus Stand, Madurai',
    startTime: new Date(Date.now() - 120 * 60000),
    distance: 85, duration: 120, status: 'active',
    route: [
      { lat: 9.9252, lng: 78.1198 },
      { lat: 9.9500, lng: 78.1500 },
    ],
    stops: []
  },
]

export const FUEL_TRANSACTIONS: FuelTransaction[] = [
  {
    id: 'f001', vehicleId: 'v001', driverId: 'd001',
    amount: 3200, liters: 40, pricePerLiter: 80,
    station: 'Indian Oil - Tambaram',
    location: { lat: 12.9249, lng: 80.1000 },
    timestamp: new Date(Date.now() - 3 * 3600000),
    paymentMethod: 'upi', verified: true
  },
  {
    id: 'f002', vehicleId: 'v002', driverId: 'd002',
    amount: 4800, liters: 60, pricePerLiter: 80,
    station: 'Bharat Petroleum - Madurai Bypass',
    location: { lat: 9.9252, lng: 78.1198 },
    timestamp: new Date(Date.now() - 8 * 3600000),
    paymentMethod: 'phonepe', verified: true
  },
  {
    id: 'f003', vehicleId: 'v003', driverId: 'd003',
    amount: 2560, liters: 32, pricePerLiter: 80,
    station: 'HP Petrol - Hosur Road',
    location: { lat: 12.8800, lng: 77.6200 },
    timestamp: new Date(Date.now() - 24 * 3600000),
    paymentMethod: 'googlepay', verified: false
  },
  {
    id: 'f004', vehicleId: 'v004', driverId: 'd004',
    amount: 5600, liters: 70, pricePerLiter: 80,
    station: 'Reliance Petrol - RS Puram',
    location: { lat: 11.0168, lng: 76.9558 },
    timestamp: new Date(Date.now() - 2 * 24 * 3600000),
    paymentMethod: 'paytm', verified: true
  },
]

export const ALERTS: Alert[] = [
  {
    id: 'a001', type: 'overspeeding', vehicleId: 'v002', driverId: 'd002',
    severity: 'high', message: 'Murugan S exceeded 80 km/h on NH44',
    timestamp: new Date(Date.now() - 30 * 60000), read: false,
    location: { lat: 9.9500, lng: 78.1500 }
  },
  {
    id: 'a002', type: 'suspicious_stop', vehicleId: 'v003', driverId: 'd003',
    severity: 'medium', message: 'Ravi Shankar stopped for 18 min near Hosur Road without reason',
    timestamp: new Date(Date.now() - 2 * 3600000), read: false,
    location: { lat: 12.8800, lng: 77.6200 }
  },
  {
    id: 'a003', type: 'missing_receipt', vehicleId: 'v001', driverId: 'd001',
    severity: 'low', message: 'Fuel purchase of ₹3200 pending receipt upload',
    timestamp: new Date(Date.now() - 5 * 3600000), read: true
  },
  {
    id: 'a004', type: 'harsh_braking', vehicleId: 'v002', driverId: 'd002',
    severity: 'medium', message: '3 harsh braking events detected on Madurai-Chennai highway',
    timestamp: new Date(Date.now() - 45 * 60000), read: false
  },
  {
    id: 'a005', type: 'idle', vehicleId: 'v004', driverId: 'd004',
    severity: 'low', message: 'Vehicle idle for 25 minutes near Gandhipuram',
    timestamp: new Date(Date.now() - 3600000), read: true
  },
]

export const DRIVER_SCORES: DriverScore[] = [
  { driverId: 'd001', overall: 87, speeding: 88, braking: 90, acceleration: 85, cornering: 82, phoneUsage: 91 },
  { driverId: 'd002', overall: 72, speeding: 62, braking: 68, acceleration: 75, cornering: 74, phoneUsage: 80 },
  { driverId: 'd003', overall: 61, speeding: 55, braking: 60, acceleration: 65, cornering: 58, phoneUsage: 70 },
  { driverId: 'd004', overall: 94, speeding: 95, braking: 96, acceleration: 92, cornering: 93, phoneUsage: 97 },
]

export const MAINTENANCE: MaintenanceRecord[] = [
  {
    id: 'm001', vehicleId: 'v001', serviceCenter: 'Tata Motors ASC, Ambattur',
    amount: 8500, date: new Date(Date.now() - 7 * 24 * 3600000),
    serviceType: 'Oil Change + Filter', description: 'Engine oil change, oil filter, air filter replacement',
    verified: true, flagged: false
  },
  {
    id: 'm002', vehicleId: 'v003', serviceCenter: 'Ashok Leyland Workshop, Hosur',
    amount: 24000, date: new Date(Date.now() - 3 * 24 * 3600000),
    serviceType: 'Major Service', description: 'Brake pads, clutch plate, gearbox service',
    verified: false, flagged: true
  },
]
