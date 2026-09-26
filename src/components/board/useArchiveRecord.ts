import { useCallback } from 'react'
import { useVaultStore, type RecordKind } from '@/store/vault.store'
import { toast } from '@/store/ui.store'

/** Lo mínimo que necesita el hook para nombrar el registro en los mensajes. */
interface Archivable {
  id: string
  title: string
  categoryId?: string
}

/**
 * Archivar una tarjeta suelta.
 *
 * No la borra: sale del tablero y espera en el panel «Archivados» del icono de
 * cuenta, conservando su columna y sus imágenes. Es la alternativa a eliminar
 * cuando algo ya no interesa pero todavía no quieres tirarlo.
 */
export function useArchiveRecord(
  kind: RecordKind,
  /** Singular y plural, para los mensajes: «nota» / «notas». */
  one: string,
) {
  const setRecordArchived = useVaultStore((s) => s.setRecordArchived)
  const categories = useVaultStore((s) => s.categories)

  return useCallback(
    async (item: Archivable) => {
      const column = categories.find((category) => category.id === item.categoryId)
      const where = column ? ` (columna "${column.name}")` : ''
      const confirmed = window.confirm(
        `¿Archivar "${item.title}"${where}? No se borra nada: pasará a Archivados y podrás recuperarla cuando quieras.`,
      )
      if (!confirmed) return
      try {
        await setRecordArchived(kind, item.id, true)
        toast.success(`${one.charAt(0).toUpperCase()}${one.slice(1)} archivada`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo archivar')
      }
    },
    [categories, kind, one, setRecordArchived],
  )
}