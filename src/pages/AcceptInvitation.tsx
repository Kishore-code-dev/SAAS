import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { CheckCircle2, Lock, ShieldCheck, Truck, UserCheck, XCircle } from 'lucide-react'
import { BrandLogo } from '../components/ui/BrandLogo'
import { useAuth } from '../hooks/useAuth'

interface InvitationPreview {
  id: string
  targetType: 'staff' | 'driver'
  fullName: string
  email: string
  mobile: string | null
  role: string
  status: string
  expiresAt: string
  organizationName: string
  organizationCode: string
}

export function AcceptInvitation() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { refreshSession } = useAuth()

  const [loading, setLoading] = useState(true)
  const [invite, setInvite] = useState<InvitationPreview | null>(null)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Missing invitation token.')
      setLoading(false)
      return
    }
    let active = true
    void (async () => {
      try {
        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`)
        const data = await res.json()
        if (!active) return
        if (!res.ok || !data.invitation) {
          setError(data.error || 'Invitation link is invalid or expired.')
          return
        }
        const inv = data.invitation as InvitationPreview
        setInvite(inv)
        setFullName(inv.fullName)
        setUsername(inv.email.split('@')[0].replace(/[^a-z0-9._-]/gi, '').toLowerCase())
      } catch {
        if (active) setError('Unable to verify invitation right now.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [token])

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username,
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to activate account.')
        return
      }
      await refreshSession()
      navigate(data.redirectTo || (invite?.targetType === 'driver' ? '/driver' : '/dashboard'), {
        replace: true,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex justify-center mb-6">
          <BrandLogo size="sm" />
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-600">Verifying invitation...</p>
          </div>
        ) : !invite ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <XCircle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Invitation Unavailable</h1>
            <p className="text-sm text-slate-600">{error}</p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
            >
              Go to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="text-center space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
                {invite.targetType === 'driver' ? <Truck className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                {invite.targetType === 'driver' ? 'Driver Portal Invitation' : 'Fleet Staff Invitation'}
              </div>
              <h1 className="text-xl font-bold text-slate-900">Join {invite.organizationName}</h1>
              <p className="text-xs text-slate-500">Set your login credentials to activate your account.</p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Username *</label>
              <input
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Create Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars, mixed case + number + symbol"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password *</label>
              <input
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
              />
            </div>

            {invite.status !== 'pending' ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Invitation status: {invite.status}. Sign in on the login page.
              </div>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                {submitting ? 'Activating Account...' : 'Activate Account & Sign In'}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

export default AcceptInvitation
