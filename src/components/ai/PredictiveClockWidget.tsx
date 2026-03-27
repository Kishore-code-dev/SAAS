import { FleetStats } from '../../hooks/useFleetStats'
import { Clock } from 'lucide-react'

interface Props { stats: FleetStats }

export default function PredictiveClockWidget({ stats }: Props) {
  const total = stats.total_vehicles || 1
  const healthyPct = stats.healthy_vehicles / total
  const riskPct = stats.at_risk_vehicles / total
  const critPct = stats.critical_vehicles / total

  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 72

  const circ = 2 * Math.PI * r
  const healthyDash = healthyPct * circ
  const riskDash = riskPct * circ
  const critDash = critPct * circ

  let offset = 0
  const segments = [
    { dash: healthyDash, color: 'hsl(160 84% 39%)', gap: circ - healthyDash, offset },
    { dash: riskDash, color: 'hsl(38 92% 50%)', gap: circ - riskDash, offset: (offset += healthyDash) },
    { dash: critDash, color: 'hsl(0 72% 51%)', gap: circ - critDash, offset: (offset += riskDash) },
  ]

  return (
    <div className="glass-card p-5 rounded-2xl flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3 self-start">
        <Clock className="w-4 h-4 text-primary" />
        <div>
          <h3 className="font-display font-semibold text-sm">Fleet Status Ring</h3>
          <p className="text-muted-foreground text-xs">Next failure prediction window</p>
        </div>
      </div>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(220 10% 14%)" strokeWidth="16" />
        {/* Segments */}
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="16"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        {/* Inner content */}
        <text x={cx} y={cy - 12} textAnchor="middle" fill="hsl(40 20% 95%)" fontSize="24" fontFamily="Space Grotesk" fontWeight="700">
          {total}
        </text>
        <text x={cx} y={cy + 6} textAnchor="middle" fill="hsl(220 10% 55%)" fontSize="9" fontFamily="Inter">
          vehicles
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" fill="hsl(220 10% 55%)" fontSize="9" fontFamily="Inter">
          monitored
        </text>
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2">
        {[
          { label: 'Healthy', count: stats.healthy_vehicles, color: 'bg-success' },
          { label: 'At Risk', count: stats.at_risk_vehicles, color: 'bg-warning' },
          { label: 'Critical', count: stats.critical_vehicles, color: 'bg-destructive' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-[10px] text-muted-foreground">{count} {label}</span>
          </div>
        ))}
      </div>

      {/* Next failure */}
      {stats.critical_vehicles > 0 && (
        <div className="mt-3 w-full p-2.5 rounded-xl bg-destructive/10 border border-destructive/25 text-center">
          <p className="text-[10px] text-muted-foreground">Next predicted failure</p>
          <p className="text-xs font-semibold text-destructive mt-0.5">Within 72 hours</p>
        </div>
      )}
    </div>
  )
}
