import { Vehicle } from '../../hooks/useVehicles'
import { Link } from 'react-router-dom'
import { getHealthColor, getHealthClass } from '../../lib/utils'
import { MapPin, User2 } from 'lucide-react'

interface Props { vehicles: Vehicle[] }

export default function VehicleStatusGrid({ vehicles }: Props) {
  const sorted = [...vehicles].sort((a, b) => a.health_score - b.health_score).slice(0, 6)

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-sm">Fleet Status</h3>
        <Link to="/vehicles" className="text-xs text-primary hover:underline">View all</Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map(v => (
          <Link key={v.id} to={`/vehicles/${v.id}`} className="block">
            <div className="p-3.5 rounded-xl border border-border/50 bg-secondary/30 hover:border-primary/30 hover:bg-secondary/60 transition-all duration-200 cursor-pointer">
              <div className="flex items-start justify-between mb-2.5">
                <div>
                  <p className="text-xs font-semibold">{v.registration_number}</p>
                  <p className="text-[11px] text-muted-foreground">{v.make} {v.model}</p>
                </div>
                <span className={getHealthClass(v.health_score)}>{v.status}</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 health-bar">
                  <div
                    className="health-bar-fill"
                    style={{ width: `${v.health_score}%`, background: getHealthColor(v.health_score) }}
                  />
                </div>
                <span className="text-xs font-bold" style={{ color: getHealthColor(v.health_score) }}>
                  {v.health_score}%
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5" />{v.city_name || 'TN'}
                </span>
                <span className="flex items-center gap-1">
                  <User2 className="w-2.5 h-2.5" />{v.assigned_driver || 'Unassigned'}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
