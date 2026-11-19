import type { ComponentType } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Building2,
  ClipboardCheck,
  Code2,
  Cpu,
  Database,
  Fuel,
  Landmark,
  LayoutGrid,
  Package,
  Plug,
  Shield,
  Truck,
  UserCircle2,
  Wrench,
} from 'lucide-react'

export interface SettingsLink {
  slug: string
  label: string
  badge?: string
  countKey?: 'members'
}

export interface SettingsSection {
  id: string
  title: string
  titleDynamic?: 'user' | 'org'
  icon: ComponentType<{ className?: string }>
  links: SettingsLink[]
}

export const SETTINGS_BASE = '/dashboard/settings'
export const DEFAULT_SETTINGS_SLUG = 'general'

export const SETTINGS_NAV: SettingsSection[] = [
  {
    id: 'personal',
    title: 'Account & Profile',
    titleDynamic: 'user',
    icon: UserCircle2,
    links: [
      { slug: 'profile', label: 'User Profile' },
      { slug: 'notifications', label: 'Notification Settings' },
      { slug: 'custom-dashboards', label: 'Custom Dashboards' },
      { slug: 'saved-views', label: 'My Saved Views' },
      { slug: 'login-password', label: 'Login & Password' },
      { slug: 'appearance', label: 'Appearance & Theme' },
      { slug: 'api-keys', label: 'Manage API Keys' },
    ],
  },
  {
    id: 'workspace',
    title: 'Organization',
    titleDynamic: 'org',
    icon: Building2,
    links: [
      { slug: 'general', label: 'General Settings' },
      { slug: 'billing', label: 'Billing & Subscriptions' },
      { slug: 'export-data', label: 'Export Account Data' },
      { slug: 'sandboxes', label: 'Sandboxes' },
    ],
  },
  {
    id: 'user-access',
    title: 'User Access',
    icon: Shield,
    links: [
      { slug: 'manage-users', label: 'Manage Users', countKey: 'members' },
      { slug: 'security', label: 'Security' },
      { slug: 'roles', label: 'Roles' },
      { slug: 'record-sets', label: 'Record Sets' },
    ],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    icon: Cpu,
    links: [
      { slug: 'ai-advisor', label: 'AI Service Advisor' },
      { slug: 'thresholds', label: 'Telemetry & Thresholds' },
      { slug: 'kyc', label: 'DigiLocker KYC Readiness' },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    icon: Plug,
    links: [
      { slug: 'integrations-directory', label: 'Integrations Directory' },
      { slug: 'integration-links', label: 'Integration Links' },
      { slug: 'webhooks', label: 'Webhooks' },
      { slug: 'external-connections', label: 'External Connections' },
      { slug: 'saml', label: 'SAML Connectors' },
    ],
  },
  {
    id: 'developer',
    title: 'Developer',
    icon: Code2,
    links: [{ slug: 'mcp', label: 'Fleet MCP', badge: 'New' }],
  },
  {
    id: 'data-management',
    title: 'Data Management',
    icon: Database,
    links: [
      { slug: 'standard-records', label: 'Standard Records' },
      { slug: 'custom-records', label: 'Custom Records' },
      { slug: 'groups', label: 'Groups & Subgroups' },
      { slug: 'org-saved-views', label: 'Saved Views' },
      { slug: 'labels', label: 'Labels' },
      { slug: 'language', label: 'Interface Language' },
    ],
  },
  {
    id: 'dashboard-cfg',
    title: 'Dashboard',
    icon: LayoutGrid,
    links: [{ slug: 'custom-widgets', label: 'Custom Widgets' }],
  },
  {
    id: 'vehicles-cfg',
    title: 'Vehicles',
    icon: Truck,
    links: [
      { slug: 'vehicle-statuses', label: 'Vehicle Statuses' },
      { slug: 'vehicle-types', label: 'Vehicle Types' },
      { slug: 'external-vehicle-ids', label: 'External Vehicle IDs' },
      { slug: 'expense-types', label: 'Expense Types' },
      { slug: 'expense-settings', label: 'Expense Settings' },
    ],
  },
  {
    id: 'inspections-cfg',
    title: 'Inspections',
    icon: ClipboardCheck,
    links: [{ slug: 'inspection-settings', label: 'Inspection Settings' }],
  },
  {
    id: 'issues-cfg',
    title: 'Issues',
    icon: AlertTriangle,
    links: [
      { slug: 'issue-priorities', label: 'Issue Priorities' },
      { slug: 'fault-rules', label: 'Fault Rules' },
    ],
  },
  {
    id: 'reminders-cfg',
    title: 'Reminders',
    icon: BellRing,
    links: [
      { slug: 'service-reminder-settings', label: 'Service Reminder Settings' },
      { slug: 'vehicle-renewal-types', label: 'Vehicle Renewal Types' },
      { slug: 'contact-renewal-types', label: 'Contact Renewal Types' },
    ],
  },
  {
    id: 'service-cfg',
    title: 'Service',
    icon: Wrench,
    links: [
      { slug: 'maintenance-settings', label: 'Maintenance Settings' },
      { slug: 'work-order-statuses', label: 'Work Order Statuses' },
      { slug: 'repair-reason-codes', label: 'Reason for Repair Codes' },
      { slug: 'repair-priority-codes', label: 'Repair Priority Class Codes' },
      { slug: 'vmrs-codes', label: 'System/Assembly/Component Codes' },
    ],
  },
  {
    id: 'parts-cfg',
    title: 'Parts & Inventory',
    icon: Package,
    links: [
      { slug: 'part-locations', label: 'Part Locations' },
      { slug: 'part-categories', label: 'Part Categories' },
      { slug: 'part-manufacturers', label: 'Part Manufacturers' },
      { slug: 'measurement-units', label: 'Measurement Units' },
    ],
  },
  {
    id: 'fuel-cfg',
    title: 'Fuel & Energy',
    icon: Fuel,
    links: [
      { slug: 'fuel-energy-settings', label: 'Fuel & Energy Settings' },
      { slug: 'fuel-types', label: 'Fuel Types' },
    ],
  },
  {
    id: 'finance-cfg',
    title: 'Finance',
    icon: Landmark,
    links: [{ slug: 'finance-updates', label: 'Finance Updates' }],
  },
  {
    id: 'reports-cfg',
    title: 'Reports',
    icon: BarChart3,
    links: [{ slug: 'saved-reports', label: 'Saved Reports' }],
  },
]
