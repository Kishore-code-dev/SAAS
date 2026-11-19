import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, CreditCard, Download, Eye, Printer, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { useFleet } from '../hooks/useFleet'
import { canPerformAction } from '../utils/rbac'
import { EnterpriseModal, formatInr, formatShortDate, SeverityText } from '../components/ui/EnterprisePrimitives'
import type { SubscriptionPlanId } from '../types/fleet'

interface SaasInvoice {
  id: string
  invoiceNumber: string
  planId: string
  billingCycle: 'monthly' | 'annual'
  baseAmountInr: number
  gstInr: number
  totalInr: number
  status: 'trial' | 'paid' | 'pending'
  periodStart: string
  periodEnd: string
  issuedAt: string
  notes: string | null
}

export default function Subscription() {
  const {
    activeOrganization,
    activeRole,
    vehicles,
    drivers,
    updateSubscriptionPlan,
  } = useFleet()

  const canManage = canPerformAction(activeRole, 'manage_subscription')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [invoices, setInvoices] = useState<SaasInvoice[]>([])
  const [isTrial, setIsTrial] = useState(false)
  const [switchingPlan, setSwitchingPlan] = useState<SubscriptionPlanId | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<SaasInvoice | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/fleet/subscription', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        const payload = (await res.json()) as {
          invoices?: SaasInvoice[]
          isTrial?: boolean
        }
        if (!cancelled) {
          setInvoices(Array.isArray(payload.invoices) ? payload.invoices : [])
          setIsTrial(Boolean(payload.isTrial))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [activeOrganization.id])

  const activePlan = SUBSCRIPTION_PLANS.find((p) => p.id === activeOrganization.planId) ?? SUBSCRIPTION_PLANS[0]
  const vehicleUsagePct = Math.min(100, Math.round((vehicles.length / activeOrganization.vehicleLimit) * 100))
  const driverUsagePct = Math.min(100, Math.round((drivers.length / activeOrganization.driverLimit) * 100))

  const fallbackHistory: SaasInvoice[] =
    invoices.length > 0
      ? invoices
      : [
          {
            id: 'inv-local-curr',
            invoiceNumber: `DM-${activeOrganization.code}-2026`,
            planId: activePlan.id,
            billingCycle: 'monthly',
            baseAmountInr: activePlan.monthlyInr ?? 0,
            gstInr: Math.round((activePlan.monthlyInr ?? 0) * 0.18),
            totalInr: Math.round((activePlan.monthlyInr ?? 0) * 1.18),
            status: 'paid',
            periodStart: activeOrganization.subscriptionStartDate,
            periodEnd: activeOrganization.subscriptionExpiryDate,
            issuedAt: activeOrganization.createdAt,
            notes: `${activePlan.name} SaaS cycle`,
          },
        ]

  const handleSelectPlan = async (planId: SubscriptionPlanId, planName: string) => {
    if (!canManage) {
      toast.error('Your role is not authorized to change billing plans.')
      return
    }
    setSwitchingPlan(planId)
    try {
      const res = await fetch('/api/fleet/subscription', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle }),
      })
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string
        organization?: {
          vehicleLimit?: number
          driverLimit?: number
          paymentStatus?: 'paid' | 'pending' | 'overdue'
          subscriptionExpiryDate?: string
        }
        invoices?: SaasInvoice[]
      }
      if (!res.ok) {
        toast.error(payload.error || 'Unable to switch SaaS plan.')
        return
      }
      updateSubscriptionPlan(planId, payload.organization)
      if (Array.isArray(payload.invoices)) {
        setInvoices(payload.invoices)
        setIsTrial(payload.invoices[0]?.status === 'trial')
      }
      toast.success(`Switched ${activeOrganization.name} to ${planName} (${billingCycle}). GST invoice issued.`)
    } catch {
      updateSubscriptionPlan(planId)
      toast.success(`Updated ${activeOrganization.name} to ${planName} tier.`)
    } finally {
      setSwitchingPlan(null)
    }
  }

  const handleDownloadInvoice = (inv: SaasInvoice) => {
    const text = [
      'DRIVEMITRA SAAS TAX INVOICE',
      `Invoice Number: ${inv.invoiceNumber}`,
      `Organization: ${activeOrganization.name} (${activeOrganization.code})`,
      `Plan Tier: ${inv.planId.toUpperCase()} (${inv.billingCycle})`,
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
          <h1 className="dm-page-title">Subscription &amp; Usage</h1>
          <p className="text-sm text-[#958777] mt-1">
            {activeOrganization.name} · Current tier: {activePlan.name}
            {isTrial ? ' (14-Day Free Trial Active)' : ''} · Renews {formatShortDate(activeOrganization.subscriptionExpiryDate)}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 bg-[#EEE8F7] p-1 rounded-[10px] border border-[#DDD3ED]">
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors ${
              billingCycle === 'monthly' ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777]'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors inline-flex items-center gap-1 ${
              billingCycle === 'annual' ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle' : 'text-[#958777]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#6E5696]" />
            Annual (20% Off)
          </button>
        </div>
      </div>

      {/* Usage Meters & Billing Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="enterprise-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#625346]">Vehicle Seat Quota</span>
            <span className="font-bold text-[#625346] tabular-nums">
              {vehicles.length} / {activeOrganization.vehicleLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
            <div className="h-full bg-[#E8C65A] rounded-full" style={{ width: `${vehicleUsagePct}%` }} />
          </div>
        </div>

        <div className="enterprise-card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#625346]">Driver Master Quota</span>
            <span className="font-bold text-[#625346] tabular-nums">
              {drivers.length} / {activeOrganization.driverLimit}
            </span>
          </div>
          <div className="w-full h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
            <div className="h-full bg-[#789A75] rounded-full" style={{ width: `${driverUsagePct}%` }} />
          </div>
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

      {/* Plan Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isCurrent = plan.id === activeOrganization.planId && !isTrial
          const price =
            plan.monthlyInr !== null
              ? billingCycle === 'annual'
                ? Math.round(plan.monthlyInr * 0.8)
                : plan.monthlyInr
              : null
          return (
            <div
              key={plan.id}
              className={`enterprise-card p-6 flex flex-col justify-between ${
                plan.id === activeOrganization.planId ? 'border-2 border-[#B8A3D9] bg-[#EEE8F7]' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="dm-card-title text-lg">{plan.name}</h2>
                  {plan.id === activeOrganization.planId && (
                    <SeverityText severity="normal" label={isTrial ? 'Active Trial' : 'Current Plan'} />
                  )}
                </div>
                <p className="text-xs text-[#958777] mt-1">{plan.tagline}</p>
                <p className="text-2xl font-bold text-[#625346] tabular-nums mt-4">
                  {price !== null ? `${formatInr(price)} / mo` : 'Custom'}
                </p>
                {price !== null && (
                  <p className="text-[11px] text-[#958777] mt-0.5">
                    +18% GST · {billingCycle === 'annual' ? 'Billed annually' : 'Billed monthly'}
                  </p>
                )}
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
                disabled={isCurrent || !canManage || switchingPlan === plan.id}
                onClick={() => void handleSelectPlan(plan.id, plan.name)}
                className={`mt-6 w-full ${
                  isCurrent || !canManage ? 'btn-secondary opacity-65 cursor-default' : 'btn-primary'
                }`}
              >
                {switchingPlan === plan.id
                  ? 'Updating Plan...'
                  : isCurrent
                    ? 'Active Tier'
                    : isTrial && plan.id === activeOrganization.planId
                      ? `Activate ${plan.name} Paid Plan`
                      : `Switch to ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      {/* Billing History */}
      <div className="enterprise-card overflow-hidden">
        <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#6E5696]" />
          <h2 className="dm-card-title">SaaS Billing &amp; GST Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="dm-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Period</th>
                <th>Tier</th>
                <th>Base + GST</th>
                <th>Total</th>
                <th>Status</th>
                <th className="text-right">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {fallbackHistory.map((row) => (
                <tr key={row.id}>
                  <td className="font-semibold tabular-nums">{row.invoiceNumber}</td>
                  <td className="tabular-nums text-xs">
                    {formatShortDate(row.periodStart)} – {formatShortDate(row.periodEnd)}
                  </td>
                  <td className="capitalize">
                    {row.planId} ({row.billingCycle})
                  </td>
                  <td className="tabular-nums text-xs text-[#958777]">
                    {formatInr(row.baseAmountInr)} + {formatInr(row.gstInr)}
                  </td>
                  <td className="tabular-nums font-semibold">
                    {row.totalInr > 0 ? formatInr(row.totalInr) : '₹0 (Trial)'}
                  </td>
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
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadInvoice(row)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E5696] hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EnterpriseModal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={`Tax Invoice · ${selectedInvoice?.invoiceNumber ?? ''}`}
        subtitle="DriveMitra Cloud SaaS Billing · SAC 998314 (IT & Fleet SaaS)"
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
                  <span className="tabular-nums">
                    {selectedInvoice.totalInr > 0 ? formatInr(selectedInvoice.totalInr) : '₹0 (Trial)'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary text-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Invoice
              </button>
              <button
                type="button"
                onClick={() => handleDownloadInvoice(selectedInvoice)}
                className="btn-primary text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                Download Receipt
              </button>
            </div>
          </div>
        )}
      </EnterpriseModal>
    </div>
  )
}
