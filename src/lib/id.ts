/**
 * Genera un identificador único.
 * Usa crypto.randomUUID si está disponible (navegadores modernos)
 * y cae a un fallback basado en timestamp + random si no lo está.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`
}