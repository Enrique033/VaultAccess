import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function Dialog({ open, onOpenChange, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-fade-in relative z-10 w-full max-w-lg rounded-lg border border-border bg-surface shadow-2xl',
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

interface DialogSectionProps {
  children: ReactNode
  className?: string
}

export function DialogHeader({ children, className }: DialogSectionProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-border px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function DialogTitle({ children, className }: DialogSectionProps) {
  return (
    <h2 className={cn('text-sm font-semibold text-foreground', className)}>
      {children}
    </h2>
  )
}

export function DialogDescription({ children, className }: DialogSectionProps) {
  return (
    <p className={cn('mt-0.5 text-xs text-muted', className)}>{children}</p>
  )
}

export function DialogContent({ children, className }: DialogSectionProps) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}

export function DialogFooter({ children, className }: DialogSectionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border px-5 py-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md p-1 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground"
      aria-label="Cerrar"
    >
      <X className="size-4" />
    </button>
  )
}