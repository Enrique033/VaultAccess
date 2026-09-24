import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-base text-foreground shadow-sm placeholder:text-muted',
        'lg:h-10 lg:text-sm',
        'transition-all duration-150',
        'hover:border-primary/30 focus:border-primary/60 focus:outline-none focus:ring-4 focus:ring-primary/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'
