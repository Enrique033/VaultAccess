import { useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2, LockKeyhole, LogOut, ShieldCheck } from 'lucide-react'
import { useVaultKey } from '@/app/vault-key-context'
import { useAuth } from '@/app/auth-context'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { AuthLayout } from '@/components/layout/AuthLayout'

/** Pantalla intermedia: Google autentica, la frase maestra cifra el Vault. */
export function VaultUnlock() {
  const { status, error, setup, unlock } = useVaultKey()
  const { signOut } = useAuth()
  const [passphrase, setPassphrase] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const needsSetup = status === 'needs-setup'

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <AuthLayout
        title="No se pudo abrir el Vault"
        subtitle="Hay un problema con la configuración de cifrado."
      >
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger">
          {error ?? 'Error desconocido de cifrado.'}
        </div>
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => void signOut()}>
          <LogOut className="size-4" /> Cerrar sesión
        </Button>
      </AuthLayout>
    )
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)
    if (needsSetup && passphrase !== confirmation) {
      setFormError('Las frases maestras no coinciden.')
      return
    }
    setBusy(true)
    try {
      if (needsSetup) await setup(passphrase)
      else await unlock(passphrase)
      setPassphrase('')
      setConfirmation('')
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'No se pudo desbloquear el Vault.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={needsSetup ? 'Crea tu clave del Vault' : 'Desbloquea tu Vault'}
      subtitle={
        needsSetup
          ? 'Elige una frase maestra que solo tú conozcas. No se envía a Google ni a Supabase.'
          : 'Introduce tu frase maestra para descifrar tus credenciales, enlaces y notas.'
      }
    >
      <form onSubmit={submit} className="auth-form-card space-y-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
            {needsSetup ? <ShieldCheck className="size-6" /> : <LockKeyhole className="size-6" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {needsSetup ? 'Protección de extremo a extremo' : 'Vault bloqueado'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              {needsSetup
                ? 'Si la olvidas, no existe recuperación: los datos quedarían inaccesibles.'
                : 'La clave se mantiene solo en la memoria de esta pestaña.'}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vault-passphrase">Frase maestra</Label>
          <Input
            id="vault-passphrase"
            type="password"
            autoComplete={needsSetup ? 'new-password' : 'current-password'}
            minLength={12}
            required
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Mínimo 12 caracteres"
            autoFocus
          />
        </div>

        {needsSetup && (
          <div className="space-y-1.5">
            <Label htmlFor="vault-passphrase-confirm">Repite la frase maestra</Label>
            <Input
              id="vault-passphrase-confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Repite la frase"
            />
          </div>
        )}

        {(formError || error) && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger">
            {formError ?? error}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {busy
            ? 'Procesando…'
            : needsSetup
              ? 'Crear Vault cifrado'
              : 'Desbloquear Vault'}
        </Button>
      </form>
    </AuthLayout>
  )
}
