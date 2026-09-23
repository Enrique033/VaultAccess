import { useEffect } from 'react'
import { Menu, Plus, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useSearchStore } from '@/store/search.store'
import { useUIStore } from '@/store/ui.store'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'

/** Rutas que tienen su propio buscador y botón "Nuevo". */
const SEARCHABLE_ROUTES = ['/credentials', '/links', '/notes']

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const query = useSearchStore((s) => s.query)
  const requestFocus = useSearchStore((s) => s.requestFocus)
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav)

  /** Ruta actual si tiene buscador propio; si no, /credentials. */
  const searchRoute = SEARCHABLE_ROUTES.find((r) =>
    location.pathname.startsWith(r),
  )

  const handleNew = () => {
    navigate({ pathname: searchRoute ?? '/credentials', search: '?new=1' })
  }

  const handleSearchClick = () => {
    if (!searchRoute) navigate('/credentials')
    requestFocus()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!searchRoute) navigate('/credentials')
        requestFocus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchRoute, navigate, requestFocus])

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-4 sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={toggleMobileNav}
        className="-ml-1 rounded-md p-2 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground lg:hidden"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </button>

      <button
        type="button"
        onClick={handleSearchClick}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-elevated px-3 text-left text-[13px] text-muted transition-colors duration-150 hover:border-primary/40 hover:text-foreground sm:max-w-sm"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{query ? query : 'Buscar...'}</span>
        <kbd className="pointer-events-none hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted md:inline-block">
          Ctrl K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        <Button
          variant="primary"
          size="sm"
          onClick={handleNew}
          aria-label="Nuevo elemento"
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">Nuevo</span>
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}
