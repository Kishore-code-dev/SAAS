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

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="mock-map">{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => null,
  useMap: () => ({ setView: vi.fn() }),
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
})
