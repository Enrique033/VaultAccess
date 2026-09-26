import { supabase } from './supabase'
import {
  getVaultSessionGeneration,
  requireActiveVaultSession,
} from './vault-session'
import {
  decryptPersonal,
  encryptPersonal,
  type CategoryPayload,
  type CredentialPayload,
  type HistoryPayload,
  type LinkPayload,
  type NotePayload,
  type SectionPayload,
} from './vault-payloads'
import type {
  Category,
  Credential,
  LinkItem,
  Note,
  PasswordHistoryEntry,
  VaultSection,
} from '@/types'

type PersonalKind = 'section' | 'category' | 'credential' | 'link' | 'note' | 'history'

export interface EncryptedRow {
  id: string
  encrypted_payload?: string | null
}

export interface CredentialRow extends EncryptedRow {
  category_id: string | null
  title?: string | null
  username?: string | null
  password?: string | null
  url?: string | null
  notes?: string | null
  favorite: boolean
  /** `null`/ausente = credencial activa. */
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export interface LinkRow extends EncryptedRow {
  category_id: string | null
  title?: string | null
  url?: string | null
  description?: string | null
  favorite: boolean
  /** `null`/ausente = enlace activo. */
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export interface NoteRow extends EncryptedRow {
  category_id: string | null
  title?: string | null
  content?: string | null
  favorite: boolean
  /** `null`/ausente = nota activa. */
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export interface HistoryRow extends EncryptedRow {
  credential_id: string
  password?: string | null
  changed_at: string
}

export interface SectionRow extends EncryptedRow {
  name?: string | null
}

export interface CategoryRow extends EncryptedRow {
  section_id: string
  parent_id?: string | null
  sort_order?: number | null
  module?: string | null
  /** `null`/ausente = columna activa. */
  archived_at?: string | null
  color: string
  name?: string | null
}

function required(value: string | null | undefined, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`No se pudo descifrar ${field}: el registro está incompleto.`)
  }
  return value
}

function tableForKind(kind: PersonalKind): string {
  switch (kind) {
    case 'section': return 'vault_sections'
    case 'category': return 'vault_categories'
    case 'credential': return 'vault_credentials'
    case 'link': return 'vault_links'
    case 'note': return 'vault_notes'
    case 'history': return 'vault_password_history'
  }
}

function clearFields(kind: PersonalKind): Record<string, null> {
  if (kind === 'section' || kind === 'category') return { name: null }
  if (kind === 'credential') {
    return { title: null, username: null, password: null, url: null, notes: null }
  }
  if (kind === 'link') return { title: null, url: null, description: null }
  if (kind === 'note') return { title: null, content: null }
  if (kind === 'history') return { password: null }
  return {}
}

async function readPayload<T>(
  kind: PersonalKind,
  row: EncryptedRow,
  userId: string,
  legacy: () => T,
): Promise<T> {
  const session = requireActiveVaultSession()
  const vaultGeneration = getVaultSessionGeneration()
  if (session.userId !== userId) {
    throw new Error('La sesión del Vault no coincide con este usuario.')
  }
  if (row.encrypted_payload) {
    const payload = await decryptPersonal<T>(
      kind,
      row.id,
      userId,
      session.vaultKey,
      row.encrypted_payload,
    )
    if (vaultGeneration !== getVaultSessionGeneration()) {
      throw new Error('La sesión del Vault cambió durante el descifrado.')
    }
    return payload
  }

  const encrypted = await encryptPersonal(
    kind,
    row.id,
    userId,
    session.vaultKey,
    legacy(),
  )
  if (vaultGeneration !== getVaultSessionGeneration()) {
    throw new Error('La sesión del Vault cambió durante el cifrado.')
  }
  const { error } = await supabase
    .from(tableForKind(kind))
    .update({ encrypted_payload: encrypted, ...clearFields(kind) })
    .eq('id', row.id)
  if (error) throw new Error(`No se pudo migrar una fila cifrada: ${error.message}`)
  if (vaultGeneration !== getVaultSessionGeneration()) {
    throw new Error('La sesión del Vault cambió durante la migración.')
  }
  return legacy()
}
export async function toEncryptedSection(
  row: SectionRow,
  userId: string,
): Promise<VaultSection> {
  const payload = await readPayload<SectionPayload>('section', row, userId, () => ({
    name: required(row.name, 'la sección'),
  }))
  return { id: row.id, name: payload.name }
}

export async function toEncryptedCategory(
  row: CategoryRow,
  userId: string,
): Promise<Category> {
  const payload = await readPayload<CategoryPayload>('category', row, userId, () => ({
    name: required(row.name, 'la categoría'),
  }))
  return {
    id: row.id,
    name: payload.name,
    color: row.color,
    sectionId: row.section_id,
    // Las columnas antiguas no tenían módulo: se asignan a Access.
    module: (row.module as Category['module'] | null) ?? 'credential',
    parentId: row.parent_id ?? undefined,
    sortOrder: row.sort_order ?? 0,
    // Archivada ≠ borrada: se oculta del tablero y se recupera desde el panel.
    archivedAt: row.archived_at ?? undefined,
  }
}

export async function toEncryptedCredential(
  row: CredentialRow,
  userId: string,
): Promise<Credential> {
  const payload = await readPayload<CredentialPayload>('credential', row, userId, () => ({
    title: required(row.title, 'el título'),
    username: required(row.username, 'el usuario'),
    password: required(row.password, 'la contraseña'),
    url: row.url ?? undefined,
    notes: row.notes ?? undefined,
    attachments: [],
  }))
  return {
    id: row.id,
    title: payload.title,
    username: payload.username,
    password: payload.password,
    url: payload.url,
    categoryId: row.category_id ?? undefined,
    notes: payload.notes,
    attachments: payload.attachments ?? [],
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  }
}

export async function toEncryptedLink(
  row: LinkRow,
  userId: string,
): Promise<LinkItem> {
  const payload = await readPayload<LinkPayload>('link', row, userId, () => ({
    title: required(row.title, 'el título del enlace'),
    url: required(row.url, 'la URL del enlace'),
    description: row.description ?? undefined,
    attachments: [],
  }))
  return {
    id: row.id,
    title: payload.title,
    url: payload.url,
    categoryId: row.category_id ?? undefined,
    description: payload.description,
    attachments: payload.attachments ?? [],
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  }
}

export async function toEncryptedNote(
  row: NoteRow,
  userId: string,
): Promise<Note> {
  const payload = await readPayload<NotePayload>('note', row, userId, () => ({
    title: required(row.title, 'el título de la nota'),
    content: required(row.content, 'el contenido de la nota'),
    comments: undefined,
    attachments: [],
  }))
  return {
    id: row.id,
    title: payload.title,
    content: payload.content,
    comments: payload.comments,
    categoryId: row.category_id ?? undefined,
    attachments: payload.attachments ?? [],
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  }
}

export async function toEncryptedHistory(
  row: HistoryRow,
  userId: string,
): Promise<PasswordHistoryEntry> {
  const payload = await readPayload<HistoryPayload>('history', row, userId, () => ({
    password: required(row.password, 'la contraseña del historial'),
  }))
  return {
    id: row.id,
    credentialId: row.credential_id,
    password: payload.password,
    changedAt: row.changed_at,
  }
}

