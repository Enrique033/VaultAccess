import type { ReactNode } from 'react'
import { Dices, FileSpreadsheet, Search, Vault } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

interface AuthLayoutProps {
  title: string
  subtitle: ReactNode
  children: ReactNode
  /** Bloque opcional al pie (enlaces legales, avisos…). */
  legal?: ReactNode
}

/** Beneficios de WorkVault: qué resuelve en el día a día. */
const HIGHLIGHTS = [
  {
    icon: Search,
    title: 'Encuéntralo todo al instante',
    text: 'Busca cualquier contraseña, enlace o nota con Ctrl+K sin salir de la pantalla.',
    tone: 'bg-primary/15 text-primary',
    delay: '350ms',
  },
  {
    icon: Dices,
    title: 'Contraseñas fuertes en un clic',
    text: 'Genera claves imposibles de adivinar y mide su fuerza antes de guardarlas.',
    tone: 'bg-emerald-500/15 text-emerald-500',
    delay: '470ms',
  },
  {
    icon: FileSpreadsheet,
    title: 'Llévate tu bóveda a Excel',
    text: 'Exporta todo con un dashboard de KPIs y el detalle completo en un solo archivo.',
    tone: 'bg-amber-500/15 text-amber-500',
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
export function AuthLayout({ title, subtitle, children, legal }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-dvh bg-background">
      {/* Decoración de fondo: rejilla sutil + degradados que derivan lento */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle,_currentColor_1px,_transparent_1px)] text-foreground/[0.04] [background-size:24px_24px]" />
        <div className="animate-drift absolute -left-32 -top-40 size-[34rem] rounded-full bg-primary/15 blur-3xl" />
        <div
          className="animate-drift absolute -bottom-36 -right-20 size-[28rem] rounded-full bg-fuchsia-500/10 blur-3xl"
          style={{ animationDelay: '-10s' }}
        />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      </div>

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      {/* Panel de marca (solo desktop) */}
      <div className="relative hidden flex-1 items-center justify-center p-12 lg:flex">
        <div className="max-w-md space-y-7">
          {/* Logo flotante con halo pulsante */}
          <div className="animate-fade-up relative w-fit" style={{ animationDelay: '0ms' }}>
            <div
              className="animate-glow-pulse absolute inset-0 rounded-2xl bg-primary/70 blur-2xl"
              aria-hidden="true"
            />
            <span className="animate-float-soft relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-400 text-white shadow-xl shadow-primary/40">
              <Vault className="size-7" />
            </span>
          </div>

          <div className="animate-fade-up space-y-3" style={{ animationDelay: '120ms' }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
              WorkVault
            </span>
            <h1 className="animate-gradient-pan bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_200%] bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
              Tu bóveda privada,
              <br />
              siempre a salvo.
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              Contraseñas, enlaces y notas en un solo lugar: guardados, ordenados
              y a mano en cualquier dispositivo, cuando los necesites.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon
              return (
                <li
                  key={item.title}
                  style={{ animationDelay: item.delay }}
                  className="animate-fade-up group flex items-start gap-3.5 rounded-xl border border-border/70 bg-surface/60 p-3.5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-surface hover:shadow-lg hover:shadow-primary/10"
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
      <div className="relative flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-[520px] lg:border-l lg:border-border lg:bg-surface/50 lg:px-10">
        <div
          className="animate-fade-up w-full max-w-sm space-y-6"
          style={{ animationDelay: '200ms' }}
        >
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
