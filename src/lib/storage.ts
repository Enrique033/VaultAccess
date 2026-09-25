/**
 * Claves de localStorage usadas por la aplicación.
 * Centralizadas para evitar strings mágicos dispersos.
 */
export const STORAGE_KEYS = {
  vault: 'workvaul.vault',
  ui: 'workvaul.ui',
} as const

// El estado del Vault no se persiste en localStorage: las claves y el contenido
// descifrado viven solo en memoria. `ui` conserva únicamente preferencias visuales.
