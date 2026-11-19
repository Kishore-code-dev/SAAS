import React, { useMemo, useState } from 'react'
import { AlertTriangle, Building2, CheckCircle2, FileEdit, History, Mail, Save, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { useFinance } from '../../hooks/useFinance'
import { useFleet } from '../../hooks/useFleet'
import { canPerformAction } from '../../utils/rbac'
import { buildRestructuredSchedule } from '../../utils/financeEngine'
import { formatDateTime, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { FinanceStatusBadge } from '../../components/finance/FinancePrimitives'
import type {
  EmiInstalment,
  FinanceInterestType,
  FinanceNotificationSettings,
  FinancePaymentMethod,
  FinancialInstitution,
  VehicleFinanceRecord,
} from '../../types/finance'
import type { OrganizationRole } from '../../types/fleet'

type SubSection = 'banks' | 'loan_updates' | 'notifications' | 'defaults' | 'history'

function BankEditorForm({
  editingInst,
  canManageSettings,
  onSave,
}: {
  editingInst: FinancialInstitution | null
  canManageSettings: boolean
  onSave: (inst: FinancialInstitution) => void
}) {
  const { saveInstitution } = useFinance()
  const [instForm, setInstForm] = useState({
    bankName: editingInst?.bankName ?? '',
    institutionType: (editingInst?.institutionType ?? 'bank') as FinancialInstitution['institutionType'],
    branch: editingInst?.branch ?? '',
    relationshipManager: editingInst?.relationshipManager ?? '',
    contactNumber: editingInst?.contactNumber ?? '',
    email: editingInst?.email ?? '',
    ifscCode: editingInst?.ifscCode ?? '',
    defaultPaymentMethod: (editingInst?.defaultPaymentMethod ?? 'nach') as FinancePaymentMethod,
    active: editingInst?.active ?? true,
    notes: editingInst?.notes ?? '',
    reason: '',
  })

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const saved = await saveInstitution({
        id: editingInst?.id,
        bankName: instForm.bankName.trim(),
        institutionType: instForm.institutionType,
        branch: instForm.branch.trim(),
        relationshipManager: instForm.relationshipManager.trim(),
        contactNumber: instForm.contactNumber.trim(),
        email: instForm.email.trim(),
        ifscCode: instForm.ifscCode.trim().toUpperCase(),
        defaultPaymentMethod: instForm.defaultPaymentMethod,
        active: instForm.active,
        notes: instForm.notes.trim(),
        reason: instForm.reason.trim() || 'Updated via Settings -> Finance Updates',
      })
      onSave(saved)
      toast.success(`Saved institution ${saved.bankName}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save bank configuration.')
    }
  }

  return (
    <form onSubmit={handleSaveBank} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label htmlFor="s-bk-name" className="dm-label">Bank / Financier Name</label>
          <input id="s-bk-name" required value={instForm.bankName} onChange={(e) => setInstForm((f) => ({ ...f, bankName: e.target.value }))} className="dm-input text-xs" />
        </div>
        <div>
          <label htmlFor="s-bk-type" className="dm-label">Institution Type</label>
          <select id="s-bk-type" value={instForm.institutionType} onChange={(e) => setInstForm((f) => ({ ...f, institutionType: e.target.value as FinancialInstitution['institutionType'] }))} className="dm-input text-xs">
            <option value="bank">Bank</option>
            <option value="nbfc">NBFC</option>
            <option value="oem_captive">OEM Captive</option>
            <option value="leasing_partner">Leasing Partner</option>
          </select>
        </div>
        <div>
          <label htmlFor="s-bk-branch" className="dm-label">Branch</label>
          <input id="s-bk-branch" required value={instForm.branch} onChange={(e) => setInstForm((f) => ({ ...f, branch: e.target.value }))} className="dm-input text-xs" />
        </div>
        <div>
          <label htmlFor="s-bk-rm" className="dm-label">Relationship Manager</label>
          <input id="s-bk-rm" value={instForm.relationshipManager} onChange={(e) => setInstForm((f) => ({ ...f, relationshipManager: e.target.value }))} className="dm-input text-xs" />
        </div>
        <div>
          <label htmlFor="s-bk-phone" className="dm-label">Contact Number</label>
          <input id="s-bk-phone" value={instForm.contactNumber} onChange={(e) => setInstForm((f) => ({ ...f, contactNumber: e.target.value }))} className="dm-input text-xs" />
        </div>
        <div>
          <label htmlFor="s-bk-email" className="dm-label">Email</label>
          <input id="s-bk-email" type="email" value={instForm.email} onChange={(e) => setInstForm((f) => ({ ...f, email: e.target.value }))} className="dm-input text-xs" />
        </div>
        <div>
          <label htmlFor="s-bk-ifsc" className="dm-label">IFSC Code</label>
          <input id="s-bk-ifsc" value={instForm.ifscCode} onChange={(e) => setInstForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))} className="dm-input text-xs font-mono uppercase" />
        </div>
        <div>
          <label htmlFor="s-bk-method" className="dm-label">Default Payment Method</label>
          <select id="s-bk-method" value={instForm.defaultPaymentMethod} onChange={(e) => setInstForm((f) => ({ ...f, defaultPaymentMethod: e.target.value as FinancePaymentMethod }))} className="dm-input text-xs">
            <option value="nach">NACH</option>
            <option value="ecs">ECS</option>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="upi">UPI</option>
          </select>
        </div>
        <div>
          <label htmlFor="s-bk-reason" className="dm-label">Update Reason</label>
          <input id="s-bk-reason" value={instForm.reason} onChange={(e) => setInstForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Audit reason" className="dm-input text-xs" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-[#E5E5E5]">
        <label className="inline-flex items-center gap-2 font-semibold text-[#625346]">
          <input type="checkbox" checked={instForm.active} onChange={(e) => setInstForm((f) => ({ ...f, active: e.target.checked }))} />
          Active Institution
        </label>
        {canManageSettings && (
          <button type="submit" className="btn-primary text-xs">
            <Save className="w-3.5 h-3.5" />
            {editingInst ? 'Save Institution Update' : 'Add Institution'}
          </button>
        )}
      </div>
    </form>
  )
}

function LoanRevisionForm({
  activeLoan,
  instalments,
  todayIso,
  canManageSettings,
}: {
  activeLoan: VehicleFinanceRecord
  instalments: EmiInstalment[]
  todayIso: string
  canManageSettings: boolean
}) {
  const { updateFinanceTerms } = useFinance()
  const [updateMode, setUpdateMode] = useState<'edit' | 'restructure' | 'foreclose' | 'close' | 'cancel'>('restructure')
  const [loanReason, setLoanReason] = useState('')
  const [newInterestRate, setNewInterestRate] = useState<number>(activeLoan.interestRateAnnualPct)
  const [newInterestType, setNewInterestType] = useState<FinanceInterestType>(activeLoan.interestType)
  const [newTenureCount, setNewTenureCount] = useState<number>(Math.max(1, activeLoan.remainingInstalments || activeLoan.numberOfInstalments))
  const [newFirstDate, setNewFirstDate] = useState<string>(activeLoan.nextDueDate ?? todayIso)
  const [newCustomEmi, setNewCustomEmi] = useState<number>(activeLoan.emiAmount)
  const [newPayMethod, setNewPayMethod] = useState<FinancePaymentMethod>(activeLoan.paymentMethod)
  const [newNotes, setNewNotes] = useState<string>(activeLoan.notes ?? '')
  const [settlementAmount, setSettlementAmount] = useState<number>(activeLoan.outstandingPrincipal)
  const [settlementDate, setSettlementDate] = useState<string>(todayIso)
  const [settlementRef, setSettlementRef] = useState<string>('')
  const [confirmedImpact, setConfirmedImpact] = useState(false)
  const [savingLoan, setSavingLoan] = useState(false)

  const schedulePreview = useMemo(() => {
    if (updateMode !== 'restructure') return null
    const loanEmis = instalments.filter((i) => i.financeId === activeLoan.id)
    return buildRestructuredSchedule({
      record: activeLoan,
      existingInstalments: loanEmis,
      newInterestRateAnnualPct: Number(newInterestRate) || 0,
      newInterestType,
      newRemainingInstalmentsCount: Math.max(1, Number(newTenureCount) || 1),
      effectiveNextDueDate: newFirstDate || todayIso,
      customEmiAmount: newInterestType === 'custom' || newInterestType === 'lease_fixed' ? Number(newCustomEmi) || undefined : undefined,
    })
  }, [activeLoan, updateMode, instalments, newInterestRate, newInterestType, newTenureCount, newFirstDate, newCustomEmi, todayIso])

  const handleSaveLoanUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loanReason.trim()) {
      toast.error('Enter an audit update reason before applying changes.')
      return
    }
    if ((updateMode === 'restructure' || updateMode === 'foreclose' || updateMode === 'close' || updateMode === 'cancel') && !confirmedImpact) {
      toast.error('Confirm that you have reviewed the schedule impact preview.')
      return
    }
    setSavingLoan(true)
    try {
      await updateFinanceTerms(activeLoan.id, {
        mode: updateMode,
        reason: loanReason.trim(),
        confirmScheduleRevision: confirmedImpact,
        interestRateAnnualPct: Number(newInterestRate),
        interestType: newInterestType,
        numberOfInstalments: Number(newTenureCount),
        emiAmount: Number(newCustomEmi),
        firstEmiDate: newFirstDate,
        paymentMethod: newPayMethod,
        notes: newNotes,
        settlementAmountInr: Number(settlementAmount),
        settlementDate,
        settlementBankRef: settlementRef.trim() || `FORE-${activeLoan.vehicleRegistration.slice(-4)}`,
      })
      setLoanReason('')
      setConfirmedImpact(false)
      toast.success(`Applied ${updateMode} update to ${activeLoan.vehicleRegistration}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update vehicle finance agreement.')
    } finally {
      setSavingLoan(false)
    }
  }

  return (
    <form onSubmit={handleSaveLoanUpdate} className="space-y-4">
      <div>
        <label htmlFor="fu-mode" className="dm-label">Revision Action</label>
        <select
          id="fu-mode"
          value={updateMode}
          onChange={(e) => {
            setUpdateMode(e.target.value as typeof updateMode)
            setConfirmedImpact(false)
          }}
          className="dm-input text-xs"
        >
          <option value="edit">Edit Metadata / Payment Method / Notes</option>
          <option value="restructure">Restructure / Reschedule Remaining Principal</option>
          <option value="foreclose">Foreclose / Prepay Full Outstanding Principal</option>
          <option value="close">Mark Completed / Close Agreement</option>
          <option value="cancel">Cancel Finance Agreement</option>
        </select>
      </div>

      {updateMode === 'restructure' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <label htmlFor="fu-rate" className="dm-label">New Interest Rate (% p.a.)</label>
              <input id="fu-rate" type="number" step="0.05" min={0} value={newInterestRate} onChange={(e) => setNewInterestRate(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="fu-itype" className="dm-label">Interest Type</label>
              <select id="fu-itype" value={newInterestType} onChange={(e) => setNewInterestType(e.target.value as FinanceInterestType)} className="dm-input text-xs">
                <option value="reducing_balance">Reducing Balance</option>
                <option value="flat_rate">Flat Rate</option>
                <option value="lease_fixed">Lease Fixed</option>
                <option value="interest_only_balloon">Interest-Only + Balloon</option>
                <option value="custom">Custom EMI</option>
              </select>
            </div>
            <div>
              <label htmlFor="fu-cnt" className="dm-label">Remaining Instalments</label>
              <input id="fu-cnt" type="number" min={1} max={120} value={newTenureCount} onChange={(e) => setNewTenureCount(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="fu-first" className="dm-label">Effective Next EMI Date</label>
              <input id="fu-first" type="date" value={newFirstDate} onChange={(e) => setNewFirstDate(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="fu-cemi" className="dm-label">EMI Override (Custom/Lease)</label>
              <input id="fu-cemi" type="number" min={0} value={newCustomEmi} onChange={(e) => setNewCustomEmi(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
          </div>

          {schedulePreview && (
            <div className="p-4 rounded-xl bg-[#EEE8F7] border border-[#B8A3D9] space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#625346]">
                <AlertTriangle className="w-4 h-4 text-[#6E5696]" />
                Mandatory Schedule Impact Preview (Review Before Applying)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                <div>
                  <span className="text-[#958777] block">Preserved Paid/Partial EMIs</span>
                  <span className="font-bold text-[#4D6E4A] tabular-nums">{schedulePreview.preservedInstalments.length}</span>
                </div>
                <div>
                  <span className="text-[#958777] block">Remaining Principal to Reschedule</span>
                  <span className="font-bold text-[#625346] tabular-nums">{formatInr(schedulePreview.remainingPrincipalToRestructure)}</span>
                </div>
                <div>
                  <span className="text-[#958777] block">Revised Monthly EMI</span>
                  <span className="font-bold text-[#6E5696] tabular-nums">{formatInr(schedulePreview.newEmiAmount)}</span>
                </div>
                <div>
                  <span className="text-[#958777] block">New Final EMI Date</span>
                  <span className="font-bold text-[#625346] tabular-nums">{formatShortDate(schedulePreview.newFinalEmiDate)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {updateMode === 'foreclose' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
          <div>
            <label htmlFor="fu-set-amt" className="dm-label">Settlement Amount (INR)</label>
            <input id="fu-set-amt" type="number" min={0} value={settlementAmount} onChange={(e) => setSettlementAmount(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
          </div>
          <div>
            <label htmlFor="fu-set-dt" className="dm-label">Settlement Date</label>
            <input id="fu-set-dt" type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} className="dm-input text-xs tabular-nums" />
          </div>
          <div>
            <label htmlFor="fu-set-ref" className="dm-label">Bank Foreclosure UTR Ref</label>
            <input id="fu-set-ref" value={settlementRef} onChange={(e) => setSettlementRef(e.target.value)} placeholder="FORE..." className="dm-input text-xs font-mono" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="fu-paym" className="dm-label">Default Payment Method</label>
          <select id="fu-paym" value={newPayMethod} onChange={(e) => setNewPayMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
            <option value="nach">NACH</option>
            <option value="ecs">ECS</option>
            <option value="neft">NEFT</option>
            <option value="rtgs">RTGS</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label htmlFor="fu-reason" className="dm-label">Mandatory Audit Update Reason</label>
          <input
            id="fu-reason"
            required
            value={loanReason}
            onChange={(e) => setLoanReason(e.target.value)}
            placeholder="e.g. RBI repo revision or approved tenure extension"
            className="dm-input text-xs"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="fu-notes" className="dm-label">Updated Agreement Notes</label>
          <textarea id="fu-notes" rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="dm-input text-xs" />
        </div>
      </div>

      {(updateMode === 'restructure' || updateMode === 'foreclose' || updateMode === 'close' || updateMode === 'cancel') && (
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#FDF3E7] border border-[#E8C290] text-[#625346] font-semibold">
          <input type="checkbox" checked={confirmedImpact} onChange={(e) => setConfirmedImpact(e.target.checked)} className="mt-0.5" />
          <span>I have reviewed the schedule &amp; outstanding principal impact preview and confirm applying this permanent finance update.</span>
        </label>
      )}

      <div className="flex justify-end pt-2 border-t border-[#E5E5E5]">
        {canManageSettings && (
          <button type="submit" disabled={savingLoan} className="btn-primary text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {savingLoan ? 'Applying...' : 'Apply Vehicle Finance Update'}
          </button>
        )}
      </div>
    </form>
  )
}

function FinanceSettingsForm({
  mode,
  settings,
  canManageSettings,
}: {
  mode: 'notifications' | 'defaults'
  settings: FinanceNotificationSettings
  canManageSettings: boolean
}) {
  const { updateFinanceSettings } = useFinance()
  const [notifForm, setNotifForm] = useState({
    reminderDaysText: settings.reminderDaysBefore.join(', '),
    notifyAfterDueDate: settings.notifyAfterDueDate,
    overdueEscalationDays: settings.overdueEscalationDays,
    inAppEnabled: settings.inAppEnabled,
    emailEnabled: settings.emailEnabled,
    recipientRoles: settings.recipientRoles,
    recipientEmailsText: settings.recipientEmails.join(', '),
    defaultReportingPeriod: settings.defaultReportingPeriod,
    partialPaymentRule: settings.partialPaymentRule,
    dueSoonWindowDays: settings.dueSoonWindowDays,
    allowManualLateFeeEntry: settings.allowManualLateFeeEntry,
    reason: '',
  })

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    const reminderDays = notifForm.reminderDaysText
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 0)
    const recipientEmails = notifForm.recipientEmailsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      await updateFinanceSettings(
        {
          reminderDaysBefore: reminderDays.length > 0 ? reminderDays : [15, 7, 3, 1, 0],
          notifyAfterDueDate: notifForm.notifyAfterDueDate,
          overdueEscalationDays: Number(notifForm.overdueEscalationDays),
          inAppEnabled: notifForm.inAppEnabled,
          emailEnabled: notifForm.emailEnabled,
          recipientRoles: notifForm.recipientRoles,
          recipientEmails,
          defaultReportingPeriod: notifForm.defaultReportingPeriod,
          partialPaymentRule: notifForm.partialPaymentRule,
          dueSoonWindowDays: Number(notifForm.dueSoonWindowDays),
          allowManualLateFeeEntry: notifForm.allowManualLateFeeEntry,
        },
        notifForm.reason.trim() || 'Updated finance alert & default configuration',
      )
      toast.success('Saved Finance notification & default settings')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save finance settings.')
    }
  }

  if (mode === 'notifications') {
    return (
      <form onSubmit={handleSaveSettings} className="enterprise-card p-6 space-y-4 text-xs">
        <div className="border-b border-[#E5E5E5] pb-3">
          <h2 className="dm-card-title text-base">EMI &amp; Document Notification Settings</h2>
          <p className="text-xs text-[#958777]">Configure reminder lead days, overdue escalation thresholds, and honest delivery channels</p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#EEE8F7] border border-[#B8A3D9] text-[#625346] flex items-center justify-between gap-3">
          <span>
            <strong>Channel Status:</strong> In-App alerts active immediately.{' '}
            {settings.smtpConfigured ? 'SMTP Email delivery is configured.' : 'SMTP is not configured on this server — emails are never falsely marked sent.'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="fn-days" className="dm-label">Reminder Lead Days Before Due</label>
            <input id="fn-days" value={notifForm.reminderDaysText} onChange={(e) => setNotifForm((f) => ({ ...f, reminderDaysText: e.target.value }))} placeholder="15, 7, 3, 1, 0" className="dm-input text-xs tabular-nums" />
          </div>
          <div>
            <label htmlFor="fn-esc" className="dm-label">Overdue Escalation Threshold (Days)</label>
            <input id="fn-esc" type="number" min={1} max={60} value={notifForm.overdueEscalationDays} onChange={(e) => setNotifForm((f) => ({ ...f, overdueEscalationDays: Number(e.target.value) }))} className="dm-input text-xs tabular-nums" />
          </div>
          <div>
            <label htmlFor="fn-emails" className="dm-label">Recipient Emails (Comma-separated)</label>
            <input id="fn-emails" value={notifForm.recipientEmailsText} onChange={(e) => setNotifForm((f) => ({ ...f, recipientEmailsText: e.target.value }))} placeholder="finance@company.in" className="dm-input text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-5 pt-1">
          <label className="inline-flex items-center gap-2 font-medium text-[#625346]">
            <input type="checkbox" checked={notifForm.notifyAfterDueDate} onChange={(e) => setNotifForm((f) => ({ ...f, notifyAfterDueDate: e.target.checked }))} />
            Notify after due date when unpaid
          </label>
          <label className="inline-flex items-center gap-2 font-medium text-[#625346]">
            <input type="checkbox" checked={notifForm.inAppEnabled} onChange={(e) => setNotifForm((f) => ({ ...f, inAppEnabled: e.target.checked }))} />
            Enable In-App Notifications
          </label>
          <label className="inline-flex items-center gap-2 font-medium text-[#625346]">
            <input type="checkbox" checked={notifForm.emailEnabled} onChange={(e) => setNotifForm((f) => ({ ...f, emailEnabled: e.target.checked }))} />
            Enable Email Notifications (when SMTP configured)
          </label>
        </div>

        <div>
          <span className="dm-label">Recipient Organization Roles</span>
          <div className="flex flex-wrap gap-3 mt-1">
            {(['org_admin', 'finance', 'fleet_manager'] as OrganizationRole[]).map((role) => {
              const checked = notifForm.recipientRoles.includes(role)
              return (
                <label key={role} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setNotifForm((f) => ({
                        ...f,
                        recipientRoles: e.target.checked
                          ? [...f.recipientRoles, role]
                          : f.recipientRoles.filter((r) => r !== role),
                      }))
                    }
                  />
                  <span className="capitalize">{role.replace('_', ' ')}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-[#E5E5E5]">
          {canManageSettings && (
            <button type="submit" className="btn-primary text-xs">
              <Save className="w-3.5 h-3.5" />
              Save Notification Settings
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleSaveSettings} className="enterprise-card p-6 space-y-4 text-xs">
      <div className="border-b border-[#E5E5E5] pb-3">
        <h2 className="dm-card-title text-base">Organization Finance Defaults</h2>
        <p className="text-xs text-[#958777]">Currency, reporting cadence, partial payment policy, and due-soon classification window</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="fd-curr" className="dm-label">Currency &amp; Timezone</label>
          <input id="fd-curr" disabled value={`${settings.defaultCurrency} · ${settings.defaultTimezone}`} className="dm-input text-xs bg-[#FAFAFA]" />
        </div>
        <div>
          <label htmlFor="fd-rep" className="dm-label">Default Reporting Period</label>
          <select id="fd-rep" value={notifForm.defaultReportingPeriod} onChange={(e) => setNotifForm((f) => ({ ...f, defaultReportingPeriod: e.target.value as 'monthly' | 'quarterly' | 'annual' }))} className="dm-input text-xs">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label htmlFor="fd-part" className="dm-label">Partial Payment Rule</label>
          <select id="fd-part" value={notifForm.partialPaymentRule} onChange={(e) => setNotifForm((f) => ({ ...f, partialPaymentRule: e.target.value as 'allow_partial' | 'full_only' }))} className="dm-input text-xs">
            <option value="allow_partial">Allow Partial Payments</option>
            <option value="full_only">Require Full EMI Settlement</option>
          </select>
        </div>
        <div>
          <label htmlFor="fd-win" className="dm-label">Due Soon Window (Days)</label>
          <input id="fd-win" type="number" min={1} max={30} value={notifForm.dueSoonWindowDays} onChange={(e) => setNotifForm((f) => ({ ...f, dueSoonWindowDays: Number(e.target.value) }))} className="dm-input text-xs tabular-nums" />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 font-medium text-[#625346]">
        <input type="checkbox" checked={notifForm.allowManualLateFeeEntry} onChange={(e) => setNotifForm((f) => ({ ...f, allowManualLateFeeEntry: e.target.checked }))} />
        Allow explicit manual late-fee / penalty entry (late fees are never auto-assumed)
      </label>

      <div className="flex justify-end pt-2 border-t border-[#E5E5E5]">
        {canManageSettings && (
          <button type="submit" className="btn-primary text-xs">
            <Save className="w-3.5 h-3.5" />
            Save Finance Defaults
          </button>
        )}
      </div>
    </form>
  )
}

export function FinanceUpdatesSection() {
  const { activeRole, activeOrganization } = useFleet()
  const {
    institutions,
    records,
    instalments,
    settings,
    updateHistory,
    todayIso,
  } = useFinance()

  const [activeSub, setActiveSub] = useState<SubSection>('loan_updates')
  const [selectedInstId, setSelectedInstId] = useState<string>(institutions[0]?.id ?? 'new')
  const editingInst = useMemo(() => institutions.find((i) => i.id === selectedInstId) ?? null, [institutions, selectedInstId])

  const [selectedFinId, setSelectedFinId] = useState<string>(records[0]?.id ?? '')
  const activeLoan = useMemo(() => records.find((r) => r.id === selectedFinId) ?? records[0] ?? null, [records, selectedFinId])

  const canManageSettings =
    canPerformAction(activeRole, 'manage_finance_settings') || canPerformAction(activeRole, 'edit_finance_records')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED] w-fit">
        {([
          { id: 'banks', label: 'A. Bank Info Management', icon: Building2 },
          { id: 'loan_updates', label: 'B. Vehicle Finance Updates', icon: FileEdit },
          { id: 'notifications', label: 'C. Notification Settings', icon: Mail },
          { id: 'defaults', label: 'D. Finance Defaults', icon: Settings2 },
          { id: 'history', label: 'E. Update History', icon: History },
        ] as const).map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSub(tab.id)}
              className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                activeSub === tab.id ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777] hover:text-[#625346]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#6E5696]" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* A. Bank Info Management */}
      {activeSub === 'banks' && (
        <div className="enterprise-card p-6 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3">
            <div>
              <h2 className="dm-card-title text-base">Bank &amp; Financier Configuration</h2>
              <p className="text-xs text-[#958777]">Maintain bank branches, RM contacts, IFSC routing &amp; active status</p>
            </div>
            <select
              aria-label="Select bank to edit or create"
              value={selectedInstId}
              onChange={(e) => setSelectedInstId(e.target.value)}
              className="dm-input w-64 text-xs"
            >
              <option value="new">+ Create New Financial Institution</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>{i.bankName} ({i.branch})</option>
              ))}
            </select>
          </div>

          <BankEditorForm
            key={editingInst ? `${editingInst.id}-${editingInst.updatedAt}` : 'new-institution'}
            editingInst={editingInst}
            canManageSettings={canManageSettings}
            onSave={(saved) => setSelectedInstId(saved.id)}
          />
        </div>
      )}

      {/* B. Vehicle Finance Updates & Restructuring */}
      {activeSub === 'loan_updates' && (
        <div className="enterprise-card p-6 space-y-5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] pb-3">
            <div>
              <h2 className="dm-card-title text-base">Vehicle Finance Updates, Restructuring &amp; Closure</h2>
              <p className="text-xs text-[#958777]">Modify terms, reschedule remaining EMIs (preserving settled instalments), foreclose, or close loans</p>
            </div>
            {activeLoan && <FinanceStatusBadge status={activeLoan.financeStatus} />}
          </div>

          <div>
            <label htmlFor="fu-loan" className="dm-label">Select Vehicle Finance Agreement</label>
            <select
              id="fu-loan"
              value={activeLoan?.id ?? ''}
              onChange={(e) => setSelectedFinId(e.target.value)}
              className="dm-input text-xs"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicleRegistration} · {r.loanReferenceNumber} ({r.bankName} · {r.financeStatus})
                </option>
              ))}
            </select>
          </div>

          {activeLoan ? (
            <LoanRevisionForm
              key={`${activeLoan.id}-${activeLoan.updatedAt}`}
              activeLoan={activeLoan}
              instalments={instalments}
              todayIso={todayIso}
              canManageSettings={canManageSettings}
            />
          ) : (
            <p className="text-xs text-[#958777]">No vehicle finance agreements registered yet.</p>
          )}
        </div>
      )}

      {/* C. Notification Settings */}
      {activeSub === 'notifications' && (
        <FinanceSettingsForm
          key={`notif-${settings.updatedAt}`}
          mode="notifications"
          settings={settings}
          canManageSettings={canManageSettings}
        />
      )}

      {/* D. Finance Defaults */}
      {activeSub === 'defaults' && (
        <FinanceSettingsForm
          key={`defs-${settings.updatedAt}`}
          mode="defaults"
          settings={settings}
          canManageSettings={canManageSettings}
        />
      )}

      {/* E. Finance Update History */}
      {activeSub === 'history' && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <div>
              <h2 className="dm-card-title text-sm">Finance Update History</h2>
              <p className="text-xs text-[#958777]">Immutable audit trail across banks, loans, payments, documents &amp; finance settings</p>
            </div>
            <span className="text-xs font-semibold text-[#6E5696]">{updateHistory.length} audit entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Entity</th>
                  <th>Field Updated</th>
                  <th>Previous → Updated</th>
                  <th>Reason</th>
                  <th>Updated By</th>
                  <th>Approval</th>
                </tr>
              </thead>
              <tbody>
                {updateHistory.map((h) => (
                  <tr key={h.id}>
                    <td className="text-xs tabular-nums whitespace-nowrap">{formatDateTime(h.updateDate, activeOrganization.timezone)}</td>
                    <td className="text-xs capitalize">{h.entityType.replace('_', ' ')}</td>
                    <td className="font-semibold text-xs">{h.fieldName}</td>
                    <td className="text-xs">
                      <span className="text-[#958777]">{h.previousValue}</span> → <span className="font-semibold text-[#625346]">{h.updatedValue}</span>
                    </td>
                    <td className="text-xs text-[#958777]">{h.updateReason}</td>
                    <td className="text-xs whitespace-nowrap">{h.updatedBy} ({h.updatedByRole})</td>
                    <td className="text-xs capitalize font-semibold text-[#4D6E4A]">{h.approvalStatus}</td>
                  </tr>
                ))}
                {updateHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-xs text-[#958777] py-8">No finance update history entries recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
