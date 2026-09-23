import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { KeyRound, Loader2, Mail, Vault } from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { friendlyError } from '@/lib/auth-errors'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { toast } from '@/store/ui.store'

const errorBox =
  'rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300'

/**
 * Destino del enlace "¿Olvidaste tu contraseña?".
 * - Con sesión de recuperación activa: permite fijar la nueva contraseña.
 * - Sin sesión (enlace caducado): permite solicitar uno nuevo.
 */
export function ResetPassword() {
  const { status, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('La confirmación no coincide con la contraseña.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(friendlyError(err.message))
        return
      }
      toast.success('Contraseña actualizada')
      navigate('/credentials', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  const handleResend = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(false)
    setBusy(true)
    try {
      const { error: err } = await resetPassword(email.trim())
      if (err) {
        setError(err)
        return
      }
      setSent(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
            <Vault className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Restablecer contraseña
            </h1>
            <p className="mt-1 text-sm text-muted">
              {status === 'signed-in'
                ? 'Elige una nueva contraseña para tu cuenta.'
                : 'Solicita un enlace nuevo si el tuyo caducó.'}
            </p>
          </div>
        </div>

        {!isSupabaseConfigured ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-200">
            Supabase no está configurado: la recuperación de contraseña no está
            disponible en modo local.
          </div>
        ) : status === 'loading' ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted" />
          </div>
        ) : status === 'signed-in' ? (
          <form
            onSubmit={handleSetPassword}
            className="space-y-4 rounded-xl border border-border bg-surface p-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">Nueva contraseña</Label>
              <Input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm">Confirmar contraseña</Label>
              <Input
                id="reset-confirm"
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
            <Button type="submit" variant="primary" disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              Guardar contraseña
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleResend}
            className="space-y-4 rounded-xl border border-border bg-surface p-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Correo</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </div>
            {error && (
              <p role="alert" className={errorBox}>
                {error}
              </p>
            )}
            {sent && !error && (
              <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
                ¡Listo! Te enviamos un nuevo enlace a tu correo (revisa también la
                carpeta spam).
              </p>
            )}
            <Button type="submit" variant="primary" disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Enviar enlace
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted">
          <Link to="/login" className="transition-colors hover:text-foreground">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}