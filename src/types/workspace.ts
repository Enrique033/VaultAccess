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

/** Copia compartida de una credencial dentro de un espacio. */
export interface WorkspaceItem {
  id: string
  workspaceId: string
  /** Credencial de origen, si sigue existiendo en el vault personal. */
  credentialId?: string
  createdBy: string
  title: string
  username: string
  password: string
  url?: string
  notes?: string
  createdAt: string
  updatedAt: string
}
