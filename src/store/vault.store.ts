import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase, isSupabaseConfigured, requireUserId } from '@/lib/supabase'
import {
  toCategory,
  toCredential,
  toHistoryEntry,
  toLink,
  toNote,
  toSection,
} from '@/lib/vault-mapper'
import type {
  CredentialRow,
  HistoryRow,
  LinkRow,
  NoteRow,
} from '@/lib/vault-mapper'
import { CATEGORY_COLORS } from '@/lib/category-colors'
import type {
  Category,
  Credential,
  LinkItem,
  Note,
  PasswordHistoryEntry,
  VaultSection,
} from '@/types'

/** Secciones sugeridas cuando el usuario entra por primera vez (se crean en remoto). */
const DEFAULT_SECTIONS = ['Trabajo', 'Redes'] as const

const DEFAULT_CATS: { name: string; color: string; section: string }[] = [
  { name: 'Desarrollo', color: CATEGORY_COLORS[0]!, section: 'Trabajo' },
  { name: 'Infraestructura', color: CATEGORY_COLORS[2]!, section: 'Trabajo' },
  { name: 'Social', color: CATEGORY_COLORS[3]!, section: 'Redes' },
]

function friendlySyncError(message: string): string {
  if (/row-level security/i.test(message))
    return 'Supabase bloqueó la operación (RLS). Revisa que ejecutaste supabase/schema.sql y que iniciaste sesión.'
  if (/relation .* does not exist/i.test(message))
    return 'Faltan tablas en Supabase. Ejecuta supabase/schema.sql en el SQL Editor.'
  if (/Failed to fetch|NetworkError|network/i.test(message))
    return 'Sin conexión con Supabase. Revisa tu internet o la URL del proyecto.'
  return message
}

export type CredentialInput = Omit<Credential, 'id' | 'createdAt' | 'updatedAt' | 'favorite'>

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
}

export type LinkInput = Omit<
  LinkItem,
  'id' | 'createdAt' | 'updatedAt' | 'favorite'
>
export type NoteInput = Omit<
  Note,
  'id' | 'createdAt' | 'updatedAt' | 'favorite'
>

/** Resultado de una importación de respaldo. */
export type SyncStatus = 'idle' | 'loading' | 'ready' | 'error' | 'local'

interface VaultState {
  credentials: Credential[]
  categories: Category[]
  sections: VaultSection[]
  /** Links/Notas (vault_links / vault_notes). */
  links: LinkItem[]
  notes: Note[]
  /** Versiones anteriores de la clave de la credencial abierta (bajo demanda). */
  history: PasswordHistoryEntry[]
  /** Credencial a la que pertenece `history`. */
  historyCredentialId: string | null
  historyLoading: boolean
  historyError: string | null

  status: SyncStatus
  error: string | null
  /** Carga los datos del usuario logueado. Crea seeds si es su primera vez. */
  load: () => Promise<void>
  /** Vacía el estado local (al cerrar sesión). */
  reset: () => void

  addCredential: (input: CredentialInput) => Promise<Credential>
  updateCredential: (id: string, input: Partial<CredentialInput>) => Promise<void>
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
  moveCategory: (id: string, sectionId: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  addLink: (input: LinkInput) => Promise<LinkItem>
  updateLink: (id: string, input: Partial<LinkInput>) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  toggleLinkFavorite: (id: string) => Promise<void>

  addNote: (input: NoteInput) => Promise<Note>
  updateNote: (id: string, input: Partial<NoteInput>) => Promise<void>
  deleteNote: (id: string) => Promise<void>
  toggleNoteFavorite: (id: string) => Promise<void>
}

function nextColor(categories: Category[]): string {
  const used = new Set(categories.map((c) => c.color.toLowerCase()))
  const free = CATEGORY_COLORS.find((color) => !used.has(color.toLowerCase()))
  if (free) return free
  return CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]!
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
    const { data, error } = await supabase
      .from('vault_password_history')
      .insert({
        user_id: userId,
        credential_id: credential.id,
        password: credential.password,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    const entry = toHistoryEntry(data as HistoryRow)
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
    console.warn('[WorkVault] No se pudo guardar el historial de la clave:', e)
  }
}

export const useVaultStore = create<VaultState>()((set, get) => ({
  credentials: [],
  links: [],
  notes: [],
  history: [],
  historyCredentialId: null,
  historyLoading: false,
  historyError: null,
  categories: [],
  sections: [],

  status: isSupabaseConfigured ? 'idle' : 'local',
  error: null,


  load: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'local', error: null })
      return
    }
    set({ status: 'loading', error: null })
    try {
      const userId = await requireUserId()
      const [secRes, catRes, credRes] = await Promise.all([
        supabase.from('vault_sections').select('*').order('created_at'),
        supabase.from('vault_categories').select('*').order('created_at'),
        supabase.from('vault_credentials').select('*').order('updated_at', { ascending: false }),
      ])
      const firstError = secRes.error ?? catRes.error ?? credRes.error
      if (firstError) throw new Error(friendlySyncError(firstError.message))

      let sections = (secRes.data ?? []).map((r) =>
        toSection(r as { id: string; name: string }),
      )
      let categories = (catRes.data ?? []).map((r) =>
        toCategory(r as { id: string; name: string; color: string; section_id: string }),
      )
      const credentials = (credRes.data ?? []).map((r) =>
        toCredential(
          r as {
            id: string; title: string; username: string; password: string
            url: string | null; category_id: string | null; notes: string | null
            favorite: boolean; created_at: string; updated_at: string
          },
        ),
      )

      if (sections.length === 0) {
        const created: VaultSection[] = []
        for (const name of DEFAULT_SECTIONS) {
          const { data, error } = await supabase
            .from('vault_sections')
            .insert({ user_id: userId, name })
            .select()
            .single()
          if (error) throw new Error(friendlySyncError(error.message))
          created.push(toSection(data as { id: string; name: string }))
        }
        sections = created
        const byName = new Map(created.map((s) => [s.name, s.id]))
        const seeded: Category[] = []
        for (const seed of DEFAULT_CATS) {
          const sectionId = byName.get(seed.section)
          if (!sectionId) continue
          const { data, error } = await supabase
            .from('vault_categories')
            .insert({ user_id: userId, section_id: sectionId, name: seed.name, color: seed.color })
            .select()
            .single()
          if (error) throw new Error(friendlySyncError(error.message))
          seeded.push(
            toCategory(data as { id: string; name: string; color: string; section_id: string }),
          )
        }
        categories = seeded
      }

      set({ status: 'ready', error: null, sections, categories, credentials })

      // Links/Notas: carga best-effort; si aún no existe la tabla, no bloquea.
      const [linkRes, noteRes] = await Promise.all([
        supabase.from('vault_links').select('*').order('updated_at', { ascending: false }),
        supabase.from('vault_notes').select('*').order('updated_at', { ascending: false }),
      ])
      if (!linkRes.error && linkRes.data) {
        set({ links: linkRes.data.map((r) => toLink(r as LinkRow)) })
      }
      if (!noteRes.error && noteRes.data) {
        set({ notes: noteRes.data.map((r) => toNote(r as NoteRow)) })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al cargar tus datos.'
      set({ status: 'error', error: message })
    }
  },

  reset: () =>
    set({
      credentials: [],
      categories: [],
      sections: [],
      links: [],
      notes: [],
      history: [],
      historyCredentialId: null,
      historyLoading: false,
      historyError: null,
      status: 'idle',
      error: null,
    }),

  addCredential: async (input) => {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('vault_credentials')
      .insert({
        user_id: userId,
        title: input.title,
        username: input.username,
        password: input.password,
        url: input.url ?? null,
        category_id: input.categoryId ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    if (!data) throw new Error('No se pudo recuperar la credencial creada.')
    const credential = toCredential(
      data as {
        id: string; title: string; username: string; password: string
        url: string | null; category_id: string | null; notes: string | null
        favorite: boolean; created_at: string; updated_at: string
      },
    )
    set((s) => ({ credentials: [credential, ...s.credentials] }))
    return credential
  },

  updateCredential: async (id, input) => {
    const previous = get().credentials.find((c) => c.id === id)
    /** Solo hay historial si la clave cambia de verdad. */
    const passwordChanged =
      input.password !== undefined && input.password !== previous?.password
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.username !== undefined) patch.username = input.username
    if (input.password !== undefined) patch.password = input.password
    if (input.url !== undefined) patch.url = input.url ?? null
    if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null
    if (input.notes !== undefined) patch.notes = input.notes ?? null
    const { data, error } = await supabase
      .from('vault_credentials')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = toCredential(
      data as {
        id: string; title: string; username: string; password: string
        url: string | null; category_id: string | null; notes: string | null
        favorite: boolean; created_at: string; updated_at: string
      },
    )
    set((s) => ({ credentials: s.credentials.map((c) => (c.id === id ? updated : c)) }))

    // Guarda la clave reemplazada (best-effort: no interrumpe el guardado).
    if (passwordChanged && previous) await recordPasswordChange(previous)
  },

  deleteCredential: async (id) => {
    const { error } = await supabase.from('vault_credentials').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({
      credentials: s.credentials.filter((c) => c.id !== id),
      // En la base cae en cascada; aquí limpiamos la copia local.
      history:
        s.historyCredentialId === id
          ? []
          : s.history.filter((h) => h.credentialId !== id),
      historyCredentialId: s.historyCredentialId === id ? null : s.historyCredentialId,
    }))
  },


  toggleCredentialFavorite: async (id) => {
    const current = get().credentials.find((c) => c.id === id)
    if (!current) return
    const { data, error } = await supabase
      .from('vault_credentials')
      .update({ favorite: !current.favorite })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = toCredential(
      data as {
        id: string; title: string; username: string; password: string
        url: string | null; category_id: string | null; notes: string | null
        favorite: boolean; created_at: string; updated_at: string
      },
    )
    set((s) => ({ credentials: s.credentials.map((c) => (c.id === id ? updated : c)) }))
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
      rows.push({
        user_id: userId,
        title,
        username,
        password: item.password,
        url: item.url?.trim() || null,
        category_id: item.categoryId || null,
        notes: item.notes?.trim() || null,
      })
    }

    // Inserta por lotes para no enviar payloads enormes de una vez.
    const created: Credential[] = []
    for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
      const { data, error } = await supabase
        .from('vault_credentials')
        .insert(rows.slice(i, i + IMPORT_CHUNK))
        .select()
      if (error) throw new Error(friendlySyncError(error.message))
      created.push(
        ...(data ?? []).map((row) => toCredential(row as CredentialRow)),
      )
    }
    if (created.length > 0)
      set((s) => ({ credentials: [...created, ...s.credentials] }))

    return { created: created.length, skipped }
  },

  loadCredentialHistory: async (credentialId) => {
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
    const { data, error } = await supabase
      .from('vault_password_history')
      .select('*')
      .eq('credential_id', credentialId)
      .order('changed_at', { ascending: false })
      .limit(HISTORY_LIMIT)
    if (error) {
      set({
        historyLoading: false,
        historyError: historyFriendlyError(error.message),
      })
      return
    }
    set({
      history: (data ?? []).map((row) => toHistoryEntry(row as HistoryRow)),
      historyLoading: false,
      historyError: null,
    })
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

  addLink: async (input) => {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('vault_links')
      .insert({
        user_id: userId,
        title: input.title,
        url: input.url,
        category_id: input.categoryId ?? null,
        description: input.description ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    if (!data) throw new Error('No se pudo recuperar el enlace creado.')
    const link = toLink(data as LinkRow)
    set((s) => ({ links: [link, ...s.links] }))
    return link
  },

  updateLink: async (id, input) => {
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.url !== undefined) patch.url = input.url
    if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null
    if (input.description !== undefined) patch.description = input.description ?? null
    const { data, error } = await supabase
      .from('vault_links')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = toLink(data as LinkRow)
    set((s) => ({ links: s.links.map((l) => (l.id === id ? updated : l)) }))
  },

  deleteLink: async (id) => {
    const { error } = await supabase.from('vault_links').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({ links: s.links.filter((l) => l.id !== id) }))
  },

  toggleLinkFavorite: async (id) => {
    const current = get().links.find((l) => l.id === id)
    if (!current) return
    const { data, error } = await supabase
      .from('vault_links')
      .update({ favorite: !current.favorite })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = toLink(data as LinkRow)
    set((s) => ({ links: s.links.map((l) => (l.id === id ? updated : l)) }))
  },

  addNote: async (input) => {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('vault_notes')
      .insert({
        user_id: userId,
        title: input.title,
        content: input.content,
        category_id: input.categoryId ?? null,
      })
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    if (!data) throw new Error('No se pudo recuperar la nota creada.')
    const note = toNote(data as NoteRow)
    set((s) => ({ notes: [note, ...s.notes] }))
    return note
  },

  updateNote: async (id, input) => {
    const patch: Record<string, unknown> = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.content !== undefined) patch.content = input.content
    if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null
    const { data, error } = await supabase
      .from('vault_notes')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = toNote(data as NoteRow)
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }))
  },

  deleteNote: async (id) => {
    const { error } = await supabase.from('vault_notes').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }))
  },

  toggleNoteFavorite: async (id) => {
    const current = get().notes.find((n) => n.id === id)
    if (!current) return
    const { data, error } = await supabase
      .from('vault_notes')
      .update({ favorite: !current.favorite })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const updated = toNote(data as NoteRow)
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? updated : n)) }))
  },

  addSection: async (name) => {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('vault_sections')
      .insert({ user_id: userId, name: name.trim() })
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const section = toSection(data as { id: string; name: string })
    set((s) => ({ sections: [...s.sections, section] }))
    return section
  },

  renameSection: async (id, name) => {
    const next = name.trim()
    if (!next) return
    const { error } = await supabase.from('vault_sections').update({ name: next }).eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({ sections: s.sections.map((sec) => (sec.id === id ? { ...sec, name: next } : sec)) }))
  },

  deleteSection: async (id) => {
    const state = get()
    const orphans = state.categories.filter((c) => c.sectionId === id)
    const remaining = state.sections.filter((s) => s.id !== id)
    if (orphans.length > 0 && remaining.length > 0) {
      const fallback = remaining[0]!.id
      const { error } = await supabase
        .from('vault_categories')
        .update({ section_id: fallback })
        .eq('section_id', id)
      if (error) throw new Error(friendlySyncError(error.message))
    }
    const { error } = await supabase.from('vault_sections').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    await get().load()
  },

  addCategory: async (input) => {
    const userId = await requireUserId()
    const { data, error } = await supabase
      .from('vault_categories')
      .insert({
        user_id: userId,
        section_id: input.sectionId,
        name: input.name.trim(),
        color: input.color ?? nextColor(get().categories),
      })
      .select()
      .single()
    if (error) throw new Error(friendlySyncError(error.message))
    const category = toCategory(
      data as { id: string; name: string; color: string; section_id: string },
    )
    set((s) => ({ categories: [...s.categories, category] }))
    return category
  },

  renameCategory: async (id, name) => {
    const next = name.trim()
    if (!next) return
    const { error } = await supabase.from('vault_categories').update({ name: next }).eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, name: next } : c)) }))
  },

  moveCategory: async (id, sectionId) => {
    const { error } = await supabase
      .from('vault_categories')
      .update({ section_id: sectionId })
      .eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, sectionId } : c)) }))
  },

  deleteCategory: async (id) => {
    const { error } = await supabase.from('vault_categories').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    await get().load()
  },
}))

/** Sincroniza el store con la sesión: carga al entrar, limpia al salir. Montar una vez. */
export function useVaultSync() {
  useEffect(() => {
    let cancelled = false
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      if (session) void useVaultStore.getState().load()
      else useVaultStore.getState().reset()
    })
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) void useVaultStore.getState().load()
      else useVaultStore.getState().reset()
    })
    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])
}
