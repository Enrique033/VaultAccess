import { useEffect } from 'react'
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
import type { Note } from '@/types'

const noteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  content: z.string().max(5000, 'Máximo 5000 caracteres'),
  categoryId: z.string(),
})

export type NoteFormValues = z.infer<typeof noteSchema>

const EMPTY: NoteFormValues = { title: '', content: '', categoryId: '' }

interface NoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  note?: Note
  onSubmit: (values: NoteFormValues) => void
}

export function NoteDialog({ open, onOpenChange, note, onSubmit }: NoteDialogProps) {
  const isEditing = Boolean(note)

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

  useEffect(() => {
    if (!open) return
    if (note) {
      reset({
        title: note.title,
        content: note.content,
        categoryId: note.categoryId ?? '',
      })
    } else {
      reset(EMPTY)
    }
  }, [open, note, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              rows={8}
              placeholder="Escribe aquí…"
              className="max-h-64"
              {...register('content')}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-red-400">{errors.content?.message}</span>
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
              onChange={(id) => setValue('categoryId', id, { shouldDirty: true })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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