import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { CredentialForm, type CredentialFormValues } from './CredentialForm'
import type { Credential } from '@/types'

interface CredentialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential?: Credential
  onSubmit: (values: CredentialFormValues) => void
}

export function CredentialDialog({
  open,
  onOpenChange,
  credential,
  onSubmit,
}: CredentialDialogProps) {
  const isEditing = Boolean(credential)

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-xl">
      <DialogHeader>
        <div>
          <DialogTitle>
            {isEditing ? 'Editar credencial' : 'Nueva credencial'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Actualiza los datos de la credencial.'
              : 'Añade una nueva credencial a tu vault.'}
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <DialogContent>
        <CredentialForm
          credential={credential}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}