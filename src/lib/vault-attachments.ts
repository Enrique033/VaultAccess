import { supabase } from './supabase'
import {
  attachmentAad,
  decryptBytes,
  encryptBytes,
  isImageMimeType,
  type AttachmentRecordKind,
} from './vault-crypto'
import { requireActiveVaultSession } from './vault-session'
import type { Attachment } from '@/types/attachment'

export const ATTACHMENT_BUCKET = 'vault-attachments'
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
export const MAX_ATTACHMENTS_PER_RECORD = 12

export function assertValidAttachmentFile(file: File): void {
  if (!isImageMimeType(file.type)) {
    throw new Error('Solo se permiten imágenes PNG, JPEG, WebP, GIF o AVIF.')
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('Cada imagen debe pesar entre 1 byte y 10 MB.')
  }
}

function attachmentPath(
  userId: string,
  kind: AttachmentRecordKind,
  recordId: string,
  attachmentId: string,
): string {
  return `${userId}/${kind}/${recordId}/${attachmentId}.bin`
}

function assertVaultUser(userId: string): void {
  const session = requireActiveVaultSession()
  if (session.userId !== userId) {
    throw new Error('La sesión del Vault no coincide con este usuario.')
  }
}

/** Cifra una imagen y la sube a un bucket privado usando un nombre opaco. */
export async function uploadEncryptedAttachment(
  file: File,
  kind: AttachmentRecordKind,
  recordId: string,
  userId: string,
): Promise<Attachment> {
  assertValidAttachmentFile(file)
  assertVaultUser(userId)
  const session = requireActiveVaultSession()
  const id = crypto.randomUUID()
  const aad = attachmentAad(userId, kind, recordId, id)
  const encrypted = await encryptBytes(
    await file.arrayBuffer(),
    session.vaultKey,
    aad,
  )
  try {
    const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(
      attachmentPath(userId, kind, recordId, id),
      new Blob([new TextEncoder().encode(encrypted)], {
        type: 'application/octet-stream',
      }),
      { cacheControl: '3600', contentType: 'application/octet-stream', upsert: false },
    )
    if (error) throw new Error(error.message)
    return { id, name: file.name, mimeType: file.type, size: file.size }
  } catch (cause) {
    // Si la API falla después de crear el objeto, no dejamos un archivo opaco
    // sin metadata. La eliminación es best-effort: el error original manda.
    await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([attachmentPath(userId, kind, recordId, id)])
      .catch(() => undefined)
    throw new Error(
      `No se pudo subir la imagen: ${cause instanceof Error ? cause.message : 'error desconocido'}`,
    )
  }
}

/** Sube varios archivos y devuelve únicamente sus metadatos. */
export async function uploadEncryptedAttachments(
  newFiles: File[],
  kind: AttachmentRecordKind,
  recordId: string,
  userId: string,
): Promise<Attachment[]> {
  const uploaded: Attachment[] = []
  try {
    for (const file of newFiles) {
      uploaded.push(await uploadEncryptedAttachment(file, kind, recordId, userId))
    }
    return uploaded
  } catch (cause) {
    // Una subida múltiple es transaccional desde el punto de vista del
    // llamador: si falla la segunda imagen, la primera no queda huérfana.
    await deleteEncryptedAttachments(uploaded, kind, recordId, userId).catch(() => undefined)
    throw cause
  }
}

/** Elimina varios adjuntos sin detener la operación principal. */
export async function deleteEncryptedAttachments(
  attachments: Attachment[],
  kind: AttachmentRecordKind,
  recordId: string,
  userId: string,
): Promise<void> {
  await Promise.all(
    attachments.map((attachment) =>
      deleteEncryptedAttachment(attachment, kind, recordId, userId),
    ),
  )
}

/** Descarga y descifra una imagen privada en memoria; no crea una URL pública. */
export async function downloadEncryptedAttachment(
  attachment: Attachment,
  kind: AttachmentRecordKind,
  recordId: string,
  userId: string,
): Promise<Blob> {
  assertVaultUser(userId)
  const session = requireActiveVaultSession()
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(attachmentPath(userId, kind, recordId, attachment.id))
  if (error || !data) {
    throw new Error(error?.message ?? 'No se pudo descargar la imagen.')
  }
  // El objeto se sube como el sobre completo wv1.<iv>.<ciphertext>. Se
  // decodifica como UTF-8 desde sus bytes originales, nunca se interpreta el
  // ciphertext como una imagen ni se recorta su envelope.
  const envelope = new TextDecoder('utf-8', { fatal: true }).decode(await data.arrayBuffer())
  const plaintext = await decryptBytes(
    envelope,
    session.vaultKey,
    attachmentAad(userId, kind, recordId, attachment.id),
  )
  return new Blob([plaintext], { type: attachment.mimeType })
}

export async function deleteEncryptedAttachment(
  attachment: Attachment,
  kind: AttachmentRecordKind,
  recordId: string,
  userId: string,
): Promise<void> {
  assertVaultUser(userId)
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove([attachmentPath(userId, kind, recordId, attachment.id)])
  if (error) throw new Error(`No se pudo eliminar la imagen: ${error.message}`)
}
