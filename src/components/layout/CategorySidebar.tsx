import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  LayoutGrid,
  Move,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FAVORITES,
  NONE,
  countByCategory,
  countFavorites,
  countUncategorized,
  isOrphanedCategoryItem,
  type CategorizedItem,
} from '@/lib/vault-filters'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/ui.store'
import type { Category } from '@/types'

function toggleSet(
  value: string,
  setter: Dispatch<SetStateAction<Set<string>>>,
) {
  setter((current) => {
    const next = new Set(current)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return next
  })
}

function childrenOf(categories: Category[], parentId?: string) {
  return categories
    .filter((category) => (category.parentId ?? undefined) === parentId)
    .sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
    )
}

function isDescendant(
  categories: Category[],
  categoryId: string,
  possibleAncestor: string,
) {
  let current = categories.find((category) => category.id === possibleAncestor)
  const seen = new Set<string>()
  while (current?.parentId && !seen.has(current.id)) {
    if (current.parentId === categoryId) return true
    seen.add(current.id)
    current = categories.find((category) => category.id === current?.parentId)
  }
  return false
}

export function CategorySidebar() {
  const sections = useVaultStore((s) => s.sections)
  const categories = useVaultStore((s) => s.categories)
  const credentials = useVaultStore((s) => s.credentials)
  const links = useVaultStore((s) => s.links)
  const notes = useVaultStore((s) => s.notes)
  const vaultItems: CategorizedItem[] = [...credentials, ...links, ...notes]
  const orphanedCount = vaultItems.filter((item) =>
    isOrphanedCategoryItem(item, categories),
  ).length
  const addSection = useVaultStore((s) => s.addSection)
  const renameSection = useVaultStore((s) => s.renameSection)
  const deleteSection = useVaultStore((s) => s.deleteSection)
  const addCategory = useVaultStore((s) => s.addCategory)
  const renameCategory = useVaultStore((s) => s.renameCategory)
  const moveCategory = useVaultStore((s) => s.moveCategory)
  const reorderCategory = useVaultStore((s) => s.reorderCategory)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)

  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const setSectionId = useSearchStore((s) => s.setSectionId)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)

  const [newSection, setNewSection] = useState('')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [addingCatFor, setAddingCatFor] = useState<string | null>(null)
  const [newCat, setNewCat] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  )
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  )
  const [addingSubcatFor, setAddingSubcatFor] = useState<string | null>(null)
  const [newSubcat, setNewSubcat] = useState('')
  const [editingCat, setEditingCat] = useState<string | null>(null)
  const [editingCatName, setEditingCatName] = useState('')
  const [movingCat, setMovingCat] = useState<string | null>(null)
  const [moveSectionId, setMoveSectionId] = useState('')
  const [moveParentId, setMoveParentId] = useState('')
  const [confirm, setConfirm] = useState<{
    kind: 'section' | 'category'
    id: string
    label: string
  } | null>(null)

  const countFor = (id: string) => countByCategory(vaultItems, id)
  const uncategorized = countUncategorized(vaultItems)
  const favorites = countFavorites(vaultItems)
  const allActive = sectionId === null && categoryFilter === null
  const row = (active: boolean) =>
    cn(
      'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
      active
        ? 'bg-primary-soft text-primary'
        : 'text-muted hover:bg-elevated hover:text-foreground',
    )
  const iconBtn =
    'rounded-lg p-1 text-muted transition-colors hover:bg-elevated hover:text-foreground'

  const submitSection = async () => {
    const name = newSection.trim()
    if (!name) return
    try {
      await addSection(name)
      setNewSection('')
      toast.success('Sección creada')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo crear')
    }
  }

  const commitSectionRename = async (id: string) => {
    try {
      await renameSection(id, editingSectionName)
      setEditingSection(null)
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'No se pudo renombrar',
      )
    }
  }

  const submitCategory = async (section: string, parentId?: string) => {
    const name = (parentId ? newSubcat : newCat).trim()
    if (!name) return
    try {
      await addCategory({ name, sectionId: section, parentId })
      setNewCat('')
      setNewSubcat('')
      setAddingCatFor(null)
      setAddingSubcatFor(null)
      if (parentId)
        setCollapsedCategories((current) => {
          const next = new Set(current)
          next.delete(parentId)
          return next
        })
      toast.success(parentId ? 'Subcategoría creada' : 'Categoría creada')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo crear')
    }
  }

  const commitRename = async (id: string) => {
    try {
      await renameCategory(id, editingCatName)
      setEditingCat(null)
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : 'No se pudo renombrar',
      )
    }
  }

  const openMove = (category: Category) => {
    setMovingCat(category.id)
    setMoveSectionId(category.sectionId)
    setMoveParentId(category.parentId ?? '')
  }

  const commitMove = async (category: Category) => {
    try {
      await moveCategory(category.id, moveSectionId, moveParentId || null)
      setMovingCat(null)
      toast.success('Categoría movida')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo mover')
    }
  }

  const changeOrder = async (id: string, direction: 'up' | 'down') => {
    try {
      await reorderCategory(id, direction)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'No se pudo ordenar')
    }
  }

  const renderCategory = (
    category: Category,
    depth = 0,
    ancestors = new Set<string>(),
  ): React.ReactNode => {
    if (ancestors.has(category.id)) return null
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(category.id)
    const children = childrenOf(
      categories.filter((item) => item.sectionId === category.sectionId),
      category.id,
    )
    const hasChildren = children.length > 0
    const collapsed = collapsedCategories.has(category.id)
    const active = categoryFilter === category.id
    const siblings = childrenOf(
      categories.filter((item) => item.sectionId === category.sectionId),
      category.parentId,
    )
    const siblingIndex = siblings.findIndex((item) => item.id === category.id)
    const editing = editingCat === category.id
    return (
      <div key={category.id} className="space-y-0.5">
        <div
          className="group flex items-center gap-0.5"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleSet(category.id, setCollapsedCategories)}
              className="rounded p-1 text-muted hover:bg-elevated hover:text-foreground"
              aria-label={
                collapsed ? 'Desplegar subcategorías' : 'Plegar subcategorías'
              }
            >
              {collapsed ? (
                <ChevronRight className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          {editing ? (
            <input
              value={editingCatName}
              onChange={(event) => setEditingCatName(event.target.value)}
              autoFocus
              onBlur={() => setEditingCat(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void commitRename(category.id)
                if (event.key === 'Escape') setEditingCat(null)
              }}
              className="h-7 min-w-0 flex-1 rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setSectionId(null)
                setCategoryFilter(active ? null : category.id)
              }}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                active
                  ? 'bg-elevated text-foreground'
                  : 'text-muted hover:bg-elevated hover:text-foreground',
              )}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <Tag className="size-3 shrink-0 opacity-60" />
              <span className="min-w-0 flex-1 truncate">{category.name}</span>
              <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">
                {countFor(category.id)}
              </span>
            </button>
          )}
          {!editing && (
            <span className="hidden items-center gap-0.5 group-hover:flex">
              <button
                type="button"
                title="Subir"
                disabled={siblingIndex <= 0}
                onClick={() => void changeOrder(category.id, 'up')}
                className={cn(iconBtn, 'disabled:opacity-30')}
              >
                <ArrowUp className="size-3" />
              </button>
              <button
                type="button"
                title="Bajar"
                disabled={
                  siblingIndex < 0 || siblingIndex >= siblings.length - 1
                }
                onClick={() => void changeOrder(category.id, 'down')}
                className={cn(iconBtn, 'disabled:opacity-30')}
              >
                <ArrowDown className="size-3" />
              </button>
              <button
                type="button"
                title="Renombrar"
                onClick={() => {
                  setEditingCat(category.id)
                  setEditingCatName(category.name)
                }}
                className={iconBtn}
              >
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                title="Añadir subcategoría"
                onClick={() => {
                  setAddingSubcatFor(category.id)
                  setNewSubcat('')
                  setCollapsedCategories((current) => {
                    const next = new Set(current)
                    next.delete(category.id)
                    return next
                  })
                }}
                className={iconBtn}
              >
                <Plus className="size-3" />
              </button>
              <button
                type="button"
                title="Mover"
                onClick={() => openMove(category)}
                className={iconBtn}
              >
                <Move className="size-3" />
              </button>
              <button
                type="button"
                title="Eliminar"
                onClick={() =>
                  setConfirm({
                    kind: 'category',
                    id: category.id,
                    label: category.name,
                  })
                }
                className={cn(iconBtn, 'hover:bg-danger/10 hover:text-danger')}
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          )}
        </div>
        {addingSubcatFor === category.id && (
          <div
            className="flex items-center gap-1.5"
            style={{ paddingLeft: `${(depth + 1) * 14 + 20}px` }}
          >
            <input
              value={newSubcat}
              onChange={(event) => setNewSubcat(event.target.value)}
              autoFocus
              placeholder="Subcategoría…"
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  void submitCategory(category.sectionId, category.id)
                if (event.key === 'Escape') setAddingSubcatFor(null)
              }}
              className="h-7 min-w-0 flex-1 rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground placeholder:text-muted focus:outline-none"
            />
            <button
              type="button"
              disabled={!newSubcat.trim()}
              onClick={() =>
                void submitCategory(category.sectionId, category.id)
              }
              className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
        )}
        {movingCat === category.id && (
          <div
            className="space-y-1.5 rounded-lg border border-primary/25 bg-primary-soft/40 p-2"
            style={{ marginLeft: `${(depth + 1) * 14 + 20}px` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Mover categoría
            </p>
            <select
              value={moveSectionId}
              onChange={(event) => {
                setMoveSectionId(event.target.value)
                setMoveParentId('')
              }}
              className="h-7 w-full rounded border border-border bg-surface px-2 text-xs text-foreground"
            >
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
            <select
              value={moveParentId}
              onChange={(event) => setMoveParentId(event.target.value)}
              className="h-7 w-full rounded border border-border bg-surface px-2 text-xs text-foreground"
            >
              <option value="">Sin categoría padre</option>
              {categories
                .filter(
                  (candidate) =>
                    candidate.sectionId === moveSectionId &&
                    candidate.id !== category.id &&
                    !isDescendant(categories, category.id, candidate.id),
                )
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setMovingCat(null)}
                className="rounded px-2 py-1 text-[11px] text-muted hover:bg-elevated"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void commitMove(category)}
                className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
        {!collapsed &&
          children.map((child) =>
            renderCategory(child, depth + 1, nextAncestors),
          )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <span className="eyebrow">Categorías</span>
      {orphanedCount > 0 && (
        <p className="rounded-xl border border-warning/25 bg-warning/10 px-2.5 py-2 text-[10px] leading-relaxed text-warning">
          Hay {orphanedCount} elementos con una categoría que ya no existe.
          Actualiza esos elementos para asignarles una categoría válida.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setSectionId(null)
          setCategoryFilter(null)
        }}
        className={row(allActive)}
      >
        <LayoutGrid className="size-4 shrink-0" />
        <span className="flex-1">Todas</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">
          {vaultItems.length}
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          setSectionId(null)
          setCategoryFilter(categoryFilter === FAVORITES ? null : FAVORITES)
        }}
        className={row(categoryFilter === FAVORITES)}
      >
        <Star className="size-4 shrink-0" />
        <span className="flex-1">Favoritas</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">
          {favorites}
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          setSectionId(null)
          setCategoryFilter(categoryFilter === NONE ? null : NONE)
        }}
        className={row(categoryFilter === NONE)}
      >
        <FolderOpen className="size-4 shrink-0" />
        <span className="flex-1">Sin categoría</span>
        <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">
          {uncategorized}
        </span>
      </button>
      {sections.map((section) => {
        const roots = childrenOf(
          categories.filter((category) => category.sectionId === section.id),
        )
        const sectionCollapsed = collapsedSections.has(section.id)
        return (
          <section key={section.id} className="space-y-1">
            <div className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleSet(section.id, setCollapsedSections)}
                className="rounded p-1 text-muted hover:bg-elevated hover:text-foreground"
                aria-label={
                  sectionCollapsed ? 'Desplegar sección' : 'Plegar sección'
                }
              >
                {sectionCollapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
              {editingSection === section.id ? (
                <input
                  value={editingSectionName}
                  onChange={(event) =>
                    setEditingSectionName(event.target.value)
                  }
                  autoFocus
                  onBlur={() => setEditingSection(null)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter')
                      void commitSectionRename(section.id)
                    if (event.key === 'Escape') setEditingSection(null)
                  }}
                  className="h-7 min-w-0 flex-1 rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSectionId(sectionId === section.id ? null : section.id)
                    setCategoryFilter(null)
                  }}
                  className={cn(
                    'flex min-w-0 flex-1 items-center rounded-md px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider transition-colors',
                    sectionId === section.id && categoryFilter === null
                      ? 'bg-elevated text-foreground'
                      : 'text-muted hover:bg-elevated hover:text-foreground',
                  )}
                >
                  {section.name}
                </button>
              )}
              <span className="hidden items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  title="Renombrar sección"
                  onClick={() => {
                    setEditingSection(section.id)
                    setEditingSectionName(section.name)
                  }}
                  className={iconBtn}
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  title="Eliminar sección"
                  onClick={() =>
                    setConfirm({
                      kind: 'section',
                      id: section.id,
                      label: section.name,
                    })
                  }
                  className={cn(
                    iconBtn,
                    'hover:bg-danger/10 hover:text-danger',
                  )}
                >
                  <Trash2 className="size-3" />
                </button>
              </span>
            </div>
            {!sectionCollapsed && (
              <>
                {roots.map((category) => renderCategory(category))}
                {addingCatFor === section.id ? (
                  <div className="flex items-center gap-1.5 pl-7">
                    <input
                      value={newCat}
                      onChange={(event) => setNewCat(event.target.value)}
                      autoFocus
                      placeholder="Nombre…"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter')
                          void submitCategory(section.id)
                        if (event.key === 'Escape') setAddingCatFor(null)
                      }}
                      className="h-7 min-w-0 flex-1 rounded border border-primary/50 bg-elevated px-2 text-xs text-foreground placeholder:text-muted focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={!newCat.trim()}
                      onClick={() => void submitCategory(section.id)}
                      className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50"
                    >
                      Añadir
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCatFor(section.id)
                      setNewCat('')
                    }}
                    className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 pl-7 text-left text-xs text-muted hover:bg-elevated hover:text-foreground"
                  >
                    <Plus className="size-3" /> Nueva categoría
                  </button>
                )}
              </>
            )}
          </section>
        )
      })}
      <input
        value={newSection}
        onChange={(event) => setNewSection(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && void submitSection()}
        placeholder="Nueva sección… (ej. Redes)"
        className="h-8 w-full rounded-md border border-dashed border-border bg-transparent px-2.5 text-xs text-foreground placeholder:text-muted focus:border-primary/50 focus:outline-none"
      />
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === 'section'
            ? 'Eliminar sección'
            : 'Eliminar categoría'
        }
        description={
          confirm
            ? confirm.kind === 'category'
              ? `¿Eliminar “${confirm.label}”? Sus subcategorías se eliminarán y los registros quedarán sin categoría; no se borran.`
              : `¿Eliminar “${confirm.label}”? Las categorías se moverán a otra sección si existe; si no, se eliminarán y sus registros quedarán sin categoría.`
            : undefined
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (!confirm) return
          const target = confirm
          void (async () => {
            try {
              if (target.kind === 'section') {
                const selectedCategory = categories.find(
                  (category) => category.id === categoryFilter,
                )
                await deleteSection(target.id)
                if (sectionId === target.id) setSectionId(null)
                if (
                  selectedCategory?.sectionId === target.id &&
                  categoryFilter === selectedCategory.id
                )
                  setCategoryFilter(null)
                toast.success('Sección eliminada')
              } else {
                const removed = new Set([
                  target.id,
                  ...categoryDescendants(categories, target.id),
                ])
                await deleteCategory(target.id)
                if (categoryFilter && removed.has(categoryFilter))
                  setCategoryFilter(null)
                toast.success('Categoría eliminada')
              }
              setConfirm(null)
            } catch (cause) {
              toast.error(
                cause instanceof Error ? cause.message : 'No se pudo eliminar',
              )
            }
          })()
        }}
      />
    </div>
  )
}

function categoryDescendants(categories: Category[], rootId: string): string[] {
  const result: string[] = []
  const visit = (parentId: string) => {
    for (const category of categories) {
      if (category.parentId === parentId && !result.includes(category.id)) {
        result.push(category.id)
        visit(category.id)
      }
    }
  }
  visit(rootId)
  return result
}
