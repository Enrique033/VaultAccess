import type { Attachment } from './attachment'

export interface Credential {
  id: string
  title: string
  username: string
  password: string
  url?: string
  categoryId?: string
  notes?: string
  attachments?: Attachment[]
  favorite: boolean
  createdAt: string
  updatedAt: string
  /**
   * Fecha de archivado (ISO). Una credencial archivada sale del tablero y pasa
   * al panel «Archivados», sin perder su columna ni sus datos.
   */
  archivedAt?: string
}