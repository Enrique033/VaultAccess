import { useEffect } from 'react'
import { create } from 'zustand'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured, requireUserId, supabase } from '@/lib/supabase'
import {
  toWorkspace,
  toWorkspaceMember,
  toWorkspaceItemReference,
} from '@/lib/workspace-mapper'
import { getVaultSessionGeneration } from '@/lib/vault-session'
import { toEncryptedWorkspaceItem } from '@/lib/workspace-record-crypto'
import { getWorkspaceKey, ensureWorkspaceKey, syncWorkspaceKeys } from '@/lib/workspace-crypto'
import { encryptJson, workspaceRecordAad } from '@/lib/vault-crypto'
import type {
  WorkspaceItemReferenceRow,
  WorkspaceItemRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from '@/lib/workspace-mapper'
import type { WorkspaceItemPayload } from '@/lib/vault-payloads'
import type {
  SharedItemKind,
  Workspace,
  WorkspaceItem,
  WorkspaceItemReference,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types'

export type WorkspaceStatus = 'idle' | 'loading' | 'ready' | 'error' | 'local'

/** Error de equipos con la pista de qué script SQL falta. */
function friendlyWorkspaceError(message: string): string {
  if (/list_workspace_members|schema-chat-v2/i.test(message))
    return 'Falta la privacidad de miembros. Ejecuta supabase/schema-chat-v2.sql en Supabase.'
  if (/relation .* does not exist|schema cache|PGRST202/i.test(message))
    return 'Faltan tablas o funciones de cifrado. Ejecuta supabase/schema-encryption.sql después de las migraciones base en el SQL Editor de Supabase.'
  if (/row-level security/i.test(message))
    return `Supabase bloqueó la operación (RLS). Revisa las migraciones de Supabase y que hayas iniciado sesión. Detalle: ${message}`
  if (/Failed to fetch|NetworkError|network/i.test(message))
    return 'Sin conexión con Supabase. Revisa tu internet o la URL del proyecto.'
  if (/duplicate key/i.test(message))
    return 'Ese correo ya forma parte del espacio.'
  return message
}

const WORKSPACE_COLUMNS = 'id, owner_id, name, created_at'
// `item_kind`, `link_id` y `note_id` deben estar aquí: sin ellos, una referencia
// a un enlace o a una nota compartida se leería como si fuera de credencial.
const ITEM_REFERENCE_COLUMNS =
  'id, workspace_id, item_kind, credential_id, link_id, note_id'
// `description` y `content` no son columnas: los enlaces y las notas se
// comparten siempre cifrados, así que esos campos viajan en encrypted_payload.
const ITEM_COLUMNS =
  'id, workspace_id, item_kind, credential_id, link_id, note_id, created_by, title, username, password, url, notes, encrypted_payload, created_at, updated_at'

function isMissingRpcError(message: string): boolean {
  return /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
    message,
  )
}

let workspaceLoadGeneration = 0
let workspaceItemsGeneration = 0

interface WorkspaceState {
  workspaces: Workspace[]
  members: WorkspaceMember[]
  items: WorkspaceItem[]
  /** Referencias mínimas para badges y contadores, sin claves/URLs/notas. */
  itemReferences: WorkspaceItemReference[]
  itemsWorkspaceId: string | null
  itemsLoading: boolean
  itemsError: string | null
  /** Espacio seleccionado en la vista de equipos. */
  activeId: string | null
  status: WorkspaceStatus
  error: string | null

  /** Carga espacios, miembros y referencias mínimas. */
  load: () => Promise<void>
  loadWorkspaceItems: (workspaceId: string) => Promise<void>
  setActive: (id: string | null) => void
  reset: () => void

  createWorkspace: (name: string) => Promise<Workspace>
  renameWorkspace: (id: string, name: string) => Promise<void>
  deleteWorkspace: (id: string) => Promise<void>

  inviteMember: (
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
  ) => Promise<void>
  setMemberRole: (memberId: string, role: WorkspaceRole) => Promise<void>
  removeMember: (memberId: string) => Promise<void>

  /**
   * Comparte un registro (crea o actualiza su copia en el espacio).
   * admitting credenciales, enlaces y notas.
   */
  shareItem: (
    workspaceId: string,
    kind: SharedItemKind,
    source: SharedSource,
  ) => Promise<void>
  /** Vuelve a subir los datos actuales del registro a la copia. */
  updateSharedItem: (itemId: string, source: SharedSource) => Promise<void>
  removeSharedItem: (itemId: string) => Promise<void>
}

/** Datos que se copian al espacio, ya descifrados desde el Vault personal. */
export type SharedSource =
  | { id: string; title: string; username: string; password: string; url?: string; notes?: string }
  | { id: string; title: string; url: string; description?: string }
  | { id: string; title: string; content: string; comments?: string }

/** Convierte un registro en el payload cifrado del elemento compartido. */
function sharedPayload(
  kind: SharedItemKind,
  source: SharedSource,
): WorkspaceItemPayload {
  if (kind === 'credential') {
    const c = source as Extract<SharedSource, { username: string }>
    return {
      title: c.title,
      username: c.username,
      password: c.password,
      url: c.url,
      notes: c.notes,
    }
  }
  if (kind === 'link') {
    const l = source as Extract<SharedSource, { url: string }>
    return {
      title: l.title,
      username: '',
      password: '',
      url: l.url,
      description: l.description,
    }
  }
  const n = source as Extract<SharedSource, { content: string }>
  return {
    title: n.title,
    username: '',
    password: '',
    content: n.content,
    notes: n.comments,
  }
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  workspaces: [],
  members: [],
  items: [],
  itemReferences: [],
  itemsWorkspaceId: null,
  itemsLoading: false,
  itemsError: null,
  activeId: null,
  status: isSupabaseConfigured ? 'idle' : 'local',
  error: null,

  load: async () => {
    const generation = ++workspaceLoadGeneration
    const vaultGeneration = getVaultSessionGeneration()
    workspaceItemsGeneration += 1
    if (!isSupabaseConfigured) {
      set({
        status: 'local',
        error: null,
        workspaces: [],
        members: [],
        items: [],
        itemReferences: [],
        itemsWorkspaceId: null,
        itemsLoading: false,
        itemsError: null,
      })
      return
    }
    set({ status: 'loading', error: null })
    try {
      await supabase.rpc('claim_workspace_invites')
      // v2 contiene solo referencias mínimas; si aún no está aplicada, el
      // fallback directo mantiene la app funcional sin descargar secretos.
      const snapshotResult = await supabase.rpc('get_workspace_snapshot_v2')
      let workspaceRows: WorkspaceRow[]
      let memberRows: WorkspaceMemberRow[]
      let itemReferenceRows: WorkspaceItemReferenceRow[]

      if (snapshotResult.error) {
        if (!isMissingRpcError(snapshotResult.error.message)) {
          throw new Error(friendlyWorkspaceError(snapshotResult.error.message))
        }
        const [workspaceResult, memberResult, itemReferenceResult] =
          await Promise.all([
            supabase
              .from('vault_workspaces')
              .select(WORKSPACE_COLUMNS)
              .order('created_at'),
            supabase.rpc('list_workspace_members'),
            supabase
              .from('vault_workspace_items')
              .select(ITEM_REFERENCE_COLUMNS),
          ])
        const firstError =
          workspaceResult.error ??
          memberResult.error ??
          itemReferenceResult.error
        if (firstError) {
          throw new Error(friendlyWorkspaceError(firstError.message))
        }
        workspaceRows = (workspaceResult.data ?? []) as WorkspaceRow[]
        memberRows = (memberResult.data ?? []) as WorkspaceMemberRow[]
        itemReferenceRows = (itemReferenceResult.data ??
          []) as WorkspaceItemReferenceRow[]
      } else {
        const snapshot = snapshotResult.data as {
          workspaces?: WorkspaceRow[]
          members?: WorkspaceMemberRow[]
          item_references?: WorkspaceItemReferenceRow[]
        }
        if (
          !Array.isArray(snapshot?.workspaces) ||
          !Array.isArray(snapshot.members) ||
          !Array.isArray(snapshot.item_references)
        ) {
          throw new Error('El snapshot de equipos tiene un formato inválido.')
        }
        workspaceRows = snapshot.workspaces
        memberRows = snapshot.members
        itemReferenceRows = snapshot.item_references
      }

      const workspaces = workspaceRows.map(toWorkspace)
      if (
        generation !== workspaceLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      const currentUserId = await requireUserId()
      const memberIdsByWorkspace = new Map<string, string[]>()
      for (const member of memberRows) {
        if (!member.user_id) continue
        const ids = memberIdsByWorkspace.get(member.workspace_id) ?? []
        ids.push(member.user_id)
        memberIdsByWorkspace.set(member.workspace_id, ids)
      }
      for (const workspace of workspaces.filter(
        (item) => item.ownerId === currentUserId,
      )) {
        await syncWorkspaceKeys(
          workspace.id,
          memberIdsByWorkspace.get(workspace.id) ?? [],
        )
      }
      if (
        generation !== workspaceLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set((state) => ({
        workspaces,
        members: memberRows.map(toWorkspaceMember),
        items: [],
        itemReferences: itemReferenceRows.map(toWorkspaceItemReference),
        itemsWorkspaceId: null,
        itemsLoading: false,
        itemsError: null,
        status: 'ready',
        error: null,
        activeId:
          state.activeId &&
          workspaces.some((workspace) => workspace.id === state.activeId)
            ? state.activeId
            : (workspaces[0]?.id ?? null),
      }))
    } catch (e) {
      if (
        generation !== workspaceLoadGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'Error al cargar los espacios.',
      })
    }
  },

  loadWorkspaceItems: async (workspaceId) => {
    const state = get()
    if (state.itemsWorkspaceId === workspaceId && !state.itemsError) return
    const generation = ++workspaceItemsGeneration
    const vaultGeneration = getVaultSessionGeneration()
    if (!isSupabaseConfigured) {
      set({
        items: [],
        itemsWorkspaceId: workspaceId,
        itemsLoading: false,
        itemsError: null,
      })
      return
    }
    set({
      items: [],
      itemsWorkspaceId: workspaceId,
      itemsLoading: true,
      itemsError: null,
    })
    try {
      const { data, error } = await supabase
        .from('vault_workspace_items')
        .select(ITEM_COLUMNS)
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })
      if (
        generation !== workspaceItemsGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      if (error) throw new Error(friendlyWorkspaceError(error.message))
      const key = await getWorkspaceKey(workspaceId)
      const rows = (data ?? []) as WorkspaceItemRow[]
      const items = await Promise.all(
        rows.map((row) => toEncryptedWorkspaceItem(row, workspaceId, key)),
      )
      if (
        generation !== workspaceItemsGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        items,
        itemsWorkspaceId: workspaceId,
        itemsLoading: false,
        itemsError: null,
      })
    } catch (e) {
      if (
        generation !== workspaceItemsGeneration ||
        vaultGeneration !== getVaultSessionGeneration()
      )
        return
      set({
        itemsLoading: false,
        itemsError:
          e instanceof Error
            ? e.message
            : 'No se pudieron descifrar los elementos del equipo.',
      })
    }
  },

  setActive: (activeId) => set({ activeId }),

  reset: () => {
    workspaceLoadGeneration += 1
    workspaceItemsGeneration += 1
    set({
      workspaces: [],
      members: [],
      items: [],
      itemReferences: [],
      itemsWorkspaceId: null,
      itemsLoading: false,
      itemsError: null,
      activeId: null,
      status: 'idle',
      error: null,
    })
  },

  createWorkspace: async (name) => {
    const userId = await requireUserId()
    const clean = name.trim()
    // Generamos el id aquí y NO pedimos RETURNING (`.select()`): la política de
    // SELECT de `vault_workspaces` se apoya en is_workspace_member(), que es
    // STABLE y evalúa con el snapshot de la misma sentencia → no ve la fila que
    // se acaba de insertar y Postgres abortaba con
    // "new row violates row-level security policy for table vault_workspaces".
    const id = crypto.randomUUID()
    const { error } = await supabase
      .from('vault_workspaces')
      .insert({ id, owner_id: userId, name: clean })
    if (error) throw new Error(friendlyWorkspaceError(error.message))

    const workspace: Workspace = {
      id,
      name: clean,
      ownerId: userId,
      createdAt: new Date().toISOString(),
    }

    // El propietario también queda como miembro con rol 'owner' (con su email).
    const { data: userData } = await supabase.auth.getUser()
    const email = userData.user?.email
    if (email) {
      const memberId = crypto.randomUUID()
      const { error: memberError } = await supabase
        .from('vault_workspace_members')
        .insert({
          id: memberId,
          workspace_id: workspace.id,
          user_id: userId,
          email,
          role: 'owner',
        })
      if (memberError) {
        console.warn(
          '[Workvaul] No se pudo registrar al propietario como miembro:',
          memberError.message,
        )
      } else {
        set((s) => ({
          members: [
            ...s.members,
            {
              id: memberId,
              workspaceId: workspace.id,
              userId,
              email,
              displayName: email,
              role: 'owner',
              createdAt: new Date().toISOString(),
            },
          ],
        }))
      }
    }
    await ensureWorkspaceKey(workspace.id)

    set((s) => ({
      workspaces: [...s.workspaces, workspace],
      activeId: workspace.id,
    }))
    return workspace
  },

  renameWorkspace: async (id, name) => {
    const next = name.trim()
    if (!next) return
    const { error } = await supabase
      .from('vault_workspaces')
      .update({ name: next })
      .eq('id', id)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id ? { ...w, name: next } : w,
      ),
    }))
  },

  deleteWorkspace: async (id) => {
    const { error } = await supabase
      .from('vault_workspaces')
      .delete()
      .eq('id', id)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    set((s) => ({
      workspaces: s.workspaces.filter((w) => w.id !== id),
      members: s.members.filter((m) => m.workspaceId !== id),
      items: s.items.filter((i) => i.workspaceId !== id),
      itemReferences: s.itemReferences.filter((i) => i.workspaceId !== id),
      itemsWorkspaceId: s.itemsWorkspaceId === id ? null : s.itemsWorkspaceId,
      activeId: s.activeId === id ? null : s.activeId,
    }))
  },

  inviteMember: async (workspaceId, email, role) => {
    const clean = email.trim().toLowerCase()

    const memberId = crypto.randomUUID()
    const { error } = await supabase.from('vault_workspace_members').insert({
      id: memberId,
      workspace_id: workspaceId,
      email: clean,
      role,
    })
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    const member: WorkspaceMember = {
      id: memberId,
      workspaceId,
      email: clean,
      displayName: clean,
      role,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({
      members: [...s.members, member],
    }))

    // La aplicación usa Google OAuth como único acceso. La invitación queda
    // pendiente y se reclama al iniciar sesión con Google usando este correo.
  },

  setMemberRole: async (memberId, role) => {
    const { error } = await supabase
      .from('vault_workspace_members')
      .update({ role })
      .eq('id', memberId)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    set((s) => ({
      members: s.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
    }))
  },

  removeMember: async (memberId) => {
    const member = get().members.find((item) => item.id === memberId)
    const { error } = await supabase
      .from('vault_workspace_members')
      .delete()
      .eq('id', memberId)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    if (member?.userId) {
      await supabase
        .from('vault_workspace_keys')
        .delete()
        .eq('workspace_id', member.workspaceId)
        .eq('user_id', member.userId)
    }
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }))
  },

  shareItem: async (workspaceId, kind, source) => {
    const userId = await requireUserId()
    const workspaceKey = await ensureWorkspaceKey(workspaceId)
    const payload = sharedPayload(kind, source)
    const existing = get().itemReferences.find(
      (item) =>
        item.workspaceId === workspaceId &&
        item.kind === kind &&
        item.sourceId === source.id,
    )
    const itemId = existing?.id ?? crypto.randomUUID()
    const encryptedPayload = await encryptJson(
      payload,
      workspaceKey,
      workspaceRecordAad(workspaceId, itemId),
    )
    /*
      Sólo se rellena la columna de origen que corresponde al tipo: la tabla
      tiene una por módulo y un CHECK garantiza que no haya más de una.
    */
    const origin = {
      credential_id: kind === 'credential' ? source.id : null,
      link_id: kind === 'link' ? source.id : null,
      note_id: kind === 'note' ? source.id : null,
    }
    const request = existing
      ? supabase
          .from('vault_workspace_items')
          .update({
            item_kind: kind,
            ...origin,
            encrypted_payload: encryptedPayload,
            title: null,
            username: null,
            password: null,
            url: null,
            notes: null,
          })
          .eq('id', itemId)
          .select(ITEM_COLUMNS)
          .single()
      : supabase
          .from('vault_workspace_items')
          .insert({
            id: itemId,
            workspace_id: workspaceId,
            item_kind: kind,
            ...origin,
            created_by: userId,
            encrypted_payload: encryptedPayload,
          })
          .select(ITEM_COLUMNS)
          .single()

    const { data, error } = await request
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    const item = await toEncryptedWorkspaceItem(
      data as WorkspaceItemRow,
      workspaceId,
      workspaceKey,
    )
    const reference = toWorkspaceItemReference({
      id: item.id,
      workspace_id: item.workspaceId,
      item_kind: item.kind,
      credential_id: item.kind === 'credential' ? (item.sourceId ?? null) : null,
      link_id: item.kind === 'link' ? (item.sourceId ?? null) : null,
      note_id: item.kind === 'note' ? (item.sourceId ?? null) : null,
    })
    set((s) => ({
      itemReferences: [
        reference,
        ...s.itemReferences.filter((i) => i.id !== item.id),
      ],
      items:
        s.itemsWorkspaceId === workspaceId
          ? [item, ...s.items.filter((i) => i.id !== item.id)]
          : s.items,
    }))
  },

  updateSharedItem: async (itemId, source) => {
    const current = get().items.find((item) => item.id === itemId)
    if (!current) throw new Error('El elemento compartido ya no existe.')
    const workspaceKey = await getWorkspaceKey(current.workspaceId)
    const encryptedPayload = await encryptJson(
      sharedPayload(current.kind, source),
      workspaceKey,
      workspaceRecordAad(current.workspaceId, itemId),
    )
    const { data, error } = await supabase
      .from('vault_workspace_items')
      .update({
        encrypted_payload: encryptedPayload,
        title: null,
        username: null,
        password: null,
        url: null,
        notes: null,
      })
      .eq('id', itemId)
      .select(ITEM_COLUMNS)
      .single()
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    const item = await toEncryptedWorkspaceItem(
      data as WorkspaceItemRow,
      current.workspaceId,
      workspaceKey,
    )
    set((s) => ({
      items: s.itemsWorkspaceId === item.workspaceId
        ? s.items.map((i) => (i.id === itemId ? item : i))
        : s.items,
    }))
  },

  removeSharedItem: async (itemId) => {
    const { error } = await supabase
      .from('vault_workspace_items')
      .delete()
      .eq('id', itemId)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    set((s) => ({
      items: s.items.filter((i) => i.id !== itemId),
      itemReferences: s.itemReferences.filter((i) => i.id !== itemId),
    }))
  },
}))

/** Espacios en los que está compartido un registro del Vault personal. */
export function workspacesOfItem(
  items: WorkspaceItemReference[],
  workspaces: Workspace[],
  kind: SharedItemKind,
  sourceId: string,
): Workspace[] {
  const ids = new Set(
    items
      .filter(
        (item) => item.kind === kind && item.sourceId === sourceId,
      )
      .map((item) => item.workspaceId),
  )
  return workspaces.filter((workspace) => ids.has(workspace.id))
}

/** Atajo para credenciales, que es el caso más usado en las tarjetas. */
export const workspacesOfCredential = (
  items: WorkspaceItemReference[],
  workspaces: Workspace[],
  credentialId: string,
): Workspace[] => workspacesOfItem(items, workspaces, 'credential', credentialId)

/** Una sola carga por cambio de sesión; AuthContext ya resuelve getSession. */
export function useWorkspaceSync() {
  const { user } = useAuth()
  const userId = user?.id
  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (useWorkspaceStore.getState().status !== 'local') {
        void useWorkspaceStore.getState().load()
      }
      return
    }
    if (userId) void useWorkspaceStore.getState().load()
    else useWorkspaceStore.getState().reset()
  }, [userId])
}
