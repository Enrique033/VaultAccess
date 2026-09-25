import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { useVaultKey } from '@/app/vault-key-context'
import { VaultUnlock } from '@/components/security/VaultUnlock'
import { useVaultStore } from '@/store/vault.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useChatStore } from '@/store/chat.store'
import { useNotificationStore } from '@/store/notification.store'

/** Protege rutas: sin sesión redirige a /login. */
export function RequireAuth() {
  const { status, user } = useAuth()
  const { status: keyStatus, sessionUserId } = useVaultKey()
  const authUserId = user?.id ?? null
  const vaultUnavailable =
    status === 'signed-in' &&
    (keyStatus !== 'unlocked' || sessionUserId !== authUserId)

  useEffect(() => {
    if (status === 'signed-out' || vaultUnavailable) {
      useVaultStore.getState().reset()
      useWorkspaceStore.getState().reset()
      useChatStore.getState().reset()
      useNotificationStore.getState().reset()
    }
  }, [status, vaultUnavailable])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    )
  }

  if (status === 'signed-out') return <Navigate to="/login" replace />
  // Sin Supabase configurado: modo local de desarrollo (sin login).
  if (status === 'unconfigured') return <Outlet />

  if (keyStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    )
  }
  if (keyStatus !== 'unlocked' || sessionUserId !== authUserId) return <VaultUnlock />

  return <Outlet />
}
