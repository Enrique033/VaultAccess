import type { Attachment } from './attachment'

export interface Note {
  id: string
  title: string
  content: string
  categoryId?: string
  attachments?: Attachment[]
  favorite: boolean
  createdAt: string
  updatedAt: string
}