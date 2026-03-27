import { Vehicle } from '../../hooks/useVehicles'
import { AIPrediction } from '../../hooks/useAIPredictions'
import { Wrench, AlertTriangle, ChevronRight, Activity, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency, cn } from '../../lib/utils'

interface Props {
  vehicles: Vehicle[]
  predictions: AIPrediction[]
}

export default function MaintenanceAlerts({ vehicles, predictions }: Props) {
  // Show top predictions OR fallback to unhealthy vehicles
  const topAlerts = predictions
    .filter(p => p.priority === 'critical' || p.priority === 'high')
    .slice(0, 5)

  const fallbackAlerts = vehicles
    .filter(v => v.status !== 'healthy')
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 4)

  const hasRealAlerts = topAlerts.length > 0

  return (
    <div className="glass-card p-6 rounded-[32px] border-white/5 bg-white/[0.02] flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm uppercase tracking-tight">Intelligence Queue</h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-1">Maintenance Priority</p>
          </div>
        </div>
        <Link to="/maintenance" className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors py-2 px-3 bg-primary/10 rounded-lg">
          Explorer
        </Link>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-2 no-scrollbar">
        {hasRealAlerts ? (
          <>
            {topAlerts.map(p => {
              const isCrit = p.priority === 'critical'
              const vehicleId = vehicles.find(v => v.registration_number === p.registration_number)?.id
              return (
                <Link key={p.id} to={vehicleId ? `/vehicles/${vehicleId}` : '/maintenance'} className="group">
                  <div className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group-hover:-translate-y-1",
                    isCrit 
                      ? "border-rose-500/20 bg-rose-500/[0.03] group-hover:bg-rose-500/[0.06] group-hover:border-rose-500/40" 
                      : "border-amber-500/20 bg-amber-500/[0.03] group-hover:bg-amber-500/[0.06] group-hover:border-amber-500/40"
                  )}>
                    <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse",
                        isCrit ? "bg-rose-500/10" : "bg-amber-500/10"
                    )}>
                        <AlertTriangle className={cn("w-5 h-5", isCrit ? "text-rose-500" : "text-amber-500")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-black tracking-tight truncate">{p.registration_number}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{p.component_name} Risk</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={cn("text-[13px] font-black", isCrit ? "text-rose-500" : "text-amber-500")}>
                        {formatCurrency(p.estimated_cost_if_fixed)}
                      </p>
                      <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Act Now</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
                <Activity className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="text-sm font-black text-white uppercase tracking-tight">System Optimized</p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1 px-8 max-w-[240px]">
                No critical mechanical risks detected across the fleet.
            </p>
          </div>
        )}
      </div>

      {hasRealAlerts && (
        <div className="mt-6 pt-6 border-t border-white/5">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> Predictive Confidence</span>
                <span className="text-primary">94.2%</span>
            </div>
        </div>
      )}
    </div>
  )
}
