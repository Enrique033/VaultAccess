import type { Category, Credential, VaultSection } from '@/types'

/** Fila de vault_sections en Supabase. */
export interface SectionRow {
  id: string
  user_id?: string
  name: string
  created_at?: string
}

/** Fila de vault_categories en Supabase. */
export interface CategoryRow {
  id: string
  user_id?: string
  section_id: string
  name: string
  color: string
  created_at?: string
}

/** Fila de vault_credentials en Supabase. */
export interface CredentialRow {
  id: string
  user_id?: string
  category_id: string | null
  title: string
  username: string
  password: string
  url: string | null
  notes: string | null
  favorite: boolean
  created_at: string
  updated_at: string
}

export function toSection(row: SectionRow): VaultSection {
  return { id: row.id, name: row.name }
}

export function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, color: row.color, sectionId: row.section_id }
}

export function toCredential(row: CredentialRow): Credential {
  return {
    id: row.id,
    title: row.title,
    username: row.username,
    password: row.password,
    url: row.url ?? undefined,
    categoryId: row.category_id ?? undefined,
    notes: row.notes ?? undefined,
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
