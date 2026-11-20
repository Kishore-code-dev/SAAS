import React, { Component, lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { FleetProvider, useFleet } from './hooks/useFleet'
import { FinanceProvider } from './hooks/useFinance'
import { I18nProvider } from './i18n/useTranslation'
import Layout from './components/layout/Layout'
import DriverLayout from './components/layout/DriverLayout'
import { AccessDeniedState } from './components/ui/EnterprisePrimitives'
import { BrandLogo } from './components/ui/BrandLogo'
import { canAccessRoute, getDefaultHomeForRole } from './utils/rbac'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import Auth from './pages/Auth'
import ForcePasswordChange from './pages/ForcePasswordChange'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import DriverHome from './pages/driver/DriverHome'
import DriverTrips from './pages/driver/DriverTrips'
import DriverTripDetail from './pages/driver/DriverTripDetail'
import DriverFuel from './pages/driver/DriverFuel'
import DriverExpenses from './pages/driver/DriverExpenses'
import DriverMaintenance from './pages/driver/DriverMaintenance'
import DriverProfile from './pages/driver/DriverProfile'

function lazyWithRetry(
  importer: () => Promise<{ default: ComponentType<Record<string, never>> }>,
) {
  return lazy(async () => {
    try {
      return await importer()
    } catch (firstErr) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      try {
        return await importer()
      } catch (secondErr) {
        if (typeof window !== 'undefined') {
          const reloadKey = 'drivemitra_chunk_reload'
          if (!window.sessionStorage.getItem(reloadKey)) {
            window.sessionStorage.setItem(reloadKey, '1')
            window.location.reload()
          }
        }
        throw secondErr ?? firstErr
      }
    }
  })
}

const PlatformAdmin = lazyWithRetry(() => import('./pages/PlatformAdmin'))
const LiveMap = lazyWithRetry(() => import('./pages/LiveMap'))
const Trips = lazyWithRetry(() => import('./pages/Trips'))
const Vehicles = lazyWithRetry(() => import('./pages/Vehicles'))
const VehicleForm = lazyWithRetry(() => import('./pages/VehicleForm'))
const VehicleDetails = lazyWithRetry(() => import('./pages/VehicleDetails'))
const Drivers = lazyWithRetry(() => import('./pages/Drivers'))
const DriverDetails = lazyWithRetry(() => import('./pages/DriverDetails'))
const FuelLogs = lazyWithRetry(() => import('./pages/FuelLogs'))
const Maintenance = lazyWithRetry(() => import('./pages/Maintenance'))
const Inspections = lazyWithRetry(() => import('./pages/Inspections'))
const WorkOrders = lazyWithRetry(() => import('./pages/WorkOrders'))
const Inventory = lazyWithRetry(() => import('./pages/Inventory'))
const Workshops = lazyWithRetry(() => import('./pages/Workshops'))
const RiskRadar = lazyWithRetry(() => import('./pages/RiskRadar'))
const Financials = lazyWithRetry(() => import('./pages/Financials'))
const RoadIntelligence = lazyWithRetry(() => import('./pages/RoadIntelligence'))
const AlertsPage = lazyWithRetry(() => import('./pages/AlertsPage'))
const Reports = lazyWithRetry(() => import('./pages/Reports'))
const AdminConsole = lazyWithRetry(() => import('./pages/AdminConsole'))
const Settings = lazyWithRetry(() => import('./pages/Settings'))
const Subscription = lazyWithRetry(() => import('./pages/Subscription'))

const VehicleAssignmentsPage = lazyWithRetry(() =>
  import('./pages/fleetio/VehicleSubViews').then((m) => ({ default: m.VehicleAssignmentsView })),
)
const MeterHistoryPage = lazyWithRetry(() =>
  import('./pages/fleetio/VehicleSubViews').then((m) => ({ default: m.MeterHistoryView })),
)
const TireReadingsPage = lazyWithRetry(() =>
  import('./pages/fleetio/VehicleSubViews').then((m) => ({ default: m.TireReadingsView })),
)
const ExpenseHistoryPage = lazyWithRetry(() =>
  import('./pages/fleetio/VehicleSubViews').then((m) => ({ default: m.ExpenseHistoryView })),
)
const ReplacementAnalysisPage = lazyWithRetry(() =>
  import('./pages/fleetio/VehicleSubViews').then((m) => ({ default: m.ReplacementAnalysisView })),
)
const ToolsListPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.ToolsHubView tab="list" />,
  })),
)
const ToolsServicePage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.ToolsHubView tab="service" />,
  })),
)
const ToolsRemindersPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.ToolsHubView tab="reminders" />,
  })),
)
const InspectionFailuresPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.InspectionsSubView tab="failures" />,
  })),
)
const InspectionSchedulesPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.InspectionsSubView tab="schedules" />,
  })),
)
const InspectionFormsPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.InspectionsSubView tab="forms" />,
  })),
)
const IssuesPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.IssuesHubView mode="issues" />,
  })),
)
const RecallsPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.IssuesHubView mode="recalls" />,
  })),
)
const ServiceRemindersPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.RemindersHubView mode="service" />,
  })),
)
const VehicleRenewalsPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.RemindersHubView mode="vehicle_renewals" />,
  })),
)
const ContactRenewalsPage = lazyWithRetry(() =>
  import('./pages/fleetio/OperationsSubViews').then((m) => ({
    default: () => <m.RemindersHubView mode="contact_renewals" />,
  })),
)
const ServiceTasksPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.ServiceSubView tab="tasks" />,
  })),
)
const ServiceProgramsPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.ServiceSubView tab="programs" />,
  })),
)
const InventoryBulkPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.InventorySubView tab="bulk" />,
  })),
)
const PurchaseOrdersPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({
    default: () => <m.InventorySubView tab="po" />,
  })),
)
const ChargingHistoryPage = lazyWithRetry(() =>
  import('./pages/fleetio/ServiceAndPartsSubViews').then((m) => ({ default: m.ChargingHistoryView })),
)
const DocumentsPage = lazyWithRetry(() =>
  import('./pages/fleetio/EnterpriseModulesView').then((m) => ({ default: m.DocumentsView })),
)
const WarrantiesPage = lazyWithRetry(() =>
  import('./pages/fleetio/EnterpriseModulesView').then((m) => ({ default: m.WarrantiesView })),
)
const CustomRecordsPage = lazyWithRetry(() =>
  import('./pages/fleetio/EnterpriseModulesView').then((m) => ({ default: m.CustomRecordsView })),
)
const IntegrationsPage = lazyWithRetry(() =>
  import('./pages/fleetio/EnterpriseModulesView').then((m) => ({ default: m.IntegrationsView })),
)
const ContractOverviewPage = lazyWithRetry(() => import('./pages/contracts/ContractOverviewPage'))
const ContractRegisterPage = lazyWithRetry(() => import('./pages/contracts/ContractRegisterPage'))
const ContractedVehiclesPage = lazyWithRetry(() => import('./pages/contracts/ContractedVehiclesPage'))
const FleetPartnersPage = lazyWithRetry(() => import('./pages/contracts/FleetPartnersPage'))
const IndividualOwnersPage = lazyWithRetry(() => import('./pages/contracts/IndividualOwnersPage'))
const ContractPaymentsPage = lazyWithRetry(() => import('./pages/contracts/ContractPaymentsPage'))
const ContractMaintenancePage = lazyWithRetry(() => import('./pages/contracts/ContractMaintenancePage'))
const BondDepositsPage = lazyWithRetry(() => import('./pages/contracts/BondDepositsPage'))
const ContractRenewalsPage = lazyWithRetry(() => import('./pages/contracts/ContractRenewalsPage'))
const ContractDocumentsPage = lazyWithRetry(() => import('./pages/contracts/ContractDocumentsPage'))
const ContractHistoryPage = lazyWithRetry(() => import('./pages/contracts/ContractHistoryPage'))
const ContractDetailPage = lazyWithRetry(() => import('./pages/contracts/ContractDetailPage'))
const FinanceOverviewPage = lazyWithRetry(() => import('./pages/finance/FinanceOverviewPage'))
const VehicleFinanceListPage = lazyWithRetry(() => import('./pages/finance/VehicleFinanceListPage'))
const VehicleFinanceDetailsPage = lazyWithRetry(() => import('./pages/finance/VehicleFinanceDetailsPage'))
const EmiSchedulePage = lazyWithRetry(() => import('./pages/finance/EmiSchedulePage'))
const UpcomingPaymentsPage = lazyWithRetry(() => import('./pages/finance/UpcomingPaymentsPage'))
const OverduePaymentsPage = lazyWithRetry(() => import('./pages/finance/OverduePaymentsPage'))
const PaymentHistoryPage = lazyWithRetry(() => import('./pages/finance/PaymentHistoryPage'))
const BanksDirectoryPage = lazyWithRetry(() => import('./pages/finance/BanksDirectoryPage'))
const FinanceDocumentsPage = lazyWithRetry(() => import('./pages/finance/FinanceDocumentsPage'))
const FinanceReportsPage = lazyWithRetry(() => import('./pages/finance/FinanceReportsPage'))

class RouteErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl p-8 text-center shadow-card space-y-4">
            <BrandLogo size="lg" className="mx-auto" />
            <h1 className="text-lg font-bold text-[#625346]">Workspace Module Interrupted</h1>
            <p className="text-xs text-[#958777] leading-relaxed">
              A navigation update occurred while loading this page. Reload to synchronize with the latest workspace build.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-primary text-xs px-5 py-2.5"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
})

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <BrandLogo size="xl" />
        <p className="text-xs text-[#958777]">Loading fleet workspace...</p>
        <div className="w-40 h-1.5 rounded-full overflow-hidden bg-[#E5E5E5]">
          <div className="h-full bg-[#E8C65A] animate-progress-flow w-full" />
        </div>
      </div>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, isAuthenticated, passwordChangeRequired, orgBlockedState, signOut } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen />

  if (orgBlockedState) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#E5E5E5] rounded-2xl p-8 shadow-card space-y-4 text-center">
          <BrandLogo size="lg" className="mx-auto" />
          <h1 className="text-lg font-bold text-[#625346]">Organization Access Restricted</h1>
          <p className="text-xs text-[#958777] leading-relaxed">
            Status: <span className="font-semibold uppercase text-[#D9786C]">{orgBlockedState.status}</span> —{' '}
            {orgBlockedState.reason}
          </p>
          <button type="button" onClick={() => void signOut()} className="btn-primary text-xs px-5 py-2.5">
            Return to Login
          </button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }

  if (passwordChangeRequired && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <>{children}</>
}

export function RoleProtectedRoute({ children }: { children: React.ReactNode }) {
  const { activeRole } = useFleet()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const effectiveRole = user?.role ?? activeRole

  if (!canAccessRoute(effectiveRole, location.pathname)) {
    const fallback = getDefaultHomeForRole(effectiveRole)
    return (
      <div className="min-h-screen bg-[#FFFFFF]">
        <AccessDeniedState
          roleLabel={effectiveRole.replace('_', ' ')}
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
  return <Navigate to={id ? `/dashboard/fleet/vehicles/${id}` : '/dashboard/fleet'} replace />
}

export function AppRoutes() {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ForcePasswordChange />
              </ProtectedRoute>
            }
          />
          <Route
            path="/platform-admin"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute>
                  <PlatformAdmin />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          />

          {/* Driver Mobile Routes */}
          <Route
            path="/driver"
            element={
              <ProtectedRoute>
                <RoleProtectedRoute>
                  <DriverLayout />
                </RoleProtectedRoute>
              </ProtectedRoute>
            }
          >
            <Route index element={<DriverHome />} />
            <Route path="trips" element={<DriverTrips />} />
            <Route path="trips/:tripId" element={<DriverTripDetail />} />
            <Route path="fuel" element={<DriverFuel />} />
            <Route path="expenses" element={<DriverExpenses />} />
            <Route path="maintenance" element={<DriverMaintenance />} />
            <Route path="profile" element={<DriverProfile />} />
          </Route>

          {/* Owner & Operations Enterprise Dashboard Workspace */}
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
            <Route path="fleet/new" element={<RoleProtectedRoute><VehicleForm /></RoleProtectedRoute>} />
            <Route path="fleet/assignments" element={<RoleProtectedRoute><VehicleAssignmentsPage /></RoleProtectedRoute>} />
            <Route path="fleet/meter-history" element={<RoleProtectedRoute><MeterHistoryPage /></RoleProtectedRoute>} />
            <Route path="fleet/tire-readings" element={<RoleProtectedRoute><TireReadingsPage /></RoleProtectedRoute>} />
            <Route path="fleet/expenses" element={<RoleProtectedRoute><ExpenseHistoryPage /></RoleProtectedRoute>} />
            <Route path="fleet/replacement-analysis" element={<RoleProtectedRoute><ReplacementAnalysisPage /></RoleProtectedRoute>} />
            <Route path="fleet/vehicles/:vehicleId" element={<RoleProtectedRoute><VehicleDetails /></RoleProtectedRoute>} />
            <Route path="fleet/:id" element={<RoleProtectedRoute><VehicleDetails /></RoleProtectedRoute>} />
            <Route path="tools" element={<RoleProtectedRoute><ToolsListPage /></RoleProtectedRoute>} />
            <Route path="tools/service-entries" element={<RoleProtectedRoute><ToolsServicePage /></RoleProtectedRoute>} />
            <Route path="tools/reminders" element={<RoleProtectedRoute><ToolsRemindersPage /></RoleProtectedRoute>} />
            <Route path="maintenance" element={<RoleProtectedRoute><Maintenance /></RoleProtectedRoute>} />
            <Route path="service/tasks" element={<RoleProtectedRoute><ServiceTasksPage /></RoleProtectedRoute>} />
            <Route path="service/programs" element={<RoleProtectedRoute><ServiceProgramsPage /></RoleProtectedRoute>} />
            <Route path="inspections" element={<RoleProtectedRoute><Inspections /></RoleProtectedRoute>} />
            <Route path="inspections/failures" element={<RoleProtectedRoute><InspectionFailuresPage /></RoleProtectedRoute>} />
            <Route path="inspections/schedules" element={<RoleProtectedRoute><InspectionSchedulesPage /></RoleProtectedRoute>} />
            <Route path="inspections/forms" element={<RoleProtectedRoute><InspectionFormsPage /></RoleProtectedRoute>} />
            <Route path="issues" element={<RoleProtectedRoute><IssuesPage /></RoleProtectedRoute>} />
            <Route path="issues/recalls" element={<RoleProtectedRoute><RecallsPage /></RoleProtectedRoute>} />
            <Route path="reminders/service" element={<RoleProtectedRoute><ServiceRemindersPage /></RoleProtectedRoute>} />
            <Route path="reminders/vehicle-renewals" element={<RoleProtectedRoute><VehicleRenewalsPage /></RoleProtectedRoute>} />
            <Route path="reminders/contact-renewals" element={<RoleProtectedRoute><ContactRenewalsPage /></RoleProtectedRoute>} />
            <Route path="work-orders" element={<RoleProtectedRoute><WorkOrders /></RoleProtectedRoute>} />
            <Route path="inventory" element={<RoleProtectedRoute><Inventory /></RoleProtectedRoute>} />
            <Route path="inventory/bulk" element={<RoleProtectedRoute><InventoryBulkPage /></RoleProtectedRoute>} />
            <Route path="inventory/purchase-orders" element={<RoleProtectedRoute><PurchaseOrdersPage /></RoleProtectedRoute>} />
            <Route path="workshops" element={<RoleProtectedRoute><Workshops /></RoleProtectedRoute>} />
            <Route path="risk" element={<RoleProtectedRoute><RiskRadar /></RoleProtectedRoute>} />
            <Route path="drivers" element={<RoleProtectedRoute><Drivers /></RoleProtectedRoute>} />
            <Route path="drivers/:driverId" element={<RoleProtectedRoute><DriverDetails /></RoleProtectedRoute>} />
            <Route path="fleet/drivers/:driverId" element={<RoleProtectedRoute><DriverDetails /></RoleProtectedRoute>} />
            <Route path="roads" element={<RoleProtectedRoute><RoadIntelligence /></RoleProtectedRoute>} />
            <Route path="fuel" element={<RoleProtectedRoute><FuelLogs /></RoleProtectedRoute>} />
            <Route path="fuel/charging" element={<RoleProtectedRoute><ChargingHistoryPage /></RoleProtectedRoute>} />
            <Route path="documents" element={<RoleProtectedRoute><DocumentsPage /></RoleProtectedRoute>} />
            <Route path="warranties" element={<RoleProtectedRoute><WarrantiesPage /></RoleProtectedRoute>} />
            <Route path="custom-records" element={<RoleProtectedRoute><CustomRecordsPage /></RoleProtectedRoute>} />
            <Route path="integrations" element={<RoleProtectedRoute><IntegrationsPage /></RoleProtectedRoute>} />
            <Route path="contracts" element={<RoleProtectedRoute><ContractOverviewPage /></RoleProtectedRoute>} />
            <Route path="contracts/register" element={<RoleProtectedRoute><ContractRegisterPage /></RoleProtectedRoute>} />
            <Route path="contracts/vehicles" element={<RoleProtectedRoute><ContractedVehiclesPage /></RoleProtectedRoute>} />
            <Route path="contracts/partners" element={<RoleProtectedRoute><FleetPartnersPage /></RoleProtectedRoute>} />
            <Route path="contracts/owners" element={<RoleProtectedRoute><IndividualOwnersPage /></RoleProtectedRoute>} />
            <Route path="contracts/payments" element={<RoleProtectedRoute><ContractPaymentsPage /></RoleProtectedRoute>} />
            <Route path="contracts/maintenance" element={<RoleProtectedRoute><ContractMaintenancePage /></RoleProtectedRoute>} />
            <Route path="contracts/deposits" element={<RoleProtectedRoute><BondDepositsPage /></RoleProtectedRoute>} />
            <Route path="contracts/renewals" element={<RoleProtectedRoute><ContractRenewalsPage /></RoleProtectedRoute>} />
            <Route path="contracts/documents" element={<RoleProtectedRoute><ContractDocumentsPage /></RoleProtectedRoute>} />
            <Route path="contracts/history" element={<RoleProtectedRoute><ContractHistoryPage /></RoleProtectedRoute>} />
            <Route path="contracts/:contractId" element={<RoleProtectedRoute><ContractDetailPage /></RoleProtectedRoute>} />
            <Route path="finance" element={<RoleProtectedRoute><FinanceOverviewPage /></RoleProtectedRoute>} />
            <Route path="finance/vehicles" element={<RoleProtectedRoute><VehicleFinanceListPage /></RoleProtectedRoute>} />
            <Route path="finance/vehicles/:financeId" element={<RoleProtectedRoute><VehicleFinanceDetailsPage /></RoleProtectedRoute>} />
            <Route path="finance/emis" element={<RoleProtectedRoute><EmiSchedulePage /></RoleProtectedRoute>} />
            <Route path="finance/upcoming" element={<RoleProtectedRoute><UpcomingPaymentsPage /></RoleProtectedRoute>} />
            <Route path="finance/overdue" element={<RoleProtectedRoute><OverduePaymentsPage /></RoleProtectedRoute>} />
            <Route path="finance/payments" element={<RoleProtectedRoute><PaymentHistoryPage /></RoleProtectedRoute>} />
            <Route path="finance/banks" element={<RoleProtectedRoute><BanksDirectoryPage /></RoleProtectedRoute>} />
            <Route path="finance/documents" element={<RoleProtectedRoute><FinanceDocumentsPage /></RoleProtectedRoute>} />
            <Route path="finance/reports" element={<RoleProtectedRoute><FinanceReportsPage /></RoleProtectedRoute>} />
            <Route path="financials" element={<RoleProtectedRoute><Financials /></RoleProtectedRoute>} />
            <Route path="reports" element={<RoleProtectedRoute><Reports /></RoleProtectedRoute>} />
            <Route path="alerts" element={<RoleProtectedRoute><AlertsPage /></RoleProtectedRoute>} />
            <Route path="admin" element={<RoleProtectedRoute><AdminConsole /></RoleProtectedRoute>} />
            <Route path="subscription" element={<RoleProtectedRoute><Subscription /></RoleProtectedRoute>} />
            <Route path="settings" element={<RoleProtectedRoute><Settings /></RoleProtectedRoute>} />
            <Route path="settings/:section" element={<RoleProtectedRoute><Settings /></RoleProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Legacy / Convenience Redirects */}
          <Route path="/map" element={<Navigate to="/dashboard/map" replace />} />
          <Route path="/vehicles" element={<Navigate to="/dashboard/fleet" replace />} />
          <Route path="/vehicles/:id" element={<LegacyVehicleRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <FleetProvider>
            <FinanceProvider>
              <BrowserRouter>
                <AppRoutes />
                <Toaster
                  position="bottom-right"
                  theme="light"
                  toastOptions={{
                    style: {
                      background: '#FFFFFF',
                      border: '1px solid #E5E5E5',
                      color: '#625346',
                      borderRadius: '10px',
                      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
                    },
                  }}
                />
              </BrowserRouter>
            </FinanceProvider>
          </FleetProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  )
}
