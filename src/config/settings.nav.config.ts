import type { ComponentType } from 'react'
import { Bell, Building2, ShieldCheck } from 'lucide-react'

export interface SettingsLink {
  slug: string
  label: string
}
export interface SettingsSection {
  id: string
  title: string
  icon: ComponentType<{ className?: string }>
  links: SettingsLink[]
}

export const SETTINGS_BASE = '/dashboard/settings'
export const DEFAULT_SETTINGS_SLUG = 'general'

export const SETTINGS_NAV: SettingsSection[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    icon: Building2,
    links: [
      { slug: 'general', label: 'Organization & Timezone' },
      { slug: 'language', label: 'Language' },
    ],
  },
  {
    id: 'alerts',
    title: 'Alerts & Telemetry',
    icon: Bell,
    links: [
      { slug: 'thresholds', label: 'Telemetry & Thresholds' },
      { slug: 'notifications', label: 'Notifications' },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    icon: ShieldCheck,
    links: [{ slug: 'kyc', label: 'DigiLocker KYC Readiness' }],
  },
]

