import type { Category, Credential, LinkItem, Note, VaultSection } from '@/types'

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

/** Fila de vault_links en Supabase. */
export interface LinkRow {
  id: string
  user_id?: string
  category_id: string | null
  title: string
  url: string
  description: string | null
  favorite: boolean
  created_at: string
  updated_at: string
}

export function toLink(row: LinkRow): LinkItem {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    categoryId: row.category_id ?? undefined,
    description: row.description ?? undefined,
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Fila de vault_notes en Supabase. */
export interface NoteRow {
  id: string
  user_id?: string
  category_id: string | null
  title: string
  content: string
  favorite: boolean
  created_at: string
  updated_at: string
}

export function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    categoryId: row.category_id ?? undefined,
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
