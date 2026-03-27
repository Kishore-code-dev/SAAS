import { useAIPredictions } from '../hooks/useAIPredictions'
import { useMaintenanceHistory } from '../hooks/useMaintenanceHistory'
import { useVehicles } from '../hooks/useVehicles'
import { Wrench, AlertTriangle, Clock, TrendingDown, CheckCircle, History, Sparkles, Shield, IndianRupee, Zap, ChevronRight, Activity, PenTool, Terminal, DollarSign, ArrowUpRight, Plus, Download } from 'lucide-react'
import { formatCurrency, getPriorityClass, cn } from '../lib/utils'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const M = '#FF4444'
const G = '#00C896'
const A = '#FFB347'

export default function Maintenance() {
  const { predictions, loading: predLoading, resolvePrediction } = useAIPredictions()
  const { records, loading: histLoading } = useMaintenanceHistory()
  const { vehicles } = useVehicles()
  const [tab, setTab] = useState<'recommendations' | 'history'>('recommendations')
  const [resolving, setResolving] = useState<string | null>(null)

  const stats = useMemo(() => {
    const urgent = predictions.filter(r => r.priority === 'critical').length
    const totalSavings = predictions.reduce((s,r) => s + r.roi_if_fixed_now, 0)
    const riskIfDelayed = predictions.reduce((s,r) => s + r.estimated_cost_if_delayed, 0)
    
    return [
      { label: 'Critical Actions', value: urgent, icon: AlertTriangle, color: M },
      { label: 'Projected ROI', value: formatCurrency(totalSavings), icon: TrendingDown, color: G },
      { label: 'Exposure Risk', value: formatCurrency(riskIfDelayed), icon: Shield, color: Y },
      { label: 'Total Tasks', value: predictions.length, icon: Clock, color: '#fff' },
    ]
  }, [predictions])

  const handleResolve = async (id: string, component: string) => {
    setResolving(id)
    await resolvePrediction(id)
    setResolving(null)
    toast.success(`Integrity Restored: ${component} synchronized.`)
  }

  const historyByVehicle = useMemo(() => {
    return records.reduce<Record<string, typeof records>>((acc, r) => {
      const key = r.vehicle_id
      if (!acc[key]) acc[key] = []
      acc[key].push(r)
      return acc
    }, {})
  }, [records])

  return (
    <div className="space-y-10 page-enter pt-6 pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Wrench className="w-3.5 h-3.5" /> Integrity Command
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Maintenance Hub</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">AI-Quantified Fleet Resilience • Predictive Service Layer</p>
        </div>
        <div className="flex items-center gap-4">
           <button className="px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white hover:bg-white/10 transition-all uppercase tracking-widest flex items-center gap-3">
              <Download className="w-4 h-4" /> Download Audit
           </button>
           <button className="btn-primary !px-8 !py-3.5 text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-gold">
              <Plus className="w-4 h-4" /> Schedule Service
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
                    <p className="text-2xl font-display font-black text-white tracking-tighter group-hover:text-primary transition-colors">{s.value}</p>
                 </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                 <s.icon className="w-5 h-5 transition-colors" style={{ color: s.color }} />
              </div>
           </motion.div>
         ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex p-1.5 bg-white/[0.02] border border-white/10 rounded-2xl w-fit gap-2">
         {[
           { id: 'recommendations', label: 'AI Intelligence Feed', icon: Sparkles },
           { id: 'history', label: 'Service History Ledgers', icon: History }
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setTab(t.id as any)}
             className={cn(
               "flex items-center gap-3 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
               tab === t.id ? "bg-primary text-black shadow-gold" : "text-muted hover:text-white hover:bg-white/5"
             )}
           >
              <t.icon className="w-4 h-4" /> {t.label} 
              <span className="opacity-40 ml-1">[{t.id === 'recommendations' ? predictions.length : records.length}]</span>
           </button>
         ))}
      </div>

      {/* Content Render */}
      <AnimatePresence mode="wait">
        {tab === 'recommendations' ? (
           <motion.div 
             key="rec" 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
             className="space-y-6"
           >
              {predLoading ? (
                <div className="space-y-6">{Array.from({length:3}).map((_,i)=><div key={i} className="h-48 rounded-[32px] bg-white/[0.02] animate-pulse"/>)}</div>
              ) : predictions.length === 0 ? (
                <div className="glass-card p-20 rounded-[48px] border-white/5 bg-white/[0.01] text-center">
                   <div className="w-20 h-20 rounded-[32px] bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-8">
                      <CheckCircle className="w-10 h-10 text-success" />
                   </div>
                   <h3 className="text-xl font-display font-black text-white uppercase tracking-tight mb-2">Fleet Integrity Nominal</h3>
                   <p className="text-muted text-[10px] font-black uppercase tracking-[0.4em]">All components reporting perfect synchronization</p>
                </div>
              ) : (
                predictions.map((r, idx) => {
                   const isCritical = r.priority === 'critical'
                   return (
                     <motion.div 
                       initial={{ opacity: 0, x: -20 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: idx * 0.1 }}
                       key={r.id} 
                       className={cn("glass-card p-8 rounded-[40px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all relative overflow-hidden group shadow-premium", isCritical && "border-danger/20")}
                     >
                        <div className="flex flex-col xl:flex-row items-start gap-10">
                           <div className="flex-shrink-0 text-center space-y-3">
                              <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border", isCritical ? "bg-danger/10 border-danger/30 text-danger" : "bg-warning/10 border-warning/30 text-warning")}>
                                 {r.priority}
                              </div>
                              <div className="w-20 h-20 rounded-3xl bg-black border border-white/5 flex flex-col items-center justify-center p-2">
                                 <p className="text-[9px] font-black text-muted uppercase leading-none mb-1">Conf.</p>
                                 <p className="text-2xl font-display font-black text-white">{Math.round(r.confidence_score * 100)}%</p>
                              </div>
                           </div>

                           <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-4 mb-4">
                                 <h3 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase">{r.component_name}</h3>
                                 <span className="text-[10px] font-black text-muted uppercase tracking-widest border border-white/5 px-2 py-0.5 rounded-md italic">{r.registration_number} ({r.make} {r.model})</span>
                              </div>
                              <p className="text-sm font-bold text-white/70 mb-6 leading-relaxed border-l-2 border-primary/20 pl-6">{r.recommendation}</p>
                              <div className="p-5 bg-primary/5 border border-primary/20 rounded-3xl mb-8 group-hover:bg-primary/10 transition-all">
                                 <div className="flex items-center gap-3 mb-3">
                                    <Terminal className="w-3.5 h-3.5 text-primary" />
                                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Quantum Reasoning Layer</p>
                                 </div>
                                 <p className="text-[12px] font-medium text-white/50 leading-relaxed italic">{r.ai_reasoning}</p>
                              </div>

                              <div className="flex flex-wrap gap-8">
                                 <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-warning" />
                                    <div>
                                       <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-0.5">Predicted Failure</p>
                                       <p className="text-[11px] font-black text-white uppercase">{r.predicted_failure_date}</p>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <Activity className="w-4 h-4 text-primary" />
                                    <div>
                                       <p className="text-[8px] font-black text-muted uppercase tracking-widest mb-0.5">Failure Prob (30D)</p>
                                       <p className="text-[11px] font-black text-white uppercase" style={{ color: r.failure_probability_30d > 0.5 ? M : Y }}>{Math.round(r.failure_probability_30d * 100)}% Index</p>
                                    </div>
                                 </div>
                              </div>
                           </div>

                           <div className="flex-shrink-0 w-full xl:w-56 space-y-4">
                              <div className="p-5 rounded-3xl bg-black border border-white/10 shadow-inner group-hover:border-primary/20 transition-all">
                                 <div className="flex justify-between items-center mb-1">
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Fix ROI</p>
                                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-gold" />
                                 </div>
                                 <p className="text-2xl font-display font-black text-primary">{formatCurrency(r.roi_if_fixed_now)}</p>
                                 <div className="mt-3 flex gap-4 pt-4 border-t border-white/5">
                                    <div>
                                       <p className="text-[7px] font-black text-muted uppercase tracking-widest">Now</p>
                                       <p className="text-[11px] font-black text-white">{formatCurrency(r.estimated_cost_if_fixed)}</p>
                                    </div>
                                    <div>
                                       <p className="text-[7px] font-black text-muted uppercase tracking-widest">Later</p>
                                       <p className="text-[11px] font-black text-danger">{formatCurrency(r.estimated_cost_if_delayed)}</p>
                                    </div>
                                 </div>
                              </div>
                              <button 
                                onClick={() => handleResolve(r.id, r.component_name)}
                                disabled={resolving === r.id}
                                className="w-full btn-primary !py-5 !rounded-2xl !text-[10px] uppercase font-black tracking-widest shadow-gold transition-all"
                              >
                                {resolving === r.id ? <Loader2 className="animate-spin" /> : "Initiate Resolution"}
                              </button>
                           </div>
                        </div>
                     </motion.div>
                   )
                })
              )}
           </motion.div>
        ) : (
           <motion.div 
             key="hist" 
             initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
             className="space-y-8"
           >
              {Object.entries(historyByVehicle).map(([vid, vRecords]) => {
                const vehicle = vehicles.find(v => v.id === vid) || { registration_number: vRecords[0].registration_number, make: vRecords[0].make, model: vRecords[0].model }
                const totalCost = vRecords.reduce((s,r) => s + (r.cost || 0), 0)
                return (
                  <div key={vid} className="glass-card p-10 rounded-[40px] border border-white/5 bg-white/[0.01] shadow-premium">
                     <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/10">
                        <div className="flex items-center gap-6">
                           <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg group hover:bg-primary/10 transition-colors">
                              <Truck className="w-8 h-8 text-muted group-hover:text-primary transition-colors" />
                           </div>
                           <div>
                              <h3 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase">{vehicle.registration_number}</h3>
                              <p className="text-[10px] text-muted font-bold uppercase tracking-[0.3em] mt-1">{vehicle.make} {vehicle.model}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-black text-muted uppercase tracking-[0.3em] mb-1">Collective Invest</p>
                           <p className="text-3xl font-display font-black text-primary">{formatCurrency(totalCost)}</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {vRecords.map(r => (
                           <div key={r.id} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.04] transition-all flex flex-col gap-5 group">
                              <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-primary shadow-gold" />
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest">{r.maintenance_type}</p>
                                 </div>
                                 <p className="text-[9px] font-black text-muted-foreground uppercase">{new Date(r.performed_at).toLocaleDateString()}</p>
                              </div>
                              <p className="text-sm font-medium text-white/50 leading-relaxed italic">{r.description}</p>
                              <div className="flex items-center justify-between mt-2 pt-5 border-t border-white/5">
                                 <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Service By: <span className="text-white">{r.performed_by}</span></p>
                                 <p className="text-xl font-display font-black text-white">{formatCurrency(r.cost)}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
                )
              })}
           </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
