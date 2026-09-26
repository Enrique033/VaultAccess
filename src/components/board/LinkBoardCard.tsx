import { useState } from 'react'
import {
  AlignLeft,
  Archive,
  ExternalLink,
  MoreVertical,
  Pencil,
  Share2,
  Star,
  StarOff,
  Trash2,
  Users2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { useVaultStore } from '@/store/vault.store'
import { useWorkspaceStore, workspacesOfItem } from '@/store/workspace.store'
import { ShareItemDialog } from '@/components/sharing/ShareItemDialog'
import { toast } from '@/store/ui.store'
import { copyToClipboard } from '@/lib/clipboard'
import { useArchiveRecord } from './useArchiveRecord'
import type { LinkItem } from '@/types'

interface LinkBoardCardProps {
  link: LinkItem
  onEdit: (link: LinkItem) => void
  onDelete: (link: LinkItem) => void
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** Tarjeta compacta de enlace para el tablero. */
export function LinkBoardCard({ link, onEdit, onDelete }: LinkBoardCardProps) {
  const toggleFavorite = useVaultStore((s) => s.toggleLinkFavorite)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const sharedItems = useWorkspaceStore((s) => s.itemReferences)
  const sharedIn = workspacesOfItem(sharedItems, workspaces, 'link', link.id)
  const [shareOpen, setShareOpen] = useState(false)
  const archiveLink = useArchiveRecord('link', 'enlace')

  const handleOpen = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(link.url)
    if (ok) toast.success('URL copiada')
    else toast.error('No se pudo copiar la URL')
  }

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(link.id)
      toast.success(
        link.favorite ? 'Eliminado de favoritos' : 'Añadido a favoritos',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  return (
    <>
      <Card className="group surface-card-hover p-3">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => onEdit(link)}
            title="Abrir para editar"
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="truncate text-[13px] font-bold text-foreground">
              {link.title}
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted">
              {hostOf(link.url)}
            </p>
          </button>
          <span className="shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <DropdownMenu
              contentClassName="min-w-[13rem]"
              trigger={<MoreVertical className="size-4" />}
            >
              <DropdownMenuItem onClick={handleOpen}>
                <ExternalLink className="size-3.5" /> Abrir enlace
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopy}>
                <ExternalLink className="size-3.5" /> Copiar URL
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(link)}>
                <Pencil className="size-3.5" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleFavorite}>
                {link.favorite ? (
                  <>
                    <StarOff className="size-3.5" /> Quitar de favoritos
                  </>
                ) : (
                  <>
                    <Star className="size-3.5" /> Marcar favorito
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShareOpen(true)}>
                <Share2 className="size-3.5" /> Compartir en equipo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void archiveLink(link)}>
                <Archive className="size-3.5" /> Archivar
              </DropdownMenuItem>
              <DropdownMenuItem variant="danger" onClick={() => onDelete(link)}>
                <Trash2 className="size-3.5" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenu>
          </span>
        </div>

        {link.description && (
          <p className="mt-1.5 line-clamp-2 text-[11px] text-muted">
            {link.description}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          {link.favorite && (
            <span className="inline-flex items-center gap-1 text-primary">
              <Star className="size-3 fill-primary" /> Favorito
            </span>
          )}
          {link.description && (
            <span className="inline-flex items-center gap-1">
              <AlignLeft className="size-3" /> Descripción
            </span>
          )}
          {sharedIn.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users2 className="size-3" /> {sharedIn.length}
            </span>
          )}
        </div>
      </Card>

      <ShareItemDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        kind="link"
        item={link}
      />
    </>
  )
}
