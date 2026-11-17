import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../src/hooks/useAuth'
import { FleetProvider, useFleet } from '../../src/hooks/useFleet'
import { I18nProvider } from '../../src/i18n/useTranslation'
import { AppRoutes } from '../../src/App'
import FuelLogs from '../../src/pages/FuelLogs'
import Settings from '../../src/pages/Settings'
import DriverApp from '../../src/pages/DriverApp'
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

function TestShell({
  initialEntries = ['/'],
  children,
}: {
  initialEntries?: string[]
  children: React.ReactNode
}) {
  return (
    <I18nProvider>
      <FleetProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </AuthProvider>
      </FleetProvider>
    </I18nProvider>
  )
}

function FleetWorkflowProbe() {
  const fleet = useFleet()
  const auth = useAuth()
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
        onClick={() => {
          auth.enterDemoSession({
            fullName: 'Ops Admin',
            email: 'admin@kaveri.in',
            role: 'org_admin',
            isDemo: true,
          })
          fleet.setActiveRole('org_admin')
        }}
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
      <button
        type="button"
        onClick={() => {
          const other = fleet.organizations.find((o) => o.id !== fleet.activeOrganization.id)
          if (other) fleet.setActiveOrganizationId(other.id)
        }}
      >
        Switch Org
      </button>
    </div>
  )
}

describe('Integration Workflows: Auth, RBAC, Vehicles, Fuel, Settings, & Driver Mobile', () => {
  it('redirects unauthenticated users from /dashboard to /auth and supports demo sign-in & sign-out', async () => {
    function AuthLogoutButton() {
      const { signOut, isAuthenticated } = useAuth()
      return (
        <div>
          <span data-testid="auth-state">{isAuthenticated ? 'yes' : 'no'}</span>
          <button type="button" onClick={() => void signOut()}>
            Sign Out Probe
          </button>
        </div>
      )
    }

    render(
      <TestShell initialEntries={['/dashboard']}>
        <AuthLogoutButton />
        <AppRoutes />
      </TestShell>,
    )

    await waitFor(() => {
      expect(screen.getByText(/DriveMitra Workspace Access/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Enter Fleet Command Centre/i }))

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('yes')
    })

    fireEvent.click(screen.getByRole('button', { name: /Sign Out Probe/i }))
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('no')
    })
  })

  it('enforces RoleProtectedRoute for driver and finance roles', async () => {
    localStorage.setItem(
      'dm_demo_profile_v2',
      JSON.stringify({ fullName: 'Driver One', email: 'drv@kaveri.in', role: 'driver', isDemo: true }),
    )
    localStorage.setItem('dm_active_role_v2', 'driver')

    render(
      <TestShell initialEntries={['/dashboard']}>
        <AppRoutes />
      </TestShell>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument()
    })
  })

  it('blocks finance role from maintenance route via RoleProtectedRoute', async () => {
    localStorage.setItem(
      'dm_demo_profile_v2',
      JSON.stringify({ fullName: 'Finance Lead', email: 'fin@kaveri.in', role: 'finance', isDemo: true }),
    )
    localStorage.setItem('dm_active_role_v2', 'finance')

    render(
      <TestShell initialEntries={['/dashboard/maintenance']}>
        <AppRoutes />
      </TestShell>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument()
    })
  })

  it('prevents same-org duplicate registration, preserves maintenance history on archive, and restores cleanly', () => {
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

  it('validates invalid fuel amounts inline and syncs Settings form inputs when switching organizations', () => {
    function SwitcherPlusPages() {
      const fleet = useFleet()
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              const other = fleet.organizations.find((o) => o.id !== fleet.activeOrganization.id)
              if (other) fleet.setActiveOrganizationId(other.id)
            }}
          >
            Switch Tenant Org
          </button>
          <Settings />
          <FuelLogs />
        </div>
      )
    }

    render(
      <TestShell>
        <SwitcherPlusPages />
      </TestShell>,
    )

    const orgInput = screen.getByLabelText('Organization Name') as HTMLInputElement
    const firstOrgName = orgInput.value

    fireEvent.click(screen.getByRole('button', { name: 'Switch Tenant Org' }))
    expect(orgInput.value).not.toBe(firstOrgName)

    fireEvent.click(screen.getByRole('button', { name: /Log Fuel \/ Charging/i }))
    const qtyInput = screen.getByLabelText(/Liters \/ kWh/i) as HTMLInputElement
    fireEvent.change(qtyInput, { target: { value: '0' } })
    const form = qtyInput.closest('form')!
    fireEvent.submit(form)
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than zero/i)
  })

  it('locks driver switcher for driver role (DRIVER-019) and warns on GPS revocation mid-trip (DRIVER-008)', () => {
    localStorage.setItem('dm_active_role_v2', 'driver')

    render(
      <TestShell initialEntries={['/driver']}>
        <Routes>
          <Route path="/driver" element={<DriverApp />} />
        </Routes>
      </TestShell>,
    )

    expect(screen.getByText('Session Locked')).toBeInTheDocument()
    expect(screen.queryByLabelText('Switch Driver')).not.toBeInTheDocument()

    // Start a trip or verify active trip, then switch to Device tab and disable GPS
    const startBtn = screen.queryByRole('button', { name: /Start Trip/i })
    if (startBtn) {
      fireEvent.click(startBtn)
    }
    expect(screen.getByText(/Trip Active · Driving Safety Mode/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Device' }))
    const gpsCheckbox = screen.getByLabelText(/GPS Location Permission/i) as HTMLInputElement
    fireEvent.click(gpsCheckbox)

    expect(screen.getByRole('alert')).toHaveTextContent(/GPS Permission Revoked Mid-Trip/i)
  })

  it('resets role on signOut, persists verified fuel state, syncs driver scores, enforces duplicate trip error, and syncs motion toggle', async () => {
    localStorage.setItem('dm_active_role_v2', 'org_admin')

    function FullStateProbe() {
      const fleet = useFleet()
      const auth = useAuth()
      const [tripErr, setTripErr] = React.useState<string>('')
      const firstFlagged = fleet.fuelTransactions.find((f) => f.verificationStatus === 'needs_review')
      const firstDisputableEvent = fleet.driverEvents.find((e) => e.disputeStatus === 'none')
      const targetDriver = fleet.drivers.find((d) => d.id === firstDisputableEvent?.driverId)
      const busyTrip = fleet.trips.find((t) => t.status === 'active')

      return (
        <div>
          <span data-testid="active-role">{fleet.activeRole}</span>
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

          <button type="button" onClick={() => void auth.signOut()}>
            Sign Out Full
          </button>
        </div>
      )
    }

    render(
      <TestShell>
        <FullStateProbe />
      </TestShell>,
    )

    expect(screen.getByTestId('active-role')).toHaveTextContent('org_admin')
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

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out Full' }))
    await waitFor(() => {
      expect(screen.getByTestId('active-role')).toHaveTextContent('fleet_manager')
    })
  })

  it('paginates and renders 60+ vehicles cleanly within performance budget (FLEET-019)', () => {
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
            // Skip if already seeded
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

  it('tracks every fleet vehicle simultaneously on LiveMap via fitBounds and supports route playback', () => {
    mockFitBounds.mockClear()
    mockFlyTo.mockClear()

    render(
      <TestShell initialEntries={['/dashboard/map']}>
        <Routes>
          <Route path="/dashboard/map" element={<LiveMap />} />
        </Routes>
      </TestShell>,
    )

    // All 8 Kaveri Logistics vehicles render simultaneously (never collapsed to 1 location)
    expect(screen.getByText(/Tracking 8\/8 fleet assets/i)).toBeInTheDocument()
    expect(screen.getAllByTestId('mock-marker').length).toBe(8)
    expect(mockFitBounds).toHaveBeenCalled()
    expect(mockFlyTo).not.toHaveBeenCalled()

    // Select a moving vehicle from the Fleet Roster to open telemetry, geofence status & route playback
    fireEvent.click(screen.getByRole('button', { name: /TN 38 AB 1234/i }))
    expect(screen.getByText(/Route & Trip Playback/i)).toBeInTheDocument()
    expect(screen.getByText(/Geofence Status/i)).toBeInTheDocument()
    expect(mockFlyTo).toHaveBeenCalled()
  })

  it('supports standalone local Register, invalid-credential rejection, Sign In, and Email OTP without env vars or backend', async () => {
    render(
      <TestShell initialEntries={['/auth']}>
        <AppRoutes />
      </TestShell>,
    )

    // Switch to Register tab and confirm no env var warning banner exists
    fireEvent.click(screen.getByRole('tab', { name: /Register/i }))
    expect(screen.queryByText(/Cloud Supabase Auth variables are not configured/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Priya Ops' } })
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'priya@kaveri.in' } })
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'fleetpass99' } })
    fireEvent.click(screen.getByRole('button', { name: /Create Organization Account/i }))

    // Automatically switches to Sign In tab after registration
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign In to Workspace/i })).toBeInTheDocument()
    })

    // Wrong password rejected cleanly
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Workspace/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid email or password/i)
    })

    // Valid password succeeds and navigates to Command Centre
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'fleetpass99' } })
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Workspace/i }))
    await waitFor(() => {
      expect(screen.getByText(/Priya Ops/i)).toBeInTheDocument()
    })
  })
})

