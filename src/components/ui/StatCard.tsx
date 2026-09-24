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
  default: 'bg-violet-100 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-500',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-500',
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
          'flex size-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-200',
          TONES[tone],
        )}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-3xl font-extrabold tracking-tight leading-none text-foreground">
          {value}
        </span>
        <span className="mt-1 block truncate text-[11px] font-bold uppercase tracking-wider text-muted">
          {hint ?? label}
        </span>
      </span>
    </>
  )

  const className = cn(
    'flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-200 shadow-sm',
    onClick && 'hover:border-border hover:bg-elevated cursor-pointer',
    active && 'border-violet-500 bg-violet-50/50 shadow-md dark:border-violet-500/50 dark:bg-violet-500/10',
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
