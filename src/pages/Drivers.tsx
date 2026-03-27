import { useDrivers } from '../hooks/useDrivers'
import { useVehicles } from '../hooks/useVehicles'
import { useTranslation } from '../i18n/useTranslation'
import { Users, TrendingUp, AlertTriangle, Award, Car, Flame, Zap, Trash2, CheckCircle, XCircle, Shield, Brain, Activity, ArrowRight, MapPin, Gauge, Search, Filter, MoreVertical, Star, Target, UserPlus, Info, Terminal } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts'
import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const Y = '#F5C518'
const G = '#00C896'
const M = '#FF4444'
const A = '#FFB347'

function ScoreRing({ score }: { score: number }) {
  const r = 24, c = 2 * Math.PI * r
  const pct = score / 100
  const color = score >= 80 ? G : score >= 60 ? Y : M
  return (
    <div className="relative flex items-center justify-center">
        <svg width="72" height="72" viewBox="0 0 72 72" className="transform -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
        <motion.circle 
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - pct) }}
            transition={{ duration: 2, ease: "circOut" }}
            cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeDasharray={c}
            strokeLinecap="round" className="transition-all"
            style={{ filter: `drop-shadow(0 0 8px ${color}40)` }}
        />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-display font-black tracking-tighter leading-none" style={{ color }}>{score}</span>
            <span className="text-[7px] font-black uppercase text-muted tracking-widest mt-0.5 opacity-40">INDEX</span>
        </div>
    </div>
  )
}

export default function Drivers() {
  const { drivers, loading } = useDrivers()
  const { vehicles } = useVehicles()
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [removedDrivers, setRemovedDrivers] = useState<string[]>([])
  const [pendingDrivers, setPendingDrivers] = useState([
    { id: 'p1', name: 'Raju Bhai', mobile: '+91 98765 43210', device: 'iPhone 15 Pro' },
    { id: 'p2', name: 'Vikram Singh', mobile: '+91 99887 76655', device: 'S24 Ultra' }
  ])

  const activeDrivers = useMemo(() => {
    return drivers.filter(d => !removedDrivers.includes(d.id) && d.driver_name.toLowerCase().includes(searchTerm.toLowerCase()))
  }, [drivers, removedDrivers, searchTerm])

  const stats = useMemo(() => {
    const safe = activeDrivers.filter(d => d.overall_score >= 80).length
    const needTraining = activeDrivers.filter(d => d.overall_score < 60).length
    const avgScore = activeDrivers.length > 0 ? Math.round(activeDrivers.reduce((s,d) => s + d.overall_score, 0) / activeDrivers.length) : 0
    return [
        { label: 'Active Pilots', value: activeDrivers.length, icon: Users, color: '#fff' },
        { label: 'Elite Tier', value: safe, icon: Star, color: G },
        { label: 'Risk Vectors', value: needTraining, icon: AlertTriangle, color: M },
        { label: 'Fleet Average', value: `${avgScore}%`, icon: TrendingUp, color: Y },
    ]
  }, [activeDrivers])

  const pieData = [
    { name: 'Elite Performance', value: activeDrivers.filter(d => d.overall_score >= 80).length, color: G },
    { name: 'Standard Flow',    value: activeDrivers.filter(d => d.overall_score >= 60 && d.overall_score < 80).length, color: Y },
    { name: 'Critical Risk',   value: activeDrivers.filter(d => d.overall_score < 60).length, color: M },
  ]

  const barData = activeDrivers.sort((a,b) => b.overall_score - a.overall_score).slice(0, 8).map(d => ({
    name: d.driver_name.split(' ')[0],
    score: d.overall_score,
    safety: d.aggressive_driving_score,
  }))

  const highRisk = activeDrivers.filter(d => d.overall_score < 50)

  return (
    <div className="space-y-10 page-enter pt-6 pb-20">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">
             <Brain className="w-3.5 h-3.5" /> Personnel Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Pilot Directory</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Behavioral Scoring Matrix • Global Personnel Registry</p>
        </div>
        <div className="flex items-center gap-4">
           <div className="relative group min-w-[300px]">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search pilot identity..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-3.5 pl-14 pr-6 text-[11px] font-black uppercase tracking-widest focus:ring-1 focus:ring-primary/20 focus:border-primary/40 transition-all outline-none"
              />
           </div>
           <button className="btn-primary !px-8 !py-3.5 flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-gold">
             <UserPlus className="w-4 h-4" /> Recruit Pilot
           </button>
        </div>
      </div>

      {/* Pending Approvals Section */}
      <AnimatePresence>
        {pendingDrivers.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card p-10 rounded-[48px] border border-primary/20 bg-primary/[0.03] relative overflow-hidden shadow-premium"
          >
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px]" />
            <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full bg-primary animate-ping" />
                  <h3 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase">Device Pairing Queue ({pendingDrivers.length})</h3>
               </div>
               <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline cursor-pointer">Global Authorization Protocol</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {pendingDrivers.map(p => (
                <div key={p.id} className="flex items-center justify-between p-6 rounded-[32px] bg-black/40 border border-white/10 group hover:border-primary/40 transition-all shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-xl font-display font-black text-primary border border-white/10 italic shadow-lg">{p.name[0]}</div>
                    <div>
                      <p className="text-lg font-display font-black text-white italic tracking-tight uppercase leading-none mb-2">{p.name}</p>
                      <div className="flex items-center gap-4">
                         <span className="text-[10px] font-bold text-muted uppercase tracking-widest font-mono">{p.mobile}</span>
                         <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[8px] font-black text-muted-foreground uppercase">{p.device} Detected</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { setPendingDrivers(prev => prev.filter(d => d.id !== p.id)); toast.success(`Protocol Authorized: ${p.name} synchronized.`) }}
                      className="w-12 h-12 rounded-2xl bg-success/10 text-success border border-success/20 hover:bg-success hover:text-black transition-all flex items-center justify-center shadow-lg"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => { setPendingDrivers(prev => prev.filter(d => d.id !== p.id)); toast.error(`Refusal Protocol: ${p.name} rejected.`) }}
                      className="w-12 h-12 rounded-2xl bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-black transition-all flex items-center justify-center shadow-lg"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High Risk Banner */}
      {highRisk.length > 0 && (
        <div className="flex items-center gap-6 p-8 rounded-[40px] border border-danger/30 bg-danger/[0.04] relative group overflow-hidden animate-pulse shadow-premium">
          <div className="absolute right-0 top-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
             <Flame className="w-24 h-24 text-danger" />
          </div>
          <div className="w-16 h-16 rounded-[24px] bg-danger/10 flex items-center justify-center border border-danger/20 flex-shrink-0 shadow-lg">
            <Flame className="w-8 h-8 text-danger"/>
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-display font-black text-white italic mb-1 uppercase tracking-tight">Personnel Alert: {highRisk.length} High-Risk Vectors</h3>
            <p className="text-[11px] font-black text-danger/80 uppercase tracking-widest leading-relaxed">
                Critical coaching recommended for: {highRisk.map(d => d.driver_name).join(' • ')} 
            </p>
          </div>
          <button className="px-10 py-4 rounded-2xl bg-danger text-[10px] font-black uppercase text-black italic tracking-widest shadow-lg hover:scale-105 transition-all">Coordinate Coaching</button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
         {stats.map((s, i) => (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             transition={{ delay: i * 0.05 }}
             key={i} 
             className="glass-card p-8 rounded-[40px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] flex items-center justify-between group cursor-default shadow-premium"
           >
              <div>
                 <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-4">{s.label}</p>
                 <p className="text-4xl font-display font-black text-white tracking-tighter group-hover:text-primary transition-colors">{s.value}</p>
              </div>
              <div className="w-16 h-16 rounded-[28px] bg-white/[0.03] border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all shadow-lg">
                 <s.icon className="w-7 h-7 transition-colors" style={{ color: s.color }} />
              </div>
           </motion.div>
         ))}
      </div>

      {/* Intelligence Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
         
         <div className="xl:col-span-5 glass-card p-10 rounded-[48px] border border-white/5 bg-white/[0.01] shadow-premium">
            <div className="flex items-center justify-between mb-10">
               <div>
                  <h3 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase leading-none">Status Distribution</h3>
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] mt-3 italic">Personnel Tier Manifest</p>
               </div>
               <BarChart3 className="w-6 h-6 text-muted-foreground/40" />
            </div>
            
            <div className="h-[300px] w-full relative">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={120} innerRadius={85} stroke="none" paddingAngle={12}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.8} />)}
                     </Pie>
                     <Tooltip 
                        contentStyle={{background:'rgba(0,0,0,0.95)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding: 16, backdropFilter: 'blur(20px)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)'}}
                        itemStyle={{fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#fff'}}
                     />
                  </PieChart>
               </ResponsiveContainer>
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-4xl font-display font-black text-white italic tracking-tighter">{activeDrivers.length}</p>
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest">Global</p>
               </div>
            </div>

            <div className="grid grid-cols-3 gap-6 mt-10">
               {pieData.map(p => (
                 <div key={p.name} className="flex flex-col gap-3 p-4 rounded-3xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-2">
                       <div className="w-2.5 h-2.5 rounded-full" style={{background:p.color, boxShadow: `0 0 10px ${p.color}80`}}/>
                       <span className="text-[9px] font-black text-muted uppercase tracking-widest leading-none">{p.name.split(' ')[0]}</span>
                    </div>
                    <span className="text-2xl font-display font-black italic tracking-tighter" style={{ color: p.color }}>{p.value}</span>
                 </div>
               ))}
            </div>
         </div>

         <div className="xl:col-span-7 glass-card p-10 rounded-[48px] border border-white/5 bg-white/[0.01] shadow-premium">
            <div className="flex items-center justify-between mb-10">
               <div>
                  <h3 className="text-2xl font-display font-black text-white italic tracking-tighter uppercase leading-none">Performance Matrix</h3>
                  <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] mt-3 italic">Pilot Benchmarking Indices</p>
               </div>
               <div className="flex gap-2">
                  <div className="px-3 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase">KPI Index</div>
                  <div className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-muted text-[9px] font-black uppercase">Fuel Econ</div>
               </div>
            </div>

            <div className="h-[400px] w-full mt-6">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{top:0,right:0,left:-20,bottom:0}} barCategoryGap={24}>
                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false}/>
                     <XAxis dataKey="name" tick={{fontSize:10,fill:'rgba(255,255,255,0.3)', fontWeight: 900}} axisLine={false} tickLine={false} dy={15}/>
                     <YAxis tick={{fontSize:10,fill:'rgba(255,255,255,0.3)', fontWeight: 900}} domain={[0,100]} axisLine={false} tickLine={false}/>
                     <Tooltip 
                        cursor={{fill: 'rgba(255,255,255,0.02)'}}
                        contentStyle={{background:'rgba(0,0,0,0.95)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:24, padding: 16, backdropFilter: 'blur(20px)'}}
                     />
                     <Bar dataKey="score" name="Performance Index" fill={Y} radius={[12,12,0,0]} />
                     <Bar dataKey="safety" name="Safety Vector" fill={G} radius={[12,12,0,0]} />
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

      {/* Personnel Grid */}
      <div className="space-y-8">
          <div className="flex items-center justify-between">
             <div>
                <h3 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase leading-none">Personnel Registry</h3>
                <p className="text-[10px] font-black text-muted uppercase tracking-[0.4em] mt-3 italic">Verified Pilot Profiles</p>
             </div>
             <div className="flex gap-3">
                <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-muted hover:text-white transition-all"><Filter className="w-5 h-5" /></button>
                <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-muted hover:text-white transition-all"><MoreVertical className="w-5 h-5" /></button>
             </div>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {Array.from({length:6}).map((_,i)=><div key={i} className="h-80 rounded-[48px] bg-white/[0.02] border border-white/5 animate-pulse"/>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {activeDrivers.map((d, idx) => {
                  const isHighTier = d.overall_score >= 80;
                  const isLowTier = d.overall_score < 60;
                  
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={d.id} 
                      className={cn(
                        "glass-card p-10 rounded-[56px] border border-white/5 bg-white/[0.01] hover:bg-white/[0.02] transition-all relative overflow-hidden group shadow-premium",
                        isLowTier && "border-danger/20"
                      )}
                    >
                       <div className="absolute -left-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-[80px]" />
                       
                       <div className="flex flex-col sm:flex-row items-center sm:items-start gap-10 mb-10 relative z-10">
                          <div className="relative">
                             <ScoreRing score={d.overall_score}/>
                             <div className="absolute -bottom-2 translate-x-1/2 right-1/2 px-2 py-0.5 rounded bg-black border border-white/10 text-[8px] font-black text-white/50 uppercase tracking-widest">TIER {idx + 1}</div>
                          </div>
                          
                          <div className="flex-1 text-center sm:text-left">
                             <div className="flex items-center justify-center sm:justify-start gap-4 mb-3">
                                <h3 className="text-3xl font-display font-black text-white italic tracking-tighter uppercase leading-none">{d.driver_name}</h3>
                                {isHighTier && <Zap className="w-6 h-6 text-primary shadow-gold animate-pulse" />}
                             </div>
                             
                             <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mb-6">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black text-white/70 uppercase italic">
                                   <Car className="w-4 h-4 text-primary" /> {d.registration_number || 'STDBY'}
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black text-white/70 uppercase italic">
                                   <MapPin className="w-4 h-4 text-muted" /> {d.city_name || 'Global'}
                                </div>
                             </div>

                             <div className="flex items-center justify-center sm:justify-start gap-3">
                                <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.3em]">Neural Protocol Synchronized</span>
                                <div className="w-2 h-2 rounded-full bg-success shadow-gold" />
                             </div>
                          </div>

                          <div className="flex-shrink-0 flex sm:flex-col gap-3">
                             <button className="p-4 rounded-[20px] bg-white/[0.03] border border-white/10 text-muted hover:text-white transition-all shadow-lg"><Activity className="w-5 h-5" /></button>
                             <button 
                               onClick={() => { setRemovedDrivers(prev => [...prev, d.id]); toast.success(`Personnel De-synchronized: ${d.driver_name}`) }}
                               className="p-4 rounded-[20px] bg-danger/5 border border-danger/10 text-danger/60 hover:text-danger hover:bg-danger/10 transition-all shadow-lg"
                             >
                                <Trash2 className="w-5 h-5" />
                             </button>
                          </div>
                       </div>

                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
                          {[
                            { label: 'Overspeed', val: d.over_speeding_incidents, col: M, icon: TrendingUp },
                            { label: 'Aggression', val: d.aggressive_driving_score, col: A, icon: Flame },
                            { label: 'Integrity', val: d.harsh_braking_count, col: Y, icon: Shield },
                            { label: 'Econ Index', val: `${d.fuel_efficiency_score}%`, col: G, icon: Gauge },
                          ].map((s, i) => (
                             <div key={i} className="bg-black/40 border border-white/5 rounded-3xl p-5 text-center group/stat hover:bg-white/[0.02] transition-colors shadow-inner">
                                <s.icon className="w-4 h-4 mx-auto mb-3 opacity-20 group-hover/stat:opacity-60 transition-opacity" style={{ color: s.col }} />
                                <p className="text-2xl font-display font-black italic tracking-tighter" style={{ color: s.col }}>{s.val}</p>
                                <p className="text-[8px] font-black text-muted uppercase tracking-widest mt-1">{s.label}</p>
                             </div>
                          ))}
                       </div>

                       <div className="p-6 rounded-[32px] bg-primary/[0.02] border border-primary/10 relative group-hover:bg-primary/[0.04] transition-all">
                          <div className="flex items-center gap-3 mb-3">
                             <Terminal className="w-3.5 h-3.5 text-primary opacity-40" />
                             <p className="text-[9px] font-black text-primary/60 uppercase tracking-[0.2em] italic">Neural Impact Matrix</p>
                          </div>
                          <p className="text-[13px] font-medium text-white/50 leading-relaxed italic line-clamp-2">“{d.impact_on_vehicle}”</p>
                       </div>
                       
                       <div className="mt-10 flex items-center justify-between pt-6 border-t border-white/5">
                          <div className="text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em] italic font-mono">Registry Log Entry: {new Date(d.recorded_at).toLocaleDateString()}</div>
                          <button className="flex items-center gap-3 text-[10px] font-black uppercase text-primary tracking-widest hover:text-white transition-all group/btn">
                             Access Logic Log <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                          </button>
                       </div>
                    </motion.div>
                  )
               })}
            </div>
          )}
      </div>

    </div>
  )
}
