import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { Truck } from 'lucide-react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { FleetProvider, useFleet } from './hooks/useFleet'
import { I18nProvider } from './i18n/useTranslation'
import Layout from './components/layout/Layout'
import { AccessDeniedState } from './components/ui/EnterprisePrimitives'
import { canAccessRoute, getDefaultHomeForRole } from './utils/rbac'

const Landing = lazy(() => import('./pages/Landing'))
const Auth = lazy(() => import('./pages/Auth'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const LiveMap = lazy(() => import('./pages/LiveMap'))
const Trips = lazy(() => import('./pages/Trips'))
const Vehicles = lazy(() => import('./pages/Vehicles'))
const VehicleDetails = lazy(() => import('./pages/VehicleDetails'))
const Drivers = lazy(() => import('./pages/Drivers'))
const FuelLogs = lazy(() => import('./pages/FuelLogs'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const RiskRadar = lazy(() => import('./pages/RiskRadar'))
const Financials = lazy(() => import('./pages/Financials'))
const RoadIntelligence = lazy(() => import('./pages/RoadIntelligence'))
const AlertsPage = lazy(() => import('./pages/AlertsPage'))
const Reports = lazy(() => import('./pages/Reports'))
const AdminConsole = lazy(() => import('./pages/AdminConsole'))
const Settings = lazy(() => import('./pages/Settings'))
const Subscription = lazy(() => import('./pages/Subscription'))
const DriverApp = lazy(() => import('./pages/DriverApp'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#F7F0D9] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#EEE8F7] border border-[#B8A3D9] text-[#625346] flex items-center justify-center shadow-card">
          <Truck className="w-6 h-6 text-[#6E5696]" />
        </div>
        <div className="text-center">
          <p className="font-bold text-lg text-[#625346]">DriveMitra</p>
          <p className="text-xs text-[#7D6D5F] mt-1">Loading fleet workspace...</p>
        </div>
        <div className="w-40 h-1.5 rounded-full overflow-hidden bg-[#E0D4B7]">
          <div className="h-full bg-[#E8C65A] animate-progress-flow w-full" />
        </div>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />
  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export function RoleProtectedRoute({ children }: { children: React.ReactNode }) {
  const { activeRole } = useFleet()
  const location = useLocation()
  const navigate = useNavigate()

  if (!canAccessRoute(activeRole, location.pathname)) {
    const fallback = getDefaultHomeForRole(activeRole)
    return (
      <div className="min-h-screen bg-[#F7F0D9]">
        <AccessDeniedState
          roleLabel={activeRole.replace('_', ' ')}
          targetPath={location.pathname}
          onReturn={() => navigate(fallback, { replace: true })}
        />
      </div>
    )
  }
  return <>{children}</>
}

function LegacyVehicleRedirect() {
  const { id } = useParams()
  return <Navigate to={id ? `/dashboard/fleet/${id}` : '/dashboard/fleet'} replace />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />

        {/* Enterprise Dashboard Workspace */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute>
                <Layout />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="map" element={<RoleProtectedRoute><LiveMap /></RoleProtectedRoute>} />
          <Route path="trips" element={<RoleProtectedRoute><Trips /></RoleProtectedRoute>} />
          <Route path="fleet" element={<RoleProtectedRoute><Vehicles /></RoleProtectedRoute>} />
          <Route path="fleet/:id" element={<RoleProtectedRoute><VehicleDetails /></RoleProtectedRoute>} />
          <Route path="maintenance" element={<RoleProtectedRoute><Maintenance /></RoleProtectedRoute>} />
          <Route path="risk" element={<RoleProtectedRoute><RiskRadar /></RoleProtectedRoute>} />
          <Route path="drivers" element={<RoleProtectedRoute><Drivers /></RoleProtectedRoute>} />
          <Route path="roads" element={<RoleProtectedRoute><RoadIntelligence /></RoleProtectedRoute>} />
          <Route path="fuel" element={<RoleProtectedRoute><FuelLogs /></RoleProtectedRoute>} />
          <Route path="financials" element={<RoleProtectedRoute><Financials /></RoleProtectedRoute>} />
          <Route path="reports" element={<RoleProtectedRoute><Reports /></RoleProtectedRoute>} />
          <Route path="alerts" element={<RoleProtectedRoute><AlertsPage /></RoleProtectedRoute>} />
          <Route path="admin" element={<RoleProtectedRoute><AdminConsole /></RoleProtectedRoute>} />
          <Route path="subscription" element={<RoleProtectedRoute><Subscription /></RoleProtectedRoute>} />
          <Route path="settings" element={<RoleProtectedRoute><Settings /></RoleProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        {/* Driver Mobile Application */}
        <Route
          path="/driver"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute>
                <DriverApp />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/trips"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute>
                <DriverApp initialTab="trips" />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/fuel"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute>
                <DriverApp initialTab="fuel" />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/driver/settings"
          element={
            <ProtectedRoute>
              <RoleProtectedRoute>
                <DriverApp initialTab="settings" />
              </RoleProtectedRoute>
            </ProtectedRoute>
          }
        />

        {/* Legacy / Convenience Redirects */}
        <Route path="/map" element={<Navigate to="/dashboard/map" replace />} />
        <Route path="/vehicles" element={<Navigate to="/dashboard/fleet" replace />} />
        <Route path="/vehicles/:id" element={<LegacyVehicleRedirect />} />
        <Route path="*" element={<NotFound />} />
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
                position="bottom-right"
                theme="light"
                toastOptions={{
                  style: {
                    background: '#FBF6E6',
                    border: '1px solid #D4C7E6',
                    color: '#625346',
                    borderRadius: '10px',
                    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                  },
                }}
              />
            </BrowserRouter>
          </AuthProvider>
        </FleetProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
