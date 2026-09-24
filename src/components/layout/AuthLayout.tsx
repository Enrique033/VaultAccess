import type { ReactNode } from 'react'
import { Dices, Search, ShieldCheck, Vault } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface AuthLayoutProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  /** Bloque opcional al pie (enlaces legales, avisos…). */
  legal?: ReactNode
}

/** Beneficios de VaultAccess: qué resuelve en el día a día. */
const HIGHLIGHTS = [
  {
    icon: Search,
    title: 'Encuéntralo todo al instante',
    text: 'Busca cualquier dato, enlace o nota con Ctrl+K sin salir de la pantalla.',
    tone: 'bg-primary/15 text-primary',
    delay: '350ms',
  },
  {
    icon: Dices,
    title: 'Accesos seguros en un clic',
    text: 'Genera claves imposibles de adivinar y mide su fuerza antes de guardarlas.',
    tone: 'bg-emerald-500/15 text-emerald-500',
    delay: '470ms',
  },
  {
    icon: ShieldCheck,
    title: 'Privado desde el inicio',
    text: 'Tus accesos viven separados del chat y los datos sensibles nunca se comparten.',
    tone: 'bg-primary-soft text-primary',
    delay: '590ms',
  },
] as const

/**
 * Layout de autenticación (Login / Reset):
 * - Móvil: formulario centrado.
 * - Desktop (lg+): panel de marca a la izquierda + formulario a la derecha.
 * El panel de marca entra en cascada: logo flotante con halo pulsante,
 * titular con degradado animado y tarjetas de beneficios con hover.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  legal,
}: AuthLayoutProps) {
  return (
    <div className="auth-shell relative flex min-h-dvh">
      {/* Decoración de fondo: rejilla sutil + degradados que derivan lento */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="grid-paper absolute inset-0 opacity-70" />
        <div className="animate-drift absolute -left-32 -top-40 size-[34rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="animate-drift absolute -bottom-36 -right-20 size-[28rem] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-primary/8 to-transparent" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Panel de marca (solo desktop) */}
      <div className="relative hidden flex-1 items-center justify-center p-12 lg:flex">
        <div className="max-w-md space-y-8">
          {/* Logo flotante con halo pulsante */}
          <div
            className="animate-fade-up relative w-fit"
            style={{ animationDelay: '0ms' }}
          >
            <div
              className="animate-glow-pulse absolute inset-0 rounded-2xl bg-primary/70 blur-2xl"
              aria-hidden="true"
            />
            <span className="animate-float-soft relative flex size-14 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_18px_35px_-18px_color-mix(in_srgb,var(--c-primary)_85%,transparent)]">
              <Vault className="size-7" />
            </span>
          </div>

          <div
            className="animate-fade-up space-y-3"
            style={{ animationDelay: '120ms' }}
          >
            <span className="eyebrow">VaultAccess · espacio privado</span>
            <h1 className="animate-gradient-pan bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_200%] bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
              Tu espacio privado,
              <br />
              siempre a salvo.
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              Cuentas, enlaces y notas en un solo lugar: guardados, ordenados y
              a mano en cualquier dispositivo, cuando los necesites.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.title}
                  style={{ animationDelay: item.delay }}
                  className="animate-fade-up group flex items-start gap-3.5 rounded-2xl border border-border/70 bg-surface/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-surface hover:shadow-xl"
                >
                  <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${item.tone}`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted">
                      {item.text}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Indicador "en vivo" de sincronización */}
          <div
            className="animate-fade-up flex items-center gap-2.5 text-xs text-muted"
            style={{ animationDelay: '700ms' }}
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Sincronización en tiempo real · en tu navegador y en tu móvil
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="auth-main relative flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-[520px] lg:border-l lg:border-border lg:px-10">
        <div
          className="animate-fade-up w-full max-w-sm space-y-6"
          style={{ animationDelay: '200ms' }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_12px_24px_-16px_color-mix(in_srgb,var(--c-primary)_80%,transparent)] lg:hidden">
              <Vault className="size-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-foreground">
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
