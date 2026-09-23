import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { CategorySelect } from './CategorySelect'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import type { Credential } from '@/types'

const credentialSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'El título es obligatorio')
    .max(80, 'Máximo 80 caracteres'),
  username: z
    .string()
    .trim()
    .min(1, 'El usuario es obligatorio')
    .max(120, 'Máximo 120 caracteres'),
  password: z
    .string()
    .min(1, 'La contraseña es obligatoria')
    .max(500, 'Máximo 500 caracteres'),
  url: z.union([z.string().trim().url('URL inválida'), z.literal('')]),
  categoryId: z.string(),
  notes: z.string().max(2000, 'Máximo 2000 caracteres'),
})

export type CredentialFormValues = z.infer<typeof credentialSchema>

const EMPTY_VALUES: CredentialFormValues = {
  title: '',
  username: '',
  password: '',
  url: '',
  categoryId: '',
  notes: '',
}

interface CredentialFormProps {
  credential?: Credential
  onSubmit: (values: CredentialFormValues) => void
  onCancel: () => void
}

export function CredentialForm({
  credential,
  onSubmit,
  onCancel,
}: CredentialFormProps) {
  const allCategories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: EMPTY_VALUES,
  })

  useEffect(() => {
    // Limpia selecciones huérfanas si la categoría fue borrada fuera.
    const current = watch('categoryId')
    if (current && !allCategories.some((c) => c.id === current)) {
      setValue('categoryId', '')
    }
  }, [allCategories, setValue, watch])

  useEffect(() => {
    if (credential) {
      reset({
        title: credential.title,
        username: credential.username,
        password: credential.password,
        url: credential.url ?? '',
        categoryId: credential.categoryId ?? '',
        notes: credential.notes ?? '',
      })
    } else {
      reset(EMPTY_VALUES)
    }
  }, [credential, reset])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="credential-title">Título</Label>
        <Input
          id="credential-title"
          placeholder="GitHub Enterprise"
          autoFocus
          {...register('title')}
        />
        {errors.title && (
          <p className="text-xs text-red-400">{errors.title.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="credential-username">Usuario</Label>
          <Input
            id="credential-username"
            autoComplete="off"
            {...register('username')}
          />
          {errors.username && (
            <p className="text-xs text-red-400">{errors.username.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="credential-password">Contraseña</Label>
          <Input
            id="credential-password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="credential-url">URL de login</Label>
        <Input
          id="credential-url"
          placeholder="https://..."
          autoComplete="off"
          {...register('url')}
        />
        {errors.url && (
          <p className="text-xs text-red-400">{errors.url.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="credential-category">Categoría</Label>
        <CategorySelect
          id="credential-category"
          value={watch('categoryId')}
          onChange={(id) => setValue('categoryId', id, { shouldDirty: true })}
        />
        {allCategories.length === 0 && sections.length === 0 && (
          <p className="text-xs text-muted">Aún no hay categorías: créala aquí mismo.</p>
        )}
      {errors.categoryId && (
          <p className="text-xs text-red-400">{errors.categoryId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="credential-notes">Notas</Label>
        <Textarea
          id="credential-notes"
          rows={3}
          placeholder="Notas opcionales"
          {...register('notes')}
        />
        {errors.notes && (
          <p className="text-xs text-red-400">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {credential ? 'Guardar cambios' : 'Crear credencial'}
        </Button>
      </div>
    </form>
  )
}