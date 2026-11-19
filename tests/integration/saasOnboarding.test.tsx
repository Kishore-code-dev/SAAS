import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider, useAuth } from '../../src/hooks/useAuth'
import { FleetProvider, useFleet } from '../../src/hooks/useFleet'
import { I18nProvider } from '../../src/i18n/useTranslation'
import { AppRoutes } from '../../src/App'
import Landing from '../../src/pages/Landing'
import Subscription from '../../src/pages/Subscription'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

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

describe('SaaS Onboarding, Billing Cycle & Subscription Workflows', () => {
  it('renders Monthly/Annual pricing toggle and 14-day free trial CTAs on Landing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ authenticated: false }), { status: 200 })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    render(
      <TestShell>
        <Landing />
      </TestShell>,
    )

    expect(screen.getByRole('button', { name: /Start 14-Day Free Trial/i })).toBeInTheDocument()
    expect(screen.getByText(/₹14,999/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Annual \(Save 20%\)/i }))
    await waitFor(() => {
      expect(screen.getByText(/₹11,999/)).toBeInTheDocument()
    })
  })

  it('provisions a new SaaS tenant via /signup and sets authenticated workspace state', async () => {
    let authed = false
    const provisionedOrg = {
      id: 'org-cauvery',
      name: 'Cauvery Logistics Pvt Ltd',
      code: 'CAU-402',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      planId: 'growth',
      vehicleLimit: 25,
      driverLimit: 40,
      status: 'active',
      paymentStatus: 'paid',
      subscriptionStartDate: '2026-11-19',
      subscriptionExpiryDate: '2026-12-03',
      ownerName: 'Karthik Rajan',
      ownerEmail: 'karthik@cauveryfleet.in',
      createdAt: '2026-11-19T00:00:00.000Z',
      environment: 'production',
    }
    const provisionedUser = {
      authenticated: true,
      id: 'u-cauvery',
      username: 'cauvery.owner',
      email: 'karthik@cauveryfleet.in',
      fullName: 'Karthik Rajan',
      role: 'org_admin',
      organizationId: 'org-cauvery',
      passwordChangeRequired: false,
      status: 'active',
      organization: provisionedOrg,
      redirectTo: '/dashboard',
    }

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/auth/me')) {
        return new Response(
          JSON.stringify(authed ? provisionedUser : { authenticated: false }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/auth/register')) {
        authed = true
        return new Response(JSON.stringify(provisionedUser), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.includes('/api/fleet/bootstrap')) {
        return new Response(
          JSON.stringify({
            organization: provisionedOrg,
            role: 'org_admin',
            updatedAt: '2026-11-19T00:00:00.000Z',
            data: { vehicles: [], drivers: [], members: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    function SignupProbe() {
      const { isAuthenticated, organization } = useAuth()
      return <span data-testid="signup-org">{isAuthenticated ? organization?.name : 'guest'}</span>
    }

    render(
      <TestShell initialEntries={['/signup?plan=growth&billing=annual']}>
        <SignupProbe />
        <AppRoutes />
      </TestShell>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText(/Fleet Organization Name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Fleet Organization Name/i), {
      target: { value: 'Cauvery Logistics Pvt Ltd' },
    })
    fireEvent.change(screen.getByLabelText(/Primary Hub City/i), { target: { value: 'Coimbatore' } })
    fireEvent.change(screen.getByLabelText(/^State$/i), { target: { value: 'Tamil Nadu' } })
    fireEvent.change(screen.getByLabelText(/Owner Full Name/i), { target: { value: 'Karthik Rajan' } })
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: 'karthik@cauveryfleet.in' } })
    fireEvent.change(screen.getByLabelText(/Admin Username/i), { target: { value: 'cauvery.owner' } })
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: 'Cauvery@2026!' } })

    fireEvent.click(screen.getByRole('button', { name: /Launch Free Trial Workspace/i }))

    await waitFor(() => {
      expect(screen.getByTestId('signup-org')).toHaveTextContent('Cauvery Logistics Pvt Ltd')
    })
  })

  it('switches subscription tier on Subscription page and renders server GST invoice ledger', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input)
      if (url.includes('/api/auth/me')) {
        return new Response(JSON.stringify({ authenticated: false }), { status: 200 })
      }
      if (url.includes('/api/fleet/subscription') && init?.method === 'PATCH') {
        return new Response(
          JSON.stringify({
            organization: {
              planId: 'enterprise',
              vehicleLimit: 250,
              driverLimit: 400,
              paymentStatus: 'paid',
              subscriptionExpiryDate: '2027-11-19',
            },
            invoices: [
              {
                id: 'sinv-ent-1',
                invoiceNumber: 'DM-KAV-202611-901',
                planId: 'enterprise',
                billingCycle: 'annual',
                baseAmountInr: 432000,
                gstInr: 77760,
                totalInr: 509760,
                status: 'paid',
                periodStart: '2026-11-19',
                periodEnd: '2027-11-19',
                issuedAt: '2026-11-19T00:00:00.000Z',
                notes: 'Enterprise (annual) subscription activation',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/fleet/subscription')) {
        return new Response(
          JSON.stringify({
            isTrial: true,
            invoices: [
              {
                id: 'sinv-trial-1',
                invoiceNumber: 'DM-KAV-TRIAL',
                planId: 'growth',
                billingCycle: 'monthly',
                baseAmountInr: 0,
                gstInr: 0,
                totalInr: 0,
                status: 'trial',
                periodStart: '2026-11-19',
                periodEnd: '2026-12-03',
                issuedAt: '2026-11-19T00:00:00.000Z',
                notes: '14-day trial',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    function AdminRoleSetup() {
      const { setActiveRole } = useFleet()
      return (
        <button type="button" onClick={() => setActiveRole('org_admin')}>
          Grant Owner Role
        </button>
      )
    }

    render(
      <TestShell>
        <AdminRoleSetup />
        <Subscription />
      </TestShell>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Grant Owner Role' }))

    await waitFor(() => {
      expect(screen.getByText('DM-KAV-TRIAL')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Annual \(20% Off\)/i }))
    fireEvent.click(screen.getByRole('button', { name: /Switch to Enterprise/i }))

    await waitFor(() => {
      expect(screen.getByText('DM-KAV-202611-901')).toBeInTheDocument()
      expect(screen.getByText(/₹5,09,760/)).toBeInTheDocument()
      expect(screen.getByText(/Tax & Billing Entity/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    await waitFor(() => {
      expect(screen.getByText(/SAC 998314/i)).toBeInTheDocument()
      expect(screen.getByText(/CGST \(9%\)/i)).toBeInTheDocument()
      expect(screen.getByText(/SGST \(9%\)/i)).toBeInTheDocument()
    })
  })
})
