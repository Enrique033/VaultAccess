import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-xs font-medium text-muted', className)}
      {...props}
    />
  )
}