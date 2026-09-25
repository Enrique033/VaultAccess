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

/** Modo de visualización de los listados del Vault. */
export type VaultView = 'grid' | 'board'

interface UIState {
  sidebarCollapsed: boolean
  /** Drawer de navegación en móvil/tablet. */
  mobileNavOpen: boolean
  /** Drawer de chat interno. No se persiste entre sesiones. */
  chatOpen: boolean
  theme: Theme
  /** Rejilla o tablero por columnas. */
  vaultView: VaultView
  toasts: Toast[]

  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleMobileNav: () => void
  setMobileNavOpen: (open: boolean) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  toggleTheme: () => void
  setVaultView: (view: VaultView) => void

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
      chatOpen: false,
      theme: 'light' as Theme,
      vaultView: 'grid' as VaultView,
      toasts: [],

      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

      toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

      toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

      setChatOpen: (chatOpen) => set({ chatOpen }),

      toggleTheme: () =>
        set((s) => {
          const theme: Theme = s.theme === 'dark' ? 'light' : 'dark'
          applyTheme(theme)
          return { theme }
        }),

      setVaultView: (vaultView) => set({ vaultView }),

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
        vaultView: state.vaultView,
      }),
      onRehydrateStorage: () => (state) => {
        // El producto es light-first: una preferencia oscura antigua no debe
        // impedir que el primer inicio se vea en claro.
        if (state) {
          state.theme = 'light'
          applyTheme('light')
        }
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
