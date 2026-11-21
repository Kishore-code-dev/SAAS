import React, { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useContracts } from '../../hooks/useContracts'
import { useFleet } from '../../hooks/useFleet'
import PageHeader from '../../components/layout/PageHeader'
import { formatInr } from '../../components/ui/EnterprisePrimitives'
import { compareHandoverVsReturn } from '../../utils/contractsEngine'
import type { VehicleHandoverRecord } from '../../types/contracts'

const DEFAULT_ACCESSORIES = ['RC Copy', 'Insurance Certificate', 'First Aid Kit', 'Spare Key', 'Spare Tyre', 'Jack & Tool Kit']
const DEFAULT_EQUIPMENT = ['GPS Tracker / OBD', 'Dashcam', 'Fire Extinguisher', 'Fastag', 'Reflective Triangle']

export default function HandoverReturnFormPage() {
  const navigate = useNavigate()
  const { handoverId } = useParams()
  const [searchParams] = useSearchParams()
  const isReturnMode = Boolean(handoverId)

  const { vehicles } = useFleet()
  const { contracts, handovers, deposits, createHandover } = useContracts()

  const initialRecord = useMemo(
    () => (handoverId ? handovers.find((h) => h.id === handoverId) : undefined),
    [handoverId, handovers],
  )

  const preVehicleId = initialRecord?.vehicleId ?? searchParams.get('vehicleId') ?? ''
  const preContractId = initialRecord?.contractId ?? searchParams.get('contractId') ?? contracts[0]?.id ?? ''

  const [contractId, setContractId] = useState(preContractId)
  const [vehicleId, setVehicleId] = useState(
    preVehicleId ||
      vehicles.find((v) => (v.ownershipCategory ?? 'company_owned') !== 'company_owned')?.id ||
      vehicles[0]?.id ||
      '',
  )
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().slice(0, 10))
  const [odometerKm, setOdometerKm] = useState(
    initialRecord ? initialRecord.odometerKm + 2400 : 12000,
  )
  const [fuelLevelPct, setFuelLevelPct] = useState(initialRecord ? initialRecord.fuelLevelPct : 85)
  const [exteriorCondition, setExteriorCondition] = useState<string>('good')
  const [interiorCondition, setInteriorCondition] = useState<string>('good')
  const [tyreCondition, setTyreCondition] = useState<string>('good')
  const [accessoriesChecklist, setAccessoriesChecklist] = useState<string[]>(
    initialRecord ? [...initialRecord.accessoriesChecklist] : [...DEFAULT_ACCESSORIES],
  )
  const [equipmentChecklist, setEquipmentChecklist] = useState<string[]>(
    initialRecord ? [...initialRecord.equipmentChecklist] : [...DEFAULT_EQUIPMENT],
  )
  const [existingDamageNotes, setExistingDamageNotes] = useState('')
  const [pendingRepairsInr, setPendingRepairsInr] = useState(0)
  const [outstandingExpensesInr, setOutstandingExpensesInr] = useState(0)
  const [recommendedDeductionInr, setRecommendedDeductionInr] = useState(0)
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleItem = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  }

  const liveComparison = useMemo(() => {
    if (!isReturnMode || !initialRecord) return null
    const draftReturn = {
      id: 'preview',
      organizationId: initialRecord.organizationId,
      contractId,
      vehicleId,
      vehicleRegistration: initialRecord.vehicleRegistration,
      recordType: 'vehicle_return',
      handoverCode: 'PREVIEW',
      supplierType: initialRecord.supplierType,
      supplierName: initialRecord.supplierName,
      handoverDatetime: handoverDate,
      handoverDate,
      odometerKm,
      fuelLevelPct,
      exteriorCondition: exteriorCondition as 'excellent' | 'good' | 'fair' | 'damaged',
      interiorCondition: interiorCondition as 'excellent' | 'good' | 'fair' | 'damaged',
      tyreCondition: tyreCondition as 'good' | 'worn' | 'critical',
      accessoriesChecklist,
      equipmentChecklist,
      documentChecklist: [],
      photos: [],
      supplierRepresentative: '',
      receivingRepresentative: '',
      supplierAckName: '',
      receivingAckName: '',
      existingDamages: existingDamageNotes,
      pendingRepairsInr,
      outstandingExpensesInr,
      recommendedDeductionInr,
      handoverNotes: remarks,
      createdBy: 'Current User',
      createdAt: '',
    } as VehicleHandoverRecord
    return compareHandoverVsReturn(initialRecord, draftReturn)
  }, [
    accessoriesChecklist,
    contractId,
    equipmentChecklist,
    existingDamageNotes,
    exteriorCondition,
    fuelLevelPct,
    handoverDate,
    initialRecord,
    interiorCondition,
    isReturnMode,
    odometerKm,
    outstandingExpensesInr,
    pendingRepairsInr,
    recommendedDeductionInr,
    remarks,
    tyreCondition,
    vehicleId,
  ])

  const linkedDeposit = deposits.find((d) => d.contractId === contractId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!contractId || !vehicleId) {
      setError('Please select both contract and vehicle.')
      return
    }
    const veh = vehicles.find((v) => v.id === vehicleId)
    setSaving(true)
    try {
      await createHandover({
        contractId,
        vehicleId,
        vehicleRegistration: initialRecord?.vehicleRegistration ?? veh?.registrationNumber ?? '',
        recordType: isReturnMode ? 'vehicle_return' : 'initial_handover',
        handoverDate,
        odometerKm,
        fuelLevelPct,
        exteriorCondition,
        interiorCondition,
        tyreCondition,
        accessoriesChecklist,
        equipmentChecklist,
        existingDamageNotes,
        pendingRepairsInr,
        outstandingExpensesInr,
        recommendedDeductionInr,
        remarks,
      })
      toast.success(isReturnMode ? 'Vehicle return inspection recorded' : 'Initial handover recorded')
      navigate('/dashboard/contracts/vehicles')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save handover record')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={isReturnMode ? 'Vehicle Return & Handover Comparison' : 'Record Initial Vehicle Handover'}
        subtitle={
          isReturnMode
            ? `Inspecting return against baseline handover ${initialRecord?.handoverDate ?? ''}`
            : 'Capture initial odometer, fuel, condition, and checklist baseline before deployment'
        }
      >
        <button
          type="button"
          onClick={() => navigate('/dashboard/contracts/vehicles')}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Contracted Vehicles
        </button>
      </PageHeader>

      {isReturnMode && liveComparison && initialRecord && (
        <div className="enterprise-card p-5 border-[#6E5696]/30 bg-[#EEE8F7]/25 space-y-3">
          <h2 className="text-sm font-bold text-[#625346]">Live Handover vs Return Variance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white rounded-[8px] border border-[#E5E5E5] p-3">
              <div className="text-[#958777]">Distance Travelled</div>
              <div className="text-base font-bold text-[#625346] tabular-nums">
                +{liveComparison.distanceTravelledKm.toLocaleString('en-IN')} km
              </div>
            </div>
            <div className="bg-white rounded-[8px] border border-[#E5E5E5] p-3">
              <div className="text-[#958777]">Fuel Delta</div>
              <div className={`text-base font-bold tabular-nums ${liveComparison.fuelDeltaPct < 0 ? 'text-[#A24034]' : 'text-[#4D6E4A]'}`}>
                {liveComparison.fuelDeltaPct >= 0 ? `+${liveComparison.fuelDeltaPct}%` : `${liveComparison.fuelDeltaPct}%`}
              </div>
            </div>
            <div className="bg-white rounded-[8px] border border-[#E5E5E5] p-3">
              <div className="text-[#958777]">Missing Accessories</div>
              <div className="text-base font-bold text-[#625346]">
                {liveComparison.missingAccessories.length} item(s)
              </div>
            </div>
            <div className="bg-white rounded-[8px] border border-[#E5E5E5] p-3">
              <div className="text-[#958777]">Recommended Deduction</div>
              <div className="text-base font-bold text-[#A24034] tabular-nums">
                {formatInr(liveComparison.recommendedDeductionInr)}
              </div>
            </div>
          </div>
          {liveComparison.missingAccessories.length > 0 && (
            <p className="text-xs font-semibold text-[#A24034]">
              Missing since handover: {liveComparison.missingAccessories.join(', ')}
            </p>
          )}
          {linkedDeposit && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/contracts/deposits/${linkedDeposit.id}`)}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Open Linked Deposit ({linkedDeposit.depositCode}) for Deduction / Refund
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-[8px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Contract Agreement</label>
            <select
              value={contractId}
              disabled={isReturnMode}
              onChange={(e) => setContractId(e.target.value)}
              className="dm-input text-xs"
            >
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode} — {c.contractName} ({c.supplierName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Vehicle</label>
            <select
              value={vehicleId}
              disabled={isReturnMode}
              onChange={(e) => setVehicleId(e.target.value)}
              className="dm-input text-xs"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.registrationNumber} — {v.make} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Inspection Date</label>
            <input
              type="date"
              required
              value={handoverDate}
              onChange={(e) => setHandoverDate(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Odometer (km)</label>
              <input
                type="number"
                required
                min={0}
                value={odometerKm}
                onChange={(e) => setOdometerKm(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Fuel Level (%)</label>
              <input
                type="number"
                required
                min={0}
                max={100}
                value={fuelLevelPct}
                onChange={(e) => setFuelLevelPct(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Exterior Condition</label>
            <input
              type="text"
              required
              value={exteriorCondition}
              onChange={(e) => setExteriorCondition(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Interior Condition</label>
            <input
              type="text"
              required
              value={interiorCondition}
              onChange={(e) => setInteriorCondition(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Tyre Condition</label>
            <input
              type="text"
              required
              value={tyreCondition}
              onChange={(e) => setTyreCondition(e.target.value)}
              className="dm-input text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-[#E5E5E5] rounded-[10px] p-4 space-y-2">
            <h3 className="text-xs font-bold text-[#625346] uppercase tracking-wider">Accessories Checklist</h3>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_ACCESSORIES.map((item) => (
                <label key={item} className="flex items-center gap-2 text-xs text-[#625346]">
                  <input
                    type="checkbox"
                    checked={accessoriesChecklist.includes(item)}
                    onChange={() => toggleItem(accessoriesChecklist, setAccessoriesChecklist, item)}
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
          <div className="border border-[#E5E5E5] rounded-[10px] p-4 space-y-2">
            <h3 className="text-xs font-bold text-[#625346] uppercase tracking-wider">Equipment Checklist</h3>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_EQUIPMENT.map((item) => (
                <label key={item} className="flex items-center gap-2 text-xs text-[#625346]">
                  <input
                    type="checkbox"
                    checked={equipmentChecklist.includes(item)}
                    onChange={() => toggleItem(equipmentChecklist, setEquipmentChecklist, item)}
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>

        {isReturnMode && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#E5E5E5] pt-4">
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Pending Repairs (₹)</label>
              <input
                type="number"
                min={0}
                value={pendingRepairsInr}
                onChange={(e) => setPendingRepairsInr(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Outstanding Expenses (₹)</label>
              <input
                type="number"
                min={0}
                value={outstandingExpensesInr}
                onChange={(e) => setOutstandingExpensesInr(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#625346] mb-1">Recommended Deposit Deduction (₹)</label>
              <input
                type="number"
                min={0}
                value={recommendedDeductionInr}
                onChange={(e) => setRecommendedDeductionInr(Number(e.target.value))}
                className="dm-input text-xs"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Damage / Defect Notes</label>
            <textarea
              rows={2}
              value={existingDamageNotes}
              onChange={(e) => setExistingDamageNotes(e.target.value)}
              placeholder="Document scratches, windshield chips, missing tools..."
              className="dm-input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#625346] mb-1">Inspection Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Authorized representative sign-off remarks..."
              className="dm-input text-xs"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard/contracts/vehicles')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-accent">
            <CheckCircle2 className="w-4 h-4" />
            {saving ? 'Saving Inspection...' : isReturnMode ? 'Confirm Return Handover' : 'Save Initial Handover'}
          </button>
        </div>
      </form>
    </div>
  )
}
