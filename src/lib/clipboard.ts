/**
 * Copia texto al portapapeles.
 * Usa navigator.clipboard cuando es posible y cae a execCommand
 * como fallback para navegadores sin soporte o contextos no seguros.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

let clearTimer: number | null = null

/**
 * Programa la limpieza del portapapeles tras `delayMs`.
 * Solo borra si el contenido sigue siendo el que copiamos: si el usuario
 * copió otra cosa (o no hay permiso de lectura), no toca nada.
 */
export function scheduleClipboardClear(text: string, delayMs: number): void {
  if (typeof window === 'undefined') return
  if (clearTimer !== null) window.clearTimeout(clearTimer)
  clearTimer = window.setTimeout(() => {
    void (async () => {
      try {
        if (!navigator.clipboard?.readText || !navigator.clipboard?.writeText) return
        const current = await navigator.clipboard.readText()
        if (current === text) await navigator.clipboard.writeText('')
      } catch {
        // Sin permiso de lectura: preferimos no tocar el portapapeles.
      }
    })()
  }, delayMs)
}