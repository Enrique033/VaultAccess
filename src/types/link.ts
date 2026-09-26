import type { Attachment } from './attachment'

export interface LinkItem {
  id: string
  title: string
  url: string
  categoryId?: string
  description?: string
  attachments?: Attachment[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  /**
   * Fecha de archivado (ISO). Un enlace archivado sale del tablero y pasa al
   * panel «Archivados», sin perder su columna ni su URL.
   */
  archivedAt?: string
}