import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import {
  Building2,
  Crown,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserMinus,
  Users2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { PasswordField } from '@/components/ui/PasswordField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useVaultStore } from '@/store/vault.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { toast } from '@/store/ui.store'
import { cn } from '@/lib/utils'
import type { WorkspaceRole } from '@/types'

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Propietario',
  editor: 'Puede editar',
  viewer: 'Solo lectura',
}

const ALL_ROLES: WorkspaceRole[] = ['owner', 'editor', 'viewer']

/**
 * Espacios compartidos de trabajo: crear el espacio, invitar por email con
 * rol y gestionar las credenciales compartidas.
 */
export function Workspaces() {
  const { user } = useAuth()
  const credentials = useVaultStore((s) => s.credentials)

  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const members = useWorkspaceStore((s) => s.members)
  const items = useWorkspaceStore((s) => s.items)
  const activeId = useWorkspaceStore((s) => s.activeId)
  const status = useWorkspaceStore((s) => s.status)
  const error = useWorkspaceStore((s) => s.error)
  const setActive = useWorkspaceStore((s) => s.setActive)
  const load = useWorkspaceStore((s) => s.load)
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace)
  const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace)
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace)
  const inviteMember = useWorkspaceStore((s) => s.inviteMember)
  const setMemberRole = useWorkspaceStore((s) => s.setMemberRole)
  const removeMember = useWorkspaceStore((s) => s.removeMember)
  const updateSharedItem = useWorkspaceStore((s) => s.updateSharedItem)
  const removeSharedItem = useWorkspaceStore((s) => s.removeSharedItem)

  const [nameOpen, setNameOpen] = useState(false)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [nameValue, setNameValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [removeItemTarget, setRemoveItemTarget] = useState<string | null>(null)

  const active = workspaces.find((w) => w.id === activeId) ?? null
  const activeMembers = useMemo(
    () => members.filter((m) => m.workspaceId === activeId),
    [members, activeId],
  )
  const activeItems = useMemo(
    () => items.filter((i) => i.workspaceId === activeId),
    [items, activeId],
  )
  const isOwner = Boolean(active && user && active.ownerId === user.id)

  const countMembers = (id: string) =>
    members.filter((m) => m.workspaceId === id).length
  const countItems = (id: string) => items.filter((i) => i.workspaceId === id).length

  /** Ejecuta una acción del store con toast de error unificado. */
  const run = async (action: () => Promise<void>, ok?: string) => {
    try {
      await action()
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar')
    }
  }

  const openCreate = () => {
    setRenameId(null)
    setNameValue('')
    setNameOpen(true)
  }

  const openRename = (id: string, name: string) => {
    setRenameId(id)
    setNameValue(name)
    setNameOpen(true)
  }

  const submitName = async (e: FormEvent) => {
    e.preventDefault()
    const name = nameValue.trim()
    if (!name) return
    setBusy(true)
    try {
      if (renameId) await renameWorkspace(renameId, name)
      else await createWorkspace(name)
      setNameOpen(false)
      toast.success(renameId ? 'Espacio renombrado' : 'Espacio creado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const submitInvite = async (e: FormEvent) => {
    e.preventDefault()
    if (!active || !inviteEmail.trim()) return
    setBusy(true)
    try {
      await inviteMember(active.id, inviteEmail, inviteRole)
      setInviteEmail('')
      toast.success(
        'Invitación registrada',
        'La persona verá el espacio al iniciar sesión con ese correo.',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo invitar')
    } finally {
      setBusy(false)
    }
  }

  const pageHeader = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground sm:text-xl">
          Equipos
        </h1>
        <p className="mt-1 text-sm text-muted">
          {workspaces.length === 0
            ? 'Comparte credenciales concretas con tu equipo sin exponer el resto de tu espacio personal.'
            : `${workspaces.length} espacio${workspaces.length === 1 ? '' : 's'} · ${items.length} credencial${items.length === 1 ? '' : 'es'} compartida${items.length === 1 ? '' : 's'}.`}
        </p>
      </div>
      <Button variant="primary" onClick={openCreate}>
        <Plus className="size-3.5" /> Nuevo espacio
      </Button>
    </div>
  )

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-5">
        {pageHeader}
        <EmptyState
          icon={Users2}
          title="Los equipos necesitan Supabase"
          description="Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para crear espacios compartidos."
        />
      </div>
    )
  }

  const membersPanel = active && (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Miembros</h2>
        {isOwner && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              title="Renombrar espacio"
              onClick={() => openRename(active.id, active.name)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Eliminar espacio"
              className="hover:text-red-400"
              onClick={() => setDeleteTarget(active.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {activeMembers.map((member) => {
          const isMe = member.userId === user?.id
          return (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                {member.email}
                {isMe && (
                  <span className="ml-2 text-[11px] text-primary">Tú</span>
                )}
                {!member.userId && (
                  <span className="ml-2 text-[11px] text-amber-400">
                    Invitación pendiente
                  </span>
                )}
              </span>

              {isOwner && !isMe ? (
                <Select
                  value={member.role}
                  aria-label={`Rol de ${member.email}`}
                  className="h-8 w-36 text-xs"
                  onChange={(e) =>
                    void run(
                      () =>
                        setMemberRole(
                          member.id,
                          e.target.value as WorkspaceRole,
                        ),
                      'Rol actualizado',
                    )
                  }
                >
                  {ALL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="rounded-md border border-border bg-elevated px-2 py-1 text-[11px] text-muted">
                  {ROLE_LABELS[member.role]}
                </span>
              )}

              {isOwner && !isMe && (
                <button
                  type="button"
                  title="Quitar del espacio"
                  onClick={() =>
                    void run(
                      () => removeMember(member.id),
                      'Miembro eliminado',
                    )
                  }
                  className="rounded p-1.5 text-muted transition-colors duration-150 hover:bg-elevated hover:text-red-400"
                >
                  <UserMinus className="size-3.5" />
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {isOwner ? (
        <form
          onSubmit={submitInvite}
          className="mt-4 flex flex-wrap items-end gap-2"
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Invitar por email</Label>
            <Input
              id="invite-email"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="compa@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">Rol</Label>
            <Select
              id="invite-role"
              value={inviteRole}
              className="w-36"
              onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="primary" disabled={busy}>
            <Plus className="size-3.5" /> Invitar
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-[11px] text-muted">
          Solo el propietario puede invitar o cambiar roles.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        “Puede editar” añade y actualiza credenciales del espacio; “Solo
        lectura” las consulta sin modificarlas.
      </p>
    </Card>
  )

  const sharedPanel = active && (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-foreground">
        Credenciales compartidas
      </h2>

      {activeItems.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <Building2 className="mx-auto size-5 text-muted" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Nada compartido todavía
          </p>
          <p className="mt-1 text-xs text-muted">
            Desde Access, abre el menú de una credencial y elige “Compartir en
            equipo”.
          </p>
          <Link
            to="/credentials"
            className="mt-3 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Ir a Access
          </Link>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {activeItems.map((item) => {
            const source = item.credentialId
              ? credentials.find((c) => c.id === item.credentialId)
              : undefined
            const creator = activeMembers.find((m) => m.userId === item.createdBy)
            return (
              <li
                key={item.id}
                className="rounded-md border border-border bg-background p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="truncate text-[11px] text-muted">
                    {item.username}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PasswordField value={item.password} />
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      <Link2 className="size-3" /> Abrir login
                    </a>
                  )}
                  {source && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        void run(
                          () => updateSharedItem(item.id, source),
                          'Copia actualizada',
                        )
                      }
                    >
                      <RefreshCw className="size-3.5" /> Actualizar
                    </Button>
                  )}
                  <button
                    type="button"
                    title="Quitar del espacio"
                    onClick={() => setRemoveItemTarget(item.id)}
                    className="rounded p-1.5 text-muted transition-colors duration-150 hover:bg-elevated hover:text-red-400"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <p className="mt-2 text-[10px] text-muted">
                  Compartida por {creator?.email ?? 'un miembro'} ·{' '}
                  {new Date(item.updatedAt).toLocaleString('es-ES')}
                </p>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Actualizar vuelve a subir los datos de tu credencial al espacio (útil
        tras cambiar la clave).
      </p>
    </Card>
  )

  const nameDialog = (
    <Dialog open={nameOpen} onOpenChange={setNameOpen} className="max-w-md">
      <form onSubmit={submitName}>
        <DialogHeader>
          <div>
            <DialogTitle>
              {renameId ? 'Renombrar espacio' : 'Nuevo espacio'}
            </DialogTitle>
            <DialogDescription>
              {renameId
                ? 'Cambia el nombre que verán los miembros.'
                : 'Un espacio agrupa credenciales que compartes con tu equipo.'}
            </DialogDescription>
          </div>
          <DialogCloseButton onClick={() => setNameOpen(false)} />
        </DialogHeader>
        <DialogContent className="space-y-1.5">
          <Label htmlFor="workspace-name">Nombre</Label>
          <Input
            id="workspace-name"
            autoFocus
            required
            maxLength={60}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="Equipo de producto"
          />
        </DialogContent>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setNameOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {renameId ? 'Guardar' : 'Crear espacio'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )

  const confirmDialogs = (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Eliminar espacio"
        description="Se borrarán las credenciales compartidas en este espacio. Tu espacio personal no se toca."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          const id = deleteTarget
          setDeleteTarget(null)
          if (id) void run(() => deleteWorkspace(id), 'Espacio eliminado')
        }}
      />

      <ConfirmDialog
        open={removeItemTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveItemTarget(null)
        }}
        title="Quitar del espacio"
        description="Los miembros dejarán de ver esta credencial. Tu copia personal sigue igual."
        confirmLabel="Quitar"
        variant="danger"
        onConfirm={() => {
          const id = removeItemTarget
          setRemoveItemTarget(null)
          if (id) void run(() => removeSharedItem(id), 'Credencial retirada')
        }}
      />
    </>
  )

  return (
    <div className="space-y-5">
      {pageHeader}

      {status === 'loading' && workspaces.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : status === 'error' && workspaces.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No se pudieron cargar los espacios"
          description={error ?? undefined}
          action={
            <Button variant="primary" onClick={() => void load()}>
              Reintentar
            </Button>
          }
        />
      ) : workspaces.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="Crea tu primer espacio de equipo"
          description="Invita por email y comparte solo las credenciales que decidas. Puedes actualizar o retirar el acceso cuando quieras."
          action={
            <Button variant="primary" onClick={openCreate}>
              <Plus className="size-3.5" /> Nuevo espacio
            </Button>
          }
        />
      ) : (
        <>
          {/* Selector de espacios */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workspaces.map((workspace) => {
              const selected = workspace.id === activeId
              const ownsIt = workspace.ownerId === user?.id
              const memberTotal = countMembers(workspace.id)
              const itemTotal = countItems(workspace.id)
              return (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => setActive(workspace.id)}
                  className={cn(
                    'flex flex-col gap-2 rounded-lg border bg-surface p-4 text-left transition-colors duration-150',
                    selected
                      ? 'border-primary/50 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="flex w-full items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                      <Users2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {workspace.name}
                    </span>
                    {ownsIt && (
                      <span title="Eres propietario" className="text-amber-400">
                        <Crown className="size-3.5" />
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted">
                    {memberTotal} miembro{memberTotal === 1 ? '' : 's'} ·{' '}
                    {itemTotal} credencial{itemTotal === 1 ? '' : 'es'}
                  </span>
                </button>
              )
            })}
          </div>

          {active && (
            <div className="grid gap-3 lg:grid-cols-2">
              {membersPanel}
              {sharedPanel}
            </div>
          )}
        </>
      )}

      {nameDialog}
      {confirmDialogs}
    </div>
  )
}
