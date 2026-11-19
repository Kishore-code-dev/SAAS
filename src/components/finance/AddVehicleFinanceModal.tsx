import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Upload } from 'lucide-react'
import { EnterpriseModal, formatInr } from '../ui/EnterprisePrimitives'
import { useFleet } from '../../hooks/useFleet'
import { useFinance } from '../../hooks/useFinance'
import { addMonthsIso, computeStandardEmiAmount } from '../../utils/financeEngine'
import type {
  FinanceDocCategory,
  FinanceInterestType,
  FinanceLoanType,
  FinancePaymentMethod,
  VehicleFinanceRecord,
} from '../../types/finance'
import { readFileAsBase64 } from '../../utils/financeHelpers'

export default function AddVehicleFinanceModal({
  open,
  onClose,
  defaultVehicleId,
}: {
  open: boolean
  onClose: () => void
  defaultVehicleId?: string
}) {
  const { vehicles } = useFleet()
  const { institutions, createFinanceRecord } = useFinance()
  const activeInstitutions = useMemo(() => institutions.filter((i) => i.active), [institutions])

  const initialVehicle = vehicles.find((v) => v.id === defaultVehicleId) ?? vehicles[0]
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

  const [docs, setDocs] = useState<
    Array<{ category: FinanceDocCategory; title: string; fileName: string; mimeType: string; contentBase64: string }>
  >([])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0]
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
    if (!selectedVehicle) {
      toast.error('Select a vehicle before saving.')
      return
    }
    setSubmitting(true)
    try {
      await createFinanceRecord({
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
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to register vehicle finance.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <EnterpriseModal
      open={open}
      onClose={onClose}
      title="Add Vehicle Finance"
      subtitle="Register vehicle loan, lease, or hire purchase agreement with automated EMI schedule"
      maxWidthClass="max-w-4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {/* 1. Vehicle Information */}
        <section className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <h3 className="text-sm font-bold text-[#625346]">1. Vehicle Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="vf-veh" className="dm-label">Select Vehicle</label>
              <select
                id="vf-veh"
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="dm-input text-xs"
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.registrationNumber} · {v.make} {v.model}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="vf-reg" className="dm-label">Registration Number</label>
              <input id="vf-reg" readOnly value={selectedVehicle?.registrationNumber ?? ''} className="dm-input text-xs bg-[#FAFAFA]" />
            </div>
            <div>
              <label htmlFor="vf-mm" className="dm-label">Vehicle Make & Model</label>
              <input
                id="vf-mm"
                readOnly
                value={selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.year})` : ''}
                className="dm-input text-xs bg-[#FAFAFA]"
              />
            </div>
            <div>
              <label htmlFor="vf-own" className="dm-label">Vehicle Ownership</label>
              <select
                id="vf-own"
                value={ownership}
                onChange={(e) => setOwnership(e.target.value as VehicleFinanceRecord['vehicleOwnership'])}
                className="dm-input text-xs"
              >
                <option value="Financed">Financed</option>
                <option value="Leased">Leased</option>
                <option value="Hire Purchase">Hire Purchase</option>
                <option value="Owned">Owned</option>
              </select>
            </div>
          </div>
        </section>

        {/* 2. Financier Information */}
        <section className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#625346]">2. Financier Information</h3>
            <select
              aria-label="Prefill from Saved Bank"
              value={institutionId}
              onChange={(e) => handleSelectInstitution(e.target.value)}
              className="dm-input text-xs w-auto min-w-[230px]"
            >
              <option value="custom">Enter New Bank / Financier</option>
              {activeInstitutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.bankName} ({i.ifscCode})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="vf-bank" className="dm-label">Bank Name</label>
              <input id="vf-bank" required value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank Commercial" className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-inst" className="dm-label">Financial Institution</label>
              <input id="vf-inst" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="e.g. HDFC Bank Ltd" className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-branch" className="dm-label">Branch</label>
              <input id="vf-branch" required value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Commercial Hub Branch" className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-rm" className="dm-label">Relationship Manager</label>
              <input id="vf-rm" value={rmName} onChange={(e) => setRmName(e.target.value)} placeholder="RM Name" className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-phone" className="dm-label">Contact Number</label>
              <input id="vf-phone" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="+91 ..." className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-email" className="dm-label">Email</label>
              <input id="vf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="desk@bank.com" className="dm-input text-xs" />
            </div>
            <div>
              <label htmlFor="vf-acc" className="dm-label">Loan Account Number</label>
              <input id="vf-acc" required value={loanAccountNumber} onChange={(e) => setLoanAccountNumber(e.target.value)} placeholder="e.g. HDFC901288334499" className="dm-input text-xs font-mono" />
            </div>
            <div>
              <label htmlFor="vf-ifsc" className="dm-label">IFSC Code</label>
              <input id="vf-ifsc" value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="HDFC0000128" className="dm-input text-xs font-mono uppercase" />
            </div>
          </div>
        </section>

        {/* 3. Loan Information */}
        <section className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <h3 className="text-sm font-bold text-[#625346]">3. Loan & Schedule Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="vf-ref" className="dm-label">Loan Reference Number</label>
              <input id="vf-ref" required value={loanReferenceNumber} onChange={(e) => setLoanReferenceNumber(e.target.value)} className="dm-input text-xs font-mono" />
            </div>
            <div>
              <label htmlFor="vf-type" className="dm-label">Loan Type</label>
              <select id="vf-type" value={loanType} onChange={(e) => setLoanType(e.target.value as FinanceLoanType)} className="dm-input text-xs">
                <option value="vehicle_loan">Vehicle Loan</option>
                <option value="commercial_vehicle_loan">Commercial Vehicle Loan</option>
                <option value="lease">Lease</option>
                <option value="hire_purchase">Hire Purchase</option>
                <option value="other">Other Configurable Type</option>
              </select>
            </div>
            {loanType === 'other' && (
              <div>
                <label htmlFor="vf-ctype" className="dm-label">Custom Finance Type</label>
                <input id="vf-ctype" required value={customLoanTypeLabel} onChange={(e) => setCustomLoanTypeLabel(e.target.value)} placeholder="e.g. Battery Swap Financing" className="dm-input text-xs" />
              </div>
            )}
            <div>
              <label htmlFor="vf-prin" className="dm-label">Principal Amount (INR)</label>
              <input id="vf-prin" type="number" min={1000} required value={principalAmount} onChange={(e) => setPrincipalAmount(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-down" className="dm-label">Down Payment (INR)</label>
              <input id="vf-down" type="number" min={0} value={downPayment} onChange={(e) => setDownPayment(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-rate" className="dm-label">Interest Rate (% p.a.)</label>
              <input id="vf-rate" type="number" step="0.05" min={0} value={interestRate} onChange={(e) => setInterestRate(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-itype" className="dm-label">Interest Type</label>
              <select id="vf-itype" value={interestType} onChange={(e) => setInterestType(e.target.value as FinanceInterestType)} className="dm-input text-xs">
                <option value="reducing_balance">Reducing Balance</option>
                <option value="flat_rate">Flat Rate</option>
                <option value="lease_fixed">Lease Fixed</option>
                <option value="interest_only_balloon">Interest-Only + Balloon</option>
                <option value="custom">Custom EMI</option>
              </select>
            </div>
            <div>
              <label htmlFor="vf-start" className="dm-label">Loan Start Date</label>
              <input id="vf-start" type="date" required value={loanStartDate} onChange={(e) => setLoanStartDate(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-ten" className="dm-label">Loan Tenure (Months)</label>
              <input
                id="vf-ten"
                type="number"
                min={1}
                max={120}
                value={loanTenureMonths}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setLoanTenureMonths(v)
                  setNumberOfInstalments(v)
                }}
                className="dm-input text-xs tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="vf-inst-cnt" className="dm-label">Number of Instalments</label>
              <input id="vf-inst-cnt" type="number" min={1} max={120} value={numberOfInstalments} onChange={(e) => setNumberOfInstalments(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-emi" className="dm-label">EMI Amount (INR)</label>
              <input
                id="vf-emi"
                type="number"
                placeholder={String(Math.round(computedEmi))}
                value={customEmiOverride}
                onChange={(e) => setCustomEmiOverride(e.target.value)}
                className="dm-input text-xs tabular-nums"
              />
              <span className="text-[11px] text-[#958777]">Auto-calc: {formatInr(computedEmi)} (Net {formatInr(netFinanced)})</span>
            </div>
            <div>
              <label htmlFor="vf-femi" className="dm-label">First EMI Date</label>
              <input id="vf-femi" type="date" required value={firstEmiDate} onChange={(e) => setFirstEmiDate(e.target.value)} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-lemi" className="dm-label">Final EMI Date</label>
              <input id="vf-lemi" type="date" readOnly value={finalEmiDate} className="dm-input text-xs tabular-nums bg-[#FAFAFA]" />
            </div>
            <div>
              <label htmlFor="vf-pfee" className="dm-label">Processing Fees (INR)</label>
              <input id="vf-pfee" type="number" min={0} value={processingFees} onChange={(e) => setProcessingFees(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
            <div>
              <label htmlFor="vf-ochg" className="dm-label">Other Charges (INR)</label>
              <input id="vf-ochg" type="number" min={0} value={otherCharges} onChange={(e) => setOtherCharges(Number(e.target.value))} className="dm-input text-xs tabular-nums" />
            </div>
          </div>
        </section>

        {/* 4. Additional Information & Documents */}
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-[#625346]">4. Additional Information & Documents</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="vf-pm" className="dm-label">Payment Method</label>
              <select id="vf-pm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as FinancePaymentMethod)} className="dm-input text-xs">
                <option value="nach">NACH Mandate</option>
                <option value="ecs">ECS Auto-Debit</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="imps">IMPS</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
            <div>
              <span className="dm-label">Loan Agreement</span>
              <label className="btn-secondary text-xs w-full cursor-pointer justify-center">
                <Upload className="w-3.5 h-3.5" />
                {docs.find((d) => d.category === 'loan_agreement')?.fileName ?? 'Attach PDF / Image'}
                <input type="file" accept=".pdf,image/*" onChange={handleDocAttach('loan_agreement', 'Loan Agreement')} className="hidden" />
              </label>
            </div>
            <div>
              <span className="dm-label">Sanction Letter</span>
              <label className="btn-secondary text-xs w-full cursor-pointer justify-center">
                <Upload className="w-3.5 h-3.5" />
                {docs.find((d) => d.category === 'loan_sanction_letter')?.fileName ?? 'Attach PDF / Image'}
                <input type="file" accept=".pdf,image/*" onChange={handleDocAttach('loan_sanction_letter', 'Sanction Letter')} className="hidden" />
              </label>
            </div>
            <div>
              <span className="dm-label">Supporting Documents</span>
              <label className="btn-secondary text-xs w-full cursor-pointer justify-center">
                <Upload className="w-3.5 h-3.5" />
                {docs.some((d) => d.category === 'other_supporting_docs')
                  ? `${docs.filter((d) => d.category === 'other_supporting_docs').length} attached`
                  : 'Attach Supporting'}
                <input type="file" accept=".pdf,image/*" onChange={handleDocAttach('other_supporting_docs', 'Supporting Document')} className="hidden" />
              </label>
            </div>
          </div>
          <div>
            <label htmlFor="vf-notes" className="dm-label">Notes</label>
            <textarea id="vf-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hypothecation conditions, foreclosure lock-in, or corporate mandate details..." className="dm-input text-xs" />
          </div>
        </section>

        <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E5E5]">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="btn-primary text-xs">
            {submitting ? 'Creating Schedule...' : 'Save Vehicle Finance & Generate EMI Schedule'}
          </button>
        </div>
      </form>
    </EnterpriseModal>
  )
}
