import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white hover:bg-primary/90 active:bg-primary/80',
        ghost: 'bg-transparent text-muted hover:bg-elevated hover:text-foreground',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-elevated hover:border-primary/40',
        danger: 'bg-red-600 text-white hover:bg-red-600/90 active:bg-red-600/80',
      },
      size: {
        sm: 'h-9 gap-1.5 px-3.5 text-[13px] sm:h-8 sm:px-3',
        md: 'h-11 gap-2 px-4 text-sm sm:h-9',
        icon: 'size-9 sm:size-8',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'sm',
    },
  },
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
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