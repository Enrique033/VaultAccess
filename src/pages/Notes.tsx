import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { NotebookPen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CardGridSkeleton } from '@/components/ui/Skeleton'
import { CredentialSortSelect } from '@/components/credentials/CredentialSortSelect'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteDialog, type NoteFormValues } from '@/components/notes/NoteDialog'
import { ViewToggle } from '@/components/board/ViewToggle'
import { BoardView } from '@/components/board/BoardView'
import { BoardHeader } from '@/components/board/BoardHeader'
import { useBoardColumnActions } from '@/components/board/useBoardColumnActions'
import { ArchivedItemsNotice } from '@/components/board/ArchivedItemsNotice'
import { NoteBoardCard } from '@/components/board/NoteBoardCard'
import { ShareItemDialog } from '@/components/sharing/ShareItemDialog'
import type { AttachmentDraft } from '@/types'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { toast, useUIStore } from '@/store/ui.store'
import { activeCategories, matchesCategoryFilter } from '@/lib/vault-filters'
import { buildBoardColumns } from '@/lib/vault-board'
import type { Note } from '@/types'

export function Notes() {
  const allNotes = useVaultStore((s) => s.notes)
  /** El tablero sólo muestra lo activo: lo archivado vive en su propio panel. */
  const notes = useMemo(
    () => allNotes.filter((note) => !note.archivedAt),
    [allNotes],
  )
  const allCategories = useVaultStore((s) => s.categories)
  /**
   * Notas sólo ve sus columnas: no comparte ninguna con Access ni Links, y las
   * archivadas quedan fuera hasta recuperarlas desde el panel de Archivados.
   */
  const categories = useMemo(
    () => activeCategories(allCategories, 'note'),
    [allCategories],
  )
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const syncError = useVaultStore((s) => s.error)
  const notesLoaded = useVaultStore((s) => s.notesLoaded)
  const notesLoading = useVaultStore((s) => s.notesLoading)
  const notesError = useVaultStore((s) => s.notesError)
  const loadNotes = useVaultStore((s) => s.loadNotes)
  const addNote = useVaultStore((s) => s.addNote)
  const updateNote = useVaultStore((s) => s.updateNote)
  const deleteNote = useVaultStore((s) => s.deleteNote)

  const query = useSearchStore((s) => s.query)
  // Sólo filtra la búsqueda: el tablero muestra siempre todas las columnas.
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  /** Categoría preseleccionada al crear desde el botón «+» de una columna. */
  const [createCategoryId, setCreateCategoryId] = useState('')
  /** Nota abierta en el diálogo de compartir con el equipo. */
  const [shareTarget, setShareTarget] = useState<Note | null>(null)
  const vaultView = useUIStore((s) => s.vaultView)

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])
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
    const byQuery = (note: Note) => {
      if (!q) return true
      const category = categories.find((c) => c.id === note.categoryId)
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        category?.name.toLowerCase().includes(q)
      )
    }
    const list = notes.filter(
      (note) =>
        matchesCategoryFilter(note, categoryFilter, sectionId, categories) &&
        byQuery(note),
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
  }, [notes, categories, query, categoryFilter, sectionId, sort])

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
  const handleMoveCard = async (note: Note, toCategoryId: string | undefined) => {
    const target = categories.find((c) => c.id === toCategoryId)
    try {
      await updateNote(note.id, { categoryId: toCategoryId })
      toast.success(target ? `Movida a ${target.name}` : 'Movida a Sin categoría')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo mover')
    }
  }

  /*
    Renombrar y eliminar columnas vive en un hook compartido: ahí se resuelve
    el caso especial de «Sin categoría», que se convierte en columna real.
  */
  const { renameColumn, archiveColumn, deleteColumn } =
    useBoardColumnActions('note')

  const handleSubmit = async (values: NoteFormValues, attachments: AttachmentDraft) => {
    const normalized = {
      title: values.title.trim(),
      content: values.content,
      comments: values.comments.trim() || undefined,
      categoryId: values.categoryId || undefined,
    }
    try {
      if (editing) {
        await updateNote(editing.id, normalized, attachments)
        toast.success('Nota actualizada')
      } else {
        // La nota recién creada se ofrece para compartir: así no hay que
        // buscarla en el tablero justo después de crearla.
        const created = await addNote(normalized, attachments)
        toast.success('Nota creada')
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
      await deleteNote(deleting.id)
      toast.success('Nota eliminada')
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
          <h1 className="page-title">Notas</h1>
          <p className="mt-1 text-sm text-muted">
            {notes.length === 0
              ? 'Apunta ideas, pasos y recordatorios.'
              : `${notes.length} nota${notes.length === 1 ? '' : 's'} guardada${notes.length === 1 ? '' : 's'}.`}
          </p>
        </div>
      </div>

      {/* El buscador vive en el Header; aquí sólo ordenación y modo de vista. */}
      {notes.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ViewToggle />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {/* Aviso: si hay tarjetas archivadas, se ve aquí y no desaparecen en silencio. */}
      <ArchivedItemsNotice items={allNotes} one="nota" many="notas" />

      {status === 'loading' || notesLoading || (!notesLoaded && !notesError) ? (
        <CardGridSkeleton />
      ) : status === 'error' ? (
        <EmptyState
          icon={NotebookPen}
          title="No se pudo sincronizar"
          description={syncError ?? 'Error al cargar los datos desde Supabase.'}
          action={
            <Button variant="primary" onClick={() => void loadNotes()}>
              Reintentar
            </Button>
          }
        />
      ) : notesError ? (
        <EmptyState
          icon={NotebookPen}
          title="No se pudieron cargar las notas"
          description={notesError}
          action={
            <Button variant="primary" onClick={() => void loadNotes()}>
              Reintentar
            </Button>
          }
        />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Aún no hay notas"
          description="Crea tu primera nota para no olvidar nada importante."
          action={
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="size-3.5" />
              Nueva nota
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="Sin resultados"
          description="No se encontraron notas que coincidan con la búsqueda."
        />
      ) : vaultView === 'board' ? (
        <BoardView
          columns={buildBoardColumns(filtered, {
            sections,
            categories,
            filter: categoryFilter,
          })}
          renderCard={(note) => (
            <NoteBoardCard
              note={note}
              onEdit={(n) => {
                setEditing(n)
                setDialogOpen(true)
              }}
              onDelete={setDeleting}
            />
          )}
          onAddCard={handleOpenCreateIn}
          onMoveCard={handleMoveCard}
          renderAddColumn={(close) => (
            <BoardHeader
              module="note"
              itemLabel="lista"
              presetParentId=""
              onClose={close}
            />
          )}
          onRenameColumn={(id, name) => void renameColumn(id, name)}
          onArchiveColumn={(id) => void archiveColumn(id, 'notas')}
          onDeleteColumn={(id) => void deleteColumn(id, 'notas')}
          addLabel="Añade una nota"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={(n) => {
                setEditing(n)
                setDialogOpen(true)
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <NoteDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditing(null)
            setCreateCategoryId('')
          }
        }}
        note={editing ?? undefined}
        defaultCategoryId={editing ? undefined : createCategoryId}
        onSubmit={handleSubmit}
        onShareRequest={setShareTarget}
      />

      <ShareItemDialog
        open={shareTarget !== null}
        onOpenChange={(open) => {
          if (!open) setShareTarget(null)
        }}
        kind="note"
        item={shareTarget}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title="Eliminar nota"
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
