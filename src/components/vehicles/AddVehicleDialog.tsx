import { useState } from 'react'
import { X, Truck } from 'lucide-react'
import { TNCity } from '../../hooks/useTNCities'
import { AddVehicleData } from '../../hooks/useVehicles'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (data: AddVehicleData) => Promise<{ error: any }>
  cities: TNCity[]
}

const MAKES = ['Tata', 'Mahindra', 'Ashok Leyland', 'Eicher', 'BharatBenz', 'Swaraj Mazda', 'MG', 'Force Motors', 'Other']

export default function AddVehicleDialog({ open, onClose, onAdd, cities }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<AddVehicleData>>({
    vehicle_type: 'ICE',
    fuel_type: 'Diesel',
    year: new Date().getFullYear(),
  })

  const set = (k: keyof AddVehicleData, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.registration_number || !form.make || !form.model) return
    setLoading(true)
    const { error } = await onAdd(form as AddVehicleData)
    setLoading(false)
    if (error) toast.error('Failed to add vehicle: ' + (error.message || error))
    else {
      toast.success(`${form.registration_number} added to fleet!`)
      setForm({ vehicle_type: 'ICE', fuel_type: 'Diesel', year: new Date().getFullYear() })
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass-card rounded-2xl p-6 animate-scale-in border border-border/80">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            <h2 className="font-display font-semibold text-base">Add Vehicle</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Registration Number *</label>
              <input id="vehicle-reg" required placeholder="TN09EF7890" value={form.registration_number || ''} onChange={e => set('registration_number', e.target.value.toUpperCase())} className="drive-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Make *</label>
              <select id="vehicle-make" required value={form.make || ''} onChange={e => set('make', e.target.value)} className="drive-input appearance-none">
                <option value="">Select make</option>
                {MAKES.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Model *</label>
              <input id="vehicle-model" required placeholder="Ace Gold" value={form.model || ''} onChange={e => set('model', e.target.value)} className="drive-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Year</label>
              <input id="vehicle-year" type="number" min="2005" max={new Date().getFullYear()} value={form.year || ''} onChange={e => set('year', Number(e.target.value))} className="drive-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type</label>
              <select id="vehicle-type" value={form.vehicle_type} onChange={e => set('vehicle_type', e.target.value)} className="drive-input appearance-none">
                <option value="ICE">ICE (Combustion)</option>
                <option value="EV">EV (Electric)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fuel Type</label>
              <select id="vehicle-fuel" value={form.fuel_type} onChange={e => set('fuel_type', e.target.value)} className="drive-input appearance-none">
                <option value="Diesel">Diesel</option>
                <option value="Petrol">Petrol</option>
                <option value="CNG">CNG</option>
                <option value="Electric">Electric</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Current Mileage (km)</label>
              <input id="vehicle-mileage" type="number" min="0" placeholder="48200" value={form.current_mileage || ''} onChange={e => set('current_mileage', Number(e.target.value))} className="drive-input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">City</label>
              <select id="vehicle-city" value={form.city_id || ''} onChange={e => set('city_id', e.target.value)} className="drive-input appearance-none">
                <option value="">Select city</option>
                {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Assigned Driver</label>
              <input id="vehicle-driver" placeholder="Driver name" value={form.assigned_driver || ''} onChange={e => set('assigned_driver', e.target.value)} className="drive-input" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button id="vehicle-submit" type="submit" disabled={loading} className="btn-gold flex-1 flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
