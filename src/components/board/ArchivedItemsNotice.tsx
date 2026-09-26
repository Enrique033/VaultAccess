import { useMemo } from 'react'
import { Archive, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useUIStore } from '@/store/ui.store'
import type { ArchivedItem } from '@/lib/vault-filters'

interface ArchivedItemsNoticeProps {
  /** Registros del módulo, activos y archivados (los tres tableros filtran). */
  items: ArchivedItem[]
  /** Singular y plural, para redactar el aviso: «1 nota» / «3 notas». */
  one: string
  many: string
}

/**
 * Aviso de tarjetas archivadas.
 *
 * Una tarjeta archivada sale del tablero y se queda en el panel de Archivados,
 * conservando su columna y sus imágenes. Sin este aviso el archivado sería
 * silencioso y el usuario creería que se le han perdido cosas.
 */
export function ArchivedItemsNotice({ items, one, many }: ArchivedItemsNoticeProps) {
  const openArchived = useUIStore((s) => s.setArchivedColumnsOpen)

  // Cada tablero pasa sólo sus propios registros, así que no hace falta filtrar.
  const count = useMemo(() => items.filter((item) => item.archivedAt).length, [items])

  if (count === 0) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-primary/25 bg-primary-soft/60 px-4 py-3 text-[13px] text-foreground"
    >
      <Archive className="size-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">
          {count === 1 ? `1 ${one} archivada` : `${count} ${many} archivadas`}.
        </span>{' '}
        No se ha borrado nada: están en Archivados y vuelven cuando quieras.
      </p>
      <Button
        variant="primary"
        size="sm"
        onClick={() => openArchived(true)}
        className="shrink-0"
      >
        Ver archivados <ArrowRight className="size-3.5" />
      </Button>
    </div>
  )
}