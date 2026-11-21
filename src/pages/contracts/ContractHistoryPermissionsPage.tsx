import React, { useMemo, useState } from 'react'
import { History, Lock, Save, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import {
  ALL_CONTRACT_PERMISSION_KEYS,
  CONTRACT_PERMISSION_LABELS,
  resolveEffectiveContractPermissions,
} from '../../utils/contractsEngine'
import type { ContractPermissionKey } from '../../types/contracts'
import type { OrganizationRole } from '../../types/fleet'

const CONFIGURABLE_ROLES: Array<{ role: OrganizationRole; label: string }> = [
  { role: 'fleet_manager', label: 'Fleet Manager' },
  { role: 'finance', label: 'Finance Manager' },
  { role: 'maintenance', label: 'Maintenance Lead' },
  { role: 'viewer', label: 'Viewer / Auditor' },
]

export default function ContractHistoryPermissionsPage() {
  const { history, permissions, savePermissions } = useContracts()
  const { activeRole } = useFleet()
  const [subTab, setSubTab] = useState<'history' | 'permissions'>('history')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const initialMatrix = useMemo(() => {
    const m: Record<string, Record<ContractPermissionKey, boolean>> = {}
    for (const r of CONFIGURABLE_ROLES) {
      m[r.role] = resolveEffectiveContractPermissions(r.role, permissions)
    }
    return m
  }, [permissions])

  const [draftMatrix, setDraftMatrix] = useState(initialMatrix)

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase()
    return history.filter(
      (h) =>
        !q ||
        h.summary.toLowerCase().includes(q) ||
        h.actorName.toLowerCase().includes(q) ||
        (h.actionType ?? '').toLowerCase().includes(q),
    )
  }, [history, search])

  const isOrgOwner = activeRole === 'org_admin'

  const togglePerm = (role: OrganizationRole, key: ContractPermissionKey) => {
    if (!isOrgOwner) return
    setDraftMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [key]: !prev[role]?.[key],
      },
    }))
  }

  const handleSaveMatrix = async () => {
    if (!isOrgOwner) return
    setSaving(true)
    try {
      const updates: Array<{ role: OrganizationRole; permissionKey: ContractPermissionKey; allowed: boolean }> = []
      for (const r of CONFIGURABLE_ROLES) {
        for (const key of ALL_CONTRACT_PERMISSION_KEYS) {
          updates.push({
            role: r.role,
            permissionKey: key,
            allowed: Boolean(draftMatrix[r.role]?.[key]),
          })
        }
      }
      await savePermissions(updates)
      toast.success('Organization contract permission matrix saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update permissions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Audit History & Role Permissions"
        subtitle="Immutable contract governance log and Owner-configurable 21-category access control matrix"
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-3.5 py-2 rounded-[8px] text-xs font-semibold border flex items-center gap-1.5 ${
              subTab === 'history'
                ? 'bg-[#625346] text-white border-[#625346]'
                : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Immutable Audit Stream ({history.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('permissions')}
            className={`px-3.5 py-2 rounded-[8px] text-xs font-semibold border flex items-center gap-1.5 ${
              subTab === 'permissions'
                ? 'bg-[#625346] text-white border-[#625346]'
                : 'bg-[#FAFAFA] text-[#625346] border-[#E5E5E5]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            21-Permission Role Matrix
          </button>
        </div>
      </PageHeader>

      {subTab === 'history' ? (
        <div className="enterprise-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#625346]">Chronological Governance Events</h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter actor, action, contract..."
              className="dm-input py-1.5 text-xs w-64"
            />
          </div>
          <div className="divide-y divide-[#F2F2F2]">
            {filteredHistory.map((h) => (
              <div key={h.id} className="py-3 flex flex-wrap items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="font-semibold text-[#625346]">{h.summary}</div>
                  <div className="text-[#958777]">
                    Action: <span className="font-medium text-[#625346]">{h.actionType}</span> · Actor: {h.actorName} ({h.actorRole})
                  </div>
                </div>
                <span className="text-[#958777] whitespace-nowrap tabular-nums">
                  {(h.createdAt ?? '').slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="p-4 border-b border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3 bg-[#FAFAFA]">
            <div className="space-y-0.5">
              <div className="text-sm font-bold text-[#625346] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6E5696]" />
                Owner-Controlled Contract Governance Matrix (21 Permissions)
              </div>
              <p className="text-xs text-[#958777]">
                Fleet Owner (org_admin) holds permanent full authority. Platform Admin never gains tenant approval rights automatically.
              </p>
            </div>
            {isOrgOwner && (
              <button type="button" disabled={saving} onClick={() => void handleSaveMatrix()} className="btn-accent text-xs">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving Matrix...' : 'Save Role Permissions'}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Permission Category (21)</th>
                  <th className="text-center">Fleet Owner (org_admin)</th>
                  {CONFIGURABLE_ROLES.map((r) => (
                    <th key={r.role} className="text-center">{r.label}</th>
                  ))}
                  <th className="text-center">Platform Admin</th>
                </tr>
              </thead>
              <tbody>
                {ALL_CONTRACT_PERMISSION_KEYS.map((key, idx) => (
                  <tr key={key}>
                    <td className="text-xs font-semibold text-[#625346]">
                      {idx + 1}. {CONTRACT_PERMISSION_LABELS[key]}
                    </td>
                    <td className="text-center text-xs font-bold text-[#4D6E4A]">Always On</td>
                    {CONFIGURABLE_ROLES.map((r) => (
                      <td key={r.role} className="text-center">
                        <input
                          type="checkbox"
                          aria-label={`${r.label} ${key}`}
                          disabled={!isOrgOwner}
                          checked={Boolean(draftMatrix[r.role]?.[key])}
                          onChange={() => togglePerm(r.role, key)}
                          className="w-4 h-4 accent-[#6E5696] cursor-pointer"
                        />
                      </td>
                    ))}
                    <td className="text-center text-xs text-[#958777]">
                      {key === 'view_contracts' || key === 'manage_contract_documents' ? 'Scoped' : 'Restricted'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
