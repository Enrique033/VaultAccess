import type { ReactNode } from 'react'
import { CheckCircle2, Dices, FileDown, ShieldCheck, Vault } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface AuthLayoutProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  /** Bloque opcional al pie (enlaces legales, avisos…). */
  legal?: ReactNode
}

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    text: 'Row Level Security: cada bóveda es privada por usuario.',
  },
  {
    icon: Dices,
    text: 'Generador de contraseñas y medidor de fuerza integrados.',
  },
  {
    icon: FileDown,
    text: 'Exporta tu bóveda a Excel con dashboard y detalle completo.',
  },
]

/**
 * Layout de autenticación (Login / Reset):
 * - Móvil: formulario centrado.
 * - Desktop (lg+): panel de marca a la izquierda + formulario a la derecha.
 */
export function AuthLayout({ title, subtitle, children, legal }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh bg-background">
      {/* Decoración de fondo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 size-[32rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 right-0 size-[26rem] rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Panel de marca (solo desktop) */}
      <div className="relative hidden flex-1 items-center justify-center p-12 lg:flex">
        <div className="max-w-md space-y-8">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-xl shadow-primary/30">
            <Vault className="size-7" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">
              WorkVault
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              Tu bóveda privada,
              <br />
              siempre a salvo.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Credenciales, enlaces y notas sincronizados con Supabase y
              protegidos con Row Level Security.
            </p>
          </div>
          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="flex items-start gap-3 text-sm text-muted">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Formulario */}
      <div className="relative flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-[520px] lg:border-l lg:border-border lg:bg-surface/50 lg:px-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/30 lg:hidden">
              <Vault className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            </div>
          </div>

          {children}

          {legal && <div className="space-y-3">{legal}</div>}
        </div>
      </div>
    </div>
  )
}