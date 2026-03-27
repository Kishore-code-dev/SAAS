import { useState, useMemo } from 'react'
import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { DRIVERS } from '../data/fleetData'
import { Fuel, CheckCircle, XCircle, Upload, TrendingDown, BarChart2, Smartphone, CreditCard, Banknote, IndianRupee, AlertTriangle, Search, Filter, Download, MoreHorizontal, ChevronRight, Activity, Wallet, Monitor } from 'lucide-react'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const M = '#FF4444'
const G = '#00C896'
const A = '#FFB347'

const PM_ICONS: Record<string, any> = {
  upi: { icon: Smartphone, color: '#9c27b0' },
  googlepay: { icon: Monitor, color: G },
  phonepe: { icon: Wallet, color: '#673ab7' },
  paytm: { icon: CreditCard, color: '#03a9f4' },
  cash: { icon: Banknote, color: G }
}

export default function FuelLogs() {
  const { fuelTransactions, vehicles } = useFleet()
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending'>('all')
  const [search, setSearch] = useState('')

  const stats = useMemo(() => {
    const totalAmount = fuelTransactions.reduce((s, t) => s + t.amount, 0)
    const totalLiters = fuelTransactions.reduce((s, t) => s + t.liters, 0)
    const avgPrice = totalAmount / (totalLiters || 1)
    const pending = fuelTransactions.filter(t => !t.verified).length

    return [
      { label: 'Total Fuel Spend', value: `₹${(totalAmount / 1000).toFixed(1)}K`, icon: IndianRupee, color: Y, trend: '+4.2%' },
      { label: 'Total Volume', value: `${totalLiters.toLocaleString()}L`, icon: Fuel, color: '#fff', trend: '-1.8%' },
      { label: 'Avg Unit Price', value: `₹${avgPrice.toFixed(1)}`, icon: BarChart2, color: Y, trend: '+0.5%' },
      { label: 'Pending Audit', value: pending, icon: AlertTriangle, color: M, trend: 'ACTION' },
    ]
  }, [fuelTransactions])

  const filtered = useMemo(() => {
    return fuelTransactions.filter(tx => {
      const v = vehicles.find(veh => veh.id === tx.vehicleId)?.registrationNo || ''
      const d = DRIVERS.find(drv => drv.id === tx.driverId)?.name || ''
      const matchesSearch = v.toLowerCase().includes(search.toLowerCase()) || d.toLowerCase().includes(search.toLowerCase()) || tx.station.toLowerCase().includes(search.toLowerCase())
      const matchesFilter = filter === 'all' || (filter === 'verified' && tx.verified) || (filter === 'pending' && !tx.verified)
      return matchesSearch && matchesFilter
    })
  }, [fuelTransactions, search, filter, vehicles])

  return (
    <div className="space-y-10 page-enter pt-6 pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Fuel className="w-3.5 h-3.5" /> Energy Logistics
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Fuel Intelligence</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Verified Consumption Ledgers • Real-time Burn Rate</p>
        </div>
        <div className="flex items-center gap-4">
           <button className="px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white hover:bg-white/10 transition-all uppercase tracking-widest flex items-center gap-3">
              <Download className="w-4 h-4" /> Audit PDF
           </button>
           <button className="btn-primary !px-8 !py-3.5 text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-gold">
              <Plus className="w-4 h-4" /> Log Purchase
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
                 <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-display font-black text-white tracking-tighter group-hover:text-primary transition-colors">{s.value}</p>
                    <span className={cn("text-[9px] font-black tracking-tighter", s.trend.startsWith('+') ? "text-success" : s.trend === 'ACTION' ? "text-danger" : "text-primary")}>{s.trend}</span>
                 </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                 <s.icon className="w-5 h-5 transition-colors" style={{ color: s.color }} />
              </div>
           </motion.div>
         ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap items-center gap-6 bg-white/[0.01] p-6 rounded-[32px] border border-white/5 backdrop-blur-3xl shadow-premium">
        <div className="relative group flex-1 min-w-[320px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search transaction, vehicle or pilot..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/40 border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold tracking-tight focus:ring-1 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none text-white placeholder:text-muted/30 shadow-inner"
          />
        </div>
        
        <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl gap-1">
           {['All', 'Verified', 'Pending'].map(f => (
             <button 
               key={f}
               onClick={() => setFilter(f.toLowerCase() as any)}
               className={cn(
                 "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                 filter === f.toLowerCase() ? "bg-primary text-black shadow-gold" : "text-muted hover:text-white hover:bg-white/5"
               )}
             >
                {f}
             </button>
           ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass-card rounded-[32px] border border-white/5 bg-white/[0.01] overflow-hidden shadow-premium">
         <table className="dm-table">
            <thead>
               <tr>
                  <th>Vehicle / Unit</th>
                  <th>Assigned Pilot</th>
                  <th>Fuel Station</th>
                  <th>Energy Amount</th>
                  <th>Volume (L)</th>
                  <th>Modality</th>
                  <th>Verification</th>
                  <th className="text-right">Action</th>
               </tr>
            </thead>
            <tbody>
               {filtered.map(tx => {
                  const vehicle = vehicles.find(v => v.id === tx.vehicleId)
                  const driver = DRIVERS.find(d => d.id === tx.driverId)
                  const pm = PM_ICONS[tx.paymentMethod] || { icon: Banknote, color: G }
                  
                  return (
                     <tr key={tx.id} className="group cursor-pointer">
                        <td>
                           <p className="font-black text-white italic tracking-tighter uppercase">{vehicle?.registrationNo}</p>
                           <p className="text-[10px] text-muted font-bold tracking-widest">{vehicle?.model}</p>
                        </td>
                        <td className="font-black text-white/90">{driver?.name}</td>
                        <td className="text-muted font-bold tracking-tight uppercase truncate max-w-[150px]">{tx.station}</td>
                        <td className="font-display font-black text-white">₹{tx.amount.toLocaleString()}</td>
                        <td className="text-muted font-bold tracking-widest">{tx.liters}L</td>
                        <td>
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                                 <pm.icon className="w-4 h-4" style={{ color: pm.color }} />
                              </div>
                              <span className="text-[10px] font-black uppercase text-muted tracking-widest">{tx.paymentMethod}</span>
                           </div>
                        </td>
                        <td>
                           <div className="flex items-center gap-2">
                              {tx.verified ? (
                                <span className="badge badge-moving !bg-success/5 !border-success/20 !text-success"><CheckCircle className="w-3 h-3" /> VERIFIED</span>
                              ) : (
                                <span className="badge badge-idle !bg-danger/5 !border-danger/20 !text-danger"><Activity className="w-3 h-3" /> PENDING</span>
                              )}
                           </div>
                        </td>
                        <td className="text-right">
                           <button className="p-2 rounded-xl text-muted hover:text-white transition-all group-hover:bg-white/5">
                              <ChevronRight className="w-5 h-5" />
                           </button>
                        </td>
                     </tr>
                  )
               })}
            </tbody>
         </table>

         {filtered.length === 0 && (
            <div className="p-20 text-center">
               <Fuel className="w-12 h-12 text-muted/10 mx-auto mb-6" />
               <p className="text-muted text-sm font-bold uppercase tracking-widest">No matching consumption logs discovered</p>
            </div>
         )}
      </div>

    </div>
  )
}
