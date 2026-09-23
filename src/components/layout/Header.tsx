import { useEffect, useRef } from 'react'
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
  const setQuery = useSearchStore((s) => s.setQuery)
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav)
  const inputRef = useRef<HTMLInputElement>(null)

  /** Ruta actual si tiene buscador propio; si no, /credentials. */
  const searchRoute = SEARCHABLE_ROUTES.find((r) =>
    location.pathname.startsWith(r),
  )

  const handleNew = () => {
    navigate({ pathname: searchRoute ?? '/credentials', search: '?new=1' })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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

      <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-elevated px-3 text-[13px] text-muted transition-colors duration-150 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 sm:max-w-sm">
        <Search className="size-3.5 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar..."
          aria-label="Buscar"
          className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted focus:outline-none"
        />
        <kbd className="pointer-events-none hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted md:inline-block">
          Ctrl K
        </kbd>
      </div>

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
