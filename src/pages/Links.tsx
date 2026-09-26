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
import { useBoardColumnActions } from '@/components/board/useBoardColumnActions'
import { ArchivedItemsNotice } from '@/components/board/ArchivedItemsNotice'
import { LinkBoardCard } from '@/components/board/LinkBoardCard'
import { ShareItemDialog } from '@/components/sharing/ShareItemDialog'
import type { AttachmentDraft } from '@/types'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { toast, useUIStore } from '@/store/ui.store'
import { activeCategories, matchesCategoryFilter } from '@/lib/vault-filters'
import { buildBoardColumns } from '@/lib/vault-board'
import type { LinkItem } from '@/types'

export function Links() {
  const allLinks = useVaultStore((s) => s.links)
  /** El tablero sólo muestra lo activo: lo archivado vive en su propio panel. */
  const links = useMemo(
    () => allLinks.filter((link) => !link.archivedAt),
    [allLinks],
  )
  const allCategories = useVaultStore((s) => s.categories)
  /**
   * Links sólo ve sus columnas: no comparte ninguna con Access ni Notas, y las
   * archivadas quedan fuera hasta recuperarlas desde el panel de Archivados.
   */
  const categories = useMemo(
    () => activeCategories(allCategories, 'link'),
    [allCategories],
  )
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const syncError = useVaultStore((s) => s.error)
  const linksLoaded = useVaultStore((s) => s.linksLoaded)
  const linksLoading = useVaultStore((s) => s.linksLoading)
  const linksError = useVaultStore((s) => s.linksError)
  const loadLinks = useVaultStore((s) => s.loadLinks)
  const addLink = useVaultStore((s) => s.addLink)
  const updateLink = useVaultStore((s) => s.updateLink)
  const deleteLink = useVaultStore((s) => s.deleteLink)

  const query = useSearchStore((s) => s.query)
  // Sólo filtra la búsqueda: el tablero muestra siempre todas las columnas.
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LinkItem | null>(null)
  const [deleting, setDeleting] = useState<LinkItem | null>(null)
  /** Categoría preseleccionada al crear desde el botón «+» de una columna. */
  const [createCategoryId, setCreateCategoryId] = useState('')
  /** Enlace abierto en el diálogo de compartir con el equipo. */
  const [shareTarget, setShareTarget] = useState<LinkItem | null>(null)
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

  /* Ver `useBoardColumnActions`: ahí se resuelve el caso de «Sin categoría». */
  const { renameColumn, archiveColumn, deleteColumn } =
    useBoardColumnActions('link')

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
        // El enlace recién creado se ofrece para compartir en equipo.
        const created = await addLink(normalized, attachments)
        toast.success('Enlace creado')
        setDialogOpen(false)
        setEditing(null)
        setShareTarget(created)
        return
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
      </div>

      {/* El buscador vive en el Header; aquí sólo ordenación y modo de vista. */}
      {links.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ViewToggle />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {/* Aviso: si hay tarjetas archivadas, se ve aquí y no desaparecen en silencio. */}
      <ArchivedItemsNotice items={allLinks} one="enlace" many="enlaces" />

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
        <BoardView
          columns={buildBoardColumns(filtered, {
            sections,
            categories,
            filter: categoryFilter,
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
          renderAddColumn={(close) => (
            <BoardHeader
              module="link"
              itemLabel="lista"
              presetParentId=""
              onClose={close}
            />
          )}
          onRenameColumn={(id, name) => void renameColumn(id, name)}
          onArchiveColumn={(id) => void archiveColumn(id, 'enlaces')}
          onDeleteColumn={(id) => void deleteColumn(id, 'enlaces')}
          addLabel="Añade un enlace"
        />
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
        onShareRequest={setShareTarget}
      />

      <ShareItemDialog
        open={shareTarget !== null}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null)
        }}
        kind="link"
        item={shareTarget}
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
