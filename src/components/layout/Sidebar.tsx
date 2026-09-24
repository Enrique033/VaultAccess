import { useCallback, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import {
  KeyRound,
  Link2,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Users2,
  Vault,
  X,
} from 'lucide-react'
import { CategorySidebar } from './CategorySidebar'
import { useUIStore } from '@/store/ui.store'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/credentials', label: 'Access', icon: KeyRound },
  { to: '/links', label: 'Links', icon: Link2 },
  { to: '/notes', label: 'Notas', icon: NotebookPen },
  { to: '/workspaces', label: 'Equipos', icon: Users2 },
]

interface SidebarPanelProps {
  collapsed: boolean
  onToggle?: () => void
  onClose?: () => void
}

function SidebarPanel({ collapsed, onToggle, onClose }: SidebarPanelProps) {
  const location = useLocation()

  return (
    <>
      <div
        className={cn(
          'flex h-[var(--header-height)] items-center gap-2 border-b border-border bg-surface transition-colors duration-300 dark:border-border dark:bg-surface/50',
          collapsed ? 'justify-center px-2' : 'px-4',
        )}
      >
        <Link
          to="/credentials"
          className={cn('flex min-w-0 items-center gap-2', collapsed ? '' : 'flex-1')}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
            <Vault className="size-4.5" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-bold tracking-tight text-foreground dark:text-zinc-100">
              WorkVault
            </span>
          )}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground"
            aria-label="Cerrar menú"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active =
            location.pathname === item.to ||
            (item.to !== '/credentials' && location.pathname.startsWith(item.to))

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 sm:py-2',
                active
                  ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400'
                  : 'text-muted hover:bg-elevated hover:text-foreground dark:text-muted dark:hover:bg-elevated dark:hover:text-foreground',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {!collapsed && (
        <div className="max-h-[55%] overflow-y-auto overscroll-contain border-t border-border p-3">
          <CategorySidebar />
        </div>
      )}

      {onToggle && (
        <div className="border-t border-border p-2">
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-md p-2 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground',
              !collapsed && 'justify-end',
            )}
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
            {!collapsed && <span className="text-xs">Contraer</span>}
          </button>
        </div>
      )}
    </>
  )
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

/** Sidebar de escritorio (visible en lg+). */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-surface transition-all duration-200 lg:flex dark:backdrop-blur-xl',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <SidebarPanel collapsed={collapsed} onToggle={onToggle} />
    </aside>
  )
}

interface MobileSidebarProps {
  open: boolean
}

/** Drawer de navegación para móvil/tablet (con overlay y cierre con Escape). */
export function MobileSidebar({ open }: MobileSidebarProps) {
  const setMobileNavOpen = useUIStore((s) => s.setMobileNavOpen)
  const location = useLocation()
  // Identidad estable: los effects no deben re-ejecutarse por re-renders.
  const close = useCallback(() => setMobileNavOpen(false), [setMobileNavOpen])

  // Cierra al navegar.
  useEffect(() => {
    close()
  }, [location.pathname, close])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />
      <aside className="animate-slide-in-left absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-border bg-surface shadow-2xl">
        <SidebarPanel collapsed={false} onClose={close} />
      </aside>
    </div>
  )
}
