import React, { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Check,
  Copy,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import type {
  PermissionAction,
  PermissionModuleKey,
  SensitivePermissionKey,
  StaffPermissionMatrix,
} from '../types/fleet'
import {
  DEFAULT_STAFF_PERMISSION_MATRIX,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  SENSITIVE_PERMISSION_LABELS,
  buildOwnerPermissionMatrix,
  normalizeStaffPermissions,
} from '../utils/staffPermissions'

interface StaffDirectoryItem {
  id: string
  organizationId: string
  userId: string | null
  username?: string
  role: string
  lastLoginAt: string | null
  fullName: string
  email: string
  mobile: string | null
  employeeCode?: string
  designation: string
  department?: string
  employmentStatus: 'active' | 'on_leave' | 'exited'
  accountStatus: 'draft' | 'invitation_pending' | 'active' | 'suspended' | 'deactivated'
  permissions: StaffPermissionMatrix
  pendingInviteToken?: string | null
  createdAt: string
}

interface ActivityLogRow {
  id: string
  staffName: string
  action: string
  module: string
  recordId: string | null
  timestamp: string
}

export function StaffDirectory() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<StaffDirectoryItem[]>([])
  const [logs, setLogs] = useState<ActivityLogRow[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [draftMatrix, setDraftMatrix] = useState<StaffPermissionMatrix>(DEFAULT_STAFF_PERMISSION_MATRIX)
  const [activeTab, setActiveTab] = useState<'directory' | 'matrix' | 'logs'>('directory')
  const [showAddForm, setShowAddForm] = useState(false)

  // Add staff form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [designation, setDesignation] = useState('Operations Executive')
  const [department, setDepartment] = useState('Operations')
  const [provisionMode, setProvisionMode] = useState<'invite' | 'direct'>('invite')
  const [issuedSecret, setIssuedSecret] = useState<{ label: string; value: string } | null>(null)
  const [saving, setSaving] = useState(false)

  const loadDirectory = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/staff', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data.staff) ? (data.staff as StaffDirectoryItem[]) : []
      setStaff(list)
      setLogs(Array.isArray(data.activityLogs) ? data.activityLogs : [])
      if (list.length > 0 && !selectedStaffId) {
        setSelectedStaffId(list[0].id)
        setDraftMatrix(normalizeStaffPermissions(list[0].permissions))
      }
    } finally {
      setLoading(false)
    }
  }, [selectedStaffId])

  useEffect(() => {
    void loadDirectory()
  }, [loadDirectory])

  const selectedMember = staff.find((s) => s.id === selectedStaffId) ?? null

  const selectMember = (member: StaffDirectoryItem) => {
    setSelectedStaffId(member.id)
    setDraftMatrix(normalizeStaffPermissions(member.permissions))
    setActiveTab('matrix')
  }

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setIssuedSecret(null)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email,
          mobile,
          designation,
          department,
          createCredentialsDirectly: provisionMode === 'direct',
          sendInvite: provisionMode === 'invite',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not create staff profile')
        return
      }
      if (data.temporaryCredentials) {
        setIssuedSecret({
          label: `Temporary Login for ${data.temporaryCredentials.username}`,
          value: `Username: ${data.temporaryCredentials.username} | Password: ${data.temporaryCredentials.temporaryPassword}`,
        })
      } else if (data.staff?.pendingInviteToken) {
        setIssuedSecret({
          label: `Invitation URL for ${data.staff.fullName}`,
          value: `${window.location.origin}/invite/${data.staff.pendingInviteToken}`,
        })
      }
      setFullName('')
      setEmail('')
      setMobile('')
      setShowAddForm(false)
      toast.success('Staff profile created')
      await loadDirectory()
    } finally {
      setSaving(false)
    }
  }

  const toggleModuleAction = (modKey: PermissionModuleKey, action: PermissionAction) => {
    if (modKey === 'integrations') return
    setDraftMatrix((prev) => {
      const next = normalizeStaffPermissions(prev)
      const current = { ...next.modules[modKey] }
      current[action] = !current[action]
      if (action === 'view' && !current.view) {
        for (const a of PERMISSION_ACTIONS) current[a.key] = false
      } else if (action !== 'view' && current[action]) {
        current.view = true
      }
      next.modules[modKey] = current
      return next
    })
  }

  const toggleSensitive = (key: SensitivePermissionKey) => {
    setDraftMatrix((prev) => ({
      ...prev,
      sensitive: {
        ...prev.sensitive,
        [key]: !prev.sensitive[key],
      },
    }))
  }

  const handleSaveMatrix = async () => {
    if (!selectedMember) return
    setSaving(true)
    try {
      const res = await fetch(`/api/staff/${selectedMember.id}/permissions`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: draftMatrix }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update staff permissions')
        return
      }
      setStaff((prev) =>
        prev.map((item) =>
          item.id === selectedMember.id ? { ...item, permissions: data.permissions } : item,
        ),
      )
      toast.success(`Permissions updated for ${selectedMember.fullName} — active immediately`)
      await loadDirectory()
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAccountStatus = async (
    staffId: string,
    accountStatus: 'active' | 'suspended' | 'deactivated',
  ) => {
    const res = await fetch(`/api/staff/${staffId}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountStatus }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Unable to change staff account status')
      return
    }
    toast.success(`Staff account status updated to ${accountStatus}`)
    await loadDirectory()
  }

  const handleGenerateInvite = async (staffId: string) => {
    const res = await fetch(`/api/staff/${staffId}/invite`, {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not generate invitation link')
      return
    }
    const url = `${window.location.origin}${data.inviteUrl}`
    setIssuedSecret({ label: 'Staff Activation Link', value: url })
    toast.success('Fresh invitation link generated')
    await loadDirectory()
  }

  const statusBadge = (status: string) => {
    if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if (status === 'invitation_pending') return 'bg-amber-50 text-amber-700 border-amber-200'
    if (status === 'suspended' || status === 'deactivated') return 'bg-rose-50 text-rose-700 border-rose-200'
    return 'bg-slate-100 text-slate-600 border-slate-200'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-emerald-600" />
            Staff Management & 31-Module Access Matrix
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Add operational staff, issue invitations, and control module permissions & sensitive financial visibility in real time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadDirectory()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Add Staff Member
          </button>
        </div>
      </div>

      {issuedSecret && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-emerald-900">{issuedSecret.label}</p>
            <code className="text-xs text-emerald-800 break-all">{issuedSecret.value}</code>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(issuedSecret.value)
              toast.success('Copied to clipboard')
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-800"
          >
            <Copy className="w-3.5 h-3.5" /> Copy
          </button>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleCreateStaff} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-emerald-600" /> Onboard New Staff Member
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email *</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile</label>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
              <input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Provisioning</label>
              <select
                value={provisionMode}
                onChange={(e) => setProvisionMode(e.target.value as 'invite' | 'direct')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
              >
                <option value="invite">Generate Invite Link (/invite/...)</option>
                <option value="direct">Create Temporary Credentials Now</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              {saving ? 'Saving...' : 'Create Staff Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'directory', label: `Staff Profiles (${staff.length})`, icon: Users },
          { id: 'matrix', label: '31-Module Permission Matrix', icon: ShieldCheck },
          { id: 'logs', label: `Staff Activity Logs (${logs.length})`, icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-500">
          Loading staff workspace...
        </div>
      ) : activeTab === 'directory' ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Designation / Dept</th>
                  <th className="py-3 px-4">Login Identity</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {staff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No staff members added yet.
                    </td>
                  </tr>
                ) : (
                  staff.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{st.fullName}</p>
                        <p className="text-xs text-slate-500">{st.email} {st.employeeCode ? `· ${st.employeeCode}` : ''}</p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        <p className="font-medium">{st.designation}</p>
                        <p className="text-slate-500">{st.department || 'Operations'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-700">
                        {st.username ? (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{st.username}</span>
                        ) : (
                          <span className="text-slate-400">Invite pending acceptance</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${statusBadge(st.accountStatus)}`}>
                          {st.accountStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => selectMember(st)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold"
                        >
                          <Shield className="w-3.5 h-3.5" /> Permissions
                        </button>
                        {!st.userId && (
                          <button
                            type="button"
                            onClick={() => void handleGenerateInvite(st.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <KeyRound className="w-3.5 h-3.5" /> Invite Link
                          </button>
                        )}
                        {st.accountStatus === 'active' ? (
                          <button
                            type="button"
                            onClick={() => void handleUpdateAccountStatus(st.id, 'suspended')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                          >
                            <UserX className="w-3.5 h-3.5" /> Suspend
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleUpdateAccountStatus(st.id, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'matrix' ? (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Editing Matrix For:</label>
              <select
                value={selectedStaffId || ''}
                onChange={(e) => {
                  const found = staff.find((s) => s.id === e.target.value)
                  if (found) selectMember(found)
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-medium"
              >
                {staff.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} ({st.designation})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDraftMatrix(normalizeStaffPermissions(DEFAULT_STAFF_PERMISSION_MATRIX))}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset Canonical 15-Module Defaults
              </button>
              <button
                type="button"
                onClick={() => setDraftMatrix(buildOwnerPermissionMatrix())}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Grant Full Tenant Access
              </button>
              <button
                type="button"
                disabled={saving || !selectedMember || user?.role === 'fleet_staff'}
                onClick={() => void handleSaveMatrix()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" /> Save Permissions Immediately
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Module (31 Canonical Modules)</th>
                    {PERMISSION_ACTIONS.map((act) => (
                      <th key={act.key} className="py-3 px-3 text-center">{act.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {PERMISSION_MODULES.map((mod) => {
                    const entry = draftMatrix.modules[mod.key]
                    const lockedPlatformOnly = Boolean(mod.platformAdminOnly)
                    return (
                      <tr key={mod.key} className={lockedPlatformOnly ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{mod.label}</span>
                            {lockedPlatformOnly && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {mod.category} · Default: {mod.defaultStaffSummary}
                          </span>
                        </td>
                        {PERMISSION_ACTIONS.map((act) => {
                          const checked = Boolean(entry?.[act.key])
                          return (
                            <td key={act.key} className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                disabled={lockedPlatformOnly}
                                aria-label={`${mod.label} ${act.label}`}
                                onClick={() => toggleModuleAction(mod.key, act.key)}
                                className={`w-6 h-6 rounded-md inline-flex items-center justify-center border transition-colors ${
                                  lockedPlatformOnly
                                    ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                    : checked
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-slate-300 text-transparent hover:border-emerald-500'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Sensitive Data & Contract Protection Flags</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SENSITIVE_PERMISSION_LABELS.map((item) => {
                const enabled = Boolean(draftMatrix.sensitive[item.key])
                return (
                  <label
                    key={item.key}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-2.5 ${
                      enabled ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => toggleSensitive(item.key)}
                      className="mt-1 accent-emerald-600"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Record ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">No staff activity recorded yet.</td>
                  </tr>
                ) : (
                  logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-4 text-slate-500">{new Date(l.timestamp).toLocaleString('en-IN')}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{l.staffName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{l.module}</td>
                      <td className="py-3 px-4 font-semibold text-emerald-700">{l.action}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{l.recordId || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffDirectory
