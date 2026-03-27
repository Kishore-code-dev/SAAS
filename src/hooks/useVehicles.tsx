import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from './useAuth'

export interface Vehicle {
  id: string
  user_id: string
  registration_number: string
  make: string
  model: string
  year: number
  vehicle_type: 'ICE' | 'EV'
  fuel_type: 'Petrol' | 'Diesel' | 'CNG' | 'Electric'
  status: 'healthy' | 'at-risk' | 'critical'
  health_score: number
  current_mileage: number
  assigned_driver: string
  city_id?: string
  city_name?: string
  last_service_date?: string
  next_service_due?: string
  created_at: string
}

export interface AddVehicleData {
  registration_number: string
  make: string
  model: string
  year: number
  vehicle_type: 'ICE' | 'EV'
  fuel_type: 'Petrol' | 'Diesel' | 'CNG' | 'Electric'
  current_mileage: number
  assigned_driver: string
  city_id?: string
}

export function useVehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchVehicles = async () => {
    if (!user) { setVehicles([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('vehicles')
      .select('*, tn_cities(name)')
      .eq('user_id', user.id)
      .order('health_score', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      const mapped = (data || []).map((v: any) => ({
        ...v,
        city_name: v.tn_cities?.name || '',
      }))
      setVehicles(mapped)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchVehicles()
  }, [user])

  const addVehicle = async (vehicleData: AddVehicleData) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase.from('vehicles').insert({
      ...vehicleData,
      user_id: user.id,
      status: 'healthy',
      health_score: 85,
    })
    if (!error) fetchVehicles()
    return { error }
  }

  const deleteVehicle = async (id: string) => {
    const { error } = await supabase.from('vehicles').delete().eq('id', id)
    if (!error) setVehicles(prev => prev.filter(v => v.id !== id))
    return { error }
  }

  return { vehicles, loading, error, addVehicle, deleteVehicle, refetch: fetchVehicles }
}
