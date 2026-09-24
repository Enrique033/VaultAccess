import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

interface DropdownContextValue {
  close: () => void
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
  onOpenChange?: (open: boolean) => void
}

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  onOpenChange,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    onOpenChange?.(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, open])

  return (
    <DropdownContext.Provider value={{ close }}>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() =>
            setOpen((previous) => {
              const next = !previous
              onOpenChange?.(next)
              return next
            })
          }
          className="inline-flex items-center justify-center rounded-xl p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {trigger}
        </button>

        {open && (
          <div
            role="menu"
            className={cn(
              'animate-fade-in absolute top-full z-50 mt-2 min-w-[180px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_45px_-24px_color-mix(in_srgb,var(--c-foreground)_55%,transparent)]',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {children}
          </div>
        )}
      </div>
    </DropdownContext.Provider>
  )
}

interface DropdownMenuItemProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'danger'
}

export function DropdownMenuItem({
  children,
  onClick,
  variant = 'default',
}: DropdownMenuItemProps) {
  const ctx = useContext(DropdownContext)

  const handleClick = () => {
    onClick?.()
    ctx?.close()
  }

  return (
    <button
      type="button"
      role="menuitem"
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors',
        variant === 'danger'
          ? 'text-danger hover:bg-danger/10 hover:text-danger'
          : 'text-foreground hover:bg-surface',
      )}
    >
      {children}
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <div className="my-1.5 h-px bg-border" role="separator" />
}
