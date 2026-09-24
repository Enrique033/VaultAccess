import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { NotebookPen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterChips } from '@/components/ui/FilterChips'
import { CardGridSkeleton } from '@/components/ui/Skeleton'
import { CredentialSortSelect } from '@/components/credentials/CredentialSortSelect'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteDialog, type NoteFormValues } from '@/components/notes/NoteDialog'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { toast } from '@/store/ui.store'
import type { Note } from '@/types'

const FAVORITES = 'favorites'
const NONE = 'none'

export function Notes() {
  const notes = useVaultStore((s) => s.notes)
  const categories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const syncError = useVaultStore((s) => s.error)
  const retryLoad = useVaultStore((s) => s.load)
  const addNote = useVaultStore((s) => s.addNote)
  const updateNote = useVaultStore((s) => s.updateNote)
  const deleteNote = useVaultStore((s) => s.deleteNote)

  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)
  const focusSignal = useSearchStore((s) => s.focusSignal)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusSignal > 0) searchRef.current?.focus()
  }, [focusSignal])

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
    const byCategory = (note: Note) => {
      if (categoryFilter === FAVORITES) return note.favorite
      if (categoryFilter === NONE) return !note.categoryId
      if (categoryFilter) return note.categoryId === categoryFilter
      if (sectionId) {
        const cat = categories.find((c) => c.id === note.categoryId)
        return cat?.sectionId === sectionId
      }
      return true
    }
    const byQuery = (note: Note) => {
      if (!q) return true
      const category = categories.find((c) => c.id === note.categoryId)
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        category?.name.toLowerCase().includes(q)
      )
    }
    const list = notes.filter((n) => byCategory(n) && byQuery(n))
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
    setDialogOpen(true)
  }

  const handleSubmit = async (values: NoteFormValues) => {
    const normalized = {
      title: values.title.trim(),
      content: values.content,
      categoryId: values.categoryId || undefined,
    }
    try {
      if (editing) {
        await updateNote(editing.id, normalized)
        toast.success('Nota actualizada')
      } else {
        await addNote(normalized)
        toast.success('Nota creada')
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
        <Button variant="primary" onClick={handleOpenCreate}>
          <Plus className="size-3.5" />
          Nueva nota
        </Button>
      </div>

      {/* Search + sort */}
      {notes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={setQuery}
            placeholder="Buscar por título, contenido o categoría..."
            className="w-full sm:min-w-52 sm:max-w-md sm:flex-1"
          />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {notes.length > 0 && (
        <FilterChips sections={sections} categories={categories} />
      )}

      {/* Content */}
      {status === 'loading' ? (
        <CardGridSkeleton />
      ) : status === 'error' ? (
        <EmptyState
          icon={NotebookPen}
          title="No se pudo sincronizar"
          description={syncError ?? 'Error al cargar los datos desde Supabase.'}
          action={
            <Button variant="primary" onClick={() => void retryLoad()}>
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
          if (!open) setEditing(null)
        }}
        note={editing ?? undefined}
        onSubmit={handleSubmit}
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
