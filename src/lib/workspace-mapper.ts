import type {
  SharedItemKind,
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
  item_kind?: string | null
  credential_id: string | null
  link_id?: string | null
  note_id?: string | null
}

/** Fila de `vault_workspace_items` en Supabase. */
export interface WorkspaceItemRow {
  id: string
  workspace_id: string
  item_kind?: string | null
  credential_id: string | null
  link_id?: string | null
  note_id?: string | null
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

/** Normaliza el tipo guardado y el id del registro de origen. */
export function originOf(row: {
  item_kind?: string | null
  credential_id: string | null
  link_id?: string | null
  note_id?: string | null
}): { kind: SharedItemKind; sourceId?: string } {
  if (row.item_kind === 'link' || (!row.item_kind && row.link_id))
    return { kind: 'link', sourceId: row.link_id ?? undefined }
  if (row.item_kind === 'note' || (!row.item_kind && row.note_id))
    return { kind: 'note', sourceId: row.note_id ?? undefined }
  return { kind: 'credential', sourceId: row.credential_id ?? undefined }
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
  const { kind, sourceId } = originOf(row)
  return { id: row.id, workspaceId: row.workspace_id, kind, sourceId }
}

export function toWorkspaceItem(row: WorkspaceItemRow): WorkspaceItem {
  const { kind, sourceId } = originOf(row)
  if (typeof row.title !== 'string') {
    throw new Error('No se pudo descifrar el elemento compartido.')
  }
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind,
    sourceId,
    createdBy: row.created_by,
    title: row.title,
    username: row.username ?? '',
    password: row.password ?? '',
    url: row.url ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
