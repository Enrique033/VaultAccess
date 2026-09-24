import { useEffect, useRef, useState } from 'react'
import { ArrowDownAZ, Check, ChevronDown, Clock, Star } from 'lucide-react'
import type { CredentialSort } from '@/store/search.store'
import { cn } from '@/lib/utils'

interface Props {
  value: CredentialSort
  onChange: (sort: CredentialSort) => void
}

const OPTIONS: { id: CredentialSort; label: string; hint: string }[] = [
  { id: 'recent', label: 'Recientes', hint: 'Últimas actualizadas' },
  { id: 'az', label: 'A–Z', hint: 'Orden alfabético' },
  { id: 'favorites', label: 'Favoritas', hint: 'Solo favoritas' },
]

const ICONS: Record<CredentialSort, typeof Clock> = {
  recent: Clock,
  az: ArrowDownAZ,
  favorites: Star,
}

export function CredentialSortSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0]!
  const Icon = ICONS[current.id]

  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const click = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', key)
    document.addEventListener('mousedown', click)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('mousedown', click)
    }
  }, [open])

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Ordenar"
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-[13px] text-foreground shadow-sm',
          open
            ? 'border-primary/60 ring-4 ring-primary/10'
            : 'hover:border-primary/30',
        )}
      >
        <Icon className="size-3.5 text-muted" />
        <span>{current.label}</span>
        <ChevronDown
          className={cn(
            'size-3.5 text-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-2 w-56 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_40px_-24px_color-mix(in_srgb,var(--c-foreground)_55%,transparent)]"
          role="listbox"
        >
          {OPTIONS.map((o) => {
            const OIcon = ICONS[o.id]
            const active = o.id === value
            return (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.id)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors',
                  active ? 'bg-surface' : 'hover:bg-surface',
                )}
              >
                <OIcon
                  className={cn(
                    'size-3.5 shrink-0',
                    active ? 'text-primary' : 'text-muted',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-[13px]',
                      active ? 'text-foreground' : 'text-muted',
                    )}
                  >
                    {o.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {o.hint}
                  </span>
                </span>
                {active && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
