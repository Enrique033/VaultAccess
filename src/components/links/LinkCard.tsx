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
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import { CopyButton } from '@/components/ui/CopyButton'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import type { LinkItem } from '@/types'

interface LinkCardProps {
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

export function LinkCard({ link, onEdit, onDelete }: LinkCardProps) {
  const categories = useVaultStore((s) => s.categories)
  const toggleFavorite = useVaultStore((s) => s.toggleLinkFavorite)
  const category = categories.find((c) => c.id === link.categoryId)

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
    <Card className="surface-card-hover flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${category?.color ?? '#3B82F6'}22` }}
          >
            <Link2
              className="size-4"
              style={{ color: category?.color ?? '#3B82F6' }}
            />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {link.title}
              </h3>
              {link.favorite && (
                <Star className="size-3 shrink-0 fill-primary text-primary" />
              )}
            </div>
            <p className="truncate text-xs text-muted">{hostOf(link.url)}</p>
          </div>
        </div>

        <DropdownMenu trigger={<MoreVertical className="size-4" />}>
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
      </div>

      {category && (
        <div className="mt-3">
          <CategoryBadge category={category} />
        </div>
      )}

      {link.description && (
        <p className="mt-3 line-clamp-2 text-xs text-muted">
          {link.description}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleOpen}
        >
          <ExternalLink className="size-3.5" />
          Abrir enlace
        </Button>
        <CopyButton
          value={link.url}
          label="Copiar URL"
          successMessage="URL copiada"
          className="rounded-md border border-border"
        />
      </div>
    </Card>
  )
}
