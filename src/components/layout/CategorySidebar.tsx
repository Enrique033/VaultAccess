import { useState } from 'react'
import { FolderOpen, LayoutGrid, Pencil, Plus, Star, Tag, Trash2 } from 'lucide-react'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

export function CategorySidebar() {
  const sections = useVaultStore((s) => s.sections)
  const categories = useVaultStore((s) => s.categories)
  const credentials = useVaultStore((s) => s.credentials)
  const addSection = useVaultStore((s) => s.addSection)
  const renameSection = useVaultStore((s) => s.renameSection)
  const deleteSection = useVaultStore((s) => s.deleteSection)
  const addCategory = useVaultStore((s) => s.addCategory)
  const renameCategory = useVaultStore((s) => s.renameCategory)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)

  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const setSectionId = useSearchStore((s) => s.setSectionId)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)

  const [newSection, setNewSection] = useState('')
  const [addingCatFor, setAddingCatFor] = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [confirm, setConfirm] = useState<{ kind: 'section' | 'category'; id: string; label: string } | null>(null)

  const countFor = (catId: string) => credentials.filter((c) => c.categoryId === catId).length
  const uncategorized = credentials.filter((c) => !c.categoryId).length
  const favorites = credentials.filter((c) => c.favorite).length

  const submitSection = async () => {
    const name = newSection.trim()
    if (!name) return
    try {
      await addSection(name)
      setNewSection('')
      toast.success('Sección creada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear')
    }
  }

  const submitCategory = async (secId: string) => {
    const name = newCat.trim()
    if (!name) return
    try {
      await addCategory({ name, sectionId: secId })
      setNewCat('')
      setAddingCatFor(null)
      toast.success('Categoría creada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear')
    }
  }

  const allActive = sectionId === null && categoryFilter === null

  const row = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] font-medium transition-colors',
      active ? 'bg-elevated text-foreground' : 'text-muted hover:bg-elevated hover:text-foreground',
    )
  const iconBtn =
    'rounded p-1 text-muted transition-colors hover:bg-elevated hover:text-foreground'

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => { setSectionId(null); setCategoryFilter(null) }} className={row(allActive)}>
        <LayoutGrid className="size-4 shrink-0" />
        <span className="flex-1">Todas</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{credentials.length}</span>
      </button>
      <button type="button" onClick={() => { setSectionId(null); setCategoryFilter('favorites') }} className={row(categoryFilter === 'favorites')}>
        <Star className="size-4 shrink-0" />
        <span className="flex-1">Favoritas</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{favorites}</span>
      </button>
      <button type="button" onClick={() => { setSectionId(null); setCategoryFilter('none') }} className={row(categoryFilter === 'none')}>
        <FolderOpen className="size-4 shrink-0" />
        <span className="flex-1">Sin categoría</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{uncategorized}</span>
      </button>
      {sections.map((sec) => {
        const cats = categories.filter((c) => c.sectionId === sec.id)
        const secActive = sectionId === sec.id && categoryFilter === null
        const isEditing = editingSection === sec.id
        return (
          <section key={sec.id} className="space-y-1">
            <div className="group flex items-center gap-1">
              {isEditing ? (
                <input
                  value={editingSectionName}
                  onChange={(e) => setEditingSectionName(e.target.value)}
                  autoFocus
                  onBlur={() => setEditingSection(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void (async () => {
                        try {
                          await renameSection(sec.id, editingSectionName)
                          setEditingSection(null)
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'No se pudo renombrar')
                        }
                      })()
                    }
                    if (e.key === 'Escape') setEditingSection(null)
                  }}
                  className="h-7 flex-1 rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { setSectionId(secActive ? null : sec.id); setCategoryFilter(null) }}
                  className={cn('flex min-w-0 flex-1 items-center rounded-md px-2.5 py-1.5 text-left transition-colors', secActive ? 'bg-elevated' : 'hover:bg-elevated')}
                  title="Filtrar por sección"
                >
                  <span className={cn('truncate text-[11px] font-semibold uppercase tracking-wider', secActive ? 'text-foreground' : 'text-muted')}>{sec.name}</span>
                </button>
              )}
              <span className="hidden items-center gap-0.5 group-hover:flex">
                <button type="button" title="Renombrar sección" onClick={() => { setEditingSection(sec.id); setEditingSectionName(sec.name) }} className={iconBtn}>
                  <Pencil className="size-3" />
                </button>
                <button type="button" title="Eliminar sección" onClick={() => setConfirm({ kind: 'section', id: sec.id, label: sec.name })} className={cn(iconBtn, 'hover:text-red-400')}>
                  <Trash2 className="size-3" />
                </button>
              </span>
            </div>
            {cats.map((cat) => (
              <CategoryRow
                key={cat.id}
                name={cat.name}
                color={cat.color}
                count={countFor(cat.id)}
                active={categoryFilter === cat.id}
                editing={editingCat === cat.id}
                editValue={editingCatName}
                onEditChange={setEditingCatName}
                onSelect={() => {
                  if (categoryFilter === cat.id) setCategoryFilter(null)
                  else { setSectionId(null); setCategoryFilter(cat.id) }
                }}
                onStartEdit={() => { setEditingCat(cat.id); setEditingCatName(cat.name) }}
                onCommitEdit={() => {
                  void (async () => {
                    try {
                      await renameCategory(cat.id, editingCatName)
                      setEditingCat(null)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'No se pudo renombrar')
                    }
                  })()
                }}
                onCancelEdit={() => setEditingCat(null)}
                onDelete={() => setConfirm({ kind: 'category', id: cat.id, label: cat.name })}
                iconBtn={iconBtn}
              />
            ))}
            {addingCatFor === sec.id ? (
              <div className="flex items-center gap-1.5 pl-2.5">
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="Nombre…"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submitCategory(sec.id)
                    if (e.key === 'Escape') { setAddingCatFor(null); setNewCat('') }
                  }}
                  className="h-7 flex-1 rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground placeholder:text-muted focus:outline-none"
                />
                <button type="button" onClick={() => void submitCategory(sec.id)} disabled={!newCat.trim()}
                  className="rounded bg-primary px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
                  Añadir
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAddingCatFor(sec.id); setNewCat('') }}
                className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground"
              >
                <Plus className="size-3" /> Nueva categoría
              </button>
            )}
          </section>
        )
      })}
      <div>
        <input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submitSection()}
          placeholder="Nueva sección… (ej. Redes)"
          className="h-8 w-full rounded-md border border-dashed border-border bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none"
        />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => { if (!o) setConfirm(null) }}
        title={confirm?.kind === 'section' ? 'Eliminar sección' : 'Eliminar categoría'}
        description={confirm ? `¿Eliminar “${confirm.label}”? Las credenciales no se borran.` : undefined}
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (!confirm) return
          const target = confirm
          void (async () => {
            try {
              if (target.kind === 'section') {
                await deleteSection(target.id)
                if (sectionId === target.id) setSectionId(null)
                toast.success('Sección eliminada')
              } else {
                await deleteCategory(target.id)
                if (categoryFilter === target.id) setCategoryFilter(null)
                toast.success('Categoría eliminada')
              }
              setConfirm(null)
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'No se pudo eliminar')
            }
          })()
        }}
      />
    </div>
  )
}

function CategoryRow(props: {
  name: string
  color: string
  count: number
  active: boolean
  editing: boolean
  editValue: string
  onEditChange: (v: string) => void
  onSelect: () => void
  onStartEdit: () => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
  iconBtn: string
}) {
  if (props.editing) {
    return (
      <input
        value={props.editValue}
        onChange={(e) => props.onEditChange(e.target.value)}
        autoFocus
        onBlur={props.onCancelEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') props.onCommitEdit()
          if (e.key === 'Escape') props.onCancelEdit()
        }}
        className="h-7 w-full rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground focus:outline-none"
      />
    )
  }
  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={props.onSelect}
        className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors',
          props.active ? 'bg-elevated text-foreground' : 'text-muted hover:bg-elevated hover:text-foreground')}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: props.color }} />
        <Tag className="size-3 shrink-0 opacity-60" />
        <span className="flex-1 truncate">{props.name}</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{props.count}</span>
      </button>
      <span className="hidden items-center gap-0.5 group-hover:flex">
        <button type="button" title="Renombrar" onClick={props.onStartEdit} className={props.iconBtn}>
          <Pencil className="size-3" />
        </button>
        <button type="button" title="Eliminar" onClick={props.onDelete} className={cn(props.iconBtn, 'hover:text-red-400')}>
          <Trash2 className="size-3" />
        </button>
      </span>
    </div>
  )
}

