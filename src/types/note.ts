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
}