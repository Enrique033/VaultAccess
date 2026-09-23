import { Link, NavLink, useLocation } from 'react-router'
import { KeyRound, Link2, NotebookPen, Vault } from 'lucide-react'
import { CategorySidebar } from './CategorySidebar'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const NAV_ITEMS = [
  { to: '/credentials', label: 'Access', icon: KeyRound },
  { to: '/links', label: 'Links', icon: Link2 },
  { to: '/notes', label: 'Notas', icon: NotebookPen },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-surface transition-all duration-200',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div className="flex h-[var(--header-height)] items-center gap-2 border-b border-border px-4">
        <Link to="/credentials" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-white">
            <Vault className="size-4" />
          </span>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-foreground">
              WorkVault
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="rounded p-1 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground"
          aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {collapsed ? '»' : '«'}
        </button>
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
                'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                active
                  ? 'bg-elevated text-foreground'
                  : 'text-muted hover:bg-elevated hover:text-foreground',
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
    </aside>
  )
}
