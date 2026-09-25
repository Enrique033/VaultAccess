/**
 * Cifrado de extremo a extremo para el contenido privado de Workvaul.
 *
 * La frase maestra y las claves derivadas viven solo en memoria. Supabase
 * almacena ciphertext, sal, verificadores y claves públicas; nunca recibe la
 * clave AES del Vault.
 */

const ENVELOPE_PREFIX = 'wv1'
const AES_IV_BYTES = 12
const PBKDF2_ITERATIONS = 600_000
const SALT_BYTES = 16
const RSA_MODULUS_LENGTH = 2048
const VERIFIER_TEXT = 'workvaul:vault:verifier:v1'
const VERIFIER_AAD = 'workvaul:vault:verifier'
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export type VaultRecordKind =
  | 'section'
  | 'category'
  | 'credential'
  | 'link'
  | 'note'
  | 'history'
  | 'workspace-item'
  | 'attachment'

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Este navegador no admite Web Crypto. Actualiza el navegador para usar el Vault cifrado.',
    )
  }
  return globalThis.crypto
}

function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < view.length; i += chunkSize) {
    binary += String.fromCharCode(...view.subarray(i, i + chunkSize))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value
  return value.slice().buffer as ArrayBuffer
}

function asAesAlgorithm(iv: Uint8Array, aad: string): AesGcmParams {
  return {
    name: 'AES-GCM',
    iv: toArrayBuffer(iv),
    additionalData: toArrayBuffer(textEncoder.encode(aad)),
  }
}

export function isEncryptedEnvelope(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith(`${ENVELOPE_PREFIX}.`)
}

export function isImageMimeType(mimeType: string): boolean {
  return /^image\/(png|jpeg|webp|gif|avif)$/i.test(mimeType)
}

export function newKeyBytes(length = 32): Uint8Array {
  const bytes = new Uint8Array(length)
  getCrypto().getRandomValues(bytes)
  return bytes
}

export async function importAesKey(value: ArrayBuffer | Uint8Array): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    'raw',
    toArrayBuffer(value),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function newSalt(): string {
  return bytesToBase64Url(newKeyBytes(SALT_BYTES))
}

export function personalRecordAad(
  kind: VaultRecordKind,
  userId: string,
  recordId: string,
): string {
  return `workvaul:v1:${kind}:${userId}:${recordId}`
}

export type AttachmentRecordKind = 'credential' | 'link' | 'note'

export function attachmentAad(
  userId: string,
  kind: AttachmentRecordKind,
  recordId: string,
  attachmentId: string,
): string {
  return `workvaul:v1:attachment:${userId}:${kind}:${recordId}:${attachmentId}`
}

export function workspaceRecordAad(workspaceId: string, recordId: string): string {
  return `workvaul:v1:workspace-item:${workspaceId}:${recordId}`
}

function privateKeyAad(userId: string): string {
  return `workvaul:v1:private-key:${userId}`
}

/**
 * Bits de una clave AES-256 derivados de un secreto mediante PBKDF2.
 *
 * Se separa de `deriveVaultKey` porque la clave de recuperación necesita los
 * bits en crudo (para envolverlos con las 12 palabras) y porque así ambas
 * derivaciones pasan exactamente por el mismo cálculo: la clave de la frase
 * maestra no cambia, de modo que los registros ya cifrados siguen abriéndose.
 */
export async function deriveAesKeyBits(
  secret: string,
  salt: string,
  iterations: number,
): Promise<ArrayBuffer> {
  const cryptoApi = getCrypto()
  const material = await cryptoApi.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  return cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(base64UrlToBytes(salt)),
      iterations,
      hash: 'SHA-256',
    },
    material,
    256,
  )
}

/** Importa bits como clave AES-256 no extraíble (no se puede exportar). */
export async function importAesKeyFromBits(
  bits: ArrayBuffer | Uint8Array,
): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    'raw',
    toArrayBuffer(bits),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Deriva una clave AES a partir de un secreto, sin mínimo de longitud.
 *
 * Se usa con la clave de recuperación, donde el secreto son 12 palabras
 * generadas por la app (no una contraseña elegida por el usuario).
 */
export async function deriveAesKeyFromSecret(
  secret: string,
  salt: string,
  iterations: number,
): Promise<CryptoKey> {
  return importAesKeyFromBits(await deriveAesKeyBits(secret, salt, iterations))
}

export async function deriveVaultKey(
  passphrase: string,
  salt: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (passphrase.length < 12) {
    throw new Error('La frase maestra debe tener al menos 12 caracteres.')
  }
  return deriveAesKeyFromSecret(passphrase, salt, iterations)
}

export async function encryptBytes(
  value: ArrayBuffer | Uint8Array,
  key: CryptoKey,
  aad: string,
): Promise<string> {
  const cryptoApi = getCrypto()
  const iv = new Uint8Array(AES_IV_BYTES)
  cryptoApi.getRandomValues(iv)
  const ciphertext = await cryptoApi.subtle.encrypt(
    asAesAlgorithm(iv, aad),
    key,
    toArrayBuffer(value),
  )
  return `${ENVELOPE_PREFIX}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`
}

export async function decryptBytes(
  envelope: string,
  key: CryptoKey,
  aad: string,
): Promise<ArrayBuffer> {
  if (!isEncryptedEnvelope(envelope)) {
    throw new Error('El contenido no tiene un formato cifrado válido.')
  }
  const [, ivPart, ciphertextPart, ...extra] = envelope.split('.')
  if (!ivPart || !ciphertextPart || extra.length > 0) {
    throw new Error('El contenido cifrado está incompleto.')
  }
  return getCrypto().subtle.decrypt(
    asAesAlgorithm(base64UrlToBytes(ivPart), aad),
    key,
    toArrayBuffer(base64UrlToBytes(ciphertextPart)),
  )
}

export async function encryptJson<T>(
  value: T,
  key: CryptoKey,
  aad: string,
): Promise<string> {
  return encryptBytes(textEncoder.encode(JSON.stringify(value)), key, aad)
}

export async function decryptJson<T>(
  envelope: string,
  key: CryptoKey,
  aad: string,
): Promise<T> {
  const plaintext = await decryptBytes(envelope, key, aad)
  try {
    return JSON.parse(textDecoder.decode(plaintext)) as T
  } catch {
    throw new Error('El contenido descifrado no tiene un formato válido.')
  }
}

export async function createVerifier(key: CryptoKey): Promise<string> {
  return encryptBytes(textEncoder.encode(VERIFIER_TEXT), key, VERIFIER_AAD)
}

export async function verifyVaultKey(
  key: CryptoKey,
  verifier: string,
): Promise<void> {
  const plaintext = await decryptBytes(verifier, key, VERIFIER_AAD)
  if (textDecoder.decode(plaintext) !== VERIFIER_TEXT) {
    throw new Error('La frase maestra no es correcta.')
  }
}

export interface UserKeyPair {
  publicKey: string
  encryptedPrivateKey: string
}

export async function createUserKeyPair(
  vaultKey: CryptoKey,
  userId: string,
): Promise<UserKeyPair> {
  const cryptoApi = getCrypto()
  const pair = await cryptoApi.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: RSA_MODULUS_LENGTH,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  )
  const publicKey = await cryptoApi.subtle.exportKey('spki', pair.publicKey)
  const privateKey = await cryptoApi.subtle.exportKey('pkcs8', pair.privateKey)
  const encryptedPrivateKey = await encryptBytes(
    privateKey,
    vaultKey,
    privateKeyAad(userId),
  )
  return { publicKey: bytesToBase64Url(publicKey), encryptedPrivateKey }
}

export async function importPublicKey(publicKey: string): Promise<CryptoKey> {
  return getCrypto().subtle.importKey(
    'spki',
    toArrayBuffer(base64UrlToBytes(publicKey)),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
}

export async function importPrivateKey(
  encryptedPrivateKey: string,
  vaultKey: CryptoKey,
  userId: string,
): Promise<CryptoKey> {
  const privateKey = await decryptBytes(
    encryptedPrivateKey,
    vaultKey,
    privateKeyAad(userId),
  )
  return getCrypto().subtle.importKey(
    'pkcs8',
    privateKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )
}

export async function encryptForPublicKey(
  value: ArrayBuffer | Uint8Array,
  publicKey: string,
): Promise<string> {
  const key = await importPublicKey(publicKey)
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    toArrayBuffer(value),
  )
  return bytesToBase64Url(ciphertext)
}

export async function decryptWithPrivateKey(
  envelope: string,
  privateKey: CryptoKey,
): Promise<ArrayBuffer> {
  return getCrypto().subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    toArrayBuffer(base64UrlToBytes(envelope)),
  )
}

export const CRYPTO_PARAMETERS = {
  iterations: PBKDF2_ITERATIONS,
  version: 1,
} as const

