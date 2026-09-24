import { create } from 'zustand'

export type CredentialSort = 'recent' | 'az' | 'favorites'

interface SearchState {
  query: string
  /** Filtro global por sección. `null` = todas. */
  sectionId: string | null
  /** Filtro global por categoría. `null` = todas, `'none'` = sin categoría, `'favorites'` = favoritas. */
  categoryFilter: string | null
  sort: CredentialSort
  /** Muestra solo credenciales con clave débil (score ≤ 1). */
  weakOnly: boolean

  setQuery: (query: string) => void
  setSectionId: (sectionId: string | null) => void
  setCategoryFilter: (categoryFilter: string | null) => void
  setSort: (sort: CredentialSort) => void
  setWeakOnly: (weakOnly: boolean) => void
  clear: () => void
  clearFilters: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  sectionId: null,
  categoryFilter: null,
  sort: 'recent',
  weakOnly: false,

  setQuery: (query) => set({ query }),
  setSectionId: (sectionId) => set({ sectionId }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSort: (sort) => set({ sort }),
  setWeakOnly: (weakOnly) => set({ weakOnly }),
  clear: () =>
    set({ query: '', sectionId: null, categoryFilter: null, weakOnly: false }),
  clearFilters: () =>
    set({ sectionId: null, categoryFilter: null, weakOnly: false }),
}))
