import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Eye, EyeOff, Key, Lock, LogOut, Package, User, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from '../components/ui/BrandLogo'

interface OnboardingCredentials {
  username: string
  tempPassword: string
  organization: {
    id: string
    name: string
    code: string
  }
  staffCredentials?: {
    username: string
    temporaryPassword: string
  }
}

export default function ForcePasswordChange() {
  const { user, changePassword, signOut } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [onboardingCreds, setOnboardingCreds] = useState<OnboardingCredentials | null>(null)

  const checks = [
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'One uppercase letter (A–Z)', ok: /[A-Z]/.test(newPassword) },
    { label: 'One lowercase letter (a–z)', ok: /[a-z]/.test(newPassword) },
    { label: 'One digit (0–9)', ok: /\d/.test(newPassword) },
    { label: 'One special symbol (!@#$...)', ok: /[^A-Za-z0-9]/.test(newPassword) },
    { label: 'Different from temporary password', ok: Boolean(newPassword) && newPassword !== currentPassword },
    { label: 'Passwords match', ok: Boolean(confirmPassword) && newPassword === confirmPassword },
  ]

  const allValid = checks.every((c) => c.ok)

  // Check for onboarding credentials on mount
  useEffect(() => {
    const creds = localStorage.getItem('dm_onboarding_creds')
    if (creds) {
      try {
        const parsed = JSON.parse(creds) as OnboardingCredentials
        setOnboardingCreds(parsed)
        setShowCredentials(true)
        localStorage.removeItem('dm_onboarding_creds')
      } catch {
        // Ignore parse errors
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!currentPassword) {
      setError('Enter your current temporary password.')
      return
    }
    if (!allValid) {
      setError('Satisfy all password security requirements below before continuing.')
      return
    }
    setSubmitting(true)
    try {
      const res = await changePassword(currentPassword, newPassword)
      if (res.error) {
        setError(res.error.message)
        return
      }
      toast.success('Password updated! Opening your DriveMitra workspace.')
      // changePassword already sets user, organization, and dispatches dm-auth-session event.
      // The useFleet hook will auto-hydrate via its useEffect when user state changes.
      // Navigate to dashboard - the ProtectedRoute and FleetProvider will handle hydrating the workspace.
      navigate(res.redirectTo ?? '/dashboard', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  // Show credentials display if we have onboarding credentials
  if (showCredentials && onboardingCreds) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl enterprise-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
            <BrandLogo size="md" />
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold text-[#B84E42] hover:underline inline-flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>

          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E8C65A] border border-[#D8B442] text-xs font-semibold text-[#625346]">
              <Key className="w-3.5 h-3.5" />
              Account Created Successfully
            </div>
            <h1 className="text-2xl font-bold text-[#625346]">Your FleetMitra Account Credentials</h1>
            <p className="text-xs text-[#958777] leading-relaxed max-w-lg mx-auto">
              Save these credentials securely. You'll use them to log in and set your permanent password.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Owner Credentials Card */}
            <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 bg-[#6E5696] rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold text-[#625346]">Fleet Owner</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-[#958777] uppercase tracking-wide">Fleet Name</label>
                  <div className="mt-1 text-sm font-bold text-[#625346]">{onboardingCreds.organization.name}</div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-[#958777] uppercase tracking-wide">Organization Code</label>
                  <div className="mt-1 text-sm font-bold text-[#625346] bg-[#EEE8F7] px-2.5 py-1 rounded border border-[#B8A3D9]">
                    {onboardingCreds.organization.code}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-[#958777] uppercase tracking-wide">Username</label>
                  <div className="mt-1 text-sm text-[#625346] font-mono bg-[#F7F0D9] px-2.5 py-1 rounded border">
                    {onboardingCreds.username}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-[#958777] uppercase tracking-wide">Temporary Password</label>
                  <div className="mt-1 text-sm text-[#625346] font-mono bg-[#F7F0D9] px-2.5 py-1 rounded border break-all">
                    {onboardingCreds.tempPassword}
                  </div>
                </div>
              </div>
            </div>

            {/* Staff Credentials Card */}
            {onboardingCreds.staffCredentials && (
              <div className="bg-[#FFFFFF] border border-[#E5E5E5] rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 bg-[#4D6E4A] rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-[#625346]">Staff Member</h3>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-[#958777] uppercase tracking-wide">Username</label>
                    <div className="mt-1 text-sm text-[#625346] font-mono bg-[#F7F0D9] px-2.5 py-1 rounded border">
                      {onboardingCreds.staffCredentials.username}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-[#958777] uppercase tracking-wide">Temporary Password</label>
                    <div className="mt-1 text-sm text-[#625346] font-mono bg-[#F7F0D9] px-2.5 py-1 rounded border break-all">
                      {onboardingCreds.staffCredentials.temporaryPassword}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-[#EDF4EC] border border-[#789A75] rounded-lg p-4 text-xs text-[#4D6E4A]">
            <strong className="block mb-2">Next Steps:</strong>
            <ul className="space-y-1.5 text-sm leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" />
                Use your <strong>username</strong> and <strong>temporary password</strong> to log in
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" />
                Set a permanent password (meets security requirements below)
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5" />
                Complete your subscription payment via DriveMitra support
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setShowCredentials(false)}
            className="btn-primary w-full py-3 text-sm font-semibold"
          >
            Continue to Set Password
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md enterprise-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
          <BrandLogo size="md" />
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs font-semibold text-[#B84E42] hover:underline inline-flex items-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#EEE8F7] border border-[#B8A3D9] text-xs font-semibold text-[#6E5696]">
            <Lock className="w-3.5 h-3.5" />
            Mandatory First-Login Security Step
          </div>
          <h1 className="text-xl font-bold text-[#625346]">Set Your Permanent Password</h1>
          <p className="text-xs text-[#958777] leading-relaxed">
            Welcome, <strong className="text-[#625346]">{user?.fullName ?? user?.username}</strong>. For organization security, update your temporary onboarding password before accessing fleet operations.
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-[10px] bg-[#FCECEB] border border-[#D9786C] text-xs font-semibold text-[#625346]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="cp-current" className="dm-label">Temporary / Current Password</label>
            <div className="relative">
              <input
                id="cp-current"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setError(null)
                }}
                placeholder="Enter temporary password"
                className="dm-input pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#958777] hover:text-[#625346]"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="cp-new" className="dm-label">New Password</label>
            <div className="relative">
              <input
                id="cp-new"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setError(null)
                }}
                placeholder="Choose strong password"
                className="dm-input pr-11"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label={showNew ? 'Hide new password' : 'Show new password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#958777] hover:text-[#625346]"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="cp-confirm" className="dm-label">Confirm New Password</label>
            <input
              id="cp-confirm"
              type={showNew ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                setError(null)
              }}
              placeholder="Re-enter new password"
              className="dm-input"
              required
            />
          </div>

          <div className="bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl p-3.5 space-y-1.5">
            {checks.map((c) => (
              <div key={c.label} className="flex items-center gap-2 text-xs">
                {c.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#4D6E4A] shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#958777] shrink-0" />
                )}
                <span className={c.ok ? 'text-[#4D6E4A] font-medium' : 'text-[#958777]'}>{c.label}</span>
              </div>
            ))}
          </div>

          <button type="submit" disabled={submitting} className="btn-accent w-full py-3">
            {submitting ? 'Updating Password...' : 'Save New Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}