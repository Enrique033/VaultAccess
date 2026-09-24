import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { KeyRound, Loader2, Mail } from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { friendlyError } from '@/lib/auth-errors'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { toast } from '@/store/ui.store'

const errorBox =
  'rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger'

/**
 * Destino del enlace "¿Olvidaste tu clave?".
 * - Con sesión de recuperación activa: permite fijar la nueva clave.
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
      setError('La clave debe tener al menos 6 caracteres.')
      return
    }
    if (password !== confirm) {
      setError('La confirmación no coincide con la clave.')
      return
    }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(friendlyError(err.message))
        return
      }
      toast.success(
        'Clave actualizada',
        'Recibirás un correo de confirmación por seguridad.',
      )
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
    <AuthLayout
      title="Recuperar acceso"
      subtitle={
        status === 'signed-in'
          ? 'Elige una nueva clave para tu cuenta.'
          : 'Solicita un enlace nuevo si el tuyo caducó.'
      }
      legal={
        <p className="text-center text-xs text-muted">
          <Link to="/login" className="transition-colors hover:text-foreground">
            ← Volver a iniciar sesión
          </Link>
        </p>
      }
    >
      {!isSupabaseConfigured ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
          Supabase no está configurado: la recuperación de acceso no está
          disponible en modo local.
        </div>
      ) : status === 'loading' ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted" />
        </div>
      ) : status === 'signed-in' ? (
        <form onSubmit={handleSetPassword} className="auth-form-card">
          <div className="space-y-1.5">
            <Label htmlFor="reset-password">Nueva clave</Label>
            <PasswordInput
              id="reset-password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={setPassword}
              showStrength
              allowGenerate
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reset-confirm">Confirmar clave</Label>
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
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Guardar clave
          </Button>
        </form>
      ) : (
        <form onSubmit={handleResend} className="auth-form-card">
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
            <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success">
              ¡Listo! Te enviamos un nuevo enlace a tu correo (revisa también la
              carpeta spam).
            </p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            className="w-full"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mail className="size-4" />
            )}
            Enviar enlace
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
