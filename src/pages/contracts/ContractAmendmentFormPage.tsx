import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, GitBranch } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import type { ContractAmendment, ResponsibilityParty } from '../../types/contracts'

export default function ContractAmendmentFormPage() {
  const { contractId } = useParams()
  const navigate = useNavigate()
  const { contracts, createAmendment } = useContracts()

  const contract = contracts.find((c) => c.id === contractId)
  const [title, setTitle] = useState('')
  const [reason, setReason] = useState('')
  const [amendmentType, setAmendmentType] = useState<ContractAmendment['amendmentType']>('rental_amount')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [monthlyRental, setMonthlyRental] = useState(contract?.financialTerms.monthlyRental ?? 0)
  const [expiryDate, setExpiryDate] = useState(contract?.expiryDate ?? '')
  const [maintResp, setMaintResp] = useState<ResponsibilityParty>(
    contract?.contractConditions.maintenanceResponsibility ?? 'shared',
  )
  const [recalcFuture, setRecalcFuture] = useState(true)
  const [submitNow, setSubmitNow] = useState(true)
  const [saving, setSaving] = useState(false)

  if (!contract) {
    return (
      <div className="space-y-4">
        <PageHeader title="Contract Not Found" subtitle="Select a valid contract to amend." />
        <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="btn-secondary">
          Back to Register
        </button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !reason.trim()) {
      toast.error('Enter an amendment title and justification.')
      return
    }
    setSaving(true)
    try {
      await createAmendment(contract.id, {
        title: title.trim(),
        reason: reason.trim(),
        amendmentType,
        effectiveDate,
        recalculateFutureSchedule: recalcFuture,
        submitImmediately: submitNow,
        revisedValues: {
          monthlyRental,
          expiryDate,
          maintenanceResponsibility: maintResp,
        },
      })
      toast.success('Amendment created and queued while preserving prior versions & paid receipts.')
      navigate(`/dashboard/contracts/register/${contract.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create amendment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Create Amendment — ${contract.contractCode}`}
        subtitle={`Current Version v${contract.currentVersion} · Prior versions and completed payments remain immutable`}
      >
        <button
          type="button"
          onClick={() => navigate(`/dashboard/contracts/register/${contract.id}`)}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contract
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5 max-w-3xl">
        <h2 className="dm-card-title flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[#6E5696]" />
          Versioned Amendment Specification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="dm-label">Amendment Title *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q4 Rental Escalation & Shared Maintenance Revision"
              className="dm-input"
            />
          </div>
          <div>
            <label className="dm-label">Amendment Category</label>
            <select
              value={amendmentType}
              onChange={(e) => setAmendmentType(e.target.value as ContractAmendment['amendmentType'])}
              className="dm-input"
            >
              <option value="rental_amount">Rental / Rate Amount</option>
              <option value="duration_expiry">Duration &amp; Expiry Date</option>
              <option value="maintenance_responsibility">Maintenance Responsibility</option>
              <option value="payment_frequency">Payment Frequency</option>
              <option value="security_deposit">Security Deposit Adjustment</option>
              <option value="general_terms">General Terms</option>
            </select>
          </div>
          <div>
            <label className="dm-label">Effective Date *</label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="dm-input"
            />
          </div>
          <div>
            <label className="dm-label">Revised Monthly Rental (₹)</label>
            <input
              type="number"
              min={0}
              value={monthlyRental}
              onChange={(e) => setMonthlyRental(Number(e.target.value))}
              className="dm-input"
            />
            <span className="text-[11px] text-[#958777]">Previous: ₹{contract.financialTerms.monthlyRental.toLocaleString('en-IN')}</span>
          </div>
          <div>
            <label className="dm-label">Revised Expiry Date</label>
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="dm-input" />
            <span className="text-[11px] text-[#958777]">Previous: {contract.expiryDate}</span>
          </div>
          <div>
            <label className="dm-label">Maintenance Responsibility</label>
            <select value={maintResp} onChange={(e) => setMaintResp(e.target.value as ResponsibilityParty)} className="dm-input">
              <option value="operating_org">Operating Org</option>
              <option value="supplier">Supplier / Owner</option>
              <option value="shared">Shared Split</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="dm-label">Business Reason / Justification *</label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the contract terms are being amended..."
              className="dm-input"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#625346] md:col-span-2">
            <input type="checkbox" checked={recalcFuture} onChange={(e) => setRecalcFuture(e.target.checked)} />
            Recalculate future unpaid payment schedule from effective date (completed/paid transactions remain untouched)
          </label>
          <label className="flex items-center gap-2 text-xs text-[#625346] md:col-span-2">
            <input type="checkbox" checked={submitNow} onChange={(e) => setSubmitNow(e.target.checked)} />
            Submit immediately for Fleet Owner / authorized approval
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(`/dashboard/contracts/register/${contract.id}`)}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            {saving ? 'Saving Amendment...' : submitNow ? 'Submit Amendment' : 'Save Draft Amendment'}
          </button>
        </div>
      </form>
    </div>
  )
}
