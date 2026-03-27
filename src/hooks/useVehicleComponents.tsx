import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from './useAuth'

export interface VehicleComponent {
  id: string
  vehicle_id: string
  component_name: string
  health_score: number
  status: 'healthy' | 'at-risk' | 'critical'
  wear_rate: number
  last_replaced: string
  predicted_replacement: string
}

export function useVehicleComponents(vehicleId: string | undefined) {
  const [components, setComponents] = useState<VehicleComponent[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!vehicleId || !user) { setComponents([]); setLoading(false); return }

    supabase
      .from('vehicle_components')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('health_score', { ascending: true })
      .then(({ data }) => {
        setComponents(data || [])
        setLoading(false)
      })
  }, [vehicleId, user])

  return { components, loading }
}
