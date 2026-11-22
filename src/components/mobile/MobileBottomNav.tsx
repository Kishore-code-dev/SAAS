import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  ClipboardCheck,
  Fuel,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  Truck,
  Wrench,
} from 'lucide-react'
import type { OrganizationRole } from '../../types/fleet'

interface TabItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

function getTabsForRole(role: OrganizationRole): TabItem[] {
  if (role === 'maintenance') {
    return [
      { to: '/dashboard/maintenance', label: 'Service', icon: Wrench, end: true },
      { to: '/dashboard/work-orders', label: 'Orders', icon: ClipboardCheck },
      { to: '/dashboard/inspections', label: 'Inspect', icon: Truck },
      { to: '/dashboard/inventory', label: 'Parts', icon: Package },
    ]
  }
  if (role === 'finance') {
    return [
      { to: '/dashboard/financials', label: 'Reports', icon: LayoutDashboard, end: true },
      { to: '/dashboard/finance', label: 'Finance', icon: Landmark, end: true },
      { to: '/dashboard/finance/emis', label: 'EMIs', icon: ClipboardCheck },
      { to: '/dashboard/fuel', label: 'Fuel', icon: Fuel },
    ]
  }
  return [
    { to: '/dashboard', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/dashboard/fleet', label: 'Fleet', icon: Truck },
    { to: '/dashboard/map', label: 'Map', icon: MapPin },
    { to: '/dashboard/fuel', label: 'Fuel', icon: Fuel },
  ]
}

import { useAuth } from '../../hooks/useAuth'
import { canAccessRoute } from '../../utils/rbac'

export function MobileBottomNav({
  role,
  appsOpen,
  onOpenApps,
}: {
  role: OrganizationRole
  appsOpen: boolean
  onOpenApps: () => void
}) {
  const { pathname } = useLocation()
  const { permissions } = useAuth()
  const tabs = getTabsForRole(role).filter((t) => canAccessRoute(role, t.to, permissions))
  const inPrimaryTab = tabs.some((t) =>
    t.end ? pathname === t.to : pathname === t.to || pathname.startsWith(`${t.to}/`),
  )

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 inset-x-0 z-40 h-16 bg-[#FFFFFF]/95 backdrop-blur-md border-t border-[#E5E5E5] px-2 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-3xl mx-auto h-full grid grid-cols-5 items-center gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors whitespace-nowrap shrink-0 ${
                  isActive && !appsOpen
                    ? 'text-[#6E5696] bg-[#EEE8F7]/80 font-bold'
                    : 'text-[#958777] hover:text-[#625346] font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`w-5 h-5 ${
                      isActive && !appsOpen ? 'text-[#6E5696]' : 'text-[#958777]'
                    }`}
                  />
                  <span className="text-[11px] leading-tight tracking-tight">{tab.label}</span>
                </>
              )}
            </NavLink>
          )
        })}

        <button
          type="button"
          onClick={onOpenApps}
          aria-expanded={appsOpen}
          aria-label="Open all mobile app modules"
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors whitespace-nowrap shrink-0 ${
            appsOpen || !inPrimaryTab
              ? 'text-[#6E5696] bg-[#EEE8F7]/80 font-bold'
              : 'text-[#958777] hover:text-[#625346] font-medium'
          }`}
        >
          <LayoutGrid
            className={`w-5 h-5 ${appsOpen || !inPrimaryTab ? 'text-[#6E5696]' : 'text-[#958777]'}`}
          />
          <span className="text-[11px] leading-tight tracking-tight">Apps</span>
        </button>
      </div>
    </nav>
  )
}
