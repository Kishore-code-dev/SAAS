import React, { useState } from 'react'
import { Smartphone, Wifi, WifiOff, Camera, MapPin, CheckCircle2 } from 'lucide-react'
import { useFleet } from '../hooks/useFleet'
import PageHeader from '../components/layout/PageHeader'

export default function MobileAppSimulator() {
  const { activeOrganization, vehicles, drivers, workOrders, fuelTransactions } = useFleet()
  const [mobileRole, setMobileRole] = useState<'owner' | 'staff' | 'driver'>('owner')
  const [offlineMode, setOfflineMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'fleet' | 'trips' | 'fuel' | 'profile'>('home')

  const ownerVehiclesCount = vehicles.length
  const ownerDriversCount = drivers.length
  const pendingFuelReview = fuelTransactions.filter((f) => f.verificationStatus === 'needs_review').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="DriveMitra Mobile App Simulator & React Native Workspace"
        subtitle={`${activeOrganization.name} · Preview and test the unified mobile app for Owners, Staff, and Drivers in a responsive simulator frame`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
            {(['owner', 'staff', 'driver'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setMobileRole(r)}
                className={`px-3.5 py-1.5 rounded-[8px] text-xs font-bold capitalize transition-colors ${
                  mobileRole === r ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777] hover:text-[#625346]'
                }`}
              >
                {r === 'owner' ? 'Fleet Owner' : r === 'staff' ? 'Fleet Staff' : 'Fleet Driver'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setOfflineMode((m) => !m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 ${
              offlineMode ? 'bg-[#D9786C]/15 border-[#D9786C] text-[#B84E42]' : 'bg-[#EAF7EF] border-[#1F7A4C] text-[#156C3F]'
            }`}
          >
            {offlineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            {offlineMode ? 'Offline (SQLite Queued)' : 'Online (Synced)'}
          </button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Specification & Architecture Summary */}
        <div className="lg:col-span-5 space-y-4">
          <div className="enterprise-card p-5 space-y-4">
            <h2 className="dm-card-title flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#6E5696]" />
              Unified React Native & Expo Architecture
            </h2>
            <p className="text-xs text-[#958777] leading-relaxed">
              DriveMitra Mobile is built with Expo Router and React Native, sharing the same backend database and REST APIs. The authenticated user's role ({mobileRole.toUpperCase()}) automatically restricts navigation and permissions.
            </p>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                <p className="font-bold text-[#625346]">Role-Based Access Control</p>
                <p className="text-[#958777] mt-0.5">
                  {mobileRole === 'owner'
                    ? 'Full access to all 30+ enterprise modules, finance, contracts, and staff permissions.'
                    : mobileRole === 'staff'
                    ? 'Restricted operational permissions for dispatch, work orders, inventory, and inspections.'
                    : 'Streamlined driver UI for assigned trips, vehicle info, fuel logging, and GPS tracking.'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                <p className="font-bold text-[#625346]">Local Storage & Offline SQLite</p>
                <p className="text-[#958777] mt-0.5">
                  Uses Expo SQLite to queue fuel entries, expense receipts, and pre-trip inspections when cellular connectivity drops.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
                <p className="font-bold text-[#625346]">Device Capabilities Integrated</p>
                <p className="text-[#958777] mt-0.5">
                  Expo Location (background GPS), Camera (fuel pump & receipt OCR), Notifications, and SecureStore.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Phone Simulator Frame */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-[380px] bg-[#111111] rounded-[44px] p-3 shadow-2xl border-4 border-[#333333]">
            {/* Phone Screen Notch / Island */}
            <div className="w-full bg-[#FFFFFF] rounded-[36px] overflow-hidden flex flex-col h-[740px] border border-[#E5E5E5]">
              {/* Status Bar */}
              <div className="bg-[#EEE8F7] px-6 py-2.5 flex items-center justify-between text-[11px] font-bold text-[#625346] shrink-0 border-b border-[#DDD3ED]">
                <span>9:41 AM</span>
                <div className="flex items-center gap-2">
                  <span>5G</span>
                  {offlineMode ? <WifiOff className="w-3 h-3 text-[#B84E42]" /> : <Wifi className="w-3 h-3 text-[#1F7A4C]" />}
                  <div className="w-5 h-2.5 rounded-sm border border-[#625346] p-0.5 flex items-center">
                    <div className="h-full w-3.5 bg-[#625346] rounded-2xs" />
                  </div>
                </div>
              </div>

              {/* App Header */}
              <div className="bg-[#FFFFFF] px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#EEE8F7] text-[#6E5696] flex items-center justify-center font-bold text-xs">
                    DM
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#625346] truncate max-w-[160px]">{activeOrganization.name}</p>
                    <p className="text-[10px] text-[#958777] capitalize font-semibold">{mobileRole} Portal</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#EEE8F7] text-[#6E5696]">
                  v1.0.0
                </span>
              </div>

              {/* App Content Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAFAFA]">
                {mobileRole === 'owner' && (
                  <>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-[#EEE8F7] to-[#F7F0D9] border border-[#DDD3ED] space-y-2">
                      <p className="text-[10px] font-bold uppercase text-[#6E5696]">Owner Command Overview</p>
                      <p className="text-sm font-extrabold text-[#625346]">All Systems Operational</p>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="bg-white/80 rounded-lg p-2.5 border border-[#E5E5E5]">
                          <span className="text-[#958777] block text-[10px]">Active Fleet</span>
                          <span className="text-base font-bold text-[#625346]">{ownerVehiclesCount} Vehicles</span>
                        </div>
                        <div className="bg-white/80 rounded-lg p-2.5 border border-[#E5E5E5]">
                          <span className="text-[#958777] block text-[10px]">Drivers Assigned</span>
                          <span className="text-base font-bold text-[#625346]">{ownerDriversCount} Roster</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#625346]">Owner Modules</p>
                      {[
                        { title: 'Vehicle Contracts & Fleet Partners', count: '3 active contracts' },
                        { title: 'Workshop Work Orders', count: `${workOrders.length} active jobs` },
                        { title: 'Fuel Review & OCR Anomaly Check', count: `${pendingFuelReview} flagged` },
                        { title: 'Fleet Finance & EMI Schedule', count: '₹1.25L due this month' },
                        { title: 'Reports & CSV / Excel Exports', count: '8 categories ready' },
                      ].map((m) => (
                        <div key={m.title} className="p-3 bg-white rounded-xl border border-[#E5E5E5] flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#625346]">{m.title}</p>
                            <p className="text-[10px] text-[#958777]">{m.count}</p>
                          </div>
                          <span className="text-xs font-bold text-[#6E5696]">Open →</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {mobileRole === 'staff' && (
                  <>
                    <div className="p-4 rounded-xl bg-[#EAF7EF] border border-[#C6DBC3] space-y-2">
                      <p className="text-[10px] font-bold uppercase text-[#156C3F]">Staff Operational Desk</p>
                      <p className="text-sm font-extrabold text-[#625346]">Assigned Tasks & Inspections</p>
                      <p className="text-xs text-[#958777]">Permissions granted by Fleet Owner</p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-[#625346]">Permitted Actions</p>
                      {[
                        { title: 'Pre-Trip DVIR Inspection Triage', desc: 'Log and convert inspection failures into Work Orders' },
                        { title: 'Workshop Work Orders & Parts', desc: 'Allocate spare part SKUs from warehouse' },
                        { title: 'Driver & Vehicle Assignments', desc: 'Reassign drivers to active commercial routes' },
                        { title: 'Fuel & EV Charging Logs', desc: 'Record station fills and OCR receipts' },
                      ].map((m) => (
                        <div key={m.title} className="p-3 bg-white rounded-xl border border-[#E5E5E5] space-y-1">
                          <p className="text-xs font-bold text-[#625346]">{m.title}</p>
                          <p className="text-[10px] text-[#958777]">{m.desc}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {mobileRole === 'driver' && (
                  <>
                    <div className="p-4 rounded-xl bg-[#FCECEB] border border-[#D9786C] space-y-2">
                      <p className="text-[10px] font-bold uppercase text-[#B84E42]">Active Commercial Dispatch</p>
                      <p className="text-sm font-extrabold text-[#625346]">Route: Kochi to Coimbatore</p>
                      <p className="text-xs text-[#625346]">Vehicle: TN 38 AB 1234 · Tata 407 Gold</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="p-3 bg-white rounded-xl border border-[#E5E5E5] text-left space-y-1">
                        <Camera className="w-4 h-4 text-[#6E5696]" />
                        <p className="text-xs font-bold text-[#625346]">Log Fuel / Receipt</p>
                        <p className="text-[10px] text-[#958777]">Capture pump photo</p>
                      </button>
                      <button type="button" className="p-3 bg-white rounded-xl border border-[#E5E5E5] text-left space-y-1">
                        <MapPin className="w-4 h-4 text-[#1F7A4C]" />
                        <p className="text-xs font-bold text-[#625346]">GPS Tracking</p>
                        <p className="text-[10px] text-[#958777]">Background active</p>
                      </button>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-[#E5E5E5] space-y-2">
                      <p className="text-xs font-bold text-[#625346]">Assigned Documents & KYC</p>
                      <div className="flex items-center justify-between text-xs text-[#958777]">
                        <span>Commercial DL (TRANS)</span>
                        <span className="text-[#1F7A4C] font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bottom Tab Bar */}
              <div className="bg-[#FFFFFF] border-t border-[#E5E5E5] px-6 py-2.5 flex items-center justify-between shrink-0">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'fleet', label: 'Fleet' },
                  { id: 'trips', label: 'Trips' },
                  { id: 'fuel', label: 'Fuel' },
                  { id: 'profile', label: 'Profile' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`text-[10px] font-bold ${activeTab === t.id ? 'text-[#6E5696]' : 'text-[#958777]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
