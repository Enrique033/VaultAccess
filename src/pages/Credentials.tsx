import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CloudOff, KeyRound, Plus, Star, Users2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatCard } from '@/components/ui/StatCard'
import { CardGridSkeleton } from '@/components/ui/Skeleton'
import { CredentialGrid } from '@/components/credentials/CredentialGrid'
import { CredentialDialog } from '@/components/credentials/CredentialDialog'
import { CredentialSortSelect } from '@/components/credentials/CredentialSortSelect'
import { ViewToggle } from '@/components/board/ViewToggle'
import { BoardView } from '@/components/board/BoardView'
import { BoardHeader } from '@/components/board/BoardHeader'
import { CredentialBoardCard } from '@/components/board/CredentialBoardCard'
import type { CredentialFormValues } from '@/components/credentials/CredentialForm'
import type { AttachmentDraft } from '@/types'
import { evaluatePassword } from '@/lib/password-strength'
import { buildBoardColumns } from '@/lib/vault-board'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { useWorkspaceStore } from '@/store/workspace.store'
import { toast, useUIStore } from '@/store/ui.store'
import { FAVORITES, matchesCategoryFilter } from '@/lib/vault-filters'
import type { Credential } from '@/types'

export function Credentials() {
  const credentials = useVaultStore((s) => s.credentials)
  const categories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const offline = useVaultStore((s) => s.offline)
  const syncError = useVaultStore((s) => s.error)
  const retryLoad = useVaultStore((s) => s.load)
  const renameCategory = useVaultStore((s) => s.renameCategory)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)
  const addCredential = useVaultStore((s) => s.addCredential)
  const updateCredential = useVaultStore((s) => s.updateCredential)
  const deleteCredential = useVaultStore((s) => s.deleteCredential)
  const sharedItems = useWorkspaceStore((s) => s.itemReferences)

  const query = useSearchStore((s) => s.query)
  // Sólo filtra la búsqueda: el tablero muestra siempre todas las columnas.
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)
  const weakOnly = useSearchStore((s) => s.weakOnly)
  const setWeakOnly = useSearchStore((s) => s.setWeakOnly)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Credential | null>(null)
  const [deleting, setDeleting] = useState<Credential | null>(null)
  /** Categoría preseleccionada al crear desde el botón «+» de una columna. */
  const [createCategoryId, setCreateCategoryId] = useState('')
  const vaultView = useUIStore((s) => s.vaultView)

  // Abre el dialog automáticamente cuando el Header navega con ?new=1
  const newParam = searchParams.get('new')
  useEffect(() => {
    if (newParam === '1') {
      setEditing(null)
      setDialogOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('new')
      setSearchParams(next, { replace: true })
    }
  }, [newParam, searchParams, setSearchParams])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const byStrength = (credential: Credential) =>
      !weakOnly || evaluatePassword(credential.password).score <= 1
    const byQuery = (credential: Credential) => {
      if (!q) return true
      const category = categories.find((c) => c.id === credential.categoryId)
      return (
        credential.title.toLowerCase().includes(q) ||
        credential.username.toLowerCase().includes(q) ||
        credential.url?.toLowerCase().includes(q) ||
        category?.name.toLowerCase().includes(q)
      )
    }
    const list = credentials.filter(
      (credential) =>
        matchesCategoryFilter(
          credential,
          categoryFilter,
          sectionId,
          categories,
        ) &&
        byQuery(credential) &&
        byStrength(credential),
    )
    if (sort === 'az')
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'es'))
    if (sort === 'favorites') {
      return [...list].sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
    }
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [
    credentials,
    categories,
    query,
    categoryFilter,
    sectionId,
    sort,
    weakOnly,
  ])

  const handleOpenCreate = () => {
    setEditing(null)
    setCreateCategoryId('')
    setDialogOpen(true)
  }

  /** Abre el diálogo de creación con la categoría de la columna ya elegida. */
  const handleOpenCreateIn = (categoryId: string) => {
    setEditing(null)
    setCreateCategoryId(categoryId)
    setDialogOpen(true)
  }

  /** Arrastre entre columnas: sólo cambia la categoría y conserva los adjuntos. */
  const handleMoveCard = async (
    credential: Credential,
    toCategoryId: string | undefined,
  ) => {
    const target = categories.find((c) => c.id === toCategoryId)
    try {
      await updateCredential(credential.id, { categoryId: toCategoryId })
      toast.success(
        target
          ? `Movida a ${target.name}`
          : 'Movida a Sin categoría',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover')
    }
  }

  const handleOpenEdit = (credential: Credential) => {
    setEditing(credential)
    setDialogOpen(true)
  }

  /** Renombra la categoría de una columna desde el tablero. */
  const handleRenameColumn = async (categoryId: string, name: string) => {
    try {
      await renameCategory(categoryId, name)
      toast.success('Lista renombrada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo renombrar')
    }
  }

  /** Elimina una columna; sus registros quedan sin categoría. */
  const handleDeleteColumn = async (categoryId: string) => {
    const target = categories.find((c) => c.id === categoryId)
    if (!target) return
    const confirmed = window.confirm(
      `¿Eliminar la lista "${target.name}"? Sus credenciales quedarán sin categoría.`,
    )
    if (!confirmed) return
    if (categoryFilter === categoryId) setCategoryFilter(null)
    try {
      await deleteCategory(categoryId)
      toast.success('Lista eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const handleSubmit = async (
    values: CredentialFormValues,
    attachments: AttachmentDraft,
  ) => {
    const normalized = {
      title: values.title.trim(),
      username: values.username.trim(),
      password: values.password,
      url: values.url.trim() || undefined,
      categoryId: values.categoryId || undefined,
      notes: values.notes.trim() || undefined,
    }

    try {
      if (editing) {
        await updateCredential(editing.id, normalized, attachments)
        toast.success('Credencial actualizada')
      } else {
        await addCredential(normalized, attachments)
        toast.success('Credencial creada')
      }
      setDialogOpen(false)
      setEditing(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteCredential(deleting.id)
      toast.success('Credencial eliminada')
      setDeleting(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const weakCount = useMemo(
    () =>
      credentials.filter((c) => evaluatePassword(c.password).score <= 1).length,
    [credentials],
  )
  const favoriteCount = useMemo(
    () => credentials.filter((c) => c.favorite).length,
    [credentials],
  )
  /** Credenciales distintas que están en algún espacio de equipo. */
  const sharedCount = useMemo(
    () => new Set(sharedItems.map((item) => item.credentialId)).size,
    [sharedItems],
  )

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 lg:space-y-7">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Access</h1>
          <p className="mt-1 text-sm text-muted">
            {credentials.length === 0
              ? 'Gestiona tus credenciales y accesos.'
              : `${credentials.length} credencial${credentials.length === 1 ? '' : 'es'} guardada${credentials.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        <div className="page-actions">
          <ViewToggle />
        </div>
      </div>

      {/* Aviso de sin conexión: los datos vienen de la copia local cifrada. */}
      {offline && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-primary/25 bg-primary-soft/60 px-4 py-3 text-[13px] text-foreground"
        >
          <CloudOff className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            <span className="font-semibold">Sin conexión con el servidor.</span>{' '}
            Estás viendo tu copia local cifrada y no puedes guardar cambios
            hasta que vuelva la conexión.
          </p>
        </div>
      )}

      {/* KPIs: también funcionan como filtros rápidos */}
      {status === 'ready' && credentials.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard
            icon={KeyRound}
            label="Credenciales"
            value={credentials.length}
            hint="en tu espacio personal"
          />
          <StatCard
            icon={Star}
            label="Favoritas"
            value={favoriteCount}
            hint="favoritas"
            active={categoryFilter === FAVORITES}
            onClick={() =>
              setCategoryFilter(categoryFilter === FAVORITES ? null : FAVORITES)
            }
          />
          <StatCard
            icon={ShieldAlert}
            label="Claves débiles"
            tone={weakCount > 0 ? 'warning' : 'success'}
            value={weakCount}
            hint={weakCount > 0 ? 'claves débiles' : 'sin claves débiles'}
            active={weakOnly}
            onClick={() => setWeakOnly(!weakOnly)}
          />
          <StatCard
            icon={Users2}
            label="Compartidas"
            value={sharedCount}
            hint="compartidas en equipos"
          />
        </div>
      )}

      {/* El buscador vive en el Header; aquí sólo ordenación y modo de vista. */}
      {credentials.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ViewToggle />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {/* Content */}
      {status === 'loading' ? (
        <CardGridSkeleton />
      ) : status === 'error' ? (
        <EmptyState
          icon={KeyRound}
          title="No se pudo sincronizar"
          description={syncError ?? 'Error al cargar los datos desde Supabase.'}
          action={
            <Button variant="primary" onClick={() => void retryLoad()}>
              Reintentar
            </Button>
          }
        />
      ) : credentials.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Aún no hay credenciales"
          description="Crea tu primera credencial para tenerla siempre a mano."
          action={
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              Nueva credencial
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="Sin resultados"
          description="No se encontraron credenciales que coincidan con la búsqueda."
        />
      ) : vaultView === 'board' ? (
        <BoardView
          columns={buildBoardColumns(filtered, {
            sections,
            categories,
            filter: categoryFilter,
          })}
          renderCard={(credential) => (
            <CredentialBoardCard
              credential={credential}
              onEdit={handleOpenEdit}
              onDelete={setDeleting}
            />
          )}
          onAddCard={handleOpenCreateIn}
          onMoveCard={handleMoveCard}
          renderAddColumn={(close) => (
            <BoardHeader itemLabel="lista" presetParentId="" onClose={close} />
          )}
          onRenameColumn={(id, name) => void handleRenameColumn(id, name)}
          onDeleteColumn={(id) => void handleDeleteColumn(id)}
          addLabel="Añade una credencial"
        />
      ) : (
        <CredentialGrid
          credentials={filtered}
          onEdit={handleOpenEdit}
          onDelete={setDeleting}
        />
      )}

      {/* Create / Edit dialog */}
      <CredentialDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditing(null)
            setCreateCategoryId('')
          }
        }}
        credential={editing ?? undefined}
        defaultCategoryId={editing ? undefined : createCategoryId}
        onSubmit={handleSubmit}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Eliminar credencial"
        description={
          deleting
            ? `¿Seguro que quieres eliminar "${deleting.title}"? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  )
}
