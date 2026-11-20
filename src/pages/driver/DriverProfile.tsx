import React, { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useFleet } from '../../hooks/useFleet'
import { User, Truck, Badge, Shield, Bell, LogOut, Camera, Edit2, MapPin, Clock, CheckCircle2, AlertTriangle, Settings, Mail, Phone, Key, ChevronRight, IdCard } from 'lucide-react'
import { formatShortDate, formatDateTime } from '../../components/ui/EnterprisePrimitives'
import { toast } from 'sonner'

export default function DriverProfile() {
  const { user, signOut, organization } = useAuth()
  const { drivers, vehicles, trips } = useFleet()

  const [activeTab, setActiveTab] = useState<'profile' | 'vehicle' | 'trips' | 'settings'>('profile')
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: '',
    licenseNumber: '',
    licenseExpiry: '',
    emergencyContact: '',
    emergencyPhone: '',
  })

  const myDriver = drivers.find((d) => d.id === user?.id)
  const myVehicle = myDriver?.assignedVehicleId ? vehicles.find((v) => v.id === myDriver.assignedVehicleId) : null
  const myTrips = trips
    .filter((t) => t.driverId === user?.id)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 5)

  useEffect(() => {
    if (myDriver) {
      setFormData({
        fullName: myDriver.name,
        email: user?.email || '',
        phone: myDriver.mobile,
        licenseNumber: myDriver.licenseNumber,
        licenseExpiry: myDriver.licenseExpiry,
        emergencyContact: '',
        emergencyPhone: '',
      })
    }
  }, [myDriver, user])

  const handleSave = async () => {
    // TODO: Call update driver API
    toast.success('Profile updated successfully')
    setEditMode(false)
  }

  const handleLogout = async () => {
    await signOut()
  }

  const tabs = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'vehicle', icon: Truck, label: 'My Vehicle' },
    { id: 'trips', icon: MapPin, label: 'Recent Trips' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <div className="bg-gradient-to-r from-[#6E5696] to-[#5A457A] p-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{user?.fullName || 'Driver'}</h1>
              <p className="text-[#E8DFFC] text-sm mt-1 capitalize">{user?.role}</p>
              <p className="text-[#E8DFFC] text-xs mt-1">{organization?.name || user?.organizationId || 'Organization'}</p>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              {editMode ? <CheckCircle2 className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-[#E5E5E5]">
          <nav className="flex overflow-x-auto" aria-label="Profile tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#6E5696] text-[#6E5696]'
                    : 'border-transparent text-[#958777] hover:text-[#625346] hover:bg-[#FAFAFA]'
                }`}
              >
                <tab.icon className="w-4 h-4 inline mr-1" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-5">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div className="bg-[#F7F5F2] rounded-xl p-5">
                <h3 className="font-semibold text-[#625346] mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="dm-label">Full Name</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={formData.fullName}
                          onChange={(e) => setFormData((f) => ({ ...f, fullName: e.target.value }))}
                          className="dm-input"
                        />
                      ) : (
                        <p className="text-[#625346] font-medium">{formData.fullName}</p>
                      )}
                    </div>
                    <div>
                      <label className="dm-label">Email</label>
                      {editMode ? (
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
                          className="dm-input"
                        />
                      ) : (
                        <p className="text-[#625346] font-medium">{formData.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="dm-label">Phone</label>
                      {editMode ? (
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                          className="dm-input"
                        />
                      ) : (
                        <p className="text-[#625346] font-medium">{formData.phone}</p>
                      )}
                    </div>
                    <div>
                      <label className="dm-label">Driver ID</label>
                      <p className="text-[#625346] font-medium font-mono">{user?.id}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* License Info */}
              <div className="bg-[#F7F5F2] rounded-xl p-5">
                <h3 className="font-semibold text-[#625346] mb-4 flex items-center gap-2">
                  <IdCard className="w-5 h-5" />
                  License Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="dm-label">License Number</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.licenseNumber}
                        onChange={(e) => setFormData((f) => ({ ...f, licenseNumber: e.target.value }))}
                        className="dm-input"
                      />
                    ) : (
                      <p className="text-[#625346] font-medium font-mono">{formData.licenseNumber || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="dm-label">License Expiry</label>
                    {editMode ? (
                      <input
                        type="date"
                        value={formData.licenseExpiry}
                        onChange={(e) => setFormData((f) => ({ ...f, licenseExpiry: e.target.value }))}
                        className="dm-input"
                      />
                    ) : (
                      <p className="text-[#625346] font-medium">{formData.licenseExpiry ? formatShortDate(formData.licenseExpiry) : 'Not set'}</p>
                    )}
                  </div>
                </div>
                {formData.licenseExpiry && (
                  <p className="text-xs mt-2 flex items-center gap-1 text-[#B84E42]">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Renew before {formatShortDate(formData.licenseExpiry)}
                  </p>
                )}
              </div>

              {/* Emergency Contact */}
              <div className="bg-[#F7F5F2] rounded-xl p-5">
                <h3 className="font-semibold text-[#625346] mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Emergency Contact
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="dm-label">Contact Name</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={formData.emergencyContact}
                        onChange={(e) => setFormData((f) => ({ ...f, emergencyContact: e.target.value }))}
                        className="dm-input"
                      />
                    ) : (
                      <p className="text-[#625346] font-medium">{formData.emergencyContact || 'Not set'}</p>
                    )}
                  </div>
                  <div>
                    <label className="dm-label">Contact Phone</label>
                    {editMode ? (
                      <input
                        type="tel"
                        value={formData.emergencyPhone}
                        onChange={(e) => setFormData((f) => ({ ...f, emergencyPhone: e.target.value }))}
                        className="dm-input"
                      />
                    ) : (
                      <p className="text-[#625346] font-medium">{formData.emergencyPhone || 'Not set'}</p>
                    )}
                  </div>
                </div>
              </div>

              {editMode && (
                <div className="flex gap-3 pt-4 border-t border-[#E5E5E5]">
                  <button onClick={() => setEditMode(false)} className="flex-1 btn-secondary">
                    Cancel
                  </button>
                  <button onClick={handleSave} className="flex-1 btn-primary">
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'vehicle' && (
            <div className="space-y-6">
              {myVehicle ? (
                <>
                  <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-xl bg-[#EEE8F7] flex items-center justify-center">
                          <Truck className="w-8 h-8 text-[#6E5696]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-[#625346] text-lg">{myVehicle.registrationNumber}</h3>
                          <p className="text-sm text-[#958777]">{myVehicle.make} {myVehicle.model} · {myVehicle.powertrain}</p>
                          <p className="text-xs text-[#958777] mt-1">Odometer: {myVehicle.odometerKm?.toLocaleString('en-IN')} km</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          myVehicle.operationStatus === 'moving' || myVehicle.operationStatus === 'idle' ? 'bg-[#ECFDF5] text-[#1F7A4C]' :
                          myVehicle.operationStatus === 'maintenance' ? 'bg-[#FEF3C7] text-[#8F6510]' :
                          'bg-[#F3F4F6] text-[#6B7280]'
                        }`}>
                          {myVehicle.operationStatus.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
                    <h3 className="font-semibold text-[#625346] mb-4">Vehicle Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[#958777]">Category</p>
                        <p className="font-medium text-[#625346]">{myVehicle.category}</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">Powertrain</p>
                        <p className="font-medium text-[#625346]">{myVehicle.powertrain}</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">City</p>
                        <p className="font-medium text-[#625346]">{myVehicle.cityName}</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">Health Score</p>
                        <p className="font-medium text-[#625346]">{myVehicle.healthScore}%</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">Last Service</p>
                        <p className="font-medium text-[#625346]">{myVehicle.lastServiceDate ? formatShortDate(myVehicle.lastServiceDate) : 'Not recorded'}</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">Insurance Expiry</p>
                        <p className="font-medium text-[#625346]">{myVehicle.insuranceExpiry ? formatShortDate(myVehicle.insuranceExpiry) : 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">Fitness Expiry</p>
                        <p className="font-medium text-[#625346]">{myVehicle.fitnessExpiry ? formatShortDate(myVehicle.fitnessExpiry) : 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-[#958777]">PUC Expiry</p>
                        <p className="font-medium text-[#625346]">{myVehicle.pucExpiry ? formatShortDate(myVehicle.pucExpiry) : 'Not set'}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center">
                  <Truck className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
                  <h3 className="font-semibold text-[#625346]">No Vehicle Assigned</h3>
                  <p className="text-sm text-[#958777] mt-1">Contact your fleet manager for vehicle assignment</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'trips' && (
            <div className="space-y-4">
              {myTrips.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E5E5E5] p-8 text-center">
                  <MapPin className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
                  <h3 className="font-semibold text-[#625346]">No Recent Trips</h3>
                  <p className="text-sm text-[#958777] mt-1">Your trip history will appear here</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                    <h3 className="font-semibold text-[#625346]">Recent Trips</h3>
                    <button className="text-sm text-[#6E5696] font-medium hover:underline">
                      View All
                    </button>
                  </div>
                  <div className="divide-y divide-[#E5E5E5]">
                    {myTrips.map((trip) => (
                      <div key={trip.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#EEE8F7] flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5 text-[#6E5696]" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-semibold text-[#625346] truncate">
                              {trip.originAddress} → {trip.destinationAddress}
                            </h4>
                            <p className="text-sm text-[#958777]">{formatShortDate(trip.startTime)}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          trip.status === 'completed' ? 'bg-[#ECFDF5] text-[#1F7A4C]' :
                          trip.status === 'active' ? 'bg-[#FEF3C7] text-[#8F6510]' :
                          'bg-[#EEE8F7] text-[#6E5696]'
                        }`}>
                          {trip.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E5E5E5]">
                  <h3 className="font-semibold text-[#625346]">Notifications</h3>
                </div>
                <div className="divide-y divide-[#E5E5E5]">
                  {[
                    { id: 'trip_assignments', label: 'New Trip Assignments', desc: 'Get notified when a new trip is assigned to you' },
                    { id: 'trip_reminders', label: 'Trip Reminders', desc: 'Reminders before trip start time' },
                    { id: 'fuel_reminders', label: 'Fuel Log Reminders', desc: 'Reminders to submit fuel logs' },
                    { id: 'expense_reminders', label: 'Expense Reminders', desc: 'Reminders for pending expense submissions' },
                    { id: 'maintenance_alerts', label: 'Vehicle Alerts', desc: 'Critical vehicle issues and maintenance due' },
                    { id: 'approval_updates', label: 'Approval Updates', desc: 'Status changes on your submissions' },
                  ].map((item) => (
                    <div key={item.id} className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[#625346]">{item.label}</p>
                        <p className="text-xs text-[#958777]">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        defaultChecked
                        className="w-5 h-5 text-[#6E5696] rounded border-[#D1D5DB] focus:ring-[#6E5696]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E5E5E5]">
                  <h3 className="font-semibold text-[#625346]">Account</h3>
                </div>
                <div className="divide-y divide-[#E5E5E5]">
                  <button className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#FAFAFA] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#EEE8F7] flex items-center justify-center">
                      <Key className="w-5 h-5 text-[#6E5696]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#625346]">Change Password</p>
                      <p className="text-xs text-[#958777]">Update your account password</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#D1D5DB] ml-auto" />
                  </button>
                  <button onClick={handleLogout} className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#FAFAFA] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF2F2] flex items-center justify-center">
                      <LogOut className="w-5 h-5 text-[#B84E42]" />
                    </div>
                    <div>
                      <p className="font-medium text-[#625346]">Sign Out</p>
                      <p className="text-xs text-[#958777]">Log out of your account</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[#D1D5DB] ml-auto" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ECFDF5] flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#1F7A4C]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#625346]">{myTrips.filter((t) => t.status === 'completed').length}</p>
              <p className="text-xs text-[#958777]">Completed Trips</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E5E5E5] p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EEE8F7] flex items-center justify-center">
              <Clock className="w-5 h-5 text-[#6E5696]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#625346]">{myTrips.filter((t) => t.status === 'scheduled').length}</p>
              <p className="text-xs text-[#958777]">Upcoming Trips</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}