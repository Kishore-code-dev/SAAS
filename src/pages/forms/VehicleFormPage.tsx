import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Info, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useFleet } from '../../hooks/useFleet'
import { useOptionalContracts } from '../../hooks/useContracts'
import PageHeader from '../../components/layout/PageHeader'
import type { FuelType, PowertrainType, VehicleCategory, VehicleOwnershipCategory } from '../../types/fleet'

export default function VehicleFormPage() {
  const { vehicleId, id } = useParams()
  const editId = vehicleId ?? id
  const isEdit = Boolean(editId)
  const navigate = useNavigate()

  const {
    activeOrganization,
    vehicles,
    archivedVehicles,
    corridors,
    drivers,
    addVehicle,
    updateVehicle,
  } = useFleet()
  const contractsCtx = useOptionalContracts()
  const partners = contractsCtx?.partners ?? []
  const owners = contractsCtx?.owners ?? []
  const contracts = contractsCtx?.contracts ?? []

  const existing = editId
    ? vehicles.find((v) => v.id === editId) ?? archivedVehicles.find((v) => v.id === editId)
    : undefined

  const quotaReached = !isEdit && vehicles.length >= activeOrganization.vehicleLimit

  const [registrationNumber, setRegistrationNumber] = useState(existing?.registrationNumber ?? '')
  const [make, setMake] = useState(existing?.make ?? 'Tata')
  const [model, setModel] = useState(existing?.model ?? 'Ace Gold')
  const [category, setCategory] = useState<VehicleCategory>(existing?.category ?? 'Light Commercial')
  const [powertrain, setPowertrain] = useState<PowertrainType>(existing?.powertrain ?? 'ICE')
  const [fuelType, setFuelType] = useState<FuelType>(existing?.fuelType ?? 'Diesel')
  const [year, setYear] = useState(existing?.year ?? 2024)
  const [odometerKm, setOdometerKm] = useState(existing?.odometerKm ?? 12500)
  const [dailyAvgKm, setDailyAvgKm] = useState(existing?.dailyAvgKm ?? 140)
  const [corridorId, setCorridorId] = useState(existing?.corridorId ?? corridors[0]?.id ?? 'cor-chennai')
  const [assignedDriverId, setAssignedDriverId] = useState(existing?.assignedDriverId ?? '')
  const [insuranceProvider, setInsuranceProvider] = useState(existing?.insuranceProvider ?? 'HDFC ERGO Commercial')
  const [insuranceExpiry, setInsuranceExpiry] = useState(existing?.insuranceExpiry ?? '2027-06-30')
  const [registrationExpiry, setRegistrationExpiry] = useState(existing?.registrationExpiry ?? '2030-06-30')
  const [fitnessExpiry, setFitnessExpiry] = useState(existing?.fitnessExpiry ?? '')
  const [pucExpiry, setPucExpiry] = useState(existing?.pucExpiry ?? '')
  const [permitExpiry, setPermitExpiry] = useState(existing?.permitExpiry ?? '')

  // Multi-ownership classification
  const [ownershipCategory, setOwnershipCategory] = useState<VehicleOwnershipCategory>(
    existing?.ownershipCategory ?? 'company_owned',
  )
  const [legalOwnerName, setLegalOwnerName] = useState(existing?.legalOwnerName ?? '')
  const [fleetPartnerId, setFleetPartnerId] = useState(existing?.fleetPartnerId ?? '')
  const [individualOwnerId, setIndividualOwnerId] = useState(existing?.individualOwnerId ?? '')
  const [activeContractId, setActiveContractId] = useState(existing?.activeContractId ?? '')

  const [formError, setFormError] = useState<string | null>(null)

  const handlePowertrainChange = (next: PowertrainType) => {
    setPowertrain(next)
    if (next === 'EV') {
      setFuelType('Electric')
      setCategory('Electric Cargo')
    } else if (fuelType === 'Electric') {
      setFuelType('Diesel')
      setCategory('Light Commercial')
    }
  }

  const handleOwnershipChange = (next: VehicleOwnershipCategory) => {
    setOwnershipCategory(next)
    if (next === 'company_owned') {
      setFleetPartnerId('')
      setIndividualOwnerId('')
      setActiveContractId('')
      setLegalOwnerName(activeOrganization.name)
    } else if (next === 'contracted_fleet') {
      setIndividualOwnerId('')
      if (!legalOwnerName && partners[0]) {
        setFleetPartnerId(partners[0].id)
        setLegalOwnerName(partners[0].companyName)
      }
    } else {
      setFleetPartnerId('')
      if (!legalOwnerName && owners[0]) {
        setIndividualOwnerId(owners[0].id)
        setLegalOwnerName(owners[0].fullName)
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (quotaReached) {
      const msg = `Vehicle seat quota reached (${vehicles.length}/${activeOrganization.vehicleLimit}) on your ${activeOrganization.planId.toUpperCase()} plan.`
      setFormError(msg)
      toast.error(msg)
      return
    }
    try {
      const resolvedOwner =
        ownershipCategory === 'company_owned'
          ? activeOrganization.name
          : ownershipCategory === 'contracted_fleet'
            ? partners.find((p) => p.id === fleetPartnerId)?.companyName || legalOwnerName.trim() || 'Fleet Partner'
            : owners.find((o) => o.id === individualOwnerId)?.fullName || legalOwnerName.trim() || 'Individual Owner'

      if (isEdit && existing) {
        const corridor = corridors.find((c) => c.id === corridorId)
        updateVehicle(existing.id, {
          make: make.trim(),
          model: model.trim(),
          category,
          powertrain,
          fuelType,
          year: Number(year),
          odometerKm: Number(odometerKm),
          dailyAvgKm: Number(dailyAvgKm),
          corridorId,
          cityName: corridor?.name ?? existing.cityName,
          insuranceProvider: insuranceProvider.trim(),
          insuranceExpiry,
          registrationExpiry,
          fitnessExpiry: fitnessExpiry || undefined,
          pucExpiry: pucExpiry || undefined,
          permitExpiry: permitExpiry || undefined,
          ownershipCategory,
          legalOwnerName: resolvedOwner,
          fleetPartnerId: ownershipCategory === 'contracted_fleet' ? fleetPartnerId || null : null,
          individualOwnerId: ownershipCategory === 'individual_owner' ? individualOwnerId || null : null,
          activeContractId: ownershipCategory === 'company_owned' ? null : activeContractId || null,
        })
        toast.success(`Updated specifications for ${existing.registrationNumber}`)
        navigate(`/dashboard/fleet/vehicles/${existing.id}`)
      } else {
        const created = addVehicle({
          registrationNumber: registrationNumber.trim(),
          make: make.trim(),
          model: model.trim(),
          category,
          powertrain,
          fuelType,
          year: Number(year),
          odometerKm: Number(odometerKm),
          dailyAvgKm: Number(dailyAvgKm),
          corridorId,
          assignedDriverId: assignedDriverId || null,
          insuranceProvider: insuranceProvider.trim(),
          insuranceExpiry,
          registrationExpiry,
          ownershipCategory,
          legalOwnerName: resolvedOwner,
          fleetPartnerId: ownershipCategory === 'contracted_fleet' ? fleetPartnerId || null : null,
          individualOwnerId: ownershipCategory === 'individual_owner' ? individualOwnerId || null : null,
          activeContractId: ownershipCategory === 'company_owned' ? null : activeContractId || null,
        })
        toast.success(`Registered ${created.registrationNumber} (${ownershipCategory.replace(/_/g, ' ')})`)
        navigate(`/dashboard/fleet/vehicles/${created.id}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save vehicle.'
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={isEdit && existing ? `Edit Vehicle — ${existing.registrationNumber}` : 'Register New Commercial Vehicle'}
        subtitle={
          isEdit
            ? 'Update specifications, Indian statutory compliance dates, and legal ownership classification'
            : 'Creates a Vehicle Digital Twin with initial component health baselines and legal ownership separation'
        }
      >
        <button
          type="button"
          onClick={() => navigate(isEdit && existing ? `/dashboard/fleet/vehicles/${existing.id}` : '/dashboard/fleet')}
          className="btn-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </PageHeader>

      <form onSubmit={handleSubmit} className="enterprise-card p-6 space-y-6">
        {quotaReached && (
          <div className="p-3.5 rounded-[10px] bg-[#FCF5DE] border border-[#D8B442] text-xs text-[#625346] flex items-center justify-between gap-3">
            <span>
              Vehicle quota reached ({vehicles.length}/{activeOrganization.vehicleLimit}) on{' '}
              <strong className="uppercase">{activeOrganization.planId}</strong>.
            </span>
            <Link to="/dashboard/subscription" className="font-semibold text-[#6E5696] hover:underline whitespace-nowrap">
              Upgrade Plan
            </Link>
          </div>
        )}

        {formError && (
          <div role="alert" className="p-3 rounded-[10px] bg-[#FCECEB] border border-[#F4CBC7] text-xs font-semibold text-[#A24034]">
            {formError}
          </div>
        )}

        {/* Legal Ownership Separation */}
        <div className="space-y-3 border-b border-[#E5E5E5] pb-5">
          <h2 className="text-sm font-bold text-[#625346]">1. Legal Ownership & Contract Separation</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                { id: 'company_owned', title: 'Company-Owned', desc: 'Eligible for Company Loans & EMIs and Replacement Analysis' },
                { id: 'contracted_fleet', title: 'Contracted Fleet', desc: 'Commercial Fleet Partner asset governed by contract terms' },
                { id: 'individual_owner', title: 'Individual Owner', desc: 'Single owner-operator vehicle attached via contract' },
              ] as Array<{ id: VehicleOwnershipCategory; title: string; desc: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleOwnershipChange(opt.id)}
                className={`p-3.5 rounded-[10px] border text-left transition-colors ${
                  ownershipCategory === opt.id
                    ? 'border-[#6E5696] bg-[#EEE8F7]/65'
                    : 'border-[#E5E5E5] bg-[#FAFAFA] hover:bg-[#F2F2F2]'
                }`}
              >
                <div className="text-xs font-bold text-[#625346]">{opt.title}</div>
                <div className="text-[11px] text-[#958777] mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>

          {ownershipCategory !== 'company_owned' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              {ownershipCategory === 'contracted_fleet' ? (
                <div>
                  <label className="dm-label">Fleet Partner Supplier</label>
                  <select
                    value={fleetPartnerId}
                    onChange={(e) => {
                      setFleetPartnerId(e.target.value)
                      const p = partners.find((x) => x.id === e.target.value)
                      if (p) setLegalOwnerName(p.companyName)
                    }}
                    className="dm-input text-xs"
                  >
                    <option value="">Select Fleet Partner</option>
                    {partners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.companyName} ({p.partnerCode})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="dm-label">Individual Vehicle Owner</label>
                  <select
                    value={individualOwnerId}
                    onChange={(e) => {
                      setIndividualOwnerId(e.target.value)
                      const o = owners.find((x) => x.id === e.target.value)
                      if (o) setLegalOwnerName(o.fullName)
                    }}
                    className="dm-input text-xs"
                  >
                    <option value="">Select Individual Owner</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.fullName} ({o.ownerCode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="dm-label">Legal Owner Name</label>
                <input
                  value={legalOwnerName}
                  onChange={(e) => setLegalOwnerName(e.target.value)}
                  placeholder="Legal RC / Owner Entity Name"
                  className="dm-input text-xs"
                />
              </div>

              <div>
                <label className="dm-label">Linked Active Contract (Optional)</label>
                <select
                  value={activeContractId}
                  onChange={(e) => setActiveContractId(e.target.value)}
                  className="dm-input text-xs"
                >
                  <option value="">Link later in Vehicle Contracts</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractCode} — {c.contractName}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {ownershipCategory !== 'company_owned' ? (
            <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#FDF3E7] border border-[#F0D9B5] text-xs text-[#8F6510]">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Third-party contracted and individual-owner vehicles are automatically blocked from Company Vehicle Finance Loans and excluded from Company Replacement CapEx Analysis.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-[8px] bg-[#EDF4EC] border border-[#C7DEC4] text-xs text-[#4D6E4A]">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Company-owned assets are eligible for company loan/EMI tracking and lifecycle replacement modeling.</span>
            </div>
          )}
        </div>

        {/* Core Identity & Telemetry Baseline */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-[#625346]">2. Vehicle Identity, Specs & Compliance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="veh-reg" className="dm-label">Registration Number *</label>
              <input
                id="veh-reg"
                required
                disabled={isEdit}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                placeholder="e.g., TN 09 DK 4821"
                className="dm-input font-mono uppercase"
              />
            </div>
            <div>
              <label htmlFor="veh-make" className="dm-label">Manufacturer *</label>
              <input id="veh-make" required value={make} onChange={(e) => setMake(e.target.value)} className="dm-input" />
            </div>
            <div>
              <label htmlFor="veh-model" className="dm-label">Model *</label>
              <input id="veh-model" required value={model} onChange={(e) => setModel(e.target.value)} className="dm-input" />
            </div>
            <div>
              <label htmlFor="veh-pt" className="dm-label">Powertrain</label>
              <select
                id="veh-pt"
                value={powertrain}
                onChange={(e) => handlePowertrainChange(e.target.value as PowertrainType)}
                className="dm-input"
              >
                <option value="ICE">ICE (Diesel / Petrol / CNG)</option>
                <option value="EV">EV (Electric Commercial)</option>
              </select>
            </div>
            <div>
              <label htmlFor="veh-fuel" className="dm-label">Fuel / Energy Type</label>
              <select
                id="veh-fuel"
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value as FuelType)}
                className="dm-input"
              >
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
                <option value="CNG">CNG</option>
                <option value="Electric">Electric</option>
              </select>
            </div>
            <div>
              <label htmlFor="veh-cat" className="dm-label">Vehicle Category</label>
              <select
                id="veh-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as VehicleCategory)}
                className="dm-input"
              >
                <option value="Heavy Truck">Heavy Truck</option>
                <option value="Medium Commercial">Medium Commercial</option>
                <option value="Light Commercial">Light Commercial</option>
                <option value="Electric Cargo">Electric Cargo</option>
                <option value="Cargo Van">Cargo Van</option>
              </select>
            </div>
            <div>
              <label htmlFor="veh-year" className="dm-label">Model Year *</label>
              <input
                id="veh-year"
                type="number"
                min={2010}
                max={2027}
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-odo" className="dm-label">Odometer (km) *</label>
              <input
                id="veh-odo"
                type="number"
                min={0}
                required
                value={odometerKm}
                onChange={(e) => setOdometerKm(Number(e.target.value))}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-daily" className="dm-label">Daily Avg Usage (km)</label>
              <input
                id="veh-daily"
                type="number"
                min={10}
                required
                value={dailyAvgKm}
                onChange={(e) => setDailyAvgKm(Number(e.target.value))}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-corr" className="dm-label">Operating Corridor</label>
              <select
                id="veh-corr"
                value={corridorId}
                onChange={(e) => setCorridorId(e.target.value)}
                className="dm-input"
              >
                {corridors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
            {!isEdit && (
              <div>
                <label htmlFor="veh-drv" className="dm-label">Initial Assigned Driver</label>
                <select
                  id="veh-drv"
                  value={assignedDriverId}
                  onChange={(e) => setAssignedDriverId(e.target.value)}
                  className="dm-input"
                >
                  <option value="">Unassigned</option>
                  {drivers
                    .filter((d) => d.operationalStatus === 'active')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.licenseNumber})
                      </option>
                    ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="veh-ins-prov" className="dm-label">Insurance Provider</label>
              <input
                id="veh-ins-prov"
                value={insuranceProvider}
                onChange={(e) => setInsuranceProvider(e.target.value)}
                className="dm-input"
              />
            </div>
            <div>
              <label htmlFor="veh-ins" className="dm-label">Insurance Expiry *</label>
              <input
                id="veh-ins"
                type="date"
                required
                value={insuranceExpiry}
                onChange={(e) => setInsuranceExpiry(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-rc" className="dm-label">Registration (RC) Expiry *</label>
              <input
                id="veh-rc"
                type="date"
                required
                value={registrationExpiry}
                onChange={(e) => setRegistrationExpiry(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-fc" className="dm-label">Fitness (FC) Expiry</label>
              <input
                id="veh-fc"
                type="date"
                value={fitnessExpiry}
                onChange={(e) => setFitnessExpiry(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-puc" className="dm-label">PUC Emission Expiry</label>
              <input
                id="veh-puc"
                type="date"
                value={pucExpiry}
                onChange={(e) => setPucExpiry(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="veh-perm" className="dm-label">Permit Expiry</label>
              <input
                id="veh-perm"
                type="date"
                value={permitExpiry}
                onChange={(e) => setPermitExpiry(e.target.value)}
                className="dm-input tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E5E5]">
          <button
            type="button"
            onClick={() => navigate(isEdit && existing ? `/dashboard/fleet/vehicles/${existing.id}` : '/dashboard/fleet')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button type="submit" disabled={quotaReached} className="btn-accent disabled:opacity-50">
            <CheckCircle2 className="w-4 h-4" />
            {isEdit ? 'Save Vehicle Changes' : 'Register Vehicle'}
          </button>
        </div>
      </form>
    </div>
  )
}
