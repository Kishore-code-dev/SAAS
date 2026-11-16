import React from 'react'
import { Check, CreditCard, Info } from 'lucide-react'
import { toast } from 'sonner'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { useFleet } from '../hooks/useFleet'
import { canPerformAction } from '../utils/rbac'
import { formatInr, formatShortDate, SeverityText } from '../components/ui/EnterprisePrimitives'

export default function Subscription() {
  const {
    environment,
    activeOrganization,
    activeRole,
    vehicles,
    drivers,
    updateSubscriptionPlan,
  } = useFleet()

  const canManage = canPerformAction(activeRole, 'manage_subscription')

  const activePlan = SUBSCRIPTION_PLANS.find((p) => p.id === activeOrganization.planId) ?? SUBSCRIPTION_PLANS[0]
  const vehicleUsagePct = Math.min(100, Math.round((vehicles.length / activeOrganization.vehicleLimit) * 100))
  const driverUsagePct = Math.min(100, Math.round((drivers.length / activeOrganization.driverLimit) * 100))

  const billingHistory = [
    { id: 'INV-2026-06', date: '2026-06-01', plan: activePlan.name, amountInr: activePlan.monthlyInr ?? 0, status: 'Active Cycle' },
    { id: 'INV-2026-05', date: '2026-05-01', plan: activePlan.name, amountInr: activePlan.monthlyInr ?? 0, status: 'Settled' },
  ]

  const handleSelectPlan = (planId: typeof activeOrganization.planId, planName: string) => {
    if (!canManage) {
      toast.error('Your role is not authorized to change billing plans.')
      return
    }
    if (environment === 'production') {
      toast.info(`Billing checkout for ${planName} requires a configured payment gateway in Production.`)
      return
    }
    try {
      updateSubscriptionPlan(planId)
      toast.success(`Switched ${activeOrganization.name} to ${planName} tier (${environment.toUpperCase()}).`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to switch plan.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="dm-page-title">Subscription & Usage</h1>
        <p className="text-sm text-[#7D6D5F] mt-1">
          {activeOrganization.name} · Current tier: {activePlan.name} · Timezone {activeOrganization.timezone}
        </p>
      </div>

      {environment === 'production' && (
        <div className="lavender-surface p-4 flex items-start gap-3 text-xs text-[#625346]">
          <Info className="w-4 h-4 text-[#6E5696] shrink-0 mt-0.5" />
          <p>
            Online payment checkout is disabled until a production billing provider (Razorpay / Stripe) is configured. Contact enterprise onboarding to modify Production limits.
          </p>
        </div>
      )}

      {/* Usage Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="enterprise-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#625346]">Vehicle Seat Usage</span>
            <span className="font-bold text-[#625346] tabular-nums">
              {vehicles.length} / {activeOrganization.vehicleLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-[#E0D4B7] rounded-full overflow-hidden">
            <div className="h-full bg-[#E8C65A] rounded-full" style={{ width: `${vehicleUsagePct}%` }} />
          </div>
        </div>

        <div className="enterprise-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#625346]">Driver Seat Usage</span>
            <span className="font-bold text-[#625346] tabular-nums">
              {drivers.length} / {activeOrganization.driverLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-[#E0D4B7] rounded-full overflow-hidden">
            <div className="h-full bg-[#789A75] rounded-full" style={{ width: `${driverUsagePct}%` }} />
          </div>
        </div>
      </div>

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === activeOrganization.planId
          return (
            <div
              key={plan.id}
              className={`enterprise-card p-6 flex flex-col justify-between ${
                isCurrent ? 'border-2 border-[#B8A3D9] bg-[#EEE8F7]' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="dm-card-title text-lg">{plan.name}</h2>
                  {isCurrent && (
                    <SeverityText severity="normal" label="Current Plan" />
                  )}
                </div>
                <p className="text-xs text-[#7D6D5F] mt-1">{plan.tagline}</p>
                <p className="text-2xl font-bold text-[#625346] tabular-nums mt-4">
                  {plan.monthlyInr !== null ? `${formatInr(plan.monthlyInr)} / mo` : 'Custom'}
                </p>
                <ul className="mt-4 space-y-2 text-xs text-[#625346]">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#4D6E4A] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                disabled={isCurrent || !canManage}
                onClick={() => handleSelectPlan(plan.id, plan.name)}
                className={`mt-6 w-full ${
                  isCurrent || !canManage ? 'btn-secondary opacity-65 cursor-default' : 'btn-primary'
                }`}
              >
                {isCurrent ? 'Active Tier' : `Switch to ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Billing History */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 bg-[#FBF6E6] border-b border-[#E0D4B7] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#6E5696]" />
          <h2 className="dm-card-title">Billing Ledger</h2>
        </div>
        <table className="dm-table">
          <thead>
            <tr><th>Invoice</th><th>Billing Date</th><th>Tier</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {billingHistory.map((row) => (
              <tr key={row.id}>
                <td className="font-semibold tabular-nums">{row.id}</td>
                <td className="tabular-nums text-xs">{formatShortDate(row.date)}</td>
                <td>{row.plan}</td>
                <td className="tabular-nums">{row.amountInr > 0 ? formatInr(row.amountInr) : 'Custom'}</td>
                <td><SeverityText severity="normal" label={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

