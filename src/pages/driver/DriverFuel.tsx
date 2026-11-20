import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'
import { Plus, Camera, Fuel, Receipt, Clock, ChevronRight, ImageIcon, Loader2, CheckCircle2, AlertTriangle, X } from 'lucide-react'
import { formatShortDate, formatDateTime, formatInr } from '../../components/ui/EnterprisePrimitives'
import { toast } from 'sonner'

type FuelForm = {
  vehicleId: string
  litersOrKwh: string
  amountInr: string
  unitPriceInr: string
  odometerKm: string
  station: string
  paymentMethod: 'upi' | 'fleet_card' | 'cash' | 'ev_charging'
  entrySource: 'owner_entry' | 'receipt_ocr' | 'station_feed'
  notes: string
}

export default function DriverFuel() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { vehicles, drivers, fuelTransactions, addFuelTransaction } = useFleet()
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all')
  const [showForm, setShowForm] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [form, setForm] = useState<FuelForm>({
    vehicleId: '',
    litersOrKwh: '',
    amountInr: '',
    unitPriceInr: '',
    odometerKm: '',
    station: '',
    paymentMethod: 'cash',
    entrySource: 'owner_entry',
    notes: '',
  })

  const myVehicle = vehicles.find((v) => v.assignedDriverId === user?.id)
  const myFuelLogs = fuelTransactions
    .filter((f) => f.driverId === user?.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const filteredLogs = filter === 'all' ? myFuelLogs : myFuelLogs.filter((f) => f.verificationStatus === filter)

  useEffect(() => {
    if (myVehicle && !form.vehicleId) {
      setForm((f) => ({ ...f, vehicleId: myVehicle.id, odometerKm: String(myVehicle.odometerKm || '') }))
    }
  }, [myVehicle])

  const handlePhotoCapture = async () => {
    // In Capacitor, this would use Camera.getPhoto()
    // For web demo, we'll simulate
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 600
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#f0f0f0'
        ctx.fillRect(0, 0, 800, 600)
        ctx.fillStyle = '#999'
        ctx.font = '24px sans-serif'
        ctx.fillText('RECEIPT PHOTO', 280, 300)
      }
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
      // Store photo in a way that could be sent to backend
      toast.success('Photo captured (demo)')
    } catch (err) {
      toast.error('Failed to capture photo')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vehicleId || !form.litersOrKwh || !form.amountInr || !form.odometerKm || !form.station || !form.unitPriceInr) {
      toast.error('Please fill all required fields')
      return
    }
    if (Number(form.odometerKm) < (myVehicle?.odometerKm || 0)) {
      toast.error('Odometer cannot be less than current vehicle odometer')
      return
    }

    setFormLoading(true)
    try {
      const vehicle = vehicles.find((v) => v.id === form.vehicleId)
      const driver = drivers.find((d) => d.id === user?.id)

      await addFuelTransaction({
        vehicleId: form.vehicleId,
        driverId: driver?.id || '',
        amountInr: Number(form.amountInr),
        litersOrKwh: Number(form.litersOrKwh),
        unitPriceInr: Number(form.unitPriceInr),
        odometerKm: Number(form.odometerKm),
        station: form.station.trim(),
        location: vehicle?.telemetry?.location || { lat: 0, lng: 0 },
        timestamp: new Date().toISOString(),
        paymentMethod: form.paymentMethod,
        entrySource: form.entrySource,
      })

      toast.success('Fuel log submitted for verification')
      setShowForm(false)
      setForm({
        vehicleId: form.vehicleId,
        litersOrKwh: '',
        amountInr: '',
        unitPriceInr: '',
        odometerKm: '',
        station: '',
        paymentMethod: 'cash',
        entrySource: 'owner_entry',
        notes: '',
      })
    } catch (err) {
      toast.error('Failed to submit fuel log')
    } finally {
      setFormLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#625346]">Fuel Logs</h1>
          <p className="text-sm text-[#958777]">Record and track refuelling</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Fuel Log
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-2">
        <div className="flex gap-1">
          {(['all', 'pending', 'verified'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === status
                  ? 'bg-[#6E5696] text-white shadow-sm'
                  : 'text-[#958777] hover:bg-[#F7F5F2] hover:text-[#625346]'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Fuel Logs List */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <Fuel className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
            <h3 className="font-semibold text-[#625346]">
              {filter === 'all' ? 'No fuel logs yet' : `No ${filter} logs`}
            </h3>
            <p className="text-sm text-[#958777] mt-1">Tap "Add Fuel Log" to record refuelling</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5E5]">
            {filteredLogs.map((log) => {
              const vehicle = vehicles.find((v) => v.id === log.vehicleId)
              const statusConfig = {
                verified: { label: 'Verified', color: 'text-[#1F7A4C]', bg: 'bg-[#ECFDF5]', icon: CheckCircle2 },
                pending: { label: 'Pending', color: 'text-[#8F6510]', bg: 'bg-[#FEF3C7]', icon: Clock },
                needs_review: { label: 'Needs Review', color: 'text-[#B84E42]', bg: 'bg-[#FEF2F2]', icon: AlertTriangle },
                rejected: { label: 'Rejected', color: 'text-[#B84E42]', bg: 'bg-[#FEF2F2]', icon: AlertTriangle },
              }[log.verificationStatus] || { label: 'Unknown', color: 'text-[#958777]', bg: 'bg-[#F3F4F6]', icon: Clock }
              const StatusIcon = statusConfig.icon

              return (
                <div key={log.id} className="p-4 hover:bg-[#FAFAFA] transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${statusConfig.bg} ${statusConfig.color}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#625346] truncate">
                            {vehicle?.registrationNumber || log.vehicleId}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-[#958777]">
                          <span className="flex items-center gap-1">
                            <Fuel className="w-3.5 h-3.5" />
                            {log.litersOrKwh} L @ ₹{log.unitPriceInr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDateTime(log.timestamp)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5" />
                            {formatInr(log.amountInr)}
                          </span>
                        </div>
                        <p className="text-xs text-[#958777] mt-1">{log.station}</p>
                        {log.odometerKm && (
                          <p className="text-xs text-[#958777] mt-1">Odometer: {log.odometerKm.toLocaleString('en-IN')} km</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/driver/fuel/${log.id}`)}
                      className="btn-secondary text-sm px-4 py-2 flex items-center gap-2"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span className="hidden sm:inline">Details</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Fuel Log Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-5 border-b border-[#E5E5E5] flex items-center justify-between">
              <h2 className="font-bold text-[#625346] text-lg">Add Fuel Log</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-[#F0EEE9] text-[#958777]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="dm-label">Vehicle *</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                  className="dm-input"
                  required
                >
                  {vehicles.filter((v) => v.assignedDriverId === user?.id).map((v) => (
                    <option key={v.id} value={v.id}>{v.registrationNumber} · {v.make} {v.model}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dm-label">Liters *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.litersOrKwh}
                    onChange={(e) => setForm((f) => ({ ...f, litersOrKwh: e.target.value }))}
                    className="dm-input tabular-nums"
                    required
                    min="0.1"
                  />
                </div>
                <div>
                  <label className="dm-label">Unit Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitPriceInr}
                    onChange={(e) => setForm((f) => ({ ...f, unitPriceInr: e.target.value }))}
                    className="dm-input tabular-nums"
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dm-label">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amountInr}
                    onChange={(e) => setForm((f) => ({ ...f, amountInr: e.target.value }))}
                    className="dm-input tabular-nums"
                    required
                    min="1"
                  />
                </div>
                <div>
                  <label className="dm-label">Odometer (km) *</label>
                  <input
                    type="number"
                    value={form.odometerKm}
                    onChange={(e) => setForm((f) => ({ ...f, odometerKm: e.target.value }))}
                    className="dm-input tabular-nums"
                    required
                    min={myVehicle?.odometerKm || 0}
                  />
                </div>
              </div>

              <div>
                <label className="dm-label">Station *</label>
                <input
                  type="text"
                  value={form.station}
                  onChange={(e) => setForm((f) => ({ ...f, station: e.target.value }))}
                  className="dm-input"
                  placeholder="Fuel station name"
                  required
                />
              </div>

              <div>
                <label className="dm-label">Payment Method *</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value as FuelForm['paymentMethod'] }))}
                  className="dm-input"
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="fleet_card">Fleet Card</option>
                  <option value="ev_charging">EV Charging</option>
                </select>
              </div>

              <div>
                <label className="dm-label">Entry Source *</label>
                <select
                  value={form.entrySource}
                  onChange={(e) => setForm((f) => ({ ...f, entrySource: e.target.value as FuelForm['entrySource'] }))}
                  className="dm-input"
                  required
                >
                  <option value="owner_entry">Driver Entry</option>
                  <option value="receipt_ocr">Receipt OCR</option>
                  <option value="station_feed">Station Feed</option>
                </select>
              </div>

              {/* Photo Requirements */}
              <div className="bg-[#F7F5F2] rounded-xl p-4">
                <h4 className="font-semibold text-[#625346] flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Receipt Photo (Recommended)
                </h4>
                <button
                  type="button"
                  onClick={handlePhotoCapture}
                  className="w-full p-4 rounded-lg text-center border-2 border-dashed border-[#E5E5E5] hover:border-[#D1D5DB] transition-colors"
                >
                  <Camera className="w-8 h-8 text-[#958777] mx-auto mb-1" />
                  <span className="text-sm text-[#958777]">Tap to Capture Receipt</span>
                  <p className="text-xs text-[#958777] mt-1">Clear photo of receipt showing amount, date, and vendor</p>
                </button>
              </div>

              <div>
                <label className="dm-label">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="dm-input"
                  rows={2}
                  placeholder="Any additional notes"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 btn-primary"
                >
                  {formLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Submit Fuel Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}