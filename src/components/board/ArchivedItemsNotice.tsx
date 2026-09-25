import { useMemo } from 'react'
import { Archive, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import { useUIStore } from '@/store/ui.store'
import type { CategorizedItem } from '@/lib/vault-filters'
import type { CategoryModule } from '@/types'

interface ArchivedItemsNoticeProps {
  module: CategoryModule
  /** Registros de este tablero (los ya filtrados por búsqueda, si los hay). */
  items: CategorizedItem[]
  /** Singular y plural, para redactar el aviso: «1 nota» / «3 notas». */
  one: string
  many: string
}

/**
 * Aviso de tarjetas que están en columnas archivadas.
 *
 * Al archivar una columna sus tarjetas no se sueltan: siguen apuntando a ella,
 * así que el tablero las muestra en «Sin categoría» para que no se pierdan ni
 * se puedan arrastrar a la ciegas. Sin este aviso el efecto es desconcertante:
 * parece que hubiera aparecido una columna nueva de la nada.
 */
export function ArchivedItemsNotice({
  module,
  items,
  one,
  many,
}: ArchivedItemsNoticeProps) {
  const archivedIds = useVaultStore((s) => s.categories)
  const openArchived = useUIStore((s) => s.setArchivedColumnsOpen)

  const count = useMemo(() => {
    const ids = new Set(
      archivedIds
        .filter((category) => category.module === module && category.archivedAt)
        .map((category) => category.id),
    )
    if (ids.size === 0) return 0
    return items.filter((item) => item.categoryId && ids.has(item.categoryId)).length
  }, [archivedIds, items, module])

  if (count === 0) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-primary/25 bg-primary-soft/60 px-4 py-3 text-[13px] text-foreground"
    >
      <Archive className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">
          {count === 1 ? `1 ${one}` : `${count} ${many}`} en columnas archivadas.
        </span>{' '}
        Las ves en «Sin categoría» y vuelven a su columna en cuanto la
        recuperes.
      </p>
      <Button
        variant="primary"
        size="sm"
        onClick={() => openArchived(true)}
        className="shrink-0"
      >
        Ver archivados <ArrowRight className="size-3.5" />
      </Button>
    </div>
  )
}