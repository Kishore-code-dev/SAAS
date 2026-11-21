import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileSignature } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import type { ContractCategory, ContractSupplierType, ResponsibilityParty } from '../../types/contracts'

export default function ContractFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { partners, owners, createContract, hasPermission } = useContracts()
  const { vehicles, refreshFleet } = useFleet()

  const prefilledVehicleId = searchParams.get('vehicleId') ?? ''
  const [contractName, setContractName] = useState('')
  const [contractCategory, setContractCategory] = useState<ContractCategory>('fixed_monthly_rental')
  const [supplierType, setSupplierType] = useState<ContractSupplierType>('fleet_partner')
  const [fleetPartnerId, setFleetPartnerId] = useState(partners[0]?.id ?? '')
  const [individualOwnerId, setIndividualOwnerId] = useState(owners[0]?.id ?? '')
  const [agreementRefNumber, setAgreementRefNumber] = useState('')
  const [agreementDate, setAgreementDate] = useState(new Date().toISOString().slice(0, 10))
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [expiryDate, setExpiryDate] = useState(() => new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10))
  const [durationMonths, setDurationMonths] = useState(12)
  const [description, setDescription] = useState('')

  const [monthlyRental, setMonthlyRental] = useState(55000)
  const [perKmRate, setPerKmRate] = useState(0)
  const [perTripRate, setPerTripRate] = useState(0)
  const [revenueSharingPct, setRevenueSharingPct] = useState(0)
  const [paymentFrequency, setPaymentFrequency] = useState<'monthly' | 'bi_weekly' | 'weekly' | 'per_trip' | 'custom'>('monthly')
  const [securityDeposit, setSecurityDeposit] = useState(50000)
  const [advancePayment, setAdvancePayment] = useState(25000)

  const [maintResp, setMaintResp] = useState<ResponsibilityParty>('shared')
  const [fuelResp, setFuelResp] = useState<ResponsibilityParty>('operating_org')
  const [insResp, setInsResp] = useState<ResponsibilityParty>('supplier')
  const [tyreResp, setTyreResp] = useState<ResponsibilityParty>('supplier')

  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>(
    prefilledVehicleId ? [prefilledVehicleId] : [],
  )
  const [overlappingAuthNote, setOverlappingAuthNote] = useState('')
  const [submitMode, setSubmitMode] = useState<'draft' | 'pending_approval'>('pending_approval')
  const [submitting, setSubmitting] = useState(false)

  const toggleVehicle = (id: string) => {
    setSelectedVehicleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contractName.trim()) {
      toast.error('Enter a contract title.')
      return
    }
    setSubmitting(true)
    try {
      const created = await createContract({
        contractName: contractName.trim(),
        contractCategory,
        supplierType,
        fleetPartnerId: supplierType === 'fleet_partner' ? fleetPartnerId : null,
        individualOwnerId: supplierType === 'individual_owner' ? individualOwnerId : null,
        agreementRefNumber: agreementRefNumber.trim() || `AGR-${Date.now().toString().slice(-5)}`,
        agreementDate,
        startDate,
        expiryDate,
        durationMonths,
        status: submitMode,
        description,
        financialTerms: {
          fixedRentalAmount: monthlyRental,
          monthlyRental,
          perKmRate,
          perTripRate,
          revenueSharingPct,
          fixedComponent: monthlyRental,
          variableComponentDesc: perKmRate > 0 ? `Rs ${perKmRate}/km variable rate` : 'Standard fixed payout',
          paymentFrequency,
          paymentDueDay: 5,
          advancePayment,
          securityDeposit,
          bondAmount: securityDeposit,
          latePaymentTerms: 'Standard 7-day settlement grace',
          taxTreatment: 'TDS 194C / GST compliant',
          additionalCharges: 'Actuals on valid receipt',
          deductionConditions: 'Unauthorized downtime or damage beyond wear & tear',
          settlementConditions: 'Monthly verified trip log settlement',
        },
        contractConditions: {
          maintenanceResponsibility: maintResp,
          fuelResponsibility: fuelResp,
          insuranceResponsibility: insResp,
          accidentResponsibility: 'shared',
          tyreReplacementResponsibility: tyreResp,
          breakdownResponsibility: 'operating_org',
          driverResponsibility: 'operating_org',
          permitResponsibility: 'supplier',
          fitnessPucResponsibility: 'supplier',
          vehicleReplacementConditions: 'Replacement standby within 24 hours on supplier fault.',
          downtimeConditions: 'Pro-rata deduction after 24h downtime.',
          terminationConditions: '30 days written notice.',
          renewalConditions: 'Review 30 days prior to expiry.',
          vehicleReturnConditions: 'Joint odometer, fuel & photo inspection.',
        },
        vehicles: selectedVehicleIds.map((vid) => ({
          vehicleId: vid,
          agreedMonthlyRental: monthlyRental,
          agreedPerKmRate: perKmRate,
          agreedPerTripRate: perTripRate,
          revenueSharePct: revenueSharingPct,
          maintenanceResponsibility: maintResp,
          fuelResponsibility: fuelResp,
          insuranceResponsibility: insResp,
          overlappingAuthNote: overlappingAuthNote.trim() || undefined,
        })),
      })
      await refreshFleet()
      toast.success(`Created contract ${created.contractCode}`)
      navigate(`/dashboard/contracts/register/${created.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to create contract.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Vehicle Contract"
        subtitle="Full-page agreement builder with supplier selection, multi-vehicle terms, financial rules & responsibility matrix"
      >
        <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" />
          Back to Register
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="enterprise-card p-6 space-y-5">
          <h2 className="dm-card-title flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-[#6E5696]" />
            1. Supplier, Classification &amp; Term
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="dm-label">Contract Name *</label>
              <input
                required
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder="e.g., Chennai Corridor Dedicated Medium Truck Rental"
                className="dm-input"
              />
            </div>
            <div>
              <label className="dm-label">Agreement Reference No.</label>
              <input
                value={agreementRefNumber}
                onChange={(e) => setAgreementRefNumber(e.target.value)}
                placeholder="e.g., AGR-2026-091"
                className="dm-input"
              />
            </div>

            <div>
              <label className="dm-label">Supplier Classification</label>
              <select
                value={supplierType}
                onChange={(e) => setSupplierType(e.target.value as ContractSupplierType)}
                className="dm-input"
              >
                <option value="fleet_partner">Fleet Partner (B2B Supplier)</option>
                <option value="individual_owner">Individual Vehicle Owner</option>
              </select>
            </div>

            <div>
              <label className="dm-label">{supplierType === 'fleet_partner' ? 'Select Fleet Partner' : 'Select Individual Owner'}</label>
              {supplierType === 'fleet_partner' ? (
                <select value={fleetPartnerId} onChange={(e) => setFleetPartnerId(e.target.value)} className="dm-input">
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.companyName} ({p.partnerCode})
                    </option>
                  ))}
                </select>
              ) : (
                <select value={individualOwnerId} onChange={(e) => setIndividualOwnerId(e.target.value)} className="dm-input">
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName} ({o.ownerCode})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="dm-label">Contract Commercial Category</label>
              <select
                value={contractCategory}
                onChange={(e) => setContractCategory(e.target.value as ContractCategory)}
                className="dm-input"
              >
                <option value="fixed_monthly_rental">Fixed Monthly Rental</option>
                <option value="per_km_rental">Per-Km Rental</option>
                <option value="per_trip_rental">Per-Trip Rental</option>
                <option value="revenue_sharing">Revenue Sharing</option>
                <option value="fixed_plus_variable">Fixed + Variable Hybrid</option>
                <option value="custom_agreement">Custom Agreement</option>
              </select>
            </div>

            <div>
              <label className="dm-label">Agreement Date</label>
              <input type="date" value={agreementDate} onChange={(e) => setAgreementDate(e.target.value)} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Start Date *</label>
              <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Expiry Date *</label>
              <input type="date" required value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Duration (Months)</label>
              <input
                type="number"
                min={1}
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                className="dm-input"
              />
            </div>
            <div className="md:col-span-2">
              <label className="dm-label">Scope / Corridor Notes</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Corridors covered, dispatch SLA, escalation rules..."
                className="dm-input"
              />
            </div>
          </div>
        </div>

        <div className="enterprise-card p-6 space-y-5">
          <h2 className="dm-card-title">2. Financial Terms &amp; Operating Responsibilities</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="dm-label">Monthly Rental (₹)</label>
              <input type="number" min={0} value={monthlyRental} onChange={(e) => setMonthlyRental(Number(e.target.value))} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Per-Km Rate (₹)</label>
              <input type="number" min={0} value={perKmRate} onChange={(e) => setPerKmRate(Number(e.target.value))} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Per-Trip Rate (₹)</label>
              <input type="number" min={0} value={perTripRate} onChange={(e) => setPerTripRate(Number(e.target.value))} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Revenue Share (%)</label>
              <input type="number" min={0} max={100} value={revenueSharingPct} onChange={(e) => setRevenueSharingPct(Number(e.target.value))} className="dm-input" />
            </div>

            <div>
              <label className="dm-label">Payment Frequency</label>
              <select value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value as typeof paymentFrequency)} className="dm-input">
                <option value="monthly">Monthly</option>
                <option value="bi_weekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
                <option value="per_trip">Per Trip</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="dm-label">Required Deposit / Bond (₹)</label>
              <input type="number" min={0} value={securityDeposit} onChange={(e) => setSecurityDeposit(Number(e.target.value))} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Advance Payment (₹)</label>
              <input type="number" min={0} value={advancePayment} onChange={(e) => setAdvancePayment(Number(e.target.value))} className="dm-input" />
            </div>
            <div>
              <label className="dm-label">Maintenance Responsibility</label>
              <select value={maintResp} onChange={(e) => setMaintResp(e.target.value as ResponsibilityParty)} className="dm-input">
                <option value="operating_org">Operating Org</option>
                <option value="supplier">Supplier / Owner</option>
                <option value="shared">Shared Split</option>
                <option value="unspecified">Unspecified</option>
              </select>
            </div>
            <div>
              <label className="dm-label">Fuel Responsibility</label>
              <select value={fuelResp} onChange={(e) => setFuelResp(e.target.value as ResponsibilityParty)} className="dm-input">
                <option value="operating_org">Operating Org</option>
                <option value="supplier">Supplier / Owner</option>
                <option value="shared">Shared Split</option>
              </select>
            </div>
            <div>
              <label className="dm-label">Insurance Responsibility</label>
              <select value={insResp} onChange={(e) => setInsResp(e.target.value as ResponsibilityParty)} className="dm-input">
                <option value="supplier">Supplier / Owner</option>
                <option value="operating_org">Operating Org</option>
                <option value="shared">Shared Split</option>
              </select>
            </div>
            <div>
              <label className="dm-label">Tyre Replacement</label>
              <select value={tyreResp} onChange={(e) => setTyreResp(e.target.value as ResponsibilityParty)} className="dm-input">
                <option value="supplier">Supplier / Owner</option>
                <option value="operating_org">Operating Org</option>
                <option value="shared">Shared Split</option>
              </select>
            </div>
          </div>
        </div>

        <div className="enterprise-card p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="dm-card-title">3. Link Vehicles ({selectedVehicleIds.length} selected)</h2>
              <p className="text-xs text-[#958777]">Active overlapping agreements are blocked automatically unless authorized below.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
            {vehicles.map((v) => {
              const checked = selectedVehicleIds.includes(v.id)
              return (
                <label
                  key={v.id}
                  className={`flex items-start gap-2.5 p-3 rounded-[10px] border cursor-pointer transition-colors ${
                    checked ? 'bg-[#EEE8F7]/60 border-[#B8A3D9]' : 'bg-[#FAFAFA] border-[#E5E5E5] hover:border-[#DDD3ED]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVehicle(v.id)}
                    className="mt-0.5 rounded border-[#958777]"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#625346]">{v.registrationNumber}</div>
                    <div className="text-[11px] text-[#958777] truncate">
                      {v.make} {v.model} · {(v.ownershipCategory ?? 'company_owned').replace(/_/g, ' ')}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
          <div>
            <label className="dm-label">Authorized Overlapping Override Note (Optional — only if transferring from active contract)</label>
            <input
              value={overlappingAuthNote}
              onChange={(e) => setOverlappingAuthNote(e.target.value)}
              placeholder="Minimum 8 chars authorization reason if vehicle is currently active on another agreement"
              className="dm-input"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button type="button" onClick={() => navigate('/dashboard/contracts/register')} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            onClick={() => setSubmitMode('draft')}
            className="btn-secondary"
          >
            Save as Draft
          </button>
          {hasPermission('submit_contracts') && (
            <button
              type="submit"
              disabled={submitting}
              onClick={() => setSubmitMode('pending_approval')}
              className="btn-accent"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Creating Contract...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
