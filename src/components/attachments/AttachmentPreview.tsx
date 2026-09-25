import { useEffect, useState } from 'react'
import { Eye, Image as ImageIcon, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useAuth } from '@/app/auth-context'
import { downloadEncryptedAttachment } from '@/lib/vault-attachments'
import type { AttachmentRecordKind } from '@/lib/vault-crypto'
import { toast } from '@/store/ui.store'
import type { Attachment } from '@/types'

interface AttachmentPreviewProps {
  attachments?: Attachment[]
  kind: AttachmentRecordKind
  recordId: string
  compact?: boolean
}

/** Descarga y muestra adjuntos sólo después de descifrarlos en memoria. */
export function AttachmentPreview({
  attachments = [],
  kind,
  recordId,
  compact = false,
}: AttachmentPreviewProps) {
  const { user } = useAuth()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(
    null,
  )

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url)
    }
  }, [preview])

  if (attachments.length === 0) return null

  const openAttachment = async (attachment: Attachment) => {
    if (!user) return
    setLoadingId(attachment.id)
    try {
      const blob = await downloadEncryptedAttachment(
        attachment,
        kind,
        recordId,
        user.id,
      )
      const url = URL.createObjectURL(blob)
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url)
        return { url, name: attachment.name }
      })
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'No se pudo abrir la imagen.',
      )
    } finally {
      setLoadingId(null)
    }
  }
  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const visible = compact ? attachments.slice(0, 3) : attachments

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {visible.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            onClick={() => void openAttachment(attachment)}
            disabled={loadingId !== null}
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-elevated/50 px-2 py-1.5 text-left text-[11px] text-muted transition-colors hover:border-primary/35 hover:bg-primary-soft hover:text-primary disabled:opacity-50"
            title={`Ver ${attachment.name}`}
          >
            {loadingId === attachment.id ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Eye className="size-3" />
            )}
            <span className="max-w-32 truncate">{attachment.name}</span>
          </button>
        ))}
        {compact && attachments.length > visible.length && (
          <span className="text-[11px] text-muted">
            +{attachments.length - visible.length}
          </span>
        )}
      </div>

      {preview && (
        <Dialog
          open
          onOpenChange={(open) => !open && closePreview()}
          className="max-w-3xl"
        >
          <DialogHeader>
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="size-4" /> {preview.name}
              </DialogTitle>
              <DialogDescription>
                Imagen descifrada localmente; no se expone una URL pública.
              </DialogDescription>
            </div>
            <DialogCloseButton onClick={closePreview} />
          </DialogHeader>
          <DialogContent>
            <img
              src={preview.url}
              alt={preview.name}
              className="mx-auto max-h-[65dvh] max-w-full rounded-xl object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
