import { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'
import { useUIStore, type Toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS = 3500

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useUIStore((s) => s.removeToast)

  useEffect(() => {
    const timer = window.setTimeout(
      () => removeToast(toast.id),
      AUTO_DISMISS_MS,
    )
    return () => window.clearTimeout(timer)
  }, [toast.id, removeToast])

  const Icon =
    toast.variant === 'success'
      ? CheckCircle2
      : toast.variant === 'error'
        ? AlertCircle
        : null

  return (
    <div
      className={cn(
        'animate-slide-in pointer-events-auto flex w-full items-start gap-3 rounded-2xl border bg-surface p-4 shadow-[0_18px_40px_-24px_color-mix(in_srgb,var(--c-foreground)_55%,transparent)]',
        toast.variant === 'success' && 'border-success/30',
        toast.variant === 'error' && 'border-danger/30',
        toast.variant === 'default' && 'border-border',
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            'mt-0.5 size-4 shrink-0',
            toast.variant === 'success' && 'text-success',
            toast.variant === 'error' && 'text-danger',
          )}
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-foreground">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => removeToast(toast.id)}
        className="rounded p-0.5 text-muted transition-colors duration-150 hover:text-foreground"
        aria-label="Cerrar notificación"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts)

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] flex flex-col gap-2 sm:left-auto sm:w-full sm:max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
