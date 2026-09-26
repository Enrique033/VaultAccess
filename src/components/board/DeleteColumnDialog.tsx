import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FolderInput, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { activeCategories } from '@/lib/vault-filters'
import type { Category, CategoryModule } from '@/types'

interface DeleteColumnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Columna a eliminar; `null` = diálogo cerrado. */
  column: Category | null
  module: CategoryModule
  /** Registros de este tablero, para poder moverlos antes de borrar. */
  items: { id: string; categoryId?: string }[]
  /** Singular y plural: «nota» / «notas». */
  one: string
  many: string
}

/**
 * Eliminar una columna.
 *
 * No se archivan columnas: sólo se eliminan, y aquí se explica exactamente qué
 * pasa con lo que había dentro. Nada se borra —las tarjetas quedan sin columna
 * y se ven en «Sin categoría»— pero se pierde la agrupación, así que por eso se
 * ofrece **moverlas a otra columna** antes de continuar.
 */
export function DeleteColumnDialog({
  open,
  onOpenChange,
  column,
  module,
  items,
  one,
  many,
}: DeleteColumnDialogProps) {
  const sections = useVaultStore((s) => s.sections)
  const allCategories = useVaultStore((s) => s.categories)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)
  const updateCredential = useVaultStore((s) => s.updateCredential)
  const updateLink = useVaultStore((s) => s.updateLink)
  const updateNote = useVaultStore((s) => s.updateNote)

  const [targetId, setTargetId] = useState('')
  const [busy, setBusy] = useState(false)

  /** Otras columnas del mismo módulo: candidatas a destino. */
  const destinations = useMemo(
    () =>
      activeCategories(allCategories, module).filter((c) => c.id !== column?.id),
    [allCategories, column, module],
  )

  const inside = useMemo(
    () => (column ? items.filter((item) => item.categoryId === column.id) : []),
    [items, column],
  )
  const total = inside.length

  // Al reabrir se olvida el destino elegido en la apertura anterior.
  useEffect(() => {
    if (open) setTargetId('')
  }, [open, column?.id])

  if (!column) return null
  const moveThenDelete = async () => {
    setBusy(true)
    try {
      for (const item of inside) {
        if (module === 'credential') {
          await updateCredential(item.id, { categoryId: targetId })
        } else if (module === 'link') {
          await updateLink(item.id, { categoryId: targetId })
        } else {
          await updateNote(item.id, { categoryId: targetId })
        }
      }
      await deleteCategory(column.id)
      const where = targetId
        ? `"${destinations.find((c) => c.id === targetId)?.name}"`
        : '«Sin categoría»'
      toast.success(`${total} ${total === 1 ? one : many} en ${where}`)
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la columna')
    } finally {
      setBusy(false)
    }
  }

  const deleteOnly = async () => {
    setBusy(true)
    try {
      await deleteCategory(column.id)
      toast.success('Columna eliminada')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la columna')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogHeader>
        <div>
          <DialogTitle>Eliminar la columna «{column.name}»</DialogTitle>
          <DialogDescription>
            {total === 0
              ? 'La columna está vacía. Eliminarla no afecta a ninguna tarjeta.'
              : `Tiene ${total} ${total === 1 ? one : many}.`}
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <DialogContent className="space-y-4">
        {total > 0 && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-[13px] text-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>
              Al eliminarla,{' '}
              <strong>
                las {total} {total === 1 ? one : many} no se borran
              </strong>
              , pero se quedan <strong>sin columna</strong>: pierden su agrupación
              y aparecerán en «Sin categoría». Si prefieres conservarlas agrupadas,
              muévelas antes.
            </p>
          </div>
        )}

        {total > 0 && destinations.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="delete-column-destination"
              className="text-[13px] font-semibold text-foreground"
            >
              Mover a otra columna (opcional)
            </label>
            <select
              id="delete-column-destination"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Sin columna (se quedan en «Sin categoría»)</option>
              {sections.map((section) => {
                const options = destinations.filter(
                  (c) => c.sectionId === section.id,
                )
                if (options.length === 0) return null
                return (
                  <optgroup key={section.id} label={section.name}>
                    {options.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>
        )}

        {total > 0 && destinations.length === 0 && (
          <p className="text-[12px] text-muted">
            No hay otras columnas donde moverlas, así que se quedarán sin
            columna. Sólo se pierden si las borras tú una a una.
          </p>
        )}
      </DialogContent>

      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => void (targetId ? moveThenDelete() : deleteOnly())}
        >
          {targetId ? (
            <>
              <FolderInput className="size-4" /> Mover y eliminar
            </>
          ) : (
            <>
              <Trash2 className="size-4" /> Eliminar columna
            </>
          )}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}