import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  X,
} from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { useOptionalFinance } from '../../hooks/useFinance'
import { useAuth } from '../../hooks/useAuth'
import { canAccessRoute } from '../../utils/rbac'
import { FOOTER_NAV, MAIN_NAV, type BadgeKey, type NavEntry, type NavLeaf } from '../../config/nav.config'
import { computeOnboardingChecklist, loadScopedStorage } from '../../utils/fleetioConfigStore'
import GetStartedModal from './GetStartedModal'
import HelpSupportModal from './HelpSupportModal'

const OPEN_KEY = 'dm.nav.open'
const COLLAPSED_KEY = 'dm.nav.collapsed'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

function Badge({ value, active }: { value?: number; active?: boolean }) {
  if (!value) return null
  return (
    <span
      className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-[6px] ${
        active
          ? 'bg-[#6E5696] text-white border border-[#6E5696]'
          : 'bg-[#EEE8F7] text-[#6E5696] border border-[#DDD3ED]'
      }`}
    >
      {value}
    </span>
  )
}

const rowBase =
  'flex items-center gap-2.5 rounded-[10px] text-[13px] transition-colors whitespace-nowrap'
const rowActive = 'bg-[#EEE8F7] text-[#625346] font-semibold border border-[#B8A3D9]/70 shadow-subtle'
const rowIdle = 'text-[#625346] font-medium hover:bg-[#FAFAFA] hover:text-[#625346] border border-transparent'

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  } = useFleet()
  const { user, signOut } = useAuth()
  const financeCtx = useOptionalFinance()
  const instalments = financeCtx?.instalments ?? []
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isInside = (e: NavEntry) =>
    !!e.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`))

  const [collapsed, setCollapsed] = useState<boolean>(() => load(COLLAPSED_KEY, false))
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const saved = load<string[]>(OPEN_KEY, ['vehicles'])
    const active = MAIN_NAV.find((e) =>
      e.children?.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`)),
    )
    return active && !saved.includes(active.id) ? [...saved, active.id] : saved
  })
  const [prevPathname, setPrevPathname] = useState(pathname)
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
  }

  const allowed = (to: string) => canAccessRoute(activeRole, to)
  const entries = MAIN_NAV.map((e) =>
    e.children ? { ...e, children: e.children.filter((c) => allowed(c.to)) } : e,
  ).filter((e) => (e.children ? e.children.length > 0 : e.to && allowed(e.to)))
  const footer = FOOTER_NAV.filter((f) => allowed(f.to))

  // Auto-open the group that holds the active route when navigating
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    const active = entries.find(isInside)
    if (active && !openGroups.includes(active.id)) {
      setOpenGroups((prev) => [...prev, active.id])
    }
  }

  useEffect(() => {
    save(OPEN_KEY, openGroups)
  }, [openGroups])

  const onboardingItems = useMemo(
    () =>
      computeOnboardingChecklist({
        org: activeOrganization,
        vehicles,
        workOrders,
        partsInventory,
        hasExploredIntegrations: loadScopedStorage(activeOrganization.id, 'visited_integrations', true),
        hasVisitedReports: loadScopedStorage(activeOrganization.id, 'visited_reports', false),
      }),
    [activeOrganization, partsInventory, vehicles, workOrders],
  )
  const completedOnboarding = onboardingItems.filter((i) => i.completed).length

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]))

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      save(COLLAPSED_KEY, !c)
      return !c
    })

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  const rail = collapsed

  const renderLeaf = (leaf: NavLeaf | NavEntry, opts: { child?: boolean } = {}) => {
    const to = leaf.to as string
    const Icon = leaf.icon
    const label = leaf.label
    const badge = leaf.badge ? badges[leaf.badge] : 0
    return (
      <NavLink
        key={to}
        to={to}
        end={leaf.end}
        onClick={onClose}
        title={rail ? label : undefined}
        className={({ isActive }) =>
          `${rowBase} ${opts.child ? 'px-2.5 py-1.5 text-[12.5px]' : 'px-2.5 py-1.5'} ${
            rail && !opts.child ? 'lg:justify-center' : 'justify-between'
          } ${isActive ? rowActive : rowIdle}`
        }
      >
        {({ isActive }) => (
          <>
            <span className="flex items-center gap-2.5 min-w-0">
              {Icon && (
                <Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#6E5696]' : 'text-[#958777]'}`}
                />
              )}
              <span className={`truncate ${rail && !opts.child ? 'lg:hidden' : ''}`}>{label}</span>
            </span>
            <span className={rail && !opts.child ? 'lg:hidden' : ''}>
              <Badge value={badge} active={isActive} />
            </span>
          </>
        )}
      </NavLink>
    )
  }

  const planLabel = `${activeOrganization.planId.charAt(0).toUpperCase()}${activeOrganization.planId.slice(1)} Plan`

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[256px] bg-[#FFFFFF] text-[#625346] border-r border-[#E5E5E5] flex flex-col transition-all duration-200 lg:static lg:translate-x-0 shrink-0 ${
          rail ? 'lg:w-[68px]' : 'lg:w-[256px]'
        } ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* DriveMitra Workspace Header */}
        <div className="px-3.5 pt-3.5 pb-3 border-b border-[#E5E5E5] shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              aria-label="DriveMitra Workspace Home"
              className={`flex items-center gap-2 text-left min-w-0 ${rail ? 'lg:justify-center lg:w-full' : ''}`}
            >
              <div className="w-7 h-7 rounded-lg bg-[#EEE8F7] border border-[#B8A3D9] flex items-center justify-center text-xs font-extrabold text-[#6E5696] shrink-0">
                {activeOrganization.name.slice(0, 1).toUpperCase()}
              </div>
              <div className={`min-w-0 ${rail ? 'lg:hidden' : ''}`}>
                <span className="text-[13.5px] font-bold text-[#625346] block truncate leading-tight">
                  {activeOrganization.name}
                </span>
                <span className="text-[11px] text-[#958777] font-medium block truncate">
                  {user?.fullName ?? activeOrganization.code}
                </span>
              </div>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded-lg text-[#625346] hover:bg-[#EEE8F7]"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={rail ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`hidden lg:inline-flex p-1.5 rounded-lg text-[#958777] hover:bg-[#EEE8F7] hover:text-[#625346] ${
                rail ? 'lg:hidden' : ''
              }`}
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {!rail && (
            <button
              type="button"
              onClick={() => setGetStartedOpen(true)}
              className="w-full px-2.5 py-2 rounded-[10px] bg-[#EEE8F7] hover:bg-[#E4DAF4] border border-[#DDD3ED] transition-colors text-left"
            >
              <div className="flex items-center justify-between text-[11.5px] font-semibold text-[#625346]">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#6E5696]" />
                  Get Started
                </span>
                <span className="flex items-center gap-1 text-[#6E5696] tabular-nums">
                  {completedOnboarding}/{onboardingItems.length}
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#DDD3ED] overflow-hidden">
                <div
                  className="h-full bg-[#6E5696] rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((completedOnboarding / onboardingItems.length) * 100)}%` }}
                />
              </div>
            </button>
          )}
        </div>

        {rail && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            className="hidden lg:flex mx-auto mt-2.5 p-1.5 rounded-lg text-[#958777] hover:bg-[#EEE8F7] hover:text-[#625346]"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        {/* Fleetio Navigation Tree */}
        <nav
          className="flex-1 overflow-y-auto scrollbar-custom px-2.5 py-2.5 space-y-0.5"
          aria-label="Dashboard navigation"
        >
          {entries.map((entry) => {
            if (!entry.children) return renderLeaf(entry)

            const Icon = entry.icon
            const expanded = openGroups.includes(entry.id) && !rail
            const inside = isInside(entry)
            const panelId = `nav-group-${entry.id}`
            return (
              <div key={entry.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  title={rail ? entry.label : undefined}
                  onClick={() => (rail ? navigate(entry.children![0].to) : toggleGroup(entry.id))}
                  className={`${rowBase} w-full px-2.5 py-1.5 justify-between ${
                    inside
                      ? 'text-[#625346] font-semibold bg-[#FAFAFA] border-transparent'
                      : 'text-[#625346] font-medium hover:bg-[#FAFAFA] border-transparent'
                  } ${rail ? 'lg:justify-center' : ''}`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${inside ? 'text-[#6E5696]' : 'text-[#958777]'}`} />
                    <span className={`truncate ${rail ? 'lg:hidden' : ''}`}>{entry.label}</span>
                  </span>
                  <span className={`flex items-center gap-1.5 shrink-0 ${rail ? 'lg:hidden' : ''}`}>
                    {entry.pill && (
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#EEE8F7] text-[#6E5696] border border-[#DDD3ED]">
                        {entry.pill}
                      </span>
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#958777] transition-transform duration-150 ${
                        expanded ? 'rotate-180' : ''
                      }`}
                    />
                  </span>
                </button>
                <div
                  id={panelId}
                  className={`grid transition-[grid-template-rows] duration-150 ease-out ${
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  } ${rail ? 'lg:hidden' : ''}`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[17px] mt-0.5 mb-1 pl-2.5 border-l border-[#E5E5E5] space-y-0.5">
                      {entry.children.map((c) => (
                        <div key={c.to} className={expanded ? '' : 'hidden'}>
                          {renderLeaf(c, { child: true })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Bottom Plan Banner & Utility Footer */}
        <div className="p-2.5 border-t border-[#E5E5E5] shrink-0 space-y-1.5 bg-[#FFFFFF]">
          {!rail && (
            <div className="p-2.5 rounded-[10px] bg-[#FAFAFA] border border-[#E5E5E5] space-y-2 mb-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#625346] truncate">{planLabel}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#EEE8F7] text-[#6E5696] border border-[#DDD3ED] tabular-nums">
                  {vehicles.length}/{activeOrganization.vehicleLimit} assets
                </span>
              </div>
              {allowed('/dashboard/subscription') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    navigate('/dashboard/subscription')
                  }}
                  className="w-full py-1.5 rounded-[8px] bg-[#E8C65A] hover:bg-[#DFBA48] border border-[#D8B442] text-[#625346] text-xs font-semibold transition-colors shadow-subtle"
                >
                  Manage Plan
                </button>
              )}
            </div>
          )}

          {footer.map((f) => renderLeaf(f))}

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            title={rail ? 'Help & Support' : undefined}
            className={`w-full ${rowBase} px-2.5 py-1.5 text-[#625346] font-medium hover:bg-[#FAFAFA] border border-transparent ${
              rail ? 'lg:justify-center' : ''
            }`}
          >
            <HelpCircle className="w-4 h-4 shrink-0 text-[#958777]" />
            <span className={rail ? 'lg:hidden' : ''}>Help &amp; Support</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            title={rail ? 'Sign Out' : undefined}
            className={`w-full ${rowBase} px-2.5 py-1.5 text-[#B84E42] font-medium hover:bg-[#FCECEB] border border-transparent ${
              rail ? 'lg:justify-center' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0 text-[#B84E42]" />
            <span className={rail ? 'lg:hidden' : ''}>Sign Out</span>
          </button>
        </div>
      </aside>

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
