import {
  Copy,
  MoreVertical,
  Pencil,
  Star,
  StarOff,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { AttachmentPreview } from '@/components/attachments/AttachmentPreview'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/DropdownMenu'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { copyToClipboard } from '@/lib/clipboard'
import type { Note } from '@/types'

interface NoteBoardCardProps {
  note: Note
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

function shortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

/** Tarjeta compacta de nota para el tablero. */
export function NoteBoardCard({ note, onEdit, onDelete }: NoteBoardCardProps) {
  const toggleFavorite = useVaultStore((s) => s.toggleNoteFavorite)

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

  const dateLabel = shortDate(note.updatedAt)

  return (
    <Card className="group surface-card-hover p-3">
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => onEdit(note)}
          title="Abrir para editar"
          className="min-w-0 flex-1 text-left"
        >
          <h3 className="truncate text-[13px] font-bold text-foreground">
            {note.title}
          </h3>
          {dateLabel && (
            <p className="mt-0.5 truncate text-[11px] text-muted">
              Actualizada {dateLabel}
            </p>
          )}
        </button>
        <span className="shrink-0">
          <DropdownMenu
            contentClassName="min-w-[13rem]"
            trigger={<MoreVertical className="size-4" />}
          >
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
        </span>
      </div>

      <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-muted">
        {note.content || 'Sin contenido.'}
      </p>

      <AttachmentPreview
        attachments={note.attachments}
        kind="note"
        recordId={note.id}
        compact
      />

      {note.favorite && (
        <div className="mt-1.5 flex items-center gap-x-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-primary">
            <Star className="size-3 fill-primary" /> Favorito
          </span>
        </div>
      )}
    </Card>
  )
}
