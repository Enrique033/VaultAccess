import { useState } from 'react'
import { Link } from 'react-router'
import { Check, RefreshCw, Share2, Users2, X } from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/app/auth-context'
import { useWorkspaceStore, type SharedSource } from '@/store/workspace.store'
import { toast } from '@/store/ui.store'
import type { SharedItemKind, WorkspaceRole } from '@/types'

interface ShareItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Módulo del registro que se comparte. */
  kind: SharedItemKind
  /** Registro ya descifrado; `null` cuando no hay nada seleccionado. */
  item: SharedSource | null
}

const KIND_LABEL: Record<SharedItemKind, string> = {
  credential: 'credencial',
  link: 'enlace',
  note: 'nota',
}

/**
 * Comparte una credencial, un enlace o una nota en uno o varios espacios de
 * trabajo. Se envía una copia del dato al espacio; el vault personal no se
 * expone. Es el mismo diálogo para los tres módulos: sólo cambia el payload.
 */
export function ShareItemDialog({
  open,
  onOpenChange,
  kind,
  item,
}: ShareItemDialogProps) {
  const { user } = useAuth()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const members = useWorkspaceStore((s) => s.members)
  const itemReferences = useWorkspaceStore((s) => s.itemReferences)
  const shareItem = useWorkspaceStore((s) => s.shareItem)
  const updateSharedItem = useWorkspaceStore((s) => s.updateSharedItem)
  const removeSharedItem = useWorkspaceStore((s) => s.removeSharedItem)
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!item) return null
  const target = item
  const label = KIND_LABEL[kind]

  /** Busca la copia ya existente de este registro en un espacio. */
  const findReference = (workspaceId: string) =>
    itemReferences.find(
      (i) =>
        i.workspaceId === workspaceId &&
        i.kind === kind &&
        i.sourceId === target.id,
    )

  const run = async (workspaceId: string, action: () => Promise<void>) => {
    setBusyId(workspaceId)
    try {
      await action()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
      <DialogHeader>
        <div>
          <DialogTitle>Compartir en equipo</DialogTitle>
          <DialogDescription>
            Se guarda una copia de “{target.title}” en el espacio elegido. Los
            miembros autorizados podrán verla; el resto de tu contenido no se
            comparte.
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <DialogContent className="space-y-2">
        {workspaces.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Users2 className="mx-auto size-5 text-muted" />
            <p className="mt-2 text-sm font-medium text-foreground">
              Todavía no tienes espacios de equipo
            </p>
            <p className="mt-1 text-xs text-muted">
              Crea uno en la sección Equipos para compartir credenciales con tu
              equipo.
            </p>
            <Link
              to="/workspaces"
              onClick={() => onOpenChange(false)}
              className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
            >
              Ir a Equipos
            </Link>
          </div>
        ) : (
          workspaces.map((workspace) => (
            <WorkspaceShareRow
              key={workspace.id}
              workspaceName={workspace.name}
              role={
                members.find(
                  (m) =>
                    m.workspaceId === workspace.id && m.userId === user?.id,
                )?.role ??
                (workspace.ownerId === user?.id ? 'owner' : undefined)
              }
              shared={Boolean(findReference(workspace.id))}
              busy={busyId === workspace.id}
              onShare={() =>
                void run(workspace.id, async () => {
                  await shareItem(workspace.id, kind, target)
                  toast.success(
                    `${label[0]?.toUpperCase()}${label.slice(1)} compartida`,
                    'Los miembros del espacio ya pueden verla.',
                  )
                })
              }
              onUpdate={() =>
                void run(workspace.id, async () => {
                  const ref = findReference(workspace.id)
                  if (!ref) return
                  await updateSharedItem(ref.id, target)
                  toast.success('Copia actualizada en el espacio')
                })
              }
              onRemove={() =>
                void run(workspace.id, async () => {
                  const ref = findReference(workspace.id)
                  if (!ref) return
                  await removeSharedItem(ref.id)
                  toast.success(`${label} retirada del espacio`)
                })
              }
            />
          ))
        )}
      </DialogContent>
    </Dialog>
  )
}

interface WorkspaceShareRowProps {
  workspaceName: string
  role?: WorkspaceRole
  shared: boolean
  busy: boolean
  onShare: () => void
  onUpdate: () => void
  onRemove: () => void
}

const ROLE_HINT: Record<WorkspaceRole, string> = {
  owner: 'Eres propietario',
  editor: 'Puedes editar',
  viewer: 'Solo lectura',
}

/** Fila de un espacio con su estado de compartición. */
function WorkspaceShareRow({
  workspaceName,
  role,
  shared,
  busy,
  onShare,
  onUpdate,
  onRemove,
}: WorkspaceShareRowProps) {
  // Un miembro de solo lectura no puede publicar ni actualizar elementos (RLS).
  const canEdit = role === 'owner' || role === 'editor'

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/70 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">
          {workspaceName}
        </p>
        <p className="text-[11px] text-muted">
          {role ? ROLE_HINT[role] : 'Eres miembro'}
        </p>
      </div>

      {!canEdit && !shared ? (
        <span className="rounded-xl border border-primary/15 bg-primary-soft px-2.5 py-1 text-[11px] text-primary">
          Sin permiso para compartir
        </span>
      ) : shared ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
            <Check className="size-3" /> Compartida
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={busy || !canEdit}
            onClick={onUpdate}
          >
            <RefreshCw className="size-3.5" /> Actualizar
          </Button>
          <button
            type="button"
            title="Dejar de compartir"
            disabled={busy || !canEdit}
            onClick={onRemove}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <X className="size-3.5" />
          </button>
        </>
      ) : (
        <Button variant="primary" size="sm" disabled={busy} onClick={onShare}>
          <Share2 className="size-3.5" /> Compartir
        </Button>
      )}
    </div>
  )
}
