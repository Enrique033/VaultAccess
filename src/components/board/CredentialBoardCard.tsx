import { useState } from 'react'
import { Link } from 'react-router'
import {
  AlignLeft,
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
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { ShareItemDialog } from '@/components/sharing/ShareItemDialog'
import { useVaultStore } from '@/store/vault.store'
import {
  useWorkspaceStore,
  workspacesOfCredential,
} from '@/store/workspace.store'
import { toast } from '@/store/ui.store'
import { copyToClipboard } from '@/lib/clipboard'
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

  const handleCopyUsername = async () => {
    const ok = await copyToClipboard(credential.username)
    if (ok) toast.success('Usuario copiado')
    else toast.error('No se pudo copiar el usuario')
  }

  const handleCopyPassword = async () => {
    const ok = await copyToClipboard(credential.password)
    if (ok)
      toast.success(
        'Clave copiada',
        'Se borrará del portapapeles en 30 s (si no copias otra cosa).',
      )
    else toast.error('No se pudo copiar la clave')
  }

  return (
    <>
      <Card className="group surface-card-hover p-3">
        {/* Título: al pulsar se abre la tarjeta, igual que en Trello. */}
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(credential)}
            title="Abrir para editar"
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="truncate text-[13px] font-bold tracking-tight text-foreground">
              {credential.title}
            </h3>
            {credential.username && (
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {credential.username}
              </p>
            )}
          </button>
          <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu
              contentClassName="min-w-[13rem]"
              trigger={<MoreVertical className="size-4" />}
            >
              <DropdownMenuItem onClick={() => onEdit(credential)}>
                <Pencil className="size-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyUsername}>
                <User className="size-3.5" /> Copiar usuario
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyPassword}>
                <Pencil className="size-3.5" /> Copiar clave
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleOpenLogin}
                disabled={!credential.url}
              >
                <ExternalLink className="size-3.5" /> Abrir sitio
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

        {/* Badges: en lugar de campos pesados, sólo lo relevante. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {credential.favorite && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Star className="size-3 fill-primary" /> Favorito
            </span>
          )}
          {credential.notes && (
            <span className="inline-flex items-center gap-1">
              <AlignLeft className="size-3" /> Notas
            </span>
          )}
          {sharedIn.length > 0 && (
            <Link
              to="/workspaces"
              className="inline-flex items-center gap-1 transition-colors hover:text-primary"
            >
              <Users2 className="size-3" /> {sharedIn.length}
            </Link>
          )}
        </div>
      </Card>

      <ShareItemDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        kind="credential"
        item={credential}
      />
    </>
  )
}


