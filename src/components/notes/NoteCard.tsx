import { Copy, MoreVertical, NotebookPen, Pencil, Star, StarOff, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { CategoryBadge } from '@/components/ui/CategoryBadge'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { copyToClipboard } from '@/lib/clipboard'
import type { Note } from '@/types'

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const categories = useVaultStore((s) => s.categories)
  const toggleFavorite = useVaultStore((s) => s.toggleNoteFavorite)
  const category = categories.find((c) => c.id === note.categoryId)

  const handleToggleFavorite = async () => {
    try {
      await toggleFavorite(note.id)
      toast.success(
        note.favorite ? 'Eliminada de favoritos' : 'Añadida a favoritos',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar')
    }
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(note.content)
    if (ok) toast.success('Nota copiada')
    else toast.error('No se pudo copiar la nota')
  }

  const updated = new Date(note.updatedAt)
  const dateLabel = Number.isNaN(updated.getTime())
    ? ''
    : updated.toLocaleDateString('es', {
        day: 'numeric',
        month: 'short',
        year: updated.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
      })

  return (
    <Card className="flex h-full flex-col p-4 transition-colors duration-150 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <NotebookPen className="size-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-foreground">
                {note.title}
              </h3>
              {note.favorite && (
                <Star className="size-3 shrink-0 fill-primary text-primary" />
              )}
            </div>
            {dateLabel && (
              <p className="truncate text-[11px] text-muted">Actualizada {dateLabel}</p>
            )}
          </div>
        </div>

        <DropdownMenu trigger={<MoreVertical className="size-4" />}>
          <DropdownMenuItem onClick={() => onEdit(note)}>
            <Pencil className="size-3.5" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopy}>
            <Copy className="size-3.5" /> Copiar contenido
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleToggleFavorite}>
            {note.favorite ? (
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
          <DropdownMenuItem variant="danger" onClick={() => onDelete(note)}>
            <Trash2 className="size-3.5" /> Eliminar
          </DropdownMenuItem>
        </DropdownMenu>
      </div>

      {category && (
        <div className="mt-3">
          <CategoryBadge category={category} />
        </div>
      )}

      <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted">
        {note.content || 'Sin contenido.'}
      </p>

      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={() => onEdit(note)}
          className="w-full rounded-md border border-border px-2 py-1.5 text-xs text-muted transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Ver / editar
        </button>
      </div>
    </Card>
  )
}