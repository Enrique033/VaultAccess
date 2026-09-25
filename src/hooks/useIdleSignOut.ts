import { useEffect, useRef } from 'react'
import { useAuth } from '@/app/auth-context'
import { useVaultKey } from '@/app/vault-key-context'
import { toast } from '@/store/ui.store'

/**
 * Cierra la sesión tras un periodo de inactividad (default 15 min).
 * Se monta una vez en el AppShell. En modo local (sin Supabase) no hace nada.
 */
export function useIdleSignOut(
  timeoutMs = 15 * 60_000,
  hiddenTimeoutMs = 60_000,
) {
  const { status, signOut } = useAuth()
  const { lock } = useVaultKey()
  const signOutRef = useRef(signOut)
  signOutRef.current = signOut

  useEffect(() => {
    if (status !== 'signed-in') return

    let timer: number | null = null
    let lastReset = 0

    const clear = () => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }

    const fire = () => {
      clear()
      lock()
      void signOutRef.current()
      toast.show(
        'Sesión cerrada',
        `Por inactividad (${Math.round(timeoutMs / 60_000)} min sin usar Workvaul).`,
      )
    }

    const reset = () => {
      // Throttle: mousemove dispara cientos de veces por segundo.
      const now = Date.now()
      if (now - lastReset < 30_000) return
      lastReset = now
      clear()
      timer = window.setTimeout(fire, timeoutMs)
    }

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ]
    for (const event of events) {
      window.addEventListener(event, reset, { passive: true })
    }
    reset()

    return () => {
      clear()
      for (const event of events) {
        window.removeEventListener(event, reset)
      }
    }
  }, [status, timeoutMs, lock])

  /*
    Bloqueo por pestaña en segundo plano.

    Sin esto, el Vault seguía desbloqueado mientras la ventana estaba oculta:
    bastaba con abrir la app en un equipo compartido y mirar a otro lado. Aquí se
    bloquea tras un periodo corto fuera de foco, sin cerrar la sesión de Google:
    el usuario vuelve, escribe su frase y sigue donde estaba.

    `lock()` borra la caché de sessionStorage, así que no queda ninguna llave
    escrita mientras el Vault está bloqueado.
  */
  useEffect(() => {
    if (status !== 'signed-in') return

    let timer: number | null = null
    const start = () => {
      if (timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        if (document.visibilityState !== 'visible') {
          lock()
          toast.show('Vault bloqueado', 'La pestaña estuvo en segundo plano.')
        }
      }, hiddenTimeoutMs)
    }
    const cancel = () => {
      if (timer !== null) {
        window.clearTimeout(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') cancel()
      else start()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', start)
    window.addEventListener('focus', cancel)
    if (document.visibilityState === 'hidden') start()

    return () => {
      cancel()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', start)
      window.removeEventListener('focus', cancel)
    }
  }, [status, hiddenTimeoutMs, lock])
}
