import { useEffect, useState } from 'react'
import { Loader2, Maximize2 } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
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
  const [zoomed, setZoomed] = useState<{ url: string; name: string } | null>(
    null,
  )

  useEffect(() => {
    let disposed = false
    const created: string[] = []

    const load = async () => {
      if (!recordId || !user || retained.length === 0) return
      setUrls({})
      setError(null)
      /*
        Descarga en paralelo: en serie, con varias imágenes, la última tardaba
        la suma de todas las anteriores en aparecer.
      */
      const results = await Promise.all(
        retained.map(async (attachment) => {
          try {
            const blob = await downloadEncryptedAttachment(
              attachment,
              kind,
              recordId,
              user.id,
            )
            const url = URL.createObjectURL(blob)
            return { id: attachment.id, url, name: attachment.name }
          } catch (cause) {
            if (!disposed) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'No se pudieron descifrar algunas imágenes.',
              )
            }
            return null
          }
        }),
      )
      if (disposed) {
        for (const item of results) if (item) URL.revokeObjectURL(item.url)
        return
      }
      const next: Record<string, string> = {}
      for (const item of results) {
        if (!item) continue
        created.push(item.url)
        next[item.id] = item.url
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
              <div className="relative flex aspect-square items-center justify-center bg-surface">
                {url ? (
                  <button
                    type="button"
                    onClick={() => setZoomed({ url, name: attachment.name })}
                    title={`Ampliar ${attachment.name}`}
                    className="group/zoom size-full"
                  >
                    <img
                      src={url}
                      alt={attachment.name}
                      className="size-full object-cover transition-transform duration-200 group-hover/zoom:scale-[1.04]"
                      loading="lazy"
                    />
                    <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-lg bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover/zoom:opacity-100">
                      <Maximize2 className="size-3" />
                    </span>
                  </button>
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
            <div className="relative flex aspect-square items-center justify-center bg-surface">
              <button
                type="button"
                onClick={() =>
                  setZoomed({
                    url,
                    name: newFiles[index]?.name ?? 'Imagen',
                  })
                }
                title="Ampliar"
                className="group/zoom size-full"
              >
                <img
                  src={url}
                  alt={newFiles[index]?.name ?? 'Imagen'}
                  className="size-full object-cover transition-transform duration-200 group-hover/zoom:scale-[1.04]"
                />
                <span className="pointer-events-none absolute right-1.5 top-1.5 rounded-lg bg-black/55 p-1 text-white opacity-0 transition-opacity group-hover/zoom:opacity-100">
                  <Maximize2 className="size-3" />
                </span>
              </button>
            </div>
            <p className="truncate px-2 py-1.5 text-[10px] text-muted">
              {newFiles[index]?.name}
            </p>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {zoomed && (
        <Dialog
          open
          onOpenChange={(open) => !open && setZoomed(null)}
          className="max-w-4xl"
        >
          <DialogHeader>
            <div className="min-w-0">
              <DialogTitle className="truncate">{zoomed.name}</DialogTitle>
            </div>
            <DialogCloseButton onClick={() => setZoomed(null)} />
          </DialogHeader>
          <DialogContent>
            <img
              src={zoomed.url}
              alt={zoomed.name}
              className="mx-auto max-h-[70dvh] max-w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}