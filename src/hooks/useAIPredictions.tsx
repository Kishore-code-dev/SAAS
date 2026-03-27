import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from './useAuth'

export interface AIPrediction {
  id: string
  vehicle_id: string
  prediction_type: string
  component_name: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  confidence_score: number
  confidence_lower: number
  confidence_upper: number
  predicted_failure_date: string
  failure_date_earliest: string
  failure_date_latest: string
  failure_probability_7d: number
  failure_probability_30d: number
  failure_probability_90d: number
  estimated_cost_if_fixed: number
  estimated_cost_if_delayed: number
  cost_of_delay_per_day: number
  roi_if_fixed_now: number
  ai_reasoning: string
  causal_factors: any[]
  data_quality_score: number
  recommendation: string
  is_resolved: boolean
  created_at: string
  // joined
  registration_number?: string
  make?: string
  model?: string
  vehicle_status?: string
  health_score?: number
}

export function useAIPredictions() {
  const [predictions, setPredictions] = useState<AIPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) { setPredictions([]); setLoading(false); return }

    const fetch = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('ai_predictions')
        .select(`
          *,
          vehicles!inner(registration_number, make, model, status, health_score, user_id)
        `)
        .eq('vehicles.user_id', user.id)
        .eq('is_resolved', false)
        .order('priority', { ascending: false })

      if (error) {
        setError(error.message)
        setPredictions([])
      } else {
        setPredictions((data || []).map((p: any) => ({
          ...p,
          registration_number: p.vehicles?.registration_number,
          make: p.vehicles?.make,
          model: p.vehicles?.model,
          vehicle_status: p.vehicles?.status,
          health_score: p.vehicles?.health_score,
          causal_factors: typeof p.causal_factors === 'string'
            ? JSON.parse(p.causal_factors)
            : (p.causal_factors || []),
        })))
      }
      setLoading(false)
    }

    fetch()
  }, [user])

  const resolvePrediction = async (id: string) => {
    await supabase.from('ai_predictions').update({ is_resolved: true }).eq('id', id)
    setPredictions(prev => prev.filter(p => p.id !== id))
  }

  return { predictions, loading, error, resolvePrediction }
}
