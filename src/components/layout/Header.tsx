import { useEffect } from 'react'
import { Search, Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useSearchStore } from '@/store/search.store'
import { UserMenu } from './UserMenu'
import { ThemeToggle } from './ThemeToggle'

export function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const query = useSearchStore((s) => s.query)
  const requestFocus = useSearchStore((s) => s.requestFocus)

  const handleNew = () => {
    navigate({ pathname: '/credentials', search: '?new=1' })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!location.pathname.startsWith('/credentials')) {
          navigate('/credentials')
        }
        requestFocus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [location.pathname, navigate, requestFocus])

  return (
    <header className="flex h-[var(--header-height)] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-6">
      <button
        type="button"
        onClick={() => {
          if (!location.pathname.startsWith('/credentials')) navigate('/credentials')
          requestFocus()
        }}
        className="flex h-8 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-elevated px-3 text-left text-[13px] text-muted transition-colors duration-150 hover:border-primary/40 hover:text-foreground"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="flex-1 truncate">{query ? query : 'Buscar...'}</span>
        <kbd className="pointer-events-none rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted">
          Ctrl K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <Button variant="primary" size="sm" onClick={handleNew}>
          <Plus className="size-3.5" />
          Nuevo
        </Button>
        <UserMenu />
      </div>
    </header>
  )
}
