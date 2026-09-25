import { FAVORITES, NONE, isUncategorized } from './vault-filters'
import type { CategorizedItem } from './vault-filters'
import type { Category, VaultSection } from '@/types'

/** Identificador de la columna que agrupa lo que no tiene categoría. */
export const UNCATEGORIZED_COLUMN = '__uncategorized__'

/** Una columna del tablero: una categoría concreta o el cajón "Sin categoría". */
export interface BoardColumn<T> {
  /** Id de la categoría, o UNCATEGORIZED_COLUMN. */
  id: string
  name: string
  /** Color de la categoría; `null` para el cajón sin categoría. */
  color: string | null
  sectionId: string | null
  /**
   * Categoría que se preselecciona al crear desde esta columna. Es `''` cuando
   * la columna es un filtro transversal (Favoritas, Sin categoría) y, por
   * tanto, no corresponde a una categoría real.
   */
  addCategoryId: string
  items: T[]
}

export interface BoardOptions {
  sections: VaultSection[]
  categories: Category[]
  /** Categorías seleccionadas por filtro (subcategorías) que se dejan de contar aparte. */
  filter?: string | null
  sectionId?: string | null
}

/**
 * Ordena las categorías como lo hace la sidebar: primero las raíces y luego
 * sus descendientes, respetando `sortOrder` y el nombre como desempate.
 */
function orderedCategories(categories: Category[]): Category[] {
  const children = new Map<string | undefined, Category[]>()
  for (const category of categories) {
    const key = category.parentId ?? undefined
    const bucket = children.get(key)
    if (bucket) bucket.push(category)
    else children.set(key, [category])
  }
  for (const bucket of children.values()) {
    bucket.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
    )
  }
  const result: Category[] = []
  const walk = (parentId: string | undefined) => {
    for (const category of children.get(parentId) ?? []) {
      result.push(category)
      walk(category.id)
    }
  }
  walk(undefined)
  // Cualquier categoría con un padre inexistente se añade al final para no perderse.
  const known = new Set(result.map((category) => category.id))
  for (const category of [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
  )) {
    if (!known.has(category.id)) result.push(category)
  }
  return result
}

/**
 * Agrupa los registros en columnas del tablero.
 *
 * - Con un filtro de favorites/none/categoría hay una sola columna, porque el
 *   tablero debe respetar el filtro activo en lugar de contradecirlo.
 * - Sin filtros, se crea una columna por categoría (en jerarquía) más una
 *   columna final "Sin categoría" si hay registros sueltos.
 */
export function buildBoardColumns<T extends CategorizedItem>(
  items: T[],
  { sections, categories, filter = null, sectionId = null }: BoardOptions,
): BoardColumn<T>[] {
  const byId = new Map(categories.map((category) => [category.id, category]))

  const single = (
    name: string,
    color: string | null,
    match: (item: T) => boolean,
    /** Categoría real a preseleccionar; '' si la columna no es una categoría. */
    addCategoryId: string,
  ): BoardColumn<T>[] => [
    {
      id: filter ?? UNCATEGORIZED_COLUMN,
      name,
      color,
      sectionId: null,
      addCategoryId,
      items: items.filter(match),
    },
  ]

  if (filter === FAVORITES)
    return single('Favoritas', null, (item) => item.favorite, '')
  if (filter === NONE)
    return single('Sin categoría', null, isUncategorized, '')
  if (filter && byId.has(filter)) {
    const category = byId.get(filter)!
    return single(
      category.name,
      category.color,
      (item) => item.categoryId === filter,
      category.id,
    )
  }

  const visibleSections = sectionId
    ? sections.filter((section) => section.id === sectionId)
    : sections
  const sectionIds = new Set(visibleSections.map((section) => section.id))
  const byCategory = new Map<string, T[]>()
  for (const item of items) {
    const bucket = item.categoryId
      ? byCategory.get(item.categoryId)
      : undefined
    if (bucket) bucket.push(item)
    else byCategory.set(item.categoryId ?? UNCATEGORIZED_COLUMN, [item])
  }

  const columns: BoardColumn<T>[] = []
  for (const section of visibleSections) {
    for (const category of orderedCategories(
      categories.filter((c) => c.sectionId === section.id),
    )) {
      /*
        Una columna recién creada está vacía, pero debe verse igual: si se
        filtrara las que no tienen tarjetas, "Crear columna" no mostraría nada
        y el usuario creería que falló. Trello también muestra las listas
        vacías.
      */
      columns.push({
        id: category.id,
        name: category.name,
        color: category.color,
        sectionId: section.id,
        addCategoryId: category.id,
        items: byCategory.get(category.id) ?? [],
      })
    }
  }

  // Registros huérfanos (categoría borrada) se muestran junto a los sin categoría
  // para que el usuario pueda reasignarlos sin quedar invisible.
  const loose = items.filter((item) => {
    if (isUncategorized(item)) return true
    const section = item.categoryId
      ? byId.get(item.categoryId)?.sectionId
      : undefined
    return !section || !sectionIds.has(section)
  })

  /*
    "Sin categoría" se comporta como el resto: aparece siempre que tenga
    registros, pero también cuando el usuario tiene columnas y aún no ha
    movido nada, para que sepa dónde acaba lo que cree sin columna.
  */
  if (loose.length > 0 || columns.length === 0) {
    columns.push({
      id: UNCATEGORIZED_COLUMN,
      name: 'Sin categoría',
      color: null,
      sectionId: null,
      addCategoryId: '',
      items: loose,
    })
  }

  return columns
}
