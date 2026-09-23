import {
  ExternalLink,
  MoreVertical,
  Pencil,
  Star,
  StarOff,
  Trash2,
  User,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import { PasswordField } from '@/components/ui/PasswordField'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import type { Credential } from '@/types'

interface CredentialCardProps {
  credential: Credential
  onEdit: (credential: Credential) => void
  onDelete: (credential: Credential) => void
}

export function CredentialCard({
  credential,
  onEdit,
  onDelete,
}: CredentialCardProps) {
  const categories = useVaultStore((s) => s.categories)
  const toggleFavorite = useVaultStore((s) => s.toggleCredentialFavorite)

  const category = categories.find((c) => c.id === credential.categoryId)

  const handleOpenLogin = () => {
    if (!credential.url) return
    window.open(credential.url, '_blank', 'noopener,noreferrer')
  }

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(credential.id)
      toast.success(
        credential.favorite ? 'Eliminado de favoritos' : 'Añadido a favoritos',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  return (
    <Card className="flex h-full flex-col p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {credential.title}
            </h3>
            {credential.favorite && (
              <Star className="size-3.5 shrink-0 fill-primary text-primary" />
            )}
          </div>
          {category && (
            <div className="mt-1.5">
              <CategoryBadge category={category} />
            </div>
          )}
        </div>

        <DropdownMenu trigger={<MoreVertical className="size-4" />}>
          <DropdownMenuItem onClick={() => onEdit(credential)}>
            <Pencil className="size-3.5" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleFavorite}>
            {credential.favorite ? (
              <>
                <StarOff className="size-3.5" />
                Quitar de favoritos
              </>
            ) : (
              <>
                <Star className="size-3.5" />
                Marcar favorito
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="danger"
            onClick={() => onDelete(credential)}
          >
            <Trash2 className="size-3.5" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      {/* Username */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1">
          <User className="size-3.5 shrink-0 text-muted" />
          <span className="flex-1 truncate text-xs text-foreground">
            {credential.username}
          </span>
          <CopyButton
            value={credential.username}
            label="Copiar usuario"
            successMessage="Usuario copiado"
          />
        </div>

        <PasswordField value={credential.password} />
      </div>

      {/* Notes preview */}
      {credential.notes && (
        <p className="mt-3 line-clamp-2 text-xs text-muted">{credential.notes}</p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={!credential.url}
          onClick={handleOpenLogin}
        >
          <ExternalLink className="size-3.5" />
          Abrir login
        </Button>
      </div>
    </Card>
  )
}