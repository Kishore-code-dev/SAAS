import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Circle, Eye, EyeOff, Lock, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../hooks/useAuth'
import { BrandLogo } from '../components/ui/BrandLogo'

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
      navigate(res.redirectTo ?? '/dashboard', { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md enterprise-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
          <BrandLogo size="md" />
          <button
            type="button"
            onClick={async () => {
              await signOut()
              navigate('/auth', { replace: true })
            }}
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
