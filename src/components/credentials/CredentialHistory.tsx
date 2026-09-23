import { useEffect, useState } from 'react'
import { History, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PasswordField } from '@/components/ui/PasswordField'
import { Skeleton } from '@/components/ui/Skeleton'
import { HISTORY_LIMIT, useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import type { PasswordHistoryEntry } from '@/types'

/** Referencia estable: un selector de Zustand no debe crear arrays nuevos. */
const NO_HISTORY: PasswordHistoryEntry[] = []

interface CredentialHistoryProps {
  credentialId: string
  /** Aplica una versión anterior al formulario abierto. */
  onUse: (password: string) => void
}

/** Fecha legible; "—" si el valor no es una fecha válida. */
function formatDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('es-ES')
}

/**
 * Versiones anteriores de la clave de una credencial.
 * El historial se carga bajo demanda al abrir la pestaña.
 */
export function CredentialHistory({
  credentialId,
  onUse,
}: CredentialHistoryProps) {
  const history = useVaultStore((s) =>
    s.historyCredentialId === credentialId ? s.history : NO_HISTORY,
  )
  const loading = useVaultStore((s) => s.historyLoading)
  const error = useVaultStore((s) => s.historyError)
  const loadHistory = useVaultStore((s) => s.loadCredentialHistory)
  const deleteEntry = useVaultStore((s) => s.deleteHistoryEntry)
  const clearHistory = useVaultStore((s) => s.clearCredentialHistory)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    void loadHistory(credentialId)
  }, [credentialId, loadHistory])

  const handleDelete = async (id: string) => {
    try {
      await deleteEntry(id)
      toast.success('Versión eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const handleClear = async () => {
    try {
      await clearHistory(credentialId)
      toast.success('Historial borrado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar')
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
        {error}
      </p>
    )
  }

  if (history.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <History className="mx-auto size-5 text-muted" />
        <p className="mt-2 text-sm font-medium text-foreground">
          Aún no hay versiones anteriores
        </p>
        <p className="mt-1 text-xs text-muted">
          Cada vez que cambies la clave se guardará aquí la anterior, por si el
          cambio fue un error.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {history.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2"
          >
            <span className="w-full text-[11px] text-muted sm:w-auto sm:flex-1">
              {formatDate(entry.changedAt)}
            </span>
            <PasswordField value={entry.password} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onUse(entry.password)
                toast.show(
                  'Clave aplicada al formulario',
                  'Guarda los cambios para volver a esta versión.',
                )
              }}
            >
              <Undo2 className="size-3.5" /> Usar
            </Button>
            <button
              type="button"
              title="Eliminar versión"
              onClick={() => void handleDelete(entry.id)}
              className="rounded p-1.5 text-muted transition-colors duration-150 hover:bg-elevated hover:text-red-400"
            >
              <Trash2 className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted">
          Se conservan las {HISTORY_LIMIT} últimas versiones.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
          Borrar historial
        </Button>
      </div>

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Borrar historial"
        description="Se eliminarán todas las versiones anteriores de esta clave."
        confirmLabel="Borrar"
        variant="danger"
        onConfirm={() => void handleClear()}
      />
    </div>
  )
}
