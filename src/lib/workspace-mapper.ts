import type {
  Workspace,
  WorkspaceItem,
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
  email: string
  role: WorkspaceRole
  created_at: string
}

/** Fila de `vault_workspace_items` en Supabase. */
export interface WorkspaceItemRow {
  id: string
  workspace_id: string
  credential_id: string | null
  created_by: string
  title: string
  username: string
  password: string
  url: string | null
  notes: string | null
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
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id ?? undefined,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  }
}

export function toWorkspaceItem(row: WorkspaceItemRow): WorkspaceItem {
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
