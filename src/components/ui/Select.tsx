import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  /** Texto secundario opcional bajo el label. */
  description?: string
}

export interface SelectProps {
  /** `id` del disparador. */
  id?: string
  /** Valor actual (debe coincidir con `option.value`). */
  value: string
  /** Notificado al padre con el nuevo `option.value`. */
  onChange: (value: string) => void
  /** Opciones del listado. */
  options: SelectOption[]
  /** Texto de marcador cuando nada est� seleccionado. */
  placeholder?: string
  className?: string
  /** Nombre accesible cuando no hay una etiqueta visible asociada. */
  ariaLabel?: string
}

/**
 * Select de dise�o propio (no nativo). El `<select>` HTML se renderiza con el
 * estilo del sistema operativo y rompe la coherencia visual de la web; esta
 * versi�n propone un disparador de bot�n y un panel flotante con a11y de
 * `listbox`, navegaci�n por teclado y el tema Tailwind de la app (igual que
 * `CategorySelect` y `CredentialSortSelect`).
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar�',
  className,
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    height: number
  } | null>(null)

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = options.find((o) => o.value === value)
  const displayValue = selected ? selected.label : placeholder
  const showPlaceholder = !selected

  const openAt = (index: number) => {
    setOpen(true)
    setActiveIndex(index)
  }

  const close = () => setOpen(false)

  const select = (index: number) => {
    const next = options[index].value
    if (next !== value) onChange(next)
    close()
  }

  // Cuando se abre, mide el disparador y escucha cierre exterior / resize.
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    if (!trigger) {
      setOpen(false)
      return
    }
    const { top, left, width, height } = trigger.getBoundingClientRect()
    setCoords({ top, left, width, height })
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        close()
      }
    }
    const onResize = () => close()
    const onScroll = () => close()
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onResize)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open, selectedIndex])

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        if (open) setActiveIndex((i) => (i + 1) % options.length)
        else openAt(selectedIndex >= 0 ? selectedIndex : 0)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (open) close()
        else openAt(selectedIndex >= 0 ? selectedIndex : 0)
        break
      case 'Escape':
        close()
        break
    }
  }

  const onPanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!open) return
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % options.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + options.length) % options.length)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        select(activeIndex)
        break
      case 'Tab':
        close()
        break
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? 'select-panel' : undefined}
        aria-label={ariaLabel}
        className={cn(
          'flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-elevated px-3 text-left text-base text-foreground lg:h-9 lg:text-[13px]',
          'transition-colors duration-150',
          'focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
          'hover:border-primary/40',
          open && 'border-primary/50 ring-1 ring-primary/20',
        )}
        onClick={() =>
          open ? close() : openAt(selectedIndex >= 0 ? selectedIndex : 0)
        }
        onKeyDown={onTriggerKeyDown}
      >
        <span className="block w-full truncate">
          {showPlaceholder ? (
            <span className="text-muted">{placeholder}</span>
          ) : (
            displayValue
          )}
        </span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-muted transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            id="select-panel"
            ref={panelRef}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={`select-option-${activeIndex}`}
            onKeyDown={onPanelKeyDown}
            className={cn(
              'animate-fade-in pointer-events-auto z-30 flex flex-col gap-0.5 overflow-auto rounded-lg border border-border bg-elevated p-1 shadow-2xl',
            )}
            style={{
              position: 'fixed',
              top: coords.top + coords.height + 6,
              left: coords.left,
              width: coords.width,
              minWidth: coords.width,
              maxHeight: 'calc(100dvh - 6rem)',
            }}
          >
            {options.map((o, i) => {
              const isActive = i === activeIndex
              const isSelected = o.value === value
              return (
                <button
                  key={o.value}
                  id={`select-option-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseMove={() => setActiveIndex(i)}
                  onClick={() => select(i)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                    'text-[13px]',
                    isSelected
                      ? 'bg-primary/15 text-primary'
                      : isActive
                        ? 'bg-surface text-foreground'
                        : 'text-muted hover:bg-surface hover:text-foreground',
                  )}
                >
                  <Check
                    className={cn(
                      'size-3.5 shrink-0',
                      isSelected ? 'text-primary' : 'invisible',
                    )}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.description ? (
                    <span className="block text-[10px] text-muted">
                      {o.description}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}