import React, { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import Header from './Header'
import FleetCopilotDrawer from '../ai/FleetCopilotDrawer'
import { useFleet } from '../../hooks/useFleet'
import { MobileBottomNav } from '../mobile/MobileBottomNav'
import { MobileAppsSheet } from '../mobile/MobileAppsSheet'
import { OfflineIndicator } from '../mobile/OfflineIndicator'

import { useAuth } from '../../hooks/useAuth'

export default function Layout() {
  const [appsOpen, setAppsOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { environment, activeOrganization, activeRole } = useFleet()
  const { subscriptionAccess, subscription } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onSubscriptionPage = pathname === '/dashboard/subscription'

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const showBillingAlert =
    !bannerDismissed &&
    !onSubscriptionPage &&
    (subscriptionAccess === 'read_only' ||
      activeOrganization.status === 'grace_period' ||
      activeOrganization.status === 'payment_pending')

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#625346] flex flex-col">
      <Header
        onMenuToggle={() => setAppsOpen((prev) => !prev)}
        onOpenCopilot={() => setCopilotOpen(true)}
        onAddVehicle={() => navigate('/dashboard/fleet/new')}
      />

      <main className="flex-1 px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-24 max-w-7xl w-full mx-auto bg-[#FFFFFF] space-y-4">
        {showBillingAlert && (
          <div className="bg-[#EEE8F7] border border-[#DDD3ED] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#625346]">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-[#6E5696] shrink-0" />
              <span className="font-medium truncate">
                {subscriptionAccess === 'read_only'
                  ? `Subscription expired (${subscription?.currentPeriodEnd?.slice(0, 10) ?? activeOrganization.subscriptionExpiryDate}) — Workspace is in read-only mode until renewed.`
                  : activeOrganization.status === 'grace_period'
                    ? `Grace Period · Renew before ${activeOrganization.gracePeriodUntil ?? activeOrganization.subscriptionExpiryDate}`
                    : 'Subscription Payment Pending · Complete activation'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/dashboard/subscription"
                className="font-semibold text-[#6E5696] hover:underline whitespace-nowrap"
              >
                {subscriptionAccess === 'read_only' ? 'Renew Plan' : 'Billing'}
              </Link>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss billing banner"
                className="p-1.5 rounded-lg hover:bg-[#DDD3ED]/50 text-[#958777] hover:text-[#625346]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <Outlet key={`${environment}:${activeOrganization.id}`} />
      </main>

      <OfflineIndicator />

      <MobileBottomNav
        role={activeRole}
        appsOpen={appsOpen}
        onOpenApps={() => setAppsOpen(true)}
      />

      <MobileAppsSheet open={appsOpen} onClose={() => setAppsOpen(false)} />

      <FleetCopilotDrawer
        key={`${environment}:${activeOrganization.id}:${activeRole}`}
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
    </div>
  )
}
