import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Edit3, Mail, Phone, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, EnterpriseModal, formatInr } from '../../components/ui/EnterprisePrimitives'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import type { FinancePaymentMethod, FinancialInstitution } from '../../types/finance'
import { paymentMethodLabel } from '../../utils/financeHelpers'

export default function BanksDirectoryPage() {
  const navigate = useNavigate()
  const { activeRole, activeOrganization } = useFleet()
  const { institutions, records, maskedForRole, saveInstitution } = useFinance()

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialInstitution | null>(null)

  const [bankName, setBankName] = useState('')
  const [institutionType, setInstitutionType] = useState<FinancialInstitution['institutionType']>('bank')
  const [branch, setBranch] = useState('')
  const [relationshipManager, setRelationshipManager] = useState('')
  const [contactNumber, setContactNumber] = useState('')
  const [email, setEmail] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<FinancePaymentMethod>('nach')
  const [active, setActive] = useState(true)
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const canManage = canPerformAction(activeRole, 'manage_bank_details')

  const enriched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return institutions
      .map((inst) => {
        const linkedRecords = records.filter(
          (r) => r.institutionId === inst.id || r.bankName.toLowerCase() === inst.bankName.toLowerCase(),
        )
        const activeRecords = linkedRecords.filter(
          (r) => r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed' && r.financeStatus !== 'cancelled',
        )
        const exposure = activeRecords.reduce((s, r) => s + r.outstandingPrincipal, 0)
        const monthlyEmi = activeRecords.reduce((s, r) => s + r.emiAmount, 0)
        return { inst, linkedRecords, activeRecords, exposure, monthlyEmi }
      })
      .filter(({ inst }) => {
        if (statusFilter === 'active' && !inst.active) return false
        if (statusFilter === 'inactive' && inst.active) return false
        if (!q) return true
        return (
          inst.bankName.toLowerCase().includes(q) ||
          inst.branch.toLowerCase().includes(q) ||
          inst.relationshipManager.toLowerCase().includes(q) ||
          inst.ifscCode.toLowerCase().includes(q)
        )
      })
  }, [institutions, records, query, statusFilter])

  const openModal = (inst?: FinancialInstitution) => {
    setEditing(inst ?? null)
    setBankName(inst?.bankName ?? '')
    setInstitutionType(inst?.institutionType ?? 'bank')
    setBranch(inst?.branch ?? '')
    setRelationshipManager(inst?.relationshipManager ?? '')
    setContactNumber(inst?.contactNumber ?? '')
    setEmail(inst?.email ?? '')
    setIfscCode(inst?.ifscCode ?? '')
    setDefaultPaymentMethod(inst?.defaultPaymentMethod ?? 'nach')
    setActive(inst?.active ?? true)
    setNotes(inst?.notes ?? '')
    setReason('')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveInstitution({
        id: editing?.id,
        bankName: bankName.trim(),
        institutionType,
        branch: branch.trim(),
        relationshipManager: relationshipManager.trim(),
        contactNumber: contactNumber.trim(),
        email: email.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        defaultPaymentMethod,
        active,
        notes: notes.trim(),
        reason: reason.trim() || (editing ? 'Updated bank details' : 'Added financial institution'),
      })
      toast.success(editing ? `Updated ${bankName}` : `Added ${bankName}`)
      setModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save financial institution.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bank & Financier Details"
        subtitle={`${activeOrganization.name} · Lending partners, relationship managers, IFSC routing & portfolio exposure`}
      >
        {canManage && (
          <button type="button" onClick={() => openModal()} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" />
            Add Bank / Financier
          </button>
        )}
      </PageHeader>

      <div className="enterprise-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bank, branch, RM, IFSC..."
            aria-label="Search financial institutions"
            className="dm-input pl-9 py-2 text-xs"
          />
        </div>
        <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
          {(['all', 'active', 'inactive'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[8px] text-xs font-semibold capitalize ${
                statusFilter === st ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {enriched.length === 0 ? (
        <EmptySectionState
          title="No banks or financiers match the filter"
          description="Add a lending partner or clear your search filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {enriched.map(({ inst, linkedRecords, activeRecords, exposure, monthlyEmi }) => (
            <div key={inst.id} className="enterprise-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#EEE8F7] border border-[#B8A3D9] flex items-center justify-center text-[#6E5696] shrink-0">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="dm-card-title text-base">{inst.bankName}</h2>
                      <span
                        className={`px-2 py-0.5 rounded-[8px] text-[10.5px] font-semibold border ${
                          inst.active
                            ? 'bg-[#EDF4EC] border-[#B8D0B5] text-[#4D6E4A]'
                            : 'bg-[#F5F5F7] border-[#E5E5E5] text-[#958777]'
                        }`}
                      >
                        {inst.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-[#958777]">
                      {inst.branch} · {inst.institutionType.replace('_', ' ').toUpperCase()} · IFSC {inst.ifscCode || '—'}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button type="button" onClick={() => openModal(inst)} className="btn-secondary text-[11px] px-2.5 py-1">
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] text-xs">
                <div>
                  <span className="text-[#958777] block">Active Loans</span>
                  <span className="font-bold text-sm text-[#625346] tabular-nums">{activeRecords.length} / {linkedRecords.length}</span>
                </div>
                <div>
                  <span className="text-[#958777] block">Outstanding</span>
                  <span className="font-bold text-sm text-[#6E5696] tabular-nums">{formatInr(exposure)}</span>
                </div>
                <div>
                  <span className="text-[#958777] block">Monthly EMI</span>
                  <span className="font-bold text-sm text-[#625346] tabular-nums">{formatInr(monthlyEmi)}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#625346]">
                <div>
                  <span className="text-[#958777]">Relationship Manager: </span>
                  <span className="font-semibold">{inst.relationshipManager || '—'}</span>
                </div>
                <div>
                  <span className="text-[#958777]">Default Method: </span>
                  <span className="font-semibold">{paymentMethodLabel(inst.defaultPaymentMethod)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#958777]" />
                  <span>{maskedForRole ? '••••••••••' : inst.contactNumber || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#958777]" />
                  <span className="truncate">{maskedForRole ? '***@protected' : inst.email || '—'}</span>
                </div>
              </div>

              {linkedRecords.length > 0 && (
                <div className="pt-2 border-t border-[#E5E5E5] flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[#958777] mr-1">Linked Vehicles:</span>
                  {linkedRecords.map((rec) => (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => navigate(`/dashboard/finance/vehicles/${rec.id}`)}
                      className="px-2 py-0.5 rounded-lg bg-[#EEE8F7] border border-[#DDD3ED] text-[11px] font-semibold text-[#6E5696] hover:bg-[#E4DAF4]"
                    >
                      {rec.vehicleRegistration}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <EnterpriseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Financier · ${editing.bankName}` : 'Add Bank / Financial Institution'}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="bk-name" className="dm-label">Bank / Institution Name</label>
              <input id="bk-name" required value={bankName} onChange={(e) => setBankName(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="bk-type" className="dm-label">Institution Type</label>
              <select id="bk-type" value={institutionType} onChange={(e) => setInstitutionType(e.target.value as FinancialInstitution['institutionType'])} className="dm-input text-xs">
                <option value="bank">Bank</option>
                <option value="nbfc">NBFC</option>
                <option value="oem_captive">OEM Captive</option>
                <option value="leasing_partner">Leasing Partner</option>
              </select>
            </div>
            <div>
              <label htmlFor="bk-branch" className="dm-label">Branch</label>
              <input id="bk-branch" required value={branch} onChange={(e) => setBranch(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="bk-ifsc" className="dm-label">IFSC Code</label>
              <input id="bk-ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} className="dm-input text-xs font-mono uppercase" />
            </div>
            <div>
              <label htmlFor="bk-rm" className="dm-label">Relationship Manager</label>
              <input id="bk-rm" value={relationshipManager} onChange={(e) => setRelationshipManager(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="bk-phone" className="dm-label">Contact Number</label>
              <input id="bk-phone" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="bk-email" className="dm-label">Email</label>
              <input id="bk-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="bk-method" className="dm-label">Default Payment Method</label>
              <select id="bk-method" value={defaultPaymentMethod} onChange={(e) => setDefaultPaymentMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
                <option value="nach">NACH</option>
                <option value="ecs">ECS</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input id="bk-active" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <label htmlFor="bk-active" className="font-semibold text-[#625346]">Active lending relationship</label>
          </div>

          <div>
            <label htmlFor="bk-notes" className="dm-label">Notes</label>
            <textarea id="bk-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>

          {editing && (
            <div>
              <label htmlFor="bk-reason" className="dm-label">Update Audit Reason</label>
              <input id="bk-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Updated RM contact details" className="dm-input text-xs" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-xs">
              {saving ? 'Saving...' : editing ? 'Save Institution' : 'Add Institution'}
            </button>
          </div>
        </form>
      </EnterpriseModal>
    </div>
  )
}
