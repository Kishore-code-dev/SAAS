import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, FileSignature, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { contractRequest, useContractWorkspace } from '../../hooks/useContracts'
import { canPerformContractAction } from '../../utils/rbac'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../../components/ui/EnterprisePrimitives'
import {
  ContractPage,
  ContractStatusBadge,
  DataTable,
  ErrorBlock,
  Field,
  FilterSelect,
  GhostButton,
  Input,
  LoadingBlock,
  PrimaryButton,
  Toolbar,
  daysUntil,
  inr,
  shortDate,
  todayIso,
} from './ContractUi'

export default function ContractRenewalsPage() {
  const { data, loading, error, refresh } = useContractWorkspace()
  const { activeRole } = useFleet()
  const [search, setSearch] = useState('')
  const [bucketFilter, setBucketFilter] = useState('all')
  const [renewTarget, setRenewTarget] = useState<string | null>(null)
  const [renewForm, setRenewForm] = useState({ expiryDate: '', monthlyRental: '', note: '' })
  const [saving, setSaving] = useState(false)

  const canEdit = canPerformContractAction(activeRole, 'edit_contracts')
  const canRenew = canPerformContractAction(activeRole, 'renew_contracts')
  const canApproveAmendments = canPerformContractAction(activeRole, 'approve_amendments')

  const contracts = useMemo(
    () => (data?.contracts ?? [])
      .filter((c) => c.status !== 'closed' && c.status !== 'terminated')
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [data],
  )

  const bucketOf = (expiryDate: string): string => {
    const days = daysUntil(expiryDate)
    if (days < 0) return 'expired'
    if (days <= 30) return '0-30'
    if (days <= 60) return '31-60'
    if (days <= 90) return '61-90'
    return '90+'
  }

  const counts = {
    expired: contracts.filter((c) => bucketOf(c.expiryDate) === 'expired').length,
    d30: contracts.filter((c) => bucketOf(c.expiryDate) === '0-30').length,
    d60: contracts.filter((c) => bucketOf(c.expiryDate) === '31-60').length,
    d90: contracts.filter((c) => bucketOf(c.expiryDate) === '61-90').length,
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contracts.filter((c) => {
      if (bucketFilter !== 'all' && bucketOf(c.expiryDate) !== bucketFilter) return false
      if (!q) return true
      return `${c.contractNumber} ${c.name} ${c.supplierName}`.toLowerCase().includes(q)
    })
  }, [contracts, search, bucketFilter])

  const pendingAmendments = (data?.amendments ?? []).filter((a) => a.status === 'submitted' || a.status === 'draft')

  const changeStatus = async (contractId: string, status: string) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
      toast.success(`Contract marked ${status.replace(/_/g, ' ')}.`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update contract status.')
    }
  }

  const openRenew = (contractId: string, expiryDate: string) => {
    const next = new Date(expiryDate)
    next.setUTCFullYear(next.getUTCFullYear() + 1)
    setRenewForm({ expiryDate: next.toISOString().slice(0, 10), monthlyRental: '', note: '' })
    setRenewTarget(contractId)
  }

  const createRenewal = async () => {
    if (!renewTarget) return
    if (!renewForm.expiryDate) { toast.error('New expiry date is required.'); return }
    const contract = contracts.find((c) => c.id === renewTarget)
    if (!contract) return
    const revised: Record<string, unknown> = { expiryDate: renewForm.expiryDate }
    if (renewForm.monthlyRental) revised.monthlyRentalInr = Number(renewForm.monthlyRental)
    setSaving(true)
    try {
      await contractRequest(`/${encodeURIComponent(renewTarget)}/amendments`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Renewal to ${renewForm.expiryDate}`,
          reason: renewForm.note || 'Contract renewal before expiry.',
          revisedValues: revised,
          effectiveDate: todayIso(),
        }),
      })
      toast.success('Renewal amendment created. Submit it for approval when ready.')
      setRenewTarget(null)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create renewal.')
    } finally {
      setSaving(false)
    }
  }

  const submitAmendment = async (contractId: string, amendmentId: string) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/amendments/${encodeURIComponent(amendmentId)}/submit`, { method: 'POST' })
      toast.success('Amendment submitted for approval.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit amendment.')
    }
  }

  const decideAmendment = async (contractId: string, amendmentId: string, approve: boolean) => {
    try {
      await contractRequest(`/${encodeURIComponent(contractId)}/amendments/${encodeURIComponent(amendmentId)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approve }),
      })
      toast.success(approve ? 'Renewal approved and contract version advanced.' : 'Amendment rejected.')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to decide amendment.')
    }
  }

  return (
    <ContractPage
      title="Contract Renewals"
      subtitle="Expiry exposure, renewal amendments and versioned approvals. Expired contracts are surfaced, never auto-renewed."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Expired / overdue', value: counts.expired, tone: 'text-[#B84E42]' },
          { label: 'Expiring in 30 days', value: counts.d30, tone: 'text-[#8E6F19]' },
          { label: '31–60 days', value: counts.d60, tone: 'text-[#625346]' },
          { label: '61–90 days', value: counts.d90, tone: 'text-[#625346]' },
        ].map((item) => (
          <div key={item.label} className="enterprise-card p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-[#958777]">{item.label}</span><CalendarClock className="w-4 h-4 text-[#958777]" /></div>
            <p className={`text-xl font-bold tabular-nums mt-1 ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search contract, name or supplier"
        filters={
          <FilterSelect label="expiry windows" value={bucketFilter} onChange={setBucketFilter} options={[
            { value: 'expired', label: 'Expired' },
            { value: '0-30', label: '0–30 days' },
            { value: '31-60', label: '31–60 days' },
            { value: '61-90', label: '61–90 days' },
            { value: '90+', label: '90+ days' },
          ]} />
        }
      />

      {loading && <LoadingBlock />}
      {!loading && error && <ErrorBlock message={error} onRetry={() => void refresh()} />}
      {!loading && !error && (
        <DataTable
          rows={filtered}
          rowKey={(c) => c.id}
          emptyTitle="No contracts in this window"
          emptyDescription="Change the expiry filter or create a contract to start tracking renewal exposure."
          columns={[
            { key: 'contract', label: 'Contract', render: (c) => <div><Link to={`/dashboard/contracts/${c.id}`} className="text-xs font-bold text-[#625346] hover:text-[#6E5696]">{c.contractNumber}</Link><p className="text-[10px] text-[#958777] truncate max-w-[220px]">{c.name}</p></div> },
            { key: 'supplier', label: 'Supplier', render: (c) => <span className="text-xs">{c.supplierName}</span> },
            { key: 'vehicles', label: 'Vehicles', render: (c) => <span className="text-xs tabular-nums">{c.vehicles.length}</span> },
            { key: 'expiry', label: 'Expiry', render: (c) => <div><p className="text-xs">{shortDate(c.expiryDate)}</p><p className={`text-[10px] font-semibold ${daysUntil(c.expiryDate) < 0 ? 'text-[#B84E42]' : daysUntil(c.expiryDate) <= 30 ? 'text-[#8E6F19]' : 'text-[#958777]'}`}>{daysUntil(c.expiryDate) < 0 ? `${Math.abs(daysUntil(c.expiryDate))} days overdue` : `${daysUntil(c.expiryDate)} days left`}</p></div> },
            { key: 'value', label: 'Monthly', className: 'text-right', render: (c) => <span className="text-xs tabular-nums">{c.financialTerms.monthlyRentalInr ? inr(c.financialTerms.monthlyRentalInr) : '—'}</span> },
            { key: 'status', label: 'Status', render: (c) => <ContractStatusBadge status={c.status} /> },
          ]}
          actions={(c) => (
            <>
              {canRenew && c.status !== 'expired' && c.status !== 'renewal_pending' && (
                <GhostButton onClick={() => void changeStatus(c.id, 'renewal_pending')}>Request renewal</GhostButton>
              )}
              {canEdit && c.status !== 'expired' && (
                <GhostButton onClick={() => openRenew(c.id, c.expiryDate)}><RefreshCw className="w-3.5 h-3.5" /> Renew</GhostButton>
              )}
              {canEdit && c.status !== 'expired' && daysUntil(c.expiryDate) < 0 && (
                <GhostButton onClick={() => void changeStatus(c.id, 'expired')}>Mark expired</GhostButton>
              )}
            </>
          )}
        />
      )}

      <div className="enterprise-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSignature className="w-4 h-4 text-[#6E5696]" />
          <h2 className="text-sm font-bold text-[#625346]">Renewal & amendment approvals</h2>
        </div>
        {pendingAmendments.length === 0 ? (
          <p className="text-xs text-[#958777]">No amendments awaiting approval.</p>
        ) : (
          <div className="space-y-2">
            {pendingAmendments.map((a) => {
              const contract = contracts.find((c) => c.id === a.contractId)
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] px-3 py-2">
                  <div>
                    <p className="text-xs font-bold text-[#625346]">{a.amendmentNumber} · {a.title}</p>
                    <p className="text-[10px] text-[#958777]">{contract?.contractNumber ?? a.contractId} · effective {shortDate(a.effectiveDate)} · {a.status}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {a.status === 'draft' && canEdit && (
                      <GhostButton onClick={() => void submitAmendment(a.contractId, a.id)}>Submit</GhostButton>
                    )}
                    {a.status === 'submitted' && canApproveAmendments && (
                      <>
                        <GhostButton onClick={() => void decideAmendment(a.contractId, a.id, true)} aria-label="Approve amendment"><CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A]" /></GhostButton>
                        <GhostButton onClick={() => void decideAmendment(a.contractId, a.id, false)} aria-label="Reject amendment"><XCircle className="w-3.5 h-3.5 text-[#B84E42]" /></GhostButton>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <EnterpriseModal open={Boolean(renewTarget)} onClose={() => setRenewTarget(null)} title="Create Renewal Amendment" subtitle="Renewals are versioned amendments. Approval updates the contract expiry and advances its version.">
        <div className="space-y-3">
          <Field label="New expiry date"><Input type="date" value={renewForm.expiryDate} onChange={(e) => setRenewForm({ ...renewForm, expiryDate: e.target.value })} /></Field>
          <Field label="Revised monthly rental (INR, optional)"><Input type="number" min="0" value={renewForm.monthlyRental} onChange={(e) => setRenewForm({ ...renewForm, monthlyRental: e.target.value })} /></Field>
          <Field label="Renewal note"><Input value={renewForm.note} onChange={(e) => setRenewForm({ ...renewForm, note: e.target.value })} placeholder="Rate revision, term change, etc." /></Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E5E5]">
            <GhostButton onClick={() => setRenewTarget(null)}>Cancel</GhostButton>
            <PrimaryButton onClick={() => void createRenewal()} disabled={saving}>{saving ? 'Creating…' : 'Create Amendment'}</PrimaryButton>
          </div>
        </div>
      </EnterpriseModal>
    </ContractPage>
  )
}
