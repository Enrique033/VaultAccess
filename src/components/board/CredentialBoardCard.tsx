import { useState } from 'react'
import { Link } from 'react-router'
import {
  ExternalLink,
  MoreVertical,
  Pencil,
  Share2,
  Star,
  StarOff,
  Trash2,
  User,
  Users2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { PasswordField } from '@/components/ui/PasswordField'
import { AttachmentPreview } from '@/components/attachments/AttachmentPreview'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { ShareCredentialDialog } from '@/components/credentials/ShareCredentialDialog'
import { useVaultStore } from '@/store/vault.store'
import {
  useWorkspaceStore,
  workspacesOfCredential,
} from '@/store/workspace.store'
import { toast } from '@/store/ui.store'
import type { Credential } from '@/types'

interface CredentialBoardCardProps {
  credential: Credential
  onEdit: (credential: Credential) => void
  onDelete: (credential: Credential) => void
}

/** Tarjeta compacta para el tablero: mismo lenguaje visual que `CredentialCard`. */
export function CredentialBoardCard({
  credential,
  onEdit,
  onDelete,
}: CredentialBoardCardProps) {
  const toggleFavorite = useVaultStore((s) => s.toggleCredentialFavorite)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const sharedItems = useWorkspaceStore((s) => s.itemReferences)
  const [shareOpen, setShareOpen] = useState(false)

  const sharedIn = workspacesOfCredential(
    sharedItems,
    workspaces,
    credential.id,
  )

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
    <>
      <Card className="group surface-card-hover p-3.5">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onEdit(credential)}
            title="Abrir para editar"
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="truncate text-[13px] font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {credential.title}
            </h3>
          </button>
          {credential.favorite && (
            <Star className="mt-0.5 size-3.5 shrink-0 fill-primary text-primary" />
          )}
        </div>

        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-border bg-elevated/60 px-2 py-1.5">
          <User className="size-3 shrink-0 text-muted" />
          <span className="flex-1 truncate text-[11px] text-foreground">
            {credential.username}
          </span>
          <CopyButton
            value={credential.username}
            label="Copiar usuario"
            successMessage="Usuario copiado"
          />
        </div>

        <div className="mt-1.5">
          <PasswordField value={credential.password} className="!px-2 !py-1.5" />
        </div>

        {credential.notes && (
          <p className="mt-2 line-clamp-2 text-[11px] text-muted">
            {credential.notes}
          </p>
        )}

        <AttachmentPreview
          attachments={credential.attachments}
          kind="credential"
          recordId={credential.id}
          compact
        />

        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleOpenLogin}
            disabled={!credential.url}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface/70 px-2 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary-soft hover:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            <ExternalLink className="size-3.5" />
            Abrir
          </button>

          {sharedIn.length > 0 && (
            <Link
              to="/workspaces"
              title={sharedIn.map((w) => w.name).join(', ')}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted transition-colors hover:border-primary/35 hover:bg-primary-soft hover:text-primary"
            >
              <Users2 className="size-3.5" />
              {sharedIn.length}
            </Link>
          )}

          <span className="shrink-0">
            <DropdownMenu
              contentClassName="min-w-[13rem]"
              trigger={<MoreVertical className="size-4" />}
            >
              <DropdownMenuItem onClick={() => onEdit(credential)}>
                <Pencil className="size-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleFavorite}>
                {credential.favorite ? (
                  <>
                    <StarOff className="size-3.5" /> Quitar de favoritos
                  </>
                ) : (
                  <>
                    <Star className="size-3.5" /> Marcar favorito
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <Share2 className="size-3.5" /> Compartir en equipo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="danger"
                onClick={() => onDelete(credential)}
              >
                <Trash2 className="size-3.5" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenu>
          </span>
        </div>
      </Card>

      <ShareCredentialDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        credential={credential}
      />
    </>
  )
}


