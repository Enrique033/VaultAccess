import type { Category } from '@/types'

/** Filtros especiales compartidos por Access, Links y Notas. */
export const FAVORITES = 'favorites'
export const NONE = 'none'

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
