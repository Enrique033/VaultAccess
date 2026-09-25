import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DropdownContextValue {
  close: () => void
}

const DropdownContext = createContext<DropdownContextValue | null>(null)

/** Panel de 180 px de ancho mínimo; evita que se salga de la ventana. */
const MENU_WIDTH = 200

interface DropdownMenuProps {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'end'
  /** Clase adicional para limitar o posicionar únicamente este panel. */
  contentClassName?: string
  onOpenChange?: (open: boolean) => void
}

export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  contentClassName,
  onOpenChange,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [style, setStyle] = useState<{ top: number; left: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => {
    setOpen(false)
    setStyle(null)
    onOpenChange?.(false)
  }, [onOpenChange])

  /*
    El panel se mide y se coloca en coordenadas de ventana con `fixed`, y se
    monta en un portal. Antes era `absolute` dentro de la tarjeta: al estar la
    columna con `overflow-y-auto`, el menú se recortaba y saltaba de sitio al
    desplazarse, y el parpadeo que se veía era el recorte del contenedor.
  */
  const reposition = useCallback(() => {
    const anchor = containerRef.current?.getBoundingClientRect()
    const panel = panelRef.current?.getBoundingClientRect()
    if (!anchor) return
    const height = panel?.height ?? 0
    const margin = 8

    let left =
      align === 'end'
        ? anchor.right - (panel?.width ?? MENU_WIDTH)
        : anchor.left
    left = Math.min(
      Math.max(margin, left),
      window.innerWidth - (panel?.width ?? MENU_WIDTH) - margin,
    )

    // Si no cabe abajo, se abre hacia arriba.
    const spaceBelow = window.innerHeight - anchor.bottom - margin
    const top =
      spaceBelow < height && anchor.top - margin - height > 0
        ? anchor.top - margin - height
        : anchor.bottom + margin

    setStyle({ top, left })
  }, [align])

  useLayoutEffect(() => {
    if (!open) return
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, reposition])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (containerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close()
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

        {open &&
          createPortal(
            <div
              ref={panelRef}
              role="menu"
              style={{
                top: style?.top ?? -9999,
                left: style?.left ?? -9999,
                minWidth: MENU_WIDTH,
              }}
              className={cn(
                'animate-fade-in fixed z-[100] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_45px_-24px_color-mix(in_srgb,var(--c-foreground)_55%,transparent)]',
                contentClassName,
              )}
            >
              {children}
            </div>,
            document.body,
          )}
      </div>
    </DropdownContext.Provider>
  )
}

interface DropdownMenuItemProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'danger'
  /** Deshabilita la acción (p. ej. abrir un enlace sin URL). */
  disabled?: boolean
}

export function DropdownMenuItem({
  children,
  onClick,
  variant = 'default',
  disabled = false,
}: DropdownMenuItemProps) {
  const ctx = useContext(DropdownContext)

  const handleClick = () => {
    if (disabled) return
    onClick?.()
    ctx?.close()
  }

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors',
        disabled
          ? 'cursor-not-allowed text-muted opacity-50'
          : variant === 'danger'
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
