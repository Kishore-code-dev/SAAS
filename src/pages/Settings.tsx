import { Navigate, useParams } from 'react-router-dom'
import type { ComponentType } from 'react'
import { DEFAULT_SETTINGS_SLUG, SETTINGS_BASE, SETTINGS_NAV } from '../config/settings.nav.config'
import {
  GeneralSection,
  KycSection,
  LanguageSection,
  NotificationsSection,
  ThresholdsSection,
} from './settings/sections'

const SECTIONS: Record<string, ComponentType> = {
  general: GeneralSection,
  language: LanguageSection,
  thresholds: ThresholdsSection,
  notifications: NotificationsSection,
  kyc: KycSection,
}

export default function Settings() {
  const { section } = useParams()
  const Section = section ? SECTIONS[section] : undefined
  if (!section || !Section) return <Navigate to={`${SETTINGS_BASE}/${DEFAULT_SETTINGS_SLUG}`} replace />

  const link = SETTINGS_NAV.flatMap((s) => s.links.map((l) => ({ ...l, group: s.title }))).find(
    (l) => l.slug === section,
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#958777]">
          Settings{link ? ` / ${link.group}` : ''}
        </p>
        <h1 className="dm-page-title">{link?.label ?? 'Workspace Settings'}</h1>
      </div>
      <Section />
    </div>
  )
}
