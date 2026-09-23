import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/storage'
import { generateId } from '@/lib/id'

export type ToastVariant = 'default' | 'success' | 'error'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

export type Theme = 'light' | 'dark'

interface UIState {
  sidebarCollapsed: boolean
  /** Drawer de navegación en móvil/tablet. */
  mobileNavOpen: boolean
  theme: Theme
  toasts: Toast[]

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleMobileNav: () => void
  setMobileNavOpen: (open: boolean) => void
  toggleTheme: () => void

  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      mobileNavOpen: false,
      theme: 'dark' as Theme,
      toasts: [],

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

      toggleTheme: () =>
        set((s) => {
          const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
          applyTheme(theme)
          return { theme }
        }),

      addToast: (toast) => {
        const id = generateId()
        set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
      },

      removeToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: STORAGE_KEYS.ui,
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        // Aplica la clase .dark en el arranque (antes de pintar) según la preferencia guardada.
        if (state) applyTheme(state.theme)
      },
    },
  ),
)

/**
 * Helpers para emitir toasts desde cualquier lugar sin pasar por el hook.
 * Útil para handlers y lógica fuera de componentes React.
 */
export const toast = {
  show: (title: string, description?: string) =>
    useUIStore.getState().addToast({ title, description, variant: 'default' }),
  success: (title: string, description?: string) =>
    useUIStore.getState().addToast({ title, description, variant: 'success' }),
  error: (title: string, description?: string) =>
    useUIStore.getState().addToast({ title, description, variant: 'error' }),
}