import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, rows = 3, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'flex w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-3 text-base text-foreground shadow-sm placeholder:text-muted',
        'lg:text-sm',
        'transition-all duration-150',
        'hover:border-primary/30 focus:border-primary/60 focus:outline-none focus:ring-4 focus:ring-primary/10',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
