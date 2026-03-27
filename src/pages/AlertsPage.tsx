import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { DRIVERS } from '../data/fleetData'
import { Bell, AlertTriangle, TrendingUp, Clock, Activity, Navigation, CheckCircle, Search, Filter, ShieldCheck, Zap, X, ChevronRight, MapPin, User, Info, Smartphone, BarChart3, Database } from 'lucide-react'
import { useState, useMemo } from 'react'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const M = '#FF4444'
const G = '#00C896'
const A = '#FFB347'

const AlertIcon: Record<string, any> = {
  overspeeding: { icon: TrendingUp, color: M },
  harsh_braking: { icon: Activity, color: A },
  idle: { icon: Clock, color: Y },
  suspicious_stop: { icon: AlertTriangle, color: M },
  missing_receipt: { icon: Info, color: G },
  route_deviation: { icon: Navigation, color: A },
}

export default function AlertsPage() {
  const { alerts, markAlertRead, markAllAlertsRead, unreadAlertCount } = useFleet()
  const { t } = useTranslation()
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const counters = useMemo(() => ({
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
  }), [alerts])

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => filter === 'all' || a.severity === filter)
  }, [alerts, filter])

  return (
    <div className="space-y-10 page-enter pt-6 pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-danger/10 border border-danger/20 text-danger text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Bell className="w-3.5 h-3.5" /> Intelligence Signal Terminal
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Event Monitoring</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">AI Monitoring Agent Detections • Protocol Deviations</p>
        </div>
        <div className="flex items-center gap-4">
           {unreadAlertCount > 0 && (
             <button 
               onClick={markAllAlertsRead}
               className="px-6 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black text-white hover:bg-white/10 transition-all uppercase tracking-widest flex items-center gap-3"
             >
                <ShieldCheck className="w-4 h-4" /> Acknowledge All Signals
             </button>
           )}
           <button className="btn-primary !px-8 !py-3.5 text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-gold">
              <Database className="w-4 h-4" /> Global Audit Log
           </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
         {[
           { label: 'Critical Deviations', count: counters.high, color: M, icon: Zap },
           { label: 'Warning Nodes', count: counters.medium, color: Y, icon: Activity },
           { label: 'Information Stack', count: counters.low, color: '#fff', icon: Info },
         ].map((s, i) => (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: i * 0.05 }}
             key={i} 
             className="glass-card p-8 rounded-[32px] border border-white/5 bg-white/[0.02] text-center group cursor-default shadow-premium overflow-hidden relative"
           >
              <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-primary/5 transition-colors" />
              <div className="flex flex-col items-center">
                 <p className="text-5xl font-display font-black tracking-tighter mb-2 group-hover:text-primary transition-colors" style={{ color: s.color }}>{s.count}</p>
                 <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] italic mb-6">{s.label}</p>
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <s.icon className="w-5 h-5" style={{ color: s.color }} />
                 </div>
              </div>
           </motion.div>
         ))}
      </div>

      {/* Intelligence Banner */}
      <div className="glass-card p-8 rounded-[36px] border border-primary/20 bg-primary/[0.03] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
         <div className="absolute -right-20 -bottom-20 w-60 h-60 bg-primary/10 rounded-full blur-[100px] group-hover:bg-primary/20 transition-all" />
         <div className="w-16 h-16 rounded-[24px] bg-primary flex items-center justify-center flex-shrink-0 shadow-gold group-hover:rotate-12 transition-transform duration-500">
            <Zap className="w-8 h-8 text-black" />
         </div>
         <div className="flex-1">
            <h3 className="text-xl font-display font-black text-white mb-2 uppercase tracking-tight italic">Active Neural Monitoring</h3>
            <p className="text-sm font-medium text-muted/70 leading-relaxed max-w-2xl italic">
               Heuristic agents continuously monitoring for overspeeding, suspicious stops, route deviations, and excessive idle time. 
               All deviations are quantified and integrated into Pilot Safety Indexes.
            </p>
         </div>
         <div className="flex p-1 bg-black/40 border border-white/10 rounded-2xl gap-1">
            {['All', 'High', 'Medium', 'Low'].map(f => (
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

      {/* Alerts Timeline List */}
      <div className="space-y-4">
         <AnimatePresence mode="popLayout">
            {filteredAlerts.map((alert, idx) => {
               const config = AlertIcon[alert.type] || { icon: Bell, color: '#888' }
               const driver = DRIVERS.find(d => d.id === alert.driverId)
               const isHigh = alert.severity === 'high'

               return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: alert.read ? 0.6 : 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.03 }}
                    key={alert.id}
                    onClick={() => markAlertRead(alert.id)}
                    className={cn(
                       "glass-card p-6 rounded-[28px] border border-white/5 hover:border-white/20 hover:bg-white/[0.02] cursor-pointer transition-all relative overflow-hidden group",
                       !alert.read && isHigh ? "bg-danger/[0.03] border-danger/20" : "bg-white/[0.01]"
                    )}
                  >
                     <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                        <div className="flex-shrink-0 flex flex-col items-center">
                           <div className="w-14 h-14 rounded-2xl bg-black border border-white/10 flex items-center justify-center relative shadow-lg group-hover:scale-105 transition-transform">
                              <config.icon className="w-6 h-6" style={{ color: config.color }} />
                              {isHigh && <div className="absolute -top-1 -right-1 w-3 h-3 bg-danger rounded-full shadow-gold animate-pulse border-2 border-black" />}
                           </div>
                           <p className="text-[9px] font-black text-muted uppercase tracking-widest mt-2">{alert.type.replace('_', ' ')}</p>
                        </div>

                        <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-3 mb-2">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border",
                                isHigh ? "bg-danger/10 border-danger/30 text-danger" : alert.severity === 'medium' ? "bg-warning/10 border-warning/30 text-warning" : "bg-white/5 border-white/10 text-muted"
                              )}>{alert.severity} Priority</span>
                              <span className="text-[9px] font-black text-muted/30 italic uppercase tracking-widest">Signal #{alert.id.slice(-8)}</span>
                           </div>
                           <p className={cn("text-lg font-black tracking-tight", isHigh ? "text-white" : "text-white/80")}>{alert.message}</p>
                           <div className="flex flex-wrap items-center gap-5 mt-4">
                              <div className="flex items-center gap-2">
                                 <User className="w-3.5 h-3.5 text-muted" />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{driver?.name || 'Central Data Node'}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                 <Clock className="w-3.5 h-3.5 text-muted" />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{new Date(alert.timestamp).toLocaleString()}</span>
                              </div>
                              {alert.location && (
                                <div className="flex items-center gap-2">
                                   <MapPin className="w-3.5 h-3.5 text-muted" />
                                   <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{alert.location.lat.toFixed(4)}N, {alert.location.lng.toFixed(4)}E</span>
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="flex-shrink-0 flex items-center gap-4">
                           {!alert.read && <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-gold animate-bounce" />}
                           <button className="p-3 rounded-2xl bg-white/5 text-muted group-hover:text-white group-hover:bg-white/10 transition-all">
                              <ChevronRight className="w-5 h-5" />
                           </button>
                        </div>
                     </div>
                  </motion.div>
               )
            })}
         </AnimatePresence>

         {filteredAlerts.length === 0 && (
            <div className="p-32 text-center bg-white/[0.01] rounded-[48px] border border-dashed border-white/5">
                <Bell className="w-16 h-16 text-muted/5 mx-auto mb-8" />
                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight mb-2">Signals Nominal</h3>
                <p className="text-muted text-[10px] font-black uppercase tracking-[0.4em]">No matching deviation packets discovered</p>
            </div>
         )}
      </div>

    </div>
  )
}
