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
import type { LinkItem } from '@/types'

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
  onSubmit: (values: LinkFormValues) => void
}

export function LinkDialog({ open, onOpenChange, link, onSubmit }: LinkDialogProps) {
  const isEditing = Boolean(link)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LinkFormValues>({
    resolver: zodResolver(linkSchema),
    defaultValues: EMPTY,
  })

  useEffect(() => {
    if (!open) return
    if (link) {
      reset({
        title: link.title,
        url: link.url,
        categoryId: link.categoryId ?? '',
        description: link.description ?? '',
      })
    } else {
      reset(EMPTY)
    }
  }, [open, link, reset])

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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <Label htmlFor="link-category">Categoría</Label>
            <CategorySelect
              id="link-category"
              value={watch('categoryId')}
              onChange={(id) => setValue('categoryId', id, { shouldDirty: true })}
            />
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