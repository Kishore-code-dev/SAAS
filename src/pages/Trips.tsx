import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { DRIVERS } from '../data/fleetData'
import { Navigation, Clock, MapPin, StopCircle, Activity, CheckCircle2, Search, Filter, Download, ArrowUpRight, Truck, User, Calendar, MoreHorizontal, ChevronRight, X } from 'lucide-react'
import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

const Y = '#F5C518'
const G = '#00C896'
const M = '#FF4444'

export default function Trips() {
  const { trips, vehicles } = useFleet()
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedTrip, setSelectedTrip] = useState<any>(null)

  const stats = useMemo(() => {
    const active = trips.filter(t => t.status === 'active').length
    const completed = trips.filter(t => t.status === 'completed').length
    const dist = trips.reduce((s, t) => s + t.distance, 0)
    const dur = trips.reduce((s, t) => s + (t.duration || 0), 0)
    return [
      { label: 'Active Missions', value: active, icon: Navigation, color: Y },
      { label: 'Completed', value: completed, icon: CheckCircle2, color: G },
      { label: 'Fleet Distance', value: `${dist.toLocaleString()} km`, icon: MapPin, color: Y },
      { label: 'Mission Hours', value: `${Math.round(dur / 60)}h`, icon: Clock, color: '#fff' },
    ]
  }, [trips])

  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      const driver = DRIVERS.find(d => d.id === trip.driverId)?.name || ''
      const vehicle = vehicles.find(v => v.id === trip.vehicleId)?.registrationNo || ''
      const matchesSearch = driver.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           vehicle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           trip.id.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'All' || trip.status === statusFilter.toLowerCase()
      return matchesSearch && matchesStatus
    })
  }, [trips, searchTerm, statusFilter, vehicles])

  const handleExport = () => {
    const csv = [
      ['Trip ID', 'Driver', 'Vehicle', 'Distance', 'Duration', 'Status', 'Start Address'],
      ...filteredTrips.map(t => [
        t.id, 
        DRIVERS.find(d => d.id === t.driverId)?.name,
        vehicles.find(v => v.id === t.vehicleId)?.registrationNo,
        t.distance,
        t.duration,
        t.status,
        t.startAddress
      ])
    ].map(e => e.join(",")).join("\n")
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.setAttribute('href', url)
    a.setAttribute('download', `DriveMitra_Trips_${new Date().toISOString().split('T')[0]}.csv`)
    a.click()
  }

  return (
    <div className="space-y-10 page-enter pt-6 pb-20 relative">
      <AnimatePresence>
         {selectedTrip && (
            <div className="fixed inset-0 z-[60] flex justify-end">
               <motion.div 
                 initial={{ opacity: 0 }} 
                 animate={{ opacity: 1 }} 
                 exit={{ opacity: 0 }}
                 onClick={() => setSelectedTrip(null)}
                 className="absolute inset-0 bg-black/60 backdrop-blur-sm"
               />
               <motion.div 
                 initial={{ x: '100%' }}
                 animate={{ x: 0 }}
                 exit={{ x: '100%' }}
                 transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                 className="w-full max-w-xl bg-[#0A0A0A] border-l border-white/5 h-full relative z-10 shadow-premium p-10 overflow-y-auto no-scrollbar"
               >
                  <button onClick={() => setSelectedTrip(null)} className="absolute top-8 right-8 text-muted hover:text-white transition-colors">
                     <X className="w-6 h-6" />
                  </button>
                  <div className="mb-12">
                     <div className="inline-block px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-6">Mission Intelligence</div>
                     <h2 className="text-4xl font-display font-black text-white tracking-tighter mb-2">Trip #{selectedTrip.id.slice(-6)}</h2>
                     <p className="text-muted text-sm font-bold uppercase tracking-widest">Global Telemetry Log</p>
                  </div>

                  <div className="space-y-8">
                     <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                           <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Asset Status</p>
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-success" />
                              <span className="text-sm font-black text-white uppercase tracking-widest">{selectedTrip.status}</span>
                           </div>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6">
                           <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-3">Energy Consumed</p>
                           <p className="text-xl font-display font-black text-white">{Math.round(selectedTrip.distance * 0.12)} L <span className="text-[10px] text-muted font-bold ml-1">EST.</span></p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center gap-5 p-5 bg-white/[0.02] border border-white/5 rounded-3xl">
                           <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                              <User className="w-6 h-6 text-primary" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-muted uppercase tracking-widest">Assigned Pilot</p>
                              <p className="text-sm font-black text-white">{DRIVERS.find(d => d.id === selectedTrip.driverId)?.name}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-5 p-5 bg-white/[0.02] border border-white/5 rounded-3xl">
                           <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                              <Truck className="w-6 h-6 text-muted" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-muted uppercase tracking-widest">Asset Registry</p>
                              <p className="text-sm font-black text-white">{vehicles.find(v => v.id === selectedTrip.vehicleId)?.registrationNo}</p>
                           </div>
                        </div>
                     </div>

                     <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted mb-6">Mission Trajectory</h4>
                        <div className="relative pl-8 space-y-12">
                           <div className="absolute left-[3.5px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary to-transparent" />
                           <div className="relative">
                              <div className="absolute left-[-32px] top-1 w-2.5 h-2.5 rounded-full bg-primary shadow-gold" />
                              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Departure</p>
                              <p className="text-sm font-bold text-white">{selectedTrip.startAddress}</p>
                              <p className="text-[10px] text-muted font-bold mt-1 uppercase">{new Date(selectedTrip.startTime).toLocaleString()}</p>
                           </div>
                           {selectedTrip.stops.length > 0 && selectedTrip.stops.map((stop: any, idx: number) => (
                             <div key={idx} className="relative">
                               <div className="absolute left-[-32px] top-1 w-2.5 h-2.5 rounded-full bg-white/20 border border-white/10" />
                               <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Intermediate Node #{idx+1}</p>
                               <p className="text-sm font-bold text-white/60">Geo-Point {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}</p>
                             </div>
                           ))}
                           <div className="relative">
                              <div className="absolute left-[-32px] top-1 w-2.5 h-2.5 rounded-full bg-white/10" />
                              <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Destination</p>
                              <p className="text-sm font-bold text-white/40">{selectedTrip.endAddress || 'Synchronizing Point...'}</p>
                           </div>
                        </div>
                     </div>

                     <button className="w-full btn-primary !py-5 !rounded-2xl !text-[11px] uppercase tracking-widest">Download Full Telemetry Pack</button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Navigation className="w-3.5 h-3.5" /> Mission Command
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">{t('nav.trips')}</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Smartphone-Driven Global Telemetry List</p>
        </div>
        <div className="flex items-center gap-4">
           <button 
             onClick={handleExport}
             className="px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white hover:bg-white/10 hover:border-white/20 uppercase tracking-widest transition-all flex items-center gap-3"
           >
              <Download className="w-4 h-4" /> Export Ledger
           </button>
           <button className="btn-primary !px-6 !py-3.5 !text-[10px] uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Schedule Dispatch
           </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         {stats.map((s, i) => (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: i * 0.05 }}
             key={i} 
             className="glass-card p-6 rounded-[24px] border border-white/5 bg-white/[0.02] flex items-center justify-between group cursor-default shadow-premium"
           >
              <div>
                 <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-2">{s.label}</p>
                 <p className="text-3xl font-display font-black text-white tracking-tighter group-hover:text-primary transition-colors">{s.value}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                 <s.icon className="w-5 h-5 transition-colors" style={{ color: s.color }} />
              </div>
           </motion.div>
         ))}
      </div>

      {/* Auto-Detection Banner */}
      <div className="glass-card p-8 rounded-[32px] border-primary/20 bg-primary/[0.03] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
         <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors" />
         <div className="w-16 h-16 rounded-[20px] bg-primary flex items-center justify-center flex-shrink-0 shadow-gold rotate-3 group-hover:rotate-0 transition-transform">
            <Activity className="w-8 h-8 text-black" />
         </div>
         <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-display font-black text-white mb-2 uppercase tracking-tight">Smartphone AI Detection</h3>
            <p className="text-sm font-medium text-muted/80 leading-relaxed max-w-3xl">
               Missions ignite automatically when velocity exceeds <span className="text-primary font-black">10 km/h</span> for 30 seconds. 
               Zero hardware tracking ensures <span className="text-primary font-black">100% fleet visibility</span> without capital expenditure.
            </p>
         </div>
         <button className="px-6 py-3 rounded-xl border border-primary/40 bg-transparent text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all">
            Audit Logic
         </button>
      </div>

      {/* List / Table Section */}
      <div className="glass-card rounded-[32px] border border-white/5 bg-white/[0.02] overflow-hidden flex flex-col shadow-premium">
         <div className="p-8 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3.5 w-full max-w-md gap-4 focus-within:border-primary/50 transition-all">
               <Search className="w-4 h-4 text-muted" />
               <input 
                 type="text" 
                 placeholder="Search registry or ID..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-muted/40 font-bold"
               />
            </div>

            <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
               {['All', 'Active', 'Completed'].map(f => (
                 <button 
                   key={f}
                   onClick={() => setStatusFilter(f)}
                   className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-primary text-black shadow-gold' : 'text-muted hover:text-white hover:bg-white/5'}`}
                 >
                   {f}
                 </button>
               ))}
            </div>
         </div>

         <div className="overflow-x-auto no-scrollbar">
            <table className="dm-table">
               <thead>
                  <tr>
                     <th>Ident / ID</th>
                     <th>Assigned Pilot</th>
                     <th>Registry Unit</th>
                     <th>Path Start</th>
                     <th>Logistics KM</th>
                     <th>Duration</th>
                     <th>Status</th>
                     <th className="text-right">Action</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredTrips.map(trip => {
                     const driver = DRIVERS.find(d => d.id === trip.driverId)
                     const vehicle = vehicles.find(v => v.id === trip.vehicleId)
                     const isActive = trip.status === 'active'
                     
                     return (
                        <tr key={trip.id} onClick={() => setSelectedTrip(trip)} className="cursor-pointer group">
                           <td className="font-mono text-primary text-[11px] font-black opacity-60 group-hover:opacity-100 transition-opacity">#{trip.id.slice(-8)}</td>
                           <td className="font-black text-white">{driver?.name}</td>
                           <td className="text-muted font-bold tracking-tight uppercase">{vehicle?.registrationNo}</td>
                           <td className="truncate max-w-[200px] text-muted-foreground font-medium">{trip.startAddress}</td>
                           <td className="font-display font-black text-white">{trip.distance} <span className="text-[9px] text-muted ml-0.5">KM</span></td>
                           <td className="text-muted font-bold">{trip.duration}m</td>
                           <td>
                              <span className={cn(
                                "badge text-[10px] px-3 py-1",
                                isActive ? "badge-moving" : "badge-idle"
                              )}>
                                 {isActive ? <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> : null}
                                 {trip.status}
                              </span>
                           </td>
                           <td className="text-right">
                              <button className="p-2 rounded-xl text-muted hover:text-white hover:bg-white/5 group-hover:translate-x-1 transition-all">
                                 <ChevronRight className="w-5 h-5" />
                              </button>
                           </td>
                        </tr>
                     )
                  })}
               </tbody>
            </table>
         </div>

         {filteredTrips.length === 0 && (
            <div className="p-20 text-center">
               <Navigation className="w-12 h-12 text-muted/10 mx-auto mb-6" />
               <p className="text-muted text-sm font-bold uppercase tracking-widest">No matching mission records found.</p>
            </div>
         )}
      </div>
    </div>
  )
}
