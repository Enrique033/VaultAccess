import { useEffect, useRef } from 'react'
import { useAuth } from '@/app/auth-context'
import { useVaultKey } from '@/app/vault-key-context'
import { toast } from '@/store/ui.store'

/**
 * Cierra la sesión tras un periodo de inactividad (default 15 min).
 * Se monta una vez en el AppShell. En modo local (sin Supabase) no hace nada.
 */
export function useIdleSignOut(timeoutMs = 15 * 60_000) {
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
}
