import { FleetStats } from '../../hooks/useFleetStats'
import { AIPrediction } from '../../hooks/useAIPredictions'
import { Brain, AlertTriangle, TrendingUp, Info, CheckCircle } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import { Link } from 'react-router-dom'

interface Props {
  stats: FleetStats
  predictions: AIPrediction[]
}

export default function AIInsightsPanel({ stats, predictions }: Props) {
  const totalSavings = predictions.reduce((s, p) => s + p.roi_if_fixed_now, 0)
  const criticals = predictions.filter(p => p.priority === 'critical')
  const highP = predictions.filter(p => p.priority === 'high')

  const insights = [
    ...(criticals.length > 0 ? [{
      type: 'critical' as const,
      icon: AlertTriangle,
      title: `${criticals.length} Critical AI Alert${criticals.length > 1 ? 's' : ''}`,
      body: criticals.map(p => `${p.registration_number}: ${p.component_name} — ${Math.round(p.failure_probability_30d * 100)}% 30-day risk`).join(' • '),
      link: '/health',
    }] : [{
      type: 'success' as const,
      icon: CheckCircle,
      title: 'Fleet All Clear',
      body: `${stats.healthy_vehicles} of ${stats.total_vehicles} vehicles are healthy. No critical alerts active.`,
    }]),
    ...(highP.length > 0 ? [{
      type: 'warning' as const,
      icon: Brain,
      title: `${highP.length} High Priority Prediction${highP.length > 1 ? 's' : ''}`,
      body: highP[0]?.ai_reasoning?.substring(0, 100) + '...',
      link: '/health',
    }] : []),
    {
      type: 'success' as const,
      icon: TrendingUp,
      title: 'Savings Opportunity',
      body: totalSavings > 0
        ? `Proactive maintenance on ${predictions.length} flagged items could save ${formatCurrency(totalSavings)}.`
        : `Fleet health at ${stats.avg_health_score}%. Continue preventive maintenance regime.`,
      link: '/maintenance',
    },
    {
      type: 'info' as const,
      icon: Info,
      title: 'Indian Road Context',
      body: 'Tamil Nadu NH44 (Madurai stretch) showing elevated pothole density. Suspension wear rate +22% vs baseline — AI causal model updated.',
    },
  ]

  const colorMap = {
    critical: { bg: 'bg-destructive/10 border-destructive/25', icon: 'text-destructive' },
    warning: { bg: 'bg-warning/10 border-warning/25', icon: 'text-warning' },
    success: { bg: 'bg-success/10 border-success/25', icon: 'text-success' },
    info: { bg: 'bg-info/10 border-info/25', icon: 'text-info' },
  }

  return (
    <div className="glass-card p-4 rounded-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-primary" />
          <h3 className="font-display font-semibold text-sm">AI Insights</h3>
        </div>
        <Link to="/health" className="text-[11px] text-primary hover:underline">View all</Link>
      </div>
      <div className="space-y-2.5">
        {insights.slice(0, 4).map(({ type, icon: Icon, title, body, link }, i) => {
          const c = colorMap[type]
          const content = (
            <div key={i} className={`p-3 rounded-xl border ${c.bg} flex gap-2.5 ${link ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}>
              <div className="flex-shrink-0 mt-0.5">
                <Icon className={`w-3.5 h-3.5 ${c.icon}`} />
              </div>
              <div>
                <p className="text-xs font-medium">{title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{body}</p>
              </div>
            </div>
          )
          return link ? <Link key={i} to={link}>{content}</Link> : content
        })}
      </div>
    </div>
  )
}
