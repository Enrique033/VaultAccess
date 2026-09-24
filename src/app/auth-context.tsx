import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { appUrl, supabase, isSupabaseConfigured } from '@/lib/supabase'
import { friendlyError } from '@/lib/auth-errors'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unconfigured'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  signOut: () => Promise<void>
  /** Actualiza nombre y apellido en user_metadata. */
  updateProfile: (
    firstName: string,
    lastName: string,
  ) => Promise<{ error: string | null }>
  /** Inicia sesión con Google (OAuth). */
  signInWithGoogle: () => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Workvaul está configurado temporalmente como Google-only. */
function hasGoogleIdentity(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.app_metadata?.provider === 'google') return true
  return (
    user.identities?.some((identity) => identity.provider === 'google') ?? false
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  )
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let mounted = true
    let invalidSessionSignOutQueued = false
    const applySession = (next: Session | null) => {
      if (!mounted) return
      if (next && !hasGoogleIdentity(next.user)) {
        setSession(null)
        setStatus('signed-out')
        if (!invalidSessionSignOutQueued) {
          invalidSessionSignOutQueued = true
          setTimeout(() => {
            void supabase.auth.signOut()
          }, 0)
        }
        return
      }
      setSession(next)
      setStatus(next ? 'signed-in' : 'signed-out')
    }

    supabase.auth.getSession().then(({ data }) => {
      applySession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, next) => {
        applySession(next)
      },
    )
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (firstName: string, lastName: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    })
    return { error: error ? friendlyError(error.message) : null }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: appUrl('/login'),
      },
    })
    return { error: error ? friendlyError(error.message) : null }
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        user: session?.user ?? null,
        signOut,
        updateProfile,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
