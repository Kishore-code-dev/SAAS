import { useState, useMemo } from 'react'
import { useVehicles, Vehicle } from '../hooks/useVehicles'
import { useTNCities } from '../hooks/useTNCities'
import { useTranslation } from '../i18n/useTranslation'
import { Plus, Search, Filter, Truck, ArrowUpRight, Zap, Target, Shield, MapPin, Gauge, MoreVertical, LayoutGrid, List, ChevronRight, Activity, Battery, Fuel, Trash2, Settings2, PenTool } from 'lucide-react'
import { getHealthColor, getHealthClass, formatCurrency, cn } from '../lib/utils'
import { Link } from 'react-router-dom'
import AddVehicleDialog from '../components/vehicles/AddVehicleDialog'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const M = '#FF4444'
const G = '#00C896'

export default function Vehicles() {
  const { vehicles, loading, addVehicle, deleteVehicle } = useVehicles()
  const { cities } = useTNCities()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [addOpen, setAddOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      const q = search.toLowerCase()
      const matchSearch = !q || v.registration_number.toLowerCase().includes(q) || v.make.toLowerCase().includes(q) || v.model.toLowerCase().includes(q) || (v.assigned_driver || '').toLowerCase().includes(q)
      const matchStatus = statusFilter === 'All' || v.status === statusFilter.toLowerCase()
      const matchType = typeFilter === 'All' || v.vehicle_type === typeFilter
      return matchSearch && matchStatus && matchType
    })
  }, [vehicles, search, statusFilter, typeFilter])

  const handleDelete = async (id: string, reg: string) => {
    if (!confirm(`Confirm decommissioning of asset ${reg}?`)) return
    const { error } = await deleteVehicle(id)
    if (error) toast.error('Decommissioning sequence failed')
    else toast.success(`Asset ${reg} removed from active roster`)
  }

  return (
    <div className="space-y-10 page-enter pt-6 pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Truck className="w-3.5 h-3.5" /> Fleet Matrix
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Asset Inventory</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">
            {vehicles.length} Active Nodes • Tamil Nadu Logistics Sector
          </p>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex p-1 bg-white/[0.03] border border-white/10 rounded-2xl gap-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("p-2.5 rounded-xl transition-all", viewMode === 'grid' ? "bg-white text-black shadow-lg" : "text-muted hover:text-white")}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={cn("p-2.5 rounded-xl transition-all", viewMode === 'list' ? "bg-white text-black shadow-lg" : "text-muted hover:text-white")}
              >
                <List className="w-4 h-4" />
              </button>
           </div>
           <button 
             onClick={() => setAddOpen(true)} 
             className="btn-primary !px-8 !py-3.5 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-gold group"
           >
             <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
             Deploy New Asset
           </button>
        </div>
      </div>

      {/* Intelligence Filters */}
      <div className="flex flex-wrap items-center gap-6 bg-white/[0.01] p-6 rounded-[32px] border border-white/5 backdrop-blur-3xl shadow-premium">
        <div className="relative group flex-1 min-w-[320px]">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search by registry, model or pilot..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black/40 border-white/5 rounded-2xl py-4 pl-14 pr-6 text-sm font-bold tracking-tight focus:ring-1 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none text-white placeholder:text-muted/30 shadow-inner"
          />
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl gap-1">
               {['All', 'Healthy', 'At-Risk', 'Critical'].map(s => (
                 <button 
                   key={s}
                   onClick={() => setStatusFilter(s)}
                   className={cn(
                     "px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                     statusFilter === s ? "bg-primary text-black shadow-gold" : "text-muted hover:text-white hover:bg-white/5"
                   )}
                 >
                    {s}
                 </button>
               ))}
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl gap-1">
               {['All', 'ICE', 'EV'].map(t => (
                 <button 
                   key={t}
                   onClick={() => setTypeFilter(t)}
                   className={cn(
                     "px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                     typeFilter === t ? "bg-white text-black shadow-lg" : "text-muted hover:text-white hover:bg-white/5"
                   )}
                 >
                    {t}
                 </button>
               ))}
            </div>
        </div>
      </div>

      {/* Active Assets Surface */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-80 rounded-[40px] bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-40 glass-card rounded-[48px] border-white/5 bg-white/[0.01]"
          >
            <div className="w-20 h-20 rounded-[32px] bg-white/5 flex items-center justify-center mb-8 border border-white/10">
              <ZapOff className="w-10 h-10 text-muted/20" />
            </div>
            <h3 className="text-xl font-display font-black text-white uppercase tracking-tight mb-2">Null Sector Return</h3>
            <p className="text-muted text-[10px] font-black uppercase tracking-[0.4em]">No matching active nodes discovered</p>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
          >
            {filtered.map(v => (
              <VehicleCard key={v.id} vehicle={v} onDelete={() => handleDelete(v.id, v.registration_number)} />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            layout
            className="glass-card rounded-[40px] border border-white/5 bg-white/[0.01] overflow-hidden shadow-premium"
          >
             <table className="dm-table">
                <thead>
                   <tr>
                      <th>Registry / Unit</th>
                      <th>Model Config</th>
                      <th>Propulsion</th>
                      <th>Integrity</th>
                      <th>Risk Factor</th>
                      <th>Status Signal</th>
                      <th className="text-right">Command</th>
                   </tr>
                </thead>
                <tbody>
                   {filtered.map(v => (
                      <tr key={v.id} className="group">
                         <td className="font-black text-white italic tracking-tighter capitalize">{v.registration_number}</td>
                         <td className="text-muted font-bold tracking-tight uppercase">{v.make} {v.model}</td>
                         <td>
                            <span className={cn(
                               "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm",
                               v.vehicle_type === 'EV' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500' : 'bg-primary/10 border-primary/30 text-primary'
                            )}>{v.vehicle_type}</span>
                         </td>
                         <td>
                            <div className="flex items-center gap-3">
                               <div className="flex-1 max-w-[80px] h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <div className="h-full" style={{ width: v.health_score + '%', background: getHealthColor(v.health_score) }} />
                               </div>
                               <span className="text-[11px] font-black" style={{ color: getHealthColor(v.health_score) }}>{v.health_score}%</span>
                            </div>
                         </td>
                         <td>
                            <span className="text-[11px] font-black text-white">{Math.round((100 - v.health_score) * 0.4)}%</span>
                            <span className="text-[9px] text-muted font-bold uppercase ml-1.5">7D Risk</span>
                         </td>
                         <td>
                            <div className="flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full" style={{ background: v.status === 'healthy' ? G : v.status === 'at-risk' ? Y : M }} />
                               <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: v.status === 'healthy' ? G : v.status === 'at-risk' ? Y : M }}>{v.status}</span>
                            </div>
                         </td>
                         <td className="text-right">
                            <div className="flex items-center justify-end gap-2 pr-4">
                               <Link to={`/vehicles/${v.id}`} className="p-2.5 rounded-xl bg-white/5 text-muted hover:text-white transition-colors">
                                  <ArrowUpRight className="w-4.5 h-4.5" />
                               </Link>
                               <button onClick={() => handleDelete(v.id, v.registration_number)} className="p-2.5 rounded-xl bg-danger/5 text-danger/60 hover:text-danger transition-colors">
                                  <Trash2 className="w-4.5 h-4.5" />
                               </button>
                            </div>
                         </td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </motion.div>
        )}
      </AnimatePresence>

      <AddVehicleDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={addVehicle} cities={cities} />
    </div>
  )
}

function VehicleCard({ vehicle: v, onDelete }: { vehicle: Vehicle; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const healthColor = getHealthColor(v.health_score)
  const isEV = v.vehicle_type === 'EV'
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-8 rounded-[48px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500 relative overflow-hidden group shadow-premium"
    >
      <div className="absolute top-0 right-0 p-6 z-20">
         <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-muted hover:text-white">
               <MoreVertical className="w-5 h-5" />
            </button>
            <AnimatePresence>
               {menuOpen && (
                 <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-3 w-56 glass-card bg-black shadow-3xl rounded-3xl border border-white/10 py-3 z-50 overflow-hidden"
                  >
                     <Link to={`/vehicles/${v.id}`} className="flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/5 transition-all">
                        <Activity className="w-4 h-4 text-primary" /> Analytics Terminal
                     </Link>
                     <button className="w-full flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white/5 transition-all text-left">
                        <PenTool className="w-4 h-4 text-muted" /> Maintenance Log
                     </button>
                     <div className="mx-5 my-2 h-px bg-white/5" />
                     <button onClick={onDelete} className="w-full flex items-center gap-4 px-5 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-danger hover:bg-danger/5 transition-all text-left">
                        <Trash2 className="w-4 h-4" /> Decommission
                     </button>
                  </motion.div>
                 </>
               )}
            </AnimatePresence>
         </div>
      </div>

      <div className="absolute -left-10 -top-10 w-40 h-40 rounded-full blur-[80px] bg-primary/5 group-hover:bg-primary/10 transition-colors" />

      {/* Asset Header */}
      <div className="mb-10 relative z-10">
         <div className="flex items-center gap-3 mb-2">
            <h3 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase">{v.registration_number}</h3>
            <div className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-premium", isEV ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-500" : "bg-primary/10 border-primary/30 text-primary")}>
               {v.vehicle_type} Engine
            </div>
         </div>
         <p className="text-muted text-[10px] font-black uppercase tracking-[0.3em] opacity-60 italic">{v.make} {v.model} • Series {v.year}</p>
      </div>

      {/* Health Surface */}
      <div className="mb-10 p-6 rounded-[32px] bg-black/40 border border-white/5 relative overflow-hidden">
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
               <Shield className="w-5 h-5" style={{ color: healthColor }} />
               <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Asset Integrity Index</p>
            </div>
            <span className="text-2xl font-display font-black" style={{ color: healthColor }}>{v.health_score}%</span>
         </div>
         <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: v.health_score + '%' }} 
              transition={{ duration: 2, ease: "circOut" }}
              className="h-full shadow-lg" 
              style={{ background: healthColor }} 
            />
         </div>
         <div className="flex justify-between items-center mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center gap-5">
               <div>
                  <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">7D Failure</p>
                  <p className="text-lg font-black text-white">{Math.round((100 - v.health_score) * 0.4)}%</p>
               </div>
               <div className="w-px h-8 bg-white/10" />
               <div>
                  <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-1">30D Alert</p>
                  <p className="text-lg font-black text-white">{Math.round((100 - v.health_score) * 0.7)}%</p>
               </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
               {isEV ? <Battery className="w-5 h-5 text-cyan-500" /> : <Fuel className="w-5 h-5 text-primary" />}
            </div>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
         <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group/stat">
            <div>
               <p className="text-[8px] font-black text-muted uppercase mb-1">Status Signal</p>
               <p className="text-[10px] font-black uppercase text-white tracking-widest">{v.status}</p>
            </div>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: healthColor }} />
         </div>
         <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between group/stat">
            <div>
               <p className="text-[8px] font-black text-muted uppercase mb-1">Assignment</p>
               <p className="text-[10px] font-black uppercase text-white tracking-widest truncate max-w-[80px]">{v.city_name || 'Global'}</p>
            </div>
            <MapPin className="w-3.5 h-3.5 text-muted" />
         </div>
      </div>

      <Link to={`/vehicles/${v.id}`}>
         <button className="w-full btn-primary !bg-black !border-white/10 !text-white hover:!bg-primary hover:!text-black transition-all !py-5 !rounded-2xl !text-[11px] uppercase tracking-[0.3em] flex items-center justify-center gap-4 group/btn">
            Access Command Terminal <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
         </button>
      </Link>
    </motion.div>
  )
}
