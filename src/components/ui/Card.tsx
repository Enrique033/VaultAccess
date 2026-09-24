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
        'surface-card rounded-2xl transition-all duration-200',
        className,
      )}
    >
      {children}
    </div>
  )
}
