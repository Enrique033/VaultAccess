import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Hash, Plus, Search } from 'lucide-react'
import { useVaultStore } from '@/store/vault.store'
import { CATEGORY_COLORS } from '@/lib/category-colors'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (id: string) => void
  id?: string
}

type Mode = 'list' | 'create'

export function CategorySelect({ value, onChange, id }: Props) {
  const categories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const addSection = useVaultStore((s) => s.addSection)
  const addCategory = useVaultStore((s) => s.addCategory)

  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [mode, setMode] = useState<Mode>('list')
  const [name, setName] = useState('')
  const [sectionId, setSectionId] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const selected = categories.find((c) => c.id === value)

  useEffect(() => {
    if (!open) return
    setQ('')
    setMode('list')
    requestAnimationFrame(() => input.current?.focus())
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
  }, [open ])

  const query = q.trim().toLowerCase()
  const match = (n: string) => !query || n.toLowerCase().includes(query)
  const exactExists = categories.some((c) => c.name.toLowerCase() === query)

  const beginCreate = async () => {
    const fallback = sections[0]?.id ?? (await addSection('General')).id
    setSectionId(fallback)
    setName(q.trim())
    setMode('create')
  }

  const confirm = async () => {
    const finalName = name.trim() || q.trim()
    if (!finalName || !sectionId) return
    const cat = await addCategory({ name: finalName, sectionId, color: CATEGORY_COLORS[0] })
    onChange(cat.id)
    setOpen(false)
  }

  const item = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors',
      active ? 'bg-surface text-foreground' : 'text-muted hover:bg-surface hover:text-foreground',
    )



  return (
    <div ref={box} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-md border border-border bg-elevated px-3 text-left text-base lg:h-9 lg:text-[13px]',
          open ? 'border-primary/50 ring-2 ring-primary/20' : 'hover:border-primary/40',
        )}
      >
        {selected ? (
          <>
            <span className="size-2 rounded-full" style={{ backgroundColor: selected.color }} />
            <span className="flex-1 truncate text-foreground">{selected.name}</span>
          </>
        ) : (
          <>
            <Hash className="size-3.5 text-muted" />
            <span className="flex-1 truncate text-muted">Sin categoría</span>
          </>
        )}
        <ChevronDown className={cn('size-3.5 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-lg border border-border bg-elevated shadow-2xl">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 text-muted" />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar o crear categoría..."
              className="min-w-0 flex-1 bg-transparent text-base text-foreground placeholder:text-muted focus:outline-none lg:text-[13px]"
            />
          </div>
          {mode === 'list' ? (
            <>
              <div className="max-h-60 overflow-y-auto p-1.5" role="listbox">
                <button type="button" role="option" aria-selected={!value} onClick={() => { onChange(''); setOpen(false) }} className={item(!value)}>
                  <Hash className="size-3.5" />
                  <span className="flex-1">Sin categoría</span>
                  {!value && <Check className="size-3.5 text-primary" />}
                </button>
                {sections.map((sec) => {
                  const items = categories.filter((c) => c.sectionId === sec.id && match(c.name))
                  if (query && items.length === 0) return null
                  return (
                    <div key={sec.id} className="mt-1.5">
                      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{sec.name}</p>
                      {items.length === 0 && <p className="px-2.5 py-1 text-xs text-muted">Vacía.</p>}
                      {items.map((c) => (
                        <button key={c.id} type="button" role="option" aria-selected={value === c.id} onClick={() => { onChange(c.id); setOpen(false) }} className={item(value === c.id)}>
                          <span className="size-2 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="flex-1 truncate">{c.name}</span>
                          {value === c.id && <Check className="size-3.5 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )
                })}
                {query && !exactExists && (
                  <button type="button" onClick={() => void beginCreate()} className="mt-1.5 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-2.5 py-2 text-left text-[13px] text-muted hover:border-primary/40 hover:text-foreground">
                    <Plus className="size-3.5" />
                    <span className="flex-1 truncate">Crear “<span className="text-foreground">{q.trim()}</span>”</span>
                  </button>
                )}
              </div>
              <div className="border-t border-border bg-surface p-1.5">
                <button type="button" onClick={() => void beginCreate()} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-muted hover:bg-elevated hover:text-foreground">
                  <Plus className="size-3.5" /> Nueva categoría…
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2 bg-surface p-3">
              <p className="text-xs font-medium text-foreground">Nueva categoría</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la categoría"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void confirm() } }}
                className="h-9 w-full rounded-md border border-border bg-elevated px-2.5 text-base text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none lg:h-8 lg:text-[13px]"
              />
              <div className="flex flex-wrap gap-1.5">
                {sections.map((s) => (
                  <button key={s.id} type="button" onClick={() => setSectionId(s.id)}
                    className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors',
                      sectionId === s.id ? 'border-primary/50 bg-primary/15 text-foreground' : 'border-border text-muted hover:text-foreground')}>
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMode('list')} className="rounded-md px-2.5 py-1.5 text-xs text-muted hover:text-foreground">Atrás</button>
                <button type="button" onClick={() => void confirm()} disabled={(name.trim() || q.trim()) === '' || !sectionId}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  Crear y usar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
