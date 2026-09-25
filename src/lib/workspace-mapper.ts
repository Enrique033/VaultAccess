import type {
  Workspace,
  WorkspaceItem,
  WorkspaceItemReference,
  WorkspaceMember,
  WorkspaceRole,
} from '@/types'

/** Fila de `vault_workspaces` en Supabase. */
export interface WorkspaceRow {
  id: string
  owner_id: string
  name: string
  created_at: string
}

/** Fila de `vault_workspace_members` en Supabase. */
export interface WorkspaceMemberRow {
  id: string
  workspace_id: string
  user_id: string | null
  email: string | null
  display_name?: string | null
  role: WorkspaceRole
  created_at: string
}

export interface WorkspaceItemReferenceRow {
  id: string
  workspace_id: string
  credential_id: string | null
}

/** Fila de `vault_workspace_items` en Supabase. */
export interface WorkspaceItemRow {
  id: string
  workspace_id: string
  credential_id: string | null
  created_by: string
  title?: string | null
  username?: string | null
  password?: string | null
  url?: string | null
  notes?: string | null
  encrypted_payload?: string | null
  created_at: string
  updated_at: string
}

export function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at,
  }
}

export function toWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
  const displayName = row.display_name || row.email || 'Invitado'
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? undefined,
    email: row.email,
    displayName,
    role: row.role,
    createdAt: row.created_at,
  }
}

export function toWorkspaceItemReference(
  row: WorkspaceItemReferenceRow,
): WorkspaceItemReference {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    credentialId: row.credential_id ?? undefined,
  }
}

export function toWorkspaceItem(row: WorkspaceItemRow): WorkspaceItem {
  if (typeof row.title !== 'string' || typeof row.username !== 'string' || typeof row.password !== 'string') {
    throw new Error('No se pudo descifrar el elemento compartido.')
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    credentialId: row.credential_id ?? undefined,
    createdBy: row.created_by,
    title: row.title,
    username: row.username,
    password: row.password,
    url: row.url ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
