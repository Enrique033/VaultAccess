export interface Credential {
  id: string
  title: string
  username: string
  password: string
  url?: string
  categoryId?: string
  notes?: string
  favorite: boolean
  createdAt: string
  updatedAt: string
}