import { useEffect } from 'react'
import { create } from 'zustand'
import { useAuth } from '@/app/auth-context'
import { isSupabaseConfigured, requireUserId, supabase } from '@/lib/supabase'
import {
  toWorkspace,
  toWorkspaceItem,
  toWorkspaceMember,
  toWorkspaceItemReference,
} from '@/lib/workspace-mapper'
import type {
  WorkspaceItemReferenceRow,
  WorkspaceItemRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from '@/lib/workspace-mapper'
import type { Credential } from '@/types'
import type {
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
  if (/relation .* does not exist|schema cache/i.test(message))
    return 'Faltan las tablas de equipos. Ejecuta supabase/schema-sharing.sql en el SQL Editor de Supabase.'
  if (/row-level security/i.test(message))
    return `Supabase bloqueó la operación (RLS). Revisa que ejecutaste supabase/schema-sharing.sql y que iniciaste sesión. Detalle: ${message}`
  if (/Failed to fetch|NetworkError|network/i.test(message))
    return 'Sin conexión con Supabase. Revisa tu internet o la URL del proyecto.'
  if (/duplicate key/i.test(message))
    return 'Ese correo ya forma parte del espacio.'
  return message
}

const WORKSPACE_COLUMNS = 'id, owner_id, name, created_at'
const ITEM_REFERENCE_COLUMNS = 'id, workspace_id, credential_id'
const ITEM_COLUMNS =
  'id, workspace_id, credential_id, created_by, title, username, password, url, notes, created_at, updated_at'

function isMissingRpcError(message: string): boolean {
  return /PGRST202|schema cache|function .*does not exist|could not find the function/i.test(
    message,
  )
}

let workspaceLoadGeneration = 0
let workspaceItemsGeneration = 0

/** Copia el dato de una credencial al formato de elemento compartido. */
function itemPayload(credential: Credential) {
  return {
    title: credential.title,
    username: credential.username,
    password: credential.password,
    url: credential.url ?? null,
    notes: credential.notes ?? null,
  }
}

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

  /** Comparte una credencial (crea o actualiza su copia en el espacio). */
  shareCredential: (
    workspaceId: string,
    credential: Credential,
  ) => Promise<void>
  /** Vuelve a subir los datos actuales de la credencial a la copia. */
  updateSharedItem: (itemId: string, credential: Credential) => Promise<void>
  removeSharedItem: (itemId: string) => Promise<void>
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
      if (generation !== workspaceLoadGeneration) return
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
      if (generation !== workspaceLoadGeneration) return
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
    const { data, error } = await supabase
      .from('vault_workspace_items')
      .select(ITEM_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
    if (generation !== workspaceItemsGeneration) return
    if (error) {
      set({
        itemsLoading: false,
        itemsError: friendlyWorkspaceError(error.message),
      })
      return
    }
    set({
      items: ((data ?? []) as WorkspaceItemRow[]).map(toWorkspaceItem),
      itemsWorkspaceId: workspaceId,
      itemsLoading: false,
      itemsError: null,
    })
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
          '[WorkVault] No se pudo registrar al propietario como miembro:',
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
    const { error } = await supabase
      .from('vault_workspace_members')
      .delete()
      .eq('id', memberId)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    set((s) => ({ members: s.members.filter((m) => m.id !== memberId) }))
  },

  shareCredential: async (workspaceId, credential) => {
    const userId = await requireUserId()
    const existing = get().itemReferences.find(
      (item) =>
        item.workspaceId === workspaceId && item.credentialId === credential.id,
    )
    const request = existing
      ? supabase
          .from('vault_workspace_items')
          .update(itemPayload(credential))
          .eq('id', existing.id)
          .select()
          .single()
      : supabase
          .from('vault_workspace_items')
          .insert({
            ...itemPayload(credential),
            workspace_id: workspaceId,
            credential_id: credential.id,
            created_by: userId,
          })
          .select()
          .single()

    const { data, error } = await request
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    const item = toWorkspaceItem(data as WorkspaceItemRow)
    const reference = toWorkspaceItemReference({
      id: item.id,
      workspace_id: item.workspaceId,
      credential_id: item.credentialId ?? null,
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

  updateSharedItem: async (itemId, credential) => {
    const { data, error } = await supabase
      .from('vault_workspace_items')
      .update(itemPayload(credential))
      .eq('id', itemId)
      .select()
      .single()
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    const item = toWorkspaceItem(data as WorkspaceItemRow)
    set((s) => ({
      items:
        s.itemsWorkspaceId === item.workspaceId
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

/** Espacios en los que está compartida una credencial. */
export function workspacesOfCredential(
  items: WorkspaceItemReference[],
  workspaces: Workspace[],
  credentialId: string,
): Workspace[] {
  const ids = new Set(
    items
      .filter((item) => item.credentialId === credentialId)
      .map((item) => item.workspaceId),
  )
  return workspaces.filter((workspace) => ids.has(workspace.id))
}

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
