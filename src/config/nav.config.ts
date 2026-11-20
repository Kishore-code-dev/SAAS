import type { ComponentType } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FileSignature,
  FolderKanban,
  Fuel,
  Hammer,
  Landmark,
  Layers,
  LayoutDashboard,
  MapPin,
  Package,
  Plug,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react'

export type BadgeKey = 'maintenance' | 'risk' | 'workOrders' | 'alerts' | 'issues' | 'financeOverdue'
type Icon = ComponentType<{ className?: string }>

export interface NavLeaf {
  to: string
  label: string
  labelKey?: string
  icon?: Icon
  end?: boolean
  badge?: BadgeKey
}

export interface NavEntry {
  id: string
  icon: Icon
  /** Leaf entry */
  to?: string
  label: string
  labelKey?: string
  end?: boolean
  badge?: BadgeKey
  pill?: string
  /** Group entry (accordion) */
  children?: NavLeaf[]
}

export const MAIN_NAV: NavEntry[] = [
  { id: 'dashboard', to: '/dashboard', label: 'Dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { id: 'map', to: '/dashboard/map', label: 'Fleet Map', labelKey: 'nav.map', icon: MapPin },
  {
    id: 'vehicles',
    label: 'Vehicles',
    icon: Layers,
    children: [
      { to: '/dashboard/fleet', label: 'Vehicle List', labelKey: 'nav.fleet', end: true },
      { to: '/dashboard/fleet/assignments', label: 'Vehicle Assignments' },
      { to: '/dashboard/fleet/meter-history', label: 'Meter History' },
      { to: '/dashboard/fleet/tire-readings', label: 'Tire Readings' },
      { to: '/dashboard/fleet/expenses', label: 'Expense History' },
      { to: '/dashboard/fleet/replacement-analysis', label: 'Replacement Analysis' },
    ],
  },
  {
    id: 'tools',
    label: 'Tools',
    pill: 'Try',
    icon: Hammer,
    children: [
      { to: '/dashboard/tools', label: 'Tool List', end: true },
      { to: '/dashboard/tools/service-entries', label: 'Service Entries' },
      { to: '/dashboard/tools/reminders', label: 'Reminders' },
    ],
  },
  {
    id: 'inspections',
    label: 'Inspections',
    icon: ClipboardCheck,
    children: [
      { to: '/dashboard/inspections', label: 'Inspection History', labelKey: 'nav.inspections', end: true },
      { to: '/dashboard/inspections/failures', label: 'Item Failures' },
      { to: '/dashboard/inspections/schedules', label: 'Schedules' },
      { to: '/dashboard/inspections/forms', label: 'Forms' },
    ],
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: AlertTriangle,
    children: [
      { to: '/dashboard/issues', label: 'Issues', badge: 'issues', end: true },
      { to: '/dashboard/risk', label: 'Faults', badge: 'risk' },
      { to: '/dashboard/issues/recalls', label: 'Recalls' },
    ],
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: BellRing,
    children: [
      { to: '/dashboard/reminders/service', label: 'Service Reminders' },
      { to: '/dashboard/reminders/vehicle-renewals', label: 'Vehicle Renewals' },
      { to: '/dashboard/reminders/contact-renewals', label: 'Contact Renewals' },
    ],
  },
  {
    id: 'service',
    label: 'Service',
    icon: Wrench,
    children: [
      { to: '/dashboard/maintenance', label: 'Service History', labelKey: 'nav.maintenance', badge: 'maintenance', end: true },
      { to: '/dashboard/work-orders', label: 'Work Orders', labelKey: 'nav.work_orders', badge: 'workOrders' },
      { to: '/dashboard/service/tasks', label: 'Service Tasks' },
      { to: '/dashboard/service/programs', label: 'Service Programs' },
    ],
  },
  { id: 'contacts', to: '/dashboard/drivers', label: 'Contacts', labelKey: 'nav.drivers', icon: Users },
  { id: 'vendors', to: '/dashboard/workshops', label: 'Vendors', labelKey: 'nav.workshops', icon: Building2 },
  {
    id: 'parts',
    label: 'Parts & Inventory',
    icon: Package,
    children: [
      { to: '/dashboard/inventory', label: 'Parts List', labelKey: 'nav.inventory', end: true },
      { to: '/dashboard/inventory/bulk', label: 'Bulk Manage Parts' },
      { to: '/dashboard/inventory/purchase-orders', label: 'Purchase Orders' },
    ],
  },
  {
    id: 'fuel',
    label: 'Fuel & Energy',
    icon: Fuel,
    children: [
      { to: '/dashboard/fuel', label: 'Fuel History', labelKey: 'nav.fuel', end: true },
      { to: '/dashboard/fuel/charging', label: 'Charging History' },
    ],
  },
  { id: 'places', to: '/dashboard/roads', label: 'Places', labelKey: 'nav.road_intel', icon: MapPin },
  { id: 'documents', to: '/dashboard/documents', label: 'Documents', icon: FileCheck2 },
  { id: 'warranties', to: '/dashboard/warranties', label: 'Warranties', icon: ShieldCheck },
  { id: 'custom-records', to: '/dashboard/custom-records', label: 'Custom Records', icon: FolderKanban },
  { id: 'integrations', to: '/dashboard/integrations', label: 'Integrations', icon: Plug },
  {
    id: 'contracts',
    label: 'Vehicle Contracts',
    icon: FileSignature,
    children: [
      { to: '/dashboard/contracts', label: 'Contract Overview', end: true },
      { to: '/dashboard/contracts/register', label: 'Contract Register' },
      { to: '/dashboard/contracts/vehicles', label: 'Contracted Vehicles' },
      { to: '/dashboard/contracts/partners', label: 'Fleet Partners' },
      { to: '/dashboard/contracts/owners', label: 'Individual Vehicle Owners' },
      { to: '/dashboard/contracts/payments', label: 'Contract Payments' },
      { to: '/dashboard/contracts/maintenance', label: 'Contract Maintenance' },
      { to: '/dashboard/contracts/deposits', label: 'Bond & Deposits' },
      { to: '/dashboard/contracts/renewals', label: 'Contract Renewals' },
      { to: '/dashboard/contracts/documents', label: 'Contract Documents' },
      { to: '/dashboard/contracts/history', label: 'Contract History' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Landmark,
    children: [
      { to: '/dashboard/finance', label: 'Finance Overview', end: true },
      { to: '/dashboard/finance/vehicles', label: 'Vehicle Finance' },
      { to: '/dashboard/finance/emis', label: 'EMI Schedule' },
      { to: '/dashboard/finance/upcoming', label: 'Upcoming Payments' },
      { to: '/dashboard/finance/overdue', label: 'Overdue Payments', badge: 'financeOverdue' },
      { to: '/dashboard/finance/payments', label: 'Payment History' },
      { to: '/dashboard/finance/banks', label: 'Bank & Financier Details' },
      { to: '/dashboard/finance/documents', label: 'Finance Documents' },
      { to: '/dashboard/finance/reports', label: 'Finance Reports' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    children: [
      { to: '/dashboard/financials', label: 'Advanced Analytics', labelKey: 'nav.financials' },
      { to: '/dashboard/reports', label: 'Standard Reports', labelKey: 'nav.reports' },
    ],
  },
]

export const FOOTER_NAV: NavLeaf[] = [
  { to: '/dashboard/settings', label: 'Settings', labelKey: 'nav.settings', icon: SettingsIcon },
]
