import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'

interface BoardHeaderProps {
  /** Módulo mostrado en el placeholder («lista», «columna»…). */
  itemLabel?: string
  /** Quando pasa de `null` a un id, se abre el alta embebida en esa columna. */
  presetParentId: string
  /** Cierra el formulario sin crear nada. */
  onClose: () => void
  className?: string
}

/**
 * Alta de una lista del tablero.
 *
 * Ya no existe el selector «Anidada en»: la lista nueva nace siempre como
 * columna de primer nivel y su nombre se escribe aquí mismo, igual que en
 * Trello. Se muestra embebida en la propia columna cuando `presetParentId` es un
 * id (sublista solicitada desde el menú de esa columna) o como una columna
 * nueva al final cuando es `''`.
 */
export function BoardHeader({
  itemLabel = 'lista',
  presetParentId,
  onClose,
  className,
}: BoardHeaderProps) {
  const sections = useVaultStore((s) => s.sections)
  const categories = useVaultStore((s) => s.categories)
  const addSection = useVaultStore((s) => s.addSection)
  const addCategory = useVaultStore((s) => s.addCategory)

  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const parentId = presetParentId

  /** Sección destino: la primera disponible, o «General» si no hay ninguna. */
  const effectiveSectionId = sections[0]?.id ?? ''

  // El input se abre con foco para escribir el nombre de inmediato.
  useEffect(() => {
    setName('')
    inputRef.current?.focus()
  }, [presetParentId])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed || busy) return
    setBusy(true)
    try {
      let sectionId = effectiveSectionId
      if (!sectionId) {
        const created = await addSection('General').catch(() => null)
        if (!created) {
          toast.error('No se pudo crear la sección')
          return
        }
        sectionId = created.id
      }
      await addCategory({
        name: trimmed,
        sectionId,
        parentId: parentId || undefined,
      })
      toast.success(parentId ? 'Sublista creada' : 'Columna creada')
      setName('')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear')
    } finally {
      setBusy(false)
    }
  }

  const parentName = parentId
    ? categories.find((c) => c.id === parentId)?.name
    : null

  return (
    <div className={cn('space-y-1.5', className)}>
      <input
        ref={inputRef}
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit()
          if (e.key === 'Escape') onClose()
        }}
        placeholder={`Nombre de la ${itemLabel}…`}
        aria-label={`Nombre de la ${itemLabel}`}
        className="w-full rounded-lg border border-primary/40 bg-surface px-2.5 py-2 text-[13px] font-semibold text-foreground placeholder:font-normal placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <p className="truncate text-[11px] text-muted">
        {parentName ? `Dentro de ${parentName}` : 'Columna de primer nivel'}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
          className="flex flex-1 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Crear columna
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancelar"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
