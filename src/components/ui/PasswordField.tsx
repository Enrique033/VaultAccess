import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Check, Copy } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

/** El portapapeles se limpia automáticamente 30 s tras copiar una clave. */
const CLIPBOARD_CLEAR_MS = 30_000

interface PasswordFieldProps {
  value: string
  autoHideDelay?: number
  className?: string
}

/**
 * Muestra una clave oculta con controles de revelar y copiar.
 * La clave revelada se vuelve a ocultar automáticamente tras `autoHideDelay` ms.
 */
export function PasswordField({
  value,
  autoHideDelay = 15000,
  className,
}: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const { copied, copy } = useClipboard()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!revealed) return

    timerRef.current = window.setTimeout(
      () => setRevealed(false),
      autoHideDelay,
    )

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [revealed, autoHideDelay])

  const handleCopy = async () => {
    const ok = await copy(value, CLIPBOARD_CLEAR_MS)
    if (ok) {
      toast.success(
        'Clave copiada',
        'Se borrará del portapapeles en 30 s (si no copias otra cosa).',
      )
      setRevealed(false)
    } else {
      toast.error('No se pudo copiar la clave')
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-xl border border-border bg-elevated/50 px-3 py-2 shadow-sm',
        className,
      )}
    >
      <code className="flex-1 truncate font-mono text-xs text-foreground">
        {revealed ? value : '••••••••••••'}
      </code>

      <button
        type="button"
        onClick={() => setRevealed((p) => !p)}
        className="rounded-lg p-1 text-muted transition-colors hover:bg-elevated hover:text-foreground"
        aria-label={revealed ? 'Ocultar' : 'Revelar'}
        title={revealed ? 'Ocultar' : 'Revelar'}
      >
        {revealed ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
      </button>

      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg p-1 text-muted transition-colors hover:bg-elevated hover:text-foreground"
        aria-label="Copiar al portapapeles"
        title="Copiar"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}
