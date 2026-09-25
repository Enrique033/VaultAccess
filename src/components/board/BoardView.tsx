import {
  useCallback,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react'
import { Inbox, MoreVertical, Plus, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuItem,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'
import { UNCATEGORIZED_COLUMN, type BoardColumn } from '@/lib/vault-board'

/** Ancho de columna: fijo para que el desplazamiento horizontal sea predecible. */
const COLUMN_WIDTH = '17.5rem'
/** Altura máxima de la lista antes de empezar a desplazarse dentro de la columna. */
const COLUMN_BODY_HEIGHT = 'min(58vh, 30rem)'

interface BoardViewProps<T> {
  columns: BoardColumn<T>[]
  /** Renderiza una tarjeta dentro de una columna. */
  renderCard: (item: T, column: BoardColumn<T>) => ReactNode
  /** Abre el diálogo de creación con la categoría de la columna preseleccionada. */
  onAddCard: (categoryId: string) => void
  /**
   * Persiste el movimiento de una tarjeta a otra columna. Recibe la categoría
   * destino ya normalizada (`undefined` = sin categoría).
   */
  onMoveCard?: (item: T, toCategoryId: string | undefined) => void
  /** Texto del botón de creación (p. ej. "Añade una credencial"). */
  addLabel: string
  /** Renderiza el formulario de alta de columna dentro de la columna nueva. */
  renderAddColumn?: (close: () => void) => ReactNode
  /** Renombra la categoría de la columna. */
  onRenameColumn?: (categoryId: string, name: string) => void
  /** Elimina la categoría de la columna. */
  onDeleteColumn?: (categoryId: string) => void
  className?: string
}

/**
 * Tablero tipo Trello: columnas por categoría con desplazamiento vertical
 * independiente, botón «+» entre tarjetas que aparece al pasar el cursor y
 * arrastre de tarjetas entre columnas para reasignar su categoría.
 *
 * Usa únicamente los tokens del tema actual (surface, border, primary…).
 */
export function BoardView<T extends { id: string; categoryId?: string }>({
  columns,
  renderCard,
  onAddCard,
  onMoveCard,
  addLabel,
  renderAddColumn,
  onRenameColumn,
  onDeleteColumn,
  className,
}: BoardViewProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  /** `true` mientras se escribe el nombre de la columna nueva del final. */
  const [addingColumn, setAddingColumn] = useState(false)

  const resetDrag = useCallback(() => {
    setDraggingId(null)
    setDropTarget(null)
  }, [])

  const handleDragStart = (event: DragEvent<HTMLDivElement>, item: T) => {
    setDraggingId(item.id)
    event.dataTransfer.effectAllowed = 'move'
    // Firefox exige datos para iniciar el arrastre.
    event.dataTransfer.setData('text/plain', item.id)
  }

  const handleDrop = (
    event: DragEvent<HTMLElement>,
    column: BoardColumn<T>,
    allItems: T[],
  ) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain')
    resetDrag()
    if (!id || !onMoveCard) return
    const item = allItems.find((candidate) => candidate.id === id)
    if (!item) return
    const nextCategoryId =
      column.id === UNCATEGORIZED_COLUMN ? undefined : column.id
    // No-op si la tarjeta ya está en esa columna.
    if (item.categoryId === nextCategoryId) return
    onMoveCard(item, nextCategoryId)
  }

  const allItems = columns.flatMap((column) => column.items)
  return (
    <div
      className={cn(
        '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8',
        className,
      )}
      role="list"
      aria-label="Tablero por categorías"
    >
      {columns.map((column) => (
        <BoardColumnShell
          key={column.id}
          column={column}
          isTarget={dropTarget === column.id}
          addLabel={addLabel}
          onAddCard={onAddCard}
          onRenameColumn={onRenameColumn}
          onDeleteColumn={onDeleteColumn}
          onDragOver={(event) => {
            if (!onMoveCard) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            if (dropTarget !== column.id) setDropTarget(column.id)
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node)) return
            setDropTarget((current) => (current === column.id ? null : current))
          }}
          onDrop={(event) => handleDrop(event, column, allItems)}
        >
          {column.items.map((item) => (
            <div key={item.id} className="space-y-0.5">
              <div
                draggable={Boolean(onMoveCard)}
                onDragStart={(event) => handleDragStart(event, item)}
                onDragEnd={resetDrag}
                className={cn(
                  'rounded-xl transition-opacity',
                  draggingId === item.id && 'opacity-40',
                  onMoveCard && 'cursor-grab active:cursor-grabbing',
                )}
              >
                {renderCard(item, column)}
              </div>
              <InlineAddButton
                label={addLabel}
                onClick={() => onAddCard(column.addCategoryId)}
              />
            </div>
          ))}
        </BoardColumnShell>
      ))}

      {/*
        Columna nueva al final del tablero, como en Trello. Al pulsarla aparece
        el input en su sitio; al crear, la columna queda con su nombre editable
        desde el encabezado.
      */}
      {renderAddColumn && (
        <div className="shrink-0 snap-start" style={{ width: COLUMN_WIDTH }}>
          {addingColumn ? (
            <div className="rounded-2xl border border-primary/40 bg-elevated/40 p-2">
              {renderAddColumn(() => setAddingColumn(false))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingColumn(true)}
              className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border bg-elevated/30 px-3 py-3 text-left text-[12px] font-semibold text-muted transition-colors hover:border-primary/40 hover:bg-elevated/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Plus className="size-4 shrink-0" />
              Añade otra lista
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface BoardColumnShellProps<T> {
  column: BoardColumn<T>
  children: ReactNode
  isTarget: boolean
  addLabel: string
  onAddCard: (categoryId: string) => void
  onRenameColumn?: (categoryId: string, name: string) => void
  onDeleteColumn?: (categoryId: string) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: (event: DragEvent<HTMLElement>) => void
  onDrop: (event: DragEvent<HTMLElement>) => void
}

/** Columna con cabecera, lista con scroll propio y pie siempre visible. */
function BoardColumnShell<T>({
  column,
  children,
  isTarget,
  addLabel,
  onAddCard,
  onRenameColumn,
  onDeleteColumn,
  onDragOver,
  onDragLeave,
  onDrop,
}: BoardColumnShellProps<T>) {
  const targetId = column.addCategoryId
  /** El cajón "Sin categoría" no es una categoría real: no se renombra ni borra. */
  const isRealCategory = column.id !== UNCATEGORIZED_COLUMN
  const [renameValue, setRenameValue] = useState<string | null>(null)

  /** Renombrado en línea: el título de la columna se vuelve un input. */
  const startRename = () => {
    setRenameValue(column.name)
  }
  const commitRename = () => {
    const next = renameValue?.trim() ?? ''
    setRenameValue(null)
    if (!next || next === column.name || !onRenameColumn) return
    onRenameColumn(column.id, next)
  }

  /*
    "Sin categoría" también se renombra: el hook la convierte en columna real
    al darle nombre (crea la categoría y traslada lo que estaba suelto). Sólo
    se oculta el menú de eliminar, porque ese cajón no existe en la base.
  */
  const canEdit = Boolean(onRenameColumn)
  const canDelete = isRealCategory && Boolean(onDeleteColumn)

  return (
    <section
      role="listitem"
      aria-label={column.name}
      style={{ width: COLUMN_WIDTH }}
      className={cn(
        'group/column flex shrink-0 snap-start flex-col rounded-2xl border bg-elevated/40 transition-colors',
        isTarget ? 'border-primary/50' : 'border-border/70',
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/*
        Encabezado al estilo Trello: sólo el título (editable con un clic), el
        contador y, al pasar el cursor, los controles de la lista. En reposo
        no queda nada más visible.
      */}
      <header className="group/hdr flex items-center gap-2 px-3 py-2.5">
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: column.color ?? 'var(--c-muted)' }}
        />
        <h3 className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
          {renameValue === null ? (
            <button
              type="button"
              onClick={canEdit ? startRename : undefined}
              title={canEdit ? 'Clic para renombrar' : undefined}
              className={cn(
                'block w-full truncate text-left',
                canEdit &&
                  'rounded-md px-1 py-0.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              )}
            >
              {column.name}
            </button>
          ) : (
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                }
                if (e.key === 'Escape') setRenameValue(null)
              }}
              aria-label={`Renombrar ${column.name}`}
              className="w-full rounded-md border border-primary/40 bg-surface px-1.5 py-0.5 text-[13px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          )}
        </h3>
        <span className="shrink-0 rounded-full bg-surface/80 px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
          {column.items.length}
        </span>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/hdr:opacity-100">
          <button
            type="button"
            onClick={() => onAddCard(targetId)}
            aria-label={`${addLabel} en ${column.name}`}
            title={`${addLabel} en ${column.name}`}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Plus className="size-4" />
          </button>
          {canDelete && onDeleteColumn && (
            <DropdownMenu
              contentClassName="min-w-[13rem]"
              trigger={<MoreVertical className="size-4" />}
            >
              <DropdownMenuItem
                variant="danger"
                onClick={() => onDeleteColumn(column.id)}
              >
                <Trash2 className="size-3.5" /> Eliminar columna
              </DropdownMenuItem>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div
        className={cn(
          'flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-1',
          isTarget && 'bg-primary/5',
        )}
        style={{ maxHeight: COLUMN_BODY_HEIGHT }}
      >
        {column.items.length === 0 ? (
          <p className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-border/80 px-3 py-6 text-center text-[11px] text-muted">
            <Inbox className="size-4 opacity-60" />
            Arrastra una tarjeta aquí
          </p>
        ) : (
          children
        )}
      </div>

      <div className="p-2 pt-1">
        <button
          type="button"
          onClick={() => onAddCard(targetId)}
          className="flex w-full items-center gap-1.5 rounded-xl px-2.5 py-2 text-left text-[12px] font-semibold text-muted transition-colors hover:bg-surface/80 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Plus className="size-4 shrink-0" />
          <span className="truncate">{addLabel}</span>
        </button>
      </div>
    </section>
  )
}

/**
 * Botón «+» que se despliega entre dos tarjetas al pasar el cursor por la
 * columna (o al recibir el foco con teclado), imitando Trello.
 */
function InlineAddButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
      /*
        Botón «+» entre tarjetas. La franja de 4 px de este envoltorio es la zona
        sensible: el botón sólo se despliega cuando el cursor está justo en el
        hueco que separa dos tarjetas, no al pasar por cualquier punto de la
        columna (que es lo que hacía la versión anterior con `group-hover`).
      */
      <div className="py-0.5">
        <div className="grid grid-rows-[0fr] transition-[grid-template-rows] duration-150 hover:grid-rows-[1fr] focus-within:grid-rows-[1fr]">
          <button
            type="button"
            tabIndex={-1}
            onClick={onClick}
            className="flex min-h-0 w-full items-center gap-1.5 overflow-hidden rounded-lg px-1.5 text-left text-[11px] font-medium text-muted opacity-0 transition-colors hover:bg-surface/80 hover:text-primary hover:opacity-100 focus-visible:opacity-100"
          >
            <Plus className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        </div>
      </div>
  )
}
