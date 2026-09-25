import type { ReactNode } from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from './auth-context'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  createUserKeyPair,
  createVerifier,
  deriveAesKeyBits,
  importAesKeyFromBits,
  importPrivateKey,
  newSalt,
  verifyVaultKey,
  CRYPTO_PARAMETERS,
} from '@/lib/vault-crypto'
import {
  generateRecoveryWords,
  unwrapVaultKeyWithRecovery,
  wrapVaultKeyWithRecovery,
  type RecoveryWrap,
} from '@/lib/vault-recovery'
import {
  getVaultSessionGeneration,
  setActiveVaultSession,
} from '@/lib/vault-session'
import {
  cachePassphrase,
  clearCachedPassphrase,
  readCachedPassphrase,
} from '@/lib/storage'

export type VaultKeyStatus =
  | 'loading'
  | 'unconfigured'
  | 'needs-setup'
  | 'locked'
  | 'unlocked'
  | 'error'

interface CryptoRow {
  user_id: string
  version: number
  iterations: number
  salt: string
  verifier: string
  public_key: string
  encrypted_private_key: string
  recovery_salt: string | null
  recovery_iterations: number | null
  recovery_verifier: string | null
  encrypted_recovery_key: string | null
}

/** Columnas del sobre de recuperación que guarda Supabase. */
const CRYPTO_COLUMNS =
  'user_id, version, iterations, salt, verifier, public_key, encrypted_private_key, recovery_salt, recovery_iterations, recovery_verifier, encrypted_recovery_key'

interface VaultKeyContextValue {
  status: VaultKeyStatus
  userId: string | null
  /** Usuario cuya clave está activa; evita mostrar datos con una sesión anterior. */
  sessionUserId: string | null
  vaultKey: CryptoKey | null
  privateKey: CryptoKey | null
  error: string | null
  /** La cuenta ya tiene clave de recuperación guardada en el servidor. */
  hasRecoveryKey: boolean
  setup: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
  /**
   * Genera 12 palabras y calcula el sobre, SIN guardarlo todavía.
   *
   * Se separan los dos pasos a propósito: si se guardara antes de que el
   * usuario las anote, un cierre accidental del diálogo perdería la clave de
   * forma irrecuperable.
   */
  prepareRecoveryKey: () => Promise<string[]>
  /** Persiste el sobre preparado por `prepareRecoveryKey`. */
  confirmRecoveryKey: () => Promise<void>
  /** Descarta el sobre pendiente (el usuario no lo confirmó). */
  cancelRecoveryKey: () => void
  /** Desbloquea el Vault con las 12 palabras, sin necesitar la frase maestra. */
  recoverWithRecoveryWords: (words: string[]) => Promise<void>
}

const VaultKeyContext = createContext<VaultKeyContextValue | null>(null)

export function VaultKeyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [status, setStatus] = useState<VaultKeyStatus>(
    isSupabaseConfigured ? 'loading' : 'unconfigured',
  )
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null)
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null)
  /**
   * Bits crudos de la clave AES, sólo en memoria.
   *
   * La `CryptoKey` es no extraíble (no se puede exportar), pero para envolver la
   * clave con las 12 palabras hacen falta los bits. Se guardan en el mismo
   * estado volátil que la clave: nunca se escriben en storage ni se envían.
   */
  const [vaultKeyBits, setVaultKeyBits] = useState<ArrayBuffer | null>(null)
  const [hasRecoveryKey, setHasRecoveryKey] = useState(false)
  /** Sobre de recuperación generado pero todavía no confirmado por el usuario. */
  const pendingRecovery = useRef<{ words: string[]; wrap: RecoveryWrap } | null>(
    null,
  )
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const operationId = useRef(0)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('unconfigured')
      return
    }
    if (!userId) {
      setVaultKey(null)
      setPrivateKey(null)
      setVaultKeyBits(null)
      setHasRecoveryKey(false)
      setSessionUserId(null)
      setStatus('loading')
      setActiveVaultSession(null)
      return
    }

    let cancelled = false
    const operation = ++operationId.current
    setVaultKey(null)
    setPrivateKey(null)
    setVaultKeyBits(null)
    setHasRecoveryKey(false)
    setSessionUserId(null)
    setActiveVaultSession(null)
    setStatus('loading')
    setError(null)
    void (async () => {
      const { data, error: queryError } = await supabase
        .from('vault_crypto_keys')
        .select(CRYPTO_COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()
      if (cancelled || operation !== operationId.current) return
      if (queryError) {
        setError(queryError.message)
        setStatus('error')
        return
      }
      if (!data) {
        setStatus('needs-setup')
        return
      }
      if (data.version !== CRYPTO_PARAMETERS.version) {
        setError('La versión de cifrado del Vault no es compatible.')
        setStatus('error')
        return
      }

      /*
        Si esta pestaña ya desbloqueó el Vault, la frase quedó cacheada en
        sessionStorage: se re-deriva la clave sin volver a preguntarla. La clave
        AES es la misma, así que los datos ya cifrados se abren igual y no hace
        falta migrar nada.
      */
      const row = data as CryptoRow
      setHasRecoveryKey(Boolean(row.encrypted_recovery_key))
      const cached = readCachedPassphrase(userId)
      if (cached) {
        try {
          const bits = await deriveAesKeyBits(cached, row.salt, row.iterations)
          const key = await importAesKeyFromBits(bits)
          await verifyVaultKey(key, row.verifier)
          const unlockedPrivateKey = await importPrivateKey(
            row.encrypted_private_key,
            key,
            userId,
          )
          if (cancelled || operation !== operationId.current) return
          setVaultKey(key)
          setPrivateKey(unlockedPrivateKey)
          setVaultKeyBits(bits)
          setSessionUserId(userId)
          setActiveVaultSession({
            userId,
            vaultKey: key,
            privateKey: unlockedPrivateKey,
            publicKey: row.public_key,
          })
          setStatus('unlocked')
          return
        } catch {
          // La frase cacheada ya no sirve (cambió la clave o se corrompió): se
          // descarta y se vuelve al formulario normal.
          clearCachedPassphrase(userId)
        }
      }

      setStatus('locked')
    })()

    return () => {
      cancelled = true
      operationId.current += 1
    }
  }, [userId])

  const lock = useCallback(() => {
    operationId.current += 1
    // El bloqueo borra la caché: cerrar o bloquear equivale a "olvidarse".
    clearCachedPassphrase(userId)
    setVaultKey(null)
    setPrivateKey(null)
    setVaultKeyBits(null)
    setHasRecoveryKey(false)
    pendingRecovery.current = null
    setSessionUserId(null)
    setError(null)
    setStatus(isSupabaseConfigured ? 'locked' : 'unconfigured')
    setActiveVaultSession(null)
  }, [userId])

  const setup = useCallback(
    async (passphrase: string) => {
      if (!userId) throw new Error('Inicia sesión antes de configurar el Vault.')
      const operation = ++operationId.current
      const vaultGeneration = getVaultSessionGeneration()
      if (passphrase.length < 12) {
        throw new Error('La frase maestra debe tener al menos 12 caracteres.')
      }
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      setError(null)
      const salt = newSalt()
      const bits = await deriveAesKeyBits(passphrase, salt, CRYPTO_PARAMETERS.iterations)
      const key = await importAesKeyFromBits(bits)
      const verifier = await createVerifier(key)
      const pair = await createUserKeyPair(key, userId)
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      const { error: insertError } = await supabase.from('vault_crypto_keys').insert({
        user_id: userId,
        version: CRYPTO_PARAMETERS.version,
        iterations: CRYPTO_PARAMETERS.iterations,
        salt,
        verifier,
        public_key: pair.publicKey,
        encrypted_private_key: pair.encryptedPrivateKey,
      })
      if (insertError) {
        if (/duplicate|unique/i.test(insertError.message)) {
          throw new Error('Este usuario ya tiene una configuración de cifrado.')
        }
        throw new Error(insertError.message)
      }
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      const unlockedPrivateKey = await importPrivateKey(
        pair.encryptedPrivateKey,
        key,
        userId,
      )
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      setVaultKey(key)
      setPrivateKey(unlockedPrivateKey)
      setVaultKeyBits(bits)
      setSessionUserId(userId)
      setActiveVaultSession({
        userId,
        vaultKey: key,
        privateKey: unlockedPrivateKey,
        publicKey: pair.publicKey,
      })
      // Se cachea en sessionStorage para no volver a pedirla en esta pestaña.
      cachePassphrase(userId, passphrase)
      setStatus('unlocked')
    },
    [userId],
  )

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!userId) throw new Error('Inicia sesión antes de desbloquear el Vault.')
      const operation = ++operationId.current
      const vaultGeneration = getVaultSessionGeneration()
      setError(null)
      const { data, error: queryError } = await supabase
        .from('vault_crypto_keys')
        .select(CRYPTO_COLUMNS)
        .eq('user_id', userId)
        .single()
      if (queryError || !data) {
        throw new Error(queryError?.message ?? 'No se encontró la configuración del Vault.')
      }
      const row = data as CryptoRow
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      const bits = await deriveAesKeyBits(passphrase, row.salt, row.iterations)
      const key = await importAesKeyFromBits(bits)
      await verifyVaultKey(key, row.verifier)
      const unlockedPrivateKey = await importPrivateKey(
        row.encrypted_private_key,
        key,
        userId,
      )
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      setVaultKey(key)
      setPrivateKey(unlockedPrivateKey)
      setVaultKeyBits(bits)
      setHasRecoveryKey(Boolean(row.encrypted_recovery_key))
      setSessionUserId(userId)
      setActiveVaultSession({
        userId,
        vaultKey: key,
        privateKey: unlockedPrivateKey,
        publicKey: row.public_key,
      })
      // Se cachea en sessionStorage para no volver a pedirla en esta pestaña.
      cachePassphrase(userId, passphrase)
      setStatus('unlocked')
    },
    [userId],
  )

  /*
    Clave de recuperación
    ----------------------

    Paso 1 (`prepareRecoveryKey`): se generan 12 palabras y se calcula el
    sobre, pero NO se guarda nada. Si se guardara aquí, cerrar el diálogo por
    error dejaría al usuario sin copia de sus palabras y con un sobre
    irrecuperable en el servidor.

    Paso 2 (`confirmRecoveryKey`): el usuario confirma que ya las anotó y sólo
    entonces se escriben las columnas.

    Necesitamos los bits de la clave, no la `CryptoKey`, porque ésta es no
    extraíble. Por eso se exigen el Vault desbloqueado: es la única forma
    honesta de obtenerlos.
  */
  const prepareRecoveryKey = useCallback(async () => {
    if (!userId) throw new Error('Inicia sesión antes de crear la clave.')
    if (!vaultKeyBits) {
      throw new Error(
        'Desbloquea el Vault con tu frase maestra para poder crear la clave de recuperación.',
      )
    }
    const words = generateRecoveryWords()
    const wrap = await wrapVaultKeyWithRecovery(vaultKeyBits, words, userId)
    pendingRecovery.current = { words, wrap }
    return words
  }, [userId, vaultKeyBits])

  const confirmRecoveryKey = useCallback(async () => {
    if (!userId) throw new Error('Inicia sesión antes de guardar la clave.')
    const pending = pendingRecovery.current
    if (!pending) {
      throw new Error(
        'No hay ninguna clave pendiente. Vuelve a generar las palabras.',
      )
    }
    const { error: updateError } = await supabase
      .from('vault_crypto_keys')
      .update({
        recovery_salt: pending.wrap.recovery_salt,
        recovery_iterations: pending.wrap.recovery_iterations,
        recovery_verifier: pending.wrap.recovery_verifier,
        encrypted_recovery_key: pending.wrap.encrypted_recovery_key,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (updateError) throw new Error(updateError.message)
    // Se descarta: las palabras ya están anotadas y no deben quedar en memoria.
    pendingRecovery.current = null
    setHasRecoveryKey(true)
  }, [userId])

  const cancelRecoveryKey = useCallback(() => {
    pendingRecovery.current = null
  }, [])

  /*
    Recuperación sin frase maestra.

    Aquí no se cachea nada en sessionStorage a propósito. Tras recuperar con las
    12 palabras ya tenemos la clave, pero guardarla para evitar tener que
    teclear en recargas siguientes dejaría una copia legible de la clave de todo
    el Vault en el navegador, que es justo lo que el usuario acaba de aceptar
    para no depender de la frase maestra. Al recargar se volverá a pedir la
    frase (o las palabras otra vez), que es el comportamiento correcto.
  */
  const recoverWithRecoveryWords = useCallback(
    async (words: string[]) => {
      if (!userId) throw new Error('Inicia sesión antes de recuperar el Vault.')
      const operation = ++operationId.current
      const vaultGeneration = getVaultSessionGeneration()
      setError(null)
      const { data, error: queryError } = await supabase
        .from('vault_crypto_keys')
        .select(CRYPTO_COLUMNS)
        .eq('user_id', userId)
        .single()
      if (queryError || !data) {
        throw new Error(queryError?.message ?? 'No se encontró la configuración del Vault.')
      }
      const row = data as CryptoRow
      const bits = await unwrapVaultKeyWithRecovery(words, row, userId)
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return

      // Verificación final contra el verificador del Vault: confirma que la
      // clave recuperada es exactamente la que cifra los registros.
      const key = await importAesKeyFromBits(bits)
      await verifyVaultKey(key, row.verifier)
      const unlockedPrivateKey = await importPrivateKey(
        row.encrypted_private_key,
        key,
        userId,
      )
      if (
        operation !== operationId.current ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return

      setVaultKey(key)
      setPrivateKey(unlockedPrivateKey)
      setVaultKeyBits(bits)
      setHasRecoveryKey(true)
      setSessionUserId(userId)
      setActiveVaultSession({
        userId,
        vaultKey: key,
        privateKey: unlockedPrivateKey,
        publicKey: row.public_key,
      })
      setStatus('unlocked')
    },
    [userId],
  )

  return (
    <VaultKeyContext.Provider
      value={{
        status,
        userId,
        sessionUserId,
        vaultKey,
        privateKey,
        error,
        hasRecoveryKey,
        setup,
        unlock,
        lock,
        prepareRecoveryKey,
        confirmRecoveryKey,
        cancelRecoveryKey,
        recoverWithRecoveryWords,
      }}
    >
      {children}
    </VaultKeyContext.Provider>
  )
}

export function useVaultKey(): VaultKeyContextValue {
  const context = useContext(VaultKeyContext)
  if (!context) throw new Error('useVaultKey debe usarse dentro de VaultKeyProvider')
  return context
}
