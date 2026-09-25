import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { CategorySelect } from '@/components/credentials/CategorySelect'
import { AttachmentPicker } from '@/components/attachments/AttachmentPicker'
import { AttachmentGallery } from '@/components/attachments/AttachmentGallery'
import type { AttachmentDraft, Note } from '@/types'

const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  content: z.string().max(5000, 'Máximo 5000 caracteres'),
  comments: z.string().max(5000, 'Máximo 5000 caracteres'),
  categoryId: z.string(),
})

export type NoteFormValues = z.infer<typeof noteSchema>

const EMPTY: NoteFormValues = {
  title: '',
  content: '',
  comments: '',
  categoryId: '',
}

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note
  onSubmit: (values: NoteFormValues, attachments: AttachmentDraft) => void
  /** Categoría preseleccionada al crear desde una columna del tablero. */
  defaultCategoryId?: string
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
  onSubmit,
  defaultCategoryId,
}: NoteDialogProps) {
  const isEditing = Boolean(note)
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft>({
    newFiles: [],
    removedIds: [],
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: EMPTY,
  })

  const contentLength = watch('content').length
  const commentsLength = watch('comments').length

  useEffect(() => {
    if (!open) return
    setAttachmentDraft({ newFiles: [], removedIds: [] })
    if (note) {
      reset({
        title: note.title,
        content: note.content,
        comments: note.comments ?? '',
        categoryId: note.categoryId ?? '',
      })
    } else {
      reset({ ...EMPTY, categoryId: defaultCategoryId ?? '' })
    }
  }, [open, note, defaultCategoryId, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-4xl">
      <DialogHeader>
        <div>
          <DialogTitle>{isEditing ? 'Editar nota' : 'Nueva nota'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Actualiza el contenido de la nota.'
              : 'Escribe una nota en tu espacio.'}
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <DialogContent>
        <form
          onSubmit={handleSubmit((values) => onSubmit(values, attachmentDraft))}
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Izquierda: el texto de la nota. */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="note-title">Título</Label>
              <Input
                id="note-title"
                placeholder="Ideas del sprint"
                autoFocus
                {...register('title')}
              />
              {errors.title && (
                <p className="text-xs text-red-400">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-content">Contenido</Label>
              <Textarea
                id="note-content"
                rows={10}
                placeholder="Escribe aquí…"
                className="min-h-56"
                {...register('content')}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-red-400">
                  {errors.content?.message}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {contentLength}/5000
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note-category">Categoría</Label>
              <CategorySelect
                id="note-category"
                value={watch('categoryId')}
                onChange={(id) =>
                  setValue('categoryId', id, { shouldDirty: true })
                }
              />
            </div>
          </div>

          {/* Derecha: imágenes visibles y comentarios. */}
          <div className="space-y-3">
            <AttachmentPicker
              existing={note?.attachments}
              value={attachmentDraft}
              onChange={setAttachmentDraft}
            />

            <AttachmentGallery
              attachments={note?.attachments}
              newFiles={attachmentDraft.newFiles}
              removedIds={attachmentDraft.removedIds}
              kind="note"
              recordId={note?.id}
            />

            <div className="space-y-1.5">
              <Label htmlFor="note-comments">Comentarios</Label>
              <Textarea
                id="note-comments"
                rows={6}
                placeholder="Comentarios, enlaces o recordatorios…"
                {...register('comments')}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-red-400">
                  {errors.comments?.message}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {commentsLength}/5000
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isEditing ? 'Guardar cambios' : 'Crear nota'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}