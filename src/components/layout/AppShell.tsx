import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Sidebar, MobileSidebar } from './Sidebar'
import { Header } from './Header'
import { useUIStore } from '@/store/ui.store'
import { useVaultSync } from '@/store/vault.store'
import { useIdleSignOut } from '@/hooks/useIdleSignOut'

export function AppShell() {
  useVaultSync()
  useIdleSignOut()

  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const mobileNavOpen = useUIStore((s) => s.mobileNavOpen)
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen)
  const location = useLocation()
  // Cierra el drawer al navegar (setMobileNavOpen es estable: acción del store).
  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

      <MobileSidebar open={mobileNavOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}