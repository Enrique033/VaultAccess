import { useEffect } from 'react'
import { create } from 'zustand'
import { useAuth } from '@/app/auth-context'
import { supabase, isSupabaseConfigured, requireUserId } from '@/lib/supabase'
import {
  toEncryptedCategory,
  toEncryptedCredential,
  toEncryptedHistory,
  toEncryptedLink,
  toEncryptedNote,
  toEncryptedSection,
  type CategoryRow,
  type CredentialRow,
  type HistoryRow,
  type LinkRow,
  type NoteRow,
  type SectionRow,
} from '@/lib/vault-record-crypto'
import { encryptPersonal } from '@/lib/vault-payloads'
import type { VaultRecordKind } from '@/lib/vault-crypto'
import {
  getVaultSessionGeneration,
  requireActiveVaultSession,
} from '@/lib/vault-session'
import {
  deleteEncryptedAttachments,
  uploadEncryptedAttachments,
  MAX_ATTACHMENTS_PER_RECORD,
} from '@/lib/vault-attachments'
import type { Attachment, AttachmentDraft, CategoryModule } from '@/types'
import {
  clearCachedSnapshot,
  readCachedSnapshot,
  writeCachedSnapshot,
} from '@/lib/vault-offline'

async function encryptPersonalPayload<T>(
  kind: VaultRecordKind,
  id: string,
  userId: string,
  payload: T,
): Promise<string> {
  const session = requireActiveVaultSession()
  if (session.userId !== userId) {
    throw new Error('La sesión del Vault no coincide con este usuario.')
  }
  return encryptPersonal(kind, id, userId, session.vaultKey, payload)
}
import { CATEGORY_COLORS } from '@/lib/category-colors'
import type {
  Category,
  Credential,
  LinkItem,
  Note,
  PasswordHistoryEntry,
  VaultSection,
} from '@/types'

const SECTION_COLUMNS = 'id, name, encrypted_payload, created_at'
const CATEGORY_COLUMNS =
  'id, section_id, parent_id, sort_order, name, color, encrypted_payload, created_at'
const CREDENTIAL_COLUMNS =
  'id, title, username, password, url, category_id, notes, favorite, encrypted_payload, created_at, updated_at'
const LINK_COLUMNS =
  'id, title, url, description, category_id, favorite, encrypted_payload, created_at, updated_at'
const NOTE_COLUMNS =
  'id, title, content, category_id, favorite, encrypted_payload, created_at, updated_at'
const HISTORY_COLUMNS = 'id, credential_id, password, encrypted_payload, changed_at'

function isMissingRpcError(message: string): boolean {
  return /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
    message,
  )
}

let vaultLoadGeneration = 0

function friendlySyncError(message: string): string {
  if (/row-level security/i.test(message))
    return 'Supabase bloqueó la operación (RLS). Revisa las migraciones de Supabase y que hayas iniciado sesión.'
  if (/relation .* does not exist|schema cache|PGRST202/i.test(message))
    return 'Faltan tablas o funciones de cifrado. Ejecuta supabase/schema-encryption.sql después de las migraciones base en el SQL Editor de Supabase.'
  if (/Failed to fetch|NetworkError|network/i.test(message))
    return 'Sin conexión con Supabase. Revisa tu internet o la URL del proyecto.'
  return message
}

export type CredentialInput = Omit<
  Credential,
  'id' | 'createdAt' | 'updatedAt' | 'favorite' | 'attachments'
>
/** Resultado de una importación masiva. */
export interface ImportResult {
  created: number
  skipped: number
}

/** Opciones de la importación masiva. */
export interface ImportOptions {
  /** `true` (por defecto) omite lo que ya existe (mismo título + usuario). */
  skipDuplicates?: boolean
}

export interface CategoryInput {
  name: string
  color?: string
  sectionId: string
  parentId?: string
  sortOrder?: number
  /** Módulo propietario. Si falta, se deduce del primer registro enlazado. */
  module?: CategoryModule
}

export type LinkInput = Omit<
  LinkItem,
  'id' | 'createdAt' | 'updatedAt' | 'favorite' | 'attachments'
>
export type NoteInput = Omit<
  Note,
  'id' | 'createdAt' | 'updatedAt' | 'favorite' | 'attachments'
>

/** Resultado de una importación de respaldo. */
export type SyncStatus = 'idle' | 'loading' | 'ready' | 'error' | 'local'

interface VaultState {
  credentials: Credential[]
  categories: Category[]
  sections: VaultSection[]
  /** Links/Notas se cargan bajo demanda al abrir su módulo. */
  links: LinkItem[]
  notes: Note[]
  linksLoaded: boolean
  notesLoaded: boolean
  linksLoading: boolean
  notesLoading: boolean
  linksError: string | null
  notesError: string | null
  /** Versiones anteriores de la clave de la credencial abierta (bajo demanda). */
  history: PasswordHistoryEntry[]
  /** Credencial a la que pertenece `history`. */
  historyCredentialId: string | null
  historyLoading: boolean
  historyError: string | null

  status: SyncStatus
  error: string | null
  /**
   * `true` cuando los datos visibles provienen de la copia local cifrada
   * porque Supabase no respondió. En ese modo sólo se puede leer.
   */
  offline: boolean
  /** Carga los datos del usuario logueado. Crea seeds si es su primera vez. */
  load: (knownUserId?: string) => Promise<void>
  loadLinks: () => Promise<void>
  loadNotes: () => Promise<void>
  /** Vacía el estado local (al cerrar sesión). */
  reset: () => void

  addCredential: (input: CredentialInput, attachments?: AttachmentDraft) => Promise<Credential>
  updateCredential: (
    id: string,
    input: Partial<CredentialInput>,
    attachments?: AttachmentDraft,
  ) => Promise<void>
  deleteCredential: (id: string) => Promise<void>
  toggleCredentialFavorite: (id: string) => Promise<void>
  /** Importación masiva desde un respaldo (Bitwarden, Chrome, 1Password…). */
  importCredentials: (
    items: CredentialInput[],
    options?: ImportOptions,
  ) => Promise<ImportResult>

  /** Historial de claves (vault_password_history). */
  loadCredentialHistory: (credentialId: string) => Promise<void>
  deleteHistoryEntry: (id: string) => Promise<void>
  clearCredentialHistory: (credentialId: string) => Promise<void>

  addSection: (name: string) => Promise<VaultSection>
  renameSection: (id: string, name: string) => Promise<void>
  deleteSection: (id: string) => Promise<void>

  addCategory: (input: CategoryInput) => Promise<Category>
  renameCategory: (id: string, name: string) => Promise<void>
  moveCategory: (
    id: string,
    sectionId: string,
    parentId?: string | null,
    sortOrder?: number,
  ) => Promise<void>
  reorderCategory: (id: string, direction: 'up' | 'down') => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  addLink: (input: LinkInput, attachments?: AttachmentDraft) => Promise<LinkItem>
  updateLink: (
    id: string,
    input: Partial<LinkInput>,
    attachments?: AttachmentDraft,
  ) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  toggleLinkFavorite: (id: string) => Promise<void>

  addNote: (input: NoteInput, attachments?: AttachmentDraft) => Promise<Note>
  updateNote: (
    id: string,
    input: Partial<NoteInput>,
    attachments?: AttachmentDraft,
  ) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  toggleNoteFavorite: (id: string) => Promise<void>
}

interface ReconciledAttachments {
  attachments: Attachment[]
  uploaded: Attachment[]
}

async function reconcileAttachments(
  existing: Attachment[] | undefined,
  draft: AttachmentDraft | undefined,
  kind: 'credential' | 'link' | 'note',
  recordId: string,
  userId: string,
): Promise<ReconciledAttachments> {
  if (!draft) return { attachments: existing ?? [], uploaded: [] }
  const removed = new Set(draft.removedIds)
  const retained = (existing ?? []).filter((attachment) => !removed.has(attachment.id))
  if (retained.length + draft.newFiles.length > MAX_ATTACHMENTS_PER_RECORD) {
    throw new Error(`Cada registro admite hasta ${MAX_ATTACHMENTS_PER_RECORD} imágenes.`)
  }
  const uploaded = await uploadEncryptedAttachments(
    draft.newFiles,
    kind,
    recordId,
    userId,
  )
  return { attachments: [...retained, ...uploaded], uploaded }
}

async function removeRecordAttachments(
  attachments: Attachment[] | undefined,
  kind: 'credential' | 'link' | 'note',
  recordId: string,
  userId: string,
): Promise<void> {
  if (!attachments?.length) return
  await deleteEncryptedAttachments(attachments, kind, recordId, userId)
}

function nextColor(categories: Category[]): string {
  const used = new Set(categories.map((c) => c.color.toLowerCase()))
  const free = CATEGORY_COLORS.find((color) => !used.has(color.toLowerCase()))
  if (free) return free
  return CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]!
}

function normalizeParentId(
  categories: Category[],
  categoryId: string,
  sectionId: string,
  parentId: string | undefined | null,
): string | null {
  if (!parentId) return null
  const parent = categories.find((category) => category.id === parentId)
  if (!parent || parent.sectionId !== sectionId) {
    throw new Error('La categoría padre no pertenece a la misma sección.')
  }
  if (parentId === categoryId) {
    throw new Error('Una categoría no puede ser su propia categoría padre.')
  }
  const visited = new Set<string>()
  let cursor: Category | undefined = parent
  while (cursor) {
    if (visited.has(cursor.id)) {
      throw new Error('La jerarquía de categorías contiene un ciclo.')
    }
    visited.add(cursor.id)
    if (cursor.id === categoryId) {
      throw new Error('No se puede crear un ciclo de categorías.')
    }
    cursor = cursor.parentId
      ? categories.find((category) => category.id === cursor?.parentId)
      : undefined
  }
  return parentId
}

function nextCategorySortOrder(
  categories: Category[],
  sectionId: string,
  parentId: string | null,
): number {
  const siblings = categories.filter(
    (category) =>
      category.sectionId === sectionId &&
      (category.parentId ?? null) === parentId,
  )
  return siblings.reduce((max, category) => Math.max(max, category.sortOrder), -1) + 1
}

function categoryDescendantIds(categories: Category[], rootId: string): string[] {
  const descendants: string[] = []
  const visit = (parentId: string) => {
    for (const category of categories) {
      if (category.parentId !== parentId || descendants.includes(category.id)) continue
      descendants.push(category.id)
      visit(category.id)
    }
  }
  visit(rootId)
  return descendants
}

/** Rompe referencias antiguas/cycles antes de que lleguen a la UI. */
function sanitizeCategoryHierarchy(categories: Category[]): Category[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return categories.map((category) => {
    if (!category.parentId) return category
    const parent = byId.get(category.parentId)
    if (!parent || parent.sectionId !== category.sectionId) {
      return { ...category, parentId: undefined }
    }
    const seen = new Set([category.id])
    let cursor: Category | undefined = parent
    while (cursor) {
      if (seen.has(cursor.id)) return { ...category, parentId: undefined }
      seen.add(cursor.id)
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    }
    return category
  })
}

/** Evita guardar una referencia a una categoría que no pertenece al Vault actual. */
function categoryIdForVault(
  categories: Category[],
  categoryId: string | undefined | null,
): string | null {
  if (
    categoryId === undefined ||
    categoryId === null ||
    categoryId.trim() === ''
  ) {
    return null
  }
  const normalized = categoryId.trim()
  if (categories.some((category) => category.id === normalized)) {
    return normalized
  }
  throw new Error(
    'La categoría seleccionada ya no existe o no pertenece a este Vault. Recarga y elige una categoría válida.',
  )
}

/** Versiones anteriores que se conservan por credencial. */
export const HISTORY_LIMIT = 20

/** Tamaño de los lotes al importar (evita payloads enormes). */
const IMPORT_CHUNK = 100

/** Clave de duplicado al importar (título + usuario, sin mayúsculas). */
function dedupeKey(title: string, username: string): string {
  return `${title.trim().toLowerCase()}::${username.trim().toLowerCase()}`
}

/** Error del historial con la pista de qué script SQL falta. */
function historyFriendlyError(message: string): string {
  if (/relation .* does not exist|schema cache/i.test(message))
    return 'Falta la tabla del historial. Ejecuta supabase/schema-history.sql en el SQL Editor de Supabase.'
  return friendlySyncError(message)
}

/** Guarda en el historial la clave que se acaba de reemplazar (best-effort). */
async function recordPasswordChange(credential: Credential): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const userId = await requireUserId()
    const historyId = crypto.randomUUID()
    const encryptedPayload = await encryptPersonalPayload(
      'history',
      historyId,
      userId,
      { password: credential.password },
    )
    const { data, error } = await supabase
      .from('vault_password_history')
      .insert({
        id: historyId,
        user_id: userId,
        credential_id: credential.id,
        encrypted_payload: encryptedPayload,
      })
      .select(HISTORY_COLUMNS)
      .single()
    if (error) throw new Error(error.message)

    const entry = await toEncryptedHistory(data as HistoryRow, userId)
    useVaultStore.setState((s) => ({
      history:
        s.historyCredentialId === credential.id
          ? [entry, ...s.history].slice(0, HISTORY_LIMIT)
          : s.history,
    }))

    // Poda: conserva solo las HISTORY_LIMIT versiones más recientes.
    const { data: stale } = await supabase
      .from('vault_password_history')
      .select('id')
      .eq('credential_id', credential.id)
      .order('changed_at', { ascending: false })
      .range(HISTORY_LIMIT, HISTORY_LIMIT + 50)
    if (stale && stale.length > 0) {
      await supabase
        .from('vault_password_history')
        .delete()
        .in(
          'id',
          stale.map((row) => (row as { id: string }).id),
        )
    }
  } catch (e) {
    // Nunca debe romper el guardado de la credencial.
    console.warn('[Workvaul] No se pudo guardar el historial de la clave:', e)
  }
}

export const useVaultStore = create<VaultState>()((set, get) => ({
  offline: false,
  credentials: [],
  links: [],
  notes: [],
  linksLoaded: false,
  notesLoaded: false,
  linksLoading: false,
  notesLoading: false,
  linksError: null,
  notesError: null,
  history: [],
  historyCredentialId: null,
  historyLoading: false,
  historyError: null,
  categories: [],
  sections: [],

  status: isSupabaseConfigured ? 'idle' : 'local',
  error: null,

  load: async (knownUserId) => {
    const generation = ++vaultLoadGeneration
    const vaultGeneration = getVaultSessionGeneration()
    if (!isSupabaseConfigured) {
      set({
        status: 'local',
        error: null,
        linksLoaded: true,
        notesLoaded: true,
      })
      return
    }
    set({ status: 'loading', error: null, offline: false })
    try {
      const userId = knownUserId ?? (await requireUserId())
      const snapshotResult = await supabase.rpc('get_vault_snapshot')
      let sectionRows: SectionRow[]
      let categoryRows: CategoryRow[]
      let credentialRows: CredentialRow[]

      if (snapshotResult.error) {
        if (!isMissingRpcError(snapshotResult.error.message)) {
          throw new Error(friendlySyncError(snapshotResult.error.message))
        }
        const [sectionResult, categoryResult, credentialResult] =
          await Promise.all([
            supabase
              .from('vault_sections')
              .select(SECTION_COLUMNS)
              .order('created_at'),
            supabase
              .from('vault_categories')
              .select(CATEGORY_COLUMNS)
              .order('created_at'),
            supabase
              .from('vault_credentials')
              .select(CREDENTIAL_COLUMNS)
              .order('updated_at', { ascending: false }),
          ])
        const firstError =
          sectionResult.error ?? categoryResult.error ?? credentialResult.error
        if (firstError) throw new Error(friendlySyncError(firstError.message))
        sectionRows = (sectionResult.data ?? []) as SectionRow[]
        categoryRows = (categoryResult.data ?? []) as CategoryRow[]
        credentialRows = (credentialResult.data ?? []) as CredentialRow[]
      } else {
        const snapshot = snapshotResult.data as {
          sections?: SectionRow[]
          categories?: CategoryRow[]
          credentials?: CredentialRow[]
        }
        if (
          !Array.isArray(snapshot?.sections) ||
          !Array.isArray(snapshot.categories) ||
          !Array.isArray(snapshot.credentials)
        ) {
          throw new Error('El snapshot del Vault tiene un formato inválido.')
        }
        sectionRows = snapshot.sections
        categoryRows = snapshot.categories
        credentialRows = snapshot.credentials
        // El snapshot viene cifrado por registro, así que se puede copiar tal
        // cual a IndexedDB: sin red, la app lo descifra con la clave de sesión.
        void writeCachedSnapshot(snapshot)
      }

      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      const sections = await Promise.all(
        sectionRows.map((row) => toEncryptedSection(row, userId)),
      )
      const categories = sanitizeCategoryHierarchy(
        await Promise.all(
          categoryRows.map((row) => toEncryptedCategory(row, userId)),
        ),
      )
      const credentials = await Promise.all(
        credentialRows.map((row) => toEncryptedCredential(row, userId)),
      )

      /*
        No se crean secciones ni categorías de ejemplo: el usuario empieza con
        el tablero vacío y las columnas las crea él desde «+ Añade otra lista».
        Antes se sembraban "Trabajo/Redes" y tres categorías, lo que ensuciaba
        el tablero con columnas que el usuario no había pedido.
      */

      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        status: 'ready',
        error: null,
        offline: false,
        sections,
        categories,
        credentials,
      })
    } catch (e) {
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      const message =
        e instanceof Error ? e.message : 'Error al cargar tus datos.'

      /*
        Sin red: se intenta la copia local cifrada. `readCachedSnapshot`
        devuelve `null` si no hay caché o si el Vault está bloqueado, así que
        aquí sólo se llega a esta rama con la sesión ya abierta.
      */
      const cached = await readCachedSnapshot()
      if (
        cached &&
        generation === vaultLoadGeneration &&
        vaultGeneration === getVaultSessionGeneration()
      ) {
        const offline = cached as {
          sections?: SectionRow[]
          categories?: CategoryRow[]
          credentials?: CredentialRow[]
        }
        if (
          Array.isArray(offline.sections) &&
          Array.isArray(offline.categories) &&
          Array.isArray(offline.credentials)
        ) {
          const userId = knownUserId ?? ''
          try {
            const sections = await Promise.all(
              offline.sections.map((row) => toEncryptedSection(row, userId)),
            )
            const categories = sanitizeCategoryHierarchy(
              await Promise.all(
                offline.categories.map((row) =>
                  toEncryptedCategory(row, userId),
                ),
              ),
            )
            const credentials = await Promise.all(
              offline.credentials.map((row) =>
                toEncryptedCredential(row, userId),
              ),
            )
            set({
              status: 'ready',
              error: null,
              offline: true,
              sections,
              categories,
              credentials,
            })
            return
          } catch {
            // La copia local estaba dañada: se cae al error de red normal.
          }
        }
      }

      set({ status: 'error', error: message })
    }
  },

  loadLinks: async () => {
    if (get().linksLoaded || get().linksLoading) return
    const generation = vaultLoadGeneration
    const vaultGeneration = getVaultSessionGeneration()
    if (!isSupabaseConfigured) {
      set({ linksLoaded: true, linksLoading: false, linksError: null })
      return
    }
    set({ linksLoading: true, linksError: null })
    try {
      const { data, error } = await supabase
        .from('vault_links')
        .select(LINK_COLUMNS)
        .order('updated_at', { ascending: false })
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      if (error) throw new Error(friendlySyncError(error.message))
      const rows = (data ?? []) as LinkRow[]
      const userId = await requireUserId()
      const links = await Promise.all(
        rows.map((row) => toEncryptedLink(row, userId)),
      )
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        links,
        linksLoaded: true,
        linksLoading: false,
        linksError: null,
      })
    } catch (e) {
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        linksLoading: false,
        linksError: e instanceof Error ? e.message : 'No se pudieron descifrar los enlaces.',
      })
    }
  },

  loadNotes: async () => {
    if (get().notesLoaded || get().notesLoading) return
    const generation = vaultLoadGeneration
    const vaultGeneration = getVaultSessionGeneration()
    if (!isSupabaseConfigured) {
      set({ notesLoaded: true, notesLoading: false, notesError: null })
      return
    }
    set({ notesLoading: true, notesError: null })
    try {
      const { data, error } = await supabase
        .from('vault_notes')
        .select(NOTE_COLUMNS)
        .order('updated_at', { ascending: false })
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      if (error) throw new Error(friendlySyncError(error.message))
      const rows = (data ?? []) as NoteRow[]
      const userId = await requireUserId()
      const notes = await Promise.all(
        rows.map((row) => toEncryptedNote(row, userId)),
      )
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        notes,
        notesLoaded: true,
        notesLoading: false,
        notesError: null,
      })
    } catch (e) {
      if (
        generation !== vaultLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        notesLoading: false,
        notesError: e instanceof Error ? e.message : 'No se pudieron descifrar las notas.',
      })
    }
  },

  reset: () => {
    vaultLoadGeneration += 1
    // La copia local es del usuario que acaba de salir: se borra para no dejar
    // ciphertext de otra cuenta en el navegador.
    void clearCachedSnapshot()
    set({
      credentials: [],
      categories: [],
      sections: [],
      links: [],
      notes: [],
      linksLoaded: false,
      notesLoaded: false,
      linksLoading: false,
      notesLoading: false,
      linksError: null,
      notesError: null,
      history: [],
      historyCredentialId: null,
      historyLoading: false,
      historyError: null,
      status: 'idle',
      error: null,
      offline: false,
    })
  },

  addCredential: async (input, attachmentDraft) => {
    const userId = await requireUserId()
    const categoryId = categoryIdForVault(get().categories, input.categoryId)
    const id = crypto.randomUUID()
    const { attachments, uploaded } = await reconcileAttachments(
      undefined,
      attachmentDraft,
      'credential',
      id,
      userId,
    )
    let encryptedPayload: string
    try {
      encryptedPayload = await encryptPersonalPayload('credential', id, userId, {
        title: input.title,
        username: input.username,
        password: input.password,
        url: input.url ?? undefined,
        notes: input.notes ?? undefined,
        attachments,
      })
    } catch (cause) {
      await deleteEncryptedAttachments(uploaded, 'credential', id, userId).catch(() => undefined)
      throw cause
    }
    const { data, error } = await supabase
      .from('vault_credentials')
      .insert({
        id,
        user_id: userId,
        category_id: categoryId,
        encrypted_payload: encryptedPayload,
      })
      .select(CREDENTIAL_COLUMNS)
      .single()
    if (error) {
      if (uploaded.length > 0) {
        await deleteEncryptedAttachments(uploaded, 'credential', id, userId).catch(() => undefined)
      }
      throw new Error(friendlySyncError(error.message))
    }
    if (!data) {
      await deleteEncryptedAttachments(uploaded, 'credential', id, userId).catch(() => undefined)
      throw new Error('No se pudo recuperar la credencial creada.')
    }
    const credential = await toEncryptedCredential(
      data as CredentialRow,
      userId,
    )
    set((s) => ({ credentials: [credential, ...s.credentials] }))
    return credential
  },

  updateCredential: async (id, input, attachmentDraft) => {
    const previous = get().credentials.find((c) => c.id === id)
    if (!previous) throw new Error('La credencial ya no existe.')
    const userId = await requireUserId()
    const passwordChanged =
      input.password !== undefined && input.password !== previous.password
    const { attachments, uploaded } = await reconcileAttachments(
      previous.attachments,
      attachmentDraft,
      'credential',
      id,
      userId,
    )
    const next = {
      title: input.title ?? previous.title,
      username: input.username ?? previous.username,
      password: input.password ?? previous.password,
      url: input.url !== undefined ? input.url ?? undefined : previous.url,
      notes: input.notes !== undefined ? input.notes ?? undefined : previous.notes,
      attachments,
    }
    const categoryId =
      'categoryId' in input
        ? categoryIdForVault(get().categories, input.categoryId)
        : previous.categoryId ?? null
    let encryptedPayload: string
    try {
      encryptedPayload = await encryptPersonalPayload('credential', id, userId, next)
    } catch (cause) {
      await deleteEncryptedAttachments(uploaded, 'credential', id, userId).catch(() => undefined)
      throw cause
    }
    const { data, error } = await supabase
      .from('vault_credentials')
      .update({
        category_id: categoryId,
        encrypted_payload: encryptedPayload,
        title: null,
        username: null,
        password: null,
        url: null,
        notes: null,
      })
      .eq('id', id)
      .select(CREDENTIAL_COLUMNS)
      .single()
    if (error) {
      await deleteEncryptedAttachments(uploaded, 'credential', id, userId).catch(() => undefined)
      throw new Error(friendlySyncError(error.message))
    }
    const updated = await toEncryptedCredential(
      data as CredentialRow,
      userId,
    )
    const removed = new Set(attachmentDraft?.removedIds ?? [])
    const removedAttachments = previous.attachments?.filter((attachment) =>
      removed.has(attachment.id),
    )
    if (removedAttachments?.length) {
      await deleteEncryptedAttachments(
        removedAttachments,
        'credential',
        id,
        userId,
      ).catch((cause) => {
        console.warn('[Workvaul] No se pudieron limpiar imágenes retiradas:', cause)
      })
    }
    set((s) => ({
      credentials: s.credentials.map((c) => (c.id === id ? updated : c)),
    }))

    // Guarda la clave reemplazada (best-effort: no interrumpe el guardado).
    if (passwordChanged) await recordPasswordChange(previous)
  },

  deleteCredential: async (id) => {
    const userId = await requireUserId()
    const current = get().credentials.find((credential) => credential.id === id)
    const { error } = await supabase
      .from('vault_credentials')
      .delete()
      .eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    await removeRecordAttachments(
      current?.attachments,
      'credential',
      id,
      userId,
    ).catch((cause) => {
      console.warn('[Workvaul] La credencial se eliminó, pero faltaron sus imágenes:', cause)
    })
    set((s) => ({
      credentials: s.credentials.filter((c) => c.id !== id),
      // En la base cae en cascada; aquí limpiamos la copia local.
      history:
        s.historyCredentialId === id
          ? []
          : s.history.filter((h) => h.credentialId !== id),
      historyCredentialId:
        s.historyCredentialId === id ? null : s.historyCredentialId,
    }))
  },

  toggleCredentialFavorite: async (id) => {
    const current = get().credentials.find((c) => c.id === id)
    if (!current) return
    const { data, error } = await supabase
      .from('vault_credentials')
      .update({ favorite: !current.favorite })
      .eq('id', id)
      .select(CREDENTIAL_COLUMNS)
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = await toEncryptedCredential(
      data as CredentialRow,
      await requireUserId(),
    )
    set((s) => ({
      credentials: s.credentials.map((c) => (c.id === id ? updated : c)),
    }))
  },

  importCredentials: async (items, options) => {
    const userId = await requireUserId()
    const seen = new Set(
      get().credentials.map((c) => dedupeKey(c.title, c.username)),
    )
    const rows: Record<string, unknown>[] = []
    let skipped = 0

    for (const item of items) {
      const title = item.title.trim()
      const username = item.username.trim()
      const key = dedupeKey(title, username)
      if (options?.skipDuplicates !== false) {
        if (seen.has(key)) {
          skipped += 1
          continue
        }
        seen.add(key)
      }
      const id = crypto.randomUUID()
      const encryptedPayload = await encryptPersonalPayload(
        'credential',
        id,
        userId,
        {
          title,
          username,
          password: item.password,
          url: item.url?.trim() || undefined,
          notes: item.notes?.trim() || undefined,
        },
      )
      rows.push({
        id,
        user_id: userId,
        encrypted_payload: encryptedPayload,
        category_id: categoryIdForVault(get().categories, item.categoryId),
      })
    }

    // Inserta por lotes para no enviar payloads enormes de una vez.
    const created: Credential[] = []
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
      const { data, error } = await supabase
        .from('vault_credentials')
        .insert(rows.slice(i, i + IMPORT_CHUNK))
        .select(CREDENTIAL_COLUMNS)
      if (error) throw new Error(friendlySyncError(error.message))
      created.push(
        ...(await Promise.all(
          (data ?? []).map((row) => toEncryptedCredential(row as CredentialRow, userId)),
        )),
      )
    }
    if (created.length > 0)
      set((s) => ({ credentials: [...created, ...s.credentials] }))

    return { created: created.length, skipped }
  },

  loadCredentialHistory: async (credentialId) => {
    const vaultGeneration = getVaultSessionGeneration()
    set({
      historyCredentialId: credentialId,
      history: [],
      historyLoading: true,
      historyError: null,
    })
    if (!isSupabaseConfigured) {
      set({
        historyLoading: false,
        historyError:
          'Supabase no está configurado: el historial no está disponible.',
      })
      return
    }
    try {
      const { data, error } = await supabase
        .from('vault_password_history')
        .select(HISTORY_COLUMNS)
        .eq('credential_id', credentialId)
        .order('changed_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (vaultGeneration !== getVaultSessionGeneration()) return
      if (error) throw new Error(historyFriendlyError(error.message))
      const userId = await requireUserId()
      const historyRows = (data ?? []) as HistoryRow[]
      const history = await Promise.all(
        historyRows.map((row) => toEncryptedHistory(row, userId)),
      )
      if (vaultGeneration !== getVaultSessionGeneration()) return
      set({
        history,
        historyLoading: false,
        historyError: null,
      })
    } catch (e) {
      if (vaultGeneration !== getVaultSessionGeneration()) return
      set({
        historyLoading: false,
        historyError:
          e instanceof Error
            ? e.message
            : 'No se pudo descifrar el historial de claves.',
      })
    }
  },

  deleteHistoryEntry: async (id) => {
    const { error } = await supabase
      .from('vault_password_history')
      .delete()
      .eq('id', id)
    if (error) throw new Error(historyFriendlyError(error.message))
    set((s) => ({ history: s.history.filter((h) => h.id !== id) }))
  },

  clearCredentialHistory: async (credentialId) => {
    const { error } = await supabase
      .from('vault_password_history')
      .delete()
      .eq('credential_id', credentialId)
    if (error) throw new Error(historyFriendlyError(error.message))
    set({ history: [] })
  },

  addLink: async (input, attachmentDraft) => {
    const userId = await requireUserId()
    const categoryId = categoryIdForVault(get().categories, input.categoryId)
    const id = crypto.randomUUID()
    const { attachments, uploaded } = await reconcileAttachments(
      undefined,
      attachmentDraft,
      'link',
      id,
      userId,
    )
    let encryptedPayload: string
    try {
      encryptedPayload = await encryptPersonalPayload('link', id, userId, {
        title: input.title,
        url: input.url,
        description: input.description ?? undefined,
        attachments,
      })
    } catch (cause) {
      await deleteEncryptedAttachments(uploaded, 'link', id, userId).catch(() => undefined)
      throw cause
    }
    const { data, error } = await supabase
      .from('vault_links')
      .insert({
        id,
        user_id: userId,
        category_id: categoryId,
        encrypted_payload: encryptedPayload,
      })
      .select(LINK_COLUMNS)
      .single()
    if (error) {
      await deleteEncryptedAttachments(uploaded, 'link', id, userId).catch(() => undefined)
      throw new Error(friendlySyncError(error.message))
    }
    if (!data) {
      await deleteEncryptedAttachments(uploaded, 'link', id, userId).catch(() => undefined)
      throw new Error('No se pudo recuperar el enlace creado.')
    }
    const link = await toEncryptedLink(data as LinkRow, userId)
    set((s) => ({ links: [link, ...s.links] }))
    return link
  },

  updateLink: async (id, input, attachmentDraft) => {
    const previous = get().links.find((link) => link.id === id)
    if (!previous) throw new Error('El enlace ya no existe.')
    const userId = await requireUserId()
    const { attachments, uploaded } = await reconcileAttachments(
      previous.attachments,
      attachmentDraft,
      'link',
      id,
      userId,
    )
    const next = {
      title: input.title ?? previous.title,
      url: input.url ?? previous.url,
      description:
        input.description !== undefined
          ? input.description ?? undefined
          : previous.description,
      attachments,
    }
    const categoryId =
      'categoryId' in input
        ? categoryIdForVault(get().categories, input.categoryId)
        : previous.categoryId ?? null
    let encryptedPayload: string
    try {
      encryptedPayload = await encryptPersonalPayload('link', id, userId, next)
    } catch (cause) {
      await deleteEncryptedAttachments(uploaded, 'link', id, userId).catch(() => undefined)
      throw cause
    }
    const { data, error } = await supabase
      .from('vault_links')
      .update({
        category_id: categoryId,
        encrypted_payload: encryptedPayload,
        title: null,
        url: null,
        description: null,
      })
      .eq('id', id)
      .select(LINK_COLUMNS)
      .single()
    if (error) {
      await deleteEncryptedAttachments(uploaded, 'link', id, userId).catch(() => undefined)
      throw new Error(friendlySyncError(error.message))
    }
    const updated = await toEncryptedLink(data as LinkRow, userId)
    const removed = new Set(attachmentDraft?.removedIds ?? [])
    const removedAttachments = previous.attachments?.filter((attachment) =>
      removed.has(attachment.id),
    )
    if (removedAttachments?.length) {
      await deleteEncryptedAttachments(removedAttachments, 'link', id, userId).catch(
        (cause) => {
          console.warn('[Workvaul] No se pudieron limpiar imágenes retiradas:', cause)
        },
      )
    }
    set((s) => ({ links: s.links.map((l) => (l.id === id ? updated : l)) }))
  },

  deleteLink: async (id) => {
    const userId = await requireUserId()
    const current = get().links.find((link) => link.id === id)
    const { error } = await supabase.from('vault_links').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    await removeRecordAttachments(current?.attachments, 'link', id, userId).catch(
      (cause) => {
        console.warn('[Workvaul] El enlace se eliminó, pero faltaron sus imágenes:', cause)
      },
    )
    set((s) => ({ links: s.links.filter((l) => l.id !== id) }))
  },

  toggleLinkFavorite: async (id) => {
    const current = get().links.find((l) => l.id === id)
    if (!current) return
    const { data, error } = await supabase
      .from('vault_links')
      .update({ favorite: !current.favorite })
      .eq('id', id)
      .select(LINK_COLUMNS)
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = await toEncryptedLink(data as LinkRow, await requireUserId())
    set((s) => ({ links: s.links.map((l) => (l.id === id ? updated : l)) }))
  },

  addNote: async (input, attachmentDraft) => {
    const userId = await requireUserId()
    const categoryId = categoryIdForVault(get().categories, input.categoryId)
    const id = crypto.randomUUID()
    const { attachments, uploaded } = await reconcileAttachments(
      undefined,
      attachmentDraft,
      'note',
      id,
      userId,
    )
    let encryptedPayload: string
    try {
      encryptedPayload = await encryptPersonalPayload('note', id, userId, {
        title: input.title,
        content: input.content,
        comments: input.comments,
        attachments,
      })
    } catch (cause) {
      await deleteEncryptedAttachments(uploaded, 'note', id, userId).catch(() => undefined)
      throw cause
    }
    const { data, error } = await supabase
      .from('vault_notes')
      .insert({
        id,
        user_id: userId,
        category_id: categoryId,
        encrypted_payload: encryptedPayload,
      })
      .select(NOTE_COLUMNS)
      .single()
    if (error) {
      await deleteEncryptedAttachments(uploaded, 'note', id, userId).catch(() => undefined)
      throw new Error(friendlySyncError(error.message))
    }
    if (!data) {
      await deleteEncryptedAttachments(uploaded, 'note', id, userId).catch(() => undefined)
      throw new Error('No se pudo recuperar la nota creada.')
    }
    const note = await toEncryptedNote(data as NoteRow, userId)
    set((s) => ({ notes: [note, ...s.notes] }))
    return note
  },

  updateNote: async (id, input, attachmentDraft) => {
    const previous = get().notes.find((note) => note.id === id)
    if (!previous) throw new Error('La nota ya no existe.')
    const userId = await requireUserId()
    const { attachments, uploaded } = await reconcileAttachments(
      previous.attachments,
      attachmentDraft,
      'note',
      id,
      userId,
    )
    const next = {
      title: input.title ?? previous.title,
      content: input.content ?? previous.content,
      comments: input.comments ?? previous.comments,
      attachments,
    }
    const categoryId =
      'categoryId' in input
        ? categoryIdForVault(get().categories, input.categoryId)
        : previous.categoryId ?? null
    let encryptedPayload: string
    try {
      encryptedPayload = await encryptPersonalPayload('note', id, userId, next)
    } catch (cause) {
      await deleteEncryptedAttachments(uploaded, 'note', id, userId).catch(() => undefined)
      throw cause
    }
    const { data, error } = await supabase
      .from('vault_notes')
      .update({
        category_id: categoryId,
        encrypted_payload: encryptedPayload,
        title: null,
        content: null,
      })
      .eq('id', id)
      .select(NOTE_COLUMNS)
      .single()
    if (error) {
      await deleteEncryptedAttachments(uploaded, 'note', id, userId).catch(() => undefined)
      throw new Error(friendlySyncError(error.message))
    }
    const updated = await toEncryptedNote(data as NoteRow, userId)
    const removed = new Set(attachmentDraft?.removedIds ?? [])
    const removedAttachments = previous.attachments?.filter((attachment) =>
      removed.has(attachment.id),
    )
    if (removedAttachments?.length) {
      await deleteEncryptedAttachments(removedAttachments, 'note', id, userId).catch((cause) => {
        console.warn('[Workvaul] No se pudieron limpiar imágenes retiradas:', cause)
      })
    }
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }))
  },

  deleteNote: async (id) => {
    const userId = await requireUserId()
    const current = get().notes.find((note) => note.id === id)
    const { error } = await supabase.from('vault_notes').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    await removeRecordAttachments(current?.attachments, 'note', id, userId).catch((cause) => {
      console.warn('[Workvaul] La nota se eliminó, pero faltaron sus imágenes:', cause)
    })
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
  },

  toggleNoteFavorite: async (id) => {
    const current = get().notes.find((n) => n.id === id)
    if (!current) return
    const { data, error } = await supabase
      .from('vault_notes')
      .update({ favorite: !current.favorite })
      .eq('id', id)
      .select(NOTE_COLUMNS)
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = await toEncryptedNote(data as NoteRow, await requireUserId())
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }))
  },

  addSection: async (name) => {
    const next = name.trim()
    if (!next || next.length > 60) {
      throw new Error('El nombre de la sección debe tener entre 1 y 60 caracteres.')
    }
    const userId = await requireUserId()
    const id = crypto.randomUUID()
    const encryptedPayload = await encryptPersonalPayload('section', id, userId, {
      name: next,
    })
    const { data, error } = await supabase
      .from('vault_sections')
      .insert({ id, user_id: userId, encrypted_payload: encryptedPayload })
      .select(SECTION_COLUMNS)
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const section = await toEncryptedSection(data as SectionRow, userId)
    set((s) => ({ sections: [...s.sections, section] }))
    return section
  },

  renameSection: async (id, name) => {
    const next = name.trim()
    if (!next || next.length > 60) {
      throw new Error('El nombre de la sección debe tener entre 1 y 60 caracteres.')
    }
    if (!get().sections.some((section) => section.id === id)) {
      throw new Error('La sección ya no existe.')
    }
    const encryptedPayload = await encryptPersonalPayload(
      'section',
      id,
      await requireUserId(),
      { name: next },
    )
    const { error } = await supabase
      .from('vault_sections')
      .update({ encrypted_payload: encryptedPayload, name: null })
      .eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === id ? { ...sec, name: next } : sec,
      ),
    }))
  },

  deleteSection: async (id) => {
    const state = get()
    const orphans = state.categories.filter((c) => c.sectionId === id)
    const remaining = state.sections.filter((s) => s.id !== id)
    const fallback = remaining[0]?.id
    if (orphans.length > 0 && fallback) {
      const { error } = await supabase
        .from('vault_categories')
        .update({ section_id: fallback, parent_id: null })
        .eq('section_id', id)
      if (error) throw new Error(friendlySyncError(error.message))
    }
    const { error } = await supabase
      .from('vault_sections')
      .delete()
      .eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((state) => {
      const orphanedCategoryIds = new Set(
        state.categories
          .filter((category) => category.sectionId === id)
          .map((category) => category.id),
      )
      return {
        sections: state.sections.filter((section) => section.id !== id),
        categories: fallback
          ? state.categories.map((category) =>
              category.sectionId === id
                ? { ...category, sectionId: fallback, parentId: undefined }
                : category,
            )
          : state.categories.filter((category) => category.sectionId !== id),
        credentials: fallback
          ? state.credentials
          : state.credentials.map((credential) =>
              credential.categoryId &&
              orphanedCategoryIds.has(credential.categoryId)
                ? { ...credential, categoryId: undefined }
                : credential,
            ),
        links: fallback
          ? state.links
          : state.links.map((link) =>
              link.categoryId && orphanedCategoryIds.has(link.categoryId)
                ? { ...link, categoryId: undefined }
                : link,
            ),
        notes: fallback
          ? state.notes
          : state.notes.map((note) =>
              note.categoryId && orphanedCategoryIds.has(note.categoryId)
                ? { ...note, categoryId: undefined }
                : note,
            ),
      }
    })
  },

  addCategory: async (input) => {
    const userId = await requireUserId()
    const name = input.name.trim()
    if (!name || name.length > 60) {
      throw new Error('El nombre de la categoría debe tener entre 1 y 60 caracteres.')
    }
    const state = get()
    const section = state.sections.find((item) => item.id === input.sectionId)
    if (!section) throw new Error('La sección seleccionada ya no existe.')
    const id = crypto.randomUUID()
    const parentId = normalizeParentId(
      state.categories,
      id,
      input.sectionId,
      input.parentId,
    )
    const sortOrder =
      input.sortOrder ?? nextCategorySortOrder(state.categories, input.sectionId, parentId)
    const encryptedPayload = await encryptPersonalPayload('category', id, userId, {
      name,
    })
    const { data, error } = await supabase
      .from('vault_categories')
      .insert({
        id,
        user_id: userId,
        section_id: input.sectionId,
        parent_id: parentId,
        sort_order: sortOrder,
        // Cada módulo tiene sus propias columnas: Access, Links y Notas no
        // comparten nada. Por defecto la columna pertenece al módulo actual.
        module: input.module,
        color: input.color ?? nextColor(state.categories),
        encrypted_payload: encryptedPayload,
      })
      .select(CATEGORY_COLUMNS)
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const category = await toEncryptedCategory(data as CategoryRow, userId)
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  renameCategory: async (id, name) => {
    const next = name.trim()
    if (!next || next.length > 60) {
      throw new Error('El nombre de la categoría debe tener entre 1 y 60 caracteres.')
    }
    if (!get().categories.some((category) => category.id === id)) {
      throw new Error('La categoría ya no existe.')
    }
    const encryptedPayload = await encryptPersonalPayload(
      'category',
      id,
      await requireUserId(),
      { name: next },
    )
    const { error } = await supabase
      .from('vault_categories')
      .update({ encrypted_payload: encryptedPayload, name: null })
      .eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({
      categories: s.categories.map((c) => c.id === id ? { ...c, name: next } : c),
    }))
  },

  moveCategory: async (id, sectionId, parentId, sortOrder) => {
    const state = get()
    const category = state.categories.find((item) => item.id === id)
    if (!category) throw new Error('La categoría ya no existe.')
    if (!state.sections.some((section) => section.id === sectionId)) {
      throw new Error('La sección seleccionada ya no existe.')
    }
    const nextParentId = normalizeParentId(state.categories, id, sectionId, parentId)
    const nextSortOrder =
      sortOrder ?? nextCategorySortOrder(state.categories, sectionId, nextParentId)
    const descendants = categoryDescendantIds(state.categories, id)
    const subtreeIds = [id, ...descendants]
    const { error: sectionError } = await supabase
      .from('vault_categories')
      .update({ section_id: sectionId })
      .in('id', subtreeIds)
    if (sectionError) throw new Error(friendlySyncError(sectionError.message))
    const { error: rootError } = await supabase
      .from('vault_categories')
      .update({ parent_id: nextParentId, sort_order: nextSortOrder })
      .eq('id', id)
    if (rootError) throw new Error(friendlySyncError(rootError.message))
    set((s) => ({
      categories: s.categories.map((item) => {
        if (item.id === id) {
          return { ...item, sectionId, parentId: nextParentId ?? undefined, sortOrder: nextSortOrder }
        }
        return descendants.includes(item.id) ? { ...item, sectionId } : item
      }),
    }))
  },

  reorderCategory: async (id, direction) => {
    const state = get()
    const category = state.categories.find((item) => item.id === id)
    if (!category) throw new Error('La categoría ya no existe.')
    const parentId = category.parentId ?? null
    const siblings = state.categories
      .filter(
        (item) => item.sectionId === category.sectionId && (item.parentId ?? null) === parentId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    const index = siblings.findIndex((item) => item.id === id)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || targetIndex < 0 || targetIndex >= siblings.length) return

    // Normaliza hermanos antiguos (todos pueden tener sort_order=0).
    const ordered = [...siblings]
    ;[ordered[index], ordered[targetIndex]] = [ordered[targetIndex]!, ordered[index]!]
    const updates = await Promise.all(
      ordered.map((item, order) =>
        supabase.from('vault_categories').update({ sort_order: order }).eq('id', item.id),
      ),
    )
    const error = updates.find((result) => result.error)?.error
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({
      categories: s.categories.map((item) => {
        const order = ordered.findIndex((candidate) => candidate.id === item.id)
        return order >= 0 ? { ...item, sortOrder: order } : item
      }),
    }))
  },

  deleteCategory: async (id) => {
    const descendants = new Set<string>()
    const visit = (parentId: string) => {
      for (const category of get().categories) {
        if (category.parentId !== parentId || descendants.has(category.id)) continue
        descendants.add(category.id)
        visit(category.id)
      }
    }
    visit(id)
    const removedIds = new Set([id, ...descendants])
    const { error } = await supabase
      .from('vault_categories')
      .delete()
      .in('id', [...removedIds])
    if (error) throw new Error(friendlySyncError(error.message))
    set((state) => ({
      categories: state.categories.filter((category) => !removedIds.has(category.id)),
      links: state.links.map((link) =>
        link.categoryId && removedIds.has(link.categoryId)
          ? { ...link, categoryId: undefined }
          : link,
      ),
      notes: state.notes.map((note) =>
        note.categoryId && removedIds.has(note.categoryId)
          ? { ...note, categoryId: undefined }
          : note,
      ),
      credentials: state.credentials.map((credential) =>
        credential.categoryId && removedIds.has(credential.categoryId)
          ? { ...credential, categoryId: undefined }
          : credential,
      ),
    }))
  },
}))

/** Una sola carga por cambio de sesión; AuthContext ya resolve getSession. */
export function useVaultSync() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (useVaultStore.getState().status !== 'local') {
        void useVaultStore.getState().load()
      }
      return
    }
    if (userId) void useVaultStore.getState().load(userId)
    else useVaultStore.getState().reset()
  }, [userId])
}
