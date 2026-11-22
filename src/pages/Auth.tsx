import React, { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, Eye, EyeOff, Globe, KeyRound, Layers, Lock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n/useTranslation'
import { languageOptions } from '../i18n/translations'
import { BrandLogo } from '../components/ui/BrandLogo'
import { SUBSCRIPTION_PLANS } from '../data/seedOrganizations'
import { canAccessRoute } from '../utils/rbac'
import type { BusinessType, SubscriptionPlanId } from '../types/fleet'
import { PWAInstallButton } from '../components/mobile/PWAInstallButton'

const BUSINESS_TYPES: BusinessType[] = [
  'Transport',
  'Logistics',
  'Passenger Transport',
  'Goods Transportation',
  'School/Staff Transportation',
  'Construction Fleet',
  'Other',
]

export default function Auth({ initialMode = 'login' }: { initialMode?: 'login' | 'signup' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { signIn, registerTenant, requestPasswordReset, completePasswordReset, orgBlockedState, user } = useAuth()
  const { language, setLanguage } = useTranslation()

  const paramMode = searchParams.get('mode') === 'signup' ? 'signup' : initialMode
  const paramPlan = searchParams.get('plan')
  const initialPlan: SubscriptionPlanId = paramPlan === 'annual' ? 'annual' : 'monthly'

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>(paramMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Fleet Owner Registration state (creates organization in payment_pending + guides to /onboarding)
  const [orgName, setOrgName] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('Transport')
  const [orgCity, setOrgCity] = useState('')
  const [orgState, setOrgState] = useState('')
  const [gstin, setGstin] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [signupUsername, setSignupUsername] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmSignupPassword, setConfirmSignupPassword] = useState('')
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [planId, setPlanId] = useState<SubscriptionPlanId>(initialPlan)
  const [termsAccepted, setTermsAccepted] = useState(false)

  const [resetIdentifier, setResetIdentifier] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [recoveryPreview, setRecoveryPreview] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const requestedFrom = (location.state as { from?: string } | null)?.from

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!username.trim()) {
      setErrorMessage('Enter your username or work email.')
      return
    }
    if (!password) {
      setErrorMessage('Enter your password.')
      return
    }

    setSubmitting(true)
    try {
      const result = await signIn(username, password)
      if (result.error) {
        setErrorMessage(result.error.message)
        return
      }
      toast.success('Signed in to DriveMitra.')
      const backendDest = result.redirectTo ?? '/dashboard'
      if (
        backendDest === '/change-password' ||
        backendDest === '/platform-admin' ||
        backendDest === '/onboarding' ||
        backendDest === '/driver'
      ) {
        navigate(backendDest, { replace: true })
        return
      }
      if (
        requestedFrom &&
        requestedFrom.startsWith('/dashboard') &&
        user?.role &&
        canAccessRoute(user.role, requestedFrom)
      ) {
        navigate(requestedFrom, { replace: true })
        return
      }
      navigate(backendDest, { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    if (!orgName.trim() || !orgCity.trim() || !orgState.trim() || !ownerName.trim() || !workEmail.includes('@')) {
      setErrorMessage('Enter organization name, hub city, state, owner full name, and valid work email.')
      return
    }
    if (mobile.replace(/\D/g, '').length < 10) {
      setErrorMessage('Enter a valid 10-digit mobile number.')
      return
    }
    if (signupUsername.trim().length < 3) {
      setErrorMessage('Choose an admin username of at least 3 characters.')
      return
    }
    if (signupPassword.length < 8) {
      setErrorMessage('Choose a strong password (min 8 chars, upper, lower, number, symbol).')
      return
    }
    if (signupPassword !== confirmSignupPassword) {
      setErrorMessage('Password and Confirm Password must match.')
      return
    }
    if (!termsAccepted) {
      setErrorMessage('You must accept the DriveMitra Terms of Service & Privacy Policy.')
      return
    }

    setSubmitting(true)
    try {
      const result = await registerTenant({
        organizationName: orgName.trim(),
        businessType,
        city: orgCity.trim(),
        state: orgState.trim(),
        gstin: gstin.trim().toUpperCase() || undefined,
        ownerName: ownerName.trim(),
        mobile: mobile.trim(),
        email: workEmail.trim(),
        username: signupUsername.trim(),
        password: signupPassword,
        confirmPassword: confirmSignupPassword,
        termsAccepted,
        planId,
        billingCycle: planId,
      })
      if (result.error) {
        setErrorMessage(result.error.message)
        return
      }
      toast.success(`Fleet workspace registered for ${orgName.trim()}. Complete guided onboarding to activate.`)
      navigate(result.redirectTo ?? '/onboarding', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    if (!resetIdentifier.trim()) {
      setErrorMessage('Enter your username or work email address.')
      return
    }
    setSubmitting(true)
    try {
      const res = await requestPasswordReset(resetIdentifier)
      if (res.error) {
        setErrorMessage(res.error.message)
        return
      }
      setInfoMessage(res.message ?? 'If your account exists, a single-use reset token has been generated.')
      setRecoveryPreview(res.recoveryTokenPreview ?? null)
      if (res.recoveryTokenPreview) {
        setResetToken(res.recoveryTokenPreview)
      }
      setMode('reset')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setInfoMessage(null)
    if (!resetToken.trim()) {
      setErrorMessage('Enter the single-use reset token.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMessage('New passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      const res = await completePasswordReset(resetToken, newPassword)
      if (res.error) {
        setErrorMessage(res.error.message)
        return
      }
      toast.success('Password updated. Sign in with your new password.')
      setPassword('')
      setResetToken('')
      setNewPassword('')
      setConfirmNewPassword('')
      setRecoveryPreview(null)
      setInfoMessage(res.message ?? 'Password updated. Please sign in.')
      setMode('login')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPlan = SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? SUBSCRIPTION_PLANS[0]

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
      <header className="bg-[#FFFFFF] border-b border-[#E5E5E5] px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sticky top-0 z-30">
        <Link to="/" aria-label="DriveMitra Home" className="flex items-center shrink-0">
          <BrandLogo size="header" />
        </Link>
        <div className="flex items-center gap-2.5">
          <PWAInstallButton compact />
          <div className="flex items-center gap-1.5 border border-[#E5E5E5] rounded-[10px] px-2.5 py-1.5 bg-[#FAFAFA] min-h-[40px]">
            <Globe className="w-3.5 h-3.5 text-[#958777]" />
            <label htmlFor="auth-lang" className="sr-only">Language</label>
            <select
              id="auth-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
              className="text-xs font-medium text-[#625346] bg-transparent outline-none cursor-pointer"
            >
              {languageOptions.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.nativeLabel}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 order-2 lg:order-1 bg-[#EEE8F7] border border-[#DDD3ED] text-[#625346] rounded-2xl p-6 sm:p-8 shadow-card flex flex-col justify-between">
            <div>
              <BrandLogo size="lg" className="mb-4" />
              <h1 className="text-2xl font-bold text-[#625346]">
                {mode === 'signup' ? 'Create Your Fleet Account' : 'DriveMitra Workspace Login'}
              </h1>
              <p className="text-sm text-[#625346]/85 mt-3 leading-relaxed">
                {mode === 'signup'
                  ? 'Register your fleet organization to start guided setup: add at least one Fleet Staff member, pick your Monthly (₹3,500) or Annual (₹36,000) plan, complete GST checkout, and unlock your workspace once payment is verified.'
                  : 'Single secure sign-in for Platform Admins, Fleet Owners, Fleet Staff, and Drivers. Your permissions, portal view, and mobile navigation adapt automatically based on your verified role.'}
              </p>

              <div className="mt-5 p-3.5 rounded-xl bg-white/80 border border-[#DDD3ED] space-y-2 text-xs">
                <p className="font-bold text-[#6E5696] uppercase tracking-wide text-[11px]">
                  4 Isolated Role Accounts
                </p>
                <ul className="space-y-1 text-[#625346]">
                  <li><strong>Platform Admin:</strong> SaaS governance, payment verification &amp; integrations</li>
                  <li><strong>Fleet Owner:</strong> Full fleet, 31-module staff permissions &amp; billing</li>
                  <li><strong>Fleet Staff:</strong> Enforced granular module &amp; field-level access</li>
                  <li><strong>Driver Portal:</strong> Assigned trips, odometer, fuel, expenses &amp; issues</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-xs text-[#625346] border-t border-[#DDD3ED] pt-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4D6E4A] shrink-0" />
                <span>HttpOnly &amp; bearer session security with strict tenant isolation</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>Unlimited commercial vehicles, drivers &amp; staff on both plans</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>Mandatory staff setup &amp; verified subscription activation (no unpaid access)</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2 enterprise-card p-6 sm:p-8 flex flex-col justify-center">
            {orgBlockedState && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-[10px] bg-[#FCECEB] border border-[#D9786C] text-xs text-[#625346]"
              >
                <p className="font-bold uppercase text-[#B84E42]">
                  Organization {orgBlockedState.status.replace('_', ' ')}
                </p>
                <p className="mt-1">{orgBlockedState.reason}</p>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-[10px] bg-[#FCECEB] border border-[#D9786C] text-xs font-semibold text-[#625346]"
              >
                {errorMessage}
              </div>
            )}

            {infoMessage && (
              <div className="mb-4 p-3 rounded-[10px] bg-[#EDF4EC] border border-[#789A75] text-xs font-medium text-[#4D6E4A]">
                {infoMessage}
              </div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} noValidate className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-[#625346]">Sign In</h2>
                  <p className="text-xs text-[#958777] mt-0.5">
                    Enter your issued username or work email and password to open your DriveMitra portal.
                  </p>
                </div>

                <div>
                  <label htmlFor="login-username" className="dm-label">
                    Username or Email
                  </label>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value)
                      setErrorMessage(null)
                    }}
                    placeholder="Enter username or work email"
                    className="dm-input"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="dm-label mb-0">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setErrorMessage(null)
                        setInfoMessage(null)
                      }}
                      className="text-xs font-semibold text-[#6E5696] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setErrorMessage(null)
                      }}
                      placeholder="Enter password"
                      className="dm-input pr-11"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#958777] hover:text-[#625346]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="btn-accent w-full py-3">
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>

                <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-between text-xs text-[#958777]">
                  <span>Registering a new fleet organization?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setErrorMessage(null)
                      setInfoMessage(null)
                    }}
                    className="font-semibold text-[#6E5696] hover:underline"
                  >
                    Create Fleet Account
                  </button>
                </div>
              </form>
            )}

            {mode === 'signup' && (
              <form onSubmit={handleSignupSubmit} noValidate className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-[#625346] flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#6E5696]" />
                      Fleet Owner Registration
                    </h2>
                    <p className="text-xs text-[#958777] mt-0.5">
                      Step 0 of Guided Onboarding — Workspace unlocks after mandatory staff setup &amp; verified subscription payment.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMessage(null)
                    }}
                    className="text-xs font-semibold text-[#6E5696] hover:underline whitespace-nowrap"
                  >
                    Already registered? Sign In
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="signup-org-name" className="dm-label">Organization Name *</label>
                    <input
                      id="signup-org-name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Cauvery Commercial Carriers Pvt Ltd"
                      className="dm-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-business-type" className="dm-label">Business Type *</label>
                    <select
                      id="signup-business-type"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                      className="dm-input"
                    >
                      {BUSINESS_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="signup-gstin" className="dm-label">GSTIN (Optional)</label>
                    <input
                      id="signup-gstin"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      placeholder="33AABCC1234F1Z5"
                      className="dm-input font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-city" className="dm-label">Primary Hub City *</label>
                    <input
                      id="signup-city"
                      value={orgCity}
                      onChange={(e) => setOrgCity(e.target.value)}
                      placeholder="e.g. Coimbatore"
                      className="dm-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-state" className="dm-label">State *</label>
                    <input
                      id="signup-state"
                      value={orgState}
                      onChange={(e) => setOrgState(e.target.value)}
                      placeholder="e.g. Tamil Nadu"
                      className="dm-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-owner" className="dm-label">Owner Full Name *</label>
                    <input
                      id="signup-owner"
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Full name"
                      className="dm-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-mobile" className="dm-label">Mobile Number *</label>
                    <input
                      id="signup-mobile"
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="+91 98400 12345"
                      className="dm-input tabular-nums"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-email" className="dm-label">Work Email *</label>
                    <input
                      id="signup-email"
                      type="email"
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="owner@company.in"
                      className="dm-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-username" className="dm-label">Admin Username *</label>
                    <input
                      id="signup-username"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      placeholder="e.g. cauvery.owner"
                      className="dm-input"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="signup-password" className="dm-label">Password *</label>
                    <div className="relative">
                      <input
                        id="signup-password"
                        type={showSignupPassword ? 'text' : 'password'}
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        placeholder="Min 8 chars, A-Z, 0-9, !@#"
                        className="dm-input pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword((s) => !s)}
                        aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#958777] hover:text-[#625346]"
                      >
                        {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-confirm-password" className="dm-label">Confirm Password *</label>
                    <input
                      id="signup-confirm-password"
                      type="password"
                      value={confirmSignupPassword}
                      onChange={(e) => setConfirmSignupPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="dm-input"
                      required
                    />
                  </div>
                </div>

                {/* Canonical Subscription Plan Selector */}
                <div className="space-y-2">
                  <span className="dm-label block">Subscription Plan (Unlimited Vehicles, Drivers &amp; Staff)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {SUBSCRIPTION_PLANS.map((p) => {
                      const active = planId === p.id
                      const price = p.id === 'annual' ? p.annualInr : p.monthlyInr
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlanId(p.id)}
                          className={`text-left p-3.5 rounded-xl border-2 transition-colors ${
                            active
                              ? 'border-[#6E5696] bg-[#EEE8F7]'
                              : 'border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#B8A3D9]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-[#625346]">{p.name}</span>
                            {p.savingsVsMonthlyInr > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EDF4EC] text-[#4D6E4A] border border-[#789A75]">
                                Save ₹{p.savingsVsMonthlyInr.toLocaleString('en-IN')} ({p.savingsPercent}%)
                              </span>
                            )}
                          </div>
                          <p className="text-base font-extrabold text-[#625346] tabular-nums mt-1">
                            ₹{price.toLocaleString('en-IN')}
                            <span className="text-xs font-normal text-[#958777]">
                              {p.id === 'annual' ? '/yr' : '/mo'} + 18% GST
                            </span>
                          </p>
                          <p className="text-[11px] text-[#958777] mt-0.5">
                            Total payable: ₹{p.totalPayableInr.toLocaleString('en-IN')}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-[#958777]">
                    Selected: <strong>{selectedPlan.name}</strong> — GST breakdown calculated transparently during checkout (Step 5).
                  </p>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-[#625346] bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3 cursor-pointer">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 accent-[#6E5696]"
                  />
                  <span>
                    I accept DriveMitra Terms of Service &amp; Privacy Policy and understand that full operational access unlocks after mandatory staff setup and verified subscription payment.
                  </span>
                </label>

                <button type="submit" disabled={submitting} className="btn-accent w-full py-3">
                  {submitting ? 'Creating Organization...' : 'Continue to Guided Onboarding'}
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleRequestReset} noValidate className="space-y-5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMessage(null)
                    }}
                    className="p-1.5 rounded-lg border border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7]"
                    aria-label="Back to login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-[#625346]">Forgot Password</h2>
                    <p className="text-xs text-[#958777]">
                      Request a single-use password reset token valid for 30 minutes.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="reset-identifier" className="dm-label">
                    Username or Work Email
                  </label>
                  <input
                    id="reset-identifier"
                    value={resetIdentifier}
                    onChange={(e) => {
                      setResetIdentifier(e.target.value)
                      setErrorMessage(null)
                    }}
                    placeholder="Enter username or registered email"
                    className="dm-input"
                    required
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn-accent w-full py-3">
                  <KeyRound className="w-4 h-4" />
                  {submitting ? 'Generating Token...' : 'Send Reset Token'}
                </button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleCompleteReset} noValidate className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setErrorMessage(null)
                    }}
                    className="p-1.5 rounded-lg border border-[#E5E5E5] text-[#625346] hover:bg-[#EEE8F7]"
                    aria-label="Back to login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-lg font-bold text-[#625346]">Set New Password</h2>
                    <p className="text-xs text-[#958777]">
                      Enter your reset token and choose a strong password.
                    </p>
                  </div>
                </div>

                {recoveryPreview && (
                  <div className="p-3 rounded-[10px] bg-[#EEE8F7] border border-[#B8A3D9] text-xs text-[#625346] flex items-center justify-between gap-2">
                    <span>Single-use token:</span>
                    <code className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-[#DDD3ED]">
                      {recoveryPreview}
                    </code>
                  </div>
                )}

                <div>
                  <label htmlFor="reset-token" className="dm-label">Reset Token</label>
                  <input
                    id="reset-token"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                    placeholder="Paste reset token"
                    className="dm-input font-mono text-xs"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="reset-new-pw" className="dm-label">New Password</label>
                  <input
                    id="reset-new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, upper, lower, number, symbol"
                    className="dm-input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="reset-confirm-pw" className="dm-label">Confirm New Password</label>
                  <input
                    id="reset-confirm-pw"
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="dm-input"
                    required
                  />
                </div>

                <button type="submit" disabled={submitting} className="btn-accent w-full py-3">
                  {submitting ? 'Updating Password...' : 'Confirm Password Reset'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
