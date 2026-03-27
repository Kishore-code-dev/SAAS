import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from './useAuth'

export interface DriverAnalytics {
  id: string
  vehicle_id: string
  driver_name: string
  overall_score: number
  aggressive_driving_score: number
  over_speeding_incidents: number
  harsh_braking_count: number
  fuel_efficiency_score: number
  impact_on_vehicle: string
  recorded_at: string
  // joined
  registration_number?: string
  make?: string
  model?: string
  city_name?: string
}

export function useDrivers() {
  const [drivers, setDrivers] = useState<DriverAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) { setDrivers([]); setLoading(false); return }

    const fetch = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('driver_analytics')
        .select(`
          *,
          vehicles!inner(registration_number, make, model, user_id,
            tn_cities(name)
          )
        `)
        .eq('vehicles.user_id', user.id)
        .order('overall_score', { ascending: false })

      if (error) {
        setError(error.message)
        setDrivers([])
      } else {
        setDrivers((data || []).map((d: any) => ({
          ...d,
          registration_number: d.vehicles?.registration_number,
          make: d.vehicles?.make,
          model: d.vehicles?.model,
          city_name: d.vehicles?.tn_cities?.name,
        })))
      }
      setLoading(false)
    }

    fetch()
  }, [user])

  return { drivers, loading, error }
}
