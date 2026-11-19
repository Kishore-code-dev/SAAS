import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useFleet } from '../../hooks/useFleet'
import { EnterpriseModal } from '../ui/EnterprisePrimitives'
import type { FuelType, PowertrainType, VehicleCategory } from '../../types/fleet'

export default function AddVehicleDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { addVehicle, corridors, drivers, vehicles, activeOrganization } = useFleet()
  const quotaReached = vehicles.length >= activeOrganization.vehicleLimit

  const [registrationNumber, setRegistrationNumber] = useState('')
  const [make, setMake] = useState('Tata')
  const [model, setModel] = useState('Ace Gold')
  const [category, setCategory] = useState<VehicleCategory>('Light Commercial')
  const [powertrain, setPowertrain] = useState<PowertrainType>('ICE')
  const [fuelType, setFuelType] = useState<FuelType>('Diesel')
  const [year, setYear] = useState(2024)
  const [odometerKm, setOdometerKm] = useState(12500)
  const [dailyAvgKm, setDailyAvgKm] = useState(140)
  const [corridorId, setCorridorId] = useState(corridors[0]?.id ?? 'cor-chennai')
  const [assignedDriverId, setAssignedDriverId] = useState('')
  const [insuranceProvider, setInsuranceProvider] = useState('HDFC ERGO Commercial')
  const [insuranceExpiry, setInsuranceExpiry] = useState('2027-06-30')
  const [registrationExpiry, setRegistrationExpiry] = useState('2030-06-30')
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
        insuranceProvider,
        insuranceExpiry,
        registrationExpiry,
      })
      toast.success(`Registered ${created.registrationNumber} into active organization`)
      setRegistrationNumber('')
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to register vehicle.'
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <EnterpriseModal
      open={open}
      onClose={onClose}
      title="Register New Vehicle"
      subtitle="Creates a Vehicle Digital Twin with initial component health baselines"
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {quotaReached && (
          <div className="p-3 rounded-[10px] bg-[#FCF5DE] border border-[#D8B442] text-xs text-[#625346] flex items-center justify-between gap-3">
            <span>
              Vehicle quota reached ({vehicles.length}/{activeOrganization.vehicleLimit}) on{' '}
              <strong className="uppercase">{activeOrganization.planId}</strong>.
            </span>
            <Link
              to="/dashboard/subscription"
              onClick={onClose}
              className="font-semibold text-[#6E5696] hover:underline whitespace-nowrap"
            >
              Upgrade Plan
            </Link>
          </div>
        )}
        {formError && (
          <div
            role="alert"
            className="p-3 rounded-[10px] bg-[#D9786C]/20 border border-[#D9786C] text-xs font-semibold text-[#625346]"
          >
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="veh-reg" className="dm-label">Registration Number *</label>
            <input
              id="veh-reg"
              required
              value={registrationNumber}
              onChange={(e) => {
                setRegistrationNumber(e.target.value)
                setFormError(null)
              }}
              placeholder="TN 01 XY 4021"
              className="dm-input font-mono uppercase"
            />
          </div>
          <div>
            <label htmlFor="veh-powertrain" className="dm-label">Powertrain</label>
            <select
              id="veh-powertrain"
              value={powertrain}
              onChange={(e) => handlePowertrainChange(e.target.value as PowertrainType)}
              className="dm-input"
            >
              <option value="ICE">ICE (Combustion)</option>
              <option value="EV">EV (Electric)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="veh-make" className="dm-label">Manufacturer *</label>
            <input
              id="veh-make"
              required
              value={make}
              onChange={(e) => setMake(e.target.value)}
              className="dm-input"
            />
          </div>
          <div>
            <label htmlFor="veh-model" className="dm-label">Model *</label>
            <input
              id="veh-model"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="dm-input"
            />
          </div>
          <div>
            <label htmlFor="veh-year" className="dm-label">Model Year</label>
            <input
              id="veh-year"
              type="number"
              min={1990}
              max={new Date().getFullYear() + 1}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="dm-input font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="veh-category" className="dm-label">Category</label>
            <select
              id="veh-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as VehicleCategory)}
              className="dm-input"
            >
              <option value="Light Commercial">Light Commercial</option>
              <option value="Medium Truck">Medium Truck</option>
              <option value="Heavy Truck">Heavy Truck</option>
              <option value="Delivery Van">Delivery Van</option>
              <option value="Electric Cargo">Electric Cargo</option>
            </select>
          </div>
          <div>
            <label htmlFor="veh-fuel" className="dm-label">Fuel / Energy</label>
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
            <label htmlFor="veh-corridor" className="dm-label">Primary Corridor</label>
            <select
              id="veh-corridor"
              value={corridorId}
              onChange={(e) => setCorridorId(e.target.value)}
              className="dm-input"
            >
              {corridors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="veh-odo" className="dm-label">Odometer (km)</label>
            <input
              id="veh-odo"
              type="number"
              min={0}
              value={odometerKm}
              onChange={(e) => setOdometerKm(Number(e.target.value))}
              className="dm-input font-mono"
            />
          </div>
          <div>
            <label htmlFor="veh-daily" className="dm-label">Avg Daily km</label>
            <input
              id="veh-daily"
              type="number"
              min={1}
              value={dailyAvgKm}
              onChange={(e) => setDailyAvgKm(Number(e.target.value))}
              className="dm-input font-mono"
            />
          </div>
          <div>
            <label htmlFor="veh-driver" className="dm-label">Assign Driver</label>
            <select
              id="veh-driver"
              value={assignedDriverId}
              onChange={(e) => setAssignedDriverId(e.target.value)}
              className="dm-input"
            >
              <option value="">Unassigned</option>
              {drivers.filter((d) => d.operationalStatus === 'active').map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="veh-ins" className="dm-label">Insurance Provider</label>
            <input
              id="veh-ins"
              value={insuranceProvider}
              onChange={(e) => setInsuranceProvider(e.target.value)}
              className="dm-input"
            />
          </div>
          <div>
            <label htmlFor="veh-ins-exp" className="dm-label">Insurance Expiry</label>
            <input
              id="veh-ins-exp"
              type="date"
              value={insuranceExpiry}
              onChange={(e) => setInsuranceExpiry(e.target.value)}
              className="dm-input font-mono"
            />
          </div>
          <div>
            <label htmlFor="veh-reg-exp" className="dm-label">RC Validity</label>
            <input
              id="veh-reg-exp"
              type="date"
              value={registrationExpiry}
              onChange={(e) => setRegistrationExpiry(e.target.value)}
              className="dm-input font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={quotaReached} className="btn-primary disabled:opacity-50">
            Register Vehicle
          </button>
        </div>
      </form>
    </EnterpriseModal>
  )
}
