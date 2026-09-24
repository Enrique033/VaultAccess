import { useEffect, useRef } from 'react'
import { Menu, MessageCircle, Plus, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useSearchStore } from '@/store/search.store'
import { useUIStore } from '@/store/ui.store'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
import { NotificationBell } from '@/components/chat/NotificationBell'

/** Rutas que tienen su propio buscador y botón "Nuevo". */
const SEARCHABLE_ROUTES = ['/credentials', '/links', '/notes']

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)
  const toggleMobileNav = useUIStore((s) => s.toggleMobileNav)
  const toggleChat = useUIStore((s) => s.toggleChat)
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
    <header className="app-header flex h-[var(--header-height)] shrink-0 items-center justify-between gap-2 border-b px-4 transition-colors duration-300 sm:gap-3 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={toggleMobileNav}
        className="-ml-1 rounded-xl p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground lg:hidden"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-border bg-surface/70 px-3.5 text-[13px] text-muted shadow-sm transition-all duration-200 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 sm:max-w-md">
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
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleChat}
          aria-label="Abrir chat interno"
          title="Abrir chat interno"
        >
          <MessageCircle className="size-4" />
        </Button>
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
