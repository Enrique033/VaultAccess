/** Versión anterior de la clave de una credencial. */
export interface PasswordHistoryEntry {
  id: string
  credentialId: string
  password: string
  /** Fecha del cambio, en ISO 8601. */
  changedAt: string
}
