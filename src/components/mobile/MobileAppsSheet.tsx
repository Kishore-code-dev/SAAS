import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  HelpCircle,
  LogOut,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { useOptionalFinance } from '../../hooks/useFinance'
import { useAuth } from '../../hooks/useAuth'
import { canAccessRoute } from '../../utils/rbac'
import { FOOTER_NAV, MAIN_NAV, type BadgeKey, type NavEntry } from '../../config/nav.config'
import { computeOnboardingChecklist } from '../../utils/fleetioConfigStore'
import GetStartedModal from '../layout/GetStartedModal'
import HelpSupportModal from '../layout/HelpSupportModal'

export function MobileAppsSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const {
    activeOrganization,
    vehicles,
    workOrders,
    partsInventory,
    unreadAlertCount,
    predictions,
    riskAssessments,
    smallIssues,
    activeRole,
    visitedIntegrations,
    visitedReports,
  } = useFleet()
  const { user, permissions, signOut } = useAuth()
  const financeCtx = useOptionalFinance()
  const instalments = financeCtx?.instalments ?? []
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [query, setQuery] = useState('')
  const [getStartedOpen, setGetStartedOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const badges: Record<BadgeKey, number> = {
    maintenance: predictions.filter(
      (p) => !p.insufficientData && p.status !== 'resolved' && (p.priority === 'critical' || p.priority === 'high'),
    ).length,
    risk: riskAssessments.filter((r) => r.severity === 'critical' || r.severity === 'high').length,
    workOrders: workOrders.filter((w) => w.status !== 'completed' && w.status !== 'closed').length,
    issues: smallIssues.filter((i) => i.status === 'open' || i.status === 'triaged').length,
    alerts: unreadAlertCount,
    financeOverdue: instalments.filter((i) => i.status === 'overdue').length,
    contractAlerts: 0,
  }

  const allowed = (to: string) => canAccessRoute(activeRole, to, permissions)

  const filteredEntries = useMemo<NavEntry[]>(() => {
    const q = query.trim().toLowerCase()
    const checkRoute = (to: string) => canAccessRoute(activeRole, to, permissions)
    const baseEntries: NavEntry[] = MAIN_NAV.map((e) =>
      e.children ? { ...e, children: e.children.filter((c) => checkRoute(c.to)) } : e,
    ).filter((e) => (e.children ? e.children.length > 0 : Boolean(e.to && checkRoute(e.to))))

    const footerEntries: NavEntry[] = FOOTER_NAV.filter((f) => checkRoute(f.to)).map((f) => ({
      id: `footer-${f.to}`,
      icon: f.icon!,
      to: f.to,
      label: f.label,
    }))

    const all: NavEntry[] = [...baseEntries, ...footerEntries]
    if (!q) return all

    return all
      .map((entry): NavEntry | null => {
        if (!entry.children) {
          return entry.label.toLowerCase().includes(q) ? entry : null
        }
        if (entry.label.toLowerCase().includes(q)) return entry
        const matchingChildren = entry.children.filter((c) => c.label.toLowerCase().includes(q))
        return matchingChildren.length > 0 ? { ...entry, children: matchingChildren } : null
      })
      .filter((e): e is NavEntry => e !== null)
  }, [activeRole, permissions, query])

  const onboardingItems = useMemo(
    () =>
      computeOnboardingChecklist({
        org: activeOrganization,
        vehicles,
        workOrders,
        partsInventory,
        hasExploredIntegrations: visitedIntegrations,
        hasVisitedReports: visitedReports,
      }),
    [activeOrganization, partsInventory, vehicles, visitedIntegrations, visitedReports, workOrders],
  )
  const completedOnboarding = onboardingItems.filter((i) => i.completed).length

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div
            className="fixed inset-0 bg-[#625346]/35 backdrop-blur-xs"
            onClick={onClose}
            aria-hidden="true"
          />

          <section
            aria-label="Mobile App Modules Launcher"
            className="relative z-10 w-full sm:max-w-3xl max-h-[88vh] bg-[#FFFFFF] border-t sm:border border-[#E5E5E5] rounded-t-3xl sm:rounded-2xl shadow-elevated flex flex-col overflow-hidden"
          >
            {/* Mobile drag handle */}
            <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#E5E5E5]" />
            </div>

            {/* Header */}
            <div className="px-4 sm:px-6 py-3 border-b border-[#E5E5E5] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[#625346] truncate">
                  {activeOrganization.name}
                </h2>
                <p className="text-xs text-[#958777] truncate">
                  {user?.fullName ?? activeOrganization.code} · {activeRole.replace(/_/g, ' ')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close app launcher"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#625346] hover:bg-[#EEE8F7]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search + Setup Checklist */}
            <div className="px-4 sm:px-6 pt-3 pb-2 space-y-2.5 shrink-0 bg-[#FAFAFA] border-b border-[#E5E5E5]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#958777] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Jump to vehicles, contracts, work orders, finance..."
                  aria-label="Search app modules"
                  className="dm-input pl-10 py-2.5 text-sm min-h-[44px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGetStartedOpen(true)}
                  className="flex-1 min-w-[200px] min-h-[44px] px-3 py-2 rounded-xl bg-[#EEE8F7] hover:bg-[#E4DAF4] border border-[#DDD3ED] flex items-center justify-between text-xs font-semibold text-[#625346]"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#6E5696]" />
                    Setup Checklist
                  </span>
                  <span className="flex items-center gap-1 text-[#6E5696] tabular-nums">
                    {completedOnboarding}/{onboardingItems.length}
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>

                {allowed('/dashboard/subscription') && (
                  <button
                    type="button"
                    onClick={() => go('/dashboard/subscription')}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E8C65A] hover:bg-[#DFBA48] border border-[#D8B442] text-xs font-semibold text-[#625346] whitespace-nowrap"
                  >
                    {activeOrganization.vehicleLimit < 0
                      ? `Manage Plan (${vehicles.length} vehicles)`
                      : `Manage Plan (${vehicles.length}/${activeOrganization.vehicleLimit})`}
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Modules Grid */}
            <div className="flex-1 overflow-y-auto scrollbar-custom p-4 sm:p-6 space-y-4">
              {filteredEntries.length === 0 ? (
                <p className="py-8 text-center text-xs text-[#958777]">
                  No modules match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredEntries.map((entry) => {
                    const Icon = entry.icon
                    if (!entry.children && entry.to) {
                      const isCurrent = entry.end
                        ? pathname === entry.to
                        : pathname === entry.to || pathname.startsWith(`${entry.to}/`)
                      const badgeCount = entry.badge ? badges[entry.badge] : 0
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => go(entry.to!)}
                          className={`min-h-[52px] px-4 py-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                            isCurrent
                              ? 'bg-[#EEE8F7] border-[#B8A3D9] text-[#625346] font-bold'
                              : 'bg-[#FFFFFF] border-[#E5E5E5] hover:border-[#B8A3D9] text-[#625346] font-semibold'
                          }`}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-lg bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center shrink-0">
                              <Icon className="w-4 h-4 text-[#6E5696]" />
                            </span>
                            <span className="text-sm truncate">
                              {entry.to === '/dashboard/mobile' ? 'Device & Offline Sync' : entry.label}
                            </span>
                          </span>
                          {badgeCount > 0 ? (
                            <span className="text-xs font-bold tabular-nums text-[#6E5696]">
                              {badgeCount}
                            </span>
                          ) : (
                            <ChevronRight className="w-4 h-4 text-[#958777] shrink-0" />
                          )}
                        </button>
                      )
                    }

                    return (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3.5 space-y-2.5 sm:col-span-2"
                      >
                        <div className="flex items-center gap-2 text-xs font-bold text-[#625346]">
                          <Icon className="w-4 h-4 text-[#6E5696]" />
                          <span>{entry.label}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {entry.children?.map((child) => {
                            const active = child.end
                              ? pathname === child.to
                              : pathname === child.to || pathname.startsWith(`${child.to}/`)
                            const badgeCount = child.badge ? badges[child.badge] : 0
                            return (
                              <button
                                key={child.to}
                                type="button"
                                onClick={() => go(child.to)}
                                className={`min-h-[44px] px-3 py-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                                  active
                                    ? 'bg-[#EEE8F7] border-[#B8A3D9] font-bold text-[#625346]'
                                    : 'bg-[#FFFFFF] border-[#E5E5E5] hover:border-[#B8A3D9] font-medium text-[#625346]'
                                }`}
                              >
                                <span className="truncate">{child.label}</span>
                                {badgeCount > 0 && (
                                  <span className="text-[11px] font-bold tabular-nums text-[#6E5696]">
                                    {badgeCount}
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-4 sm:px-6 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E5E5] bg-[#FFFFFF] text-xs font-semibold text-[#625346] hover:bg-[#EEE8F7] inline-flex items-center gap-2"
              >
                <HelpCircle className="w-4 h-4 text-[#6E5696]" />
                <span>Help &amp; Support</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  onClose()
                  await signOut()
                  navigate('/auth', { replace: true })
                }}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#D9786C] bg-[#FCECEB] text-xs font-semibold text-[#B84E42] hover:bg-[#F9DCD9] inline-flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </section>
        </div>
      )}

      <GetStartedModal
        open={getStartedOpen}
        onClose={() => setGetStartedOpen(false)}
        items={onboardingItems}
        orgName={activeOrganization.name}
      />
      <HelpSupportModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        orgCode={activeOrganization.code}
      />
    </>
  )
}
