import React, { createContext, useContext, useState } from 'react'
import type { OrganizationRole } from '../types/fleet'
import {
  authenticateLocalAccount,
  issueLocalOtpChallenge,
  type LocalAccountRecord,
  type LocalAuthSession,
  type LocalAuthUser,
  type LocalOtpChallenge,
  registerLocalAccount,
  toLocalAuthUser,
  validateEmailFormat,
  verifyLocalOtpChallenge,
} from '../utils/localAuth'

export { validateEmailFormat }

export interface DemoSessionProfile {
  fullName: string
  email: string
  role: OrganizationRole
  isDemo: boolean
}

interface AuthContextType {
  user: LocalAuthUser | null
  session: LocalAuthSession | null
  demoProfile: DemoSessionProfile | null
  loading: boolean
  isAuthenticated: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null; otpCode?: string }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  enterDemoSession: (profile: DemoSessionProfile) => void
  signOut: () => Promise<void>
}

const DEMO_PROFILE_KEY = 'dm_demo_profile_v2'
const LOCAL_ACCOUNTS_KEY = 'dm_local_accounts_v1'
const LOCAL_SESSION_KEY = 'dm_local_session_v1'
const LOCAL_OTP_KEY = 'dm_local_otp_v1'

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<LocalAuthSession | null>(() =>
    readJsonStorage<LocalAuthSession | null>(LOCAL_SESSION_KEY, null),
  )
  const [user, setUser] = useState<LocalAuthUser | null>(() => session?.user ?? null)
  const [demoProfile, setDemoProfile] = useState<DemoSessionProfile | null>(() =>
    readJsonStorage<DemoSessionProfile | null>(DEMO_PROFILE_KEY, null),
  )
  const [loading] = useState(false)

  const persistLocalSession = (nextUser: LocalAuthUser) => {
    const nextSession: LocalAuthSession = {
      access_token: `local-session-${Date.now()}`,
      user: nextUser,
      issuedAt: new Date().toISOString(),
    }
    setSession(nextSession)
    setUser(nextUser)
    setDemoProfile(null)
    localStorage.removeItem(DEMO_PROFILE_KEY)
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(nextSession))
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    const accounts = readJsonStorage<LocalAccountRecord[]>(LOCAL_ACCOUNTS_KEY, [])
    const res = registerLocalAccount(accounts, { email, password, fullName })
    if (res.error || !res.account) {
      return { error: new Error(res.error ?? 'Unable to create account.') }
    }
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(res.accounts))
    return { error: null }
  }

  const signIn = async (email: string, password: string) => {
    const accounts = readJsonStorage<LocalAccountRecord[]>(LOCAL_ACCOUNTS_KEY, [])
    const res = authenticateLocalAccount(accounts, { email, password })
    if (res.error || !res.account) {
      return { error: new Error(res.error ?? 'Invalid email or password.') }
    }
    persistLocalSession(toLocalAuthUser(res.account))
    return { error: null }
  }

  const signInWithOtp = async (email: string) => {
    const challenges = readJsonStorage<LocalOtpChallenge[]>(LOCAL_OTP_KEY, [])
    const res = issueLocalOtpChallenge(challenges, email)
    if (res.error || !res.challenge) {
      return { error: new Error(res.error ?? 'Unable to generate verification code.') }
    }
    localStorage.setItem(LOCAL_OTP_KEY, JSON.stringify(res.challenges))
    return { error: null, otpCode: res.challenge.code }
  }

  const verifyOtp = async (email: string, token: string) => {
    const challenges = readJsonStorage<LocalOtpChallenge[]>(LOCAL_OTP_KEY, [])
    const accounts = readJsonStorage<LocalAccountRecord[]>(LOCAL_ACCOUNTS_KEY, [])
    const res = verifyLocalOtpChallenge(challenges, accounts, { email, token })
    if (res.error || !res.user) {
      return { error: new Error(res.error ?? 'Invalid or expired verification code.') }
    }
    localStorage.setItem(LOCAL_OTP_KEY, JSON.stringify(res.challenges))
    persistLocalSession(res.user)
    return { error: null }
  }

  const enterDemoSession = (profile: DemoSessionProfile) => {
    setDemoProfile(profile)
    setUser(null)
    setSession(null)
    localStorage.removeItem(LOCAL_SESSION_KEY)
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile))
  }

  const signOut = async () => {
    setDemoProfile(null)
    setUser(null)
    setSession(null)
    localStorage.removeItem(DEMO_PROFILE_KEY)
    localStorage.removeItem(LOCAL_SESSION_KEY)
    localStorage.removeItem('dm_active_role_v2')
    localStorage.removeItem('dm_active_org_v2')
    window.dispatchEvent(new Event('dm-auth-signout'))
  }

  const isAuthenticated = Boolean(user || demoProfile)

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        demoProfile,
        loading,
        isAuthenticated,
        signUp,
        signIn,
        signInWithOtp,
        verifyOtp,
        enterDemoSession,
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
