import React, { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Lock, ShieldAlert, Upload } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '../../components/layout/PageHeader'
import { EmptySectionState, formatInr, formatShortDate } from '../../components/ui/EnterprisePrimitives'
import { EmiStatusBadge, FinanceStatusBadge } from '../../components/finance/FinancePrimitives'
import { useFleet } from '../../hooks/useFleet'
import { useFinance } from '../../hooks/useFinance'
import { canPerformAction } from '../../utils/rbac'
import { addMonthsIso, computeStandardEmiAmount } from '../../utils/financeEngine'
import { validateCompanyFinanceEligibility } from '../../utils/contractsEngine'
import { DOC_CATEGORIES, docCategoryLabel, paymentMethodLabel, readFileAsBase64 } from '../../utils/financeHelpers'
import type {
  FinanceDocCategory,
  FinanceInterestType,
  FinanceLoanType,
  FinancePaymentMethod,
  FinancialInstitution,
  VehicleFinanceRecord,
} from '../../types/finance'

export function AddVehicleFinancePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const defaultVehicleId = searchParams.get('vehicleId') ?? undefined
  const { vehicles } = useFleet()
  const { institutions, createFinanceRecord } = useFinance()

  const activeInstitutions = useMemo(() => institutions.filter((i) => i.active), [institutions])
  const eligibleVehicles = useMemo(
    () => vehicles.filter((v) => (v.ownershipCategory ?? 'company_owned') === 'company_owned'),
    [vehicles],
  )
  const blockedCount = vehicles.length - eligibleVehicles.length

  const initialVehicle =
    eligibleVehicles.find((v) => v.id === defaultVehicleId) ?? eligibleVehicles[0]
  const initialInst = activeInstitutions[0]
  const today = new Date().toISOString().slice(0, 10)

  const [submitting, setSubmitting] = useState(false)
  const [vehicleId, setVehicleId] = useState(initialVehicle?.id ?? '')
  const [ownership, setOwnership] = useState<VehicleFinanceRecord['vehicleOwnership']>('Financed')

  const [institutionId, setInstitutionId] = useState<string>(initialInst?.id ?? 'custom')
  const [bankName, setBankName] = useState(initialInst?.bankName ?? '')
  const [institutionName, setInstitutionName] = useState(initialInst?.bankName ?? '')
  const [branch, setBranch] = useState(initialInst?.branch ?? '')
  const [rmName, setRmName] = useState(initialInst?.relationshipManager ?? '')
  const [contactNumber, setContactNumber] = useState(initialInst?.contactNumber ?? '')
  const [email, setEmail] = useState(initialInst?.email ?? '')
  const [loanAccountNumber, setLoanAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState(initialInst?.ifscCode ?? '')

  const [loanReferenceNumber, setLoanReferenceNumber] = useState(`LN-${today.slice(0, 4)}-NEW`)
  const [loanType, setLoanType] = useState<FinanceLoanType>('commercial_vehicle_loan')
  const [customLoanTypeLabel, setCustomLoanTypeLabel] = useState('')
  const [principalAmount, setPrincipalAmount] = useState(1250000)
  const [downPayment, setDownPayment] = useState(250000)
  const [interestRate, setInterestRate] = useState(9.25)
  const [interestType, setInterestType] = useState<FinanceInterestType>('reducing_balance')
  const [loanStartDate, setLoanStartDate] = useState(today)
  const [loanTenureMonths, setLoanTenureMonths] = useState(24)
  const [numberOfInstalments, setNumberOfInstalments] = useState(24)
  const [customEmiOverride, setCustomEmiOverride] = useState<string>('')
  const [firstEmiDate, setFirstEmiDate] = useState(addMonthsIso(today, 1))
  const [processingFees, setProcessingFees] = useState(7500)
  const [otherCharges, setOtherCharges] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod>(initialInst?.defaultPaymentMethod ?? 'nach')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [docs, setDocs] = useState<
    Array<{ category: FinanceDocCategory; title: string; fileName: string; mimeType: string; contentBase64: string }>
  >([])

  const selectedVehicle = eligibleVehicles.find((v) => v.id === vehicleId) ?? eligibleVehicles[0]
  const netFinanced = Math.max(0, Number(principalAmount) - Number(downPayment))
  const computedEmi = computeStandardEmiAmount(
    netFinanced,
    Number(interestRate),
    Math.max(1, Number(numberOfInstalments)),
    interestType,
    customEmiOverride ? Number(customEmiOverride) : undefined,
  )
  const finalEmiDate = addMonthsIso(firstEmiDate, Math.max(0, Number(numberOfInstalments) - 1))

  const handleSelectInstitution = (id: string) => {
    setInstitutionId(id)
    const found = institutions.find((i) => i.id === id)
    if (found) {
      setBankName(found.bankName)
      setInstitutionName(found.bankName)
      setBranch(found.branch)
      setRmName(found.relationshipManager)
      setContactNumber(found.contactNumber)
      setEmail(found.email)
      setIfscCode(found.ifscCode)
      setPaymentMethod(found.defaultPaymentMethod)
    }
  }

  const handleDocAttach = (category: FinanceDocCategory, label: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const contentBase64 = await readFileAsBase64(file)
      setDocs((prev) => [
        ...prev.filter((d) => d.category !== category || category === 'other_supporting_docs'),
        {
          category,
          title: `${label} · ${selectedVehicle?.registrationNumber ?? ''}`,
          fileName: file.name,
          mimeType: file.type || 'application/pdf',
          contentBase64,
        },
      ])
      toast.success(`Attached ${file.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to attach file.')
    } finally {
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!selectedVehicle) {
      setFormError('No company-owned vehicle is selected. Third-party vehicles cannot carry company loans.')
      return
    }
    const eligibilityError = validateCompanyFinanceEligibility(selectedVehicle)
    if (eligibilityError) {
      setFormError(eligibilityError)
      toast.error(eligibilityError)
      return
    }
    setSubmitting(true)
    try {
      const created = await createFinanceRecord({
        vehicleId: selectedVehicle.id,
        vehicleRegistration: selectedVehicle.registrationNumber,
        vehicleName: `${selectedVehicle.make} ${selectedVehicle.model}`,
        vehicleMakeModel: `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.year})`,
        vehicleOwnership: ownership,
        institutionId: institutionId !== 'custom' ? institutionId : null,
        bankName,
        institutionName: institutionName || bankName,
        branch,
        relationshipManager: rmName,
        contactNumber,
        email,
        loanAccountNumber,
        ifscCode,
        loanReferenceNumber,
        loanType,
        customLoanTypeLabel: loanType === 'other' ? customLoanTypeLabel : undefined,
        principalAmount: Number(principalAmount),
        downPayment: Number(downPayment),
        interestRateAnnualPct: Number(interestRate),
        interestType,
        loanStartDate,
        loanTenureMonths: Number(loanTenureMonths),
        numberOfInstalments: Number(numberOfInstalments),
        emiAmount: customEmiOverride ? Number(customEmiOverride) : computedEmi,
        firstEmiDate,
        finalEmiDate,
        processingFees: Number(processingFees),
        otherCharges: Number(otherCharges),
        paymentMethod,
        notes,
        initialDocuments: docs,
      })
      toast.success(`Vehicle finance registered for ${selectedVehicle.registrationNumber}`)
      navigate(`/dashboard/finance/vehicles/${created.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to register vehicle finance.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Add Vehicle Finance"
        subtitle="Register vehicle loan, lease, or hire purchase agreement with automated EMI schedule"
      >
        <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Finance Register
        </button>
      </PageHeader>

      {blockedCount > 0 && (
        <div className="p-3.5 rounded-[10px] bg-[#FDF3E7] border border-[#F0D9B5] text-xs text-[#8F6510] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {blockedCount} third-party vehicle(s) (Contracted Fleet / Individual Owner) are automatically excluded from Company Vehicle Finance Loans. Manage supplier obligations under Vehicle Contracts.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-6 text-xs">
        {formError && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] font-semibold text-[#A24034]">
            {formError}
          </div>
        )}

        <section className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <h3 className="text-sm font-bold text-[#625346]">1. Company-Owned Vehicle Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="vf-veh" className="dm-label">Company-Owned Vehicle *</label>
              <select id="vf-veh" value={selectedVehicle?.id ?? ''} onChange={(e) => setVehicleId(e.target.value)} className="dm-input text-xs">
                {eligibleVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} — {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="dm-label">Vehicle Ownership Status</label>
              <select value={ownership} onChange={(e) => setOwnership(e.target.value as VehicleFinanceRecord['vehicleOwnership'])} className="dm-input text-xs">
                <option value="Financed">Financed (Hypothecated)</option>
                <option value="Leased">Leased</option>
                <option value="Owned">Owned (Refinance)</option>
              </select>
            </div>
            <div>
              <span className="dm-label">Make &amp; Model</span>
              <div className="dm-input bg-[#FAFAFA] text-[#958777] text-xs">
                {selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.year})` : 'No eligible vehicle'}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <h3 className="text-sm font-bold text-[#625346]">2. Financing Institution &amp; Banker Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="vf-inst" className="dm-label">Select Saved Bank</label>
              <select id="vf-inst" value={institutionId} onChange={(e) => handleSelectInstitution(e.target.value)} className="dm-input text-xs">
                {activeInstitutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.bankName} ({i.branch})
                  </option>
                ))}
                <option value="custom">Custom / New Bank Entry</option>
              </select>
            </div>
            <div>
              <label htmlFor="vf-bank" className="dm-label">Bank Name *</label>
              <input id="vf-bank" required value={bankName} onChange={(e) => setBankName(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-branch" className="dm-label">Branch</label>
              <input id="vf-branch" value={branch} onChange={(e) => setBranch(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-rm" className="dm-label">Relationship Manager</label>
              <input id="vf-rm" value={rmName} onChange={(e) => setRmName(e.target.value)} className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-acc" className="dm-label">Loan Account Number *</label>
              <input id="vf-acc" required value={loanAccountNumber} onChange={(e) => setLoanAccountNumber(e.target.value)} placeholder="Stored masked" className="dm-input text-xs font-mono" />
            </div>
            <div>
              <label htmlFor="vf-ifsc" className="dm-label">IFSC Code</label>
              <input id="vf-ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} className="dm-input text-xs font-mono uppercase" />
            </div>
          </div>
        </section>

        <section className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <h3 className="text-sm font-bold text-[#625346]">3. Loan Terms &amp; EMI Calculation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="vf-ref" className="dm-label">Loan Reference Number *</label>
              <input id="vf-ref" required value={loanReferenceNumber} onChange={(e) => setLoanReferenceNumber(e.target.value)} className="dm-input text-xs font-mono" />
            </div>
            <div>
              <label htmlFor="vf-type" className="dm-label">Loan Type</label>
              <select id="vf-type" value={loanType} onChange={(e) => setLoanType(e.target.value as FinanceLoanType)} className="dm-input text-xs">
                <option value="commercial_vehicle_loan">Commercial Vehicle Loan</option>
                <option value="vehicle_loan">Vehicle Loan</option>
                <option value="lease">Lease</option>
                <option value="hire_purchase">Hire Purchase</option>
                <option value="other">Other</option>
              </select>
            </div>
            {loanType === 'other' && (
              <div>
                <label className="dm-label">Custom Loan Type Label</label>
                <input value={customLoanTypeLabel} onChange={(e) => setCustomLoanTypeLabel(e.target.value)} className="dm-input text-xs" />
              </div>
            )}
            <div>
              <label className="dm-label">Principal / Asset Cost (INR) *</label>
              <input type="number" min={1000} required value={principalAmount} onChange={(e) => setPrincipalAmount(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Down Payment (INR)</label>
              <input type="number" min={0} value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Interest Rate (% p.a.) *</label>
              <input type="number" step="0.05" min={0} required value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Interest Method</label>
              <select value={interestType} onChange={(e) => setInterestType(e.target.value as FinanceInterestType)} className="dm-input text-xs">
                <option value="reducing_balance">Reducing Balance</option>
                <option value="flat">Flat Interest</option>
                <option value="custom_emi">Custom EMI</option>
              </select>
            </div>
            <div>
              <label className="dm-label">Loan Start Date</label>
              <input type="date" value={loanStartDate} onChange={(e) => setLoanStartDate(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Tenure (Months)</label>
              <input type="number" min={1} value={loanTenureMonths} onChange={(e) => setLoanTenureMonths(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Number of EMIs *</label>
              <input
                type="number"
                min={1}
                required
                value={numberOfInstalments}
                onChange={(e) => setNumberOfInstalments(Number(e.target.value))}
                className="dm-input text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="dm-label">First EMI Date *</label>
              <input type="date" required value={firstEmiDate} onChange={(e) => setFirstEmiDate(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Custom EMI Override (Optional)</label>
              <input type="number" value={customEmiOverride} onChange={(e) => setCustomEmiOverride(e.target.value)} placeholder={`Auto: ${computedEmi}`} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Processing Fees (INR)</label>
              <input type="number" min={0} value={processingFees} onChange={(e) => setProcessingFees(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Other Charges (INR)</label>
              <input type="number" min={0} value={otherCharges} onChange={(e) => setOtherCharges(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label className="dm-label">Default Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
                <option value="nach">NACH</option>
                <option value="ecs">ECS</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="imps">IMPS</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#EEE8F7]/65 border border-[#DDD3ED] grid grid-cols-3 gap-3">
            <div>
              <span className="text-[#958777] block">Net Financed Principal</span>
              <span className="font-bold text-sm text-[#625346] tabular-nums">{formatInr(netFinanced)}</span>
            </div>
            <div>
              <span className="text-[#958777] block">Scheduled Monthly EMI</span>
              <span className="font-bold text-sm text-[#6E5696] tabular-nums">{formatInr(customEmiOverride ? Number(customEmiOverride) : computedEmi)}</span>
            </div>
            <div>
              <span className="text-[#958777] block">Final EMI Maturity Date</span>
              <span className="font-bold text-sm text-[#625346] tabular-nums">{finalEmiDate}</span>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#625346]">4. Supporting Agreement Documents (Optional)</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['loan_agreement', 'Loan Agreement'],
                ['sanction_letter', 'Sanction Letter'],
                ['repayment_schedule', 'Repayment Schedule'],
              ] as Array<[FinanceDocCategory, string]>
            ).map(([cat, label]) => (
              <label key={cat} className="btn-secondary text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Attach {label}
                <input type="file" accept=".pdf,image/*" onChange={handleDocAttach(cat, label)} className="hidden" />
              </label>
            ))}
          </div>
          {docs.length > 0 && (
            <p className="text-[11px] text-[#4D6E4A] font-semibold">Attached: {docs.map((d) => d.fileName).join(', ')}</p>
          )}
          <div>
            <label className="dm-label">Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
          <button type="button" onClick={() => navigate('/dashboard/finance/vehicles')} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={submitting || !selectedVehicle} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {submitting ? 'Saving Agreement...' : 'Create Vehicle Finance'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function FinanceEmiPayPage() {
  const { emiId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { activeRole } = useFleet()
  const { records, instalments, settings, todayIso, maskedForRole, recordEmiPayment, updateEmiStatusOrFee } = useFinance()

  const initialEmi = instalments.find((i) => i.id === emiId)
  const [selectedFinanceId, setSelectedFinanceId] = useState(initialEmi?.financeId ?? records[0]?.id ?? '')
  const openLoans = useMemo(
    () => records.filter((r) => r.financeStatus !== 'completed' && r.financeStatus !== 'foreclosed' && r.financeStatus !== 'cancelled'),
    [records],
  )
  const loanEmis = useMemo(
    () =>
      instalments
        .filter((i) => i.financeId === selectedFinanceId && i.status !== 'paid' && i.status !== 'waived' && i.status !== 'cancelled')
        .sort((a, b) => a.emiNumber - b.emiNumber),
    [instalments, selectedFinanceId],
  )
  const [pickedEmiId, setPickedEmiId] = useState(initialEmi?.id ?? '')
  const instalment = initialEmi ?? loanEmis.find((e) => e.id === pickedEmiId) ?? loanEmis[0] ?? null
  const record = instalment ? records.find((r) => r.id === instalment.financeId) ?? null : null

  const defaultRef = instalment && record
    ? `UTR-${record.loanReferenceNumber.replace(/[^A-Z0-9]/gi, '').slice(-4) || 'FIN'}-${String(instalment.emiNumber).padStart(2, '0')}`
    : `UTR-${Date.now()}`

  const [amountInr, setAmountInr] = useState<number>(instalment?.remainingAmount ?? 0)
  const [manualLateFeeInr, setManualLateFeeInr] = useState<number>(0)
  const [paymentDate, setPaymentDate] = useState<string>(todayIso)
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod>(record?.paymentMethod ?? 'neft')
  const [bankTransactionRef, setBankTransactionRef] = useState<string>(defaultRef)
  const [notes, setNotes] = useState<string>('')
  const [receipt, setReceipt] = useState<{ fileName: string; mimeType: string; contentBase64: string } | undefined>()
  const [saving, setSaving] = useState(false)

  // Standalone late fee form if ?lateFee=1
  const [lateFeeOnlyAmt, setLateFeeOnlyAmt] = useState(500)
  const [lateFeeOnlyReason, setLateFeeOnlyReason] = useState('')
  const [savingFee, setSavingFee] = useState(false)

  const canPay = canPerformAction(activeRole, 'record_finance_payments')
  const canAddLateFee =
    settings.allowManualLateFeeEntry &&
    (canPerformAction(activeRole, 'edit_finance_records') || canPerformAction(activeRole, 'reconcile_finance_payments'))

  React.useEffect(() => {
    if (instalment) {
      setAmountInr(instalment.remainingAmount)
    }
  }, [instalment])

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const contentBase64 = await readFileAsBase64(file)
      setReceipt({ fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 })
      toast.success(`Attached receipt: ${file.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to attach receipt.')
    } finally {
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instalment) return
    setSaving(true)
    try {
      await recordEmiPayment(instalment.id, {
        amountInr: Number(amountInr),
        manualLateFeeInr: canAddLateFee ? Number(manualLateFeeInr || 0) : 0,
        paymentDate,
        paymentMethod,
        bankTransactionRef,
        notes,
        receiptUpload: receipt,
      })
      toast.success(`Recorded payment of ${formatInr(amountInr)} for EMI #${instalment.emiNumber}`)
      navigate(record ? `/dashboard/finance/vehicles/${record.id}` : '/dashboard/finance/payments')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record payment.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddLateFeeOnly = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!instalment) return
    setSavingFee(true)
    try {
      await updateEmiStatusOrFee(instalment.id, {
        action: 'add_late_fee',
        lateFeeInr: Number(lateFeeOnlyAmt),
        reason: lateFeeOnlyReason.trim() || 'Manual late fee entry confirmed on financier notice',
      })
      toast.success(`Added late fee of ${formatInr(lateFeeOnlyAmt)} to EMI #${instalment.emiNumber}`)
      navigate('/dashboard/finance/overdue')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to record late fee.')
    } finally {
      setSavingFee(false)
    }
  }

  if (!instalment || !record) {
    return (
      <EmptySectionState
        title="No open EMI instalment selected"
        description="Select a loan or active EMI instalment from the schedule or payment history."
        actionLabel="Return to EMI Schedule"
        onAction={() => navigate('/dashboard/finance/emis')}
      />
    )
  }

  const showLateFeeMode = searchParams.get('lateFee') === '1'

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={`EMI #${instalment.emiNumber} · ${record.vehicleRegistration}`}
        subtitle={`${record.bankName} · Loan Ref ${record.loanReferenceNumber} · Due ${formatShortDate(instalment.dueDate)}`}
      >
        <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </PageHeader>

      {!initialEmi && (
        <div className="enterprise-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="dm-label">1. Select Vehicle Loan</label>
            <select
              value={selectedFinanceId}
              onChange={(e) => {
                setSelectedFinanceId(e.target.value)
                setPickedEmiId('')
              }}
              className="dm-input text-xs"
            >
              {openLoans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.vehicleRegistration} · {l.bankName} ({l.loanReferenceNumber})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="dm-label">2. Select Open EMI</label>
            <select
              value={instalment.id}
              onChange={(e) => setPickedEmiId(e.target.value)}
              className="dm-input text-xs"
            >
              {loanEmis.map((e) => (
                <option key={e.id} value={e.id}>
                  EMI #{e.emiNumber} · Due {formatShortDate(e.dueDate)} · Bal {formatInr(e.remainingAmount)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Detailed EMI Breakdown */}
      <div className="enterprise-card p-5 space-y-4 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[#958777]">EMI Breakdown · Reference {maskedForRole ? record.loanAccountMasked : record.loanAccountNumber}</p>
            <p className="font-bold text-base text-[#625346] tabular-nums">
              Remaining Balance: {formatInr(instalment.remainingAmount)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FinanceStatusBadge status={record.financeStatus} />
            <EmiStatusBadge status={instalment.status} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['EMI Amount', formatInr(instalment.emiAmount)],
            ['Principal Component', formatInr(instalment.principalComponent)],
            ['Interest Component', formatInr(instalment.interestComponent)],
            ['Manual Late Fee', instalment.lateFeeInr > 0 ? formatInr(instalment.lateFeeInr) : 'None'],
            ['Amount Paid', formatInr(instalment.amountPaid)],
            ['Payment Mode', paymentMethodLabel(record.paymentMethod)],
          ].map(([k, v]) => (
            <div key={k} className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
              <span className="text-[#958777] block">{k}</span>
              <span className="font-bold text-[#625346] tabular-nums mt-0.5 block">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {showLateFeeMode && canAddLateFee && (
        <form onSubmit={handleAddLateFeeOnly} className="enterprise-card p-6 space-y-4 text-xs border-[#D8B442]">
          <h2 className="text-sm font-bold text-[#625346]">Add Manual Late Fee Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="dm-label">Late Fee / Penalty Amount (INR)</label>
              <input
                type="number"
                min={1}
                required
                value={lateFeeOnlyAmt}
                onChange={(e) => setLateFeeOnlyAmt(Number(e.target.value))}
                className="dm-input text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="dm-label">Financier Notice Reason *</label>
              <input
                required
                value={lateFeeOnlyReason}
                onChange={(e) => setLateFeeOnlyReason(e.target.value)}
                placeholder="e.g., Bank NACH bounce fee notice"
                className="dm-input text-xs"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingFee} className="btn-primary text-xs">
              {savingFee ? 'Applying...' : 'Apply Manual Late Fee'}
            </button>
          </div>
        </form>
      )}

      {canPay && instalment.status !== 'paid' && instalment.status !== 'waived' && instalment.status !== 'cancelled' && (
        <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-[#625346]">Record EMI Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rp-amt" className="dm-label">Payment Amount (INR)</label>
              <input
                id="rp-amt"
                type="number"
                step="0.01"
                min={1}
                required
                value={amountInr}
                onChange={(e) => setAmountInr(Number(e.target.value))}
                className="dm-input text-xs tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="rp-date" className="dm-label">Payment Date</label>
              <input id="rp-date" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="rp-method" className="dm-label">Payment Method</label>
              <select id="rp-method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
                <option value="nach">NACH</option>
                <option value="ecs">ECS</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="imps">IMPS</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <label htmlFor="rp-ref" className="dm-label">Bank Transaction / UTR Ref</label>
              <input id="rp-ref" required value={bankTransactionRef} onChange={(e) => setBankTransactionRef(e.target.value)} className="dm-input text-xs font-mono" />
            </div>
            {canAddLateFee && (
              <div>
                <label htmlFor="rp-late" className="dm-label">Manual Late Fee / Penalty (Optional)</label>
                <input
                  id="rp-late"
                  type="number"
                  min={0}
                  value={manualLateFeeInr}
                  onChange={(e) => setManualLateFeeInr(Number(e.target.value))}
                  className="dm-input text-xs tabular-nums"
                />
              </div>
            )}
            <div>
              <span className="dm-label">Receipt Attachment (Optional)</span>
              <label className="btn-secondary text-xs w-full cursor-pointer justify-center">
                <Upload className="w-3.5 h-3.5" />
                {receipt ? receipt.fileName : 'Upload Receipt PDF/Image'}
                <input type="file" accept=".pdf,image/*" onChange={handleReceipt} className="hidden" />
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="rp-notes" className="dm-label">Notes</label>
            <textarea id="rp-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="dm-input text-xs" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
            <button type="button" onClick={() => navigate(-1)} className="btn-secondary text-xs">Cancel</button>
            <button type="submit" disabled={saving} className="btn-accent text-xs">
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'Recording...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      )}

      {maskedForRole && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-[#EEE8F7] border border-[#DDD3ED] text-xs text-[#625346]">
          <Lock className="w-4 h-4 text-[#6E5696] shrink-0" />
          <span>Full loan account details are masked for your role.</span>
        </div>
      )}
    </div>
  )
}

export function FinancePaymentCorrectionPage() {
  const { paymentId } = useParams()
  const navigate = useNavigate()
  const { payments, correctPayment } = useFinance()
  const tx = payments.find((p) => p.id === paymentId)

  const [corrAmount, setCorrAmount] = useState(tx?.amountInr ?? 0)
  const [corrRef, setCorrRef] = useState(tx?.bankTransactionRef ?? '')
  const [corrReason, setCorrReason] = useState('')
  const [saving, setSaving] = useState(false)

  if (!tx) {
    return (
      <EmptySectionState
        title="Payment transaction not found"
        description="Unable to locate the payment entry for correction."
        actionLabel="Back to Payment History"
        onAction={() => navigate('/dashboard/finance/payments')}
      />
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!corrReason.trim()) {
      toast.error('Audit reason is required.')
      return
    }
    setSaving(true)
    try {
      await correctPayment(tx.id, {
        correctedAmountInr: Number(corrAmount),
        bankTransactionRef: corrRef.trim(),
        reason: corrReason.trim(),
      })
      toast.success(`Posted audit-logged correction for EMI #${tx.emiNumber}`)
      navigate('/dashboard/finance/payments')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to post correction.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={`Audit-Logged Payment Correction · EMI #${tx.emiNumber}`}
        subtitle={`Superseding original entry (${formatInr(tx.amountInr)} · ${tx.bankTransactionRef}) with full audit preservation`}
      >
        <button type="button" onClick={() => navigate('/dashboard/finance/payments')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Payment History
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="dm-label">Corrected Amount (INR) *</label>
            <input type="number" step="0.01" min={1} required value={corrAmount} onChange={(e) => setCorrAmount(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
          </div>
          <div>
            <label className="dm-label">Corrected Bank Transaction Ref *</label>
            <input required value={corrRef} onChange={(e) => setCorrRef(e.target.value)} className="dm-input text-xs font-mono" />
          </div>
        </div>
        <div>
          <label className="dm-label">Mandatory Audit Reason *</label>
          <textarea rows={3} required value={corrReason} onChange={(e) => setCorrReason(e.target.value)} placeholder="Explain variance from bank reconciliation statement..." className="dm-input text-xs" />
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/finance/payments')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Posting...' : 'Post Correction Entry'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function BankFormPage() {
  const { bankId } = useParams()
  const navigate = useNavigate()
  const { institutions, saveInstitution } = useFinance()
  const editing = bankId ? institutions.find((i) => i.id === bankId) : undefined

  const [bankName, setBankName] = useState(editing?.bankName ?? '')
  const [institutionType, setInstitutionType] = useState<FinancialInstitution['institutionType']>(editing?.institutionType ?? 'bank')
  const [branch, setBranch] = useState(editing?.branch ?? '')
  const [relationshipManager, setRelationshipManager] = useState(editing?.relationshipManager ?? '')
  const [contactNumber, setContactNumber] = useState(editing?.contactNumber ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [ifscCode, setIfscCode] = useState(editing?.ifscCode ?? '')
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<FinancePaymentMethod>(editing?.defaultPaymentMethod ?? 'nach')
  const [active, setActive] = useState(editing?.active ?? true)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

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
      navigate('/dashboard/finance/banks')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save institution.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={editing ? `Edit Financier — ${editing.bankName}` : 'Add Bank / Financier'}
        subtitle="Maintain bank branch, relationship manager, IFSC routing, and default NACH/ECS method"
      >
        <button type="button" onClick={() => navigate('/dashboard/finance/banks')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Banks Directory
        </button>
      </PageHeader>

      <form onSubmit={handleSave} className="enterprise-card p-6 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="dm-label">Bank / Financier Name *</label>
            <input required value={bankName} onChange={(e) => setBankName(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="dm-label">Institution Type</label>
            <select value={institutionType} onChange={(e) => setInstitutionType(e.target.value as FinancialInstitution['institutionType'])} className="dm-input text-xs">
              <option value="bank">Bank</option>
              <option value="nbfc">NBFC</option>
              <option value="leasing_company">Leasing Company</option>
              <option value="oem_finance">OEM Finance</option>
            </select>
          </div>
          <div>
            <label className="dm-label">Branch</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="dm-label">IFSC Code</label>
            <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} className="dm-input text-xs font-mono uppercase" />
          </div>
          <div>
            <label className="dm-label">Relationship Manager</label>
            <input value={relationshipManager} onChange={(e) => setRelationshipManager(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="dm-label">Contact Number</label>
            <input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="dm-label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="dm-label">Default Payment Method</label>
            <select value={defaultPaymentMethod} onChange={(e) => setDefaultPaymentMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
              <option value="nach">NACH</option>
              <option value="ecs">ECS</option>
              <option value="neft">NEFT</option>
              <option value="rtgs">RTGS</option>
              <option value="imps">IMPS</option>
              <option value="upi">UPI</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 font-semibold text-[#625346]">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active Lending Partner
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="dm-label">Audit Reason / Notes</label>
            <input value={reason || notes} onChange={(e) => { setReason(e.target.value); setNotes(e.target.value) }} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/dashboard/finance/banks')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving...' : editing ? 'Update Financier' : 'Add Financier'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function FinanceDocumentUploadPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const replaceId = searchParams.get('replaceId') ?? undefined
  const { records, documents, uploadFinanceDocument } = useFinance()

  const replacingDoc = replaceId ? documents.find((d) => d.id === replaceId) : undefined
  const [formFinanceId, setFormFinanceId] = useState(replacingDoc?.financeId ?? records[0]?.id ?? '')
  const [formCategory, setFormCategory] = useState<FinanceDocCategory>(replacingDoc?.category ?? 'loan_agreement')
  const [formTitle, setFormTitle] = useState(replacingDoc?.title ?? '')
  const [formExpiry, setFormExpiry] = useState(replacingDoc?.expiryDate ?? '')
  const [formRenewal, setFormRenewal] = useState(replacingDoc?.requiresRenewal ?? false)
  const [formNotes, setFormNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ fileName: string; mimeType: string; contentBase64: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File exceeds 5 MB limit.')
      return
    }
    try {
      const contentBase64 = await readFileAsBase64(file)
      setSelectedFile({ fileName: file.name, mimeType: file.type || 'application/pdf', contentBase64 })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to read file.')
    } finally {
      e.target.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile) {
      toast.error('Select a PDF or image file first.')
      return
    }
    const rec = records.find((r) => r.id === formFinanceId)
    if (!rec) {
      toast.error('Select a valid vehicle finance agreement.')
      return
    }
    setUploading(true)
    try {
      await uploadFinanceDocument({
        financeId: rec.id,
        vehicleId: rec.vehicleId,
        category: formCategory,
        title: formTitle.trim() || `${docCategoryLabel(formCategory)} · ${rec.vehicleRegistration}`,
        expiryDate: formExpiry || undefined,
        requiresRenewal: formRenewal,
        parentDocId: replacingDoc?.id,
        notes: formNotes.trim() || undefined,
        fileName: selectedFile.fileName,
        mimeType: selectedFile.mimeType,
        contentBase64: selectedFile.contentBase64,
      })
      toast.success(replacingDoc ? `Uploaded version v${replacingDoc.version + 1}` : 'Finance document uploaded')
      navigate('/dashboard/finance/documents')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={replacingDoc ? `Upload New Version (v${replacingDoc.version + 1}) — ${replacingDoc.title}` : 'Upload Finance Document'}
        subtitle="Attach loan agreements, sanction letters, NOCs, foreclosure documents, or bank statements"
      >
        <button type="button" onClick={() => navigate('/dashboard/finance/documents')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Finance Documents
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="dm-label">Vehicle Finance Agreement *</label>
            <select value={formFinanceId} disabled={Boolean(replacingDoc)} onChange={(e) => setFormFinanceId(e.target.value)} className="dm-input text-xs">
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.vehicleRegistration} · {r.bankName} ({r.loanReferenceNumber})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="dm-label">Category *</label>
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as FinanceDocCategory)} className="dm-input text-xs">
              {DOC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="dm-label">Document Title</label>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="dm-input text-xs" />
          </div>
          <div>
            <label className="dm-label">Expiry Date (Optional)</label>
            <input type="date" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} className="dm-input text-xs" />
          </div>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 font-semibold text-[#625346]">
              <input type="checkbox" checked={formRenewal} onChange={(e) => setFormRenewal(e.target.checked)} />
              Flag for renewal reminder before expiry
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="btn-secondary text-xs cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              {selectedFile ? selectedFile.fileName : 'Choose PDF or Image File (max 5 MB)'}
              <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="dm-label">Notes</label>
            <input value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="dm-input text-xs" />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => navigate('/dashboard/finance/documents')} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={uploading} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Save Document'}
          </button>
        </div>
      </form>
    </div>
  )
}
