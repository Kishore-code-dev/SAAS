import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, DollarSign, PieChart, Wallet } from 'lucide-react'
import { formatCurrency, cn } from '../../lib/utils'
import { AIPrediction } from '../../hooks/useAIPredictions'
import { useTranslation } from '../../i18n/useTranslation'

interface Props { predictions: AIPrediction[] }

function buildSavingsData(predictions: AIPrediction[]) {
  if (predictions.length === 0) {
    return [
      { label: 'Oct', realized: 42000, potential: 58000 },
      { label: 'Nov', realized: 56000, potential: 72000 },
      { label: 'Dec', realized: 48000, potential: 65000 },
      { label: 'Jan', realized: 61000, potential: 78000 },
      { label: 'Feb', realized: 73000, potential: 89000 },
      { label: 'Mar', realized: 69000, potential: 94000 },
    ]
  }
  const byComponent: Record<string, { fix: number; delayed: number; count: number }> = {}
  predictions.forEach(p => {
    const key = p.component_name.split(' ')[0]
    if (!byComponent[key]) byComponent[key] = { fix: 0, delayed: 0, count: 0 }
    byComponent[key].fix += p.estimated_cost_if_fixed
    byComponent[key].delayed += p.estimated_cost_if_delayed
    byComponent[key].count++
  })
  return Object.entries(byComponent).map(([label, v]) => ({
    label,
    realized: v.delayed - v.fix,
    potential: v.delayed,
  }))
}

export default function CostSavingsChart({ predictions }: Props) {
  const { t } = useTranslation()
  const data = buildSavingsData(predictions)
  const totalSavings = predictions.reduce((s, p) => s + p.roi_if_fixed_now, 0)
  const hasRealData = predictions.length > 0

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="glass-card px-4 py-3 rounded-2xl border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl">
        <p className="font-black text-[10px] uppercase tracking-widest text-muted-foreground mb-2 pb-2 border-b border-white/5">{label} Analysis</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center justify-between gap-6 mb-1.5 last:mb-0">
            <span className="text-[11px] font-bold text-white/70 uppercase tracking-tight">{p.name}</span>
            <span className="text-[12px] font-black" style={{ color: p.color }}>
              {formatCurrency(p.value)}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="glass-card p-8 rounded-[40px] border-white/5 bg-white/[0.02] flex flex-col h-full group">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:rotate-12 transition-transform">
                <Wallet className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
                <h3 className="font-display font-black text-sm uppercase tracking-tight">{t('ui.economic_impact')}</h3>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">
                    {hasRealData ? `Optimization ROI: ${formatCurrency(totalSavings)}` : t('ui.roi_forecast')}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">
            {hasRealData ? `+${predictions.length} Signals` : '18.4% Efficiency'}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barCategoryGap={32}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
            <YAxis tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.3)', fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${Math.round(v / 1000)}K`} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="realized" name={t('ui.mitigation_roi')} fill="rgb(255, 204, 0)" radius={[8, 8, 0, 0]} animationDuration={2000} />
            <Bar dataKey="potential" name={t('ui.risk_exposure')} fill="rgba(244, 63, 94, 0.4)" radius={[8, 8, 0, 0]} animationDuration={3000} />
            </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 p-5 rounded-3xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <PieChart className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t('ui.strategic_loss')}</p>
              </div>
              <p className="text-xs font-black text-white">88% {t('ui.effectiveness')}</p>
          </div>
      </div>
    </div>
  )
}
