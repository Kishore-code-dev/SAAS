import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from './useAuth'

export interface MaintenanceRecord {
  id: string
  vehicle_id: string
  maintenance_type: string
  description: string
  notes: string
  cost: number
  parts_replaced: string[]
  performed_at: string
  performed_by: string
  // joined
  registration_number?: string
  make?: string
  model?: string
  city_name?: string
}

export function useMaintenanceHistory(vehicleId?: string) {
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) { setRecords([]); setLoading(false); return }

    const query = supabase
      .from('maintenance_history')
      .select(`
        *,
        vehicles!inner(registration_number, make, model, user_id,
          tn_cities(name)
        )
      `)
      .eq('vehicles.user_id', user.id)
      .order('performed_at', { ascending: false })

    if (vehicleId) query.eq('vehicle_id', vehicleId)

    query.limit(50).then(({ data, error }) => {
      if (!error) {
        setRecords((data || []).map((r: any) => ({
          ...r,
          registration_number: r.vehicles?.registration_number,
          make: r.vehicles?.make,
          model: r.vehicles?.model,
          city_name: r.vehicles?.tn_cities?.name,
        })))
      }
      setLoading(false)
    })
  }, [user, vehicleId])

  return { records, loading }
}
