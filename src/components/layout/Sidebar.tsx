import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, Navigation, Truck, Users, Fuel,
  Wrench, Bell, FileText, Settings, ChevronLeft, ChevronRight,
  Smartphone, CreditCard, Zap, LogOut, User, BarChart3, ShieldCheck
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useFleet } from '../../hooks/useFleet'
import { useTranslation } from '../../i18n/useTranslation'
import { motion, AnimatePresence } from 'framer-motion'

interface SidebarProps { open: boolean; onToggle: () => void }

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const location = useLocation()
  const { unreadAlertCount, userRole } = useFleet()
  const { t } = useTranslation()

  const adminNav = [
    { icon: LayoutDashboard, label: t('nav.dashboard'),    path: '/dashboard' },
    { icon: Map,             label: t('nav.map'),           path: '/dashboard/map' },
    { icon: Navigation,      label: t('nav.trips'),         path: '/dashboard/trips' },
    { icon: Truck,           label: t('nav.fleet'),         path: '/dashboard/fleet' },
    { icon: Users,           label: t('nav.drivers'),       path: '/dashboard/drivers' },
    { icon: Fuel,            label: t('nav.fuel'),          path: '/dashboard/fuel' },
    { icon: Wrench,          label: t('nav.maintenance'),   path: '/dashboard/maintenance' },
    { icon: Bell,            label: t('nav.alerts'),        path: '/dashboard/alerts', badge: unreadAlertCount },
    { icon: BarChart3,       label: t('nav.reports'),       path: '/dashboard/reports' },
    { icon: CreditCard,      label: t('nav.subscription'),  path: '/dashboard/subscription' },
    { icon: Settings,        label: t('nav.settings'),      path: '/dashboard/settings' },
  ]

  const driverNav = [
    { icon: Smartphone, label: t('nav.driver_app'), path: '/driver' },
    { icon: Navigation, label: t('nav.trips'),      path: '/dashboard/trips' },
    { icon: Fuel,       label: t('nav.fuel'),       path: '/dashboard/fuel' },
    { icon: Settings,   label: t('nav.settings'),   path: '/dashboard/settings' },
  ]

  const navItems = userRole === 'driver' ? driverNav : adminNav
  const isActive = (path: string) => path === '/dashboard' ? location.pathname === '/dashboard' : location.pathname.startsWith(path)

  return (
    <aside className={cn(
      'relative h-screen flex flex-col transition-all duration-500 ease-[0.16, 1, 0.3, 1] border-r border-white/5 flex-shrink-0 z-40 bg-[#080808] scrollbar-custom overflow-hidden',
      open ? 'w-[260px]' : 'w-[80px]'
    )}>
      {/* Sidebar Gradient Background */}
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

      {/* Logo Section */}
      <div className={cn(
        'relative flex items-center h-20 px-6 flex-shrink-0',
        !open && 'justify-center px-0'
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] flex items-center justify-center bg-black border border-primary/20 shadow-gold group cursor-pointer hover:scale-110 transition-transform">
             <Truck className="w-6 h-6 text-primary shadow-gold" />
          </div>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="min-w-0"
              >
                <h1 className="font-display font-black text-lg text-white leading-none tracking-tighter">DriveMitra</h1>
                <p className="text-[9px] text-primary/60 mt-1 font-black uppercase tracking-[0.2em]">
                  {userRole === 'admin' ? 'Elite Commander' : 'Active Pilot'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto scrollbar-none">
        {navItems.map(({ icon: Icon, label, path, badge }) => {
          const active = isActive(path)
          return (
            <NavLink key={path} to={path}
              className={cn(
                'flex items-center gap-4 px-3 py-3 rounded-[12px] transition-all duration-300 relative group overflow-hidden',
                !open && 'justify-center px-0',
                active ? 'bg-primary/10 text-primary shadow-[inset_0_0_20px_rgba(245,197,24,0.05)]' : 'text-secondary-text hover:text-white hover:bg-white/5'
              )}>
              {/* Active Indicator Bar */}
              {active && (
                <motion.div 
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-primary rounded-r-full"
                />
              )}
              
              <div className="relative flex-shrink-0">
                <Icon className={cn('transition-all duration-300', active ? 'w-5 h-5 shadow-gold scale-110' : 'w-5 h-5 opacity-60 group-hover:opacity-100')} />
                {badge && badge > 0 && (
                  <span className="absolute -top-2 -right-2 min-w-[16px] h-4 rounded-full bg-danger text-[9px] font-black flex items-center justify-center px-1 text-white border-2 border-[#0A0A0A] shadow-lg">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {open && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="truncate font-bold text-[13px] tracking-tight"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed mode */}
              {!open && (
                <div className="absolute left-20 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all -translate-x-2 group-hover:translate-x-0 z-50 bg-[#111] border border-white/5 shadow-2xl">
                  {label}
                </div>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Branding / Badge Area */}
      {open && (
        <div className="px-5 mb-4">
           <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex items-center gap-3 group hover:border-primary/20 transition-all cursor-default">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                 <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-primary">Enterprise</p>
                 <p className="text-[11px] text-muted font-bold">Priority Support</p>
              </div>
           </div>
        </div>
      )}

      {/* User Area */}
      <div className="p-4 border-t border-white/5 bg-black/40">
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors group cursor-pointer',
          !open && 'justify-center'
        )}>
          <div className="w-10 h-10 rounded-full border border-white/10 overflow-hidden bg-white/5 flex-shrink-0 relative">
            <User className="w-full h-full p-2 text-muted" />
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-black rounded-full" />
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-black text-white truncate mb-0.5">Kishore Reddy</p>
              <p className="text-[10px] text-muted font-bold truncate uppercase tracking-widest">Fleet Director</p>
            </div>
          )}
          {open && <LogOut className="w-4 h-4 text-muted hover:text-danger hover:scale-110 transition-all" />}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={onToggle}
        className="absolute -right-0 top-1/2 -translate-y-1/2 w-8 h-12 bg-[#111] border-l border-y border-white/10 rounded-l-xl flex items-center justify-center hover:bg-white/5 transition-all text-muted group opacity-0 hover:opacity-100"
        style={{ right: '-1px' }}
      >
        {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </aside>
  )
}
