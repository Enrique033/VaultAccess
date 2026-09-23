import { Check, Copy } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  label?: string
  successMessage?: string
  errorMessage?: string
  className?: string
}

export function CopyButton({
  value,
  label = 'Copiar',
  successMessage = 'Copiado al portapapeles',
  errorMessage = 'No se pudo copiar',
  className,
}: CopyButtonProps) {
  const { copied, copy } = useClipboard()

  const handleClick = async () => {
    const ok = await copy(value)
    if (ok) toast.success(successMessage)
    else toast.error(errorMessage)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'rounded p-1 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground',
        className,
      )}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="size-3.5 text-green-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  )
}