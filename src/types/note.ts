export interface Note {
  id: string
  title: string
  content: string
  categoryId?: string
  favorite: boolean
  createdAt: string
  updatedAt: string
}