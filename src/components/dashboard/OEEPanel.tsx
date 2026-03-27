import { FleetStats } from '../../hooks/useFleetStats'
import { Activity } from 'lucide-react'

interface Props { stats: FleetStats }

function CircularProgress({ value, color, label, size = 64 }: { value: number; color: string; label: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(220 10% 18%)" strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={color} fontSize="12" fontFamily="Space Grotesk" fontWeight="700">
          {value}%
        </text>
      </svg>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

export default function OEEPanel({ stats }: Props) {
  const availability = stats.total_vehicles > 0
    ? Math.round(((stats.total_vehicles - stats.critical_vehicles) / stats.total_vehicles) * 100)
    : 0
  const performance = stats.avg_health_score
  const quality = Math.min(100, Math.round(stats.avg_health_score * 1.08))
  const oee = Math.round((availability / 100) * (performance / 100) * (quality / 100) * 100)

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <div>
          <h3 className="font-display font-semibold text-sm">OEE Score</h3>
          <p className="text-muted-foreground text-xs">Overall Equipment Effectiveness</p>
        </div>
      </div>

      {/* Big OEE */}
      <div className="flex justify-center mb-4">
        <div className="relative">
          <svg width={120} height={120} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="hsl(220 10% 18%)" strokeWidth="8" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={oee >= 65 ? 'hsl(43 96% 56%)' : 'hsl(0 72% 51%)'}
              strokeWidth="8"
              strokeDasharray={2 * Math.PI * 52}
              strokeDashoffset={2 * Math.PI * 52 - (oee / 100) * 2 * Math.PI * 52}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
            />
            <text x="60" y="54" textAnchor="middle" fill="hsl(40 20% 95%)" fontSize="22" fontFamily="Space Grotesk" fontWeight="700">{oee}%</text>
            <text x="60" y="70" textAnchor="middle" fill="hsl(220 10% 55%)" fontSize="9" fontFamily="Inter">OEE Score</text>
          </svg>
        </div>
      </div>

      {/* Sub-metrics */}
      <div className="flex justify-around">
        <CircularProgress value={availability} color="hsl(160 84% 39%)" label="Availability" />
        <CircularProgress value={performance} color="hsl(43 96% 56%)" label="Performance" />
        <CircularProgress value={quality} color="hsl(217 91% 60%)" label="Quality" />
      </div>
    </div>
  )
}
