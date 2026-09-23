import { Navigate, Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/auth-context'

/** Protege rutas: sin sesión redirige a /login. */
export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    )
  }

  // Sin Supabase configurado: modo local de desarrollo (sin login).
  if (status === 'unconfigured') return <Outlet />

  if (status === 'signed-out') return <Navigate to="/login" replace />

  return <Outlet />
}
