import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Compass,
  Cpu,
  CreditCard,
  FileSpreadsheet,
  Fuel,
  Layers,
  LayoutDashboard,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useFleet } from '../../hooks/useFleet'
import { useAuth } from '../../hooks/useAuth'
import { canAccessRoute } from '../../utils/rbac'
import { BrandLogo } from '../ui/BrandLogo'
import { useTranslation } from '../../i18n/useTranslation'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
  badge?: number
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { unreadAlertCount, predictions, riskAssessments, workOrders, activeRole } = useFleet()
  const { signOut } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const criticalMaintCount = predictions.filter(
    (p) => !p.insufficientData && p.status !== 'resolved' && (p.priority === 'critical' || p.priority === 'high'),
  ).length
  const elevatedRiskCount = riskAssessments.filter(
    (r) => r.severity === 'critical' || r.severity === 'high',
  ).length
  const openWoCount = workOrders.filter((w) => w.status !== 'completed' && w.status !== 'closed').length

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Operations',
      items: [
        { to: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: '/dashboard/map', label: t('nav.map'), icon: MapPin },
        { to: '/dashboard/fleet', label: t('nav.fleet'), icon: Layers },
        { to: '/dashboard/trips', label: t('nav.trips'), icon: Navigation },
      ],
    },
    {
      title: 'Maintenance & ERP',
      items: [
        { to: '/dashboard/maintenance', label: t('nav.maintenance'), icon: Cpu, badge: criticalMaintCount || undefined },
        { to: '/dashboard/inspections', label: t('nav.inspections'), icon: ClipboardCheck },
        { to: '/dashboard/work-orders', label: t('nav.work_orders'), icon: Wrench, badge: openWoCount || undefined },
        { to: '/dashboard/inventory', label: t('nav.inventory'), icon: Package },
        { to: '/dashboard/workshops', label: t('nav.workshops'), icon: ShieldCheck },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { to: '/dashboard/risk', label: t('nav.risk'), icon: ShieldAlert, badge: elevatedRiskCount || undefined },
        { to: '/dashboard/drivers', label: t('nav.drivers'), icon: Users },
        { to: '/dashboard/roads', label: t('nav.road_intel'), icon: Compass },
      ],
    },
    {
      title: 'Finance & Reporting',
      items: [
        { to: '/dashboard/fuel', label: t('nav.fuel'), icon: Fuel },
        { to: '/dashboard/financials', label: t('nav.financials'), icon: BarChart3 },
        { to: '/dashboard/reports', label: t('nav.reports'), icon: FileSpreadsheet },
        { to: '/dashboard/alerts', label: t('nav.alerts'), icon: AlertTriangle, badge: unreadAlertCount || undefined },
      ],
    },
    {
      title: 'Platform',
      items: [
        { to: '/dashboard/admin', label: t('nav.admin'), icon: ShieldCheck },
        { to: '/dashboard/subscription', label: t('nav.subscription'), icon: CreditCard },
        { to: '/dashboard/settings', label: t('nav.settings'), icon: Settings },
      ],
    },
  ]

  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(activeRole, item.to)),
    }))
    .filter((group) => group.items.length > 0)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#625346]/20 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[268px] bg-[#EEE8F7] border-r border-[#DDD3ED] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 border-b border-[#DDD3ED] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="DriveMitra Command Centre"
            className="flex items-center gap-2.5 text-left"
          >
            <BrandLogo size="md" />
            <div>
              <span className="text-xs font-bold text-[#4D6E4A] block leading-tight">
                Production
              </span>
              <span className="text-[11px] text-[#958777] font-medium block">
                Owner ERP
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-lg text-[#625346] hover:bg-[#E2D8F3]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-custom px-3 py-4 space-y-5" aria-label="Dashboard navigation">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="px-2.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#958777]">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center justify-between gap-2 px-2.5 py-2 rounded-[10px] text-[13.5px] transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-[#E1D7F2] text-[#6E5696] font-semibold border border-[#B8A3D9] shadow-subtle'
                            : 'text-[#625346] font-medium border border-transparent hover:bg-[#FFFFFF]/70'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#6E5696]' : 'text-[#958777]'}`} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {typeof item.badge === 'number' && item.badge > 0 && (
                            <span
                              className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-[6px] border ${
                                isActive
                                  ? 'bg-[#FFFFFF] text-[#6E5696] border-[#B8A3D9]'
                                  : 'bg-[#FFFFFF] text-[#625346] border-[#DDD3ED]'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[#DDD3ED] shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[14px] font-medium text-[#625346] hover:bg-[#FCECEB] transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0 text-[#B84E42]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
