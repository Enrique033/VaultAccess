import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.01em] transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-white shadow-[0_10px_22px_-14px_color-mix(in_srgb,var(--c-primary)_75%,transparent)] hover:bg-primary-hover hover:shadow-[0_14px_26px_-14px_color-mix(in_srgb,var(--c-primary)_80%,transparent)]',
        ghost:
          'bg-transparent text-muted hover:bg-elevated hover:text-foreground',
        outline:
          'border border-border bg-surface/70 text-foreground shadow-sm hover:border-primary/35 hover:bg-primary-soft hover:text-primary',
        danger:
          'bg-danger text-white shadow-[0_10px_22px_-16px_color-mix(in_srgb,var(--c-danger)_80%,transparent)] hover:brightness-95',
      },
      size: {
        sm: 'h-9 gap-1.5 px-3.5 text-[13px] sm:h-8 sm:px-3',
        md: 'h-11 gap-2 px-4 text-sm sm:h-10',
        icon: 'size-9 sm:size-9',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'sm',
    },
  },
)

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'
