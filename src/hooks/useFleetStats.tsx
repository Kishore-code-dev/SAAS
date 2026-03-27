import { useMemo } from 'react'
import { Vehicle } from './useVehicles'

export interface FleetStats {
  total_vehicles: number
  healthy_vehicles: number
  at_risk_vehicles: number
  critical_vehicles: number
  avg_health_score: number
  predicted_savings: number
  upcoming_maintenance: number
  active_alerts: number
}

export function useFleetStats(vehicles: Vehicle[]): FleetStats {
  return useMemo(() => {
    const total = vehicles.length
    const healthy = vehicles.filter(v => v.status === 'healthy').length
    const atRisk = vehicles.filter(v => v.status === 'at-risk').length
    const critical = vehicles.filter(v => v.status === 'critical').length
    const avgHealth = total > 0 ? Math.round(vehicles.reduce((sum, v) => sum + v.health_score, 0) / total) : 0
    const savings = critical * 45000 + atRisk * 18000
    const maintenance = atRisk + critical
    const alerts = critical * 2 + atRisk

    return {
      total_vehicles: total,
      healthy_vehicles: healthy,
      at_risk_vehicles: atRisk,
      critical_vehicles: critical,
      avg_health_score: avgHealth,
      predicted_savings: savings,
      upcoming_maintenance: maintenance,
      active_alerts: alerts,
    }
  }, [vehicles])
}
