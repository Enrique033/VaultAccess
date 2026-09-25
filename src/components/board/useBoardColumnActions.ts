import { useCallback } from 'react'
import { UNCATEGORIZED_COLUMN } from '@/lib/vault-board'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { pickCategoryColor } from '@/lib/category-colors'

type Module = 'credential' | 'link' | 'note'

/**
 * Acciones compartidas por los tableros de Access, Links y Notas.
 *
 * Renombrar o borrar una columna real es directo (el store lo resuelve). Lo
 * especial es la columna «Sin categoría»: no es una categoría real, es un
 * cajón sintético. Para que se comporte como las demás, al renombrarla se
 * **crea una categoría de verdad** con ese nombre y se trasladan allí todos
 * los registros sueltos; a partir de ese momento ya es una columna normal
 * (editable y eliminable como el resto).
 */
export function useBoardColumnActions(module: Module) {
  const sections = useVaultStore((s) => s.sections)
  const categories = useVaultStore((s) => s.categories)
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
      const confirmed = window.confirm(
        `¿Eliminar la columna "${target.name}"? Tus ${itemLabel} quedarán sin columna.`,
      )
      if (!confirmed) return
      try {
        await deleteCategory(columnId)
        toast.success('Columna eliminada')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
      }
    },
    [categories, deleteCategory],
  )

  return { renameColumn, deleteColumn }
}