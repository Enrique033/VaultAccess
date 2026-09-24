import { createClient } from '@supabase/supabase-js'

/**
 * Normaliza el valor de una variable de entorno: quita espacios y las comillas
 * que se cuelan al pegar el valor en el panel de Vercel. Un `"` de más hace que
 * el host sea inválido y todo termine en un `Failed to fetch` difícil de ver.
 */
function cleanEnv(value: string | undefined): string | undefined {
  const clean = value
    ?.trim()
    .replace(/^["']+/, '')
    .replace(/["']+$/, '')
    .trim()
  return clean ? clean : undefined
}

// Tratamos "" como ausente: en Vercel es fácil crear la variable sin valor y
// `"" ?? fallback` no sustituye (solo cubre null/undefined) → createClient crasheaba.
const supabaseUrl = cleanEnv(
  import.meta.env.VITE_SUPABASE_URL as string | undefined,
)
const supabaseAnonKey = cleanEnv(
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
)
const configuredAppUrl = cleanEnv(
  import.meta.env.VITE_APP_URL as string | undefined,
)

/**
 * Origen canónico de la aplicación. En producción conviene fijar
 * `VITE_APP_URL`; localmente usamos el origen desde el que se abrió la app.
 */
export const appOrigin = (() => {
  if (configuredAppUrl) {
    try {
      const url = new URL(configuredAppUrl)
      if (url.protocol === 'https:' || url.protocol === 'http:')
        return url.origin
    } catch {
      // La advertencia de abajo permite diagnosticar el valor inválido.
    }
    console.warn(
      '[Workvaul] VITE_APP_URL no es una URL HTTP válida; se usará el origen actual.',
    )
  }

  if (typeof window !== 'undefined' && window.location.origin !== 'null') {
    return window.location.origin
  }
  return undefined
})()

/** Construye una redirección de Auth sobre el origen canónico de la app. */
export function appUrl(pathname: string): string {
  if (!appOrigin) {
    throw new Error(
      'No se pudo determinar la URL de la aplicación. Configura VITE_APP_URL.',
    )
  }
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return new URL(path, appOrigin).toString()
}

/**
 * Host de Supabase que está usando este build. Se muestra en los mensajes de
 * error de red: un typo en `VITE_SUPABASE_URL` (p. ej. una letra de menos) no
 * rompe el build, solo hace que ninguna petición resuelva por DNS.
 */
export const supabaseHost = (() => {
  if (!supabaseUrl) return 'sin configurar'
  try {
    return new URL(supabaseUrl).host
  } catch {
    return supabaseUrl
  }
})()

if (!supabaseUrl || !supabaseAnonKey) {
  // No lanzamos aquí para permitir el modo local/offline sin env.
  // Las funciones que requieran red fallarán con un error claro.
  console.warn(
    '[Workvaul] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'En local: copia .env.example a .env. En Vercel: Settings → ' +
      'Environment Variables y vuelve a desplegar (Redeploy).',
  )
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)

export const isSupabaseConfigured =
  Boolean(supabaseUrl) && Boolean(supabaseAnonKey)

/**
 * Id del usuario autenticado, o un error claro si no hay sesión.
 * Lo usan los stores antes de insertar filas con `user_id`.
 */
export async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Sin sesión. Inicia sesión de nuevo.')
  return id
}
