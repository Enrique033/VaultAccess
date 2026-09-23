import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { KeyRound, Plus, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { CredentialGrid } from '@/components/credentials/CredentialGrid'
import { CredentialDialog } from '@/components/credentials/CredentialDialog'
import { CredentialSortSelect } from '@/components/credentials/CredentialSortSelect'
import type { CredentialFormValues } from '@/components/credentials/CredentialForm'
import { useVaultStore, useVaultSync } from '@/store/vault.store'
import { useSearchStore } from '@/store/search.store'
import { toast } from '@/store/ui.store'
import type { Credential } from '@/types'

const FAVORITES = 'favorites'
const NONE = 'none'

export function Credentials() {
  useVaultSync()

  const credentials = useVaultStore((s) => s.credentials)
  const categories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const status = useVaultStore((s) => s.status)
  const syncError = useVaultStore((s) => s.error)
  const retryLoad = useVaultStore((s) => s.load)
  const addCredential = useVaultStore((s) => s.addCredential)
  const updateCredential = useVaultStore((s) => s.updateCredential)
  const deleteCredential = useVaultStore((s) => s.deleteCredential)

  const query = useSearchStore((s) => s.query)
  const setQuery = useSearchStore((s) => s.setQuery)
  const sectionId = useSearchStore((s) => s.sectionId)
  const setSectionId = useSearchStore((s) => s.setSectionId)
  const categoryFilter = useSearchStore((s) => s.categoryFilter)
  const setCategoryFilter = useSearchStore((s) => s.setCategoryFilter)
  const sort = useSearchStore((s) => s.sort)
  const setSort = useSearchStore((s) => s.setSort)
  const focusSignal = useSearchStore((s) => s.focusSignal)

  const [searchParams, setSearchParams] = useSearchParams()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Credential | null>(null)
  const [deleting, setDeleting] = useState<Credential | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (focusSignal > 0) searchRef.current?.focus()
  }, [focusSignal])

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
    const byCategory = (credential: Credential) => {
      if (categoryFilter === FAVORITES) return credential.favorite
      if (categoryFilter === NONE) return !credential.categoryId
      if (categoryFilter) return credential.categoryId === categoryFilter
      if (sectionId) {
        const cat = categories.find((c) => c.id === credential.categoryId)
        return cat?.sectionId === sectionId
      }
      return true
    }
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
    const list = credentials.filter((c) => byCategory(c) && byQuery(c))
    if (sort === 'az') return [...list].sort((a, b) => a.title.localeCompare(b.title, 'es'))
    if (sort === 'favorites') {
      return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt.localeCompare(a.updatedAt))
    }
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [credentials, categories, query, categoryFilter, sectionId, sort])

  const activeSection = sections.find((s) => s.id === sectionId) ?? null
  const activeCategory = categories.find((c) => c.id === categoryFilter) ?? null
  const hasFilters = sectionId !== null || categoryFilter !== null || query.trim() !== ''

  const handleOpenCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const handleOpenEdit = (credential: Credential) => {
    setEditing(credential)
    setDialogOpen(true)
  }

  const handleSubmit = async (values: CredentialFormValues) => {
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
        await updateCredential(editing.id, normalized)
        toast.success('Credencial actualizada')
      } else {
        await addCredential(normalized)
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

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Access
          </h1>
          <p className="mt-1 text-sm text-muted">
            {credentials.length === 0
              ? 'Gestiona tus credenciales y accesos.'
              : `${credentials.length} credencial${credentials.length === 1 ? '' : 'es'} guardada${credentials.length === 1 ? '' : 's'}.`}
          </p>
        </div>

        <Button variant="primary" onClick={handleOpenCreate}>
          <Plus className="size-3.5" />
          Nueva credencial
        </Button>
      </div>

      {/* Search + sort */}
      {credentials.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            ref={searchRef}
            value={query}
            onChange={setQuery}
            placeholder="Buscar por título, usuario, URL o categoría..."
            className="min-w-52 max-w-md flex-1"
          />
          <CredentialSortSelect value={sort} onChange={setSort} />
        </div>
      )}

      {/* Active filters */}
      {hasFilters && credentials.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-muted">
            <SlidersHorizontal className="size-3.5" /> Filtros:
          </span>
          {activeSection && (
            <button
              type="button"
              onClick={() => setSectionId(null)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-foreground transition-colors hover:border-primary/40"
            >
              Sección: {activeSection.name}
              <X className="size-3 text-muted" />
            </button>
          )}
          {categoryFilter === FAVORITES && (
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-foreground transition-colors hover:border-primary/40"
            >
              Favoritas
              <X className="size-3 text-muted" />
            </button>
          )}
          {categoryFilter === NONE && (
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-foreground transition-colors hover:border-primary/40"
            >
              Sin categoría
              <X className="size-3 text-muted" />
            </button>
          )}
          {activeCategory && (
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-foreground transition-colors hover:border-primary/40"
            >
              <span className="size-2 rounded-full" style={{ backgroundColor: activeCategory.color }} />
              {activeCategory.name}
              <X className="size-3 text-muted" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { setSectionId(null); setCategoryFilter(null); setQuery('') }}
            className="text-muted underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Content */}
      {status === 'loading' ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted">Sincronizando tu bóveda con Supabase…</p>
        </div>
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
          if (!open) setEditing(null)
        }}
        credential={editing ?? undefined}
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