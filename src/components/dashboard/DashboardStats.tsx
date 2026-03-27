import { useTranslation } from '../../i18n/useTranslation'
import { FleetStats } from '../../hooks/useFleetStats'
import { AIPrediction } from '../../hooks/useAIPredictions'
import { Truck, CheckCircle, AlertTriangle, XCircle, TrendingUp, Heart, Wrench, Bell, Sparkles } from 'lucide-react'
import { formatCurrency, cn } from '../../lib/utils'

interface Props {
  stats: FleetStats
  predictions: AIPrediction[]
}

export default function DashboardStats({ stats, predictions }: Props) {
  const { t } = useTranslation()
  const criticalPredictions = predictions.filter(p => p.priority === 'critical').length
  const totalPotentialSavings = predictions.reduce((s, p) => s + p.roi_if_fixed_now, stats.predicted_savings)

  const CARDS = [
    { label: t('stats.total_fleet'), value: stats.total_vehicles, icon: Truck, color: 'text-primary', bg: 'bg-primary/5 border-primary/20', sub: 'Active Assets', premium: true },
    { label: t('stats.healthy'), value: stats.healthy_vehicles, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/5 border-emerald-500/10', sub: 'Optimal State' },
    { label: t('stats.at_risk'), value: stats.at_risk_vehicles, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/5 border-amber-500/10', sub: 'Review Needed' },
    { label: t('stats.critical'), value: stats.critical_vehicles, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/5 border-rose-500/10', sub: 'Action Required' },
    { label: t('stats.ai_savings'), value: formatCurrency(totalPotentialSavings), icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5 border-primary/20', sub: 'Optimized ROI', premium: true },
    { label: t('stats.fleet_health'), value: `${stats.avg_health_score}%`, icon: Heart, color: 'text-emerald-400', bg: 'bg-emerald-400/5 border-emerald-400/10', sub: 'Intelligence Index' },
    { label: t('stats.ai_predictions'), value: predictions.length, icon: Sparkles, color: 'text-primary', bg: 'bg-primary/5 border-primary/20', sub: `${criticalPredictions} Immediate` },
    { label: t('stats.active_alerts'), value: stats.active_alerts + criticalPredictions, icon: Bell, color: 'text-rose-400', bg: 'bg-rose-400/5 border-rose-400/10', sub: 'Live Response' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
      {CARDS.map(({ label, value, icon: Icon, color, bg, sub, premium }, i) => (
        <div 
          key={label} 
          className={cn(
            "glass-card card-lift p-5 rounded-3xl border-white/5 relative overflow-hidden group transition-all duration-500",
            premium && "bg-white/[0.03] border-primary/20 shadow-[0_0_20px_rgba(255,204,0,0.05)]"
          )}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {premium && (
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors" />
          )}
          
          <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110", bg)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
          
          <div className="flex flex-col">
            <div className={cn("font-display font-black text-2xl leading-none mb-1 tracking-tighter", premium ? "text-gradient-yellow" : "text-white")}>
              {value}
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
              {label}
            </div>
            <div className="text-[9px] font-medium text-muted-foreground/60">
              {sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
