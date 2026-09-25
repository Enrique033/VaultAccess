import type { Category, CategoryModule } from '@/types'

/** Filtros especiales compartidos por Access, Links y Notas. */
export const FAVORITES = 'favorites'
export const NONE = 'none'

/**
 * Una columna archivada está oculta del tablero, pero no borrada: sus registros
 * siguen apuntando a ella y vuelven a su sitio al restaurarla.
 */
export function isArchived(category: Category): boolean {
  return Boolean(category.archivedAt)
}

/**
 * Columnas que se ven en un tablero: las de ese módulo y sin archivar.
 *
 * Es el único sitio donde se decide qué columnas existen para el usuario, así
 * que Access, Links, Notas y el panel de Archivados no pueden discrepar.
 */
export function activeCategories(
  categories: Category[],
  module: CategoryModule,
): Category[] {
  return categories.filter(
    (category) => category.module === module && !category.archivedAt,
  )
}

/** Columnas archivadas de cualquier módulo, de la más reciente a la más antigua. */
export function archivedCategories(categories: Category[]): Category[] {
  return categories
    .filter(isArchived)
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
}

/** Nombre legible del tablero al que pertenece una columna. */
export function moduleLabel(module: CategoryModule): string {
  return module === 'credential' ? 'Access' : module === 'link' ? 'Links' : 'Notas'
}

export interface CategorizedItem {
  categoryId?: string
  favorite: boolean
}

export function categoryForItem(
  item: CategorizedItem,
  categories: Category[],
): Category | undefined {
  return item.categoryId
    ? categories.find((category) => category.id === item.categoryId)
    : undefined
}

/**
 * Un item sin categoría es sólo el que no tiene categoryId. Una referencia
 * antigua/no encontrada no se disfraza como "Sin categoría"; queda detectable
 * mediante isOrphanedCategoryItem.
 */
export function isUncategorized(item: CategorizedItem): boolean {
  return !item.categoryId
}

export function isOrphanedCategoryItem(
  item: CategorizedItem,
  categories: Category[],
): boolean {
  return Boolean(item.categoryId && !categoryForItem(item, categories))
}

/** Regla única de filtrado para los tres módulos del Vault. */
export function matchesCategoryFilter(
  item: CategorizedItem,
  categoryFilter: string | null,
  sectionId: string | null,
  categories: Category[],
): boolean {
  if (categoryFilter === FAVORITES) return item.favorite
  if (categoryFilter === NONE) return isUncategorized(item)
  if (categoryFilter) return item.categoryId === categoryFilter

  if (sectionId) {
    return categoryForItem(item, categories)?.sectionId === sectionId
  }

  return true
}

export function countByCategory(
  items: CategorizedItem[],
  categoryId: string,
): number {
  return items.filter((item) => item.categoryId === categoryId).length
}

export function countUncategorized(items: CategorizedItem[]): number {
  return items.filter(isUncategorized).length
}

export function countFavorites(items: CategorizedItem[]): number {
  return items.filter((item) => item.favorite).length
}
