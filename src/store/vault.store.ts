import { useEffect } from 'react'
import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import {
  toCategory,
  toCredential,
  toSection,
} from '@/lib/vault-mapper'
import { CATEGORY_COLORS } from '@/lib/category-colors'
import type { Category, Credential, VaultSection } from '@/types'

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

export type SyncStatus = 'idle' | 'loading' | 'ready' | 'error' | 'local'

interface VaultState {
  credentials: Credential[]
  categories: Category[]
  sections: VaultSection[]
  /** Links/Notas siguen locales hasta su migración. */
  links: never[]
  notes: never[]

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
}

function nextColor(categories: Category[]): string {
  const used = new Set(categories.map((c) => c.color.toLowerCase()))
  const free = CATEGORY_COLORS.find((color) => !used.has(color.toLowerCase()))
  if (free) return free
  return CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]!
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al cargar la bóveda.'
      set({ status: 'error', error: message })
    }
  },

  reset: () => set({ credentials: [], categories: [], sections: [], status: 'idle', error: null }),

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