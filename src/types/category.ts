export interface VaultSection {
  id: string
  name: string
}

export interface Category {
  id: string
  name: string
  color: string
  sectionId: string
  /** Categoría padre; undefined = categoría raíz de la sección. */
  parentId?: string
  /** Orden estable dentro de la misma sección y padre. */
  sortOrder: number
}
