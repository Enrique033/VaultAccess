import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Check, Copy } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

/** El portapapeles se limpia automáticamente 30 s tras copiar una contraseña. */
const CLIPBOARD_CLEAR_MS = 30_000

interface PasswordFieldProps {
  value: string
  autoHideDelay?: number
  className?: string
}

/**
 * Muestra una contraseña oculta con controles de revelar y copiar.
 * La contraseña revelada se vuelve a ocultar automáticamente tras `autoHideDelay` ms.
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

    timerRef.current = window.setTimeout(() => setRevealed(false), autoHideDelay)

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [revealed, autoHideDelay])

  const handleCopy = async () => {
    const ok = await copy(value, CLIPBOARD_CLEAR_MS)
    if (ok) {
      toast.success(
        'Contraseña copiada',
        'Se borrará del portapapeles en 30 s (si no copias otra cosa).',
      )
      setRevealed(false)
    } else {
      toast.error('No se pudo copiar la contraseña')
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1',
        className,
      )}
    >
      <code className="flex-1 truncate font-mono text-xs text-foreground">
        {revealed ? value : '••••••••••••'}
      </code>

      <button
        type="button"
        onClick={() => setRevealed((p) => !p)}
        className="rounded p-1 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground"
        aria-label={revealed ? 'Ocultar contraseña' : 'Revelar contraseña'}
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
        className="rounded p-1 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground"
        aria-label="Copiar contraseña"
        title="Copiar"
      >
        {copied ? (
          <Check className="size-3.5 text-green-500" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}