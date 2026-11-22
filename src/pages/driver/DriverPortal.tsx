import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Fuel,
  Gauge,
  Home,
  LogOut,
  MapPin,
  Navigation,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Truck,
  User,
  Wrench,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '../../components/ui/BrandLogo'
import { useAuth } from '../../hooks/useAuth'
import type { DriverExpenseCategory } from '../../types/fleet'

type DriverTabId =
  | 'home'
  | 'trips'
  | 'vehicle'
  | 'expenses'
  | 'inspections'
  | 'issues'
  | 'documents'
  | 'profile'

const TABS: Array<{ id: DriverTabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'trips', label: 'My Trips', icon: Navigation },
  { id: 'vehicle', label: 'My Vehicle', icon: Truck },
  { id: 'expenses', label: 'Fuel & Expenses', icon: Fuel },
  { id: 'inspections', label: 'Inspections', icon: ClipboardCheck },
  { id: 'issues', label: 'Report Issue', icon: Wrench },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'profile', label: 'Profile', icon: User },
]

const EXPENSE_CATEGORIES: DriverExpenseCategory[] = [
  'Fuel',
  'Toll',
  'Parking',
  'Repairs',
  'Loading and Unloading',
  'Other Approved Expenses',
]

export function DriverPortal() {
  const { tab } = useParams<{ tab?: string }>()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const activeTab: DriverTabId = useMemo(() => {
    const found = TABS.find((t) => t.id === tab)
    return found ? found.id : 'home'
  }, [tab])

  const setTab = (next: DriverTabId) => {
    navigate(next === 'home' ? '/driver' : `/driver/${next}`)
  }

  const [loading, setLoading] = useState(true)
  const [homeData, setHomeData] = useState<any>(null)
  const [trips, setTrips] = useState<any[]>([])
  const [vehicleDetail, setVehicleDetail] = useState<any>(null)
  const [fuelLogs, setFuelLogs] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [inspections, setInspections] = useState<any[]>([])
  const [issues, setIssues] = useState<any[]>([])
  const [documentsData, setDocumentsData] = useState<any>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])

  // Start/End Trip odometer inputs keyed by tripId
  const [odometerInputs, setOdometerInputs] = useState<Record<string, string>>({})
  const [tripNotesInputs, setTripNotesInputs] = useState<Record<string, string>>({})

  // Fuel Log form
  const [fuelQty, setFuelQty] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  const [fuelOdo, setFuelOdo] = useState('')
  const [fuelStation, setFuelStation] = useState('')

  // Driver Expense form
  const [expCategory, setExpCategory] = useState<DriverExpenseCategory>('Toll')
  const [expAmount, setExpAmount] = useState('')
  const [expOdo, setExpOdo] = useState('')
  const [expLocation, setExpLocation] = useState('')
  const [expNotes, setExpNotes] = useState('')

  // Inspection DVIR form
  const [tyreCondition, setTyreCondition] = useState<'good' | 'worn' | 'critical'>('good')
  const [brakeFeel, setBrakeFeel] = useState<'normal' | 'spongy' | 'squealing'>('normal')
  const [fluidLeaks, setFluidLeaks] = useState(false)
  const [warningLights, setWarningLights] = useState(false)
  const [batteryIssue, setBatteryIssue] = useState(false)
  const [dvirNotes, setDvirNotes] = useState('')

  // Issue Report form
  const [issueTitle, setIssueTitle] = useState('')
  const [issueSeverity, setIssueSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [issueCategory, setIssueCategory] = useState('Vehicle Health')
  const [issueDescription, setIssueDescription] = useState('')

  // Profile edit form
  const [profMobile, setProfMobile] = useState('')
  const [profAltMobile, setProfAltMobile] = useState('')
  const [profEmergencyName, setProfEmergencyName] = useState('')
  const [profEmergencyPhone, setProfEmergencyPhone] = useState('')

  const [busy, setBusy] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [hRes, tRes, vRes, fRes, eRes, insRes, issRes, docRes, pRes, nRes] = await Promise.all([
        fetch('/api/driver/home', { credentials: 'include' }),
        fetch('/api/driver/trips', { credentials: 'include' }),
        fetch('/api/driver/vehicle', { credentials: 'include' }),
        fetch('/api/driver/fuel', { credentials: 'include' }),
        fetch('/api/driver/expenses', { credentials: 'include' }),
        fetch('/api/driver/inspections', { credentials: 'include' }),
        fetch('/api/driver/issues', { credentials: 'include' }),
        fetch('/api/driver/documents', { credentials: 'include' }),
        fetch('/api/driver/profile', { credentials: 'include' }),
        fetch('/api/notifications', { credentials: 'include' }),
      ])
      if (hRes.ok) setHomeData(await hRes.json())
      if (tRes.ok) setTrips((await tRes.json()).trips || [])
      if (vRes.ok) setVehicleDetail((await vRes.json()).assignedVehicle || null)
      if (fRes.ok) setFuelLogs((await fRes.json()).fuelLogs || [])
      if (eRes.ok) setExpenses((await eRes.json()).expenses || [])
      if (insRes.ok) setInspections((await insRes.json()).inspections || [])
      if (issRes.ok) setIssues((await issRes.json()).issues || [])
      if (docRes.ok) setDocumentsData(await docRes.json())
      if (pRes.ok) {
        const pd = (await pRes.json()).profile
        setProfileData(pd)
        if (pd) {
          setProfMobile(pd.mobile || '')
          setProfAltMobile(pd.alternateMobile || '')
          setProfEmergencyName(pd.emergencyContactName || '')
          setProfEmergencyPhone(pd.emergencyContactPhone || '')
        }
      }
      if (nRes.ok) setNotifications((await nRes.json()).notifications || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && user.role !== 'driver') {
      navigate(user.role === 'platform_admin' ? '/platform-admin' : '/dashboard', { replace: true })
      return
    }
    void loadAll()
  }, [user, navigate, loadAll])

  const handleTripStatus = async (tripId: string, status: 'Accepted' | 'Ready to Start' | 'On Hold' | 'Cancelled') => {
    setBusy(true)
    try {
      const res = await fetch(`/api/driver/trips/${tripId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: tripNotesInputs[tripId] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not update trip status')
        return
      }
      toast.success(`Trip updated to ${status}`)
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleStartTrip = async (tripId: string) => {
    const raw = odometerInputs[tripId]
    const startOdometerKm = Number(raw)
    if (!raw || !Number.isFinite(startOdometerKm) || startOdometerKm < 0) {
      toast.error('Enter a valid starting odometer reading in km')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/driver/trips/${tripId}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startOdometerKm, notes: tripNotesInputs[tripId] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to start trip')
        return
      }
      if (data.odometerCheck?.flaggedInconsistent) {
        toast.warning(data.odometerCheck.flagReason || 'Odometer variance flagged for fleet review')
      } else {
        toast.success('Trip started cleanly')
      }
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleEndTrip = async (tripId: string) => {
    const raw = odometerInputs[tripId]
    const endOdometerKm = Number(raw)
    if (!raw || !Number.isFinite(endOdometerKm)) {
      toast.error('Enter ending odometer reading in km')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/driver/trips/${tripId}/end`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endOdometerKm, notes: tripNotesInputs[tripId] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not complete trip')
        return
      }
      if (data.odometerCheck?.flaggedInconsistent) {
        toast.warning(data.odometerCheck.flagReason)
      } else {
        toast.success(`Trip completed · ${data.trip.distanceKm} km verified`)
      }
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitFuel = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/driver/fuel', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantityLitresOrKwh: Number(fuelQty),
          amountInr: Number(fuelCost),
          odometerKm: Number(fuelOdo),
          station: fuelStation,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to record fuel log')
        return
      }
      setFuelQty('')
      setFuelCost('')
      setFuelOdo('')
      setFuelStation('')
      toast.success('Fuel entry submitted for fleet verification')
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/driver/expenses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expCategory,
          amountInr: Number(expAmount),
          odometerKm: expOdo ? Number(expOdo) : undefined,
          location: expLocation,
          description: expNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not submit expense')
        return
      }
      setExpAmount('')
      setExpOdo('')
      setExpLocation('')
      setExpNotes('')
      toast.success('Expense submitted for Fleet Owner/Finance approval')
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitInspection = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/driver/inspections', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tyreCondition,
          brakeFeel,
          fluidLeaksDetected: fluidLeaks,
          warningLightsOn: warningLights,
          batteryOrStartingIssue: batteryIssue,
          notes: dvirNotes,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Inspection failed to submit')
        return
      }
      setDvirNotes('')
      toast.success(data.inspection.passed ? 'DVIR Passed & logged' : 'DVIR Defect logged — Fleet alerted')
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/driver/issues', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: issueTitle,
          severity: issueSeverity,
          category: issueCategory,
          description: issueDescription,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not report issue')
        return
      }
      setIssueTitle('')
      setIssueDescription('')
      toast.success('Vehicle issue reported to Fleet Operations')
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/driver/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: profMobile,
          alternateMobile: profAltMobile,
          emergencyContactName: profEmergencyName,
          emergencyContactPhone: profEmergencyPhone,
        }),
      })
      if (!res.ok) {
        toast.error('Failed to update driver contact details')
        return
      }
      toast.success('Emergency contact & mobile details updated')
      await loadAll()
    } finally {
      setBusy(false)
    }
  }

  const assignedVeh = homeData?.assignedVehicle || vehicleDetail

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-8">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="dark" size="sm" />
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              Driver Portal
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => void loadAll()}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700">
              <Bell className="w-3.5 h-3.5 text-emerald-600" />
              <span>{notifications.filter((n) => !n.isRead).length} Alerts</span>
            </div>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/auth'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>

        {/* Desktop horizontal 8-tab bar */}
        <nav className="hidden md:flex max-w-6xl mx-auto px-4 gap-1 pb-2 overflow-x-auto">
          {TABS.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                  active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {item.label}
              </button>
            )
          })}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading && !homeData ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
            Loading your driver workspace...
          </div>
        ) : (
          <>
            {/* TAB 1: HOME */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      {homeData?.organization?.name || 'DriveMitra Fleet'}
                    </p>
                    <h1 className="text-2xl font-bold mt-1">Welcome, {homeData?.driver?.name || user?.fullName}</h1>
                    <p className="text-xs text-slate-300 mt-1">
                      License {homeData?.driver?.licenseNumber} · Safety Score {homeData?.driver?.safetyScore ?? 95}/100
                    </p>
                  </div>
                  {assignedVeh && (
                    <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">Assigned Vehicle</p>
                      <p className="text-base font-bold">{assignedVeh.registrationNumber}</p>
                      <p className="text-xs text-slate-300">{assignedVeh.make} {assignedVeh.model} · {Number(assignedVeh.odometerKm).toLocaleString('en-IN')} km</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-medium">Assigned Trips</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{homeData?.stats?.totalMyTrips ?? trips.length}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-medium">Completed Trips</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{homeData?.stats?.completedMyTrips ?? 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-medium">Open Issues</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{homeData?.stats?.openIssuesCount ?? 0}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <p className="text-xs text-slate-500 font-medium">Pending Expenses</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{homeData?.stats?.pendingExpensesCount ?? 0}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => setTab('trips')}
                    className="p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left"
                  >
                    <Navigation className="w-5 h-5 mb-2" />
                    <p className="text-sm font-bold">Manage Trips</p>
                    <p className="text-[11px] text-emerald-100">Start / End with odometer</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('expenses')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 text-left"
                  >
                    <Fuel className="w-5 h-5 text-emerald-600 mb-2" />
                    <p className="text-sm font-bold text-slate-900">Log Fuel / Expense</p>
                    <p className="text-[11px] text-slate-500">Fuel, Toll, Parking</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('inspections')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 text-left"
                  >
                    <ClipboardCheck className="w-5 h-5 text-emerald-600 mb-2" />
                    <p className="text-sm font-bold text-slate-900">Pre-Trip DVIR</p>
                    <p className="text-[11px] text-slate-500">Tyres, Brakes, Fluids</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('issues')}
                    className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 text-left"
                  >
                    <Wrench className="w-5 h-5 text-amber-600 mb-2" />
                    <p className="text-sm font-bold text-slate-900">Report Breakdown</p>
                    <p className="text-[11px] text-slate-500">Alert Workshop & Owner</p>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: MY TRIPS */}
            {activeTab === 'trips' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Assigned & Active Trips</h2>
                {trips.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
                    No trips assigned to your driver account right now.
                  </div>
                ) : (
                  trips.map((trip) => {
                    const isActive = trip.status === 'In Progress' || trip.status === 'active'
                    const isCompleted = trip.status === 'Completed' || trip.status === 'completed'
                    return (
                      <div key={trip.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-slate-500">{trip.id}</span>
                              <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                                isActive
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : isCompleted
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-amber-50 text-amber-800'
                              }`}>
                                {trip.status}
                              </span>
                              {trip.odometerFlag === 'inconsistent' && (
                                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 text-[11px] font-semibold">
                                  Flagged: {trip.odometerFlagReason}
                                </span>
                              )}
                            </div>
                            <p className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-emerald-600" />
                              {trip.originAddress || trip.origin} → {trip.destinationAddress || trip.destination}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              {trip.odometerStart != null ? `Start Odo: ${trip.odometerStart} km` : 'Not started'}
                              {trip.odometerEnd != null ? ` · End Odo: ${trip.odometerEnd} km` : ''}
                              {trip.distanceKm > 0 ? ` · Distance: ${trip.distanceKm} km` : ''}
                            </p>
                          </div>
                        </div>

                        {!isCompleted && trip.status !== 'Cancelled' && (
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  {isActive ? 'Ending Odometer Reading (km) *' : 'Starting Odometer Reading (km) *'}
                                </label>
                                <input
                                  type="number"
                                  value={odometerInputs[trip.id] ?? ''}
                                  onChange={(e) =>
                                    setOdometerInputs((prev) => ({ ...prev, [trip.id]: e.target.value }))
                                  }
                                  placeholder={String(assignedVeh?.odometerKm ?? 42000)}
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Driver Trip Note</label>
                                <input
                                  value={tripNotesInputs[trip.id] ?? ''}
                                  onChange={(e) =>
                                    setTripNotesInputs((prev) => ({ ...prev, [trip.id]: e.target.value }))
                                  }
                                  placeholder="Optional dispatch / checkpoint note"
                                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {!isActive && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleTripStatus(trip.id, 'Accepted')}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                                  >
                                    Accept Trip
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleTripStatus(trip.id, 'Ready to Start')}
                                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                                  >
                                    Ready to Start
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void handleStartTrip(trip.id)}
                                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                                  >
                                    Start Trip (Record Odometer)
                                  </button>
                                </>
                              )}
                              {isActive && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => void handleEndTrip(trip.id)}
                                  className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                                >
                                  End Trip & Verify Distance
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleTripStatus(trip.id, 'On Hold')}
                                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold"
                              >
                                Put On Hold
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* TAB 3: MY VEHICLE (NON-FINANCIAL SPECS ONLY) */}
            {activeTab === 'vehicle' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-emerald-600" /> Assigned Vehicle Details
                </h2>
                {!assignedVeh ? (
                  <p className="text-sm text-slate-500">No vehicle is currently assigned to you.</p>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-4 text-sm">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Registration</p>
                      <p className="font-bold text-slate-900 mt-1">{assignedVeh.registrationNumber}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Make / Model</p>
                      <p className="font-bold text-slate-900 mt-1">{assignedVeh.make} {assignedVeh.model}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Current Odometer</p>
                      <p className="font-bold text-slate-900 mt-1">{Number(assignedVeh.odometerKm).toLocaleString('en-IN')} km</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Fuel Type & Level</p>
                      <p className="font-bold text-slate-900 mt-1">{assignedVeh.fuelType} ({assignedVeh.fuelOrSocPct}%)</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Next Scheduled Service</p>
                      <p className="font-bold text-slate-900 mt-1">{assignedVeh.nextServiceDueDate || 'Check schedule'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs text-slate-500">Insurance / PUC Expiry</p>
                      <p className="font-bold text-slate-900 mt-1">{assignedVeh.insuranceExpiry} / {assignedVeh.pucExpiry || 'Active'}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: FUEL & EXPENSES */}
            {activeTab === 'expenses' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <form onSubmit={handleSubmitFuel} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Fuel className="w-4 h-4 text-emerald-600" /> Log Fuel / Charging Fill
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity (L / kWh) *</label>
                      <input required type="number" step="0.1" value={fuelQty} onChange={(e) => setFuelQty(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                      <input required type="number" step="1" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Odometer (km) *</label>
                      <input required type="number" value={fuelOdo} onChange={(e) => setFuelOdo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Station Name</label>
                      <input value={fuelStation} onChange={(e) => setFuelStation(e.target.value)} placeholder="HPCL NH-48" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                  </div>
                  <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                    Submit Fuel Log
                  </button>
                </form>

                <form onSubmit={handleSubmitExpense} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-600" /> Submit Operational Expense Claim
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                      <select value={expCategory} onChange={(e) => setExpCategory(e.target.value as DriverExpenseCategory)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                        {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (INR) *</label>
                      <input required type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Odometer (Optional)</label>
                      <input type="number" value={expOdo} onChange={(e) => setExpOdo(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Location / Plaza</label>
                      <input value={expLocation} onChange={(e) => setExpLocation(e.target.value)} placeholder="Tumkur Toll Plaza" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                      <input value={expNotes} onChange={(e) => setExpNotes(e.target.value)} placeholder="Receipt details" className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm" />
                    </div>
                  </div>
                  <button type="submit" disabled={busy} className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
                    Submit Expense for Approval
                  </button>
                </form>

                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">My Expense & Fuel Submissions ({expenses.length})</h3>
                  {expenses.length === 0 ? (
                    <p className="text-xs text-slate-500">No expense submissions recorded yet. ({fuelLogs.length} direct fuel entries)</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {expenses.map((exp) => (
                        <div key={exp.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div>
                            <p className="font-bold text-slate-900">{exp.category} · ₹{Number(exp.amountInr).toLocaleString('en-IN')}</p>
                            <p className="text-slate-500">{exp.expenseDate} {exp.location ? `· ${exp.location}` : ''} {exp.description ? `· ${exp.description}` : ''}</p>
                            {exp.reviewNote && <p className="text-amber-700 mt-0.5">Reviewer Note: {exp.reviewNote}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded font-semibold ${
                              exp.approvalStatus === 'Approved'
                                ? 'bg-emerald-50 text-emerald-700'
                                : exp.approvalStatus === 'Rejected'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-amber-50 text-amber-800'
                            }`}>
                              Approval: {exp.approvalStatus}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                              Settlement: {exp.paymentStatus}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: INSPECTIONS */}
            {activeTab === 'inspections' && (
              <div className="space-y-6">
                <form onSubmit={handleSubmitInspection} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ClipboardCheck className="w-5 h-5 text-emerald-600" /> Submit Pre-Trip Vehicle Inspection (DVIR)
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tyre Condition</label>
                      <select value={tyreCondition} onChange={(e) => setTyreCondition(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                        <option value="good">Good — Safe tread & inflation</option>
                        <option value="worn">Worn — Monitor soon</option>
                        <option value="critical">Critical — Replace immediately</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Brake Feel</label>
                      <select value={brakeFeel} onChange={(e) => setBrakeFeel(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                        <option value="normal">Normal & responsive</option>
                        <option value="spongy">Spongy / soft pedal</option>
                        <option value="squealing">Squealing / grinding</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={fluidLeaks} onChange={(e) => setFluidLeaks(e.target.checked)} /> Fluid leaks detected
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={warningLights} onChange={(e) => setWarningLights(e.target.checked)} /> Dashboard warning light on
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={batteryIssue} onChange={(e) => setBatteryIssue(e.target.checked)} /> Battery / cranking issue
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={dvirNotes}
                    onChange={(e) => setDvirNotes(e.target.value)}
                    placeholder="Inspection remarks..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                  <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                    Submit DVIR Inspection
                  </button>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Recent Inspections ({inspections.length})</h3>
                  {inspections.map((ins) => (
                    <div key={ins.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800">{new Date(ins.timestamp).toLocaleString('en-IN')}</p>
                        <p className="text-slate-500">{ins.notes}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded font-bold ${ins.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {ins.passed ? 'PASSED' : 'DEFECT'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: REPORT ISSUE */}
            {activeTab === 'issues' && (
              <div className="space-y-6">
                <form onSubmit={handleSubmitIssue} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" /> Report Vehicle Defect or Breakdown
                  </h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <input
                      required
                      value={issueTitle}
                      onChange={(e) => setIssueTitle(e.target.value)}
                      placeholder="Issue summary (e.g. Rear left tyre puncture)"
                      className="sm:col-span-2 px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
                    />
                    <select value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value as any)} className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                      <option value="low">Low Severity</option>
                      <option value="medium">Medium Severity</option>
                      <option value="high">High Severity</option>
                      <option value="critical">Critical Breakdown</option>
                    </select>
                  </div>
                  <select value={issueCategory} onChange={(e) => setIssueCategory(e.target.value)} className="w-full sm:w-64 px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white">
                    <option value="Vehicle Health">Vehicle Health</option>
                    <option value="Engine Health">Engine Health</option>
                    <option value="Tyre Health">Tyre Health</option>
                    <option value="Fuel Health">Fuel Health</option>
                  </select>
                  <textarea
                    required
                    rows={3}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Describe symptoms, noises, or warning indicators..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                  />
                  <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">
                    Send Issue Alert to Fleet Manager
                  </button>
                </form>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Reported Issues ({issues.length})</h3>
                  {issues.map((iss) => (
                    <div key={iss.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{iss.title}</p>
                        <p className="text-slate-500">{iss.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold uppercase">{iss.severity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: DOCUMENTS */}
            {activeTab === 'documents' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" /> Driver & Vehicle Compliance Documents
                </h2>
                <div className="grid sm:grid-cols-2 gap-4 text-xs">
                  {documentsData?.driverCompliance && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Driving License Compliance</p>
                      <p>License No: <strong>{documentsData.driverCompliance.licenseNumber}</strong></p>
                      <p>Expiry Date: <strong>{documentsData.driverCompliance.licenseExpiry}</strong></p>
                    </div>
                  )}
                  {documentsData?.vehicleCompliance && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5"><Gauge className="w-4 h-4 text-emerald-600" /> Assigned Vehicle Compliance ({documentsData.vehicleCompliance.registrationNumber})</p>
                      <p>RC Expiry: <strong>{documentsData.vehicleCompliance.registrationExpiry}</strong></p>
                      <p>Insurance Expiry: <strong>{documentsData.vehicleCompliance.insuranceExpiry}</strong></p>
                      <p>Fitness / PUC: <strong>{documentsData.vehicleCompliance.fitnessExpiry || 'Active'} / {documentsData.vehicleCompliance.pucExpiry || 'Active'}</strong></p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 8: PROFILE */}
            {activeTab === 'profile' && profileData && (
              <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-emerald-600" /> My Driver Profile & Emergency Contact
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <input disabled value={profileData.name || ''} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">License Number</label>
                    <input disabled value={profileData.licenseNumber || ''} className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Mobile *</label>
                    <input required value={profMobile} onChange={(e) => setProfMobile(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Mobile</label>
                    <input value={profAltMobile} onChange={(e) => setProfAltMobile(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Name</label>
                    <input value={profEmergencyName} onChange={(e) => setProfEmergencyName(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency Contact Phone</label>
                    <input value={profEmergencyPhone} onChange={(e) => setProfEmergencyPhone(e.target.value)} className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm" />
                  </div>
                </div>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" /> Save Contact Updates
                </button>
              </form>
            )}
          </>
        )}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-1.5 flex overflow-x-auto gap-1">
        {TABS.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 min-w-[68px] flex flex-col items-center justify-center py-1 rounded-lg text-[10px] font-semibold ${
                active ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

export default DriverPortal
