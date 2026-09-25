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
  deriveVaultKey,
  importPrivateKey,
  newSalt,
  verifyVaultKey,
  CRYPTO_PARAMETERS,
} from '@/lib/vault-crypto'
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
}

interface VaultKeyContextValue {
  status: VaultKeyStatus
  userId: string | null
  /** Usuario cuya clave está activa; evita mostrar datos con una sesión anterior. */
  sessionUserId: string | null
  vaultKey: CryptoKey | null
  privateKey: CryptoKey | null
  error: string | null
  setup: (passphrase: string) => Promise<void>
  unlock: (passphrase: string) => Promise<void>
  lock: () => void
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
      setSessionUserId(null)
      setStatus('loading')
      setActiveVaultSession(null)
      return
    }

    let cancelled = false
    const operation = ++operationId.current
    setVaultKey(null)
    setPrivateKey(null)
    setSessionUserId(null)
    setActiveVaultSession(null)
    setStatus('loading')
    setError(null)
    void (async () => {
      const { data, error: queryError } = await supabase
        .from('vault_crypto_keys')
        .select('user_id, version, iterations, salt, verifier, public_key, encrypted_private_key')
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
      const cached = readCachedPassphrase(userId)
      if (cached) {
        try {
          const key = await deriveVaultKey(cached, row.salt, row.iterations)
          await verifyVaultKey(key, row.verifier)
          const unlockedPrivateKey = await importPrivateKey(
            row.encrypted_private_key,
            key,
            userId,
          )
          if (cancelled || operation !== operationId.current) return
          setVaultKey(key)
          setPrivateKey(unlockedPrivateKey)
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
      const key = await deriveVaultKey(passphrase, salt)
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
        .select('user_id, version, iterations, salt, verifier, public_key, encrypted_private_key')
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
      const key = await deriveVaultKey(passphrase, row.salt, row.iterations)
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

  return (
    <VaultKeyContext.Provider
      value={{ status, userId, sessionUserId, vaultKey, privateKey, error, setup, unlock, lock }}
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
