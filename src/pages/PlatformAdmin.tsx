import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Headphones,
  LogOut,
  PlugZap,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from '../components/ui/BrandLogo'
import { formatInr, formatShortDate, KpiCard, PaginationFooter } from '../components/ui/EnterprisePrimitives'
import type { Organization, OrganizationStatus, SubscriptionPlanId } from '../types/fleet'

interface EnrichedOrg extends Organization {
  totalVehicles: number
  totalDrivers: number
  openWorkOrders: number
  monthlyRevenueInr: number
  activeUsersCount: number
}

interface PlatformAuditLog {
  id: string
  actorUsername: string
  action: string
  targetOrgId: string | null
  targetOrgName: string | null
  reason: string
  createdAt: string
}

interface PlatformSaasMetrics {
  mrrInr: number
  arrInr: number
  paidTenantsCount: number
  trialTenantsCount: number
  collectedGstInr: number
}

interface PlatformSaasInvoice {
  id: string
  organizationId: string
  organizationName: string
  organizationCode: string
  invoiceNumber: string
  planId: string
  billingCycle: string
  baseAmountInr: number
  gstInr: number
  totalInr: number
  status: string
  issuedAt: string
}

interface PlatformPaymentRow {
  id: string
  organizationId: string
  organizationName: string
  organizationCode: string
  organizationStatus: string
  planId: string
  billingCycle: string
  baseAmountInr: number
  taxAmountInr: number
  totalAmountInr: number
  reportedAmountInr: number | null
  paymentMethod: string
  gatewayReference: string | null
  status: string
  failureReason: string | null
  verifiedBy: string | null
  verifiedAt: string | null
  createdAt: string
}

interface PlatformIntegrationRow {
  id: string
  providerKey: string
  name: string
  category: string
  status: string
  config: Record<string, unknown>
  updatedBy: string | null
  updatedAt: string
}

interface PlatformMonitoringData {
  health: string
  timestamp: string
  pendingPaymentVerifications: number
  failedPaymentAttempts: number
  activeAuthSessions: number
  organizationStatusBreakdown: Array<{ status: string; count: number }>
  recentSupportSessions: Array<{
    id: string
    platform_admin_username: string
    organization_id: string
    reason: string
    started_at: string
  }>
}

const STATUS_BADGE: Record<OrganizationStatus, string> = {
  active: 'bg-[#EDF4EC] text-[#4D6E4A] border-[#789A75]',
  payment_pending: 'bg-[#FCF5DE] text-[#8E6F19] border-[#D8B442]',
  grace_period: 'bg-[#EEE8F7] text-[#6E5696] border-[#B8A3D9]',
  suspended: 'bg-[#FCECEB] text-[#B84E42] border-[#D9786C]',
  terminated: 'bg-[#FCECEB] text-[#8F352C] border-[#D9786C]',
  archived: 'bg-[#FAFAFA] text-[#958777] border-[#E5E5E5]',
}

type AdminTab = 'organizations' | 'payments' | 'integrations' | 'monitoring'

export default function PlatformAdmin() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<AdminTab>('organizations')
  const [orgs, setOrgs] = useState<EnrichedOrg[]>([])
  const [saasMetrics, setSaasMetrics] = useState<PlatformSaasMetrics>({
    mrrInr: 0,
    arrInr: 0,
    paidTenantsCount: 0,
    trialTenantsCount: 0,
    collectedGstInr: 0,
  })
  const [recentSaasInvoices, setRecentSaasInvoices] = useState<PlatformSaasInvoice[]>([])
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([])
  const [payments, setPayments] = useState<PlatformPaymentRow[]>([])
  const [integrations, setIntegrations] = useState<PlatformIntegrationRow[]>([])
  const [monitoring, setMonitoring] = useState<PlatformMonitoringData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [planFilter, setPlanFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 8

  // Onboard modal
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [formOrgName, setFormOrgName] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formState, setFormState] = useState('')
  const [formOwnerName, setFormOwnerName] = useState('')
  const [formOwnerEmail, setFormOwnerEmail] = useState('')
  const [formOwnerPhone, setFormOwnerPhone] = useState('')
  const [formGstin, setFormGstin] = useState('')
  const [formPlan, setFormPlan] = useState<SubscriptionPlanId>('monthly')
  const [formPaymentStatus, setFormPaymentStatus] = useState<Organization['paymentStatus']>('paid')
  const [issuedCreds, setIssuedCreds] = useState<{
    orgName: string
    username: string
    temporaryPassword: string
  } | null>(null)

  // Status control modal
  const [statusTarget, setStatusTarget] = useState<EnrichedOrg | null>(null)
  const [nextStatus, setNextStatus] = useState<OrganizationStatus>('suspended')
  const [statusReason, setStatusReason] = useState('')
  const [graceDays, setGraceDays] = useState(7)
  const [confirmCheck, setConfirmCheck] = useState(false)

  // Billing modal
  const [billingTarget, setBillingTarget] = useState<EnrichedOrg | null>(null)
  const [nextPlan, setNextPlan] = useState<SubscriptionPlanId>('monthly')
  const [nextPayStatus, setNextPayStatus] = useState<Organization['paymentStatus']>('paid')
  const [nextExpiry, setNextExpiry] = useState('')
  const [billingReason, setBillingReason] = useState('')

  // Grace Policy modal
  const [graceTarget, setGraceTarget] = useState<EnrichedOrg | null>(null)
  const [gracePolicyDays, setGracePolicyDays] = useState(0)
  const [expiredAccessPolicy, setExpiredAccessPolicy] = useState<'read_only' | 'blocked'>('read_only')
  const [gracePeriodEnd, setGracePeriodEnd] = useState('')

  // Support Access modal
  const [supportTarget, setSupportTarget] = useState<EnrichedOrg | null>(null)
  const [supportReason, setSupportReason] = useState('')

  // Integration editing
  const [editingIntegration, setEditingIntegration] = useState<PlatformIntegrationRow | null>(null)
  const [intStatus, setIntStatus] = useState('configured')
  const [intConfigJson, setIntConfigJson] = useState('{}')

  const loadAll = useCallback(async (withSpinner = true) => {
    if (withSpinner) setLoading(true)
    try {
      const [orgRes, payRes, intRes, monRes] = await Promise.all([
        fetch('/api/platform-admin/organizations', { credentials: 'include' }),
        fetch('/api/platform-admin/payments', { credentials: 'include' }),
        fetch('/api/platform-admin/integrations', { credentials: 'include' }),
        fetch('/api/platform-admin/monitoring', { credentials: 'include' }),
      ])
      const [orgData, payData, intData, monData] = await Promise.all([
        orgRes.json(),
        payRes.json(),
        intRes.json(),
        monRes.json(),
      ])
      if (!orgRes.ok) throw new Error(orgData.error || 'Failed to load organizations')
      setOrgs(orgData.organizations ?? [])
      if (orgData.saasMetrics) setSaasMetrics(orgData.saasMetrics)
      setRecentSaasInvoices(orgData.recentSaasInvoices ?? [])
      setAuditLogs(orgData.auditLogs ?? [])
      if (payRes.ok) setPayments(payData.payments ?? [])
      if (intRes.ok) setIntegrations(intData.integrations ?? [])
      if (monRes.ok) setMonitoring(monData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to load platform directory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll(true)
  }, [loadAll])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orgs.filter((o) => {
      const matchQ =
        !q ||
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.city.toLowerCase().includes(q) ||
        (o.ownerName?.toLowerCase().includes(q) ?? false) ||
        (o.ownerEmail?.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === 'all' || o.status === statusFilter
      const matchPlan = planFilter === 'all' || o.planId === planFilter
      return matchQ && matchStatus && matchPlan
    })
  }, [orgs, search, statusFilter, planFilter])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  const metrics = useMemo(() => {
    const pendingOrGrace = orgs.filter(
      (o) => o.status === 'payment_pending' || o.status === 'grace_period',
    ).length
    const pausedCount = orgs.filter(
      (o) => o.status === 'suspended' || o.status === 'terminated' || o.status === 'archived',
    ).length
    const totalVehicles = orgs.reduce((s, o) => s + o.totalVehicles, 0)
    const pendingPayments = payments.filter((p) => p.status === 'pending_verification').length
    return { pendingOrGrace, pausedCount, totalVehicles, pendingPayments }
  }, [orgs, payments])

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/platform-admin/organizations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formOrgName,
          city: formCity,
          state: formState,
          ownerName: formOwnerName,
          ownerEmail: formOwnerEmail,
          ownerPhone: formOwnerPhone,
          gstin: formGstin,
          planId: formPlan,
          paymentStatus: formPaymentStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to onboard organization')

      toast.success(`Onboarded ${data.organization.name}`)
      setIssuedCreds({
        orgName: data.organization.name,
        username: data.ownerCredentials.username,
        temporaryPassword: data.ownerCredentials.temporaryPassword,
      })
      setFormOrgName('')
      setFormCity('')
      setFormState('')
      setFormOwnerName('')
      setFormOwnerEmail('')
      setFormOwnerPhone('')
      setFormGstin('')
      setOnboardOpen(false)
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Onboarding failed')
    }
  }

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!statusTarget) return
    try {
      const res = await fetch(`/api/platform-admin/organizations/${statusTarget.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          reason: statusReason,
          confirmAction: confirmCheck,
          gracePeriodDays: graceDays,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update organization status')
      toast.success(
        `Updated ${statusTarget.name} to ${nextStatus.replace('_', ' ')}. ${data.revokedSessions ? `${data.revokedSessions} active session(s) revoked.` : ''}`,
      )
      setStatusTarget(null)
      setStatusReason('')
      setConfirmCheck(false)
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update access status')
    }
  }

  const handleBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!billingTarget) return
    try {
      const res = await fetch(`/api/platform-admin/organizations/${billingTarget.id}/subscription`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: nextPlan,
          paymentStatus: nextPayStatus,
          subscriptionExpiryDate: nextExpiry,
          reason: billingReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update subscription')
      toast.success(`Updated billing & plan for ${billingTarget.name}`)
      setBillingTarget(null)
      setBillingReason('')
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Billing update failed')
    }
  }

  const handlePaymentDecision = async (
    paymentId: string,
    decision: 'approve' | 'reject' | 'refund',
  ) => {
    const reason =
      decision === 'approve'
        ? 'Gateway settlement verified by Platform Admin.'
        : decision === 'reject'
          ? 'Payment proof rejected by Platform Admin.'
          : 'Refund issued by Platform Admin.'
    try {
      const res = await fetch(`/api/platform-admin/payments/${paymentId}/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment action failed')
      toast.success(
        decision === 'approve'
          ? `Payment verified & organization activated (${data.invoiceNumber ?? ''}).`
          : `Payment ${decision} recorded.`,
      )
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment decision failed')
    }
  }

  const handleGraceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!graceTarget) return
    try {
      const res = await fetch(`/api/platform-admin/organizations/${graceTarget.id}/grace-policy`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gracePeriodDays: Number(gracePolicyDays),
          expiredAccessPolicy,
          currentPeriodEnd: gracePeriodEnd || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update grace policy')
      toast.success(`Updated grace & expiry policy for ${graceTarget.name}`)
      setGraceTarget(null)
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Grace policy update failed')
    }
  }

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supportTarget) return
    try {
      const res = await fetch('/api/platform-admin/support-access', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: supportTarget.id,
          reason: supportReason,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to log support access')
      toast.success(`Audited support session started for ${supportTarget.name}`)
      setSupportTarget(null)
      setSupportReason('')
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Support session logging failed')
    }
  }

  const handleIntegrationSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingIntegration) return
    try {
      const parsedConfig = JSON.parse(intConfigJson) as Record<string, unknown>
      const res = await fetch(`/api/platform-admin/integrations/${editingIntegration.providerKey}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: intStatus, config: parsedConfig }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save integration config')
      toast.success(`Updated ${editingIntegration.name} configuration`)
      setEditingIntegration(null)
      void loadAll(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid JSON or update failed')
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#625346]">
      <header className="h-16 bg-[#FFFFFF] border-b border-[#E5E5E5] px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size="header" />
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg bg-[#EEE8F7] border border-[#B8A3D9] text-[11px] font-bold text-[#6E5696] uppercase tracking-wider whitespace-nowrap">
            Platform Admin Exclusive
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs font-semibold text-[#625346]">
            {user?.fullName ?? 'Platform Super Admin'}
          </span>
          <button
            type="button"
            onClick={() => void loadAll(false)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/auth', { replace: true })
            }}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B84E42]" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="dm-page-title">SaaS Platform Governance Console</h1>
            <p className="text-xs text-[#958777] mt-1">
              Verify tenant subscription payments, govern Monthly/Annual plans, configure exclusive platform integrations, and audit support access sessions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOnboardOpen(true)}
            className="btn-primary text-xs px-4 py-2.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Onboard Organization</span>
          </button>
        </div>

        {/* One-time credential display */}
        {issuedCreds && (
          <div className="enterprise-card p-5 border-2 border-[#789A75] bg-[#EDF4EC] space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#4D6E4A]">
                  Onboarding Credentials Issued — {issuedCreds.orgName}
                </p>
                <p className="text-xs text-[#625346] mt-0.5">
                  Share securely with the fleet owner. Password change is enforced automatically on first login.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIssuedCreds(null)}
                aria-label="Dismiss credentials banner"
                className="p-1 rounded-lg hover:bg-white/60 text-[#625346]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white border border-[#E5E5E5] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-[#958777] block">Owner Username</span>
                  <span className="font-mono font-bold text-sm text-[#625346]">{issuedCreds.username}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(issuedCreds.username)
                    toast.success('Copied username')
                  }}
                  className="p-1.5 rounded-lg border border-[#E5E5E5] hover:bg-[#EEE8F7]"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="bg-white border border-[#E5E5E5] rounded-lg p-3 flex items-center justify-between">
                <div>
                  <span className="text-[#958777] block">Temporary Password</span>
                  <span className="font-mono font-bold text-sm text-[#625346]">{issuedCreds.temporaryPassword}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(issuedCreds.temporaryPassword)
                    toast.success('Copied temporary password')
                  }}
                  className="p-1.5 rounded-lg border border-[#E5E5E5] hover:bg-[#EEE8F7]"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Platform SaaS MRR"
            value={formatInr(saasMetrics.mrrInr)}
            icon={CreditCard}
            tone="purple"
            subValue={`ARR ${formatInr(saasMetrics.arrInr)} · GST ${formatInr(saasMetrics.collectedGstInr)}`}
          />
          <KpiCard
            label="Paid Organizations"
            value={saasMetrics.paidTenantsCount}
            icon={Building2}
            subValue={`${orgs.length} total organizations`}
          />
          <KpiCard
            label="Pending Payment Verifications"
            value={metrics.pendingPayments}
            icon={Clock}
            tone={metrics.pendingPayments > 0 ? 'yellow' : 'sage'}
            subValue={`${metrics.pendingOrGrace} pending/grace orgs`}
          />
          <KpiCard
            label="Total Fleet Vehicles"
            value={metrics.totalVehicles}
            icon={Users}
            tone={metrics.pausedCount > 0 ? 'coral' : 'sage'}
            subValue={`${metrics.pausedCount} suspended/archived`}
          />
        </div>

        {/* Navigation Tabs */}
        <div className="enterprise-card p-2 flex flex-wrap gap-1.5">
          {[
            { id: 'organizations' as AdminTab, label: `Organizations (${orgs.length})`, icon: Building2 },
            {
              id: 'payments' as AdminTab,
              label: `Payment Verification (${metrics.pendingPayments} pending)`,
              icon: CreditCard,
            },
            { id: 'integrations' as AdminTab, label: `Platform Integrations (${integrations.length})`, icon: PlugZap },
            { id: 'monitoring' as AdminTab, label: 'System Monitoring & Audit', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-[#6E5696] text-white'
                    : 'bg-[#FAFAFA] text-[#625346] hover:bg-[#EEE8F7]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'organizations' && (
          <>
            {/* Filters */}
            <div className="enterprise-card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#958777] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Search organization name, code, city, owner..."
                  className="dm-input pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by status"
                  className="dm-input w-auto text-xs"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="payment_pending">Payment Pending</option>
                  <option value="grace_period">Grace Period</option>
                  <option value="suspended">Suspended</option>
                  <option value="terminated">Terminated</option>
                  <option value="archived">Archived</option>
                </select>
                <select
                  value={planFilter}
                  onChange={(e) => {
                    setPlanFilter(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter by plan"
                  className="dm-input w-auto text-xs"
                >
                  <option value="all">All Plans</option>
                  <option value="monthly">Monthly (₹3,500/mo)</option>
                  <option value="annual">Annual (₹36,000/yr)</option>
                </select>
              </div>
            </div>

            {/* Organizations Table */}
            <div className="enterprise-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Owner & Region</th>
                      <th>Plan & Usage</th>
                      <th>Status</th>
                      <th>Billing & Expiry</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-xs text-[#958777]">
                          Loading SaaS tenant directory...
                        </td>
                      </tr>
                    ) : paged.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-xs text-[#958777]">
                          No matching fleet organizations found.
                        </td>
                      </tr>
                    ) : (
                      paged.map((org) => (
                        <tr key={org.id}>
                          <td>
                            <p className="font-bold text-[#625346]">{org.name}</p>
                            <p className="text-[11px] font-mono text-[#958777]">
                              {org.code} · {org.id}
                            </p>
                          </td>
                          <td>
                            <p className="font-medium text-[#625346]">{org.ownerName ?? 'Owner Account'}</p>
                            <p className="text-[11px] text-[#958777]">
                              {org.city}, {org.state} · {org.ownerEmail ?? '—'}
                            </p>
                          </td>
                          <td>
                            <p className="font-semibold uppercase text-xs text-[#6E5696]">
                              {org.planId === 'annual' ? 'Annual Plan' : 'Monthly Plan'}
                            </p>
                            <p className="text-[11px] text-[#958777] tabular-nums">
                              {org.totalVehicles}/{org.vehicleLimit < 0 ? '∞' : org.vehicleLimit} veh ·{' '}
                              {org.totalDrivers}/{org.driverLimit < 0 ? '∞' : org.driverLimit} drv ·{' '}
                              {org.activeUsersCount} users
                            </p>
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${STATUS_BADGE[org.status]}`}
                            >
                              {org.status.replace('_', ' ')}
                            </span>
                            {org.suspensionReason && (
                              <p
                                className="text-[11px] text-[#B84E42] mt-1 max-w-[200px] truncate"
                                title={org.suspensionReason}
                              >
                                {org.suspensionReason}
                              </p>
                            )}
                          </td>
                          <td className="text-xs">
                            <p className="font-semibold capitalize text-[#625346]">{org.paymentStatus}</p>
                            <p className="text-[11px] text-[#958777]">
                              Exp: {org.subscriptionExpiryDate} · {formatInr(org.monthlyRevenueInr)}/mo eq.
                            </p>
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusTarget(org)
                                  setNextStatus(org.status === 'active' ? 'suspended' : 'active')
                                  setStatusReason('')
                                  setConfirmCheck(false)
                                }}
                                className="btn-secondary text-[11px] px-2.5 py-1"
                              >
                                <SlidersHorizontal className="w-3 h-3" />
                                Access
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setBillingTarget(org)
                                  setNextPlan(org.planId === 'annual' ? 'annual' : 'monthly')
                                  setNextPayStatus(org.paymentStatus)
                                  setNextExpiry(org.subscriptionExpiryDate)
                                  setBillingReason('')
                                }}
                                className="btn-secondary text-[11px] px-2.5 py-1"
                              >
                                <CreditCard className="w-3 h-3" />
                                Plan
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setGraceTarget(org)
                                  setGracePolicyDays(org.gracePeriodDays ?? 0)
                                  setExpiredAccessPolicy(org.expiredAccessPolicy ?? 'read_only')
                                  setGracePeriodEnd(org.subscriptionExpiryDate)
                                }}
                                className="btn-secondary text-[11px] px-2.5 py-1"
                              >
                                <Clock className="w-3 h-3" />
                                Grace
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSupportTarget(org)
                                  setSupportReason('')
                                }}
                                className="btn-secondary text-[11px] px-2.5 py-1"
                              >
                                <Headphones className="w-3 h-3" />
                                Support Log
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <PaginationFooter
                page={page}
                pageSize={pageSize}
                totalItems={filtered.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <div className="enterprise-card overflow-hidden">
              <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center justify-between">
                <div>
                  <h2 className="dm-card-title flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#6E5696]" />
                    Subscription Payment Verification Queue
                  </h2>
                  <p className="text-xs text-[#958777] mt-0.5">
                    Pending verification submissions remain locked until Platform Admin verifies settlement &amp; amount matching.
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#6E5696]">{payments.length} payment submissions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Organization</th>
                      <th>Plan &amp; Method</th>
                      <th>Base + GST = Total</th>
                      <th>Gateway Ref</th>
                      <th>Status</th>
                      <th className="text-right">Verification Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-xs text-[#958777]">
                          No subscription payment submissions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <p className="font-semibold text-[#625346]">{p.organizationName}</p>
                            <p className="text-[11px] font-mono text-[#958777]">
                              {p.organizationCode} · org {p.organizationStatus}
                            </p>
                          </td>
                          <td className="text-xs">
                            <p className="font-semibold capitalize">{p.planId} Plan</p>
                            <p className="text-[11px] text-[#958777]">{p.paymentMethod}</p>
                          </td>
                          <td className="text-xs tabular-nums">
                            {formatInr(p.baseAmountInr)} + {formatInr(p.taxAmountInr)} ={' '}
                            <strong className="text-[#625346]">{formatInr(p.totalAmountInr)}</strong>
                          </td>
                          <td className="font-mono text-xs text-[#625346]">
                            {p.gatewayReference ?? '—'}
                            <span className="block text-[10px] text-[#958777]">{formatShortDate(p.createdAt)}</span>
                          </td>
                          <td>
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                                p.status === 'successful'
                                  ? 'bg-[#EDF4EC] border-[#789A75] text-[#4D6E4A]'
                                  : p.status === 'pending_verification' || p.status === 'pending'
                                    ? 'bg-[#FCF5DE] border-[#D8B442] text-[#8E6F19]'
                                    : 'bg-[#FCECEB] border-[#D9786C] text-[#B84E42]'
                              }`}
                            >
                              {p.status.replace(/_/g, ' ')}
                            </span>
                            {p.failureReason && (
                              <p className="text-[11px] text-[#B84E42] mt-1 max-w-[180px] truncate" title={p.failureReason}>
                                {p.failureReason}
                              </p>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="inline-flex flex-wrap justify-end gap-1.5">
                              {p.status !== 'successful' && p.status !== 'refunded' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handlePaymentDecision(p.id, 'approve')}
                                    className="btn-primary text-[11px] px-2.5 py-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Approve &amp; Activate
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handlePaymentDecision(p.id, 'reject')}
                                    className="btn-secondary text-[11px] px-2.5 py-1 text-[#B84E42]"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    Reject
                                  </button>
                                </>
                              )}
                              {p.status === 'successful' && (
                                <button
                                  type="button"
                                  onClick={() => void handlePaymentDecision(p.id, 'refund')}
                                  className="btn-secondary text-[11px] px-2.5 py-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Refund
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Platform SaaS Billing Ledger */}
            <div className="enterprise-card overflow-hidden">
              <div className="px-5 py-4 bg-[#FFFFFF] border-b border-[#E5E5E5] flex items-center justify-between">
                <h2 className="dm-card-title flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#6E5696]" />
                  Platform SaaS &amp; GST Tax Invoices Ledger
                </h2>
                <span className="text-xs text-[#958777]">{recentSaasInvoices.length} issued invoices</span>
              </div>
              <div className="overflow-x-auto">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Organization</th>
                      <th>Plan</th>
                      <th>Base + 18% GST</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSaasInvoices.slice(0, 15).map((inv) => (
                      <tr key={inv.id}>
                        <td className="font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                        <td>
                          <span className="font-semibold text-[#625346]">{inv.organizationName}</span>
                          {inv.organizationCode && (
                            <span className="text-[11px] text-[#958777] ml-1.5">({inv.organizationCode})</span>
                          )}
                        </td>
                        <td className="capitalize text-xs">
                          {inv.planId} ({inv.billingCycle})
                        </td>
                        <td className="tabular-nums text-xs text-[#958777]">
                          {formatInr(inv.baseAmountInr)} + {formatInr(inv.gstInr)}
                        </td>
                        <td className="tabular-nums font-semibold">{formatInr(inv.totalInr)}</td>
                        <td>
                          <span className="capitalize text-xs font-semibold text-[#4D6E4A]">{inv.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="enterprise-card p-6 space-y-4">
            <div className="border-b border-[#E5E5E5] pb-3 flex items-center justify-between">
              <div>
                <h2 className="dm-card-title text-base flex items-center gap-2">
                  <PlugZap className="w-4 h-4 text-[#6E5696]" />
                  Platform-Exclusive System Integrations
                </h2>
                <p className="text-xs text-[#958777] mt-0.5">
                  Accessible ONLY to Platform Super Admin. Fleet Owners, Fleet Staff, and Drivers cannot view or configure provider credentials, gateways, or webhooks.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-[#EEE8F7] border border-[#DDD3ED] text-[11px] font-bold text-[#6E5696]">
                Strict 403 Isolated from Tenants
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-[#625346]">{item.name}</p>
                      <p className="text-[11px] font-mono text-[#958777]">
                        {item.providerKey} · {item.category}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${
                        item.status === 'configured' || item.status === 'active'
                          ? 'bg-[#EDF4EC] border-[#789A75] text-[#4D6E4A]'
                          : 'bg-[#FCF5DE] border-[#D8B442] text-[#8E6F19]'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono bg-white border border-[#E5E5E5] rounded-lg p-2.5 overflow-x-auto text-[#625346]">
                    {JSON.stringify(item.config, null, 2)}
                  </pre>
                  <div className="flex items-center justify-between text-[11px] text-[#958777]">
                    <span>Updated by {item.updatedBy ?? 'system'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIntegration(item)
                        setIntStatus(item.status)
                        setIntConfigJson(JSON.stringify(item.config, null, 2))
                      }}
                      className="btn-secondary text-[11px] px-2.5 py-1"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            {monitoring && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Platform Health" value={monitoring.health.toUpperCase()} icon={ShieldCheck} tone="sage" subValue={formatShortDate(monitoring.timestamp)} />
                <KpiCard label="Pending Verifications" value={monitoring.pendingPaymentVerifications} icon={Clock} tone={monitoring.pendingPaymentVerifications > 0 ? 'yellow' : 'sage'} />
                <KpiCard label="Failed Payment Attempts" value={monitoring.failedPaymentAttempts} icon={ShieldAlert} tone={monitoring.failedPaymentAttempts > 0 ? 'coral' : 'sage'} />
                <KpiCard label="Active Auth Sessions" value={monitoring.activeAuthSessions} icon={Activity} tone="purple" />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="enterprise-card p-5 space-y-4">
                <h2 className="dm-card-title flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[#6E5696]" />
                  Audited Support Access Sessions ({monitoring?.recentSupportSessions.length ?? 0})
                </h2>
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-custom">
                  {!monitoring || monitoring.recentSupportSessions.length === 0 ? (
                    <p className="text-xs text-[#958777] py-4">No support access sessions logged yet.</p>
                  ) : (
                    monitoring.recentSupportSessions.map((s) => (
                      <div key={s.id} className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] text-xs">
                        <div className="flex justify-between font-semibold text-[#625346]">
                          <span>Org: {s.organization_id}</span>
                          <span>{s.platform_admin_username}</span>
                        </div>
                        <p className="text-[#958777] mt-1">{s.reason}</p>
                        <p className="text-[11px] text-[#958777] mt-1">{new Date(s.started_at).toLocaleString('en-IN')}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="enterprise-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="dm-card-title flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#6E5696]" />
                    Immutable Platform Admin Audit Log
                  </h2>
                  <span className="text-xs text-[#958777]">{auditLogs.length} recent records</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-custom">
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-[#958777] py-4">No platform audit logs recorded yet.</p>
                  ) : (
                    auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#625346]">
                            <span className="font-mono text-[#6E5696] mr-2">{log.action}</span>
                            {log.targetOrgName ?? 'Platform'}
                          </p>
                          <p className="text-[#958777] mt-0.5">{log.reason}</p>
                        </div>
                        <div className="text-right text-[11px] text-[#958777] shrink-0">
                          <p className="font-medium text-[#625346]">{log.actorUsername}</p>
                          <p>{new Date(log.createdAt).toLocaleString('en-IN')}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Onboard Modal */}
      {onboardOpen && (
        <div className="fixed inset-0 z-50 bg-[#625346]/30 backdrop-blur-[1px] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl max-w-lg w-full p-6 shadow-elevated space-y-4 my-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#625346]">Onboard Fleet Organization</h2>
              <button type="button" onClick={() => setOnboardOpen(false)} className="p-1.5 rounded-lg hover:bg-[#EEE8F7]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleOnboardSubmit} className="space-y-3">
              <div>
                <label className="dm-label">Organization Name</label>
                <input value={formOrgName} onChange={(e) => setFormOrgName(e.target.value)} className="dm-input" placeholder="e.g., Malabar Cargo Movers Pvt Ltd" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dm-label">City</label>
                  <input value={formCity} onChange={(e) => setFormCity(e.target.value)} className="dm-input" placeholder="Kochi" required />
                </div>
                <div>
                  <label className="dm-label">State</label>
                  <input value={formState} onChange={(e) => setFormState(e.target.value)} className="dm-input" placeholder="Kerala" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dm-label">Owner Full Name</label>
                  <input value={formOwnerName} onChange={(e) => setFormOwnerName(e.target.value)} className="dm-input" placeholder="Ramesh Menon" required />
                </div>
                <div>
                  <label className="dm-label">Owner Work Email</label>
                  <input type="email" value={formOwnerEmail} onChange={(e) => setFormOwnerEmail(e.target.value)} className="dm-input" placeholder="ramesh@malabarcargo.in" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dm-label">Phone</label>
                  <input value={formOwnerPhone} onChange={(e) => setFormOwnerPhone(e.target.value)} className="dm-input" placeholder="+91 98470 11223" />
                </div>
                <div>
                  <label className="dm-label">GSTIN (Optional)</label>
                  <input value={formGstin} onChange={(e) => setFormGstin(e.target.value)} className="dm-input uppercase" placeholder="32AABCM1234F1Z5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="dm-label">Subscription Plan</label>
                  <select value={formPlan} onChange={(e) => setFormPlan(e.target.value as SubscriptionPlanId)} className="dm-input">
                    <option value="monthly">Monthly Plan (₹3,500/mo + GST · Unlimited)</option>
                    <option value="annual">Annual Plan (₹36,000/yr + GST · Save ₹6,000)</option>
                  </select>
                </div>
                <div>
                  <label className="dm-label">Payment Status</label>
                  <select value={formPaymentStatus} onChange={(e) => setFormPaymentStatus(e.target.value as Organization['paymentStatus'])} className="dm-input">
                    <option value="paid">Paid (Active Immediate)</option>
                    <option value="pending">Payment Pending</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOnboardOpen(false)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Create Tenant & Issue Credentials</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lifecycle Access Control Modal */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 bg-[#625346]/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#625346]">Manage Access — {statusTarget.name}</h2>
              <button type="button" onClick={() => setStatusTarget(null)} className="p-1.5 rounded-lg hover:bg-[#EEE8F7]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleStatusSubmit} className="space-y-3">
              <div>
                <label className="dm-label">Lifecycle Status</label>
                <select value={nextStatus} onChange={(e) => setNextStatus(e.target.value as OrganizationStatus)} className="dm-input">
                  <option value="active">Active (Full Access)</option>
                  <option value="payment_pending">Payment Pending</option>
                  <option value="grace_period">Grace Period</option>
                  <option value="suspended">Suspended (Block Login, Preserve Data)</option>
                  <option value="terminated">Terminated</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {nextStatus === 'grace_period' && (
                <div>
                  <label className="dm-label">Grace Window (Days)</label>
                  <input type="number" min={1} max={30} value={graceDays} onChange={(e) => setGraceDays(Number(e.target.value))} className="dm-input" />
                </div>
              )}
              <div>
                <label className="dm-label">Mandatory Administrative Reason</label>
                <textarea
                  rows={2}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  className="dm-input"
                  placeholder="Minimum 5 characters explaining status transition..."
                  required
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-[#625346] bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmCheck}
                  onChange={(e) => setConfirmCheck(e.target.checked)}
                  className="mt-0.5 accent-[#6E5696]"
                />
                <span>
                  I confirm updating tenant access status. Active sessions will be revoked immediately upon suspension while preserving all fleet history.
                </span>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStatusTarget(null)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">
                  <Check className="w-3.5 h-3.5" />
                  Apply Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Billing Modal */}
      {billingTarget && (
        <div className="fixed inset-0 z-50 bg-[#625346]/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#625346]">Subscription & Billing — {billingTarget.name}</h2>
              <button type="button" onClick={() => setBillingTarget(null)} className="p-1.5 rounded-lg hover:bg-[#EEE8F7]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleBillingSubmit} className="space-y-3">
              <div>
                <label className="dm-label">Subscription Plan</label>
                <select value={nextPlan} onChange={(e) => setNextPlan(e.target.value as SubscriptionPlanId)} className="dm-input">
                  <option value="monthly">Monthly Plan (₹3,500/mo + GST)</option>
                  <option value="annual">Annual Plan (₹36,000/yr + GST)</option>
                </select>
              </div>
              <div>
                <label className="dm-label">Payment Status</label>
                <select value={nextPayStatus} onChange={(e) => setNextPayStatus(e.target.value as Organization['paymentStatus'])} className="dm-input">
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="grace">Grace</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="dm-label">Subscription Expiry Date</label>
                <input type="date" value={nextExpiry} onChange={(e) => setNextExpiry(e.target.value)} className="dm-input" />
              </div>
              <div>
                <label className="dm-label">Audit Note</label>
                <input value={billingReason} onChange={(e) => setBillingReason(e.target.value)} className="dm-input" placeholder="e.g., Invoice #DM-2026-108 settled" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setBillingTarget(null)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Save Billing</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grace Policy Modal */}
      {graceTarget && (
        <div className="fixed inset-0 z-50 bg-[#625346]/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#625346]">Grace & Expiry Policy — {graceTarget.name}</h2>
              <button type="button" onClick={() => setGraceTarget(null)} className="p-1.5 rounded-lg hover:bg-[#EEE8F7]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleGraceSubmit} className="space-y-3">
              <div>
                <label className="dm-label">Grace Period Days (0 = strict expiry, max 60)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={gracePolicyDays}
                  onChange={(e) => setGracePolicyDays(Number(e.target.value))}
                  className="dm-input tabular-nums"
                />
              </div>
              <div>
                <label className="dm-label">Post-Expiry Access Mode</label>
                <select
                  value={expiredAccessPolicy}
                  onChange={(e) => setExpiredAccessPolicy(e.target.value as 'read_only' | 'blocked')}
                  className="dm-input"
                >
                  <option value="read_only">Read-Only Mode (View + Renew Subscription Only)</option>
                  <option value="blocked">Blocked (Subscription Renewal Page Only)</option>
                </select>
              </div>
              <div>
                <label className="dm-label">Current Period End Date</label>
                <input
                  type="date"
                  value={gracePeriodEnd}
                  onChange={(e) => setGracePeriodEnd(e.target.value)}
                  className="dm-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setGraceTarget(null)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Save Grace Policy</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Support Access Log Modal */}
      {supportTarget && (
        <div className="fixed inset-0 z-50 bg-[#625346]/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl max-w-md w-full p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#625346]">Start Audited Support Session — {supportTarget.name}</h2>
              <button type="button" onClick={() => setSupportTarget(null)} className="p-1.5 rounded-lg hover:bg-[#EEE8F7]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSupportSubmit} className="space-y-3">
              <div>
                <label className="dm-label">Support Ticket / Reason (min 5 chars)</label>
                <textarea
                  rows={3}
                  required
                  value={supportReason}
                  onChange={(e) => setSupportReason(e.target.value)}
                  placeholder="e.g., Investigating GST invoice verification delay on ticket #SUP-409"
                  className="dm-input"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setSupportTarget(null)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Log Support Session</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Platform Integration Edit Modal */}
      {editingIntegration && (
        <div className="fixed inset-0 z-50 bg-[#625346]/30 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-2xl max-w-lg w-full p-6 shadow-elevated space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#625346]">Configure {editingIntegration.name}</h2>
              <button type="button" onClick={() => setEditingIntegration(null)} className="p-1.5 rounded-lg hover:bg-[#EEE8F7]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleIntegrationSave} className="space-y-3">
              <div>
                <label className="dm-label">Status</label>
                <select value={intStatus} onChange={(e) => setIntStatus(e.target.value)} className="dm-input">
                  <option value="configured">Configured</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <div>
                <label className="dm-label">Configuration JSON</label>
                <textarea
                  rows={6}
                  value={intConfigJson}
                  onChange={(e) => setIntConfigJson(e.target.value)}
                  className="dm-input font-mono text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingIntegration(null)} className="btn-secondary text-xs">Cancel</button>
                <button type="submit" className="btn-primary text-xs">Save Integration</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
