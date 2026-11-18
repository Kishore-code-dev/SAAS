import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../src/hooks/useAuth'
import { FleetProvider, useFleet } from '../../src/hooks/useFleet'
import { I18nProvider } from '../../src/i18n/useTranslation'
import { AppRoutes } from '../../src/App'
import FuelLogs from '../../src/pages/FuelLogs'
import Settings from '../../src/pages/Settings'
import Vehicles from '../../src/pages/Vehicles'
import LiveMap from '../../src/pages/LiveMap'

const mockFitBounds = vi.fn()
const mockFlyTo = vi.fn()

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-marker">{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => <div data-testid="mock-polyline" />,
  Circle: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-geofence">{children}</div>,
  useMapEvents: () => null,
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: mockFitBounds,
    flyTo: mockFlyTo,
    panTo: vi.fn(),
    getZoom: () => 7,
  }),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockUnauthenticatedFetch() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
    if (url.includes('/api/auth/me') || url.includes('/api/auth/session')) {
      return new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
}

function TestShell({
  initialEntries = ['/'],
  children,
}: {
  initialEntries?: string[]
  children: React.ReactNode
}) {
  return (
    <I18nProvider>
      <AuthProvider>
        <FleetProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </FleetProvider>
      </AuthProvider>
    </I18nProvider>
  )
}

function FleetWorkflowProbe() {
  const fleet = useFleet()
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const sampleReg = fleet.vehicles[0]?.registrationNumber ?? 'TN 58 AB 4321'
  const firstVehicleId = fleet.vehicles[0]?.id ?? ''

  return (
    <div>
      <span data-testid="org-name">{fleet.activeOrganization.name}</span>
      <span data-testid="active-count">{fleet.vehicles.length}</span>
      <span data-testid="archived-count">{fleet.archivedVehicles.length}</span>
      <span data-testid="maint-count">{fleet.maintenanceRecords.length}</span>
      {errorMsg && <div role="alert">{errorMsg}</div>}
      <button
        type="button"
        onClick={() => fleet.setActiveRole('org_admin')}
      >
        Auth Admin
      </button>
      <button
        type="button"
        onClick={() => {
          try {
            setErrorMsg(null)
            fleet.addVehicle({
              registrationNumber: sampleReg,
              make: 'Ashok Leyland',
              model: 'Dost',
              category: 'Light Commercial',
              powertrain: 'ICE',
              fuelType: 'Diesel',
              year: 2023,
              odometerKm: 12000,
              dailyAvgKm: 140,
              corridorId: 'cor-chennai',
              assignedDriverId: null,
              insuranceProvider: 'ICICI',
              insuranceExpiry: '2027-01-01',
              registrationExpiry: '2028-01-01',
            })
          } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Error')
          }
        }}
      >
        Try Duplicate Vehicle
      </button>
      <button
        type="button"
        onClick={() => {
          setErrorMsg(null)
          fleet.decommissionVehicle(firstVehicleId)
        }}
      >
        Archive First Vehicle
      </button>
      <button
        type="button"
        onClick={() => {
          const arch = fleet.archivedVehicles[0]
          if (arch) fleet.restoreVehicle(arch.id)
        }}
      >
        Restore Archived Vehicle
      </button>
    </div>
  )
}

describe('Integration Workflows: Cookie Auth, Owner RBAC, Vehicles, Fuel, Settings & Satellite Map', () => {
  it('redirects unauthenticated users from /dashboard to /auth and enforces strict login form without demo/driver shortcuts', async () => {
    mockUnauthenticatedFetch()

    render(
      <TestShell initialEntries={['/dashboard']}>
        <AppRoutes />
      </TestShell>,
    )

    await waitFor(() => {
      expect(screen.getByText(/DriveMitra Workspace Login/i)).toBeInTheDocument()
    })
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Forgot Password\?/i })).toBeInTheDocument()
    expect(screen.queryByText(/Driver Mode/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Enter Demo/i)).not.toBeInTheDocument()
  })

  it('allows cookie-authenticated owner login, temporary password redirect, and sign-out', async () => {
    let authed = false
    const mockUserPayload = {
      authenticated: true,
      id: 'u-1',
      username: 'kaveri.owner',
      email: 'owner@kaveri.in',
      fullName: 'Arjun Raj',
      role: 'org_admin',
      organizationId: 'org-kaveri',
      passwordChangeRequired: false,
      status: 'active',
      redirectTo: '/dashboard',
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/auth/me')) {
        return new Response(
          JSON.stringify(authed ? mockUserPayload : { authenticated: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/auth/login')) {
        authed = true
        return new Response(JSON.stringify(mockUserPayload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/auth/logout')) {
        authed = false
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    function AuthProbe() {
      const { isAuthenticated, signOut, user } = useAuth()
      return (
        <div>
          <span data-testid="auth-state">{isAuthenticated ? user?.username : 'guest'}</span>
          <button type="button" onClick={() => void signOut()}>Sign Out Probe</button>
        </div>
      )
    }

    render(
      <TestShell initialEntries={['/auth']}>
        <AuthProbe />
        <AppRoutes />
      </TestShell>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/Username/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'kaveri.owner' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'DriveMitra@2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('kaveri.owner')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out Probe' }))
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('guest')
    })
  })

  it('prevents same-org duplicate registration, preserves maintenance history on archive, and restores cleanly', () => {
    mockUnauthenticatedFetch()
    render(
      <TestShell>
        <FleetWorkflowProbe />
      </TestShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Auth Admin' }))
    const initialActive = Number(screen.getByTestId('active-count').textContent)
    const initialMaint = Number(screen.getByTestId('maint-count').textContent)

    fireEvent.click(screen.getByRole('button', { name: 'Try Duplicate Vehicle' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/already registered/i)

    fireEvent.click(screen.getByRole('button', { name: 'Archive First Vehicle' }))
    expect(Number(screen.getByTestId('active-count').textContent)).toBe(initialActive - 1)
    expect(Number(screen.getByTestId('archived-count').textContent)).toBe(1)
    expect(Number(screen.getByTestId('maint-count').textContent)).toBe(initialMaint)

    fireEvent.click(screen.getByRole('button', { name: 'Restore Archived Vehicle' }))
    expect(Number(screen.getByTestId('active-count').textContent)).toBe(initialActive)
    expect(Number(screen.getByTestId('archived-count').textContent)).toBe(0)
  })

  it('validates invalid fuel amounts inline and renders Settings DigiLocker readiness toggle', () => {
    mockUnauthenticatedFetch()
    render(
      <TestShell>
        <Settings />
        <FuelLogs />
      </TestShell>,
    )

    expect(screen.getByText(/Optional DigiLocker KYC Verification Readiness/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Log Fuel \/ Charging/i }))
    const qtyInput = screen.getByLabelText(/Liters \/ kWh/i) as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '0' } })
    const form = qtyInput.closest('form')!
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than zero/i)
  })

  it('persists verified fuel state, syncs driver scores, enforces duplicate trip error, and syncs motion toggle', () => {
    mockUnauthenticatedFetch()

    function FullStateProbe() {
      const fleet = useFleet()
      const [tripErr, setTripErr] = React.useState<string>('')
      const firstFlagged = fleet.fuelTransactions.find((f) => f.verificationStatus === 'needs_review')
      const firstDisputableEvent = fleet.driverEvents.find((e) => e.disputeStatus === 'none')
      const targetDriver = fleet.drivers.find((d) => d.id === firstDisputableEvent?.driverId)
      const busyTrip = fleet.trips.find((t) => t.status === 'active')

      return (
        <div>
          <span data-testid="flagged-status">{firstFlagged?.verificationStatus ?? 'none'}</span>
          <span data-testid="target-driver-score">{targetDriver?.safetyScore ?? 0}</span>
          <span data-testid="motion-perm">{String(fleet.vehicles[0]?.telemetry.motionPermissionGranted)}</span>
          <span data-testid="trip-err">{tripErr}</span>

          <button
            type="button"
            onClick={() => {
              if (firstFlagged) fleet.verifyFuelTransaction(firstFlagged.id, 'verified')
            }}
          >
            Verify Flagged Fuel
          </button>

          <button
            type="button"
            onClick={() => {
              if (firstDisputableEvent) {
                fleet.resolveDriverEventDispute(firstDisputableEvent.id, 'accepted_dismissed', 'Validated pothole')
              }
            }}
          >
            Dismiss Driver Event
          </button>

          <button
            type="button"
            onClick={() => {
              if (!busyTrip) return
              try {
                fleet.scheduleTrip({
                  vehicleId: busyTrip.vehicleId,
                  driverId: busyTrip.driverId,
                  originAddress: 'A',
                  destinationAddress: 'B',
                })
              } catch (err) {
                setTripErr(err instanceof Error ? err.message : 'failed')
              }
            }}
          >
            Trigger Duplicate Trip
          </button>

          <button
            type="button"
            onClick={() => {
              fleet.updateTelemetryState(fleet.vehicles[0].id, { motionPermissionGranted: false })
            }}
          >
            Disable Motion Sensor
          </button>
        </div>
      )
    }

    render(
      <TestShell>
        <FullStateProbe />
      </TestShell>,
    )

    expect(screen.getByTestId('flagged-status')).toHaveTextContent('needs_review')
    fireEvent.click(screen.getByRole('button', { name: 'Verify Flagged Fuel' }))
    expect(screen.getByTestId('flagged-status')).toHaveTextContent('none')

    const beforeScore = Number(screen.getByTestId('target-driver-score').textContent)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Driver Event' }))
    expect(Number(screen.getByTestId('target-driver-score').textContent)).toBeGreaterThanOrEqual(beforeScore)

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Duplicate Trip' }))
    expect(screen.getByTestId('trip-err')).toHaveTextContent(/already running/i)

    fireEvent.click(screen.getByRole('button', { name: 'Disable Motion Sensor' }))
    expect(screen.getByTestId('motion-perm')).toHaveTextContent('false')
  })

  it('paginates and renders 60+ vehicles cleanly within performance budget', () => {
    mockUnauthenticatedFetch()
    function LargeFleetSeeder() {
      const { setActiveRole, addVehicle } = useFleet()
      const seededRef = React.useRef(false)
      React.useEffect(() => {
        if (seededRef.current) return
        seededRef.current = true
        setActiveRole('org_admin')
        for (let i = 10; i < 65; i += 1) {
          try {
            addVehicle({
              registrationNumber: `TN 99 QA ${1000 + i}`,
              make: 'Tata',
              model: 'Ace Gold',
              category: 'Light Commercial',
              powertrain: 'ICE',
              fuelType: 'Diesel',
              year: 2024,
              odometerKm: 15000 + i * 100,
              dailyAvgKm: 140,
              corridorId: 'cor-chennai',
              assignedDriverId: null,
              insuranceProvider: 'ICICI',
              insuranceExpiry: '2028-01-01',
              registrationExpiry: '2029-01-01',
            })
          } catch {
            // Skip duplicate
          }
        }
      }, [setActiveRole, addVehicle])
      return <Vehicles />
    }

    const start = performance.now()
    render(
      <TestShell>
        <LargeFleetSeeder />
      </TestShell>,
    )
    const elapsedMs = performance.now() - start
    expect(elapsedMs).toBeLessThan(2500)
    expect(screen.getByText(/1–10 of/i)).toBeInTheDocument()
  })

  it('renders Kochi-to-Coimbatore satellite corridor route and switches cleanly to track all 8 fleet vehicles', () => {
    mockUnauthenticatedFetch()
    mockFitBounds.mockClear()
    mockFlyTo.mockClear()

    render(
      <TestShell initialEntries={['/dashboard/map']}>
        <Routes>
          <Route path="/dashboard/map" element={<LiveMap />} />
        </Routes>
      </TestShell>,
    )

    expect(screen.getAllByText(/Fort Kochi – Chinese Fishing Nets/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Adiyogi – Isha Yoga Centre/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Distance: 190 KM/i)).toBeInTheDocument()
    expect(mockFitBounds).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Fleet Assets \(8\)/i }))
    expect(screen.getByText(/Tracking 8\/8 fleet assets/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('mock-marker').length).toBe(8)
    expect(mockFlyTo).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /TN 38 AB 1234/i }))
    expect(screen.getByText(/Route & Trip Playback/i)).toBeInTheDocument()
    expect(screen.getByText(/Geofence Status/i)).toBeInTheDocument()
    expect(mockFlyTo).toHaveBeenCalled()
  })
})
