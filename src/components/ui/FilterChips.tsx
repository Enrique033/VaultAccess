import { ShieldAlert, SlidersHorizontal, X } from 'lucide-react'
import { useSearchStore } from '@/store/search.store'
import type { Category, VaultSection } from '@/types'

const FAVORITES = 'favorites'
const NONE = 'none'

interface FilterChipsProps {
  sections: VaultSection[]
  categories: Category[]
}

/**
 * Chips de filtros activos (sección, categoría, favoritos, sin categoría,
 * búsqueda) con botón "Limpiar". No renderiza nada si no hay filtros.
 */
export function FilterChips({ sections, categories }: FilterChipsProps) {
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const query = useSearchStore((s) => s.query)
  const weakOnly = useSearchStore((s) => s.weakOnly)
  const setSectionId = useSearchStore((s) => s.setSectionId)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)
  const setQuery = useSearchStore((s) => s.setQuery)
  const setWeakOnly = useSearchStore((s) => s.setWeakOnly)

  const activeSection = sections.find((s) => s.id === sectionId) ?? null
  const activeCategory = categories.find((c) => c.id === categoryFilter) ?? null
  const hasFilters =
    sectionId !== null ||
    categoryFilter !== null ||
    weakOnly ||
    query.trim() !== ''

  if (!hasFilters) return null

  const chip =
    'inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-primary-soft hover:text-primary'

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-1 text-muted">
        <SlidersHorizontal className="size-3.5" /> Filtros:
      </span>
      {activeSection && (
        <button
          type="button"
          onClick={() => setSectionId(null)}
          className={chip}
        >
          Sección: {activeSection.name}
          <X className="size-3 text-muted" />
        </button>
      )}
      {categoryFilter === FAVORITES && (
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={chip}
        >
          Favoritos
          <X className="size-3 text-muted" />
        </button>
      )}
      {categoryFilter === NONE && (
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={chip}
        >
          Sin categoría
          <X className="size-3 text-muted" />
        </button>
      )}
      {weakOnly && (
        <button
          type="button"
          onClick={() => setWeakOnly(false)}
          className={chip}
        >
          <ShieldAlert className="size-3" />
          Claves débiles
          <X className="size-3 text-muted" />
        </button>
      )}
      {activeCategory && (
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className={chip}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: activeCategory.color }}
          />
          {activeCategory.name}
          <X className="size-3 text-muted" />
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setSectionId(null)
          setCategoryFilter(null)
          setWeakOnly(false)
          setQuery('')
        }}
        className="text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        Limpiar
      </button>
    </div>
  )
}
