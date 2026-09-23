import { useEffect } from 'react'
import type { MouseEvent } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Sidebar, MobileSidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/store/ui.store'
import { useSearchStore } from '@/store/search.store'
import { useVaultSync } from '@/store/vault.store'
import { useIdleSignOut } from '@/hooks/useIdleSignOut'
import { isSupabaseConfigured } from '@/lib/supabase'

export function AppShell() {
  useVaultSync()
  useIdleSignOut()

  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen)
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const clearFilters = useSearchStore((s) => s.clearFilters)
  const location = useLocation()
  // Cierra el drawer al navegar (setMobileNavOpen es estable: acción del store).
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  /**
   * Click en el fondo del contenido (fuera de tarjetas, botones, inputs y
   * menús): deselecciona la sección/categoría activa para que el filtro no
   * quede "pegado". La búsqueda (query) no se toca.
   */
  const handleContentClick = (e: MouseEvent<HTMLElement>) => {
    if (sectionId === null && categoryFilter === null) return
    const el = e.target as HTMLElement
    if (
      el.closest(
        'button, a, input, textarea, select, label, [data-card], [role="dialog"], [role="menu"]',
      )
    ) {
      return
    }
    clearFilters()
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <MobileSidebar open={mobileNavOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        {!isSupabaseConfigured && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs leading-relaxed text-amber-200 sm:px-5 lg:px-6">
            Supabase no está configurado (falta{' '}
            <code className="font-mono">VITE_SUPABASE_URL</code> /{' '}
            <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>): la app
            funciona en modo local y los datos <strong>no se sincronizan</strong>.
          </div>
        )}
        <main
          onClick={handleContentClick}
          className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}