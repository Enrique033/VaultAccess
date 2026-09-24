import { useEffect, useRef } from 'react'
import { Menu, MessageCircle, Plus, Search, Users } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useSearchStore } from '@/store/search.store'
import { useUIStore } from '@/store/ui.store'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'
import { NotificationBell } from '@/components/chat/NotificationBell'
import { usePresenceContext } from '@/hooks/usePresence'
import { cn } from '@/lib/utils'

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
  const { globalOnline, isGlobalOwner } = usePresenceContext()

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
    <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-2 border-b border-border bg-surface/80 px-4 transition-colors duration-300 sm:gap-3 sm:px-6 backdrop-blur-md dark:border-border dark:bg-surface/50">
      <button
        type="button"
        onClick={toggleMobileNav}
        className="-ml-1 rounded-md p-2 text-muted transition-colors duration-150 hover:bg-elevated hover:text-foreground lg:hidden"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-elevated px-3 text-[13px] text-muted transition-all duration-200 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 sm:max-w-sm dark:border-border dark:bg-elevated dark:text-muted dark:focus-within:border-violet-400 dark:focus-within:ring-violet-400/20">
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
        {/* Badge global online - SOLO para elvissebas39@gmail.com */}
        {isGlobalOwner && globalOnline !== null && (
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-600/10 px-3 py-1 text-xs font-medium text-violet-600 dark:border-violet-500/30 dark:text-violet-400',
            )}
            title="Usuarios conectados globalmente"
          >
            <Users className="size-3.5" />
            <span>Global Online: {globalOnline}</span>
          </span>
        )}

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
