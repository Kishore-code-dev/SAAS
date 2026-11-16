import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../hooks/useFleet'
import { INTELLIGENCE_MODEL_VERSION } from '../utils/intelligenceEngine'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { canPerformAction } from '../utils/rbac'
import { EnterpriseModal, formatDateTime, SeverityText } from '../components/ui/EnterprisePrimitives'
import type { OrganizationRole } from '../types/fleet'

const ADMIN_TABS = [
  'Organizations',
  'Users & RBAC',
  'Vehicles',
  'Drivers',
  'Subscriptions',
  'AI Predictions',
  'Model Monitoring',
  'Alerts',
  'Audit Logs',
  'System Settings',
] as const

type AdminTab = (typeof ADMIN_TABS)[number]

export default function AdminConsole() {
  const navigate = useNavigate()
  const {
    environment,
    organizations,
    activeOrganization,
    activeRole,
    setActiveOrganizationId,
    createOrganization,
    members,
    inviteMember,
    updateMemberRole,
    vehicles,
    drivers,
    predictions,
    alerts,
    auditLogs,
    settings,
    updateSettings,
  } = useFleet()

  const [tab, setTab] = useState<AdminTab>('Organizations')
  const [orgModalOpen, setOrgModalOpen] = useState(false)
  const [newOrg, setNewOrg] = useState({ name: '', city: 'Chennai', state: 'Tamil Nadu' })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    role: 'fleet_manager' as OrganizationRole,
  })

  const canCreateOrg = canPerformAction(activeRole, 'create_organization')
  const canManageMembers = canPerformAction(activeRole, 'manage_members')
  const canUpdateGlobal = canPerformAction(activeRole, 'update_global_settings')

  const validPreds = predictions.filter((p) => !p.insufficientData)
  const avgConfidence =
    validPreds.length > 0
      ? Math.round((validPreds.reduce((s, p) => s + p.confidenceScore, 0) / validPreds.length) * 100)
      : 0

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrg.name.trim()) return
    try {
      createOrganization(newOrg.name.trim(), newOrg.city.trim(), newOrg.state.trim())
      setOrgModalOpen(false)
      setNewOrg({ name: '', city: 'Chennai', state: 'Tamil Nadu' })
      toast.success('Created new isolated organization tenant.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create organization.')
    }
  }

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteForm.fullName.trim() || !inviteForm.email.includes('@')) {
      toast.error('Please enter valid full name and email.')
      return
    }
    try {
      inviteMember(inviteForm.fullName.trim(), inviteForm.email.trim(), inviteForm.role)
      setInviteOpen(false)
      setInviteForm({ fullName: '', email: '', role: 'fleet_manager' })
      toast.success('Added member to active organization.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to add member.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Administration Console</h1>
          <p className="text-sm text-[#7D6D5F] mt-1">
            {activeOrganization.name} · Environment {environment.toUpperCase()} · Multi-tenant governance & audit controls
          </p>
        </div>
      </div>

      {/* 10 Admin Module Tabs */}
      <div className="border-b border-[#E0D4B7] overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max" role="tablist">
          {ADMIN_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t ? 'border-[#6E5696] text-[#625346]' : 'border-transparent text-[#7D6D5F] hover:text-[#625346]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'Organizations' && (
        <div className="space-y-4">
          {canCreateOrg && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setOrgModalOpen(true)} className="btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" />
                Create Organization
              </button>
            </div>
          )}
          <div className="enterprise-card overflow-hidden">
            <table className="dm-table">
              <thead>
                <tr><th>Organization</th><th>Code</th><th>Location</th><th>Plan</th><th>Limits (Veh / Drv)</th><th className="text-right">Switch</th></tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="font-semibold text-[#625346]">{org.name}</td>
                    <td className="tabular-nums text-xs">{org.code}</td>
                    <td className="text-xs text-[#7D6D5F]">{org.city}, {org.state}</td>
                    <td className="capitalize font-medium">{org.planId}</td>
                    <td className="tabular-nums text-xs">{org.vehicleLimit} / {org.driverLimit}</td>
                    <td className="text-right">
                      {org.id === activeOrganization.id ? (
                        <SeverityText severity="normal" label="Active" />
                      ) : (
                        <button type="button" onClick={() => setActiveOrganizationId(org.id)} className="btn-secondary text-xs px-3 py-1">
                          Select
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Users & RBAC' && (
        <div className="space-y-4">
          {canManageMembers && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setInviteOpen(true)} className="btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" />
                Add Member
              </button>
            </div>
          )}
          <div className="enterprise-card overflow-hidden">
            <table className="dm-table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last Active</th></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold">{m.fullName}</td>
                    <td className="text-xs">{m.email}</td>
                    <td>
                      <select
                        value={m.role}
                        disabled={!canManageMembers}
                        aria-label={`Role for ${m.fullName}`}
                        onChange={(e) => {
                          try {
                            updateMemberRole(m.id, e.target.value as OrganizationRole)
                            toast.success(`Updated role for ${m.fullName}.`)
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : 'Unable to update role.')
                          }
                        }}
                        className="dm-input py-1 text-xs w-auto disabled:opacity-60"
                      >
                        <option value="platform_admin">Platform Admin</option>
                        <option value="org_admin">Org Admin</option>
                        <option value="fleet_manager">Fleet Manager</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="finance">Finance</option>
                        <option value="driver">Driver</option>
                      </select>
                    </td>
                    <td><SeverityText severity="normal" label={m.status} /></td>
                    <td className="tabular-nums text-xs text-[#7D6D5F]">{formatDateTime(m.lastActiveAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'Vehicles' && (
        <div className="enterprise-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#625346]">{vehicles.length} Active Vehicles in {activeOrganization.name}</p>
            <p className="text-xs text-[#7D6D5F] mt-1">Manage vehicle digital twins, driver assignments, and decommissioning.</p>
          </div>
          <button type="button" onClick={() => navigate('/dashboard/fleet')} className="btn-primary text-xs">
            Open Fleet Directory
          </button>
        </div>
      )}

      {tab === 'Drivers' && (
        <div className="enterprise-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#625346]">{drivers.length} Drivers Registered</p>
            <p className="text-xs text-[#7D6D5F] mt-1">Includes onboarding approval queue and behavior event dispute resolution.</p>
          </div>
          <button type="button" onClick={() => navigate('/dashboard/drivers')} className="btn-primary text-xs">
            Open Driver Intelligence
          </button>
        </div>
      )}

      {tab === 'Subscriptions' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SUBSCRIPTION_PLANS.map((p) => (
            <div key={p.id} className="enterprise-card p-5">
              <p className="font-bold text-[#625346]">{p.name}</p>
              <p className="text-xs text-[#7D6D5F] mt-1">Limit: {p.vehicleLimit} vehicles · {p.driverLimit} drivers</p>
              <button type="button" onClick={() => navigate('/dashboard/subscription')} className="btn-secondary text-xs mt-4">
                Manage Plan
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'AI Predictions' && (
        <div className="enterprise-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#625346]">{predictions.length} Active Component Predictions</p>
            <p className="text-xs text-[#7D6D5F] mt-1">Deterministic wear model outputs with confidence intervals and delay-cost tracking.</p>
          </div>
          <button type="button" onClick={() => navigate('/dashboard/maintenance')} className="btn-primary text-xs">
            Inspect Predictions
          </button>
        </div>
      )}

      {tab === 'Model Monitoring' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="enterprise-card p-4">
            <span className="text-xs text-[#7D6D5F]">Active Model Version</span>
            <p className="text-sm font-bold text-[#625346] mt-1">{INTELLIGENCE_MODEL_VERSION}</p>
          </div>
          <div className="enterprise-card p-4">
            <span className="text-xs text-[#7D6D5F]">Mean Confidence</span>
            <p className="text-2xl font-bold text-[#6E5696] tabular-nums mt-1">{avgConfidence}%</p>
          </div>
          <div className="enterprise-card p-4">
            <span className="text-xs text-[#7D6D5F]">Open Predictions</span>
            <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1">
              {predictions.filter((p) => p.status === 'open').length}
            </p>
          </div>
          <div className="enterprise-card p-4">
            <span className="text-xs text-[#7D6D5F]">Resolved Predictions</span>
            <p className="text-2xl font-bold text-[#625346] tabular-nums mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#789A75]" />
              {predictions.filter((p) => p.status === 'resolved').length}
            </p>
          </div>
        </div>
      )}

      {tab === 'Alerts' && (
        <div className="enterprise-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[#625346]">{alerts.length} Organization Alerts</p>
            <p className="text-xs text-[#7D6D5F] mt-1">{alerts.filter((a) => !a.acknowledged).length} awaiting acknowledgement.</p>
          </div>
          <button type="button" onClick={() => navigate('/dashboard/alerts')} className="btn-primary text-xs">
            Open Alerts Feed
          </button>
        </div>
      )}

      {tab === 'Audit Logs' && (
        <div className="enterprise-card overflow-hidden">
          <table className="dm-table">
            <thead>
              <tr><th>Actor</th><th>Role</th><th>Action</th><th>Summary</th><th>Timestamp</th></tr>
            </thead>
            <tbody>
              {auditLogs.map((l) => (
                <tr key={l.id}>
                  <td className="font-semibold">{l.actorName}</td>
                  <td className="text-xs capitalize text-[#7D6D5F]">{l.actorRole.replace('_', ' ')}</td>
                  <td className="text-xs">{l.action}</td>
                  <td className="text-xs text-[#625346]">{l.summary}</td>
                  <td className="tabular-nums text-xs text-[#7D6D5F]">{formatDateTime(l.timestamp, activeOrganization.timezone)}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr><td colSpan={5} className="text-center text-[#7D6D5F] py-8">No audit logs recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'System Settings' && (
        <div className="enterprise-card p-6 space-y-4 max-w-xl">
          <h2 className="dm-card-title">Global Threshold Defaults</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label htmlFor="adm-conf" className="dm-label">AI Confidence Cutoff (%)</label>
              <input
                id="adm-conf"
                type="number"
                min={50}
                max={95}
                disabled={!canUpdateGlobal}
                value={settings.aiConfidenceThreshold}
                onChange={(e) => updateSettings({ aiConfidenceThreshold: Number(e.target.value) })}
                className="dm-input tabular-nums disabled:opacity-60"
              />
            </div>
            <div>
              <label htmlFor="adm-speed" className="dm-label">Highway Speed Ceiling (km/h)</label>
              <input
                id="adm-speed"
                type="number"
                min={50}
                max={120}
                disabled={!canUpdateGlobal}
                value={settings.speedCeilingKmh}
                onChange={(e) => updateSettings({ speedCeilingKmh: Number(e.target.value) })}
                className="dm-input tabular-nums disabled:opacity-60"
              />
            </div>
          </div>
          {canUpdateGlobal && (
            <button type="button" onClick={() => toast.success('System thresholds updated.')} className="btn-primary text-xs">
              Save Governance Thresholds
            </button>
          )}
        </div>
      )}

      <EnterpriseModal open={orgModalOpen} onClose={() => setOrgModalOpen(false)} title="Create Organization Tenant">
        <form onSubmit={handleCreateOrg} className="space-y-4">
          <div>
            <label htmlFor="org-name" className="dm-label">Organization Name *</label>
            <input id="org-name" required value={newOrg.name} onChange={(e) => setNewOrg((o) => ({ ...o, name: e.target.value }))} className="dm-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="org-city" className="dm-label">City</label>
              <input id="org-city" value={newOrg.city} onChange={(e) => setNewOrg((o) => ({ ...o, city: e.target.value }))} className="dm-input" />
            </div>
            <div>
              <label htmlFor="org-state" className="dm-label">State</label>
              <input id="org-state" value={newOrg.state} onChange={(e) => setNewOrg((o) => ({ ...o, state: e.target.value }))} className="dm-input" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setOrgModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Create Organization</button>
          </div>
        </form>
      </EnterpriseModal>

      <EnterpriseModal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add Organization Member">
        <form onSubmit={handleInviteMember} className="space-y-4">
          <div>
            <label htmlFor="inv-name" className="dm-label">Full Name *</label>
            <input id="inv-name" required value={inviteForm.fullName} onChange={(e) => setInviteForm((f) => ({ ...f, fullName: e.target.value }))} className="dm-input" />
          </div>
          <div>
            <label htmlFor="inv-email" className="dm-label">Email *</label>
            <input id="inv-email" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} className="dm-input" />
          </div>
          <div>
            <label htmlFor="inv-role" className="dm-label">Role</label>
            <select id="inv-role" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value as OrganizationRole }))} className="dm-input">
              <option value="fleet_manager">Fleet Manager</option>
              <option value="org_admin">Organization Admin</option>
              <option value="maintenance">Maintenance</option>
              <option value="finance">Finance</option>
              <option value="driver">Driver</option>
            </select>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setInviteOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Add Member</button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}

