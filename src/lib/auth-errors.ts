import { isSupabaseConfigured, supabaseHost } from '@/lib/supabase'

/** Traduce mensajes crudos de Supabase Auth a textos amigables en español. */
export function friendlyError(message: string): string {
  // Fallo de red: casi siempre es un typo en VITE_SUPABASE_URL o el despliegue
  // construido sin variables. Mostramos el host en uso para poder verlo.
  if (
    /failed to fetch|networkerror|network request failed|load failed/i.test(
      message,
    )
  ) {
    return isSupabaseConfigured
      ? `No se pudo conectar con Supabase (${supabaseHost}). Revisa tu conexión o la URL del proyecto y recarga la página.`
      : 'Este despliegue no tiene configurado Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). En Vercel: Settings → Environment Variables y pulsa Redeploy.'
  }
  if (/provider.*not.*enabled|signups.*not.*allowed/i.test(message))
    return 'Google no está habilitado en Supabase. Contacta al administrador.'
  return message
}
