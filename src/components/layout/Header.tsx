import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronDown,
  Cpu,
  Fuel,
  Globe,
  Landmark,
  Menu,
  Plus,
  Search,
  ShieldAlert,
  User,
  Wrench,
  X,
} from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { useOptionalFinance } from '../../hooks/useFinance'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../i18n/useTranslation'
import { languageOptions } from '../../i18n/translations'
import type { RiskCategory } from '../../types/fleet'
import { canAccessRoute, canPerformAction } from '../../utils/rbac'
import { DhiyuLogo } from '../ui/DhiyuLogo'
import { BrandLogo } from '../ui/BrandLogo'
import { PWAInstallButton } from '../mobile/PWAInstallButton'

function CategoryIcon({ category }: { category: RiskCategory }) {
  switch (category) {
    case 'maintenance':
      return <Cpu className="w-4 h-4 text-[#6E5696]" />
    case 'fuel':
      return <Fuel className="w-4 h-4 text-[#D8B442]" />
    case 'inventory_shortage':
      return <Wrench className="w-4 h-4 text-[#D9786C]" />
    case 'compliance_expiry':
    case 'driver_safety':
      return <ShieldAlert className="w-4 h-4 text-[#B84E42]" />
    default:
      return <AlertTriangle className="w-4 h-4 text-[#6E5696]" />
  }
}

export default function Header({
  onMenuToggle,
  onOpenCopilot,
  onAddVehicle,
}: {
  onMenuToggle: () => void
  onOpenCopilot?: () => void
  onAddVehicle?: () => void
  title?: string
}) {
  const {
    activeOrganization,
    activeRole,
    searchTerm,
    setSearchTerm,
    alerts,
    unreadAlertCount,
    markAlertRead,
    markAllAlertsRead,
  } = useFleet()

  const { user, signOut } = useAuth()
  const financeCtx = useOptionalFinance()
  const financeAlerts = financeCtx?.alerts ?? []
  const ackFinanceAlert = financeCtx?.ackFinanceAlert ?? (async () => {})
  const { language, setLanguage } = useTranslation()
  const navigate = useNavigate()

  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const displayName = user?.fullName ?? user?.username ?? 'Fleet Owner'
  const unreadFinanceCount = financeAlerts.filter((a) => !a.read).length
  const totalUnreadCount = unreadAlertCount + unreadFinanceCount
  const combinedAlerts = [
    ...financeAlerts.map((fa) => ({
      id: fa.id,
      kind: 'finance' as const,
      severity: fa.severity,
      timestamp: fa.createdAt,
      title: fa.title,
      message: `${fa.message} (${fa.channelSummary})`,
      actionRoute: fa.actionRoute,
      read: fa.read,
      category: 'compliance_expiry' as RiskCategory,
    })),
    ...alerts.map((al) => ({
      id: al.id,
      kind: 'fleet' as const,
      severity: al.severity,
      timestamp: al.timestamp,
      title: al.title,
      message: al.message,
      actionRoute: al.actionRoute,
      read: al.read,
      category: al.category,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return (
    <>
      <header className="h-14 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E5E5E5] px-2.5 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Open app modules launcher"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#625346] hover:bg-[#EEE8F7] shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 min-w-0 text-left"
          >
            <BrandLogo size="sm" className="shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-sm font-bold text-[#625346] truncate leading-tight">
                {activeOrganization.name}
              </p>
              <p className="text-[11px] text-[#958777] truncate leading-none">
                {activeOrganization.code} · {(activeRole ?? 'viewer').replace(/_/g, ' ')}
              </p>
            </div>
          </button>
        </div>

        {/* App Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="relative hidden lg:block w-44">
            <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search fleet..."
              aria-label="Global fleet search"
              className="w-full bg-[#FAFAFA] border border-[#E5E5E5] rounded-[10px] pl-9 pr-3 py-1.5 text-xs text-[#625346] placeholder:text-[#958777] outline-none focus:bg-[#FFFFFF] focus:border-[#B8A3D9]"
            />
          </div>

          <PWAInstallButton compact />

          {onOpenCopilot && canPerformAction(activeRole, 'use_copilot') && (
            <button
              type="button"
              onClick={onOpenCopilot}
              title="Dhiyu — Fleet Management AI"
              aria-label="Open Dhiyu Fleet Management AI"
              className="min-h-[40px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] border border-[#DDD3ED] bg-[#EEE8F7]/80 text-[#625346] hover:bg-[#EEE8F7] hover:border-[#B8A3D9] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <DhiyuLogo size="xs" />
              <span className="hidden sm:inline text-[11px] font-bold text-[#6E5696]">AI</span>
            </button>
          )}

          {/* Language Switcher */}
          <div className="hidden xl:flex items-center gap-1 border border-[#E5E5E5] rounded-[10px] px-2 py-1.5 bg-[#FAFAFA]">
            <Globe className="w-3.5 h-3.5 text-[#958777]" />
            <label htmlFor="header-lang" className="sr-only">Language</label>
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

          {/* Notification Drawer Trigger */}
          <button
            type="button"
            onClick={() => {
              setAlertsDrawerOpen(true)
              setUserMenuOpen(false)
            }}
            aria-label={`Open Notifications (${totalUnreadCount} unread)`}
            className="relative min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[10px] border border-[#E5E5E5] bg-[#FFFFFF] text-[#625346] hover:bg-[#EEE8F7] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {totalUnreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FCECEB] border border-[#D9786C] text-[#625346] text-[10px] font-bold tabular-nums flex items-center justify-center shadow-subtle">
                {totalUnreadCount}
              </span>
            )}
          </button>

          {/* Add Vehicle Primary CTA */}
          {onAddVehicle && canPerformAction(activeRole, 'add_vehicle') && (
            <button
              type="button"
              onClick={onAddVehicle}
              aria-label="Add Vehicle"
              className="btn-primary min-h-[40px] text-xs px-2.5 sm:px-3 py-1.5 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-[#625346]" />
              <span className="hidden sm:inline">Add Vehicle</span>
            </button>
          )}

          {/* User Account Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen((o) => !o)
              }}
              aria-label="User account menu"
              className="flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-[10px] border border-[#E5E5E5] bg-[#FFFFFF] hover:bg-[#EEE8F7]/60 transition-colors"
            >
              <div className="w-6 h-6 rounded-[8px] bg-[#EEE8F7] border border-[#B8A3D9] text-[#6E5696] flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="hidden xl:block text-left">
                <p className="text-xs font-semibold text-[#625346] leading-none max-w-[110px] truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-[#958777] capitalize leading-tight mt-0.5">
                  {(activeRole ?? 'viewer').replace(/_/g, ' ')}
                </p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#958777]" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-[#FFFFFF] border border-[#E5E5E5] rounded-xl shadow-elevated z-50 p-2">
                <div className="px-2.5 py-2 border-b border-[#E5E5E5]">
                  <p className="text-xs font-semibold text-[#625346] truncate">{displayName}</p>
                  <p className="text-xs text-[#958777] truncate">{activeOrganization.name}</p>
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
                <button
                  type="button"
                  onClick={async () => {
                    setUserMenuOpen(false)
                    await signOut()
                    navigate('/auth', { replace: true })
                  }}
                  className="w-full text-left px-2.5 py-2 text-xs font-semibold text-[#B84E42] hover:bg-[#FCECEB] rounded-lg mt-1 border-t border-[#E5E5E5]"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slide-Over Notification Sidebar Drawer */}
      {alertsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#625346]/25 backdrop-blur-[1px]"
            onClick={() => setAlertsDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Notification Sidebar"
            className="relative z-10 w-full sm:w-[400px] max-w-full h-full bg-[#FFFFFF] border-l border-[#E5E5E5] shadow-elevated flex flex-col"
          >
            <div className="h-16 px-5 border-b border-[#E5E5E5] flex items-center justify-between shrink-0 bg-[#FAFAFA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#EEE8F7] border border-[#B8A3D9] flex items-center justify-center text-[#6E5696]">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#625346]">Notifications</h2>
                  <p className="text-[11px] text-[#958777]">{totalUnreadCount} unread fleet &amp; finance alerts</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {totalUnreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      markAllAlertsRead()
                      if (unreadFinanceCount > 0) void ackFinanceAlert('all', 'read_all')
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#6E5696] hover:bg-[#EEE8F7]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAlertsDrawerOpen(false)}
                  aria-label="Close notifications"
                  className="p-1.5 rounded-lg text-[#625346] hover:bg-[#EEE8F7]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-custom p-4 space-y-2.5">
              {combinedAlerts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#958777]">
                  No operational or finance notifications for this organization.
                </div>
              ) : (
                combinedAlerts.map((al) => (
                  <div
                    key={al.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      al.read
                        ? 'bg-[#FFFFFF] border-[#E5E5E5] opacity-75'
                        : 'bg-[#EEE8F7]/45 border-[#B8A3D9]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#FFFFFF] border border-[#E5E5E5] flex items-center justify-center shrink-0 mt-0.5">
                        {al.kind === 'finance' ? (
                          <Landmark className="w-4 h-4 text-[#6E5696]" />
                        ) : (
                          <CategoryIcon category={al.category} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                              al.severity === 'critical'
                                ? 'bg-[#FCECEB] border-[#D9786C] text-[#B84E42]'
                                : al.severity === 'high'
                                  ? 'bg-[#FCF5DE] border-[#D8B442] text-[#8E6F19]'
                                  : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#625346]'
                            }`}
                          >
                            {al.kind === 'finance' ? `Finance · ${al.severity}` : al.severity}
                          </span>
                          <span className="text-[10px] text-[#958777] whitespace-nowrap">
                            {new Date(al.timestamp).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (al.kind === 'finance') {
                              void ackFinanceAlert(al.id, 'read')
                            } else {
                              markAlertRead(al.id)
                            }
                            setAlertsDrawerOpen(false)
                            navigate(al.actionRoute)
                          }}
                          className="text-left w-full mt-1.5"
                        >
                          <p className="text-xs font-bold text-[#625346] hover:text-[#6E5696] leading-snug">
                            {al.title}
                          </p>
                          <p className="text-xs text-[#958777] mt-1 leading-relaxed">{al.message}</p>
                        </button>
                        {!al.read && (
                          <button
                            type="button"
                            onClick={() => {
                              if (al.kind === 'finance') {
                                void ackFinanceAlert(al.id, 'read')
                              } else {
                                markAlertRead(al.id)
                              }
                            }}
                            className="mt-2 text-[11px] font-semibold text-[#6E5696] hover:underline"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[#E5E5E5] bg-[#FAFAFA] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAlertsDrawerOpen(false)
                  navigate('/dashboard/alerts')
                }}
                className="btn-secondary w-full text-xs py-2.5"
              >
                Open Full Alerts Feed
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
