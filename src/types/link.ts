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
}