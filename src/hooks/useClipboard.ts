import { useCallback, useEffect, useRef, useState } from 'react'
import { copyToClipboard } from '@/lib/clipboard'

interface UseClipboardResult {
  copied: boolean
  copy: (text: string) => Promise<boolean>
}

/**
 * Hook que encapsula el copiado al portapapeles y expone
 * un booleano `copied` que se resetea tras un breve delay,
 * útil para mostrar feedback visual.
 */
export function useClipboard(resetDelay = 1500): UseClipboardResult {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text)
      if (ok) {
        setCopied(true)
        if (timerRef.current !== null) window.clearTimeout(timerRef.current)
        timerRef.current = window.setTimeout(() => setCopied(false), resetDelay)
      }
      return ok
    },
    [resetDelay],
  )

  return { copied, copy }
}