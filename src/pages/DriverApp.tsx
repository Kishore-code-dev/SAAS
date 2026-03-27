import { useState, useEffect } from 'react'
import { useFleet } from '../hooks/useFleet'
import { useAuth } from '../hooks/useAuth'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from '../i18n/useTranslation'
import { DRIVERS, DRIVER_SCORES, StopReason } from '../data/fleetData'
import { toast } from 'sonner'
import {
  Play, Square, MapPin, Fuel, Upload,
  Navigation, Clock, Gauge, CheckCircle, X, ChevronRight,
  Coffee, Wrench, TrafficCone, MapPinOff, ScanFace,
  CreditCard, Smartphone, ShieldAlert, FileText, QrCode, UserCog, Activity, Zap, Star, LayoutGrid, Settings2, LogOut, Loader2
} from 'lucide-react'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const G = '#00C896'
const M = '#FF4444'

const STOP_REASONS: { key: StopReason; label: string; icon: any }[] = [
  { key: 'fuel', label: 'Fuel Refill', icon: Fuel },
  { key: 'food', label: 'Food Break', icon: Coffee },
  { key: 'restroom', label: 'Restroom', icon: MapPinOff },
  { key: 'inspection', label: 'Inspection', icon: Wrench },
  { key: 'traffic', label: 'Traffic Block', icon: TrafficCone },
  { key: 'other', label: 'Other', icon: MapPin },
]

const PAYMENT_METHODS = [
  { key: 'upi', label: 'UPI / GPay', icon: Smartphone },
  { key: 'phonepe', label: 'PhonePe', icon: Smartphone },
  { key: 'paytm', label: 'Paytm Wallet', icon: CreditCard },
  { key: 'cash', label: 'Fleet Cash', icon: CreditCard },
]

export default function DriverApp() {
  const { currentDriverId, vehicles, trips, startTrip, endTrip, addFuelTransaction, setUserRole } = useFleet()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const driver = DRIVERS.find(d => d.id === currentDriverId) || DRIVERS[0]
  const vehicle = vehicles.find(v => v.id === driver.vehicleId) || vehicles[0]
  const score = DRIVER_SCORES.find(s => s.driverId === driver.id)
  const currentTrip = trips.find(t => t.driverId === driver.id && t.status === 'active')

  const [tripDuration, setTripDuration] = useState(0)
  const [showStopModal, setShowStopModal] = useState(false)
  const [showFuelModal, setShowFuelModal] = useState(false)
  const [fuelForm, setFuelForm] = useState({ amount: '', liters: '', station: '', method: 'upi' })

  useEffect(() => {
    if (!currentTrip) return
    const timer = setInterval(() => { setTripDuration(prev => prev + 1) }, 1000)
    return () => clearInterval(timer)
  }, [currentTrip])

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`
  }

  const handleStartTrip = () => {
    startTrip(driver.id, vehicle.id)
    setTripDuration(0)
    toast.success('Mission Ignited: GPS Telemetry Active.')
  }

  const handleEndTrip = () => {
    if (!currentTrip) return
    endTrip(currentTrip.id)
    toast.success(`Mission Concluded: ${currentTrip.distance}km logged.`)
  }

  const handleLogFuel = () => {
    addFuelTransaction({
      vehicleId: vehicle?.id || 'v001', driverId: driver.id, amount: parseInt(fuelForm.amount),
      liters: parseFloat(fuelForm.liters), pricePerLiter: parseInt(fuelForm.amount) / parseFloat(fuelForm.liters),
      station: fuelForm.station || 'Station', location: vehicle?.location || { lat: 0, lng: 0 },
      timestamp: new Date(), paymentMethod: fuelForm.method as any, verified: false,
    })
    setShowFuelModal(false)
    setFuelForm({ amount: '', liters: '', station: '', method: 'upi' })
    toast.success('Energy Logged: Verification Pending.')
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] text-white p-6 space-y-8 page-enter pb-24 relative overflow-x-hidden">
      
      {/* Background kinetic effect */}
      <div className="absolute -left-20 -top-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Profile Bar */}
      <div className="glass-card p-6 rounded-[32px] border border-white/5 bg-white/[0.01] shadow-premium flex items-center justify-between group">
         <div className="flex items-center gap-6">
            <div className="relative">
               <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-105 transition-transform">
                  {driver.avatar?.startsWith('http') ? <img src={driver.avatar} className="w-full h-full object-cover" /> : <p className="text-2xl font-display font-black text-primary">{driver.avatar}</p>}
               </div>
               {currentTrip && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-success rounded-full border-2 border-black animate-pulse" />}
            </div>
            <div>
               <h2 className="text-xl font-display font-black tracking-tighter italic uppercase">{driver.name}</h2>
               <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1 italic">{vehicle?.registrationNo} • TN SECTOR</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1 italic">PILOT SCORE</p>
            <p className="text-2xl font-display font-black" style={{ color: (score?.overall || 0) > 80 ? G : Y }}>{score?.overall}</p>
         </div>
      </div>

      {/* Main Control Panel */}
      <AnimatePresence mode="wait">
        {!currentTrip ? (
           <motion.div 
             key="start" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
             className="glass-card p-10 rounded-[48px] border border-white/5 bg-white/[0.01] text-center shadow-premium relative overflow-hidden"
           >
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
              <div className="w-20 h-20 rounded-[32px] bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-8 shadow-gold animate-float">
                 <Navigation className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-display font-black italic tracking-tighter uppercase mb-2">Initiate Mission</h3>
              <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] mb-10 italic">Global Telemetry Logic Active</p>
              <button 
                onClick={handleStartTrip}
                className="w-full btn-primary !py-6 !rounded-[24px] !text-base font-black uppercase tracking-[0.3em] shadow-gold flex items-center justify-center gap-4 group"
              >
                 <Play className="w-6 h-6 fill-black group-hover:scale-110 transition-transform" /> GNSS IGNITION
              </button>
           </motion.div>
        ) : (
           <motion.div 
             key="active" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
             className="glass-card p-8 rounded-[48px] border border-primary/30 bg-primary/[0.02] shadow-premium relative overflow-hidden"
           >
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />
              
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse shadow-gold" />
                    <span className="text-[10px] font-black text-success uppercase tracking-[0.4em]">Mission Propelled</span>
                 </div>
                 <div className="flex items-center gap-2 text-[10px] font-black text-muted uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    <Clock className="w-3.5 h-3.5" /> {formatDuration(tripDuration)}
                 </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-10">
                 {[
                   { icon: Gauge, label: 'Velocity', val: `${vehicle?.speed || 0}`, unit: 'KM/H', color: Y },
                   { icon: MapPin, label: 'Trajectory', val: `${currentTrip.distance}`, unit: 'KM', color: '#fff' },
                   { icon: Activity, label: 'Logic Hz', val: '10.2', unit: 'IPS', color: G },
                 ].map((s, i) => (
                    <div key={i} className="bg-black/40 border border-white/10 rounded-3xl p-5 text-center shadow-inner group transition-all hover:bg-black/60">
                       <s.icon className="w-4 h-4 mx-auto mb-3 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: s.color }} />
                       <p className="text-xl font-display font-black leading-none italic" style={{ color: s.color }}>{s.val}</p>
                       <p className="text-[7px] font-black text-muted uppercase tracking-[0.2em] mt-2 italic">{s.unit}</p>
                    </div>
                 ))}
              </div>

              <button 
                onClick={handleEndTrip}
                className="w-full btn-primary !bg-danger !text-white !py-5 !rounded-[24px] !text-[11px] font-black uppercase tracking-[0.4em] shadow-lg flex items-center justify-center gap-4"
              >
                 <Square className="w-4 h-4 fill-white" /> CONCLUDE PROTOCOL
              </button>
           </motion.div>
        )}
      </AnimatePresence>

      {/* Utility Grid */}
      <div className="space-y-6">
         <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-black text-muted uppercase tracking-[0.4em] italic">Tactical Actions</h3>
            <Settings2 className="w-4 h-4 text-muted/40" />
         </div>
         
         <div className="grid grid-cols-2 gap-4">
            {[
              { icon: QrCode, label: 'UPI Scan', action: () => toast.info('Accessing Neural Camera...'), color: Y },
              { icon: Fuel, label: 'Log Energy', action: () => setShowFuelModal(true), color: G },
              { icon: ShieldAlert, label: 'Distress Signal', action: () => toast.error('Emergency Broadcast Signal Sent.'), color: M },
              { icon: FileText, label: 'Service Log', action: () => toast.info('Maintenance Registry Locked.'), color: '#fff' },
            ].map((item, i) => (
               <button 
                 key={i} onClick={item.action} 
                 className="glass-card p-6 rounded-[36px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] transition-all text-left flex flex-col gap-6 shadow-premium relative group"
               >
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                     <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <div>
                     <p className="text-[11px] font-black text-white uppercase tracking-widest italic leading-none">{item.label}</p>
                     <ChevronRight className="w-4 h-4 text-muted/20 mt-3 group-hover:translate-x-1 group-hover:text-white transition-all" />
                  </div>
               </button>
            ))}
         </div>
      </div>

      {/* Fuel Intelligence Modal */}
      <AnimatePresence>
        {showFuelModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFuelModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
             <motion.div 
               initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="w-full glass-card max-w-md bg-black rounded-t-[48px] border-t border-white/10 p-10 pb-16 relative z-10 shadow-3xl overflow-y-auto no-scrollbar"
             >
                <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mb-8" />
                <div className="flex items-center justify-between mb-10">
                   <h3 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase">Log Energy</h3>
                   <button onClick={() => setShowFuelModal(false)} className="text-muted hover:text-white transition-colors"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="space-y-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4">Purchase Sum (₹)</label>
                      <input 
                        type="number" placeholder="4500" value={fuelForm.amount}
                        onChange={e => setFuelForm(p => ({ ...p, amount: e.target.value }))} 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-display font-black text-primary outline-none focus:border-primary/50 transition-all font-mono"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4">Liters</label>
                         <input 
                           type="number" placeholder="42.5" value={fuelForm.liters}
                           onChange={e => setFuelForm(p => ({ ...p, liters: e.target.value }))} 
                           className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4">Station ID</label>
                         <input 
                           type="text" placeholder="IOCL Hub" value={fuelForm.station}
                           onChange={e => setFuelForm(p => ({ ...p, station: e.target.value }))} 
                           className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold text-white outline-none focus:border-primary/50 transition-all"
                         />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-4">Payment Modality</label>
                      <div className="grid grid-cols-2 gap-3">
                         {PAYMENT_METHODS.map(pm => (
                           <button 
                             key={pm.key} onClick={() => setFuelForm(p => ({ ...p, method: pm.key }))}
                             className={cn(
                               "flex items-center gap-4 p-4 rounded-2xl border transition-all text-[11px] font-black uppercase tracking-widest",
                               fuelForm.method === pm.key ? "bg-primary text-black border-primary shadow-gold" : "bg-white/5 border-white/10 text-muted hover:border-white/30"
                             )}
                           >
                              <pm.icon className="w-4 h-4" /> {pm.label}
                           </button>
                         ))}
                      </div>
                   </div>

                   <button className="w-full py-5 rounded-2xl border border-dashed border-white/20 text-[10px] font-black text-muted uppercase tracking-widest flex items-center justify-center gap-3 hover:border-primary/40 transition-all group">
                      <Upload className="w-4 h-4 group-hover:-translate-y-1 transition-transform" /> Snapshot Receipt
                   </button>
                   
                   <button 
                     onClick={handleLogFuel} 
                     className="w-full btn-primary !py-6 !rounded-[24px] !text-[11px] font-black uppercase tracking-[0.4em] shadow-gold mt-4"
                   >
                      Verify Transaction
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Interface Logic Toggle */}
      <div className="pt-10 group">
         <button 
           onClick={() => { setUserRole('admin'); navigate('/dashboard') }}
           className="w-full glass-card p-6 rounded-[32px] border border-white/5 bg-white/[0.01] hover:bg-white/5 transition-all flex items-center justify-center gap-4 text-[10px] font-black text-muted/40 uppercase tracking-[0.4em] italic group-hover:text-primary transition-colors"
         >
            <UserCog className="w-5 h-5" /> Return to Command Terminal
         </button>
      </div>

    </div>
  )
}
