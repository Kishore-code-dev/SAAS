import React, { useEffect, useState } from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getDefaultHomeForRole } from '../../utils/rbac'
import { Truck, Home, MapPin, Fuel, Wrench, Bell, LogOut, User, ChevronDown, Menu, X, Camera, Receipt, Clock, Navigation2, AlertTriangle } from 'lucide-react'

interface DriverLayoutProps {
  children?: React.ReactNode
}

const NAV_ITEMS = [
  { path: '/driver', icon: Home, label: 'Home', isExact: true },
  { path: '/driver/trips', icon: MapPin, label: 'My Trips', isExact: false },
  { path: '/driver/fuel', icon: Fuel, label: 'Fuel Logs', isExact: false },
  { path: '/driver/expenses', icon: Receipt, label: 'Expenses', isExact: false },
  { path: '/driver/maintenance', icon: Wrench, label: 'Issues', isExact: false },
  { path: '/driver/profile', icon: User, label: 'Profile', isExact: false },
] as const

export function DriverLayout() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Capacitor' in window) {
      const setupNetwork = async () => {
        const { Network } = await import('@capacitor/network')
        const status = await Network.getStatus()
        setIsOnline(status.connected)
        const listener = await Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected)
        })
        return () => listener.remove()
      }
      setupNetwork()
    }
  }, [])

  if (!user || user.role !== 'driver') {
    return <Navigate to={getDefaultHomeForRole(user?.role ?? 'viewer')} replace />
  }

  const currentPath = location.pathname
  const activeNav = NAV_ITEMS.find((item) =>
    item.isExact ? currentPath === item.path : currentPath.startsWith(item.path)
  ) ?? NAV_ITEMS[0]

  return (
    <div className="min-h-screen bg-[#F7F5F2] flex flex-col">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#E5E5E5] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#625346] hover:bg-[#F0EEE9]"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div className="flex items-center gap-2">
              <Truck className="w-7 h-7 text-[#6E5696]" />
              <span className="font-bold text-[#625346] text-lg hidden sm:block">DriveMitra Driver</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Online Status */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F0EEE9]">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#1F7A4C]' : 'bg-[#B84E42]'}`} />
              <span className={isOnline ? 'text-[#1F7A4C]' : 'text-[#B84E42]'}>{isOnline ? 'Online' : 'Offline'}</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F0EEE9] transition-colors lg:block"
                aria-label="User menu"
              >
                <div className="w-8 h-8 rounded-full bg-[#EEE8F7] flex items-center justify-center">
                  <User className="w-5 h-5 text-[#6E5696]" />
                </div>
                <span className="hidden md:block text-sm font-medium text-[#625346]">{user.fullName}</span>
                <ChevronDown className="w-4 h-4 text-[#958777]" />
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30 lg:hidden"
                    onClick={() => setIsMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#E5E5E5] py-2 z-40 lg:static lg:shadow-none lg:border-0 lg:bg-transparent lg:p-0 lg:w-auto">
                    <div className="px-4 py-3 border-b border-[#E5E5E5] lg:hidden">
                      <p className="font-semibold text-[#625346]">{user.fullName}</p>
                      <p className="text-xs text-[#958777] capitalize">{user.role}</p>
                    </div>
                    {NAV_ITEMS.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path)
                          setIsMenuOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          activeNav.path === item.path
                            ? 'bg-[#EEE8F7] text-[#6E5696]'
                            : 'text-[#625346] hover:bg-[#F7F5F2]'
                        } lg:bg-transparent lg:hover:bg-transparent lg:text-[#625346] lg:hover:text-[#6E5696] lg:px-0 lg:py-2`}
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="lg:hidden">{item.label}</span>
                      </button>
                    ))}
                    <div className="border-t border-[#E5E5E5] mt-2 pt-2 lg:hidden">
                      <button
                        onClick={() => {
                          signOut()
                          setIsMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#B84E42] hover:bg-[#FEF2F2] transition-colors"
                      >
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden border-t border-[#E5E5E5] bg-white">
          <div className="grid grid-cols-3 gap-1 px-2 py-2">
            {NAV_ITEMS.slice(0, 3).map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeNav.path === item.path
                    ? 'bg-[#EEE8F7] text-[#6E5696]'
                    : 'text-[#958777] hover:bg-[#F7F5F2]'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

export default DriverLayout