export interface VaultSection {
  id: string
  name: string
}

/** Módulo al que pertenece una columna. Cada uno tiene las suyas. */
export type CategoryModule = 'credential' | 'link' | 'note'

export interface Category {
  id: string
  name: string
  color: string
  sectionId: string
  /** Módulo propietario: Access, Links o Notas. */
  module: CategoryModule
  /** Categoría padre; undefined = categoría raíz de la sección. */
  parentId?: string
  /** Orden estable dentro de la misma sección y padre. */
  sortOrder: number
  /**
   * Fecha de archivado (ISO). Una columna archivada no sale en el tablero, pero
   * **no se borra**: sus registros siguen apuntando a ella y vuelven a su sitio
   * al restaurarla desde el panel «Archivados». `undefined` = columna activa.
   */
  archivedAt?: string
}
