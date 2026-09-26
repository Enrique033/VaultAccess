import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  ArchiveRestore,
  Columns3,
  Info,
  LayoutList,
  Trash2,
} from 'lucide-react'
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
import { useVaultStore, type RecordKind } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { archivedCategories, countByCategory, moduleLabel } from '@/lib/vault-filters'
import type { Category, CategoryModule } from '@/types'

interface ArchivedColumnsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Una tarjeta archivada, con el mínimo dato para listarla y recuperarla. */
interface ArchivedRecord {
  id: string
  title: string
  module: CategoryModule
  categoryId?: string
  archivedAt?: string
}

/** Lo que el usuario pidió borrar de verdad, a la espera de confirmar. */
type PendingDelete =
  | { type: 'column'; category: Category }
  | { type: 'record'; record: ArchivedRecord }

/** Singular y plural de cada tipo de registro, para los mensajes. */
function recordLabel(module: CategoryModule, count: number): string {
  if (module === 'credential')
    return count === 1 ? '1 credencial' : `${count} credenciales`
  if (module === 'link') return count === 1 ? '1 enlace' : `${count} enlaces`
  return count === 1 ? '1 nota' : `${count} notas`
}

/** Formato corto de la fecha de archivado, en español. */
function archivedOn(iso: string | undefined): string {
  if (!iso) return ''
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
 * Dos secciones, porque hay dos cosas que se archivan: **columnas** (⋯ de la
 * columna) y **tarjetas** (⋯ de cada credencial, enlace o nota).
 *
 * Archivar no borra nunca. Recuperar devuelve el elemento al tablero; eliminar
 * sí lo destruye, y por eso pide confirmación.
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
  const setRecordArchived = useVaultStore((s) => s.setRecordArchived)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)
  const deleteCredential = useVaultStore((s) => s.deleteCredential)
  const deleteLink = useVaultStore((s) => s.deleteLink)
  const deleteNote = useVaultStore((s) => s.deleteNote)

  /** Clave de la fila ocupada, para deshabilitar sólo ese botón. */
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const columns = useMemo(
    () => archivedCategories(allCategories),
    [allCategories],
  )

  const records = useMemo<ArchivedRecord[]>(() => {
    const toRecords = (
      items: { id: string; title: string; categoryId?: string; archivedAt?: string }[],
      module: CategoryModule,
    ): ArchivedRecord[] =>
      items.filter((item) => item.archivedAt).map((item) => ({ ...item, module }))
    return [
      ...toRecords(credentials, 'credential'),
      ...toRecords(links, 'link'),
      ...toRecords(notes, 'note'),
    ].sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
  }, [credentials, links, notes])

  /*
    Enlaces y notas se cargan bajo demanda en la app. Aquí se piden al abrir el
    panel para que no salga una lista vacía cuando lo que hay son cosas sin cargar.
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

  const restoreColumn = async (category: Category) => {
    setBusyKey(`col:${category.id}`)
    try {
      const moved = await setCategoryArchived(category.id, false)
      toast.success(
        moved > 0
          ? `"${category.name}" vuelve con ${recordLabel(category.module, moved)}`
          : `"${category.name}" vuelve a ${moduleLabel(category.module)}`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo recuperar')
    } finally {
      setBusyKey(null)
    }
  }

  const restoreRecord = async (record: ArchivedRecord) => {
    setBusyKey(`rec:${record.id}`)
    try {
      const { restoredColumn } = await setRecordArchived(
        record.module as RecordKind,
        record.id,
        false,
      )
      if (restoredColumn) {
        // La columna estaba archivada, así que se recuperó con ella: si no, la
        // tarjeta habría quedado colgando de una columna invisible.
        toast.success(
          `"${record.title}" vuelve a "${restoredColumn}" · su columna se recuperó también`,
        )
        return
      }
      const column = allCategories.find((c) => c.id === record.categoryId)
      toast.success(
        column
          ? `"${record.title}" vuelve a "${column.name}"`
          : `"${record.title}" vuelve al tablero, sin columna`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo recuperar')
    } finally {
      setBusyKey(null)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    setPendingDelete(null)
    setBusyKey(
      target.type === 'column' ? `col:${target.category.id}` : `rec:${target.record.id}`,
    )
    try {
      if (target.type === 'column') {
        await deleteCategory(target.category.id)
        toast.success('Columna eliminada')
      } else {
        const record = target.record
        if (record.module === 'credential') await deleteCredential(record.id)
        else if (record.module === 'link') await deleteLink(record.id)
        else await deleteNote(record.id)
        toast.success('Registro eliminado')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setBusyKey(null)
    }
  }
  const isEmpty = columns.length === 0 && records.length === 0
  const row =
    'flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5'
  const iconBtn =
    'shrink-0 text-muted transition-colors hover:text-danger disabled:opacity-50'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
        <DialogHeader>
          <div>
            <DialogTitle>Tarjetas archivadas</DialogTitle>
            <DialogDescription>
              Archivar una tarjeta la esconde del tablero sin borrarla: sigue
              aquí, con su contenido y sus imágenes, y vuelve cuando la
              recuperes.
            </DialogDescription>
          </div>
          <DialogCloseButton onClick={() => onOpenChange(false)} />
        </DialogHeader>

        <DialogContent className="space-y-4">
          {isEmpty && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <Archive className="size-7 text-muted" />
              <p className="text-sm font-semibold text-foreground">
                No hay nada archivado
              </p>
              <p className="text-xs text-muted">
                Usa «Archivar» en los 3 puntitos de cualquier credencial, enlace
                o nota. Aquí podrás recuperarlas o eliminarlas.
              </p>
            </div>
          )}

          {columns.length > 0 && (
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <Columns3 className="size-3.5" /> Columnas ({columns.length})
              </h3>
              <p className="mb-1.5 text-[11px] text-muted">
                Ya no se archivan columnas: aquí sólo aparecen las que quedaron
                archivadas antes de este cambio. Recupéralas para volver a usarlas
                o elimínalas si ya no las quieres.
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
                {columns.map((category) => (
                  <li key={category.id} className={row}>
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
                        {recordLabel(category.module, countFor(category))}
                        {category.archivedAt &&
                          ` · archivada el ${archivedOn(category.archivedAt)}`}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busyKey === `col:${category.id}`}
                      onClick={() => void restoreColumn(category)}
                    >
                      <ArchiveRestore className="size-3.5" /> Recuperar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={iconBtn}
                      aria-label={`Eliminar la columna ${category.name}`}
                      title="Eliminar para siempre"
                      disabled={busyKey === `col:${category.id}`}
                      onClick={() => setPendingDelete({ type: 'column', category })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {records.length > 0 && (
            <section>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <LayoutList className="size-3.5" /> Tarjetas ({records.length})
              </h3>
              <ul className="max-h-56 space-y-2 overflow-y-auto overscroll-contain">
                {records.map((record) => {
                  const column = allCategories.find(
                    (category) => category.id === record.categoryId,
                  )
                  return (
                    <li key={record.id} className={row}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {record.title}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {moduleLabel(record.module)}
                          {column ? ` · ${column.name}` : ''}
                          {record.archivedAt &&
                            ` · archivada el ${archivedOn(record.archivedAt)}`}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busyKey === `rec:${record.id}`}
                        onClick={() => void restoreRecord(record)}
                      >
                        <ArchiveRestore className="size-3.5" /> Recuperar
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={iconBtn}
                        aria-label={`Eliminar ${record.title}`}
                        title="Eliminar para siempre"
                        disabled={busyKey === `rec:${record.id}`}
                        onClick={() => setPendingDelete({ type: 'record', record })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {!isEmpty && (
            <p className="flex items-start gap-1.5 pt-1 text-[11px] text-muted">
              <Info className="mt-px size-3.5 shrink-0" />
              Archivar una tarjeta no la borra: la esconde del tablero y la deja
              aquí, con su contenido y sus imágenes. Recuperar la devuelve a su
              columna; eliminar sí la destruye.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null)
        }}
        title={
          pendingDelete?.type === 'column'
            ? 'Eliminar la columna'
            : 'Eliminar el registro'
        }
        description={
          pendingDelete?.type === 'column'
            ? `Se eliminará "${pendingDelete.category.name}" para siempre. Sus registros quedarán sin columna, pero no se borrarán.`
            : pendingDelete?.type === 'record'
              ? `Se eliminará "${pendingDelete.record.title}" para siempre. Esta vez sí se borra, con su contenido y sus imágenes.`
              : undefined
        }
        confirmLabel="Eliminar"
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
