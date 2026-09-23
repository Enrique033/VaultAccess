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
  default: 'bg-primary/15 text-primary',
  warning: 'bg-amber-500/15 text-amber-500',
  success: 'bg-green-500/15 text-green-500',
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
          'flex size-8 shrink-0 items-center justify-center rounded-md',
          TONES[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block truncate text-[11px] text-muted">
          {hint ?? label}
        </span>
      </span>
    </>
  )

  const className = cn(
    'flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition-colors duration-150',
    onClick && 'hover:border-primary/40 hover:bg-elevated',
    active && 'border-primary/50 bg-primary/5',
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
