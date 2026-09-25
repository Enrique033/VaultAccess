/** Rol de un miembro dentro de un espacio de trabajo. */
export type WorkspaceRole = 'owner' | 'editor' | 'viewer'

/** Espacio compartido de trabajo (equipo). */
export interface Workspace {
  id: string
  name: string
  ownerId: string
  createdAt: string
}

/** Miembro de un espacio. `userId` ausente = invitación pendiente. */
export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId?: string
  /** Puede estar oculto por privacidad para miembros no globales. */
  email: string | null
  /** Nombre visible; si no existe, la RPC devuelve el correo. */
  displayName: string
  role: WorkspaceRole
  createdAt: string
}

/** Tipo de registro que se puede compartir en un espacio de equipo. */
export type SharedItemKind = 'credential' | 'link' | 'note'

export interface WorkspaceItemReference {
  id: string
  workspaceId: string
  kind: SharedItemKind
  /** Id del registro de origen en el Vault personal. */
  sourceId?: string
}

/** Copia compartida de un registro dentro de un espacio. */
export interface WorkspaceItem {
  id: string
  workspaceId: string
  kind: SharedItemKind
  /** Registro de origen, si sigue existiendo en el vault personal. */
  sourceId?: string
  createdBy: string
  title: string
  /** Sólo credenciales. */
  username: string
  /** Sólo credenciales. */
  password: string
  /** Credenciales y enlaces. */
  url?: string
  /** Credenciales: notas libres. */
  notes?: string
  /** Enlaces. */
  description?: string
  /** Notas. */
  content?: string
  createdAt: string
  updatedAt: string
}
