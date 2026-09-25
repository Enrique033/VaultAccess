import {
  ExternalLink,
  Link2,
  MoreVertical,
  Pencil,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { AttachmentPreview } from '@/components/attachments/AttachmentPreview'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
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

  const handleOpen = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer')
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
    <Card className="group surface-card-hover p-3.5">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Link2 className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit(link)}
            title="Abrir para editar"
            className="block w-full text-left"
          >
            <span className="flex items-center gap-1.5">
              <h3 className="truncate text-[13px] font-bold text-foreground transition-colors group-hover:text-primary">
                {link.title}
              </h3>
              {link.favorite && (
                <Star className="size-3 shrink-0 fill-primary text-primary" />
              )}
            </span>
          </button>
          <p className="truncate text-[11px] text-muted">{hostOf(link.url)}</p>
        </div>
      </div>

      {link.description && (
        <p className="mt-2 line-clamp-2 text-[11px] text-muted">
          {link.description}
        </p>
      )}

      <AttachmentPreview
        attachments={link.attachments}
        kind="link"
        recordId={link.id}
        compact
      />

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-surface/70 px-2 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-primary/35 hover:bg-primary-soft hover:text-primary"
        >
          <ExternalLink className="size-3.5" />
          Abrir
        </button>
        <span className="shrink-0">
          <CopyButton
            value={link.url}
            label="Copiar URL"
            successMessage="URL copiada"
            className="rounded-md border border-border !p-1.5"
          />
        </span>
        <span className="shrink-0">
          <DropdownMenu
            contentClassName="min-w-[13rem]"
            trigger={<MoreVertical className="size-4" />}
          >
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
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" onClick={() => onDelete(link)}>
              <Trash2 className="size-3.5" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenu>
        </span>
      </div>
    </Card>
  )
}
