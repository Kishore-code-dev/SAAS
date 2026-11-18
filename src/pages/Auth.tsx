import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Globe, KeyRound, Layers, Lock, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { useTranslation } from '../i18n/useTranslation'
import { languageOptions } from '../i18n/translations'
import { BrandLogo } from '../components/ui/BrandLogo'
import { canAccessRoute } from '../utils/rbac'

export default function Auth() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, requestPasswordReset, completePasswordReset, orgBlockedState, user } = useAuth()
  const { language, setLanguage } = useTranslation()

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

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
      if (backendDest === '/change-password' || backendDest === '/platform-admin') {
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

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
      <header className="bg-[#FFFFFF] border-b border-[#E5E5E5] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" aria-label="DriveMitra Home" className="flex items-center shrink-0">
          <BrandLogo size="header" />
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/" className="text-xs font-semibold text-[#6E5696] hover:underline whitespace-nowrap">
            Back to Website
          </Link>
          <div className="flex items-center gap-1.5 border border-[#E5E5E5] rounded-[10px] px-2.5 py-1.5 bg-[#FAFAFA]">
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
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-5 bg-[#EEE8F7] border border-[#DDD3ED] text-[#625346] rounded-2xl p-7 sm:p-8 shadow-card flex flex-col justify-between">
            <div>
              <BrandLogo size="lg" className="mb-5" />
              <h1 className="text-2xl font-bold text-[#625346]">
                DriveMitra Workspace Login
              </h1>
              <p className="text-sm text-[#625346]/85 mt-3 leading-relaxed">
                Sign in with your organization-issued username and password. Role authorization and tenant routing are enforced automatically on the server.
              </p>
            </div>

            <div className="mt-8 space-y-3 text-xs text-[#625346] border-t border-[#DDD3ED] pt-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#4D6E4A] shrink-0" />
                <span>HttpOnly session security & strict tenant data isolation</span>
              </div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>Owner ERP for vehicles, drivers, work orders & inventory</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#6E5696] shrink-0" />
                <span>Mandatory temporary password rotation on first login</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 enterprise-card p-6 sm:p-8 flex flex-col justify-center">
            {orgBlockedState && (
              <div
                role="alert"
                className="mb-5 p-3.5 rounded-[10px] bg-[#FCECEB] border border-[#D9786C] text-xs text-[#625346]"
              >
                <p className="font-bold uppercase text-[#B84E42]">
                  Organization {orgBlockedState.status}
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
                    Enter your issued username and password to access your fleet workspace.
                  </p>
                </div>

                <div>
                  <label htmlFor="login-username" className="dm-label">
                    Username
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
                    placeholder="Enter username"
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
