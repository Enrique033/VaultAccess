import { isSupabaseConfigured, supabaseHost } from '@/lib/supabase'

/** Traduce mensajes crudos de Supabase Auth a textos amigables en español. */
export function friendlyError(message: string): string {
  // Fallo de red: casi siempre es un typo en VITE_SUPABASE_URL o el despliegue
  // construido sin variables. Mostramos el host en uso para poder verlo.
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(message)) {
    return isSupabaseConfigured
      ? `No se pudo conectar con Supabase (${supabaseHost}). Revisa tu conexión o la URL del proyecto y recarga la página.`
      : 'Este despliegue no tiene configurado Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). En Vercel: Settings → Environment Variables y pulsa Redeploy.'
  }
  if (/invalid login credentials/i.test(message)) return 'Correo o clave incorrectos.'
  if (/user already registered/i.test(message)) return 'Este correo ya tiene cuenta. Inicia sesión.'
  if (/email not confirmed/i.test(message)) return 'Debes confirmar tu correo antes de entrar.'
  if (/password/i.test(message) && /at least|short/i.test(message))
    return 'La clave debe tener al menos 6 caracteres.'
  if (/should be more secure|too weak/i.test(message))
    return 'La clave es demasiado débil. Usa mayúsculas, números o símbolos.'
  if (/only request this after/i.test(message))
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
  if (/provider.*not.*enabled|signups.*not.*allowed/i.test(message))
    return 'Este proveedor de inicio de sesión no está habilitado en Supabase.'
  return message
}