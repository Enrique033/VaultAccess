import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/auth-context'
import { downloadEncryptedAttachment } from '@/lib/vault-attachments'
import type { AttachmentRecordKind } from '@/lib/vault-crypto'
import type { Attachment } from '@/types'

interface AttachmentGalleryProps {
  /** Metadatos ya guardados y cifrados. */
  attachments?: Attachment[]
  /** Archivos recién elegidos, aún sin cifrar. */
  newFiles?: File[]
  /** Ids de los adjuntos marcados para eliminar en este guardado. */
  removedIds?: string[]
  kind: AttachmentRecordKind
  /** Necesario sólo si ya hay adjuntos guardados que descargar. */
  recordId?: string
}

/**
 * Galería de imágenes *visibles*: descarga cada sobre, lo descifra en memoria y
 * lo pinta como miniatura. Nunca se pide una URL pública y cada `Blob` se revoca
 * al desmontar o al ser sustituido.
 */
export function AttachmentGallery({
  attachments = [],
  newFiles = [],
  removedIds = [],
  kind,
  recordId,
}: AttachmentGalleryProps) {
  const { user } = useAuth()
  const removed = new Set(removedIds)
  const retained = attachments.filter((a) => !removed.has(a.id))
  /** Firma estable para no reiniciar la descarga en cada render. */
  const retainedKey = retained.map((a) => a.id).join(',')

  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false
    const created: string[] = []

    const load = async () => {
      if (!recordId || !user || retained.length === 0) return
      const next: Record<string, string> = {}
      for (const attachment of retained) {
        try {
          const blob = await downloadEncryptedAttachment(
            attachment,
            kind,
            recordId,
            user.id,
          )
          const url = URL.createObjectURL(blob)
          created.push(url)
          next[attachment.id] = url
        } catch (cause) {
          if (disposed) return
          setError(
            cause instanceof Error
              ? cause.message
              : 'No se pudieron descifrar algunas imágenes.',
          )
        }
      }
      if (disposed) {
        for (const url of created) URL.revokeObjectURL(url)
        return
      }
      setUrls(next)
    }

    void load()
    return () => {
      disposed = true
      for (const url of created) URL.revokeObjectURL(url)
    }
  }, [recordId, user, kind, retainedKey, retained])

  // Miniaturas de archivos aún sin subir: object URL temporal, revocado al
  // sustituirse para no filtrar memoria con cada cambio del borrador.
  const [localUrls, setLocalUrls] = useState<string[]>([])
  useEffect(() => {
    const next = newFiles.map((file) => URL.createObjectURL(file))
    setLocalUrls(next)
    return () => {
      for (const url of next) URL.revokeObjectURL(url)
    }
  }, [newFiles])

  if (retained.length === 0 && newFiles.length === 0) return null

  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {retained.map((attachment) => {
          const url = urls[attachment.id]
          return (
            <li
              key={attachment.id}
              className="overflow-hidden rounded-xl border border-border bg-elevated/40"
            >
              <div className="flex aspect-square items-center justify-center bg-surface">
                {url ? (
                  <img
                    src={url}
                    alt={attachment.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Loader2 className="size-4 animate-spin text-muted" />
                )}
              </div>
              <p className="truncate px-2 py-1.5 text-[10px] text-muted">
                {attachment.name}
              </p>
            </li>
          )
        })}
        {localUrls.map((url, index) => (
          <li
            key={`${newFiles[index]?.name ?? 'imagen'}-${index}`}
            className="overflow-hidden rounded-xl border border-primary/25 bg-primary-soft"
          >
            <div className="flex aspect-square items-center justify-center bg-surface">
              <img
                src={url}
                alt={newFiles[index]?.name ?? 'Imagen'}
                className="size-full object-cover"
              />
            </div>
            <p className="truncate px-2 py-1.5 text-[10px] text-muted">
              {newFiles[index]?.name}
            </p>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}