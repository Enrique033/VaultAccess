import { useEffect, useState } from 'react'
import { History, KeyRound } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { CredentialForm, type CredentialFormValues } from './CredentialForm'
import { CredentialHistory } from './CredentialHistory'
import { cn } from '@/lib/utils'
import type { AttachmentDraft, Credential } from '@/types'

type Tab = 'data' | 'history'

interface CredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential?: Credential
  onSubmit: (values: CredentialFormValues, attachments: AttachmentDraft) => void
  /** Categoría preseleccionada al crear desde una columna del tablero. */
  defaultCategoryId?: string
}

export function CredentialDialog({
  open,
  onOpenChange,
  credential,
  onSubmit,
  defaultCategoryId,
}: CredentialDialogProps) {
  const isEditing = Boolean(credential)
  const [tab, setTab] = useState<Tab>('data')
  /** Clave restaurada desde el historial; se aplica al volver a "Datos". */
  const [passwordSeed, setPasswordSeed] = useState('')

  useEffect(() => {
    if (open) {
      setTab('data')
      setPasswordSeed('')
    }
  }, [open])

  const tabClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2 text-[13px] font-medium transition-colors duration-150',
      active
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted hover:text-foreground',
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <div>
          <DialogTitle>
            {isEditing ? 'Editar credencial' : 'Nueva credencial'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Actualiza los datos o vuelve a una clave anterior.'
              : 'Añade una nueva credencial a tu espacio.'}
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      {isEditing && credential && (
        <div
          role="tablist"
          className="flex items-center gap-5 border-b border-border px-4 pt-3 sm:px-5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'data'}
            onClick={() => setTab('data')}
            className={tabClass(tab === 'data')}
          >
            <KeyRound className="size-3.5" /> Datos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'history'}
            onClick={() => setTab('history')}
            className={tabClass(tab === 'history')}
          >
            <History className="size-3.5" /> Historial
          </button>
        </div>
      )}

      <DialogContent>
        {tab === 'history' && credential ? (
          <CredentialHistory
            credentialId={credential.id}
            onUse={(password) => {
              setPasswordSeed(password)
              setTab('data')
            }}
          />
        ) : (
          <CredentialForm
            credential={credential}
            passwordSeed={passwordSeed}
            defaultCategoryId={defaultCategoryId}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
