import { useCallback, useMemo } from 'react'
import { UNCATEGORIZED_COLUMN } from '@/lib/vault-board'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { pickCategoryColor } from '@/lib/category-colors'
import { activeCategories } from '@/lib/vault-filters'

type Module = 'credential' | 'link' | 'note'

/**
 * Acciones compartidas por los tableros de Access, Links y Notas.
 *
 * Cada módulo tiene sus propias columnas: `addCategory` siempre marca la nueva
 * con `module`, así que renombrar o borrar una columna en Access no toca las
 * de Links ni las de Notas. Las columnas archivadas tampoco salen del tablero.
 *
 * Renombrar o borrar una columna real es directo (el store lo resuelve). Lo
 * especial es la columna «Sin categoría»: no es una categoría real, es un
 * cajón sintético. Para que se comporte como las demás, al renombrarla se
 * **crea una categoría de verdad** con ese nombre y se trasladan allí todos
 * los registros sueltos; a partir de ese momento ya es una columna normal
 * (editable, archivable y eliminable como el resto).
 */
export function useBoardColumnActions(module: Module) {
  const sections = useVaultStore((s) => s.sections)
  const allCategories = useVaultStore((s) => s.categories)
  /** Cada módulo ve sólo sus propias columnas y ninguna archivada. */
  const categories = useMemo(
    () => activeCategories(allCategories, module),
    [allCategories, module],
  )
  const addSection = useVaultStore((s) => s.addSection)
  const addCategory = useVaultStore((s) => s.addCategory)
  const renameCategory = useVaultStore((s) => s.renameCategory)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)
  const credentials = useVaultStore((s) => s.credentials)
  const links = useVaultStore((s) => s.links)
  const notes = useVaultStore((s) => s.notes)
  const updateCredential = useVaultStore((s) => s.updateCredential)
  const updateLink = useVaultStore((s) => s.updateLink)
  const updateNote = useVaultStore((s) => s.updateNote)

  /** Mueve un registro a una columna, sea real o el cajón sin categoría. */
  const moveToColumn = useCallback(
    async (id: string, categoryId: string | undefined) => {
      if (module === 'credential') await updateCredential(id, { categoryId })
      else if (module === 'link') await updateLink(id, { categoryId })
      else await updateNote(id, { categoryId })
    },
    [module, updateCredential, updateLink, updateNote],
  )

  const renameColumn = useCallback(
    async (columnId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return

      // Columna real: el store la renombra directamente.
      if (columnId !== UNCATEGORIZED_COLUMN) {
        try {
          await renameCategory(columnId, trimmed)
          toast.success('Columna renombrada')
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : 'No se pudo renombrar',
          )
        }
        return
      }

      /*
        "Sin categoría" no existe en la base: al darle nombre se convierte en
        una columna real y sus registros se trasladan a ella.
      */
      try {
        let sectionId = sections[0]?.id
        if (!sectionId) sectionId = (await addSection('General')).id
        const created = await addCategory({
          name: trimmed,
          sectionId,
          module,
          color: pickCategoryColor(categories.length),
        })

        const loose =
          module === 'credential'
            ? credentials.filter((c) => !c.categoryId)
            : module === 'link'
              ? links.filter((l) => !l.categoryId)
              : notes.filter((n) => !n.categoryId)

        for (const item of loose) {
          await moveToColumn(item.id, created.id)
        }
        toast.success(
          loose.length ? `Columna creada con ${loose.length} registros` : 'Columna creada',
        )
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo crear la columna')
      }
    },
    [
      addCategory,
      addSection,
      categories.length,
      credentials,
      links,
      module,
      moveToColumn,
      notes,
      renameCategory,
      sections,
    ],
  )

  const deleteColumn = useCallback(
    async (columnId: string, itemLabel: string) => {
      // El cajón «Sin categoría» no se borra: no existe como categoría.
      if (columnId === UNCATEGORIZED_COLUMN) {
        toast.error('Esa columna no se puede eliminar')
        return
      }
      const target = categories.find((c) => c.id === columnId)
      if (!target) return
      const inside =
        module === 'credential'
          ? credentials.filter((c) => c.categoryId === columnId).length
          : module === 'link'
            ? links.filter((l) => l.categoryId === columnId).length
            : notes.filter((n) => n.categoryId === columnId).length
      const plural = inside === 1 ? itemLabel.slice(0, -1) : itemLabel
      const confirmed = window.confirm(
        inside > 0
          ? `¿Eliminar la columna "${target.name}"?\n\nTus ${inside} ${plural} NO se borran, pero se quedan sin columna (en "Sin categoría"). Si prefieres conservarlas agrupadas, cancélalo y muévelas antes.`
          : `¿Eliminar la columna "${target.name}"?`,
      )
      if (!confirmed) return
      try {
        await deleteCategory(columnId)
        toast.success('Columna eliminada')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
      }
    },
    [categories, credentials, links, module, notes, deleteCategory],
  )

  return { renameColumn, deleteColumn }
}