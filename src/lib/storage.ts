/**
 * Claves de localStorage usadas por la aplicación.
 * Centralizadas para evitar strings mágicos dispersos.
 */
export const STORAGE_KEYS = {
  vault: 'workvaul.vault',
  ui: 'workvaul.ui',
} as const

// El estado del Vault NO se persiste en localStorage: las claves y el contenido
// descifrado viven solo en memoria. `ui` conserva únicamente preferencias
// visuales; la frase maestra se cachea aparte, en sessionStorage.

/**
 * Caché de la frase maestra para la pestaña actual.
 *
 * Se guarda en `sessionStorage`, NO en `localStorage`: `sessionStorage` vive
 * solo en la pestaña y el navegador lo descarta al cerrarla, así que no queda
 * una llave maestra escrita en el disco del perfil.
 *
 * La clave AES sigue sin exportarse: al recuperar la frase se vuelve a derivar
 * con PBKDF2 y se obtiene una `CryptoKey` no extraíble, idéntica a la del
 * primer desbloqueo. Esto no cambia la clave con la que están cifrados los
 * datos, por lo que no requiere migración de registros.
 *
 * Limitaciones asumidas: cualquier JavaScript que se ejecute en este origen
 * (XSS, extensión con permiso de lectura) puede leer esta entrada mientras la
 * pestaña está abierta. Es el mismo riesgo que exponer la clave en memoria, y
 * sigue sin exponerla al servidor ni a terceros.
 */

const SESSION_PREFIX = 'workvaul.vault.passphrase.'

function keyFor(userId: string): string {
  return `${SESSION_PREFIX}${userId}`
}

function getSessionStorage(): Storage | null {
  try {
    // Puede lanzar en modo privado restricts o con cookies bloqueadas.
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/** Guarda la frase hasta que se cierre la pestaña. */
export function cachePassphrase(userId: string, passphrase: string): void {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    storage.setItem(keyFor(userId), passphrase)
  } catch {
    // Sin espacio o cuota denegada: el Vault seguirá funcionando, sólo que
    // voltendrá a pedir la frase en el próximo desbloqueo.
  }
}

/** Devuelve la frase cacheada para ese usuario, si la hay. */
export function readCachedPassphrase(userId: string): string | null {
  const storage = getSessionStorage()
  if (!storage) return null
  try {
    return storage.getItem(keyFor(userId))
  } catch {
    return null
  }
}

/** Borra la frase cacheada (cierre de sesión, bloqueo o cambio de usuario). */
export function clearCachedPassphrase(userId: string | null): void {
  if (!userId) return
  const storage = getSessionStorage()
  if (!storage) return
  try {
    storage.removeItem(keyFor(userId))
  } catch {
    // Sin efecto si el almacenamiento no está disponible.
  }
}
