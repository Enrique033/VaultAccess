import { useEffect } from 'react'
import { create } from 'zustand'
import { isSupabaseConfigured, requireUserId, supabase } from '@/lib/supabase'
import {
  toWorkspace,
  toWorkspaceItem,
  toWorkspaceMember,
} from '@/lib/workspace-mapper'
import type {
  WorkspaceItemRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from '@/lib/workspace-mapper'
import type { Credential } from '@/types'
import type {
  Workspace,
  WorkspaceItem,
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
  /** Espacio seleccionado en la vista de equipos. */
  activeId: string | null
  status: WorkspaceStatus
  error: string | null

  /** Carga espacios, miembros y elementos del usuario logueado. */
  load: () => Promise<void>
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
  activeId: null,
  status: isSupabaseConfigured ? 'idle' : 'local',
  error: null,

  load: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'local', error: null })
      return
    }
    set({ status: 'loading', error: null })
    try {
      // Reclama invitaciones pendientes dirigidas a mi email (si existe la
      // función). Si falla, la consulta siguiente dará el error explicado.
      await supabase.rpc('claim_workspace_invites')

      const [wsRes, memRes, itemRes] = await Promise.all([
        supabase.from('vault_workspaces').select('*').order('created_at'),
        supabase.rpc('list_workspace_members'),
        supabase
          .from('vault_workspace_items')
          .select('*')
          .order('updated_at', { ascending: false }),
      ])
      const firstError = wsRes.error ?? memRes.error ?? itemRes.error
      if (firstError)
        throw new Error(friendlyWorkspaceError(firstError.message))

      const workspaces = (wsRes.data ?? []).map((row) =>
        toWorkspace(row as WorkspaceRow),
      )
      set((s) => ({
        workspaces,
        members: (memRes.data ?? []).map((row: WorkspaceMemberRow) =>
          toWorkspaceMember(row),
        ),
        items: (itemRes.data ?? []).map((row) =>
          toWorkspaceItem(row as WorkspaceItemRow),
        ),
        status: 'ready',
        error: null,
        activeId:
          s.activeId && workspaces.some((w) => w.id === s.activeId)
            ? s.activeId
            : (workspaces[0]?.id ?? null),
      }))
    } catch (e) {
      set({
        status: 'error',
        error: e instanceof Error ? e.message : 'Error al cargar los espacios.',
      })
    }
  },

  setActive: (activeId) => set({ activeId }),

  reset: () =>
    set({
      workspaces: [],
      members: [],
      items: [],
      activeId: null,
      status: 'idle',
      error: null,
    }),

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

    // Best effort: notifica al invitado por email con un enlace mágico. Al
    // abrirlo crea/entra con ese correo y `claim_workspace_invites` le
    // adjudica la invitación pendiente. No anula la invitación si falla.
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/equipos`,
      },
    })
    if (otpError)
      throw new Error(
        'Invitación registrada, pero no se pudo enviar el email. Activa el ' +
          'proveedor Email en Supabase Auth (SMTP o remitente por defecto) y ' +
          `vuelve a invitar. Detalle: ${friendlyWorkspaceError(otpError.message)}`,
      )
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
    const existing = get().items.find(
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
    set((s) => ({ items: [item, ...s.items.filter((i) => i.id !== item.id)] }))
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
    set((s) => ({ items: s.items.map((i) => (i.id === itemId ? item : i)) }))
  },

  removeSharedItem: async (itemId) => {
    const { error } = await supabase
      .from('vault_workspace_items')
      .delete()
      .eq('id', itemId)
    if (error) throw new Error(friendlyWorkspaceError(error.message))
    set((s) => ({ items: s.items.filter((i) => i.id !== itemId) }))
  },
}))

/** Espacios en los que está compartida una credencial. */
export function workspacesOfCredential(
  items: WorkspaceItem[],
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

/** Sincroniza los espacios con la sesión: carga al entrar, limpia al salir. */
export function useWorkspaceSync() {
  useEffect(() => {
    let cancelled = false
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return
        if (session) void useWorkspaceStore.getState().load()
        else useWorkspaceStore.getState().reset()
      },
    )
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (data.session) void useWorkspaceStore.getState().load()
      else useWorkspaceStore.getState().reset()
    })
    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [])
}
