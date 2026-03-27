import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { DRIVERS, DRIVER_SCORES, FUEL_TRANSACTIONS, ALERTS } from '../data/fleetData'
import {
  Users, Activity, Truck, AlertTriangle, Battery, Navigation,
  TrendingDown, TrendingUp, Search, Bell, Settings,
  Fuel, Shield, ArrowUpRight, BarChart3, Clock, CheckCircle, Sparkles, Map as MapIcon, Zap,
  TrendingUp as TrendingUpIcon, Eye, ZapOff, Filter, MoreHorizontal, ChevronRight, ShieldCheck
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Link } from 'react-router-dom'
import { cn } from '../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'

const Y = '#F5C518'
const A = '#FFB347'
const M = '#FF4444'
const G = '#00C896'

const weeklyData = [
  { day: 'MON', trips: 142, fuel: 18400 },
  { day: 'TUE', trips: 128, fuel: 14500 },
  { day: 'WED', trips: 156, fuel: 23100 },
  { day: 'THU', trips: 132, fuel: 16600 },
  { day: 'FRI', trips: 187, fuel: 27700 },
  { day: 'SAT', trips: 114, fuel: 13900 },
  { day: 'SUN', trips: 82,  fuel: 9200  },
]

const StatCard = ({ label, value, sub, icon: Icon, trend, color, delay }: any) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="glass-card group p-6 rounded-[24px] border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-primary/20 transition-all duration-500 relative overflow-hidden h-full"
    >
      <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
      
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/5 shadow-premium transition-transform group-hover:scale-110 duration-500">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase", trend.startsWith('+') ? "text-success bg-success/10" : "text-danger bg-danger/10")}>
          {trend.startsWith('+') ? <TrendingUpIcon className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend}
        </div>
      </div>

      <div className="space-y-1">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">{label}</h4>
        <div className="flex items-baseline gap-2">
           <p className="text-3xl font-display font-black text-white tracking-tighter">{value}</p>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{sub}</p>
        <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  const { vehicles, drivers, alerts, unreadAlertCount, totalFuelToday, activeTripsCount, onlineDriversCount, aiSyncActive, toggleAiSync } = useFleet()
  const [activeTab, setActiveTab] = useState('Week')

  const totalFuelWeek = FUEL_TRANSACTIONS.reduce((s, t) => s + t.amount, 0)
  const avgSafety = Math.round(DRIVER_SCORES.reduce((s, d) => s + d.overall, 0) / DRIVER_SCORES.length)
  const activeVehicles = vehicles.filter(v => v.status === 'active').length

  const safetyData = DRIVER_SCORES.map(s => {
    const driver = DRIVERS.find(d => d.id === s.driverId)
    return {
      id: s.driverId,
      name: driver?.name || 'Driver',
      avatar: driver?.avatar,
      score: s.overall,
      trend: s.overall > 80 ? 'up' : 'down',
      color: s.overall >= 85 ? G : s.overall >= 70 ? Y : M
    }
  }).slice(0, 5)

  const metrics = [
    { label: 'Total Fleet',    value: vehicles.length,  sub: activeVehicles + ' units active',  icon: Truck,      color: Y, trend: '+2.4%' },
    { label: 'Active Trips',   value: activeTripsCount, sub: 'Precision tracking',               icon: Navigation, color: A, trend: '+14%'  },
    { label: 'Pilots Online',  value: onlineDriversCount,sub: drivers.length + ' total roster',  icon: Users,      color: Y, trend: '-2.1%' },
    { label: 'Energy Burn',    value: '₹' + (totalFuelToday/1000).toFixed(1) + 'K', sub: 'Today budget', icon: Fuel,      color: A, trend: '+6.2%' },
    { label: 'Cyber Alerts',   value: unreadAlertCount, sub: 'Immediate attention',           icon: Bell,       color: M, trend: '+12%' },
    { label: 'Safety Index',   value: avgSafety,        sub: 'Fleet Mean Score',               icon: Shield,     color: G, trend: '+0.8%' },
  ]

  return (
    <div className="space-y-8 page-enter pt-6 pb-20">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-gold animate-fade-in">
             <Sparkles className="w-3.5 h-3.5 fill-primary shadow-gold" /> System Autonomously Monitoring
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter text-white">Fleet Terminal</h1>
          <p className="text-muted text-sm font-bold mt-2 uppercase tracking-widest opacity-60">Operations Intelligence • Real-time Telematics Feed</p>
        </div>

        <div className="flex items-center gap-4">
          <div 
            onClick={toggleAiSync}
            className="flex items-center gap-4 px-6 py-3 rounded-2xl glass-card border border-white/5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all select-none group"
          >
            <div className="relative">
              <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_15px_rgba(245,197,24,0.4)]", aiSyncActive ? "bg-primary animate-pulse" : "bg-muted/30")} />
              {aiSyncActive && <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-40" />}
            </div>
            <span className={cn("text-[11px] font-black uppercase tracking-[0.2em] transition-colors", aiSyncActive ? "text-primary" : "text-muted")}>
              {aiSyncActive ? 'Neural Link Active' : 'AI Engine Offline'}
            </span>
          </div>

          <Link to="/dashboard/map">
            <button className="btn-primary !px-8 !py-3.5 flex items-center gap-3 text-xs font-black uppercase tracking-widest animate-fade-in group shadow-gold">
               <MapIcon className="w-4 h-4 group-hover:rotate-12 transition-transform duration-500" />
               Launch Mission Map
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {metrics.map((m, i) => (
          <StatCard key={i} {...m} delay={i * 0.05} />
        ))}
      </div>

      {/* Primary Analytics Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Main Chart Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="xl:col-span-2 glass-card p-10 rounded-[32px] border border-white/5 bg-white/[0.02] shadow-premium"
        >
          <div className="flex items-center justify-between mb-10 flex-wrap gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 shadow-lg">
                <BarChart3 className="w-7 h-7 text-primary shadow-gold" />
              </div>
              <div>
                <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Fleet Dynamics</h3>
                <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] mt-1">Movement vs Energy Consumption</p>
              </div>
            </div>

            <div className="flex bg-white/5 border border-white/10 p-1.5 rounded-2xl gap-1">
              {['Day', 'Week', 'Month'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-primary text-black shadow-gold' : 'text-muted hover:text-white'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[380px] w-full mt-4">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tripsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={Y} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={Y} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={A} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={A} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" vertical={false} />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#888', fontSize: 10, fontWeight: 900 }}
                    dy={15}
                  />
                  <YAxis hidetick={true} axisLine={false} tickLine={false} hide />
                  <Tooltip 
                    cursor={{ stroke: '#F5C518', strokeWidth: 1, strokeDasharray: '5 5' }}
                    contentStyle={{ border: 'none' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="trips" 
                    stroke={Y} 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#tripsGrad)" 
                    animationDuration={2000}
                    activeDot={{ r: 6, stroke: '#080808', strokeWidth: 2, fill: Y }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="fuel" 
                    stroke={A} 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#fuelGrad)" 
                    strokeDasharray="10 5"
                    animationDuration={2500}
                  />
                </AreaChart>
             </ResponsiveContainer>
          </div>
          
          <div className="flex gap-10 mt-10 p-6 rounded-[24px] bg-white/[0.02] border border-white/5 border-dashed">
             <div className="flex items-center gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-gold animate-pulse" />
                <div className="space-y-0.5">
                   <p className="text-[9px] font-black text-muted uppercase tracking-widest">Global Trips</p>
                   <p className="text-xl font-display font-black text-white">2,840 <span className="text-[10px] text-success ml-1.5">+12.4%</span></p>
                </div>
             </div>
             <div className="w-px h-10 bg-white/10" />
             <div className="flex items-center gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <div className="space-y-0.5">
                   <p className="text-[9px] font-black text-muted uppercase tracking-widest">Fuel Consumption</p>
                   <p className="text-xl font-display font-black text-white">482K L <span className="text-[10px] text-danger ml-1.5">+4.2%</span></p>
                </div>
             </div>
          </div>
        </motion.div>

        {/* Behavioral Intelligence Drawer */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="glass-card flex flex-col rounded-[32px] border border-white/5 bg-white/[0.02] shadow-premium overflow-hidden"
        >
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-display font-black text-white uppercase tracking-tight">Behavioral Intel</h3>
              <p className="text-[9px] font-black text-muted uppercase tracking-[0.3em] mt-1">Neural Risk Scoring</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Zap className="w-5 h-5 text-primary rotate-12" />
            </div>
          </div>

          <div className="flex-1 p-6 space-y-4 overflow-y-auto scrollbar-none">
            {safetyData.map((d, i) => (
              <div key={d.id} className="group p-5 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-primary/20 transition-all cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-secondary border border-white/5 overflow-hidden flex items-center justify-center relative">
                      {d.avatar ? (
                        <img src={d.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <p className="font-black text-xs text-muted">{d.name.substring(0, 2).toUpperCase()}</p>
                      )}
                      {d.score >= 85 && <div className="absolute top-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-black" />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white truncate">{d.name}</p>
                      <p className="text-[9px] font-black text-muted uppercase tracking-widest mt-0.5">Rank #{i+1} • Sector C</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-display font-black leading-none" style={{ color: d.color }}>{d.score}</p>
                    <p className="text-[8px] font-black text-muted uppercase mt-1">Safety pts</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[8px] font-black text-muted uppercase tracking-widest">
                    <span>Inference status</span>
                    <span>{d.trend === 'up' ? 'Optimizing' : 'Warning'}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: d.score + '%' }}
                      transition={{ duration: 1.5, delay: i * 0.1 }}
                      className="h-full rounded-full group-hover:brightness-125 transition-all" 
                      style={{ background: d.color }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-6 bg-black/40 border-t border-white/5">
            <button className="w-full py-4 rounded-2xl border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.3em] hover:bg-primary/20 hover:text-white transition-all">
              Comprehensive Safety Audit
            </button>
          </div>
        </motion.div>
      </div>

      {/* Secondary Operational Surface */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Live Monitor scrolling list */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="xl:col-span-2 glass-card rounded-[32px] border border-white/5 bg-white/[0.02] shadow-premium overflow-hidden flex flex-col h-[500px]"
        >
          <div className="p-8 border-b border-white/5 flex items-center justify-between flex-shrink-0">
            <div>
              <h3 className="text-xl font-display font-black text-white uppercase tracking-tight">Mission Control</h3>
              <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] mt-1">Real-time Asset Status</p>
            </div>
            <div className="flex gap-3">
              <button className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                <Filter className="w-4 h-4 text-muted" />
              </button>
              <button className="btn-primary !px-6 !py-2.5 !text-[10px] uppercase tracking-widest flex items-center gap-2">
                Launch Radar
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-white/[0.03]">
            {vehicles.map((v, i) => {
              const driver = DRIVERS.find(d => d.id === v.driverId)
              return (
                <div key={v.id} className="group flex items-center gap-8 px-8 py-5 hover:bg-white/[0.03] transition-all cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative group-hover:scale-105 transition-transform">
                      {driver?.avatar ? (
                        <img src={driver.avatar} className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <Truck className="w-6 h-6 text-muted" />
                      )}
                      <div className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-black shadow-lg", v.status === 'active' ? 'bg-success' : 'bg-muted')} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                       <p className="text-sm font-black text-white tracking-tight uppercase">{v.registrationNo}</p>
                       <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border", 
                         v.status === 'active' ? "bg-success/10 text-success border-success/30" : "bg-muted/10 text-muted border-muted/30"
                       )}>{v.status}</span>
                    </div>
                    <p className="text-[11px] font-bold text-muted uppercase tracking-widest truncate">
                       {v.model} • {driver?.name || 'In Control'} • Sector {['Alpha', 'Delta', 'Gamma'][i%3]}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-12 text-right flex-shrink-0 lg:pr-10">
                     <div>
                        <p className="text-xl font-display font-black text-white">{v.speed} <span className="text-[9px] text-muted ml-0.5">KM/H</span></p>
                        <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mt-1">Velocity</p>
                     </div>
                     <div>
                        <p className="text-xl font-display font-black text-white">{v.fuelLevel}%</p>
                        <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mt-1">Energy</p>
                     </div>
                  </div>

                  <button className="p-2 rounded-xl text-muted hover:text-white hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all">
                      <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* AI Intel Feed */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="glass-card flex flex-col rounded-[32px] border border-white/5 bg-white/[0.02] shadow-premium overflow-hidden h-[500px]"
        >
          <div className="p-8 border-b border-white/5 flex items-center justify-between flex-shrink-0">
             <div className="flex items-center gap-4">
               <div className="w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center border border-danger/20">
                  <ShieldCheck className="w-5 h-5 text-danger" />
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Event Log</h3>
                  <p className="text-[9px] font-bold text-muted uppercase mt-0.5">Intelligence Feed</p>
               </div>
             </div>
             <button className="text-[10px] font-black text-muted hover:text-white transition-colors uppercase tracking-[0.2em]">Clear All</button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-3">
             {alerts.slice(0, 10).map((alert, i) => {
                const isHigh = alert.severity === 'high'
                const color = isHigh ? M : alert.severity === 'medium' ? A : Y
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + (i * 0.05) }}
                    key={alert.id} 
                    className={cn(
                      "p-5 rounded-2xl border border-white/[0.04] transition-all hover:border-white/10 flex flex-col gap-4 relative group overflow-hidden",
                      isHigh ? "bg-danger/5 shadow-[0_0_20px_rgba(255,68,68,0.05)]" : "bg-white/[0.01]"
                    )}
                  >
                    {isHigh && <div className="absolute left-0 top-0 bottom-0 w-1 bg-danger shadow-gold" />}
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          <div className={cn("w-2 h-2 rounded-full", isHigh ? "animate-pulse" : "")} style={{ background: color }} />
                          <p className="text-[13px] font-black text-white/90 leading-tight group-hover:text-primary transition-colors">{alert.message}</p>
                       </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                       <span className="text-muted tracking-[0.3em] font-bold">EVENT #{alert.id.slice(-4)}</span>
                       <span style={{ color }}>{alert.severity} PRIORITY</span>
                    </div>
                  </motion.div>
                )
             })}
          </div>

          <button className="p-6 bg-black/60 border-t border-white/5 text-[10px] font-black text-muted uppercase tracking-[0.4em] hover:text-white transition-all">
             Initialize Audit Sequence
          </button>
        </motion.div>
      </div>
    </div>
  )
}
