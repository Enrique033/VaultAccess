import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatTone = 'default' | 'warning' | 'success'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: number | string
  /** Texto pequeño bajo el valor (por defecto, la etiqueta). */
  hint?: string
  tone?: StatTone
  /** Si se pasa, la tarjeta es un botón (p. ej. para filtrar). */
  onClick?: () => void
  active?: boolean
}

const TONES: Record<StatTone, string> = {
  default: 'bg-primary-soft text-primary',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
}

/** Tarjeta compacta de KPI para la cabecera de los listados. */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  onClick,
  active = false,
}: StatCardProps) {
  const content = (
    <>
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200',
          TONES[tone],
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-3xl font-extrabold tracking-[-0.05em] leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-wider text-muted">
          {hint ?? label}
        </span>
      </span>
    </>
  )

  const className = cn(
    'surface-card surface-card-hover flex items-center gap-4 rounded-2xl p-4 text-left',
    onClick && 'hover:border-border hover:bg-elevated cursor-pointer',
    active &&
      'border-primary/45 bg-primary-soft shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--c-primary)_60%,transparent)]',
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={label}
        aria-pressed={active}
        className={className}
      >
        {content}
      </button>
    )
  }

  return (
    <div title={label} className={className}>
      {content}
    </div>
  )
}
