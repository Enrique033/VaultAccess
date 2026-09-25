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
import type { AttachmentDraft, LinkItem } from '@/types'

const linkSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  url: z
    .string()
    .trim()
    .min(1, 'La URL es obligatoria')
    .url('URL inválida (incluye https://)')
    .max(2048, 'Máximo 2048 caracteres'),
  categoryId: z.string(),
  description: z.string().max(500, 'Máximo 500 caracteres'),
})

export type LinkFormValues = z.infer<typeof linkSchema>

const EMPTY: LinkFormValues = {
  title: '',
  url: '',
  categoryId: '',
  description: '',
}

interface LinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  link?: LinkItem
  onSubmit: (values: LinkFormValues, attachments: AttachmentDraft) => void
  /** Categoría preseleccionada al crear desde una columna del tablero. */
  defaultCategoryId?: string
}

export function LinkDialog({
  open,
  onOpenChange,
  link,
  onSubmit,
  defaultCategoryId,
}: LinkDialogProps) {
  const isEditing = Boolean(link)
  const [attachmentDraft, setAttachmentDraft] = useState<AttachmentDraft>({
    newFiles: [],
    removedIds: [],
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    setAttachmentDraft({ newFiles: [], removedIds: [] })
    if (link) {
      reset({
        title: link.title,
        url: link.url,
        categoryId: link.categoryId ?? '',
        description: link.description ?? '',
      })
    } else {
      reset({ ...EMPTY, categoryId: defaultCategoryId ?? '' })
    }
  }, [open, link, defaultCategoryId, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <div>
          <DialogTitle>{isEditing ? 'Editar enlace' : 'Nuevo enlace'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Actualiza los datos del enlace.'
              : 'Guarda un enlace frecuente en tu espacio.'}
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <DialogContent>
        <form
          onSubmit={handleSubmit((values) => onSubmit(values, attachmentDraft))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="link-title">Título</Label>
            <Input
              id="link-title"
              placeholder="Documentación React"
              autoFocus
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-red-400">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL</Label>
            <Input
              id="link-url"
              placeholder="https://…"
              autoComplete="off"
              inputMode="url"
              {...register('url')}
            />
            {errors.url && (
              <p className="text-xs text-red-400">{errors.url.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-description">Descripción</Label>
            <Textarea
              id="link-description"
              rows={3}
              placeholder="Descripción opcional"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-xs text-red-400">{errors.description.message}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isEditing ? 'Guardar cambios' : 'Crear enlace'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}