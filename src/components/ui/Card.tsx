import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      data-card="true"
      className={cn(
        'rounded-2xl border border-border bg-surface transition-all duration-200 hover:border-border dark:border-border dark:bg-surface dark:backdrop-blur-sm dark:hover:border-border',
        className,
      )}
    >
      {children}
    </div>
  )
}
