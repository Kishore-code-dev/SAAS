import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Globe, KeyRound, ShieldCheck, Smartphone, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth, validateEmailFormat } from '../hooks/useAuth'
import { useFleet } from '../hooks/useFleet'
import { useTranslation } from '../i18n/useTranslation'
import { languageOptions } from '../i18n/translations'
import type { OperatingEnvironment, OrganizationRole } from '../types/fleet'

export default function Auth() {
  const navigate = useNavigate()
  const { signIn, signUp, signInWithOtp, verifyOtp, enterDemoSession, isCloudAuthReady } = useAuth()
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
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
    navigate(targetPath)
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
          const { error } = await signInWithOtp(email)
          if (error) {
            setFieldError(error.message)
            toast.error(error.message)
          } else {
            setOtpSent(true)
            toast.success('6-digit OTP verification code sent to your email.')
          }
        } else {
          const { error } = await verifyOtp(email, otpToken)
          if (error) {
            setFieldError(error.message)
            toast.error(error.message)
          } else {
            setEnvironment('production')
            toast.success('OTP verified. Entering Production environment.')
            navigate('/dashboard')
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
          toast.success('Signed in to Production environment.')
          navigate('/dashboard')
        }
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) {
          setFieldError(error.message)
          toast.error(error.message)
        } else {
          toast.success('Account created. Check your inbox to verify your email.')
          setAuthTab('signin')
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F0D9] flex flex-col">
      <header className="bg-[#FBF6E6] border-b border-[#E0D4B7] px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="font-extrabold text-lg text-[#625346] whitespace-nowrap">
          DriveMitra
        </Link>
        <div className="flex items-center gap-3">
          <Globe className="w-4 h-4 text-[#7D6D5F]" />
          <label htmlFor="auth-lang" className="sr-only">Language</label>
          <select
            id="auth-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            className="text-xs font-medium text-[#625346] bg-[#F4EBD5] border border-[#E0D4B7] rounded-[10px] px-2.5 py-1.5 outline-none"
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
          {/* Left Context Card - Pale Lavender Luxury Panel */}
          <div className="lg:col-span-5 bg-[#EEE8F7] border border-[#D4C7E6] text-[#625346] rounded-2xl p-8 shadow-card flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-[10px] bg-[#E8C65A] border border-[#C9A63B] flex items-center justify-center mb-6">
                <Activity className="w-5 h-5 text-[#625346]" />
              </div>
              <h1 className="text-2xl font-bold text-[#625346]">
                DriveMitra Workspace Access
              </h1>
              <p className="text-sm text-[#625346]/85 mt-3 leading-relaxed">
                Environments are strictly isolated. Demo and Pilot workspaces use repeatable operational datasets and never mix with Production organization records.
              </p>
            </div>

            <div className="mt-8 space-y-3 text-xs text-[#625346] border-t border-[#D4C7E6] pt-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4D6E4A] shrink-0" />
                <span>Organization-scoped Row Level Security (RLS)</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>ICE, CNG, and EV Commercial Fleet Digital Twins</span>
              </div>
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>Dedicated Driver Mobile App with offline recovery</span>
              </div>
            </div>
          </div>

          {/* Right Authentication Panel */}
          <div className="lg:col-span-7 enterprise-card p-8">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EEE8F7] rounded-[10px] border border-[#D4C7E6] mb-6" role="tablist">
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
                    authTab === t.id ? 'bg-[#FBF6E6] text-[#625346] shadow-subtle border border-[#D4C7E6]' : 'text-[#7D6D5F] hover:text-[#625346]'
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
                            ? 'border-[#C9A63B] bg-[#E8C65A]/45 text-[#625346] shadow-subtle'
                            : 'border-[#E0D4B7] bg-[#FBF6E6] text-[#625346] hover:bg-[#EEE8F7]'
                        }`}
                      >
                        <span className="text-xs font-bold uppercase block">{env}</span>
                        <span className="text-[11px] text-[#7D6D5F] block mt-0.5">
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
                {!isCloudAuthReady && (
                  <div className="p-3 rounded-[10px] bg-[#E8C65A]/25 border border-[#C9A63B] text-xs text-[#625346]">
                    Cloud Supabase Auth variables are not configured in this preview environment. Submissions validate locally and recommend Instant Demo & Pilot Access.
                  </div>
                )}

                {fieldError && (
                  <div
                    role="alert"
                    className="p-3 rounded-[10px] bg-[#D9786C]/22 border border-[#D9786C] text-xs font-semibold text-[#625346]"
                  >
                    {fieldError}
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
                    <div>
                      <label htmlFor="auth-otp" className="dm-label">6-Digit Email Verification Code</label>
                      <input
                        id="auth-otp"
                        value={otpToken}
                        onChange={(e) => setOtpToken(e.target.value)}
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
                    'Sign In to Production'
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
                <p className="text-xs text-[#7D6D5F]">
                  Supabase authentication is used for Production accounts when configured in environment variables.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
