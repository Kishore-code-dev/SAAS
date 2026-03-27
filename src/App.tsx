import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { FleetProvider } from './hooks/useFleet'
import { I18nProvider } from './i18n/useTranslation'
import { Truck } from 'lucide-react'

// Layout
import Layout from './components/layout/Layout'

// Lazy loaded pages
const Landing = lazy(() => import('./pages/Landing'))
const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const LiveMap = lazy(() => import('./pages/LiveMap'))
const Trips = lazy(() => import('./pages/Trips'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const Drivers = lazy(() => import('./pages/Drivers'))
const FuelLogs = lazy(() => import('./pages/FuelLogs'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Subscription = lazy(() => import('./pages/Subscription'))
const DriverApp = lazy(() => import('./pages/DriverApp'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
})

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-ping opacity-40" />
          <div className="relative w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl overflow-hidden border border-white/10"
            style={{ background: 'linear-gradient(135deg, #1a1a1a, #000)' }}>
            <Truck className="w-10 h-10 text-primary animate-bounce-subtle" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-display font-black text-2xl tracking-tighter text-gradient-yellow">DriveMitra</p>
          <p className="text-muted-foreground text-[10px] mt-2 uppercase tracking-[0.3em] font-black opacity-50">Calibrating Fleet Node</p>
        </div>
        <div className="w-48 h-1 rounded-full overflow-hidden bg-white/5 border border-white/5">
          <div className="h-full rounded-full bg-primary animate-progress-flow" style={{ width: '100%' }} />
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()
  if (loading) return <LoadingScreen />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />

        {/* Admin Dashboard Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<LiveMap />} />
          <Route path="trips" element={<Trips />} />
          <Route path="fleet" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="fuel" element={<FuelLogs />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Driver App Route — STANDALONE (Mobile-first) */}
        <Route path="/driver" element={<ProtectedRoute><div className="min-h-screen bg-[#080808] p-4"><DriverApp /></div></ProtectedRoute>} />
        <Route path="/driver/trips" element={<ProtectedRoute><div className="min-h-screen bg-[#080808] p-4"><Trips /></div></ProtectedRoute>} />
        <Route path="/driver/fuel" element={<ProtectedRoute><div className="min-h-screen bg-[#080808] p-4"><FuelLogs /></div></ProtectedRoute>} />
        <Route path="/driver/settings" element={<ProtectedRoute><div className="min-h-screen bg-[#080808] p-4"><Settings /></div></ProtectedRoute>} />

        <Route path="/map" element={<Navigate to="/dashboard/map" replace />} />
        <Route path="*" element={<Suspense fallback={<LoadingScreen />}><NotFound /></Suspense>} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <FleetProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
              <Toaster
                position="top-right"
                theme="dark"
                toastOptions={{
                  style: {
                    background: 'rgb(22,24,34)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgb(220,225,235)',
                    borderRadius: '14px',
                  }
                }}
              />
            </BrowserRouter>
          </AuthProvider>
        </FleetProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
