import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Link2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FilterChips } from '@/components/ui/FilterChips'
import { CardGridSkeleton } from '@/components/ui/Skeleton'
import { CredentialSortSelect } from '@/components/credentials/CredentialSortSelect'
import { LinkCard } from '@/components/links/LinkCard'
import { LinkDialog, type LinkFormValues } from '@/components/links/LinkDialog'
import { useVaultStore } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { toast } from '@/store/ui.store'
import type { LinkItem } from '@/types'

const FAVORITES = 'favorites'
const NONE = 'none'

export function Links() {
  const links = useVaultStore((s) => s.links)
  const categories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const syncError = useVaultStore((s) => s.error)
  const retryLoad = useVaultStore((s) => s.load)
  const addLink = useVaultStore((s) => s.addLink)
  const updateLink = useVaultStore((s) => s.updateLink)
  const deleteLink = useVaultStore((s) => s.deleteLink)

  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)
  const sectionId = useSearchStore((s) => s.sectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)
  const focusSignal = useSearchStore((s) => s.focusSignal)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<LinkItem | null>(null)
  const [deleting, setDeleting] = useState<LinkItem | null>(null)
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
    const byCategory = (link: LinkItem) => {
      if (categoryFilter === FAVORITES) return link.favorite
      if (categoryFilter === NONE) return !link.categoryId
      if (categoryFilter) return link.categoryId === categoryFilter
      if (sectionId) {
        const cat = categories.find((c) => c.id === link.categoryId)
        return cat?.sectionId === sectionId
      }
      return true
    }
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
    const list = links.filter((l) => byCategory(l) && byQuery(l))
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
    setDialogOpen(true)
  }

  const handleSubmit = async (values: LinkFormValues) => {
    const normalized = {
      title: values.title.trim(),
      url: values.url.trim(),
      categoryId: values.categoryId || undefined,
      description: values.description.trim() || undefined,
    }
    try {
      if (editing) {
        await updateLink(editing.id, normalized)
        toast.success('Enlace actualizado')
      } else {
        await addLink(normalized)
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

      {/* Search + sort */}
      {links.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={setQuery}
            placeholder="Buscar por título, URL o categoría..."
            className="w-full sm:min-w-52 sm:max-w-md sm:flex-1"
          />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {links.length > 0 && (
        <FilterChips sections={sections} categories={categories} />
      )}

      {/* Content */}
      {status === 'loading' ? (
        <CardGridSkeleton />
      ) : status === 'error' ? (
        <EmptyState
          icon={Link2}
          title="No se pudo sincronizar"
          description={syncError ?? 'Error al cargar los datos desde Supabase.'}
          action={
            <Button variant="primary" onClick={() => void retryLoad()}>
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
          if (!open) setEditing(null)
        }}
        link={editing ?? undefined}
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
