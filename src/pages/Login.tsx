import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router'
import { KeyRound, Loader2, Mail } from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from '@/components/layout/AuthLayout'

type Mode = 'signin' | 'signup' | 'forgot'

export function Login() {
  const { status, signIn, signUp, signInWithGoogle, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (status === 'signed-in') return <Navigate to="/credentials" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSent(false)
    if (mode === 'forgot') {
      setBusy(true)
      try {
        const { error: resetErr } = await resetPassword(email.trim())
        if (resetErr) {
          setError(resetErr)
          return
        }
        setSent(true)
      } finally {
        setBusy(false)
      }
      return
    }
    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      setError('El nombre y el apellido son obligatorios.')
      return
    }
    setBusy(true)
    try {
      const { error: authError } =
        mode === 'signin'
          ? await signIn(email.trim(), password)
          : await signUp(firstName, lastName, email.trim(), password)
      if (authError) {
        setError(authError)
        return
      }
      if (mode === 'signup') {
        // Si Supabase exige confirmación por correo, no hay sesión todavía.
        setSent(true)
      }
    } finally {
      setBusy(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setBusy(true)
    try {
      const { error: oauthErr } = await signInWithGoogle()
      if (oauthErr) setError(oauthErr)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="WorkVault"
      subtitle={
        mode === 'signin'
          ? 'Inicia sesión para acceder a tu espacio privado.'
          : mode === 'signup'
            ? 'Crea tu cuenta. Tu espacio será solo tuyo.'
            : 'Escribe tu correo y te enviaremos un enlace para recuperar tu acceso.'
      }
    >
      {status === 'unconfigured' && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
          Supabase no está configurado. Copia{' '}
          <code className="font-mono">.env.example</code> a{' '}
          <code className="font-mono">.env</code> y completa{' '}
          <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>. Mientras
          tanto puedes entrar en modo local (tus datos no saldrán de este
          navegador).
        </div>
      )}

      <form onSubmit={submit} className="auth-form-card">
        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-firstname">Nombre</Label>
              <Input
                id="login-firstname"
                type="text"
                autoComplete="given-name"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ana"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-lastname">Apellido</Label>
              <Input
                id="login-lastname"
                type="text"
                autoComplete="family-name"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
              />
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Correo</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </div>
        {mode !== 'forgot' && (
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Clave de acceso</Label>
            {mode === 'signup' ? (
              <PasswordInput
                id="login-password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={setPassword}
                showStrength
                allowGenerate
              />
            ) : (
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            )}
            {mode === 'signin' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                  setSent(false)
                }}
                className="block w-full text-right text-[11px] text-muted transition-colors hover:text-foreground"
              >
                ¿Olvidaste tu clave?
              </button>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger"
          >
            {error}
          </p>
        )}
        {sent && !error && (
          <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-xs text-success">
            {mode === 'forgot'
              ? '¡Listo! Te enviamos un enlace a tu correo para recuperar el acceso (revisa también la carpeta spam).'
              : 'Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.'}
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
          ) : mode === 'forgot' ? (
            <Mail className="size-4" />
          ) : (
            <KeyRound className="size-4" />
          )}
          {mode === 'signin'
            ? 'Entrar'
            : mode === 'signup'
              ? 'Crear cuenta'
              : 'Enviar enlace'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setSent(false)
          }}
          className="w-full text-center text-xs text-muted transition-colors hover:text-foreground"
        >
          {mode === 'signin'
            ? '¿No tienes cuenta? Crear una'
            : '¿Ya tienes cuenta? Iniciar sesión'}
        </button>

        {mode !== 'forgot' && (
          <>
            <div className="auth-divider my-1">
              <span>o continúa con</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleGoogle}
              disabled={busy || status === 'unconfigured'}
              title={
                status === 'unconfigured'
                  ? 'Configura Supabase para habilitar Google'
                  : undefined
              }
            >
              <GoogleIcon className="size-4" />
              Continuar con Google
            </Button>
          </>
        )}
      </form>
    </AuthLayout>
  )
}

/** Icono oficial de Google (lucide no incluye marcas). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45c-.28 1.5-1.13 2.77-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.62H1.28A11.86 11.86 0 0 0 0 12c0 1.93.46 3.75 1.28 5.38l3.99-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.62l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}
