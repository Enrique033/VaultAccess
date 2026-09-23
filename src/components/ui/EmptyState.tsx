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
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="relative flex size-11 items-center justify-center rounded-xl border border-border bg-elevated">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-primary/15 blur-md"
        />
        <Icon className="relative size-5 text-primary" />
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