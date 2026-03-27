import { useEffect, useState } from 'react'
import { supabase } from '../integrations/supabase/client'
import { useAuth } from './useAuth'

export interface Profile {
  id: string
  user_id: string
  full_name: string
  company_name: string
  phone: string
  preferred_language: string
  role_label: string
  onboarding_completed: boolean
  subscription_plan: string
  subscription_status: string
  trial_expires_at?: string
  billing_email?: string
  billing_address?: string
  updated_at?: string
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const fetchProfile = async () => {
    if (!user) { setProfile(null); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!error && data) {
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProfile()
  }, [user])

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() })
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null)
    }
    return { error }
  }

  return { profile, loading, updateProfile, refetch: fetchProfile }
}
