import { FileText, Download, PieChart, BarChart3, Filter, Calendar, Zap, ArrowRight, ShieldCheck, Database, FileSpreadsheet, FileBox, Layers, Globe, Clock, ChevronRight, Share2, Printer, Search, MoreHorizontal, Activity, TrendingUp, Plus, AlertTriangle } from 'lucide-react'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '../i18n/useTranslation'
import { formatCurrency, cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const G = '#00C896'
const M = '#FF4444'

export default function Reports() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState<string | null>(null)
  const [activeRange, setActiveRange] = useState('30 Days')

  const REPORT_TYPES = [
    { id: 'fleet_health', name: 'Fleet Health Matrix', desc: 'Predictive analytics on asset integrity and survival probability.', icon: ShieldCheck, color: G },
    { id: 'maintenance_roi', name: 'Maintenance ROI', desc: 'Quantified savings from AI-driven preventative interventions.', icon: TrendingUp, color: Y },
    { id: 'driver_safety', name: 'Pilot Safety Index', desc: 'Comprehensive behavioral scoring and risk exposure audit.', icon: Zap, color: '#fff' },
    { id: 'fuel_optimization', name: 'Energy Intelligence', desc: 'Consumption heatmaps and network-wide fuel efficiency.', icon: PieChart, color: Y },
  ]

  const handleExport = (name: string) => {
    setLoading(name)
    setTimeout(() => {
      setLoading(null)
      toast.success(`Protocol Pack Generated: ${name}`)
    }, 2000)
  }

  return (
    <div className="space-y-12 page-enter pt-6 pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Database className="w-3.5 h-3.5" /> Intelligence Ledger
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Advanced Reports</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">High-fidelity Fleet Analytics • Export-ready Documentation</p>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex p-1 bg-white/[0.03] border border-white/10 rounded-2xl gap-1">
              {['7 Days', '30 Days', '90 Days'].map(r => (
                <button 
                  key={r}
                  onClick={() => setActiveRange(r)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    activeRange === r ? "bg-white text-black shadow-lg" : "text-muted hover:text-white hover:bg-white/5"
                  )}
                >
                  {r}
                </button>
              ))}
           </div>
           <button className="btn-primary !px-8 !py-3.5 text-[10px] uppercase tracking-widest flex items-center gap-3 shadow-gold group">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Generate Custom Pack
           </button>
        </div>
      </div>

      {/* Primary Report Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
         {REPORT_TYPES.map((r, i) => (
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: i * 0.1 }}
             key={r.id} 
             className="glass-card group p-10 rounded-[48px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500 relative overflow-hidden shadow-premium"
           >
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/10 transition-colors" />
              
              <div className="w-16 h-16 rounded-[24px] bg-white/[0.03] border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:border-primary/30 transition-all duration-500">
                 <r.icon className="w-8 h-8" style={{ color: r.color }} />
              </div>

              <h3 className="text-2xl font-display font-black text-white italic tracking-tighter mb-3 uppercase leading-none">{r.name}</h3>
              <p className="text-[11px] font-bold text-muted uppercase tracking-[0.2em] leading-relaxed mb-10 opacity-50 italic">{r.desc}</p>

              <div className="flex items-center gap-3 pt-6 border-t border-white/5">
                 <button 
                   onClick={() => handleExport(r.name)}
                   disabled={!!loading}
                   className="flex-1 btn-primary !bg-black !border-white/10 !text-white hover:!bg-primary hover:!text-black transition-all !py-4 !rounded-2xl !text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 group/btn"
                 >
                    {loading === r.name ? <Activity className="w-4 h-4 animate-spin" /> : <><Download className="w-4 h-4 group-hover/btn:translate-y-0.5 transition-transform" /> PDF Export</>}
                 </button>
                 <button className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-muted hover:text-white">
                    <Share2 className="w-4 h-4" />
                 </button>
              </div>
           </motion.div>
         ))}
      </div>

      {/* Secondary Operational Reports */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
         
         <div className="xl:col-span-2 glass-card rounded-[40px] border border-white/5 bg-white/[0.01] overflow-hidden shadow-premium">
            <div className="p-10 border-b border-white/5 flex items-center justify-between">
               <div>
                  <h3 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase">Audit Archive</h3>
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] mt-2 italic shadow-sm">Verified Transaction & Performance Protocol</p>
               </div>
               <div className="flex gap-3">
                  <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-muted hover:text-white transition-all">
                     <Search className="w-5 h-5" />
                  </button>
                  <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-muted hover:text-white transition-all">
                     <Printer className="w-5 h-5" />
                  </button>
               </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
               <table className="dm-table">
                  <thead>
                     <tr>
                        <th>Archetype / Log</th>
                        <th>Format</th>
                        <th>Manifest Date</th>
                        <th>Payload</th>
                        <th className="text-right">Integrity</th>
                     </tr>
                  </thead>
                  <tbody>
                     {[
                       { name: 'Monthly Fleet Health Scorecard', format: 'PDF', date: '2026-03-12', size: '2.4 MB', type: 'Health' },
                       { name: 'Fuel Efficiency Audit - TN Sector', format: 'XLXS', date: '2026-03-10', size: '1.1 MB', type: 'Energy' },
                       { name: 'Vehicle Readiness Synthesis', format: 'JSON', date: '2026-03-08', size: '0.8 MB', type: 'Maintenance' },
                       { name: 'Driver Behavior Heuristics', format: 'PDF', date: '2026-03-05', size: '5.2 MB', type: 'Safety' },
                     ].map((item, i) => (
                       <tr key={i} className="group cursor-pointer">
                          <td>
                             <div className="flex items-center gap-4">
                                <FileText className="w-5 h-5 text-muted opacity-40" />
                                <span className="text-sm font-black text-white/90 group-hover:text-primary transition-colors tracking-tight">{item.name}</span>
                             </div>
                          </td>
                          <td>
                             <span className={cn(
                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border",
                                item.format === 'PDF' ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-primary/10 border-primary/30 text-primary"
                             )}>{item.format}</span>
                          </td>
                          <td className="text-[11px] font-black text-muted uppercase tracking-widest italic">{item.date}</td>
                          <td className="text-[10px] font-bold text-muted/60 uppercase">{item.size}</td>
                          <td className="text-right">
                             <div className="flex items-center justify-end gap-3 text-success">
                                <ShieldCheck className="w-4 h-4 shadow-gold" />
                                <span className="text-[10px] font-black uppercase tracking-widest">VERIFIED</span>
                             </div>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
            
            <button className="w-full text-center py-8 bg-black/40 border-t border-white/5 text-[10px] font-black text-muted hover:text-white transition-all uppercase tracking-[0.6em] italic">Load Historical Archives</button>
         </div>

         {/* Advanced Report Config */}
         <div className="glass-card flex flex-col p-10 rounded-[40px] border border-white/5 bg-white/[0.01] shadow-premium">
            <div className="mb-10">
               <h3 className="text-xl font-display font-black text-white italic tracking-tighter uppercase mb-2">Automated Dispatch</h3>
               <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] font-bold italic">Cloud Synchronization Protocols</p>
            </div>
            
            <div className="flex-1 space-y-6">
               {[
                 { label: 'Weekly Performance Digest', value: true, icon: Globe },
                 { label: 'Critical Incident Alerts', value: true, icon: AlertTriangle },
                 { label: 'Cloud Ledger Backup', value: false, icon: Database },
                 { label: 'Neural Fleet Predictions', value: true, icon: Zap },
               ].map((item, i) => (
                 <div key={i} className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] border border-white/5 group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                          <item.icon className={cn("w-5 h-5", item.value ? "text-primary" : "text-muted")} />
                       </div>
                       <span className="text-[11px] font-black text-white/90 uppercase tracking-widest italic">{item.label}</span>
                    </div>
                    <div className={cn(
                       "w-10 h-5 rounded-full p-1 transition-colors cursor-pointer",
                       item.value ? "bg-primary" : "bg-white/10"
                    )}>
                       <div className={cn("w-3 h-3 rounded-full bg-white transition-transform", item.value ? "translate-x-5" : "translate-x-0")} />
                    </div>
                 </div>
               ))}
            </div>

            <div className="mt-10 pt-8 border-t border-white/5">
                <div className="flex items-center gap-4 mb-8">
                   <div className="w-12 h-12 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-success shadow-gold" />
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-muted uppercase tracking-widest">Next Global Sync</p>
                      <p className="text-lg font-display font-black text-white uppercase italic">In 04h 32m</p>
                   </div>
                </div>
                <button className="w-full btn-primary !py-5 !rounded-2xl !text-[11px] uppercase tracking-widest shadow-gold">Initiate Manual Sync</button>
            </div>
         </div>

      </div>

    </div>
  )
}
