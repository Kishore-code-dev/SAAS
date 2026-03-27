import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'

export interface TNCity {
  id: string
  name: string
  region: string
  road_stress_index: number
  climate_impact_score: number
  pothole_density: string
}

export function useTNCities() {
  const [cities, setCities] = useState<TNCity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('tn_cities').select('*').order('name').then(({ data }) => {
      setCities(data || [])
      setLoading(false)
    })
  }, [])

  return { cities, loading }
}
