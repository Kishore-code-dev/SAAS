import React, { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import Header from './Header'
import FleetCopilotDrawer from '../ai/FleetCopilotDrawer'
import { useFleet } from '../../hooks/useFleet'
import { MobileBottomNav } from '../mobile/MobileBottomNav'
import { MobileAppsSheet } from '../mobile/MobileAppsSheet'
import { OfflineIndicator } from '../mobile/OfflineIndicator'

export default function Layout() {
  const [appsOpen, setAppsOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { environment, activeOrganization, activeRole, isTrialWorkspace, nowTick } = useFleet()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const onSubscriptionPage = pathname === '/dashboard/subscription'

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const expiryMs = new Date(activeOrganization.subscriptionExpiryDate).getTime()
  const daysLeft = Number.isFinite(expiryMs)
    ? Math.max(0, Math.ceil((expiryMs - nowTick) / 86400000))
    : 14
  const showBillingAlert =
    !bannerDismissed &&
    !onSubscriptionPage &&
    (isTrialWorkspace ||
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
                {isTrialWorkspace
                  ? `14-Day ${activeOrganization.planId.toUpperCase()} Trial · ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining (${activeOrganization.subscriptionExpiryDate})`
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
                {isTrialWorkspace ? 'Activate Plan' : 'Billing'}
              </Link>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss trial banner"
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
