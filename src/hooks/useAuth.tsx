import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Organization, OrganizationRole, OrganizationStatus } from '../types/fleet'

export interface AuthenticatedUser {
  id: string
  username: string
  email: string
  fullName: string
  role: OrganizationRole
  organizationId: string | null
  passwordChangeRequired: boolean
  status: string
  lastLoginAt?: string
}

export interface OrgBlockedInfo {
  status: OrganizationStatus
  reason: string
}

interface SignInResult {
  error: Error | null
  redirectTo?: string
  blocked?: OrgBlockedInfo
}

export interface RegisterTenantInput {
  organizationName: string
  city: string
  state: string
  ownerName: string
  email: string
  phone?: string
  gstin?: string
  username: string
  password: string
  planId: 'starter' | 'growth' | 'enterprise'
  billingCycle: 'monthly' | 'annual'
}

interface AuthContextType {
  user: AuthenticatedUser | null
  organization: Organization | null
  orgBlockedState: OrgBlockedInfo | null
  loading: boolean
  isAuthenticated: boolean
  passwordChangeRequired: boolean
  signIn: (username: string, password: string) => Promise<SignInResult>
  registerTenant: (input: RegisterTenantInput) => Promise<SignInResult>
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null; redirectTo?: string }>
  requestPasswordReset: (username: string) => Promise<{ error: Error | null; message?: string; recoveryTokenPreview?: string }>
  completePasswordReset: (token: string, newPassword: string) => Promise<{ error: Error | null; message?: string }>
  refreshSession: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [orgBlockedState, setOrgBlockedState] = useState<OrgBlockedInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const data = await safeJson(res)
      if (res.status === 403 && data.code === 'ORG_ACCESS_BLOCKED') {
        setUser(null)
        setOrganization(null)
        setOrgBlockedState({
          status: (data.orgStatus as OrganizationStatus) ?? 'suspended',
          reason: String(data.reason || data.error || 'Organization access suspended.'),
        })
        return
      }
      if (!res.ok || !data.authenticated) {
        setUser(null)
        setOrganization(null)
        return
      }

      setOrgBlockedState(null)
      setUser({
        id: String(data.id),
        username: String(data.username),
        email: String(data.email),
        fullName: String(data.fullName),
        role: data.role as OrganizationRole,
        organizationId: data.organizationId ? String(data.organizationId) : null,
        passwordChangeRequired: Boolean(data.passwordChangeRequired),
        status: String(data.status ?? 'active'),
        lastLoginAt: data.lastLoginAt ? String(data.lastLoginAt) : undefined,
      })
      setOrganization((data.organization as Organization | null) ?? null)
    } catch {
      // Offline / unit-test JSDOM fallback: stay cleanly unauthenticated
      setUser(null)
      setOrganization(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void refreshSession()
    })
  }, [refreshSession])

  const signIn = async (username: string, password: string): Promise<SignInResult> => {
    setOrgBlockedState(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        if (res.status === 403 && data.code === 'ORG_ACCESS_BLOCKED') {
          const blocked: OrgBlockedInfo = {
            status: (data.orgStatus as OrganizationStatus) ?? 'suspended',
            reason: String(data.reason || data.error || 'Organization access has been paused.'),
          }
          setOrgBlockedState(blocked)
          return { error: new Error(String(data.error || blocked.reason)), blocked }
        }
        return { error: new Error(String(data.error || 'Invalid username or password.')) }
      }

      const nextUser: AuthenticatedUser = {
        id: String(data.id),
        username: String(data.username),
        email: String(data.email),
        fullName: String(data.fullName),
        role: data.role as OrganizationRole,
        organizationId: data.organizationId ? String(data.organizationId) : null,
        passwordChangeRequired: Boolean(data.passwordChangeRequired),
        status: String(data.status ?? 'active'),
        lastLoginAt: data.lastLoginAt ? String(data.lastLoginAt) : undefined,
      }
      setUser(nextUser)
      setOrganization((data.organization as Organization | null) ?? null)
      setOrgBlockedState(null)
      window.dispatchEvent(new CustomEvent('dm-auth-session', { detail: { user: nextUser } }))
      return {
        error: null,
        redirectTo: typeof data.redirectTo === 'string' ? data.redirectTo : '/dashboard',
      }
    } catch {
      return { error: new Error('Unable to reach authentication server. Verify the server is running.') }
    }
  }

  const registerTenant = async (input: RegisterTenantInput): Promise<SignInResult> => {
    setOrgBlockedState(null)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        return { error: new Error(String(data.error || 'Unable to create SaaS workspace.')) }
      }

      const nextUser: AuthenticatedUser = {
        id: String(data.id),
        username: String(data.username),
        email: String(data.email),
        fullName: String(data.fullName),
        role: data.role as OrganizationRole,
        organizationId: data.organizationId ? String(data.organizationId) : null,
        passwordChangeRequired: Boolean(data.passwordChangeRequired),
        status: String(data.status ?? 'active'),
        lastLoginAt: data.lastLoginAt ? String(data.lastLoginAt) : undefined,
      }
      setUser(nextUser)
      setOrganization((data.organization as Organization | null) ?? null)
      setOrgBlockedState(null)
      window.dispatchEvent(new CustomEvent('dm-auth-session', { detail: { user: nextUser } }))
      return {
        error: null,
        redirectTo: typeof data.redirectTo === 'string' ? data.redirectTo : '/dashboard',
      }
    } catch {
      return { error: new Error('Unable to reach onboarding server. Verify the server is running.') }
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        return { error: new Error(String(data.error || 'Unable to update password.')) }
      }
      const nextUser: AuthenticatedUser = {
        id: String(data.id),
        username: String(data.username),
        email: String(data.email),
        fullName: String(data.fullName),
        role: data.role as OrganizationRole,
        organizationId: data.organizationId ? String(data.organizationId) : null,
        passwordChangeRequired: false,
        status: String(data.status ?? 'active'),
        lastLoginAt: data.lastLoginAt ? String(data.lastLoginAt) : undefined,
      }
      setUser(nextUser)
      setOrganization((data.organization as Organization | null) ?? null)
      window.dispatchEvent(new CustomEvent('dm-auth-session', { detail: { user: nextUser } }))
      return {
        error: null,
        redirectTo: typeof data.redirectTo === 'string' ? data.redirectTo : '/dashboard',
      }
    } catch {
      return { error: new Error('Unable to connect to password update service.') }
    }
  }

  const requestPasswordReset = async (username: string) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        return { error: new Error(String(data.error || 'Unable to issue password reset token.')) }
      }
      return {
        error: null,
        message: String(data.message || 'Recovery instructions issued.'),
        recoveryTokenPreview:
          typeof data.recoveryTokenPreview === 'string' ? data.recoveryTokenPreview : undefined,
      }
    } catch {
      return { error: new Error('Unable to reach password recovery endpoint.') }
    }
  }

  const completePasswordReset = async (token: string, newPassword: string) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), newPassword }),
      })
      const data = await safeJson(res)
      if (!res.ok) {
        return { error: new Error(String(data.error || 'Unable to reset password.')) }
      }
      return {
        error: null,
        message: String(data.message || 'Password updated successfully.'),
      }
    } catch {
      return { error: new Error('Unable to reach password reset endpoint.') }
    }
  }

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // ignore offline logout
    }
    setUser(null)
    setOrganization(null)
    setOrgBlockedState(null)
    window.dispatchEvent(new Event('dm-auth-signout'))
  }

  const isAuthenticated = Boolean(user)
  const passwordChangeRequired = Boolean(user?.passwordChangeRequired)

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        orgBlockedState,
        loading,
        isAuthenticated,
        passwordChangeRequired,
        signIn,
        registerTenant,
        changePassword,
        requestPasswordReset,
        completePasswordReset,
        refreshSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
