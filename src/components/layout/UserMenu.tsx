import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Archive,
  FileSpreadsheet,
  KeyRound,
  LogOut,
  User,
  Users,
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { useAuth } from '@/app/auth-context'
import { useVaultKey } from '@/app/vault-key-context'
import { useVaultStore } from '@/store/vault.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { useChatStore } from '@/store/chat.store'
import { useNotificationStore } from '@/store/notification.store'
import { toast } from '@/store/ui.store'
import { usePresenceContext } from '@/hooks/usePresence'
import { SecureExportDialog } from '@/components/security/SecureExportDialog'
import { RecoveryKeyDialog } from '@/components/security/RecoveryKeyDialog'
import { ArchivedColumnsDialog } from './ArchivedColumnsDialog'

const errorBox =
  'rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const { lock } = useVaultKey()
  const navigate = useNavigate()
  const { globalOnline, isGlobalOwner } = usePresenceContext()
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)

  if (!user) return null

  const meta = user.user_metadata as
    { first_name?: string; last_name?: string } | undefined
  const name =
    (typeof meta?.first_name === 'string' && meta.first_name.trim()) ||
    user.email?.split('@')[0] ||
    'Mi cuenta'

  const handleSignOut = async () => {
    setBusy(true)
    lock()
    try {
      await signOut()
      useVaultStore.getState().reset()
      useWorkspaceStore.getState().reset()
      useChatStore.getState().reset()
      useNotificationStore.getState().reset()
      navigate('/login', { replace: true })
      toast.show('Sesión cerrada')
    } finally {
      setBusy(false)
    }
  }

  /*
    La exportación se hace desde un diálogo que cifra la copia por defecto.
    `collect` reutiliza el mismo estado ya descifrado que hay en memoria, así
    que no hay que volver a consultar Supabase ni a decryptar de nuevo.
  */
  const collectForExport = async () => {
    const before = useVaultStore.getState()
    if (before.linksLoading || before.notesLoading) {
      toast.error('Espera a que terminen de cargar enlaces y notas.')
      throw new Error('Carga en curso.')
    }
    await Promise.all([
      useVaultStore.getState().loadLinks(),
      useVaultStore.getState().loadNotes(),
    ])
    const state = useVaultStore.getState()
    if (state.linksError || state.notesError) {
      throw new Error(
        state.linksError ?? state.notesError ?? 'No se pudieron cargar todos los datos.',
      )
    }
    return {
      sections: state.sections,
      categories: state.categories,
      credentials: state.credentials,
      links: state.links,
      notes: state.notes,
    }
  }

  return (
    <>
      <DropdownMenu
        contentClassName="max-h-[calc(100dvh-var(--header-height)-1rem)] w-[min(15rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain"
        trigger={
          <span
            title={user.email ?? 'Mi cuenta'}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-foreground transition-colors"
          >
            <span className="hidden max-w-28 truncate font-medium sm:inline">
              {name}
            </span>
            <span className="relative flex size-6 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <User className="size-3.5" />
            </span>
          </span>
        }
      >
        <div className="px-3 py-1.5">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {[meta?.first_name, meta?.last_name].filter(Boolean).join(' ') ||
              name}
          </p>
          <p className="truncate text-[11px] text-muted">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        {isGlobalOwner && globalOnline !== null && (
          <>
            <div
              role="status"
              className="mx-1 my-1 flex items-center gap-2 rounded-xl border border-primary/15 bg-primary-soft/70 px-2.5 py-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
                <Users className="size-3" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-4 text-foreground">
                  Global Online
                </p>
                <p className="text-[9px] leading-3 text-muted">
                  Usuarios conectados
                </p>
              </div>
              <span
                className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white shadow-sm"
                aria-label={`${globalOnline} usuarios conectados`}
              >
                {globalOnline}
              </span>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => setProfileOpen(true)}>
          <User className="size-3.5" /> Editar perfil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setArchivedOpen(true)}>
          <Archive className="size-3.5" /> Archivados…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setExportOpen(true)}>
          <FileSpreadsheet className="size-3.5" /> Exportar copia cifrada…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setRecoveryOpen(true)}>
          <KeyRound className="size-3.5" /> Clave de recuperación…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onClick={handleSignOut}>
          <LogOut className="size-3.5" /> {busy ? 'Saliendo…' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenu>

      {profileOpen && <ProfileDialog onOpenChange={setProfileOpen} />}
      {archivedOpen && (
        <ArchivedColumnsDialog open onOpenChange={setArchivedOpen} />
      )}
      {exportOpen && (
        <SecureExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          collect={collectForExport}
        />
      )}
      {recoveryOpen && (
        <RecoveryKeyDialog
          open={recoveryOpen}
          onOpenChange={setRecoveryOpen}
        />
      )}
    </>
  )
}

/** Dialog para editar nombre y apellido (user_metadata). */
function ProfileDialog({
  onOpenChange,
}: {
  onOpenChange: (o: boolean) => void
}) {
  const { user, updateProfile } = useAuth()
  const meta = user?.user_metadata as
    { first_name?: string; last_name?: string } | undefined
  const [firstName, setFirstName] = useState(meta?.first_name ?? '')
  const [lastName, setLastName] = useState(meta?.last_name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('El nombre y el apellido son obligatorios.')
      return
    }
    setBusy(true)
    const { error: err } = await updateProfile(firstName, lastName)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    toast.success('Perfil actualizado')
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange} className="max-w-md">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>Actualiza tu nombre y apellido.</DialogDescription>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-firstname">Nombre</Label>
            <Input
              id="profile-firstname"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-lastname">Apellido</Label>
            <Input
              id="profile-lastname"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Correo</Label>
            <Input id="profile-email" value={user?.email ?? ''} disabled />
          </div>
          {error && (
            <p role="alert" className={errorBox}>
              {error}
            </p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
