import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileSpreadsheet, LogOut, ShieldCheck, User, Users } from 'lucide-react'
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
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useAuth } from '@/app/auth-context'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { exportVaultToExcel } from '@/lib/vault-excel'
import { usePresenceContext } from '@/hooks/usePresence'

const errorBox =
  'rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger'

export function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { globalOnline, isGlobalOwner } = usePresenceContext()
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  if (!user) return null

  const meta = user.user_metadata as
    { first_name?: string; last_name?: string } | undefined
  const name =
    (typeof meta?.first_name === 'string' && meta.first_name.trim()) ||
    user.email?.split('@')[0] ||
    'Mi cuenta'

  const handleSignOut = async () => {
    setBusy(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
      toast.show('Sesión cerrada')
    } finally {
      setBusy(false)
    }
  }

  const handleExport = async () => {
    try {
      const state = useVaultStore.getState()
      await exportVaultToExcel({
        sections: state.sections,
        categories: state.categories,
        credentials: state.credentials,
        links: state.links,
        notes: state.notes,
      })
      toast.success(
        'Datos exportados a Excel',
        'El archivo contiene tus claves en texto plano: guárdalo en un lugar seguro.',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar')
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
        <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
          <ShieldCheck className="size-3.5" /> Cambiar clave
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleExport()}>
          <FileSpreadsheet className="size-3.5" /> Exportar a Excel…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onClick={handleSignOut}>
          <LogOut className="size-3.5" /> {busy ? 'Saliendo…' : 'Cerrar sesión'}
        </DropdownMenuItem>
      </DropdownMenu>

      {profileOpen && <ProfileDialog onOpenChange={setProfileOpen} />}
      {passwordOpen && <PasswordDialog onOpenChange={setPasswordOpen} />}
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

/** Dialog para cambiar clave: valida la actual y confirma la nueva. */
function PasswordDialog({
  onOpenChange,
}: {
  onOpenChange: (o: boolean) => void
}) {
  const { changePassword } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (next.length < 6) {
      setError('La nueva clave debe tener al menos 6 caracteres.')
      return
    }
    if (next !== confirm) {
      setError('La confirmación no coincide con la nueva clave.')
      return
    }
    setBusy(true)
    const { error: err } = await changePassword(current, next)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    toast.success(
      'Clave actualizada',
      'Recibirás un correo de confirmación por seguridad.',
    )
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange} className="max-w-md">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Cambiar clave</DialogTitle>
          <DialogDescription>
            Introduce tu clave actual y la nueva.
          </DialogDescription>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password-current">Clave actual</Label>
            <Input
              id="password-current"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-new">Nueva clave</Label>
            <PasswordInput
              id="password-new"
              autoComplete="new-password"
              required
              minLength={6}
              value={next}
              onChange={setNext}
              showStrength
              allowGenerate
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password-confirm">Confirmar nueva clave</Label>
            <Input
              id="password-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
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
            {busy ? 'Actualizando…' : 'Cambiar clave'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
