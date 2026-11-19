import React, { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import Sidebar from './Sidebar'
import SettingsSidebar from './SettingsSidebar'
import Header from './Header'
import FleetCopilotDrawer from '../ai/FleetCopilotDrawer'
import AddVehicleDialog from '../vehicles/AddVehicleDialog'
import { useFleet } from '../../hooks/useFleet'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [addVehicleOpen, setAddVehicleOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const { environment, activeOrganization, activeRole, isTrialWorkspace, nowTick } = useFleet()
  const { pathname } = useLocation()
  const inSettings = pathname.startsWith('/dashboard/settings')
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
    <div className="min-h-screen bg-[#FFFFFF] text-[#625346] flex">
      {inSettings ? (
        <SettingsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FFFFFF]">
        <Header
          onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          onOpenCopilot={() => setCopilotOpen(true)}
          onAddVehicle={() => setAddVehicleOpen(true)}
        />
        {showBillingAlert && (
          <div className="bg-[#EEE8F7] border-b border-[#DDD3ED] px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#625346]">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-3.5 h-3.5 text-[#6E5696] shrink-0" />
              <span className="font-medium truncate">
                {isTrialWorkspace
                  ? `14-Day ${activeOrganization.planId.toUpperCase()} Trial · ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining before renewal (${activeOrganization.subscriptionExpiryDate})`
                  : activeOrganization.status === 'grace_period'
                    ? `Grace Period Active · Update subscription before ${activeOrganization.gracePeriodUntil ?? activeOrganization.subscriptionExpiryDate}`
                    : 'Subscription Payment Pending · Complete plan activation to avoid service interruption'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/dashboard/subscription"
                className="font-semibold text-[#6E5696] hover:underline whitespace-nowrap"
              >
                {isTrialWorkspace ? 'Activate Paid Plan' : 'Manage Billing'}
              </Link>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss trial banner"
                className="p-1 rounded hover:bg-[#DDD3ED]/50 text-[#958777] hover:text-[#625346]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto bg-[#FFFFFF]">
          <Outlet key={`${environment}:${activeOrganization.id}`} />
        </main>
      </div>
      <FleetCopilotDrawer
        key={`${environment}:${activeOrganization.id}:${activeRole}`}
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
      <AddVehicleDialog open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} />
    </div>
  )
}
