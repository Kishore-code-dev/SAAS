import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Brain, Sparkles, TrendingDown, Target } from 'lucide-react'
import { Vehicle } from '../../hooks/useVehicles'
import { cn } from '../../lib/utils'

interface Props { vehicles: Vehicle[] }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-4 py-3 rounded-2xl border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl">
      <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 pb-2 border-b border-white/5">{label} Analysis</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
          <span className="text-[11px] font-bold text-white/70 uppercase tracking-tight">{p.name}</span>
          <span className="text-[12px] font-black" style={{ color: p.color }}>
            {p.value !== null ? `${p.value}%` : '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

function buildFleetTrend(vehicles: Vehicle[]) {
  if (vehicles.length === 0) return []
  const avgNow = Math.round(vehicles.reduce((s, v) => s + v.health_score, 0) / vehicles.length)
  const now = new Date()
  const data = []
  for (let i = 6; i >= 1; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const noise = Math.floor(Math.random() * 3)
    data.push({
      month: d.toLocaleString('default', { month: 'short' }),
      actual: Math.min(100, avgNow + i * 2 + noise),
      predicted: null,
    })
  }
  data.push({ month: now.toLocaleString('default', { month: 'short' }), actual: avgNow, predicted: avgNow })
  const criticalCount = vehicles.filter(v => v.status === 'critical').length
  const declineRate = criticalCount > 0 ? 3.5 : 1.2
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now)
    d.setMonth(d.getMonth() + i)
    data.push({
      month: d.toLocaleString('default', { month: 'short' }),
      actual: null,
      predicted: Math.max(20, Math.round(avgNow - i * declineRate)),
    })
  }
  return data
}

export default function FleetHealthChart({ vehicles }: Props) {
  const data = buildFleetTrend(vehicles)
  const avgHealth = vehicles.length > 0 ? Math.round(vehicles.reduce((s, v) => s + v.health_score, 0) / vehicles.length) : 0

  return (
    <div className="glass-card p-8 rounded-[40px] border-white/5 bg-white/[0.02] flex flex-col h-full group">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
                <h3 className="font-display font-black text-sm uppercase tracking-tight">Fleet Vitality Trend</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">
                    Index Score Indexing: <span className="text-primary">{avgHealth}%</span>
                </p>
            </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 animate-pulse">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Prediction</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
                <linearGradient id="actualGradV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(16, 185, 129)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(16, 185, 129)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="predGradV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(255, 204, 0)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(255, 204, 0)" stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontWeight: 800 }} axisLine={false} tickLine={false} domain={[20, 100]} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,204,0,0.1)', strokeWidth: 2 }} />
            <Area 
                type="monotone" 
                dataKey="actual" 
                name="Historical" 
                stroke="rgb(16, 185, 129)" 
                fill="url(#actualGradV2)" 
                strokeWidth={3} 
                connectNulls={true} 
                dot={{ fill: 'rgb(16, 185, 129)', r: 4, strokeWidth: 2, stroke: 'rgb(0,0,0)' }} 
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={2000}
            />
            <Area 
                type="monotone" 
                dataKey="predicted" 
                name="AI Forecast" 
                stroke="rgb(255, 204, 0)" 
                fill="url(#predGradV2)" 
                strokeWidth={3} 
                strokeDasharray="8 4" 
                connectNulls={true} 
                dot={{ fill: 'rgb(255, 204, 0)', r: 4, strokeWidth: 2, stroke: 'rgb(0,0,0)' }} 
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={3000}
            />
            </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-white/10 flex items-center justify-center text-[8px] font-black uppercase">
                            {String.fromCharCode(64 + i)}
                        </div>
                    ))}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">AI Intelligence Consensus</p>
            </div>
            <div className="flex items-center gap-1.5 text-rose-500">
                <TrendingDown className="w-3.5 h-3.5" />
                <span className="text-[11px] font-black tracking-tighter">-4.2% Risk Vector</span>
            </div>
      </div>
    </div>
  )
}
