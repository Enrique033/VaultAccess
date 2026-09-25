import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Share2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import type { AttachmentDraft, Credential } from '@/types'

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
    .min(1, 'La clave es obligatoria')
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
  onSubmit: (values: CredentialFormValues, attachments: AttachmentDraft) => void
  onCancel: () => void
  /** Clave que se aplica al formulario (p. ej. al restaurar una versión). */
  passwordSeed?: string
  /** Categoría preseleccionada al crear desde una columna del tablero. */
  defaultCategoryId?: string
  /** Abre el diálogo de compartir con esta credencial ya guardada. */
  onShareRequest?: (credential: Credential) => void
}

export function CredentialForm({
  credential,
  onSubmit,
  onCancel,
  passwordSeed,
  defaultCategoryId,
  onShareRequest,
}: CredentialFormProps) {
  const allCategories = useVaultStore((s) => s.categories)
  const status = useVaultStore((s) => s.status)
  /**
   * Las credenciales ya no admiten imágenes (sólo las notas), pero la firma de
   * `onSubmit` se conserva para no tocar el store ni la página.
   */
  const attachmentDraft: AttachmentDraft = { newFiles: [], removedIds: [] }

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
    if (
      (status === 'ready' || status === 'local') &&
      current &&
      !allCategories.some((c) => c.id === current)
    ) {
      setValue('categoryId', '')
    }
  }, [allCategories, setValue, status, watch])

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
      reset({ ...EMPTY_VALUES, categoryId: defaultCategoryId ?? '' })
    }
  }, [credential, defaultCategoryId, reset])

  // Restauración desde el historial: se escribe como cambio pendiente.
  useEffect(() => {
    if (!passwordSeed) return
    setValue('password', passwordSeed, { shouldDirty: true, shouldValidate: true })
  }, [passwordSeed, setValue])

  return (
    <form
      onSubmit={handleSubmit((values) => onSubmit(values, attachmentDraft))}
      className="space-y-4"
    >
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
          <Label htmlFor="credential-password">Clave</Label>
          <PasswordInput
            id="credential-password"
            value={watch('password')}
            onChange={(v) =>
              setValue('password', v, { shouldDirty: true, shouldValidate: true })
            }
            autoComplete="new-password"
            showStrength
            allowGenerate
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

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {credential ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onShareRequest?.(credential)}
            disabled={!onShareRequest}
          >
            <Share2 className="size-3.5" /> Compartir en equipo
          </Button>
        ) : (
          <span className="text-xs text-muted">
            Podrás compartirla desde los 3 puntitos de la tarjeta.
          </span>
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {credential ? 'Guardar cambios' : 'Crear credencial'}
          </Button>
        </div>
      </div>
    </form>
  )
}