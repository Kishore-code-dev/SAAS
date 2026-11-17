import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Globe, KeyRound, Layers, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, validateEmailFormat } from '../hooks/useAuth'
import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { languageOptions } from '../i18n/translations'
import { canAccessRoute, getDefaultHomeForRole } from '../utils/rbac'
import { BrandLogo } from '../components/ui/BrandLogo'
import type { OperatingEnvironment, OrganizationRole } from '../types/fleet'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, signInWithOtp, verifyOtp, enterDemoSession } = useAuth()
  const { setEnvironment, setActiveRole } = useFleet()
  const { language, setLanguage } = useTranslation()

  const [authTab, setAuthTab] = useState<'workspace' | 'signin' | 'signup' | 'otp'>('workspace')
  const [selectedEnv, setSelectedEnv] = useState<OperatingEnvironment>('demo')
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>('fleet_manager')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [otpToken, setOtpToken] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [issuedOtpPreview, setIssuedOtpPreview] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const requestedFrom = (location.state as { from?: string } | null)?.from

  const resolveSafeDestination = (role: OrganizationRole, preferred: string) => {
    if (requestedFrom && canAccessRoute(role, requestedFrom) && (requestedFrom.startsWith('/dashboard') || requestedFrom.startsWith('/driver'))) {
      return requestedFrom
    }
    return canAccessRoute(role, preferred) ? preferred : getDefaultHomeForRole(role)
  }

  const handleLaunchEnvironment = (targetPath: '/dashboard' | '/driver') => {
    setEnvironment(selectedEnv)
    const roleToUse: OrganizationRole = targetPath === '/driver' ? 'driver' : selectedRole
    setActiveRole(roleToUse)
    enterDemoSession({
      fullName:
        roleToUse === 'driver'
          ? 'Rajesh Kumar'
          : roleToUse === 'org_admin'
            ? 'Karthikeyan R'
            : 'Priya Sundar',
      email: `${roleToUse}@drivemitra.in`,
      role: roleToUse,
      isDemo: selectedEnv !== 'production',
    })
    toast.success(`Entered ${selectedEnv.toUpperCase()} workspace as ${roleToUse.replace('_', ' ')}`)
    navigate(resolveSafeDestination(roleToUse, targetPath))
  }

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)
    if (!validateEmailFormat(email)) {
      setFieldError('Enter a valid work email address (e.g., ops@company.in).')
      return
    }

    if (authTab === 'otp') {
      setSubmitting(true)
      try {
        if (!otpSent) {
          const { error, otpCode } = await signInWithOtp(email)
          if (error) {
            setFieldError(error.message)
            toast.error(error.message)
          } else {
            setOtpSent(true)
            setIssuedOtpPreview(otpCode ?? null)
            toast.success(
              otpCode
                ? `Verification code generated: ${otpCode}`
                : '6-digit verification code generated.',
            )
          }
        } else {
          const { error } = await verifyOtp(email, otpToken)
          if (error) {
            setFieldError(error.message)
            toast.error(error.message)
          } else {
            setEnvironment('production')
            setActiveRole('fleet_manager')
            setIssuedOtpPreview(null)
            toast.success('OTP verified. Entering workspace.')
            navigate(resolveSafeDestination('fleet_manager', '/dashboard'))
          }
        }
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (authTab === 'signup' && !fullName.trim()) {
      setFieldError('Full name is required to create an organization account.')
      return
    }
    if (!password || password.length < (authTab === 'signup' ? 8 : 6)) {
      setFieldError(
        authTab === 'signup'
          ? 'Password must be at least 8 characters long.'
          : 'Enter your password (minimum 6 characters).',
      )
      return
    }

    setSubmitting(true)
    try {
      if (authTab === 'signin') {
        const { error } = await signIn(email, password)
        if (error) {
          setFieldError(error.message)
          toast.error(error.message)
        } else {
          setEnvironment('production')
          setActiveRole('fleet_manager')
          toast.success('Signed in to Production workspace.')
          navigate(resolveSafeDestination('fleet_manager', '/dashboard'))
        }
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          setFieldError(error.message)
          toast.error(error.message)
        } else {
          toast.success('Organization account created locally. Sign in with your credentials.')
          setAuthTab('signin')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
      <header className="bg-[#FFFFFF] border-b border-[#E5E5E5] px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" aria-label="DriveMitra" className="flex items-center shrink-0">
          <BrandLogo size="header" />
        </Link>
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-[#958777]" />
          <label htmlFor="auth-lang" className="sr-only">Language</label>
          <select
            id="auth-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            className="text-xs font-medium text-[#625346] bg-[#FAFAFA] border border-[#E5E5E5] rounded-[10px] px-2.5 py-1.5 outline-none"
          >
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.nativeLabel}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Context Card - Pale Lavender Panel */}
          <div className="lg:col-span-5 bg-[#EEE8F7] border border-[#DDD3ED] text-[#625346] rounded-2xl p-8 shadow-card flex flex-col justify-between">
            <div>
              <BrandLogo size="lg" className="mb-5 border border-[#DDD3ED] shadow-subtle" />
              <h1 className="text-2xl font-bold text-[#625346]">
                DriveMitra Workspace Access
              </h1>
              <p className="text-sm text-[#625346]/85 mt-3 leading-relaxed">
                Environments are strictly isolated. Demo and Pilot workspaces use repeatable operational datasets and never mix with Production organization records.
              </p>
            </div>

            <div className="mt-8 space-y-3 text-xs text-[#625346] border-t border-[#DDD3ED] pt-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4D6E4A] shrink-0" />
                <span>Organization-scoped role-based access & tenant isolation</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>ICE, CNG, and EV Commercial Fleet Digital Twins</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>Runs standalone in your browser with local persistence</span>
              </div>
            </div>
          </div>

          {/* Right Authentication Panel */}
          <div className="lg:col-span-7 enterprise-card p-8">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EEE8F7] rounded-[10px] border border-[#DDD3ED] mb-6" role="tablist">
              {[
                { id: 'workspace', label: 'Demo & Pilot' },
                { id: 'signin', label: 'Sign In' },
                { id: 'signup', label: 'Register' },
                { id: 'otp', label: 'Email OTP' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={authTab === t.id}
                  onClick={() => {
                    setAuthTab(t.id as typeof authTab)
                    setFieldError(null)
                  }}
                  className={`flex-1 py-2 px-3 rounded-[8px] text-xs font-semibold transition-colors whitespace-nowrap ${
                    authTab === t.id ? 'bg-[#FFFFFF] text-[#625346] shadow-subtle border border-[#DDD3ED]' : 'text-[#958777] hover:text-[#625346]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {authTab === 'workspace' ? (
              <div className="space-y-5">
                <div>
                  <label className="dm-label">1. Select Operating Environment</label>
                  <div className="grid grid-cols-3 gap-2.5">
                    {(['demo', 'pilot', 'production'] as OperatingEnvironment[]).map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setSelectedEnv(env)}
                        className={`p-3 rounded-[10px] border text-left transition-colors ${
                          selectedEnv === env
                            ? 'border-[#D8B442] bg-[#E8C65A]/45 text-[#625346] shadow-subtle'
                            : 'border-[#E5E5E5] bg-[#FFFFFF] text-[#625346] hover:bg-[#EEE8F7]'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase block">{env}</span>
                        <span className="text-[11px] text-[#958777] block mt-0.5">
                          {env === 'demo' ? '2 sample orgs' : env === 'pilot' ? 'Field evaluation' : 'Clean org slate'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="demo-role-select" className="dm-label">
                    2. Select Role Permission View
                  </label>
                  <select
                    id="demo-role-select"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as OrganizationRole)}
                    className="dm-input"
                  >
                    <option value="fleet_manager">Fleet Manager (Operations & Dispatch)</option>
                    <option value="org_admin">Organization Admin (Full Controls)</option>
                    <option value="maintenance">Maintenance Lead (Workshop & Predictions)</option>
                    <option value="finance">Finance Controller (Fuel & Financial TCO)</option>
                    <option value="platform_admin">Platform Super Admin</option>
                  </select>
                </div>

                <div className="pt-2 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleLaunchEnvironment('/dashboard')}
                    className="btn-accent w-full py-3"
                  >
                    Enter Fleet Command Centre
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunchEnvironment('/driver')}
                    className="btn-secondary w-full py-2.5"
                  >
                    <Smartphone className="w-4 h-4" />
                    Open Driver Mobile Companion
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCredentialSubmit} noValidate className="space-y-4">
                {fieldError && (
                  <div
                    role="alert"
                    className="p-3 rounded-[10px] bg-[#FCECEB] border border-[#D9786C] text-xs font-semibold text-[#625346]"
                  >
                    {fieldError}
                  </div>
                )}

                {authTab === 'otp' && otpSent && issuedOtpPreview && (
                  <div className="p-3 rounded-[10px] bg-[#EEE8F7] border border-[#B8A3D9] text-xs text-[#625346] flex items-center justify-between gap-3">
                    <span>
                      Local OTP verification code for <strong>{email.trim().toLowerCase()}</strong>:
                    </span>
                    <span className="font-mono font-bold text-sm px-2 py-0.5 rounded bg-[#FFFFFF] border border-[#DDD3ED] tracking-widest">
                      {issuedOtpPreview}
                    </span>
                  </div>
                )}

                {authTab === 'signup' && (
                  <div>
                    <label htmlFor="auth-fullname" className="dm-label">Full Name</label>
                    <input
                      id="auth-fullname"
                      value={fullName}
                      onChange={(e) => {
                        setFullName(e.target.value)
                        setFieldError(null)
                      }}
                      placeholder="Karthikeyan R"
                      className="dm-input"
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="dm-label">Work Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setFieldError(null)
                    }}
                    placeholder="name@company.in"
                    className="dm-input"
                    required
                  />
                </div>

                {authTab === 'otp' ? (
                  otpSent && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label htmlFor="auth-otp" className="dm-label mb-0">6-Digit Verification Code</label>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpSent(false)
                            setOtpToken('')
                            setIssuedOtpPreview(null)
                            setFieldError(null)
                          }}
                          className="text-[11px] font-semibold text-[#6E5696] hover:underline"
                        >
                          Change email
                        </button>
                      </div>
                      <input
                        id="auth-otp"
                        value={otpToken}
                        onChange={(e) => {
                          setOtpToken(e.target.value)
                          setFieldError(null)
                        }}
                        placeholder="123456"
                        maxLength={6}
                        className="dm-input font-mono tracking-widest"
                        required
                      />
                    </div>
                  )
                ) : (
                  <div>
                    <label htmlFor="auth-password" className="dm-label">Password</label>
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setFieldError(null)
                      }}
                      placeholder={authTab === 'signup' ? 'Minimum 8 characters' : 'Minimum 6 characters'}
                      className="dm-input"
                      required
                    />
                  </div>
                )}

                <button type="submit" disabled={submitting} className="btn-accent w-full py-3">
                  {submitting ? (
                    'Authenticating...'
                  ) : authTab === 'signin' ? (
                    'Sign In to Workspace'
                  ) : authTab === 'signup' ? (
                    'Create Organization Account'
                  ) : otpSent ? (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Verify 6-Digit OTP
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Send Email OTP Code
                    </>
                  )}
                </button>
                <p className="text-xs text-[#958777]">
                  Accounts, credentials, and workspace sessions persist locally in your browser—no backend server or environment variables required.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
