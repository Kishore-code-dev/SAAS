import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Bot,
  Building2,
  ChevronDown,
  Globe,
  Menu,
  RotateCcw,
  Search,
  User,
} from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../i18n/useTranslation'
import { languageOptions } from '../../i18n/translations'
import type { OperatingEnvironment, ReportingPeriod } from '../../types/fleet'
import { canAccessRoute, canPerformAction } from '../../utils/rbac'

export default function Header({
  onMenuToggle,
  onOpenCopilot,
}: {
  onMenuToggle: () => void
  onOpenCopilot?: () => void
  title?: string
}) {
  const {
    environment,
    setEnvironment,
    resetCurrentEnvironment,
    organizations,
    activeOrganization,
    setActiveOrganizationId,
    activeRole,
    reportingPeriod,
    setReportingPeriod,
    searchTerm,
    setSearchTerm,
    alerts,
    unreadAlertCount,
    markAlertRead,
  } = useFleet()

  const { user, demoProfile, signOut } = useAuth()
  const { language, setLanguage } = useTranslation()
  const navigate = useNavigate()

  const [alertsOpen, setAlertsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName =
    demoProfile?.fullName ??
    (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null) ??
    user?.email ??
    'Fleet Operations'

  const envStyles: Record<OperatingEnvironment, string> = {
    demo: 'bg-[#EEE8F7] text-[#625346] border-[#B8A3D9]',
    pilot: 'bg-[#E8C65A]/30 text-[#625346] border-[#C9A63B]',
    production: 'bg-[#789A75]/22 text-[#625346] border-[#789A75]',
  }

  return (
    <header className="h-16 bg-[#FBF6E6] border-b border-[#E0D4B7] px-4 lg:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 rounded-[10px] text-[#625346] hover:bg-[#EEE8F7] shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Organization Selector */}
        <div className="flex items-center gap-1.5 bg-[#F4EBD5] border border-[#E0D4B7] rounded-[10px] px-2.5 py-1.5 min-w-0">
          <Building2 className="w-4 h-4 text-[#6E5696] shrink-0" />
          <label htmlFor="org-switcher" className="sr-only">
            Active Organization
          </label>
          <select
            id="org-switcher"
            value={activeOrganization.id}
            onChange={(e) => setActiveOrganizationId(e.target.value)}
            className="bg-transparent text-xs font-semibold text-[#625346] outline-none pr-1 cursor-pointer max-w-[155px] sm:max-w-[195px] truncate"
          >
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name} ({org.code})
              </option>
            ))}
          </select>
        </div>

        {/* Explicit Environment Switcher */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <label htmlFor="env-switcher" className="sr-only">
            Operating Environment
          </label>
          <select
            id="env-switcher"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as OperatingEnvironment)}
            className={`text-xs font-semibold border rounded-[10px] px-2.5 py-1.5 outline-none cursor-pointer uppercase ${envStyles[environment]}`}
          >
            <option value="demo">DEMO</option>
            <option value="pilot">PILOT</option>
            <option value="production">PRODUCTION</option>
          </select>
          {environment !== 'production' && (
            <button
              type="button"
              onClick={resetCurrentEnvironment}
              title="Reset environment data to baseline"
              aria-label="Reset environment data"
              className="p-1.5 rounded-[10px] border border-[#E0D4B7] bg-[#F4EBD5] text-[#7D6D5F] hover:text-[#625346] hover:bg-[#EEE8F7] transition-colors shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Global Search + Period + Copilot + Notifications + User */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative hidden md:block w-40 xl:w-52">
          <Search className="w-4 h-4 text-[#7D6D5F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search vehicles, drivers..."
            aria-label="Global fleet search"
            className="w-full bg-[#F4EBD5] border border-[#E0D4B7] rounded-[10px] pl-9 pr-3 py-1.5 text-xs text-[#625346] placeholder:text-[#7D6D5F] outline-none focus:bg-[#FBF6E6] focus:border-[#B8A3D9]"
          />
        </div>

        {/* Reporting Period Selector */}
        <div className="hidden lg:flex items-center bg-[#EEE8F7] p-0.5 rounded-[10px] border border-[#D4C7E6]" role="group" aria-label="Reporting period">
          {(['7d', '30d', '90d'] as ReportingPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setReportingPeriod(p)}
              className={`px-2.5 py-1 rounded-[8px] text-xs font-semibold uppercase transition-colors whitespace-nowrap ${
                reportingPeriod === p
                  ? 'bg-[#E8C65A] text-[#625346] shadow-subtle'
                  : 'text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {onOpenCopilot && canPerformAction(activeRole, 'use_copilot') && (
          <button
            type="button"
            onClick={onOpenCopilot}
            aria-label="Open Fleet Intelligence Copilot"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] border border-[#B8A3D9] bg-[#EEE8F7] text-[#625346] hover:bg-[#DFD3F2] text-xs font-semibold transition-colors whitespace-nowrap"
          >
            <Bot className="w-3.5 h-3.5 text-[#6E5696]" />
            <span>Copilot</span>
          </button>
        )}

        {/* Language */}
        <div className="hidden xl:flex items-center gap-1 border border-[#E0D4B7] rounded-[10px] px-2 py-1.5 bg-[#F4EBD5]">
          <Globe className="w-3.5 h-3.5 text-[#7D6D5F]" />
          <label htmlFor="header-lang" className="sr-only">
            Language
          </label>
          <select
            id="header-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            className="text-xs font-medium text-[#625346] bg-transparent outline-none cursor-pointer"
          >
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.nativeLabel}
              </option>
            ))}
          </select>
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAlertsOpen((o) => !o)
              setUserMenuOpen(false)
            }}
            aria-label={`Notifications (${unreadAlertCount} unread)`}
            className="relative p-2 rounded-[10px] border border-[#E0D4B7] bg-[#F4EBD5] text-[#625346] hover:bg-[#EEE8F7] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FBF6E6] border border-[#D9786C] text-[#625346] text-[10px] font-bold tabular-nums flex items-center justify-center shadow-subtle">
                {unreadAlertCount}
              </span>
            )}
          </button>

          {alertsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#FBF6E6] border border-[#D4C7E6] rounded-xl shadow-elevated z-50 p-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#E0D4B7]">
                <span className="text-xs font-bold text-[#625346]">Operational Alerts</span>
                <button
                  type="button"
                  onClick={() => {
                    setAlertsOpen(false)
                    navigate('/dashboard/alerts')
                  }}
                  className="text-xs font-semibold text-[#6E5696] hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-[#E0D4B7]/70">
                {alerts.slice(0, 5).map((al) => (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => {
                      markAlertRead(al.id)
                      setAlertsOpen(false)
                      navigate(al.actionRoute)
                    }}
                    className={`w-full text-left py-2.5 px-2 hover:bg-[#EEE8F7] transition-colors rounded-lg ${
                      al.read ? 'opacity-65' : ''
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#625346] line-clamp-1">{al.title}</p>
                    <p className="text-xs text-[#7D6D5F] line-clamp-2 mt-0.5">{al.message}</p>
                  </button>
                ))}
                {alerts.length === 0 && (
                  <p className="text-xs text-[#7D6D5F] py-6 text-center">No active operational alerts.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen((o) => !o)
              setAlertsOpen(false)
            }}
            aria-label="User account menu"
            className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-[10px] border border-[#E0D4B7] bg-[#F4EBD5] hover:bg-[#EEE8F7] transition-colors"
          >
            <div className="w-6 h-6 rounded-[8px] bg-[#E8C65A] border border-[#C9A63B] text-[#625346] flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-[#625346] leading-none max-w-[110px] truncate">
                {displayName}
              </p>
              <p className="text-[11px] text-[#7D6D5F] capitalize leading-tight mt-0.5">
                {activeRole.replace('_', ' ')}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#7D6D5F]" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#FBF6E6] border border-[#D4C7E6] rounded-xl shadow-elevated z-50 p-2">
              <div className="px-2.5 py-2 border-b border-[#E0D4B7]">
                <p className="text-xs font-semibold text-[#625346] truncate">{displayName}</p>
                <p className="text-xs text-[#7D6D5F] truncate">{activeOrganization.name}</p>
              </div>
              {canAccessRoute(activeRole, '/dashboard/settings') && (
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/dashboard/settings')
                  }}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium text-[#625346] hover:bg-[#EEE8F7] rounded-lg mt-1"
                >
                  Workspace Settings
                </button>
              )}
              {canAccessRoute(activeRole, '/dashboard/admin') && (
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/dashboard/admin')
                  }}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium text-[#625346] hover:bg-[#EEE8F7] rounded-lg"
                >
                  Admin Console
                </button>
              )}
              {canAccessRoute(activeRole, '/driver') && (
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/driver')
                  }}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium text-[#625346] hover:bg-[#EEE8F7] rounded-lg"
                >
                  Switch to Driver App
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  setUserMenuOpen(false)
                  await signOut()
                  navigate('/auth', { replace: true })
                }}
                className="w-full text-left px-2.5 py-2 text-xs font-semibold text-[#B84E42] hover:bg-[#D9786C]/20 rounded-lg mt-1 border-t border-[#E0D4B7]"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
