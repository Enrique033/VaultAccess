import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  className?: string
}

/**
 * Cuenta de diálogos abiertos. Si uno se cierra mientras otro sigue abierto,
 * no hay que restaurar el scroll todavía.
 */
let openDialogs = 0
let lockedOverflow = ''

function lockBodyScroll() {
  if (openDialogs === 0) {
    lockedOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  openDialogs += 1
}

function unlockBodyScroll() {
  openDialogs = Math.max(0, openDialogs - 1)
  if (openDialogs === 0) document.body.style.overflow = lockedOverflow
}

export function Dialog({
  open,
  onOpenChange,
  children,
  className,
}: DialogProps) {
  const onOpenChangeRef = useRef(onOpenChange)
  onOpenChangeRef.current = onOpenChange

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChangeRef.current(false)
    }

    document.addEventListener('keydown', onKeyDown)
    lockBodyScroll()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      unlockBodyScroll()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChangeRef.current(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-fade-in relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface shadow-[0_28px_80px_-30px_color-mix(in_srgb,var(--c-foreground)_55%,transparent)]',
          'sm:max-h-[85dvh] sm:rounded-3xl',
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
        'flex items-start justify-between gap-4 border-b border-border/80 px-5 py-4 sm:px-6 sm:py-5',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function DialogTitle({ children, className }: DialogSectionProps) {
  return (
    <h2
      className={cn(
        'text-base font-bold tracking-tight text-foreground',
        className,
      )}
    >
      {children}
    </h2>
  )
}

export function DialogDescription({ children, className }: DialogSectionProps) {
  return (
    <p className={cn('mt-1 text-[13px] leading-relaxed text-muted', className)}>
      {children}
    </p>
  )
}

export function DialogContent({ children, className }: DialogSectionProps) {
  return <div className={cn('px-5 py-5 sm:px-6', className)}>{children}</div>
}

export function DialogFooter({ children, className }: DialogSectionProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border/80 bg-elevated/40 px-5 py-3.5 sm:px-6',
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
      className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground"
      aria-label="Cerrar"
    >
      <X className="size-4" />
    </button>
  )
}
