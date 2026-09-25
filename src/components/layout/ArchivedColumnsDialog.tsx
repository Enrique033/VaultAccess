import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Info, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import {
  archivedCategories,
  countByCategory,
  moduleLabel,
} from '@/lib/vault-filters'
import { cn } from '@/lib/utils'
import type { Category, CategoryModule } from '@/types'

interface ArchivedColumnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Singular y plural de cada tipo de registro, para los contadores. */
function recordLabel(module: CategoryModule, count: number): string {
  if (module === 'credential')
    return count === 1 ? '1 credencial' : `${count} credenciales`
  if (module === 'link') return count === 1 ? '1 enlace' : `${count} enlaces`
  return count === 1 ? '1 nota' : `${count} notas`
}

/** Formato corto de la fecha de archivado, en español. */
function archivedOn(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Panel «Archivados», desde el icono de cuenta.
 *
 * Archivar **no borra**: la columna sale del tablero y sus registros siguen
 * apuntando a ella. Por eso este panel es el único sitio donde se recupera o
 * se elimina de verdad — eliminar sí suelta los registros, dejándolos en
 * «Sin categoría» de su propio tablero.
 */
export function ArchivedColumnsDialog({
  open,
  onOpenChange,
}: ArchivedColumnsDialogProps) {
  const allCategories = useVaultStore((s) => s.categories)
  const credentials = useVaultStore((s) => s.credentials)
  const links = useVaultStore((s) => s.links)
  const notes = useVaultStore((s) => s.notes)
  const linksLoaded = useVaultStore((s) => s.linksLoaded)
  const notesLoaded = useVaultStore((s) => s.notesLoaded)
  const linksLoading = useVaultStore((s) => s.linksLoading)
  const notesLoading = useVaultStore((s) => s.notesLoading)
  const loadLinks = useVaultStore((s) => s.loadLinks)
  const loadNotes = useVaultStore((s) => s.loadNotes)
  const setCategoryArchived = useVaultStore((s) => s.setCategoryArchived)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)

  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)

  const archived = useMemo(
    () => archivedCategories(allCategories),
    [allCategories],
  )

  /*
    Enlaces y notas se cargan bajo demanda en la app. Aquí se piden al abrir el
    panel para que el contador de cada columna sea el de verdad y no un cero
    engañoso.
  */
  useEffect(() => {
    if (!open) return
    if (!linksLoaded && !linksLoading) void loadLinks()
    if (!notesLoaded && !notesLoading) void loadNotes()
  }, [
    open,
    linksLoaded,
    linksLoading,
    notesLoaded,
    notesLoading,
    loadLinks,
    loadNotes,
  ])

  /** Cuántos registros guarda todavía la columna, según su tablero. */
  const countFor = (category: Category): number => {
    if (category.module === 'credential') return countByCategory(credentials, category.id)
    if (category.module === 'link') return countByCategory(links, category.id)
    return countByCategory(notes, category.id)
  }

  const restore = async (category: Category) => {
    setBusyId(category.id)
    try {
      await setCategoryArchived(category.id, false)
      toast.success(`"${category.name}" vuelve a ${moduleLabel(category.module)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo recuperar')
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    setBusyId(target.id)
    try {
      await deleteCategory(target.id)
      toast.success('Columna eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
        <DialogHeader>
          <div>
            <DialogTitle>Columnas archivadas</DialogTitle>
            <DialogDescription>
              Al archivar, la columna sale del tablero pero sus registros no se
              borran: siguen guardados y vuelven a su sitio al recuperarla.
            </DialogDescription>
          </div>
          <DialogCloseButton onClick={() => onOpenChange(false)} />
        </DialogHeader>

        <DialogContent>
          {archived.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <Archive className="size-7 text-muted" />
              <p className="text-sm font-semibold text-foreground">
                No hay nada archivado
              </p>
              <p className="text-xs text-muted">
                Usa «Archivar columna» en los 3 puntitos de cualquier columna del
                tablero para guardarla aquí sin perder sus tarjetas.
              </p>
            </div>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto overscroll-contain">
              {archived.map((category) => {
                const count = countFor(category)
                return (
                  <li
                    key={category.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {category.name}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {moduleLabel(category.module)} ·{' '}
                        {recordLabel(category.module, count)}
                        {category.archivedAt
                          ? ` · archivada el ${archivedOn(category.archivedAt)}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyId === category.id}
                        onClick={() => void restore(category)}
                      >
                        <ArchiveRestore className="size-3.5" /> Recuperar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar la columna ${category.name}`}
                        title="Eliminar para siempre"
                        disabled={busyId === category.id}
                        onClick={() => setPendingDelete(category)}
                        className={cn('text-muted hover:text-danger')}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {archived.length > 0 && (
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted">
              <Info className="mt-px size-3.5 shrink-0" />
              Recuperar devuelve la columna con todas sus tarjetas. Eliminar la
              borra y deja sus registros sin columna, en «Sin categoría».
            </p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null)
        }}
        title="Eliminar la columna"
        description={
          pendingDelete
            ? `Se eliminará "${pendingDelete.name}" para siempre. Sus registros quedarán sin columna en ${moduleLabel(pendingDelete.module)}, pero no se borrarán. Si sólo quieres quitarla del tablero, archívala en su lugar.`
            : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}