import type { Attachment } from './attachment'

export interface Note {
  id: string
  title: string
  content: string
  /** Anotaciones adicionales, en el panel derecho de la nota. */
  comments?: string
  categoryId?: string
  attachments?: Attachment[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  /**
   * Fecha de archivado (ISO). Una nota archivada sale del tablero y pasa al
   * panel «Archivados», sin perder su columna ni sus imágenes.
   */
  archivedAt?: string
}