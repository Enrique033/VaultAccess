import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Acción secundaria (enlace o botón con variante suave). */
  secondaryAction?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center rounded-3xl border border-dashed border-primary/25 bg-surface/70 px-6 py-14 text-center',
        className,
      )}
    >
      <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/15 bg-primary-soft shadow-[0_12px_24px_-18px_color-mix(in_srgb,var(--c-primary)_70%,transparent)]">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-primary/15 blur-md"
        />
        <Icon className="relative size-6 text-primary" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
      {secondaryAction && <div className="mt-2">{secondaryAction}</div>}
    </div>
  )
}
