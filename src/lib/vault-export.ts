/**
 * Exportación cifrada del Vault.
 *
 * Un .xlsx normal contiene TODAS las claves en texto plano: cualquier programa
 * del equipo, una copia en la nube o un backup sin cifrar lo leerían. Aquí el
 * .xlsx se genera en memoria, se cifra con AES-GCM usando una clave derivada por
 * PBKDF2 de la contraseña que elige el usuario y sólo entonces se descarga un
 * sobre opaco (`.wvexport`) que sólo Workvaul puede abrir.
 *
 * El modo plano se mantiene como alternativa explícita, con confirmación.
 *
 * Este módulo NO importa `vault-excel` a propósito: quien lo necesite lo carga
 * dinámicamente para no arrastrar ExcelJS al bundle inicial.
 */
import type { VaultExcelInput } from '@/lib/vault-excel'

const EXPORT_SALT_BYTES = 16
const EXPORT_IV_BYTES = 12
const EXPORT_PBKDF2_ITERATIONS = 400_000

export const ENCRYPTED_EXPORT_EXTENSION = '.wvexport'

/** Sobre cifrado: `version`, `salt`, `iv` y `ciphertext` en base64url. */
export interface EncryptedExport {
  version: 1
  salt: string
  iv: string
  ciphertext: string
}

function getCrypto(): Crypto {
  const api = globalThis.crypto
  if (!api?.subtle) {
    throw new Error('Este navegador no admite Web Crypto.')
  }
  return api
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Deriva la clave AES del sobre a partir de la contraseña del usuario. */
async function deriveExportKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const cryptoApi = getCrypto()
  const material = await cryptoApi.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.slice().buffer as ArrayBuffer,
      iterations: EXPORT_PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Cifra el .xlsx con la contraseña indicada y devuelve el sobre. */
export async function sealExport(
  xlsxBytes: ArrayBuffer,
  password: string,
): Promise<EncryptedExport> {
  const cryptoApi = getCrypto()
  const salt = new Uint8Array(EXPORT_SALT_BYTES)
  cryptoApi.getRandomValues(salt)
  const iv = new Uint8Array(EXPORT_IV_BYTES)
  cryptoApi.getRandomValues(iv)
  const key = await deriveExportKey(password, salt)
  const ciphertext = new Uint8Array(
    await cryptoApi.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer },
      key,
      xlsxBytes,
    ),
  )
  return {
    version: 1,
    salt: toBase64Url(salt),
    iv: toBase64Url(iv),
    ciphertext: toBase64Url(ciphertext),
  }
}

/** Descifra el sobre con la contraseña indicada. */
export async function openExport(
  sealed: EncryptedExport,
  password: string,
): Promise<ArrayBuffer> {
  if (sealed.version !== 1) throw new Error('Versión de export no soportada.')
  const key = await deriveExportKey(password, fromBase64Url(sealed.salt))
  try {
    return await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(sealed.iv).slice().buffer as ArrayBuffer },
      key,
      fromBase64Url(sealed.ciphertext).slice().buffer as ArrayBuffer,
    )
  } catch {
    throw new Error('Contraseña incorrecta o archivo dañado.')
  }
}

/** Valida la forma del sobre antes de intentar descifrarlo. */
export function isEncryptedExport(value: unknown): value is EncryptedExport {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EncryptedExport>
  return (
    candidate.version === 1 &&
    typeof candidate.salt === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.ciphertext === 'string'
  )
}

export function downloadSealedExport(
  sealed: EncryptedExport,
  filenameBase: string,
): void {
  triggerDownload(
    new Blob([JSON.stringify(sealed)], { type: 'application/octet-stream' }),
    `${filenameBase}${ENCRYPTED_EXPORT_EXTENSION}`,
  )
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Se revoca con margen: si se revoca antes, Safari cancela la descarga.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Nombre base con fecha para las copias. */
export function exportFilenameBase(prefix: string): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  return `workvaul-${prefix}-${stamp}`
}

export type { VaultExcelInput }