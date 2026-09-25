import { useRef, useState } from 'react'
import { FileImage, ImagePlus, Trash2 } from 'lucide-react'
import {
  assertValidAttachmentFile,
  MAX_ATTACHMENTS_PER_RECORD,
} from '@/lib/vault-attachments'
import { Button } from '@/components/ui/Button'
import type { Attachment, AttachmentDraft } from '@/types'

interface AttachmentPickerProps {
  existing?: Attachment[]
  value: AttachmentDraft
  onChange: (draft: AttachmentDraft) => void
  disabled?: boolean
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Selector de imágenes; sólo mantiene Files en memoria hasta guardar el registro. */
export function AttachmentPicker({
  existing = [],
  value,
  onChange,
  disabled = false,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const removed = new Set(value.removedIds)
  const retained = existing.filter((attachment) => !removed.has(attachment.id))
  const total = retained.length + value.newFiles.length

  const addFiles = (files: FileList | null) => {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) return
    try {
      for (const file of selected) assertValidAttachmentFile(file)
      if (total + selected.length > MAX_ATTACHMENTS_PER_RECORD) {
        throw new Error(
          `Cada registro admite hasta ${MAX_ATTACHMENTS_PER_RECORD} imágenes.`,
        )
      }
      onChange({
        newFiles: [...value.newFiles, ...selected],
        removedIds: value.removedIds,
      })
      setError(null)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo añadir la imagen.',
      )
    }
  }

  const removeExisting = (id: string) => {
    if (!removed.has(id)) {
      onChange({
        newFiles: value.newFiles,
        removedIds: [...value.removedIds, id],
      })
    }
    setError(null)
  }

  const removeNewFile = (index: number) => {
    onChange({
      newFiles: value.newFiles.filter((_, fileIndex) => fileIndex !== index),
      removedIds: value.removedIds,
    })
    setError(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            Imágenes cifradas
          </p>
          <p className="text-xs text-muted">
            PNG, JPEG, WebP, GIF o AVIF · máximo {MAX_ATTACHMENTS_PER_RECORD}{' '}
            imágenes de 10 MB.
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted">
          {total}/{MAX_ATTACHMENTS_PER_RECORD}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        disabled={disabled || total >= MAX_ATTACHMENTS_PER_RECORD}
        onChange={(event) => {
          addFiles(event.currentTarget.files)
          event.currentTarget.value = ''
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || total >= MAX_ATTACHMENTS_PER_RECORD}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="size-3.5" /> Seleccionar imágenes
      </Button>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {(retained.length > 0 || value.newFiles.length > 0) && (
        <ul className="space-y-1.5" aria-label="Imágenes seleccionadas">
          {retained.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-elevated/40 px-2.5 py-2"
            >
              <FileImage className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {attachment.name}
              </span>
              <span className="text-[10px] text-muted">
                {formatBytes(attachment.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeExisting(attachment.id)}
                className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                aria-label={`Eliminar ${attachment.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
          {value.newFiles.map((file, index) => (
            <li
              key={`${file.name}-${file.lastModified}-${index}`}
              className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary-soft px-2.5 py-2"
            >
              <FileImage className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {file.name}
              </span>
              <span className="text-[10px] text-muted">
                {formatBytes(file.size)}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeNewFile(index)}
                className="rounded p-1 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                aria-label={`Quitar ${file.name}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
