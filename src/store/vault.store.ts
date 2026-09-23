import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  toCategory,
  toCredential,
  toLink,
  toNote,
  toSection,
} from '@/lib/vault-mapper'
import type { LinkRow, NoteRow } from '@/lib/vault-mapper'
import { CATEGORY_COLORS } from '@/lib/category-colors'
import type { VaultExportData } from '@/lib/vault-io'
import type {
  Category,
  Credential,
  LinkItem,
  Note,
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
export interface ImportResult {
  sections: number
  categories: number
  credentials: number
  links: number
  notes: number
}

export type SyncStatus = 'idle' | 'loading' | 'ready' | 'error' | 'local'

interface VaultState {
  credentials: Credential[]
  categories: Category[]
  sections: VaultSection[]
  /** Links/Notas (vault_links / vault_notes). */
  links: LinkItem[]
  notes: Note[]

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

  /** Importa un respaldo JSON y recarga la bóveda. */
  importVault: (data: VaultExportData) => Promise<ImportResult>
}

function nextColor(categories: Category[]): string {
  const used = new Set(categories.map((c) => c.color.toLowerCase()))
  const free = CATEGORY_COLORS.find((color) => !used.has(color.toLowerCase()))
  if (free) return free
  return CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]!
}

function isValidDate(value: string): boolean {
  return Boolean(value) && !Number.isNaN(Date.parse(value))
}

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Sin sesión. Inicia sesión de nuevo.')
  return id
}

export const useVaultStore = create<VaultState>()((set, get) => ({
  credentials: [],
  links: [],
  notes: [],
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
      const message = e instanceof Error ? e.message : 'Error al cargar la bóveda.'
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
  },

  deleteCredential: async (id) => {
    const { error } = await supabase.from('vault_credentials').delete().eq('id', id)
    if (error) throw new Error(friendlySyncError(error.message))
    set((s) => ({ credentials: s.credentials.filter((c) => c.id !== id) }))
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

  importVault: async (data) => {
    const userId = await requireUserId()
    const norm = (s: string) => s.trim().toLowerCase()
    const secMap = new Map<string, string>()
    const catMap = new Map<string, string>()
    const counts: ImportResult = {
      sections: 0,
      categories: 0,
      credentials: 0,
      links: 0,
      notes: 0,
    }

    /** Crea (o reutiliza por nombre) una sección y devuelve su id. */
    const ensureSection = async (
      importedId: string,
      name: string,
    ): Promise<string> => {
      const cached = secMap.get(importedId)
      if (cached) return cached
      const existing = get().sections.find((s) => norm(s.name) === norm(name))
      if (existing) {
        secMap.set(importedId, existing.id)
        return existing.id
      }
      const { data: created, error } = await supabase
        .from('vault_sections')
        .insert({
          user_id: userId,
          name: name.trim().slice(0, 60) || 'Importada',
        })
        .select()
        .single()
      if (error) throw new Error(friendlySyncError(error.message))
      const section = toSection(created as { id: string; name: string })
      set((s) => ({ sections: [...s.sections, section] }))
      secMap.set(importedId, section.id)
      counts.sections += 1
      return section.id
    }

    /** Crea (o reutiliza por nombre dentro de la sección) una categoría. */
    const ensureCategory = async (imported: Category): Promise<string> => {
      const cached = catMap.get(imported.id)
      if (cached) return cached
      const sectionName =
        data.sections.find((s) => s.id === imported.sectionId)?.name ?? 'General'
      const sectionId = await ensureSection(imported.sectionId, sectionName)
      const existing = get().categories.find(
        (c) => c.sectionId === sectionId && norm(c.name) === norm(imported.name),
      )
      if (existing) {
        catMap.set(imported.id, existing.id)
        return existing.id
      }
      const { data: created, error } = await supabase
        .from('vault_categories')
        .insert({
          user_id: userId,
          section_id: sectionId,
          name: imported.name,
          color: imported.color,
        })
        .select()
        .single()
      if (error) throw new Error(friendlySyncError(error.message))
      const category = toCategory(
        created as { id: string; name: string; color: string; section_id: string },
      )
      set((s) => ({ categories: [...s.categories, category] }))
      catMap.set(imported.id, category.id)
      counts.categories += 1
      return category.id
    }

    for (const section of data.sections) {
      await ensureSection(section.id, section.name)
    }
    for (const category of data.categories) {
      await ensureCategory(category)
    }

    // Credenciales en lote (omitimos las que ya existen por id).
    const existingCredIds = new Set(get().credentials.map((c) => c.id))
    const credentialRows = data.credentials
      .filter((c) => !existingCredIds.has(c.id))
      .map((c) => ({
        user_id: userId,
        title: c.title,
        username: c.username,
        password: c.password,
        url: c.url ?? null,
        category_id: c.categoryId ? (catMap.get(c.categoryId) ?? null) : null,
        notes: c.notes ?? null,
        favorite: c.favorite,
        ...(isValidDate(c.createdAt) ? { created_at: c.createdAt } : {}),
      }))
    if (credentialRows.length > 0) {
      const { error } = await supabase.from('vault_credentials').insert(credentialRows)
      if (error) throw new Error(friendlySyncError(error.message))
      counts.credentials = credentialRows.length
    }

    // Links y notas (también omitimos duplicados por id).
    const existingLinkIds = new Set(get().links.map((l) => l.id))
    const linkRows = data.links
      .filter((l) => !existingLinkIds.has(l.id))
      .map((l) => ({
        user_id: userId,
        title: l.title,
        url: l.url,
        category_id: l.categoryId ? (catMap.get(l.categoryId) ?? null) : null,
        description: l.description ?? null,
        favorite: l.favorite,
        ...(isValidDate(l.createdAt) ? { created_at: l.createdAt } : {}),
      }))
    if (linkRows.length > 0) {
      const { error } = await supabase.from('vault_links').insert(linkRows)
      if (error) throw new Error(friendlySyncError(error.message))
      counts.links = linkRows.length
    }

    const existingNoteIds = new Set(get().notes.map((n) => n.id))
    const noteRows = data.notes
      .filter((n) => !existingNoteIds.has(n.id))
      .map((n) => ({
        user_id: userId,
        title: n.title,
        content: n.content,
        category_id: n.categoryId ? (catMap.get(n.categoryId) ?? null) : null,
        favorite: n.favorite,
        ...(isValidDate(n.createdAt) ? { created_at: n.createdAt } : {}),
      }))
    if (noteRows.length > 0) {
      const { error } = await supabase.from('vault_notes').insert(noteRows)
      if (error) throw new Error(friendlySyncError(error.message))
      counts.notes = noteRows.length
    }

    await get().load()
    return counts
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