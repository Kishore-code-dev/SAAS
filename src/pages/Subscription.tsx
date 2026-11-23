import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  Download,
  Eye,
  Printer,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { useAuth } from '../hooks/useAuth'
import { useFleet } from '../hooks/useFleet'
import { canPerformAction } from '../utils/rbac'
import { EnterpriseModal, formatInr, formatShortDate, SeverityText } from '../components/ui/EnterprisePrimitives'

interface SaasInvoice {
  id: string
  invoiceNumber: string
  planId: string
  billingCycle: 'monthly' | 'annual'
  baseAmountInr: number
  gstInr: number
  totalInr: number
  status: string
  periodStart: string
  periodEnd: string
  issuedAt: string
  notes: string | null
}

interface PaymentHistoryItem {
  id: string
  planId: 'monthly' | 'annual'
  billingCycle: 'monthly' | 'annual'
  baseAmountInr: number
  taxAmountInr: number
  totalAmountInr: number
  status: string
  paymentMethod: string
  gatewayReference: string | null
  failureReason: string | null
  createdAt: string
}

export default function Subscription() {
  const { activeOrganization, activeRole, vehicles, drivers, updateSubscriptionPlan } = useFleet()
  const { user, subscription: authSub, subscriptionAccess, refreshSession } = useAuth()

  const canManage = canPerformAction(activeRole, 'manage_subscription') || user?.role === 'org_admin'
  const [invoices, setInvoices] = useState<SaasInvoice[]>([])
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([])
  const [liveSub, setLiveSub] = useState(authSub)
  const [loading, setLoading] = useState(false)
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'annual' | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('UPI / Razorpay')
  const [gatewayRef, setGatewayRef] = useState('')
  const [activePayment, setActivePayment] = useState<{
    id: string
    planId: 'monthly' | 'annual'
    baseAmountInr: number
    taxAmountInr: number
    totalPayableInr: number
  } | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<SaasInvoice | null>(null)

  const fetchSubscriptionState = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/subscription/current', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data.subscription) setLiveSub(data.subscription)
      if (Array.isArray(data.invoices)) setInvoices(data.invoices)
      if (Array.isArray(data.payments)) setPayments(data.payments)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSubscriptionState()
  }, [fetchSubscriptionState, activeOrganization.id])

  const normalizedPlanId: 'monthly' | 'annual' =
    liveSub?.planId === 'annual' || activeOrganization.planId === 'annual' ? 'annual' : 'monthly'
  const activePlan = SUBSCRIPTION_PLANS.find((p) => p.id === normalizedPlanId) ?? SUBSCRIPTION_PLANS[0]

  const vehicleLimitLabel = activeOrganization.vehicleLimit < 0 ? 'Unlimited' : String(activeOrganization.vehicleLimit)
  const driverLimitLabel = activeOrganization.driverLimit < 0 ? 'Unlimited' : String(activeOrganization.driverLimit)

  const handleStartCheckout = async (planId: 'monthly' | 'annual') => {
    if (!canManage) {
      toast.error('Only Fleet Owners can manage subscription checkout.')
      return
    }
    setCheckoutPlan(planId)
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not start GST checkout')
        setCheckoutPlan(null)
        return
      }
      setActivePayment({
        id: data.payment.id,
        planId,
        baseAmountInr: data.checkout.baseAmountInr,
        taxAmountInr: data.checkout.taxAmountInr,
        totalPayableInr: data.checkout.totalPayableInr,
      })
    } catch {
      toast.error('Failed to connect to checkout server')
      setCheckoutPlan(null)
    }
  }

  const handleSubmitPaymentOutcome = async (
    outcome: 'submitted_for_verification' | 'failed' | 'cancelled',
  ) => {
    if (!activePayment) return
    const res = await fetch(`/api/subscription/payments/${activePayment.id}/submit`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        outcome,
        gatewayReference: gatewayRef || undefined,
        reportedAmountInr: activePayment.totalPayableInr,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || `Payment ${outcome}`)
    } else {
      toast.success('Payment submitted for Platform Admin verification')
    }
    setActivePayment(null)
    setCheckoutPlan(null)
    setGatewayRef('')
    await fetchSubscriptionState()
    await refreshSession()
  }

  const handleSwitchFrequency = async (planId: 'monthly' | 'annual') => {
    if (!canManage) return
    const res = await fetch('/api/subscription/change-frequency', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Unable to change billing frequency')
      return
    }
    updateSubscriptionPlan(planId, {
      vehicleLimit: -1,
      driverLimit: -1,
    })
    toast.success(`Renewal frequency updated to ${planId === 'annual' ? 'Annual Plan' : 'Monthly Plan'}`)
    await fetchSubscriptionState()
  }

  const handleCancelRenewal = async () => {
    if (!canManage) return
    const res = await fetch('/api/subscription/cancel', {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Could not cancel renewal')
      return
    }
    toast.info(data.message || 'Auto-renewal disabled at end of current billing period.')
    await fetchSubscriptionState()
  }

  const handleDownloadInvoice = (inv: SaasInvoice) => {
    const text = [
      'DRIVEMITRA SAAS TAX INVOICE',
      `Invoice Number: ${inv.invoiceNumber}`,
      `Organization: ${activeOrganization.name} (${activeOrganization.code})`,
      `Plan: ${inv.planId.toUpperCase()} (${inv.billingCycle})`,
      `Billing Period: ${inv.periodStart} to ${inv.periodEnd}`,
      `Base Amount: ${formatInr(inv.baseAmountInr)}`,
      `GST (18%): ${formatInr(inv.gstInr)}`,
      `Total Invoice Amount: ${formatInr(inv.totalInr)}`,
      `Status: ${inv.status.toUpperCase()}`,
      inv.notes ? `Notes: ${inv.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoiceNumber}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dm-page-title">Subscription &amp; GST Billing</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Current Plan: <strong>{activePlan.name}</strong> · Status:{' '}
            <strong className="uppercase">{liveSub?.status ?? activeOrganization.status}</strong> · Period ends{' '}
            {formatShortDate(liveSub?.currentPeriodEnd ?? activeOrganization.subscriptionExpiryDate)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchSubscriptionState()}
            className="btn-secondary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Billing
          </button>
          {canManage && liveSub?.status === 'active' && !liveSub.cancelAtPeriodEnd && (
            <button
              type="button"
              onClick={() => void handleCancelRenewal()}
              className="btn-secondary text-xs text-[#B84E42]"
            >
              Cancel Auto-Renewal
            </button>
          )}
        </div>
      </div>

      {subscriptionAccess === 'read_only' && (
        <div className="rounded-xl border border-[#D9786C] bg-[#FCECEB] p-4 flex items-start gap-3 text-xs text-[#625346]">
          <AlertTriangle className="w-5 h-5 text-[#B84E42] shrink-0" />
          <div>
            <p className="font-bold text-[#B84E42]">Subscription Expired — Read-Only Mode Active</p>
            <p className="mt-0.5">
              Complete checkout below and await Platform Admin verification to restore create, edit, delete, and dispatch actions.
            </p>
          </div>
        </div>
      )}

      {/* Unlimited Capacity Meters & Billing Entity */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="enterprise-card p-5 space-y-1.5">
          <span className="text-xs font-semibold text-[#958777]">Active Fleet Vehicles</span>
          <p className="text-2xl font-bold text-[#625346] tabular-nums">
            {vehicles.length} <span className="text-xs font-semibold text-[#4D6E4A]">/ {vehicleLimitLabel}</span>
          </p>
          <p className="text-[11px] text-[#958777]">All subscription cycles include unlimited vehicles</p>
        </div>

        <div className="enterprise-card p-5 space-y-1.5">
          <span className="text-xs font-semibold text-[#958777]">Active Drivers</span>
          <p className="text-2xl font-bold text-[#625346] tabular-nums">
            {drivers.length} <span className="text-xs font-semibold text-[#4D6E4A]">/ {driverLimitLabel}</span>
          </p>
          <p className="text-[11px] text-[#958777]">Unlimited drivers &amp; granular 31-module staff seats</p>
        </div>

        <div className="enterprise-card p-5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[#625346] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#6E5696]" />
              Tax &amp; Billing Entity
            </span>
            <p className="text-xs font-mono text-[#625346] mt-1 truncate">
              GSTIN: {activeOrganization.gstin ?? 'Not configured'}
            </p>
            <p className="text-[11px] text-[#958777] truncate">
              {activeOrganization.ownerEmail ?? 'No billing email set'}
            </p>
          </div>
          <Link to="/dashboard/settings/general" className="text-xs font-semibold text-[#6E5696] hover:underline shrink-0">
            Edit
          </Link>
        </div>
      </div>

      {/* Canonical Two Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === normalizedPlanId
          const displayBase = plan.billingFrequency === 'annual' ? plan.annualInr : plan.monthlyInr
          return (
            <div
              key={plan.id}
              className={`enterprise-card p-6 flex flex-col justify-between ${
                isCurrent ? 'border-2 border-[#6E5696] bg-[#EEE8F7]/60' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="dm-card-title text-lg">{plan.name}</h2>
                  <div className="flex items-center gap-2">
                    {plan.savingsVsMonthlyInr > 0 && (
                      <span className="px-2 py-0.5 rounded bg-[#EDF4EC] border border-[#789A75] text-[#4D6E4A] text-[11px] font-bold">
                        Save ₹{plan.savingsVsMonthlyInr.toLocaleString('en-IN')} ({plan.savingsPercent}%)
                      </span>
                    )}
                    {isCurrent && <SeverityText severity="normal" label="Current Plan" />}
                  </div>
                </div>
                <p className="text-xs text-[#958777] mt-1">{plan.tagline}</p>

                <div className="mt-4 pb-4 border-b border-[#E5E5E5]">
                  <p className="text-3xl font-bold text-[#625346] tabular-nums">
                    {formatInr(displayBase)}
                    <span className="text-xs font-normal text-[#958777] ml-1">
                      / {plan.billingFrequency === 'annual' ? 'year' : 'month'} + 18% GST
                    </span>
                  </p>
                  <p className="text-xs text-[#625346] mt-1">
                    GST (18%): {formatInr(plan.gstAmountInr)} · Total Payable: <strong>{formatInr(plan.totalPayableInr)}</strong>
                  </p>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-[#625346]">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#4D6E4A] shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canManage || checkoutPlan === plan.id}
                  onClick={() => void handleStartCheckout(plan.billingFrequency)}
                  className="btn-primary flex-1 text-xs"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  {checkoutPlan === plan.id
                    ? 'Starting Checkout...'
                    : `Pay / Renew ${plan.name}`}
                </button>
                {!isCurrent && canManage && (
                  <button
                    type="button"
                    onClick={() => void handleSwitchFrequency(plan.billingFrequency)}
                    className="btn-secondary text-xs"
                  >
                    Switch Renewal Cycle
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Payment Attempts Ledger */}
      {payments.length > 0 && (
        <div className="enterprise-card overflow-hidden">
          <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center justify-between">
            <h2 className="dm-card-title">Subscription Payment Submissions</h2>
            <span className="text-xs text-[#958777]">{payments.length} transaction(s)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="dm-table text-xs">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan</th>
                  <th>Total (Incl. GST)</th>
                  <th>Method &amp; Ref</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatShortDate(p.createdAt)}</td>
                    <td className="capitalize font-semibold">{p.planId}</td>
                    <td className="font-bold tabular-nums">{formatInr(p.totalAmountInr)}</td>
                    <td>{p.paymentMethod} {p.gatewayReference ? `· ${p.gatewayReference}` : ''}</td>
                    <td>
                      <SeverityText
                        severity={
                          p.status === 'successful'
                            ? 'normal'
                            : p.status === 'failed' || p.status === 'cancelled'
                              ? 'critical'
                              : 'high'
                        }
                        label={p.status.replace(/_/g, ' ')}
                      />
                    </td>
                    <td className="text-[#958777]">{p.failureReason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax Invoices */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#6E5696]" />
          <h2 className="dm-card-title">Verified GST Tax Invoices ({invoices.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Period</th>
                <th>Plan</th>
                <th>Base + 18% GST</th>
                <th>Total</th>
                <th>Status</th>
                <th className="text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-xs text-[#958777]">
                    No verified invoices issued yet. Invoices generate automatically once a subscription payment is verified.
                  </td>
                </tr>
              ) : (
                invoices.map((row) => (
                  <tr key={row.id}>
                    <td className="font-semibold tabular-nums">{row.invoiceNumber}</td>
                    <td className="tabular-nums text-xs">
                      {formatShortDate(row.periodStart)} – {formatShortDate(row.periodEnd)}
                    </td>
                    <td className="capitalize">{row.planId}</td>
                    <td className="tabular-nums text-xs text-[#958777]">
                      {formatInr(row.baseAmountInr)} + {formatInr(row.gstInr)}
                    </td>
                    <td className="tabular-nums font-semibold">{formatInr(row.totalInr)}</td>
                    <td>
                      <SeverityText severity={row.status === 'pending' ? 'high' : 'normal'} label={row.status} />
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#625346] hover:text-[#6E5696]"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(row)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E5696] hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GST Checkout Modal */}
      <EnterpriseModal
        open={Boolean(activePayment)}
        onClose={() => {
          setActivePayment(null)
          setCheckoutPlan(null)
        }}
        title="Subscription GST Checkout"
        subtitle="Submit payment proof for Platform Admin verification."
      >
        {activePayment && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-2">
              <div className="flex justify-between">
                <span className="text-[#958777]">Plan Cycle</span>
                <span className="font-bold capitalize">{activePayment.planId} Plan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#958777]">Base Amount</span>
                <span className="font-semibold">{formatInr(activePayment.baseAmountInr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#958777]">GST (18%)</span>
                <span className="font-semibold">{formatInr(activePayment.taxAmountInr)}</span>
              </div>
              <div className="pt-2 border-t border-[#E5E5E5] flex justify-between text-sm font-bold text-[#625346]">
                <span>Total Payable</span>
                <span>{formatInr(activePayment.totalPayableInr)}</span>
              </div>
            </div>

            <div>
              <label className="dm-label">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="dm-input"
              >
                <option value="UPI / Razorpay">UPI / Razorpay</option>
                <option value="NEFT / RTGS">NEFT / RTGS</option>
                <option value="Corporate Credit Card">Corporate Credit Card</option>
              </select>
            </div>
            <div>
              <label className="dm-label">Gateway Reference / UTR</label>
              <input
                value={gatewayRef}
                onChange={(e) => setGatewayRef(e.target.value)}
                placeholder="Auto-generated if left blank"
                className="dm-input"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleSubmitPaymentOutcome('failed')}
                className="btn-secondary text-xs text-[#B84E42]"
              >
                <XCircle className="w-3.5 h-3.5" /> Failed Attempt
              </button>
              <button
                type="button"
                onClick={() => void handleSubmitPaymentOutcome('submitted_for_verification')}
                className="btn-primary text-xs"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Submit Payment for Verification
              </button>
            </div>
          </div>
        )}
      </EnterpriseModal>

      {/* Tax Invoice Viewer */}
      <EnterpriseModal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={`Tax Invoice · ${selectedInvoice?.invoiceNumber ?? ''}`}
        subtitle="DriveMitra Cloud SaaS Billing · SAC 998314"
        maxWidthClass="max-w-lg"
      >
        {selectedInvoice && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5]">
              <div>
                <span className="text-[#958777] block">Billed To</span>
                <span className="font-bold text-[#625346]">{activeOrganization.name}</span>
                <span className="block text-[#958777]">
                  {activeOrganization.city}, {activeOrganization.state}
                </span>
                <span className="block font-mono text-[#625346] mt-0.5">
                  GSTIN: {activeOrganization.gstin ?? 'Unregistered'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[#958777] block">Invoice Status</span>
                <span className="font-bold uppercase text-[#4D6E4A]">{selectedInvoice.status}</span>
                <span className="block text-[#958777] mt-1">
                  Issued: {formatShortDate(selectedInvoice.issuedAt)}
                </span>
                <span className="block text-[#958777]">
                  Period: {formatShortDate(selectedInvoice.periodStart)} – {formatShortDate(selectedInvoice.periodEnd)}
                </span>
              </div>
            </div>

            <div className="border border-[#E5E5E5] rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EEE8F7] font-semibold text-[#625346] flex justify-between">
                <span>Subscription Description</span>
                <span>Amount</span>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="capitalize">
                    DriveMitra {selectedInvoice.planId} SaaS ({selectedInvoice.billingCycle})
                  </span>
                  <span className="font-semibold tabular-nums">{formatInr(selectedInvoice.baseAmountInr)}</span>
                </div>
                <div className="flex justify-between text-[#958777]">
                  <span>CGST (9%)</span>
                  <span className="tabular-nums">{formatInr(Math.round(selectedInvoice.gstInr / 2))}</span>
                </div>
                <div className="flex justify-between text-[#958777]">
                  <span>SGST (9%)</span>
                  <span className="tabular-nums">{formatInr(selectedInvoice.gstInr - Math.round(selectedInvoice.gstInr / 2))}</span>
                </div>
                <div className="pt-2 border-t border-[#E5E5E5] flex justify-between font-bold text-sm text-[#625346]">
                  <span>Total Invoice Value</span>
                  <span className="tabular-nums">{formatInr(selectedInvoice.totalInr)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button type="button" onClick={() => window.print()} className="btn-secondary text-xs">
                <Printer className="w-3.5 h-3.5" /> Print Invoice
              </button>
              <button type="button" onClick={() => handleDownloadInvoice(selectedInvoice)} className="btn-primary text-xs">
                <Download className="w-3.5 h-3.5" /> Download Receipt
              </button>
            </div>
          </div>
        )}
      </EnterpriseModal>
    </div>
  )
}
