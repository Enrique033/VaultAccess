import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { friendlyError } from '@/lib/auth-errors'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out' | 'unconfigured'

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  /** Actualiza nombre y apellido en user_metadata. */
  updateProfile: (firstName: string, lastName: string) => Promise<{ error: string | null }>
  /** Valida la clave actual y cambia por la nueva. */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<{ error: string | null }>
  /** Inicia sesión con Google (OAuth). */
  signInWithGoogle: () => Promise<{ error: string | null }>
  /** Envía un enlace de recuperación de acceso al correo indicado. */
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  )
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setStatus(data.session ? 'signed-in' : 'signed-out')
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setStatus(next ? 'signed-in' : 'signed-out')
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? friendlyError(error.message) : null }
  }

  const signUp = async (firstName: string, lastName: string, email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
        },
      },
    })
    return { error: error ? friendlyError(error.message) : null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (firstName: string, lastName: string) => {
    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName.trim(), last_name: lastName.trim() },
    })
    return { error: error ? friendlyError(error.message) : null }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const email = session?.user.email
    if (!email) return { error: 'Sin sesión activa. Vuelve a iniciar sesión.' }
    // Supabase no valida la clave actual al actualizar: la verificamos primero.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (verifyError) return { error: 'La clave actual no es correcta.' }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? friendlyError(error.message) : null }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    })
    return { error: error ? friendlyError(error.message) : null }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error ? friendlyError(error.message) : null }
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        session,
        user: session?.user ?? null,
        signIn,
        signUp,
        signOut,
        updateProfile,
        changePassword,
        signInWithGoogle,
        resetPassword,
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
