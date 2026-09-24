/**
 * Claves de localStorage usadas por la aplicación.
 * Centralizadas para evitar strings mágicos dispersos.
 */
export const STORAGE_KEYS = {
  vault: 'vaultaccess.vault',
  ui: 'vaultaccess.ui',
} as const

// TODO(Fase Security): reemplazar la persistencia de `vault` por
// un payload cifrado con AES-GCM (Web Crypto API) derivado de la
// Master Password con PBKDF2. La implementación actual es temporal
// y solo apta para desarrollo local.
