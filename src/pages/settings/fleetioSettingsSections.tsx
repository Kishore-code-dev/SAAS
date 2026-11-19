import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Download,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserPlus,
  Webhook,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'
import type {
  ApiKeyEntry,
  FleetioSettingsState,
  LookupTagItem,
  OrganizationRole,
} from '../../types/fleet'
import { canPerformAction } from '../../utils/rbac'
import { formatDateTime, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'

function useFleetioConfig() {
  const { activeOrganization, fleetioSettings, updateFleetioSettings } = useFleet()
  return {
    config: fleetioSettings,
    updateConfig: updateFleetioSettings,
    orgId: activeOrganization.id,
  }
}

function LookupManagerCard({
  title,
  subtitle,
  fieldKey,
  allowColor = false,
}: {
  title: string
  subtitle: string
  fieldKey: keyof Pick<
    FleetioSettingsState,
    | 'vehicleStatuses'
    | 'vehicleTypes'
    | 'issuePriorities'
    | 'workOrderStatuses'
    | 'repairReasonCodes'
    | 'partLocations'
    | 'partCategories'
    | 'fuelTypes'
    | 'labels'
  >
  allowColor?: boolean
}) {
  const { activeRole } = useFleet()
  const { config, updateConfig } = useFleetioConfig()
  const canEdit = canPerformAction(activeRole, 'update_org_settings')
  const items = config[fieldKey]
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#1F7A4C')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEdit) {
      toast.error('Your role cannot modify organization lookup lists.')
      return
    }
    if (!name.trim()) {
      toast.error('Enter a name first.')
      return
    }
    const nextItem: LookupTagItem = {
      id: `${fieldKey}-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      color: allowColor ? color : undefined,
      active: true,
    }
    updateConfig({ [fieldKey]: [...items, nextItem] } as Partial<FleetioSettingsState>)
    setName('')
    setDescription('')
    toast.success(`Added "${nextItem.name}" to ${title}.`)
  }

  const toggleItem = (id: string) => {
    if (!canEdit) return
    const next = items.map((item) => (item.id === id ? { ...item, active: !item.active } : item))
    updateConfig({ [fieldKey]: next } as Partial<FleetioSettingsState>)
    toast.success(`Updated ${title}.`)
  }

  const removeItem = (id: string) => {
    if (!canEdit) return
    const next = items.filter((item) => item.id !== id)
    updateConfig({ [fieldKey]: next } as Partial<FleetioSettingsState>)
    toast.success(`Removed item from ${title}.`)
  }

  return (
    <div className="enterprise-card p-6 space-y-5">
      <div>
        <h2 className="dm-card-title">{title}</h2>
        <p className="text-xs text-[#958777] mt-1">{subtitle}</p>
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          <div className={allowColor ? 'sm:col-span-4' : 'sm:col-span-5'}>
            <label className="dm-label">Label / Code Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Add ${title.toLowerCase()} entry`}
              className="dm-input text-xs"
            />
          </div>
          <div className="sm:col-span-5">
            <label className="dm-label">Operational Notes (Optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Usage criteria or SLA guideline"
              className="dm-input text-xs"
            />
          </div>
          {allowColor && (
            <div className="sm:col-span-1">
              <label className="dm-label">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-full rounded-[8px] border border-[#E5E5E5] bg-white p-1 cursor-pointer"
              />
            </div>
          )}
          <div className={allowColor ? 'sm:col-span-2' : 'sm:col-span-2'}>
            <button type="submit" className="btn-primary text-xs w-full justify-center">
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </form>
      )}

      <div className="divide-y divide-[#E5E5E5]">
        {items.map((item) => (
          <div key={item.id} className="py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {item.color && (
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${item.active ? 'text-[#625346]' : 'text-[#958777] line-through'}`}>
                  {item.name}
                </p>
                {item.description && <p className="text-xs text-[#958777] truncate">{item.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => toggleItem(item.id)}
                className={`px-2.5 py-1 rounded-[6px] text-[11px] font-semibold border transition-colors ${
                  item.active
                    ? 'bg-[#E8F5EE] text-[#0D3B26] border-[#B7DEC9]'
                    : 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]'
                }`}
              >
                {item.active ? 'Active' : 'Disabled'}
              </button>
              {canEdit && items.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Delete ${item.name}`}
                  className="p-1.5 rounded-[6px] text-[#958777] hover:text-[#B84E42] hover:bg-[#B84E42]/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StaticCodeDirectoryCard({
  title,
  subtitle,
  rows,
}: {
  title: string
  subtitle: string
  rows: Array<{ code: string; name: string; scope: string; status: string }>
}) {
  return (
    <div className="enterprise-card overflow-hidden">
      <div className="p-5 border-b border-[#E5E5E5]">
        <h2 className="dm-card-title">{title}</h2>
        <p className="text-xs text-[#958777] mt-1">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Scope</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td className="font-mono text-xs font-bold text-[#0D3B26]">{r.code}</td>
                <td className="font-semibold">{r.name}</td>
                <td className="text-xs text-[#958777]">{r.scope}</td>
                <td>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#E8F5EE] text-[#0D3B26]">
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ProfileSection() {
  const { user } = useAuth()
  const { activeOrganization, activeRole } = useFleet()
  return (
    <div className="enterprise-card p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="dm-card-title">User Profile</h2>
          <p className="text-xs text-[#958777] mt-1">Authenticated operator identity and workspace assignment</p>
        </div>
        <span className="px-2.5 py-1 rounded-[6px] text-[11px] font-bold uppercase tracking-wider bg-[#E8F5EE] text-[#0D3B26]">
          {activeRole.replace('_', ' ')}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="p-3.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#958777]">Full Name</p>
          <p className="font-bold text-[#625346] mt-1">{user?.fullName ?? 'Fleet Operator'}</p>
        </div>
        <div className="p-3.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#958777]">Username</p>
          <p className="font-mono font-semibold text-[#625346] mt-1">{user?.username ?? 'workspace.user'}</p>
        </div>
        <div className="p-3.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#958777]">Email</p>
          <p className="font-semibold text-[#625346] mt-1">{user?.email ?? 'operations@drivemitra.in'}</p>
        </div>
        <div className="p-3.5 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#958777]">Active Organization</p>
          <p className="font-semibold text-[#625346] mt-1">
            {activeOrganization.name} ({activeOrganization.city})
          </p>
        </div>
      </div>
    </div>
  )
}

export function CustomDashboardsSection() {
  const navigate = useNavigate()
  const { customDashboards, addCustomDashboard } = useFleet()
  const [name, setName] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await addCustomDashboard(name.trim(), 'Fleet KPI Summary, Alerts Feed')
    setName('')
    toast.success('Custom dashboard layout saved.')
  }

  return (
    <div className="enterprise-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dm-card-title">Custom Dashboards</h2>
          <p className="text-xs text-[#958777] mt-1">Configure tailored KPI views for dispatchers, workshop leads, and finance</p>
        </div>
        <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary text-xs">
          Open Dashboard <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New custom dashboard name..."
          className="dm-input text-xs flex-1"
        />
        <button type="submit" className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" />
          Create Layout
        </button>
      </form>
      <div className="divide-y divide-[#E5E5E5]">
        {customDashboards.map((d) => (
          <div key={d.id} className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#625346]">{d.name}</p>
              <p className="text-xs text-[#958777]">{d.widgets}</p>
            </div>
            {d.defaultView && (
              <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#E8F5EE] text-[#0D3B26]">Default</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SavedViewsSection({ scope }: { scope: 'personal' | 'org' }) {
  const navigate = useNavigate()
  const views = [
    { id: 'sv-1', name: 'Vehicles Due for Service (Next 14 Days)', module: 'Service Reminders', route: '/dashboard/reminders/service' },
    { id: 'sv-2', name: 'Critical & High Priority Open Issues', module: 'Issues', route: '/dashboard/issues' },
    { id: 'sv-3', name: 'Low Stock Workshop Spares', module: 'Parts & Inventory', route: '/dashboard/inventory' },
    { id: 'sv-4', name: 'EV Fleet Charging Sessions', module: 'Fuel & Energy', route: '/dashboard/fuel/charging' },
  ]
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div>
        <h2 className="dm-card-title">{scope === 'personal' ? 'My Saved Views' : 'Organization Saved Views'}</h2>
        <p className="text-xs text-[#958777] mt-1">Pre-filtered operational table presets shared across fleet teams</p>
      </div>
      <div className="divide-y divide-[#E5E5E5]">
        {views.map((v) => (
          <div key={v.id} className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#625346]">{v.name}</p>
              <p className="text-xs text-[#958777]">{v.module}</p>
            </div>
            <button type="button" onClick={() => navigate(v.route)} className="btn-secondary text-xs">
              Open View <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoginPasswordSection() {
  const { changePassword } = useAuth()
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    setSaving(true)
    const res = await changePassword(currentPw, newPw)
    setSaving(false)
    if (res.error) {
      toast.error(res.error.message)
      return
    }
    setCurrentPw('')
    setNewPw('')
    toast.success('Password updated successfully.')
  }

  return (
    <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-[#0D3B26]" />
        <h2 className="dm-card-title">Login & Password</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pw-current" className="dm-label">Current Password</label>
          <input
            id="pw-current"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            required
            className="dm-input"
          />
        </div>
        <div>
          <label htmlFor="pw-new" className="dm-label">New Password (min 8 chars)</label>
          <input
            id="pw-new"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            required
            className="dm-input"
          />
        </div>
      </div>
      <button type="submit" disabled={saving} className="btn-primary text-xs">
        <Save className="w-3.5 h-3.5" />
        {saving ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  )
}

export function AppearanceSection() {
  const { config, updateConfig } = useFleetioConfig()
  return (
    <div className="enterprise-card p-6 space-y-5">
      <div>
        <h2 className="dm-card-title">Appearance & Theme</h2>
        <p className="text-xs text-[#958777] mt-1">Customize navigation styling, table density, and measurement display preferences</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <label className="dm-label">Sidebar Accent Theme</label>
          <select
            value={config.appearanceTheme}
            onChange={(e) => {
              updateConfig({ appearanceTheme: e.target.value as FleetioSettingsState['appearanceTheme'] })
              toast.success('Appearance theme saved.')
            }}
            className="dm-input text-xs"
          >
            <option value="fleetio_forest">Fleetio Forest Green (#0D3B26)</option>
            <option value="lavender_enterprise">DriveMitra Enterprise Neutral</option>
          </select>
        </div>
        <div>
          <label className="dm-label">Distance Measurement Unit</label>
          <select
            value={config.defaultDistanceUnit}
            onChange={(e) => {
              updateConfig({ defaultDistanceUnit: e.target.value as 'km' | 'mi' })
              toast.success('Distance unit updated.')
            }}
            className="dm-input text-xs"
          >
            <option value="km">Kilometers (km)</option>
            <option value="mi">Miles (mi)</option>
          </select>
        </div>
      </div>
      <label className="flex items-center justify-between gap-4 cursor-pointer text-sm">
        <div>
          <span className="font-medium text-[#625346] block">Compact Data Table Density</span>
          <span className="text-xs text-[#958777]">Reduce row padding in Vehicles, Work Orders, and Parts tables</span>
        </div>
        <input
          type="checkbox"
          checked={config.compactDensity}
          onChange={(e) => {
            updateConfig({ compactDensity: e.target.checked })
            toast.success('Density preference saved.')
          }}
          className="w-4 h-4 accent-[#1E7A48]"
        />
      </label>
    </div>
  )
}

export function ApiKeysSection() {
  const { apiKeys, createApiKey, revokeApiKey } = useFleet()
  const [label, setLabel] = useState('')
  const [scope, setScope] = useState<ApiKeyEntry['scope']>('read_only')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) return
    await createApiKey(label.trim(), scope)
    setLabel('')
    toast.success('API key generated.')
  }

  return (
    <div className="enterprise-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-[#0D3B26]" />
        <h2 className="dm-card-title">Manage API Keys</h2>
      </div>
      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
        <div className="sm:col-span-6">
          <label className="dm-label">Key Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ERP Sync Token" className="dm-input text-xs" />
        </div>
        <div className="sm:col-span-4">
          <label className="dm-label">Scope</label>
          <select value={scope} onChange={(e) => setScope(e.target.value as ApiKeyEntry['scope'])} className="dm-input text-xs">
            <option value="read_only">Read Only</option>
            <option value="read_write">Read &amp; Write</option>
            <option value="telematics_ingest">Telematics Ingest</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" className="btn-primary text-xs w-full justify-center">Generate</button>
        </div>
      </form>
      <div className="divide-y divide-[#E5E5E5]">
        {apiKeys.map((k) => (
          <div key={k.id} className="py-3 flex items-center justify-between gap-4 text-xs">
            <div>
              <p className="font-semibold text-[#625346] text-sm">{k.label}</p>
              <p className="font-mono text-[#958777]">{k.prefix} · {k.scope.replace('_', ' ')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void revokeApiKey(k.id)
                toast.success('API key revoked.')
              }}
              className="btn-secondary text-xs text-[#B84E42]"
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function BillingSettingsSection() {
  const { activeOrganization } = useFleet()
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="dm-card-title">Billing & Subscriptions</h2>
          <p className="text-xs text-[#958777] mt-1">
            Current tier: <span className="font-bold uppercase text-[#0D3B26]">{activeOrganization.planId}</span> · Seat limit {activeOrganization.vehicleLimit} vehicles
          </p>
        </div>
        <Link to="/dashboard/subscription" className="btn-primary text-xs">
          Manage Subscription <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <p className="text-xs text-[#958777]">
        Open Subscription &amp; Plan Management to upgrade fleet capacity, download GST invoices, or adjust billing cycles.
      </p>
    </div>
  )
}

export function ExportDataSection() {
  const { activeOrganization, vehicles, drivers, workOrders, fuelTransactions, partsInventory } = useFleet()

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      organization: activeOrganization,
      counts: {
        vehicles: vehicles.length,
        drivers: drivers.length,
        workOrders: workOrders.length,
        fuelTransactions: fuelTransactions.length,
        partsInventory: partsInventory.length,
      },
      vehicles,
      drivers,
      workOrders,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeOrganization.code.toLowerCase()}-account-export.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Downloaded full organization JSON snapshot.')
  }

  return (
    <div className="enterprise-card p-6 space-y-4">
      <h2 className="dm-card-title">Export Account Data</h2>
      <p className="text-xs text-[#958777]">
        Download a structured archive of {activeOrganization.name} vehicles ({vehicles.length}), drivers ({drivers.length}), work orders ({workOrders.length}), and inventory SKUs ({partsInventory.length}).
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleExportJson} className="btn-primary text-xs">
          <Download className="w-3.5 h-3.5" />
          Download JSON Snapshot
        </button>
        <Link to="/dashboard/reports" className="btn-secondary text-xs">
          Open CSV / Excel Reports
        </Link>
      </div>
    </div>
  )
}

export function SandboxesSection() {
  const { environment, activeOrganization } = useFleet()
  return (
    <div className="enterprise-card p-6 space-y-4">
      <h2 className="dm-card-title">Sandboxes</h2>
      <p className="text-xs text-[#958777]">
        Active runtime environment: <span className="font-bold uppercase text-[#0D3B26]">{environment}</span> for {activeOrganization.name}.
      </p>
      <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] text-xs space-y-1">
        <p className="font-semibold text-[#625346]">Isolated Telemetry Sandbox</p>
        <p className="text-[#958777]">Test rule automations, work order workflows, and predictive maintenance thresholds safely before production rollout.</p>
      </div>
    </div>
  )
}

export function ManageUsersSection() {
  const { activeOrganization, activeRole, members, inviteMember, updateMemberRole } = useFleet()
  const canManage = canPerformAction(activeRole, 'manage_members')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrganizationRole>('fleet_manager')
  const [busy, setBusy] = useState(false)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim()) return
    setBusy(true)
    try {
      const res = await inviteMember(fullName.trim(), email.trim(), role)
      setFullName('')
      setEmail('')
      if (res.temporaryCredentials) {
        toast.success(`Invited ${res.temporaryCredentials.username} (temp password generated).`)
      } else {
        toast.success('Member invited to organization.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to invite member.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="enterprise-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="dm-card-title">Manage Users ({members.length})</h2>
            <p className="text-xs text-[#958777] mt-1">{activeOrganization.name} · Role assignments and active operator seats</p>
          </div>
          <Link to="/dashboard/admin" className="btn-secondary text-xs">
            Full Admin Console <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {canManage && (
          <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-2">
            <div className="sm:col-span-4">
              <label className="dm-label">Full Name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Arjun Nair" className="dm-input text-xs" />
            </div>
            <div className="sm:col-span-4">
              <label className="dm-label">Work Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="arjun@fleet.in" className="dm-input text-xs" />
            </div>
            <div className="sm:col-span-2">
              <label className="dm-label">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as OrganizationRole)} className="dm-input text-xs">
                <option value="fleet_manager">Fleet Manager</option>
                <option value="maintenance">Maintenance</option>
                <option value="finance">Finance</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary text-xs w-full justify-center">
                <UserPlus className="w-3.5 h-3.5" />
                Invite
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="enterprise-card overflow-hidden">
        <table className="dm-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td className="font-semibold">{m.fullName}</td>
                <td className="text-xs text-[#958777]">{m.email}</td>
                <td>
                  {canManage ? (
                    <select
                      value={m.role}
                      onChange={(e) => {
                        updateMemberRole(m.id, e.target.value as OrganizationRole)
                        toast.success(`Updated role for ${m.fullName}.`)
                      }}
                      className="dm-input py-1 text-xs w-auto"
                    >
                      <option value="org_admin">Org Admin</option>
                      <option value="fleet_manager">Fleet Manager</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="finance">Finance</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="text-xs capitalize">{m.role.replace('_', ' ')}</span>
                  )}
                </td>
                <td>
                  <span className="px-2 py-0.5 rounded-[6px] text-[11px] font-semibold bg-[#E8F5EE] text-[#0D3B26] capitalize">
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function SecuritySection() {
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#0D3B26]" />
        <h2 className="dm-card-title">Security & Session Controls</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] space-y-1">
          <p className="font-bold text-[#625346]">HTTP-Only Session Cookies</p>
          <p className="text-[#958777]">SameSite protected session cookies enforced across all API routes.</p>
        </div>
        <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] space-y-1">
          <p className="font-bold text-[#625346]">Mandatory First-Login Rotation</p>
          <p className="text-[#958777]">Invited accounts must rotate temporary passwords before accessing fleet data.</p>
        </div>
      </div>
    </div>
  )
}

export function RolesSection() {
  const roles = [
    { role: 'Org Admin', scope: 'Full organization control, user management, billing, and global settings' },
    { role: 'Fleet Manager', scope: 'Vehicles, drivers, trips, inspections, issues, work orders, and reports' },
    { role: 'Maintenance', scope: 'Service history, work orders, parts inventory, workshops, and inspections' },
    { role: 'Finance', scope: 'Fuel logs, invoices, TCO analytics, subscription billing, and exports' },
    { role: 'Viewer', scope: 'Read-only access to fleet dashboards and standard report previews' },
  ]
  return (
    <div className="enterprise-card p-6 space-y-4">
      <h2 className="dm-card-title">Roles & RBAC Matrix</h2>
      <div className="divide-y divide-[#E5E5E5]">
        {roles.map((r) => (
          <div key={r.role} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-sm font-bold text-[#0D3B26]">{r.role}</span>
            <span className="text-xs text-[#958777]">{r.scope}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AiAdvisorSection() {
  const { activeRole, settings, updateSettings } = useFleet()
  const canEditGlobal = canPerformAction(activeRole, 'update_global_settings')
  return (
    <div className="enterprise-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-[#0D3B26]" />
          <h2 className="dm-card-title">AI Service Advisor & Dhiyu Calibration</h2>
        </div>
        {!canEditGlobal && (
          <span className="text-xs text-[#6E5696] font-medium">Admin approval required for global changes</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="dm-label">AI Confidence Threshold (%)</label>
          <input
            type="number"
            min={50}
            max={98}
            disabled={!canEditGlobal}
            value={settings.aiConfidenceThreshold}
            onChange={(e) => updateSettings({ aiConfidenceThreshold: Number(e.target.value) })}
            className="dm-input tabular-nums"
          />
        </div>
        <div>
          <label className="dm-label">Low Health Alert Cutoff (%)</label>
          <input
            type="number"
            min={20}
            max={90}
            disabled={!canEditGlobal}
            value={settings.lowHealthAlertCutoff}
            onChange={(e) => updateSettings({ lowHealthAlertCutoff: Number(e.target.value) })}
            className="dm-input tabular-nums"
          />
        </div>
        <div>
          <label className="dm-label">Corridor Speed Ceiling (km/h)</label>
          <input
            type="number"
            min={40}
            max={120}
            disabled={!canEditGlobal}
            value={settings.speedCeilingKmh}
            onChange={(e) => updateSettings({ speedCeilingKmh: Number(e.target.value) })}
            className="dm-input tabular-nums"
          />
        </div>
      </div>
    </div>
  )
}

export function WebhooksSection() {
  const { webhooks, addWebhook, toggleWebhook } = useFleet()
  const [url, setUrl] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim().startsWith('http')) {
      toast.error('Enter a valid https:// webhook URL.')
      return
    }
    await addWebhook(url.trim(), ['vehicle.alert', 'work_order.updated'])
    setUrl('')
    toast.success('Webhook endpoint registered.')
  }

  return (
    <div className="enterprise-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Webhook className="w-4 h-4 text-[#0D3B26]" />
        <h2 className="dm-card-title">Webhooks</h2>
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.company.in/drivemitra"
          className="dm-input text-xs flex-1"
        />
        <button type="submit" className="btn-primary text-xs">
          <Plus className="w-3.5 h-3.5" />
          Add Endpoint
        </button>
      </form>
      <div className="divide-y divide-[#E5E5E5]">
        {webhooks.map((h) => (
          <div key={h.id} className="py-3 flex items-center justify-between gap-4 text-xs">
            <div>
              <p className="font-mono font-semibold text-[#625346]">{h.url}</p>
              <p className="text-[#958777]">{h.events.join(', ')} · HTTP {h.lastDeliveryStatus}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                void toggleWebhook(h.id, !h.active)
              }}
              className={`px-2.5 py-1 rounded-[6px] font-semibold ${
                h.active ? 'bg-[#E8F5EE] text-[#0D3B26]' : 'bg-[#FAFAFA] text-[#958777]'
              }`}
            >
              {h.active ? 'Active' : 'Paused'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function FleetMcpSection() {
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dm-card-title">Fleet MCP (Model Context Protocol)</h2>
          <p className="text-xs text-[#958777] mt-1">Read-only operational schema &amp; tool bindings for automated fleet workflows</p>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F5EE] text-[#0D3B26]">New</span>
      </div>
      <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] font-mono text-xs text-[#625346] space-y-1.5">
        <p>Endpoint: /api/mcp/fleet-context (Authenticated Organization Scope)</p>
        <p>Tools: list_vehicles · get_predictive_risks · create_work_order_draft · query_tco_summary</p>
      </div>
    </div>
  )
}

export function FleetioRuleSettingsCard({
  mode,
}: {
  mode: 'expense' | 'inspection' | 'faults' | 'reminders' | 'maintenance' | 'fuel'
}) {
  const { config, updateConfig } = useFleetioConfig()
  return (
    <div className="enterprise-card p-6 space-y-5 text-sm">
      <h2 className="dm-card-title">
        {mode === 'expense' && 'Expense & Cost Allocation Settings'}
        {mode === 'inspection' && 'Inspection Policy & Sign-off Settings'}
        {mode === 'faults' && 'Fault Escalation Rules'}
        {mode === 'reminders' && 'Service Reminder Lead Windows'}
        {mode === 'maintenance' && 'Maintenance & Work Order Policies'}
        {mode === 'fuel' && 'Fuel & EV Energy Calibration'}
      </h2>

      {mode === 'expense' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="dm-label">Reporting Currency</label>
            <input value="INR (₹)" readOnly className="dm-input bg-[#FAFAFA]" />
          </div>
          <div>
            <label className="dm-label">Fiscal Year Start</label>
            <select
              value={config.fiscalYearStart}
              onChange={(e) => {
                updateConfig({ fiscalYearStart: e.target.value as 'April' | 'January' })
                toast.success('Fiscal year preference updated.')
              }}
              className="dm-input"
            >
              <option value="April">April (India FY)</option>
              <option value="January">January (Calendar Year)</option>
            </select>
          </div>
        </div>
      )}

      {mode === 'inspection' && (
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <span className="font-medium text-[#625346] block">Require Digital Inspector Sign-off</span>
            <span className="text-xs text-[#958777]">Enforce named inspector confirmation on pre-trip &amp; post-trip vehicle checklists</span>
          </div>
          <input
            type="checkbox"
            checked={config.requireInspectionSignature}
            onChange={(e) => {
              updateConfig({ requireInspectionSignature: e.target.checked })
              toast.success('Inspection policy saved.')
            }}
            className="w-4 h-4 accent-[#1E7A48]"
          />
        </label>
      )}

      {mode === 'faults' && (
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4 cursor-pointer">
            <div>
              <span className="font-medium text-[#625346] block">Auto-Escalate Critical Faults to Work Orders</span>
              <span className="text-xs text-[#958777]">Flag critical engine, brake, or EV thermal faults for immediate workshop intake</span>
            </div>
            <input
              type="checkbox"
              checked={config.autoCreateWoFromCriticalIssue}
              onChange={(e) => {
                updateConfig({ autoCreateWoFromCriticalIssue: e.target.checked })
                toast.success('Fault escalation rule saved.')
              }}
              className="w-4 h-4 accent-[#1E7A48]"
            />
          </label>
          <div className="max-w-xs text-xs">
            <label className="dm-label">Minimum DTC Escalation Severity</label>
            <select
              value={config.faultSeverityThreshold}
              onChange={(e) => {
                updateConfig({ faultSeverityThreshold: e.target.value as FleetioSettingsState['faultSeverityThreshold'] })
                toast.success('Severity threshold saved.')
              }}
              className="dm-input"
            >
              <option value="all">All Fault Codes</option>
              <option value="high_only">High &amp; Critical Only</option>
              <option value="critical_only">Critical Only</option>
            </select>
          </div>
        </div>
      )}

      {mode === 'reminders' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="dm-label">Due Soon Lead Days</label>
            <input
              type="number"
              min={1}
              max={90}
              value={config.serviceReminderLeadDays}
              onChange={(e) => updateConfig({ serviceReminderLeadDays: Number(e.target.value) })}
              className="dm-input tabular-nums"
            />
          </div>
          <div>
            <label className="dm-label">Due Soon Meter Lead (km)</label>
            <input
              type="number"
              min={100}
              max={10000}
              value={config.serviceReminderLeadKm}
              onChange={(e) => updateConfig({ serviceReminderLeadKm: Number(e.target.value) })}
              className="dm-input tabular-nums"
            />
          </div>
        </div>
      )}

      {mode === 'maintenance' && (
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div>
            <span className="font-medium text-[#625346] block">Enforce Corridor Geofence Alerts During Workshop Transfers</span>
            <span className="text-xs text-[#958777]">Notify dispatch when a vehicle in shop moves outside depot perimeter</span>
          </div>
          <input
            type="checkbox"
            checked={config.enforceGeofenceAlerts}
            onChange={(e) => {
              updateConfig({ enforceGeofenceAlerts: e.target.checked })
              toast.success('Maintenance policy saved.')
            }}
            className="w-4 h-4 accent-[#1E7A48]"
          />
        </label>
      )}

      {mode === 'fuel' && (
        <div className="max-w-xs text-xs">
          <label className="dm-label">Default Liquid Fuel Volume Unit</label>
          <select
            value={config.defaultFuelUnit}
            onChange={(e) => {
              updateConfig({ defaultFuelUnit: e.target.value as 'liters' | 'gallons' })
              toast.success('Fuel unit preference saved.')
            }}
            className="dm-input"
          >
            <option value="liters">Liters (L) / kWh</option>
            <option value="gallons">Gallons (gal) / kWh</option>
          </select>
        </div>
      )}
    </div>
  )
}

export function SavedReportsSettingsSection() {
  const { reports, activeOrganization } = useFleet()
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dm-card-title">Saved &amp; Generated Reports ({reports.length})</h2>
          <p className="text-xs text-[#958777] mt-1">Recent standardized report runs for {activeOrganization.name}</p>
        </div>
        <Link to="/dashboard/reports" className="btn-primary text-xs">
          Open Reports Hub <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="divide-y divide-[#E5E5E5] text-xs">
        {reports.map((r) => (
          <div key={r.id} className="py-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[#625346] text-sm">{r.title}</p>
              <p className="text-[#958777]">{r.format} · {r.rowCount} rows · {r.generatedBy}</p>
            </div>
            <span className="text-[#958777] tabular-nums">{formatDateTime(r.generatedAt, activeOrganization.timezone)}</span>
          </div>
        ))}
        {reports.length === 0 && <p className="text-[#958777] py-4">No saved reports generated yet in this organization.</p>}
      </div>
    </div>
  )
}

export function VehicleStatusesSection() {
  return (
    <LookupManagerCard
      title="Vehicle Statuses"
      subtitle="Lifecycle status tags available on vehicle records and fleet filters"
      fieldKey="vehicleStatuses"
      allowColor
    />
  )
}

export function VehicleTypesSection() {
  return (
    <LookupManagerCard
      title="Vehicle Types"
      subtitle="Commercial body and tonnage categories across your fleet"
      fieldKey="vehicleTypes"
    />
  )
}

export function IssuePrioritiesSection() {
  return (
    <LookupManagerCard
      title="Issue Priorities"
      subtitle="Priority levels for reported defects and inspection failures"
      fieldKey="issuePriorities"
      allowColor
    />
  )
}

export function WorkOrderStatusesSection() {
  return (
    <LookupManagerCard
      title="Work Order Statuses"
      subtitle="Workflow states from Draft intake through Completed workshop sign-off"
      fieldKey="workOrderStatuses"
      allowColor
    />
  )
}

export function RepairReasonCodesSection() {
  return (
    <LookupManagerCard
      title="Reason for Repair Codes"
      subtitle="Categorize corrective vs preventive vs road-impact repair expenditures"
      fieldKey="repairReasonCodes"
    />
  )
}

export function PartLocationsSection() {
  return (
    <LookupManagerCard
      title="Part Locations"
      subtitle="Depot warehouses, mobile vans, and bay stockrooms"
      fieldKey="partLocations"
    />
  )
}

export function PartCategoriesSection() {
  return (
    <LookupManagerCard
      title="Part Categories"
      subtitle="5-Area scope categories used across spares and work order billing"
      fieldKey="partCategories"
    />
  )
}

export function FuelTypesSection() {
  return (
    <LookupManagerCard
      title="Fuel & Energy Types"
      subtitle="Supported diesel, EV, CNG, and petrol energy classifications"
      fieldKey="fuelTypes"
    />
  )
}

export function LabelsSection() {
  return (
    <LookupManagerCard
      title="Labels"
      subtitle="Cross-module tags for routes, cold-chain assets, and EV pilot cohorts"
      fieldKey="labels"
      allowColor
    />
  )
}

export function RecordSetsSection() {
  const { corridors, vehicles } = useFleet()
  return (
    <StaticCodeDirectoryCard
      title="Record Sets & Corridor Scopes"
      subtitle="Regional visibility boundaries assigned to fleet managers and dispatchers"
      rows={corridors.map((c) => ({
        code: c.id.toUpperCase(),
        name: c.name,
        scope: `${vehicles.filter((v) => v.corridorId === c.id).length} vehicles`,
        status: 'Active',
      }))}
    />
  )
}

export function IntegrationsDirSection({ mode }: { mode: 'directory' | 'links' | 'connections' | 'saml' }) {
  const navigate = useNavigate()
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="dm-card-title">
            {mode === 'directory' && 'Integrations Directory'}
            {mode === 'links' && 'Integration Links'}
            {mode === 'connections' && 'External Telematics Connections'}
            {mode === 'saml' && 'SAML 2.0 SSO Connectors'}
          </h2>
          <p className="text-xs text-[#958777] mt-1">
            Connected GPS, Google Maps Truck Routing, Open-Meteo weather telemetry, and enterprise identity feeds
          </p>
        </div>
        <button type="button" onClick={() => navigate('/dashboard/integrations')} className="btn-primary text-xs">
          Open Integrations Hub <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <p className="font-bold text-[#625346]">Smartphone GPS &amp; Accelerometer Feed</p>
            <p className="text-[#958777]">Live 15s polling · Active</p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-[#1E7A48]" />
        </div>
        <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <p className="font-bold text-[#625346]">
              {mode === 'saml' ? 'Okta / Azure AD SAML 2.0' : 'Google Maps Corridor Routing'}
            </p>
            <p className="text-[#958777]">{mode === 'saml' ? 'Enterprise SSO ready' : 'Corridor geometry active'}</p>
          </div>
          <RefreshCw className="w-4 h-4 text-[#6E5696]" />
        </div>
      </div>
    </div>
  )
}

export function StandardRecordsSection() {
  const { vehicles, drivers, workOrders, partsInventory, inspections } = useFleet()
  return (
    <StaticCodeDirectoryCard
      title="Standard Fleet Records"
      subtitle="Core data entities synced across DriveMitra SQLite and analytical engines"
      rows={[
        { code: 'VEH', name: 'Vehicles', scope: `${vehicles.length} active assets`, status: 'Synced' },
        { code: 'DRV', name: 'Contacts / Drivers', scope: `${drivers.length} operators`, status: 'Synced' },
        { code: 'INS', name: 'Inspections', scope: `${inspections.length} checklists`, status: 'Synced' },
        { code: 'WO', name: 'Work Orders', scope: `${workOrders.length} jobs`, status: 'Synced' },
        { code: 'PRT', name: 'Parts & Inventory', scope: `${partsInventory.length} SKUs`, status: 'Synced' },
      ]}
    />
  )
}

export function CustomRecordsSettingsSection() {
  const navigate = useNavigate()
  return (
    <div className="enterprise-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="dm-card-title">Custom Record Schemas</h2>
          <p className="text-xs text-[#958777] mt-1">Manage Toll &amp; FASTag Audits, RTO Permit Logs, and Cold-Chain Temperature records</p>
        </div>
        <button type="button" onClick={() => navigate('/dashboard/custom-records')} className="btn-primary text-xs">
          Open Custom Records <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function GroupsSubgroupsSection() {
  const { corridors, vehicles } = useFleet()
  return (
    <StaticCodeDirectoryCard
      title="Groups & Subgroups (Regional Corridors)"
      subtitle="Operational hub groupings for vehicles, work orders, and cost rollups"
      rows={corridors.map((c) => ({
        code: c.id.toUpperCase(),
        name: c.name,
        scope: `${c.region} (${vehicles.filter((v) => v.corridorId === c.id).length} vehicles)`,
        status: 'Active',
      }))}
    />
  )
}

export function CustomWidgetsSection() {
  return (
    <StaticCodeDirectoryCard
      title="Dashboard Custom Widgets"
      subtitle="Widgets enabled on the main executive fleet dashboard"
      rows={[
        { code: 'W-01', name: '5-Area Health Scorecards', scope: 'Engine, Tyre, Vehicle, Fuel, Driver', status: 'Visible' },
        { code: 'W-02', name: 'Predictive Repair Savings', scope: 'INR Cost Avoidance', status: 'Visible' },
        { code: 'W-03', name: 'Corridor Risk Heatmap', scope: 'Live Weather & Road Stress', status: 'Visible' },
      ]}
    />
  )
}

export function ExternalVehicleIdsSection() {
  const { vehicles } = useFleet()
  return (
    <StaticCodeDirectoryCard
      title="External Vehicle IDs (FASTag / Vahan / Telematics IMEI)"
      subtitle="Cross-system identifiers mapped to your active vehicles"
      rows={vehicles.slice(0, 8).map((v) => ({
        code: v.registrationNumber,
        name: `${v.make} ${v.model}`,
        scope: `IMEI-${v.id.slice(-4).toUpperCase()}-GPS`,
        status: v.telemetry.connectionState === 'connected' ? 'Linked' : 'Standby',
      }))}
    />
  )
}

export function ExpenseTypesSection() {
  return (
    <StaticCodeDirectoryCard
      title="Expense Types"
      subtitle="Financial expense classifications tracked in Expense History & Financials"
      rows={[
        { code: 'EXP-FUEL', name: 'Diesel / EV Charging', scope: 'Fuel & Energy', status: 'Active' },
        { code: 'EXP-MAINT', name: 'Work Order & Preventive Service', scope: 'Service', status: 'Active' },
        { code: 'EXP-TOLL', name: 'FASTag & Highway Toll', scope: 'Custom Records', status: 'Active' },
        { code: 'EXP-COMP', name: 'Insurance, Permit & Fitness Fee', scope: 'Compliance', status: 'Active' },
      ]}
    />
  )
}

export function RenewalTypesSection({ target }: { target: 'vehicle' | 'contact' }) {
  return (
    <StaticCodeDirectoryCard
      title={target === 'vehicle' ? 'Vehicle Renewal Types' : 'Contact Renewal Types'}
      subtitle={
        target === 'vehicle'
          ? 'Statutory Indian commercial vehicle renewal categories'
          : 'Driver licensing and safety certification renewal tracks'
      }
      rows={
        target === 'vehicle'
          ? [
              { code: 'REN-INS', name: 'Commercial Motor Insurance', scope: 'Annual', status: 'Enforced' },
              { code: 'REN-FIT', name: 'RTO Fitness Certificate (FC)', scope: 'Annual / Biennial', status: 'Enforced' },
              { code: 'REN-PUC', name: 'Emission / PUC Certificate', scope: 'Semi-Annual', status: 'Enforced' },
              { code: 'REN-NP', name: 'National / State Goods Permit', scope: 'Annual', status: 'Enforced' },
            ]
          : [
              { code: 'CON-DL', name: 'Commercial Driving Licence (TRANS/HMV)', scope: 'Every 3–5 Years', status: 'Enforced' },
              { code: 'CON-HAZ', name: 'Hazardous Goods Endorsement', scope: 'Annual', status: 'Active' },
              { code: 'CON-MED', name: 'Annual Driver Vision & Medical Check', scope: 'Annual', status: 'Active' },
            ]
      }
    />
  )
}

export function ServiceCodesSection({ mode }: { mode: 'priority' | 'vmrs' }) {
  return (
    <StaticCodeDirectoryCard
      title={mode === 'priority' ? 'Repair Priority Class Codes' : 'System / Assembly / Component (VMRS) Codes'}
      subtitle={
        mode === 'priority'
          ? 'Standard urgency tiers assigned to work order line items'
          : 'Standardized component taxonomy aligned with DriveMitra 5-Area Health'
      }
      rows={
        mode === 'priority'
          ? [
              { code: 'P1-IMM', name: 'Scheduled Preventive Maintenance', scope: 'Planned Bay', status: 'Active' },
              { code: 'P2-NON', name: 'Non-Scheduled Corrective (Within 48h)', scope: 'Priority Bay', status: 'Active' },
              { code: 'P3-EMG', name: 'Emergency Breakdown / Roadside Rescue', scope: 'Immediate', status: 'Active' },
            ]
          : [
              { code: '013-001', name: 'Brakes — Air Disc & Friction Linings', scope: 'Vehicle Health', status: 'Active' },
              { code: '017-002', name: 'Tyres, Tubes & Wheel Alignment', scope: 'Tyre Health', status: 'Active' },
              { code: '045-004', name: 'Engine Cooling & Oil Filtration', scope: 'Engine Health', status: 'Active' },
              { code: '034-009', name: 'EV Traction Battery & Thermal Loop', scope: 'Vehicle Health', status: 'Active' },
            ]
      }
    />
  )
}

export function PartsReferenceSection({ mode }: { mode: 'manufacturers' | 'units' }) {
  const { partsInventory, suppliers } = useFleet()
  if (mode === 'manufacturers') {
    return (
      <StaticCodeDirectoryCard
        title="Part Manufacturers & Preferred OEMs"
        subtitle="Approved spare part manufacturers and supplier channels"
        rows={(suppliers.length > 0
          ? suppliers.map((sup, idx) => ({
              code: `MFR-0${idx + 1}`,
              name: sup.name,
              scope: `${partsInventory.filter((p) => p.preferredSupplierId === sup.id).length || 1} catalog SKUs`,
              status: 'Approved',
            }))
          : [
              { code: 'MFR-01', name: 'Bosch Commercial India', scope: 'Filters & Injectors', status: 'Approved' },
              { code: 'MFR-02', name: 'MRF / Apollo Tyres', scope: 'Commercial Radial Tyres', status: 'Approved' },
              { code: 'MFR-03', name: 'WABCO Brakes', scope: 'Air Disc & Calipers', status: 'Approved' },
            ])}
      />
    )
  }
  return (
    <StaticCodeDirectoryCard
      title="Measurement Units"
      subtitle="Inventory stocking and consumption units"
      rows={[
        { code: 'PCS', name: 'Pieces / Each (pcs)', scope: 'Filters, Brake Pads, Belts', status: 'Active' },
        { code: 'LTR', name: 'Liters (L)', scope: 'Engine Oil, Coolant, DEF', status: 'Active' },
        { code: 'SET', name: 'Axle / Kit Set', scope: 'Clutch Kits, Tyre Pairs', status: 'Active' },
      ]}
    />
  )
}

export function VehicleStatusSummaryBanner() {
  const { activeOrganization, vehicles } = useFleet()
  const activeCount = vehicles.filter((v) => v.operationStatus !== 'maintenance' && v.operationStatus !== 'offline').length
  const shopCount = vehicles.filter((v) => v.operationStatus === 'maintenance').length
  const totalBookValue = vehicles.length * 2850000
  return (
    <div className="p-4 rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3 text-xs">
      <span className="text-[#625346] font-semibold">
        {activeOrganization.name} · {activeCount} active · {shopCount} in shop
      </span>
      <span className="text-[#958777] tabular-nums">
        Estimated fleet asset base: {formatInr(totalBookValue)} · Updated {formatShortDate(new Date().toISOString())}
      </span>
    </div>
  )
}
