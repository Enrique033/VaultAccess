/**
 * Copia local cifrada del snapshot del Vault.
 *
 * Motivo: si Supabase no responde, la app no puede leer nada. Como los datos
 * llegan cifrados al cliente, se puede guardar el MISMO ciphertext en
 * IndexedDB y descifrarlo localmente con la clave AES de la sesión. Así una
 * caída del servidor deja la app en modo lectura en lugar de vacía.
 *
 * Garantías de diseño:
 * - Se guarda exactamente lo que devuelve Supabase (`encrypted_payload`), que
 *   ya es un sobre opaco. Nunca se escriben claves en claro.
 * - Sin sesión del Vault activa, `readCachedSnapshot` devuelve `null`: la caché
 *   sin descifrar es inútil y no se intenta abrir.
 * - Las escrituras son totalmente ignorantes de fallos: si IndexedDB no está
 *   disponible (modo privado, cuota), la app sigue funcionando normal.
 */
import { requireActiveVaultSession } from './vault-session'

const DB_NAME = 'workvaul-offline'
const DB_VERSION = 1
const STORE = 'snapshots'
const RECORD_KEY = 'vault'

interface SnapshotEnvelope {
  /** `encrypted_payload` de cada registro, tal cual lo devuelve Supabase. */
  snapshot: unknown
  savedAt: number
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    // Cualquier fallo (modo privado, cuota, bloqueo) deja la app sin caché.
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

/**
 * Guarda el snapshot cifrado del Vault. Es best-effort: si falla, no interrumpe
 * la carga ni genera errores visibles.
 */
export async function writeCachedSnapshot(snapshot: unknown): Promise<void> {
  if (requireActiveVaultSessionOrNull() === null) return
  const db = await openDatabase()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(
        { snapshot, savedAt: Date.now() } satisfies SnapshotEnvelope,
        RECORD_KEY,
      )
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

/**
 * Devuelve el snapshot cacheado para leerlo sin conexión, o `null` si no hay
 * caché o si el Vault está bloqueado.
 */
export async function readCachedSnapshot(): Promise<unknown | null> {
  if (requireActiveVaultSessionOrNull() === null) return null
  const db = await openDatabase()
  if (!db) return null
  const envelope = await new Promise<SnapshotEnvelope | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly')
      const request = tx.objectStore(STORE).get(RECORD_KEY)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  db.close()
  return envelope?.snapshot ?? null
}

/** Borra la copia local (cierre de sesión o "usar datos del servidor"). */
export async function clearCachedSnapshot(): Promise<void> {
  const db = await openDatabase()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(RECORD_KEY)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
  db.close()
}

/**
 * `requireActiveVaultSession` lanza si el Vault está bloqueado. Aquí sólo
 * interesa saber si hay sesión: la caché nunca debe intentar descifrarse sin
 * una clave AES en memoria.
 */
function requireActiveVaultSessionOrNull(): ReturnType<
  typeof requireActiveVaultSession
> | null {
  try {
    return requireActiveVaultSession()
  } catch {
    return null
  }
}