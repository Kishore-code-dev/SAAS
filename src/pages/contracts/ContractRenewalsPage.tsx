import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, MetricTile } from '../../components/ui/EnterprisePrimitives'
import { ContractStatusBadge } from '../../components/contracts/ContractPrimitives'

export function ContractRenewalsPage() {
  const navigate = useNavigate()
  const { contracts, hasPermission } = useContracts()

  const renewalQueue = useMemo(() => {
    const now = Date.now()
    return contracts
      .filter((c) => !c.archived && c.status !== 'closed' && c.status !== 'terminated')
      .map((c) => ({
        contract: c,
        daysLeft: Math.ceil((new Date(c.expiryDate).getTime() - now) / 86400000),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
  }, [contracts])

  const within30 = renewalQueue.filter((x) => x.daysLeft <= 30).length
  const expired = renewalQueue.filter((x) => x.daysLeft <= 0).length
  const autoRenew = renewalQueue.filter((x) => x.contract.renewalType === 'auto_renew').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contract Renewals & Expiry Schedule"
        subtitle="30/15/7/3/1-day expiry horizon, auto-renewal tracking, and versioned term rollover"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="btn-secondary">
          <CalendarClock className="w-4 h-4" />
          View Contract Register
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricTile title="Expiring Within 30 Days" value={within30} subtitle="Require renewal or return handover" color={within30 > 0 ? '#D8B442' : '#4D6E4A'} />
        <MetricTile title="Overdue / Expired" value={expired} subtitle="Immediate renewal or closure needed" color={expired > 0 ? '#B84E42' : '#4D6E4A'} />
        <MetricTile title="Auto-Renew Configured" value={autoRenew} subtitle="Recurring cycle agreements" color="#6E5696" />
      </div>

      {renewalQueue.length === 0 ? (
        <EmptySectionState title="No active contracts scheduled" description="Create a contract to track upcoming renewals." />
      ) : (
        <div className="enterprise-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Contract & Supplier</th>
                  <th>Expiry Date</th>
                  <th>Days Remaining</th>
                  <th>Renewal Mode</th>
                  <th>Current Rental</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {renewalQueue.map(({ contract, daysLeft }) => (
                  <tr key={contract.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => navigate(`/dashboard/contracts/register/${contract.id}`)}
                        className="font-bold text-[#625346] hover:text-[#6E5696] hover:underline block text-left"
                      >
                        {contract.contractCode} — {contract.contractName}
                      </button>
                      <span className="text-xs text-[#958777]">{contract.supplierName}</span>
                    </td>
                    <td className="text-xs tabular-nums font-semibold text-[#625346]">{contract.expiryDate}</td>
                    <td className="text-xs font-bold tabular-nums">
                      <span className={daysLeft <= 7 ? 'text-[#A24034]' : daysLeft <= 30 ? 'text-[#8F6510]' : 'text-[#4D6E4A]'}>
                        {daysLeft <= 0 ? `Expired (${daysLeft}d)` : `${daysLeft} days`}
                      </span>
                    </td>
                    <td className="text-xs capitalize text-[#625346]">{(contract.renewalType ?? '').replace(/_/g, ' ')}</td>
                    <td className="text-xs tabular-nums font-semibold">{formatInr(contract.financialTerms.monthlyRental)}/mo</td>
                    <td><ContractStatusBadge status={contract.status} /></td>
                    <td className="text-right">
                      {hasPermission('renew_contracts') && (
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/contracts/register/${contract.id}/renew`)}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Renew Contract
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
    </div>
  )
}

export function ContractRenewFormPage() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const { contracts, renewContract } = useContracts()
  const contract = contracts.find((c) => c.id === contractId)

  const defaultExpiry = useMemo(() => {
    const base = contract ? new Date(contract.expiryDate) : new Date()
    base.setFullYear(base.getFullYear() + 1)
    return base.toISOString().slice(0, 10)
  }, [contract])

  const [newExpiryDate, setNewExpiryDate] = useState(defaultExpiry)
  const [monthlyRental, setMonthlyRental] = useState(contract?.financialTerms.monthlyRental ?? 55000)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!contract) {
    return (
      <EmptySectionState
        title="Contract not found"
        description="Unable to locate the contract for renewal."
        actionLabel="Back to Renewals"
        onAction={() => navigate('/dashboard/contracts/renewals')}
      />
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await renewContract(contract.id, {
        newExpiryDate,
        monthlyRental,
        notes,
      })
      toast.success(`Renewed ${contract.contractCode} to ${newExpiryDate}`)
      navigate(`/dashboard/contracts/register/${contract.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to renew contract')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={`Renew Contract ${contract.contractCode}`}
        subtitle={`${contract.contractName} · Current expiry ${contract.expiryDate}`}
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/renewals')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Renewals
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">New Expiry Date *</label>
            <input
              type="date"
              required
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Revised Monthly Rental (₹)</label>
            <input
              type="number"
              min={0}
              value={monthlyRental}
              onChange={(e) => setMonthlyRental(Number(e.target.value))}
              className="dm-input text-xs"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#625346] mb-1">Renewal Justification / Escalation Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/renewals')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Renewing...' : 'Confirm Contract Renewal'}
          </button>
        </div>
      </form>
    </div>
  )
}
