import { createClient } from '@supabase/supabase-js'

// Tratamos "" como ausente: en Vercel es fácil crear la variable sin valor y
// `"" ?? fallback` no sustituye (solo cubre null/undefined) → createClient crasheaba.
const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL as string | undefined
)?.trim()
const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  // No lanzamos aquí para permitir el modo local/offline sin env.
  // Las funciones que requieran red fallarán con un error claro.
  console.warn(
    '[WorkVault] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
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
