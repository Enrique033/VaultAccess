import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

interface BoardHeaderProps {
  /** Módulo mostrado en los textos («credencial», «enlace»…). */
  itemLabel: string
  /**
   * Cuando cambia, abre el alta de lista anidada bajo esa categoría.
   * `null` = cerrado. `''` = abierto como categoría raíz.
   */
  presetParentId?: string | null
  className?: string
}

/**
 * Encabezado del tablero: sólo el alta de columnas, a la Trello.
 *
 * A diferencia de la versión anterior, NO hay pestañas de sección: el tablero
 * muestra todas las listas seguidas con desplazamiento horizontal y la
 * jerarquía se marca con la columna «Anidada en». Una lista nueva nace en la
 * primera sección.
 */
export function BoardHeader({
  itemLabel,
  presetParentId = null,
  className,
}: BoardHeaderProps) {
  const sections = useVaultStore((s) => s.sections)
  const categories = useVaultStore((s) => s.categories)
  const addSection = useVaultStore((s) => s.addSection)
  const addCategory = useVaultStore((s) => s.addCategory)

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')

  /** Sección destino: la primera disponible, o «General» si no hay ninguna. */
  const effectiveSectionId = sections[0]?.id ?? ''

  const parentOptions = useMemo(
    () =>
      categories
        .filter((c) => c.sectionId === effectiveSectionId)
        .sort(
          (a, b) =>
            a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
        ),
    [categories, effectiveSectionId],
  )

  /** Abre el alta de lista; `presetParentId` la anida bajo esa categoría. */
  const openAdd = (preset = '') => {
    setName('')
    setParentId(preset)
    setAdding(true)
  }

  // Una columna pidió el alta (subcategoría o lista nueva): se abre el form.
  useEffect(() => {
    if (presetParentId === null) return
    openAdd(presetParentId)
  }, [presetParentId])

  const submitAdd = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    let sectionId = effectiveSectionId
    if (!sectionId) {
      const created = await addSection('General').catch(() => null)
      if (!created) {
        toast.error('No se pudo crear la sección')
        return
      }
      sectionId = created.id
    }
    try {
      await addCategory({
        name: trimmed,
        sectionId,
        parentId: parentId || undefined,
      })
      toast.success(parentId ? 'Subcategoría creada' : 'Categoría creada')
      setAdding(false)
      setName('')
      setParentId('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear')
    }
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <AddListForm
        open={adding}
        name={name}
        parentId={parentId}
        itemLabel={itemLabel}
        parents={parentOptions.map((c) => ({ id: c.id, name: c.name }))}
        onNameChange={setName}
        onParentChange={setParentId}
        onClose={() => setAdding(false)}
        onSubmit={() => void submitAdd()}
      />
    </div>
  )
}

function AddListForm({
  open,
  name,
  parentId,
  parents,
  itemLabel,
  onNameChange,
  onParentChange,
  onClose,
  onSubmit,
}: {
  open: boolean
  name: string
  parentId: string
  parents: { id: string; name: string }[]
  itemLabel: string
  onNameChange: (value: string) => void
  onParentChange: (value: string) => void
  onClose: () => void
  onSubmit: () => void
}) {
  /*
    El formulario de alta de lista ya no tiene botón permanente: se abre desde
    «+» de una columna (subcategoría) o desde «Añade otra lista» al final del
    tablero. Por eso, en reposo este componente no renderiza nada.
  */
  if (!open) return null

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-primary/25 bg-primary-soft/30 p-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <label
          htmlFor="board-list-name"
          className="text-xs font-semibold text-foreground"
        >
          Nombre de la lista
        </label>
        <input
          id="board-list-name"
          autoFocus
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit()
            if (e.key === 'Escape') onClose()
          }}
          placeholder={`Ej. Servidores, ${itemLabel}s…`}
          className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="space-y-1.5 sm:w-48">
        <label
          htmlFor="board-list-parent"
          className="text-xs font-semibold text-foreground"
        >
          Anidada en
        </label>
        <select
          id="board-list-parent"
          value={parentId}
          onChange={(e) => onParentChange(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-surface px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">— Sin padre (raíz) —</option>
          {parents.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <Button variant="primary" size="sm" onClick={onSubmit}>
          Crear
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
