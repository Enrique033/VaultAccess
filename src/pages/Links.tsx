import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CardGridSkeleton } from '@/components/ui/Skeleton'
import { CredentialSortSelect } from '@/components/credentials/CredentialSortSelect'
import { LinkCard } from '@/components/links/LinkCard'
import { LinkDialog, type LinkFormValues } from '@/components/links/LinkDialog'
import { ViewToggle } from '@/components/board/ViewToggle'
import { BoardView } from '@/components/board/BoardView'
import { BoardHeader } from '@/components/board/BoardHeader'
import { LinkBoardCard } from '@/components/board/LinkBoardCard'
import type { AttachmentDraft } from '@/types'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { toast, useUIStore } from '@/store/ui.store'
import { matchesCategoryFilter } from '@/lib/vault-filters'
import { buildBoardColumns } from '@/lib/vault-board'
import type { LinkItem } from '@/types'

export function Links() {
  const links = useVaultStore((s) => s.links)
  const categories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const syncError = useVaultStore((s) => s.error)
  const linksLoaded = useVaultStore((s) => s.linksLoaded)
  const linksLoading = useVaultStore((s) => s.linksLoading)
  const linksError = useVaultStore((s) => s.linksError)
  const loadLinks = useVaultStore((s) => s.loadLinks)
  const renameCategory = useVaultStore((s) => s.renameCategory)
  const deleteCategory = useVaultStore((s) => s.deleteCategory)
  const addLink = useVaultStore((s) => s.addLink)
  const updateLink = useVaultStore((s) => s.updateLink)
  const deleteLink = useVaultStore((s) => s.deleteLink)

  const query = useSearchStore((s) => s.query)
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LinkItem | null>(null)
  const [deleting, setDeleting] = useState<LinkItem | null>(null)
  /** Categoría preseleccionada al crear desde el botón «+» de una columna. */
  const [createCategoryId, setCreateCategoryId] = useState('')
  /** Petición de alta de lista lanzada desde una columna del tablero. */
  const [listPresetParent, setListPresetParent] = useState<string | null>(null)
  const vaultView = useUIStore((s) => s.vaultView)

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  // Abre el diálogo cuando el Header navega con ?new=1
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
    const byQuery = (link: LinkItem) => {
      if (!q) return true
      const category = categories.find((c) => c.id === link.categoryId)
      return (
        link.title.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        (link.description?.toLowerCase().includes(q) ?? false) ||
        category?.name.toLowerCase().includes(q)
      )
    }
    const list = links.filter(
      (link) =>
        matchesCategoryFilter(link, categoryFilter, sectionId, categories) &&
        byQuery(link),
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
  }, [links, categories, query, categoryFilter, sectionId, sort])

  const handleOpenCreate = () => {
    setEditing(null)
    setCreateCategoryId('')
    setDialogOpen(true)
  }

  /** Abre el diálogo con la categoría de la columna ya elegida. */
  const handleOpenCreateIn = (categoryId: string) => {
    setEditing(null)
    setCreateCategoryId(categoryId)
    setDialogOpen(true)
  }

  /** Arrastre entre columnas: sólo cambia la categoría y conserva los adjuntos. */
  const handleMoveCard = async (link: LinkItem, toCategoryId: string | undefined) => {
    const target = categories.find((c) => c.id === toCategoryId)
    try {
      await updateLink(link.id, { categoryId: toCategoryId })
      toast.success(target ? `Movido a ${target.name}` : 'Movido a Sin categoría')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover')
    }
  }

  /** Abre el alta de lista del encabezado; opcionalmente anidada. */
  const handleAddList = (parentId: string) => setListPresetParent(parentId)

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
    if (
      !window.confirm(
        `¿Eliminar la lista "${target.name}"? Sus enlaces quedarán sin categoría.`,
      )
    )
      return
    if (categoryFilter === categoryId) setCategoryFilter(null)
    try {
      await deleteCategory(categoryId)
      toast.success('Lista eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  const handleSubmit = async (values: LinkFormValues, attachments: AttachmentDraft) => {
    const normalized = {
      title: values.title.trim(),
      url: values.url.trim(),
      categoryId: values.categoryId || undefined,
      description: values.description.trim() || undefined,
    }
    try {
      if (editing) {
        await updateLink(editing.id, normalized, attachments)
        toast.success('Enlace actualizado')
      } else {
        await addLink(normalized, attachments)
        toast.success('Enlace creado')
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
      await deleteLink(deleting.id)
      toast.success('Enlace eliminado')
      setDeleting(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 lg:space-y-7">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Links</h1>
          <p className="mt-1 text-sm text-muted">
            {links.length === 0
              ? 'Guarda los enlaces que usas a diario.'
              : `${links.length} enlace${links.length === 1 ? '' : 's'} guardado${links.length === 1 ? '' : 's'}.`}
          </p>
        </div>
        <Button variant="primary" onClick={handleOpenCreate}>
          <Plus className="size-3.5" />
          Nuevo enlace
        </Button>
      </div>

      {/* El buscador vive en el Header; aquí sólo ordenación y modo de vista. */}
      {links.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ViewToggle />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {/* Content */}
      {status === 'loading' || linksLoading || (!linksLoaded && !linksError) ? (
        <CardGridSkeleton />
      ) : status === 'error' ? (
        <EmptyState
          icon={Link2}
          title="No se pudo sincronizar"
          description={syncError ?? 'Error al cargar los datos desde Supabase.'}
          action={
            <Button variant="primary" onClick={() => void loadLinks()}>
              Reintentar
            </Button>
          }
        />
      ) : linksError ? (
        <EmptyState
          icon={Link2}
          title="No se pudieron cargar los enlaces"
          description={linksError}
          action={
            <Button variant="primary" onClick={() => void loadLinks()}>
              Reintentar
            </Button>
          }
        />
      ) : links.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Aún no hay enlaces"
          description="Guarda tu primer enlace para tenerlo siempre a mano."
          action={
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              Nuevo enlace
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Link2}
          title="Sin resultados"
          description="No se encontraron enlaces que coincidan con la búsqueda."
        />
      ) : vaultView === 'board' ? (
        <>
          <BoardHeader
            itemLabel="enlace"
            presetParentId={listPresetParent}
            className="mb-3"
          />
          <BoardView
            columns={buildBoardColumns(filtered, {
              sections,
              categories,
              filter: categoryFilter,
              sectionId,
            })}
            renderCard={(link) => (
              <LinkBoardCard
                link={link}
                onEdit={(l) => {
                  setEditing(l)
                  setDialogOpen(true)
                }}
                onDelete={setDeleting}
              />
            )}
            onAddCard={handleOpenCreateIn}
            onMoveCard={handleMoveCard}
            onAddSubcategory={handleAddList}
            onRenameColumn={(id, name) => void handleRenameColumn(id, name)}
            onDeleteColumn={(id) => void handleDeleteColumn(id)}
            addLabel="Añade un enlace"
          />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onEdit={(l) => {
                setEditing(l)
                setDialogOpen(true)
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <LinkDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditing(null)
            setCreateCategoryId('')
          }
        }}
        link={editing ?? undefined}
        defaultCategoryId={editing ? undefined : createCategoryId}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Eliminar enlace"
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
