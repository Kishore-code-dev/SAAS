import { useProfile } from './useProfile'
import { supabase } from '../integrations/supabase/client'
import { toast } from 'sonner'

export const PLANS = [
  {
    id: 'free',
    name: 'Starter',
    price: 0,
    features: ['Up to 5 vehicles', 'Basic maintenance alerts', '7-day data history', 'English support'],
    limit: 5
  },
  {
    id: 'pro',
    name: 'Growth',
    price: 4999,
    features: ['Up to 50 vehicles', 'Advanced AI predictions', '90-day data history', 'Multi-language AI assistant', 'Priority support'],
    limit: 50,
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    features: ['Unlimited vehicles', 'Custom AI model training', 'Full data history', 'dedicated fleet engineer', 'API access'],
    limit: 99999
  }
]

export function useSubscription() {
  const { profile, loading, refetch } = useProfile()

  const upgradePlan = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_plan: planId })
        .eq('id', profile?.id)

      if (error) throw error
      toast.success(`Welcome to the ${planId.toUpperCase()} plan!`)
      refetch()
    } catch (err: any) {
      toast.error(err.message || 'Failed to upgrade plan')
    }
  }

  const currentPlan = PLANS.find(p => p.id === (profile?.subscription_plan || 'free')) || PLANS[0]

  return {
    plan: currentPlan,
    subscription_status: profile?.subscription_status || 'active',
    loading,
    upgradePlan,
    allPlans: PLANS
  }
}
