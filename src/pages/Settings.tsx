import React, { useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { languageOptions } from '../i18n/translations'
import { canPerformAction } from '../utils/rbac'

export default function Settings() {
  const {
    activeOrganization,
    activeRole,
    updateOrganizationProfile,
    settings,
    updateSettings,
  } = useFleet()
  const { language, setLanguage } = useTranslation()

  const [orgFormDraft, setOrgFormDraft] = useState({
    orgId: activeOrganization.id,
    name: activeOrganization.name,
    city: activeOrganization.city,
    state: activeOrganization.state,
    timezone: activeOrganization.timezone,
  })

  const orgForm =
    orgFormDraft.orgId === activeOrganization.id
      ? orgFormDraft
      : {
          orgId: activeOrganization.id,
          name: activeOrganization.name,
          city: activeOrganization.city,
          state: activeOrganization.state,
          timezone: activeOrganization.timezone,
        }

  const canEditOrg = canPerformAction(activeRole, 'update_org_settings')
  const canEditGlobal = canPerformAction(activeRole, 'update_global_settings')

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditOrg) {
      toast.error('Your role is not authorized to update organization settings.')
      return
    }
    if (!orgForm.name.trim()) {
      toast.error('Organization name cannot be empty.')
      return
    }
    try {
      updateOrganizationProfile({
        name: orgForm.name,
        city: orgForm.city,
        state: orgForm.state,
        timezone: orgForm.timezone,
      })
      toast.success('Organization settings saved.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save organization settings.')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="dm-page-title">Workspace Settings</h1>
        <p className="text-sm text-[#958777] mt-1">
          Configure organization timezone, localization, alert thresholds, and telemetry privacy controls
        </p>
      </div>

      {/* Organization Profile & Timezone */}
      <form onSubmit={handleSaveOrg} className="enterprise-card p-6 space-y-4">
        <h2 className="dm-card-title">Organization & Timezone</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-org-name" className="dm-label">Organization Name</label>
            <input
              id="set-org-name"
              disabled={!canEditOrg}
              value={orgForm.name}
              onChange={(e) => setOrgFormDraft({ ...orgForm, name: e.target.value })}
              className="dm-input disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="set-timezone" className="dm-label">Reporting Timezone</label>
            <select
              id="set-timezone"
              disabled={!canEditOrg}
              value={orgForm.timezone}
              onChange={(e) => setOrgFormDraft({ ...orgForm, timezone: e.target.value })}
              className="dm-input disabled:opacity-60"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+05:30)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+08:00)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-city" className="dm-label">Hub City</label>
            <input
              id="set-city"
              disabled={!canEditOrg}
              value={orgForm.city}
              onChange={(e) => setOrgFormDraft({ ...orgForm, city: e.target.value })}
              className="dm-input disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="set-state" className="dm-label">State</label>
            <input
              id="set-state"
              disabled={!canEditOrg}
              value={orgForm.state}
              onChange={(e) => setOrgFormDraft({ ...orgForm, state: e.target.value })}
              className="dm-input disabled:opacity-60"
            />
          </div>
        </div>
        {canEditOrg && (
          <div className="pt-2">
            <button type="submit" className="btn-primary text-xs">
              <Save className="w-3.5 h-3.5" />
              Save Organization Settings
            </button>
          </div>
        )}
      </form>

      {/* Localization */}
      <div className="enterprise-card p-6 space-y-4">
        <h2 className="dm-card-title">Interface Localization</h2>
        <p className="text-xs text-[#958777]">Select preferred display language across Command Centre and Driver Companion App.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {languageOptions.map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => {
                setLanguage(opt.code)
                toast.success(`Language changed to ${opt.label}`)
              }}
              className={`p-3 rounded-[10px] border text-left transition-colors ${
                language === opt.code
                  ? 'border-[#B8A3D9] bg-[#EEE8F7] text-[#625346] shadow-subtle'
                  : 'border-[#E5E5E5] bg-[#FFFFFF] text-[#625346] hover:bg-[#EEE8F7]/60'
              }`}
            >
              <span className="text-xs font-bold block">{opt.nativeLabel}</span>
              <span className="text-[11px] block text-[#958777]">
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Persistent Notification & AI Controls */}
      <div className="enterprise-card p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="dm-card-title">Alerts, Telemetry & Privacy</h2>
          {!canEditGlobal && (
            <span className="text-xs font-medium text-[#6E5696]">Admin approval required to change global thresholds</span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label htmlFor="set-interval" className="dm-label">Smartphone Telemetry Ping Interval (sec)</label>
            <input
              id="set-interval"
              type="number"
              min={5}
              max={120}
              disabled={!canEditGlobal}
              value={settings.telemetryIntervalSec}
              onChange={(e) => updateSettings({ telemetryIntervalSec: Number(e.target.value) })}
              className="dm-input tabular-nums disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="set-cutoff" className="dm-label">Low Health Alert Cutoff (%)</label>
            <input
              id="set-cutoff"
              type="number"
              min={20}
              max={90}
              disabled={!canEditGlobal}
              value={settings.lowHealthAlertCutoff}
              onChange={(e) => updateSettings({ lowHealthAlertCutoff: Number(e.target.value) })}
              className="dm-input tabular-nums disabled:opacity-60"
            />
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-[#E5E5E5] text-sm">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="font-medium text-[#625346] block">Critical Failure Alert Notifications</span>
              <span className="text-xs text-[#958777]">Immediate banner & inbox alerting for high/critical component windows</span>
            </div>
            <input
              type="checkbox"
              disabled={!canEditGlobal}
              checked={settings.criticalPushEnabled}
              onChange={(e) => {
                updateSettings({ criticalPushEnabled: e.target.checked })
                toast.success('Notification preference saved.')
              }}
              className="w-4 h-4 accent-[#6E5696]"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="font-medium text-[#625346] block">Daily Fleet Digest Summary</span>
              <span className="text-xs text-[#958777]">Automated end-of-day operational and fuel exception summary</span>
            </div>
            <input
              type="checkbox"
              disabled={!canEditGlobal}
              checked={settings.emailDigestEnabled}
              onChange={(e) => {
                updateSettings({ emailDigestEnabled: e.target.checked })
                toast.success('Digest preference saved.')
              }}
              className="w-4 h-4 accent-[#6E5696]"
            />
          </label>

          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="font-medium text-[#625346] block">Trip-Scoped Driver Location Sharing</span>
              <span className="text-xs text-[#958777]">Restrict smartphone GPS transmission strictly to active shift trips</span>
            </div>
            <input
              type="checkbox"
              disabled={!canEditGlobal}
              checked={settings.privacyShareDriverLocation}
              onChange={(e) => {
                updateSettings({ privacyShareDriverLocation: e.target.checked })
                toast.success('Privacy preference saved.')
              }}
              className="w-4 h-4 accent-[#6E5696]"
            />
          </label>
        </div>
      </div>
    </div>
  )
}

