import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../integrations/supabase/client'
import type { OrganizationRole } from '../types/fleet'

export interface DemoSessionProfile {
  fullName: string
  email: string
  role: OrganizationRole
  isDemo: boolean
}

export function validateEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

interface AuthContextType {
  user: User | null
  session: Session | null
  demoProfile: DemoSessionProfile | null
  loading: boolean
  isAuthenticated: boolean
  isCloudAuthReady: boolean
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signInWithOtp: (email: string) => Promise<{ error: Error | null }>
  verifyOtp: (email: string, token: string) => Promise<{ error: Error | null }>
  enterDemoSession: (profile: DemoSessionProfile) => void
  signOut: () => Promise<void>
}

const DEMO_PROFILE_KEY = 'dm_demo_profile_v2'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [demoProfile, setDemoProfile] = useState<DemoSessionProfile | null>(() => {
    try {
      const raw = localStorage.getItem(DEMO_PROFILE_KEY)
      return raw ? (JSON.parse(raw) as DemoSessionProfile) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(() => isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return
    }
    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (!mounted) return
        setSession(currentSession)
        setUser(currentSession?.user ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (mounted) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signUp = async (email: string, password: string, fullName: string) => {
    const cleanEmail = email.trim().toLowerCase()
    if (!validateEmailFormat(cleanEmail)) {
      return { error: new Error('Enter a valid work email address.') }
    }
    if (!password || password.length < 8) {
      return { error: new Error('Password must be at least 8 characters long.') }
    }
    if (!fullName.trim()) {
      return { error: new Error('Full name is required to create a workspace.') }
    }
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'Cloud account signup requires configured Supabase credentials. Use Instant Demo Access below to evaluate the platform.',
        ),
      }
    }
    try {
      const { error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { full_name: fullName.trim() } },
      })
      return { error: error ? new Error(error.message) : null }
    } catch {
      return { error: new Error('Unable to reach authentication service. Please verify network connectivity.') }
    }
  }

  const signIn = async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase()
    if (!validateEmailFormat(cleanEmail)) {
      return { error: new Error('Enter a valid work email address.') }
    }
    if (!password || password.length < 6) {
      return { error: new Error('Enter your password (minimum 6 characters).') }
    }
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'Live credential sign-in requires configured Supabase credentials. Use Instant Demo Access below to evaluate any role.',
        ),
      }
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      if (error) {
        return { error: new Error('Invalid email or password.') }
      }
      return { error: null }
    } catch {
      return { error: new Error('Authentication service unavailable. Please retry or use Instant Demo Access.') }
    }
  }

  const signInWithOtp = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase()
    if (!validateEmailFormat(cleanEmail)) {
      return { error: new Error('Enter a valid work email address.') }
    }
    if (!isSupabaseConfigured) {
      return {
        error: new Error(
          'Email OTP verification requires configured Supabase Auth. Use Instant Demo Access for offline evaluation.',
        ),
      }
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail })
      return { error: error ? new Error(error.message) : null }
    } catch {
      return { error: new Error('Unable to send OTP verification email right now.') }
    }
  }

  const verifyOtp = async (email: string, token: string) => {
    const cleanEmail = email.trim().toLowerCase()
    const cleanToken = token.trim()
    if (!validateEmailFormat(cleanEmail)) {
      return { error: new Error('Enter a valid email address.') }
    }
    if (!/^\d{6}$/.test(cleanToken)) {
      return { error: new Error('Enter the 6-digit verification code sent to your email.') }
    }
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase Auth is not configured for OTP verification.') }
    }
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
      })
      return { error: error ? new Error('Invalid or expired verification code.') : null }
    } catch {
      return { error: new Error('OTP verification failed. Request a new code.') }
    }
  }

  const enterDemoSession = (profile: DemoSessionProfile) => {
    setDemoProfile(profile)
    localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile))
  }

  const signOut = async () => {
    setDemoProfile(null)
    setUser(null)
    setSession(null)
    localStorage.removeItem(DEMO_PROFILE_KEY)
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut()
      } catch {
        // Ignore network errors when signing out offline/demo
      }
    }
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
        isCloudAuthReady: isSupabaseConfigured,
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
