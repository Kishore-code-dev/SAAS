import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { BrandLogo } from '../components/ui/BrandLogo'
import { useAuth } from '../hooks/useAuth'
import type { BusinessType } from '../types/fleet'

interface OnboardingStaffRow {
  id: string
  fullName: string
  email: string
  mobile: string | null
  employeeCode?: string
  designation: string
  department?: string
  accountStatus: string
  createdAt: string
}

interface CanonicalPlan {
  id: 'monthly' | 'annual'
  name: string
  billingFrequency: 'monthly' | 'annual'
  basePriceInr: number
  taxRatePct: number
  taxAmountInr: number
  totalPayableInr: number
  monthlyEquivalentInr: number
  annualSavingsInr: number
  discountPct: number
  tagline: string
  features: string[]
}

const BUSINESS_TYPES: BusinessType[] = [
  'Transport',
  'Logistics',
  'Passenger Transport',
  'Goods Transportation',
  'School/Staff Transportation',
  'Construction Fleet',
  'Other',
]

export function OnboardingWizard() {
  const { user, organization, subscription, refreshSession, signOut } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<number>(1)
  const [staffList, setStaffList] = useState<OnboardingStaffRow[]>([])
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)
  const [driversCount, setDriversCount] = useState(0)
  const [plans, setPlans] = useState<CanonicalPlan[]>([])

  // Step 1: Organization details
  const [orgName, setOrgName] = useState(organization?.name ?? '')
  const [businessType, setBusinessType] = useState<string>(organization?.businessType ?? 'Transport')
  const [city, setCity] = useState(organization?.city ?? '')
  const [stateName, setStateName] = useState(organization?.state ?? '')
  const [gstin, setGstin] = useState(organization?.gstin ?? '')
  const [ownerPhone, setOwnerPhone] = useState(organization?.ownerPhone ?? user?.mobile ?? '')

  // Step 2: Mandatory staff addition
  const [staffFullName, setStaffFullName] = useState('')
  const [staffEmail, setStaffEmail] = useState('')
  const [staffMobile, setStaffMobile] = useState('')
  const [staffDesignation, setStaffDesignation] = useState('Operations Coordinator')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [staffDepartment, setStaffDepartment] = useState('Operations')
  const [staffError, setStaffError] = useState('')

  // Step 3: Optional driver addition
  const [driverName, setDriverName] = useState('')
  const [driverMobile, setDriverMobile] = useState('')
  const [driverEmail, setDriverEmail] = useState('')
  const [driverLicense, setDriverLicense] = useState('')
  const [driverAddedBanner, setDriverAddedBanner] = useState('')

  // Step 4 & 5: Plan & Checkout
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly')
  const [paymentMethod, setPaymentMethod] = useState('UPI / Razorpay')
  const [checkoutData, setCheckoutData] = useState<{
    paymentId: string
    baseAmountInr: number
    taxAmountInr: number
    totalPayableInr: number
  } | null>(null)
  const [gatewayRef, setGatewayRef] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchState = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding/state', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      if (data.onboardingCompleted && data.organization?.status === 'active') {
        navigate('/dashboard', { replace: true })
        return
      }
      setStaffList(Array.isArray(data.staffProfiles) ? data.staffProfiles : [])
      setDriversCount(Number(data.driversCount ?? 0))
      if (Array.isArray(data.plans)) setPlans(data.plans)
      if (data.organization) {
        setOrgName(data.organization.name || '')
        setBusinessType(data.organization.businessType || 'Transport')
        setCity(data.organization.city || '')
        setStateName(data.organization.state || '')
        setGstin(data.organization.gstin || '')
        setOwnerPhone(data.organization.ownerPhone || '')
      }
      if (data.subscription?.status === 'pending_verification') {
        setStep(6)
      } else if (typeof data.onboardingStep === 'number' && data.onboardingStep >= 1 && data.onboardingStep <= 6) {
        setStep(data.onboardingStep)
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchState()
  }, [fetchState])

  useEffect(() => {
    if (user && user.role !== 'org_admin') {
      navigate(user.role === 'platform_admin' ? '/platform-admin' : user.role === 'driver' ? '/driver' : '/dashboard', {
        replace: true,
      })
    }
  }, [user, navigate])

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/organization', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: orgName,
          businessType,
          city,
          state: stateName,
          gstin,
          ownerPhone,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not update organization profile')
        return
      }
      toast.success('Organization profile saved')
      setStep(2)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setStaffError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/staff', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: staffFullName,
          email: staffEmail,
          mobile: staffMobile,
          designation: staffDesignation,
          department: staffDepartment,
          sendInvite: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStaffError(data.error || 'Failed to add staff member')
        return
      }
      setStaffList((prev) => [...prev, data.staffProfile])
      if (data.invitation?.inviteUrl) {
        setLastInviteUrl(`${window.location.origin}${data.invitation.inviteUrl}`)
      }
      setStaffFullName('')
      setStaffEmail('')
      setStaffMobile('')
      toast.success('Staff member added and invitation generated')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/onboarding/drivers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: driverName,
          mobile: driverMobile,
          email: driverEmail,
          licenseNumber: driverLicense,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not add driver')
        return
      }
      setDriversCount((c) => c + 1)
      setDriverAddedBanner(`Added driver ${data.name} (${data.licenseNumber}). You can invite them to the Driver Portal anytime after activation.`)
      setDriverName('')
      setDriverMobile('')
      setDriverEmail('')
      setDriverLicense('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSkipDriver = async () => {
    setSubmitting(true)
    try {
      await fetch('/api/onboarding/drivers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true }),
      })
      setStep(4)
    } finally {
      setSubmitting(false)
    }
  }

  const handleInitiateCheckout = async () => {
    setPaymentError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/subscription/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlan, paymentMethod }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPaymentError(data.error || 'Checkout could not be created')
        return
      }
      setCheckoutData({
        paymentId: data.payment.id,
        baseAmountInr: data.checkout.baseAmountInr,
        taxAmountInr: data.checkout.taxAmountInr,
        totalPayableInr: data.checkout.totalPayableInr,
      })
      setStep(5)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePaymentSubmission = async (
    outcome: 'submitted_for_verification' | 'failed' | 'pending' | 'cancelled',
  ) => {
    if (!checkoutData) return
    setPaymentError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/subscription/payments/${checkoutData.paymentId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          gatewayReference: gatewayRef || undefined,
          reportedAmountInr: checkoutData.totalPayableInr,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPaymentError(data.error || `Payment ${outcome}. Workspace remains pending until payment succeeds.`)
        return
      }
      await refreshSession()
      toast.success('Payment submitted for Platform Admin verification')
      setStep(6)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCheckActivation = async () => {
    await refreshSession()
    await fetchState()
  }

  const activePlan = plans.find((p) => p.id === selectedPlan) ?? {
    id: selectedPlan,
    name: selectedPlan === 'annual' ? 'DriveMitra Annual' : 'DriveMitra Monthly',
    basePriceInr: selectedPlan === 'annual' ? 36000 : 3500,
    taxAmountInr: selectedPlan === 'annual' ? 6480 : 630,
    totalPayableInr: selectedPlan === 'annual' ? 42480 : 4130,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading onboarding workspace...</p>
        </div>
      </div>
    )
  }

  const stepsMeta = [
    { num: 1, label: 'Business Profile' },
    { num: 2, label: 'Add Staff (Required)' },
    { num: 3, label: 'Drivers (Optional)' },
    { num: 4, label: 'Select Plan' },
    { num: 5, label: 'GST Checkout' },
    { num: 6, label: 'Verification' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
              Setup Required · Pending Activation
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-500">
              Signed in as <strong className="text-slate-800">{user?.fullName}</strong>
            </span>
            <button
              type="button"
              onClick={() => void signOut().then(() => navigate('/auth'))}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Progress Bar */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-8">
          {stepsMeta.map((s) => {
            const done = step > s.num || (s.num === 2 && staffList.length >= 1 && step > 2)
            const current = step === s.num
            return (
              <div
                key={s.num}
                className={`rounded-xl border px-3 py-2.5 transition-colors ${
                  current
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : done
                      ? 'bg-white border-emerald-200 text-emerald-700'
                      : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>Step {s.num}</span>
                  {done && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-xs font-semibold mt-0.5 truncate">{s.label}</p>
              </div>
            )
          })}
        </div>

        {/* STEP 1: BUSINESS PROFILE */}
        {step === 1 && (
          <form onSubmit={handleSaveOrg} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">1. Confirm Fleet Business Details</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Verify your organization profile and GST billing details before setting up your team.
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Organization Name *</label>
                <input
                  required
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Type *</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">City *</label>
                <input
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">State *</label>
                <input
                  required
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Owner Mobile Number *</label>
                <input
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">GSTIN (Optional)</label>
                <input
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                Save & Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: MANDATORY MINIMUM 1 STAFF MEMBER */}
        {step === 2 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">2. Add at Least 1 Fleet Staff Member (Mandatory)</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Every organization must designate at least one operational staff team member before checkout. The Fleet Owner account never counts as a staff member.
                </p>
              </div>
            </div>

            {staffError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleAddStaff} className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Full Name *</label>
                <input
                  required
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  placeholder="Priya Nair"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Work Email *</label>
                <input
                  required
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="priya@company.in"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number</label>
                <input
                  value={staffMobile}
                  onChange={(e) => setStaffMobile(e.target.value)}
                  placeholder="+91 9845011223"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  value={staffDesignation}
                  onChange={(e) => setStaffDesignation(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">
                  Default 15 operational modules enabled; you can customize all 31 modules anytime in Staff & Permissions.
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  <UserPlus className="w-4 h-4" /> Add Staff & Generate Invite
                </button>
              </div>
            </form>

            {lastInviteUrl && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-emerald-900">
                  <span className="font-semibold block">Staff Invitation Link Ready:</span>
                  <code className="break-all text-emerald-700">{lastInviteUrl}</code>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(lastInviteUrl)
                    toast.success('Invitation link copied')
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-emerald-800"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Link
                </button>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Added Staff Team ({staffList.length} added · minimum 1 required)
              </h3>
              {staffList.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/70 text-xs font-medium text-amber-900">
                  No staff member added yet. You must add at least 1 staff member above before continuing to Step 3.
                </div>
              ) : (
                <div className="space-y-2">
                  {staffList.map((st) => (
                    <div key={st.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{st.fullName} · <span className="text-slate-500 font-normal">{st.designation}</span></p>
                        <p className="text-xs text-slate-500">{st.email} {st.employeeCode ? `· ${st.employeeCode}` : ''}</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
                        {st.accountStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={staffList.length < 1}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue to Drivers <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: OPTIONAL DRIVERS */}
        {step === 3 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">3. Add Drivers (Optional)</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Add initial drivers now or skip to proceed straight to subscription plan selection. Drivers registered here remain record-only until you choose to invite them to the Driver Portal.
                </p>
              </div>
            </div>

            {driverAddedBanner && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">
                {driverAddedBanner}
              </div>
            )}

            <form onSubmit={handleAddDriver} className="grid sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Driver Full Name *</label>
                <input
                  required
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Ramesh Yadav"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                <input
                  required
                  value={driverMobile}
                  onChange={(e) => setDriverMobile(e.target.value)}
                  placeholder="+91 9900112233"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">License Number *</label>
                <input
                  required
                  value={driverLicense}
                  onChange={(e) => setDriverLicense(e.target.value.toUpperCase())}
                  placeholder="KA01-20210044123"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Optional)</label>
                <input
                  type="email"
                  value={driverEmail}
                  onChange={(e) => setDriverEmail(e.target.value)}
                  placeholder="ramesh@drivers.in"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                />
              </div>
              <div className="sm:col-span-2 flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">Current drivers in organization: <strong>{driversCount}</strong></span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Save Driver Record
                </button>
              </div>
            </form>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleSkipDriver()}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Skip for Now
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  Choose Subscription Plan <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: CHOOSE MONTHLY OR ANNUAL */}
        {step === 4 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">4. Choose Your DriveMitra Subscription</h1>
              <p className="text-sm text-slate-600 mt-1">
                Full DriveMitra capabilities unlocked with unlimited vehicles, drivers, and staff. Access starts immediately once payment is verified.
              </p>
            </div>

            {paymentError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
                {paymentError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              {(plans.length > 0 ? plans : [
                {
                  id: 'monthly' as const,
                  name: 'DriveMitra Monthly',
                  billingFrequency: 'monthly' as const,
                  basePriceInr: 3500,
                  taxRatePct: 18,
                  taxAmountInr: 630,
                  totalPayableInr: 4130,
                  monthlyEquivalentInr: 3500,
                  annualSavingsInr: 0,
                  discountPct: 0,
                  tagline: 'Full platform access billed monthly.',
                  features: ['Unlimited vehicles, drivers & staff', '31-module role matrix & Driver Portal', 'Predictive maintenance & GST billing'],
                },
                {
                  id: 'annual' as const,
                  name: 'DriveMitra Annual',
                  billingFrequency: 'annual' as const,
                  basePriceInr: 36000,
                  taxRatePct: 18,
                  taxAmountInr: 6480,
                  totalPayableInr: 42480,
                  monthlyEquivalentInr: 3000,
                  annualSavingsInr: 6000,
                  discountPct: 14.29,
                  tagline: 'Full platform access — save ₹6,000/yr.',
                  features: ['Unlimited vehicles, drivers & staff', '31-module role matrix & Driver Portal', 'Equivalent to ₹3,000/month (14.29% savings)'],
                },
              ]).map((plan) => {
                const isSelected = selectedPlan === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`text-left rounded-2xl border-2 p-6 flex flex-col justify-between transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-slate-900">{plan.name}</span>
                        {plan.annualSavingsInr > 0 && (
                          <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                            Save ₹{plan.annualSavingsInr.toLocaleString('en-IN')} ({plan.discountPct}%)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{plan.tagline}</p>
                      <div className="mt-4 flex items-baseline gap-1.5">
                        <span className="text-3xl font-extrabold text-slate-900">
                          ₹{plan.basePriceInr.toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-slate-500">
                          / {plan.billingFrequency === 'annual' ? 'year' : 'month'} + 18% GST
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Total payable incl. GST: <strong className="text-slate-800">₹{plan.totalPayableInr.toLocaleString('en-IN')}</strong>
                      </p>
                      <ul className="mt-4 space-y-2">
                        {plan.features.map((feat) => (
                          <li key={feat} className="flex items-center gap-2 text-xs text-slate-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-5 pt-4 border-t border-slate-200 text-xs font-bold text-emerald-700">
                      {isSelected ? 'Selected Plan ✓' : 'Select This Plan'}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleInitiateCheckout()}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                Proceed to GST Checkout <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: GST CHECKOUT */}
        {step === 5 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">5. GST Checkout & Payment Submission</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Submit payment to queue Platform Admin verification. Only verified payments unlock full workspace operations.
                </p>
              </div>
            </div>

            {paymentError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
                {paymentError}
              </div>
            )}

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Selected Plan</span>
                <span className="font-semibold text-slate-900">{activePlan.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Base Subscription Amount</span>
                <span className="font-semibold text-slate-900">₹{(checkoutData?.baseAmountInr ?? activePlan.basePriceInr).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">IGST / CGST+SGST (18%)</span>
                <span className="font-semibold text-slate-900">₹{(checkoutData?.taxAmountInr ?? activePlan.taxAmountInr).toLocaleString('en-IN')}</span>
              </div>
              <div className="pt-2.5 border-t border-slate-300 flex justify-between text-base font-bold text-slate-900">
                <span>Total Payable (INR)</span>
                <span>₹{(checkoutData?.totalPayableInr ?? activePlan.totalPayableInr).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="UPI / Razorpay">UPI / Razorpay</option>
                  <option value="NEFT / RTGS Transfer">NEFT / RTGS Transfer</option>
                  <option value="Corporate Credit Card">Corporate Credit Card</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">UTR / Gateway Reference</label>
                <input
                  value={gatewayRef}
                  onChange={(e) => setGatewayRef(e.target.value)}
                  placeholder="UTR20261122001 (auto-generated if blank)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="w-4 h-4" /> Change Plan
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePaymentSubmission('failed')}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold"
                >
                  Simulate Failed Payment
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePaymentSubmission('cancelled')}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Cancel Payment
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handlePaymentSubmission('submitted_for_verification')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                >
                  <ShieldCheck className="w-4 h-4" /> Submit Payment for Verification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: AWAITING PLATFORM ADMIN VERIFICATION */}
        {step === 6 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Awaiting Platform Admin Payment Verification</h1>
              <p className="text-sm text-slate-600 max-w-xl mx-auto mt-2">
                Your workspace (<strong className="text-slate-900">{organization?.name}</strong>) has completed team onboarding ({staffList.length} staff member added) and submitted payment for verification. Operational fleet modules unlock automatically once a Platform Administrator verifies the payment.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
              <span>Org Status: <strong className="text-amber-700">{organization?.status ?? 'payment_pending'}</strong></span>
              <span>·</span>
              <span>Subscription: <strong className="text-amber-700">{subscription?.status ?? 'pending_verification'}</strong></span>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleCheckActivation()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                <RefreshCw className="w-4 h-4" /> Check Verification Status
              </button>
              <button
                type="button"
                onClick={() => void signOut().then(() => navigate('/auth'))}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default OnboardingWizard
