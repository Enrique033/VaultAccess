import { create } from 'zustand'

export type CredentialSort = 'recent' | 'az' | 'favorites'

interface SearchState {
  query: string
  /** Filtro global por sección. `null` = todas. */
  sectionId: string | null
  /** Filtro global por categoría. `null` = todas, `'none'` = sin categoría, `'favorites'` = favoritas. */
  categoryFilter: string | null
  sort: CredentialSort
  /** Se incrementa para pedir foco al buscador (atajo Ctrl+K del Header). */
  focusSignal: number

  setQuery: (query: string) => void
  setSectionId: (sectionId: string | null) => void
  setCategoryFilter: (categoryFilter: string | null) => void
  setSort: (sort: CredentialSort) => void
  requestFocus: () => void
  clear: () => void
  clearFilters: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  sectionId: null,
  categoryFilter: null,
  sort: 'recent',
  focusSignal: 0,

  setQuery: (query) => set({ query }),
  setSectionId: (sectionId) => set({ sectionId }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setSort: (sort) => set({ sort }),
  requestFocus: () => set((s) => ({ focusSignal: s.focusSignal + 1 })),
  clear: () => set({ query: '', sectionId: null, categoryFilter: null }),
  clearFilters: () => set({ sectionId: null, categoryFilter: null }),
}))
