import { useState } from 'react'
import { Navigate } from 'react-router'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { Button } from '@/components/ui/Button'
import { AuthLayout } from '@/components/layout/AuthLayout'

/** Acceso principal de WorkVault: por ahora, únicamente Google OAuth. */
export function Login() {
  const { status, signInWithGoogle } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'signed-in') return <Navigate to="/credentials" replace />

  const handleGoogle = async () => {
    setError(null)
    setBusy(true)
    try {
      const { error: oauthError } = await signInWithGoogle()
      if (oauthError) setError(oauthError)
    } finally {
      setBusy(false)
    }
  }

  const unavailable = status === 'unconfigured' || status === 'loading'

  return (
    <AuthLayout
      title="WorkVault"
      subtitle="Accede con tu cuenta de Google para entrar a tu espacio privado."
    >
      {status === 'unconfigured' && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
          Supabase no está configurado. Copia{' '}
          <code className="font-mono">.env.example</code> a{' '}
          <code className="font-mono">.env</code> y completa{' '}
          <code className="font-mono">VITE_SUPABASE_URL</code> y{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
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

      <div className="auth-form-card space-y-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl border border-border bg-surface text-primary shadow-sm">
            <GoogleIcon className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Acceso con Google
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Usa el mismo correo con el que te invitaron a un equipo, si
              corresponde.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={handleGoogle}
          disabled={busy || unavailable}
          title={
            unavailable ? 'Configura Supabase para habilitar Google' : undefined
          }
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <GoogleIcon className="size-4" />
          )}
          {busy ? 'Conectando…' : 'Continuar con Google'}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-muted">
          Por ahora WorkVault no crea cuentas con correo y contraseña. La clave
          y la recuperación de acceso se administran desde Google.
        </p>
      </div>
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
        d="M12 24c3.24 0 5.98-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.11C3.25 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27c-.25-.72-.38-1.52-.38-2.27s.13-1.55.38-2.27V6.62H1.28A11.86 11.86 0 0 0 0 12c0 1.93.46 3.75 1.28 5.38l3.99-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.28 6.62l3.99 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  )
}
