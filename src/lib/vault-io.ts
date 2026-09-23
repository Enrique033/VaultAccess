/**
 * Exportación e importación de la bóveda en JSON (respaldo local).
 * El archivo contiene contraseñas EN TEXTO PLANO: el usuario debe
 * guardarlo en un lugar seguro.
 */
import type { Category, Credential, LinkItem, Note, VaultSection } from '@/types'

export interface VaultExportData {
  app: 'WorkVault'
  version: 1
  exportedAt: string
  sections: VaultSection[]
  categories: Category[]
  credentials: Credential[]
  links: LinkItem[]
  notes: Note[]
}

export interface VaultExportInput {
  sections: VaultSection[]
  categories: Category[]
  credentials: Credential[]
  links: LinkItem[]
  notes: Note[]
}

export function buildVaultExport(input: VaultExportInput): VaultExportData {
  return {
    app: 'WorkVault',
    version: 1,
    exportedAt: new Date().toISOString(),
    sections: input.sections,
    categories: input.categories,
    credentials: input.credentials,
    links: input.links,
    notes: input.notes,
  }
}

/** Descarga `data` como JSON con el nombre indicado. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportFilename(): string {
  const date = new Date().toISOString().slice(0, 10)
  return `workvault-respaldo-${date}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function coerceDate(value: unknown): string {
  const s = str(value)
  return s && !Number.isNaN(Date.parse(s)) ? s : new Date().toISOString()
}

function coerceSection(raw: Record<string, unknown>): VaultSection | null {
  const id = str(raw.id)
  const name = str(raw.name).trim()
  if (!id || !name) return null
  return { id, name: name.slice(0, 60) }
}

function coerceCategory(raw: Record<string, unknown>): Category | null {
  const id = str(raw.id)
  const name = str(raw.name).trim()
  const sectionId = str(raw.sectionId)
  if (!id || !name || !sectionId) return null
  return {
    id,
    name: name.slice(0, 60),
    color: str(raw.color, '#8B5CF6') || '#8B5CF6',
    sectionId,
  }
}

function coerceCredential(raw: Record<string, unknown>): Credential | null {
  const id = str(raw.id)
  const title = str(raw.title).trim()
  const username = str(raw.username)
  const password = str(raw.password)
  if (!id || !title || !username) return null
  return {
    id,
    title: title.slice(0, 80),
    username: username.slice(0, 120),
    password,
    url: strOrNull(raw.url) ?? undefined,
    categoryId: strOrNull(raw.categoryId) ?? undefined,
    notes: strOrNull(raw.notes) ?? undefined,
    favorite: Boolean(raw.favorite),
    createdAt: coerceDate(raw.createdAt),
    updatedAt: coerceDate(raw.updatedAt),
  }
}

function coerceLink(raw: Record<string, unknown>): LinkItem | null {
  const id = str(raw.id)
  const title = str(raw.title).trim()
  const url = str(raw.url).trim()
  if (!id || !title || !url) return null
  return {
    id,
    title: title.slice(0, 80),
    url: url.slice(0, 2048),
    categoryId: strOrNull(raw.categoryId) ?? undefined,
    description: strOrNull(raw.description) ?? undefined,
    favorite: Boolean(raw.favorite),
    createdAt: coerceDate(raw.createdAt),
    updatedAt: coerceDate(raw.updatedAt),
  }
}

function coerceNote(raw: Record<string, unknown>): Note | null {
  const id = str(raw.id)
  const title = str(raw.title).trim()
  if (!id || !title) return null
  return {
    id,
    title: title.slice(0, 80),
    content: str(raw.content),
    categoryId: strOrNull(raw.categoryId) ?? undefined,
    favorite: Boolean(raw.favorite),
    createdAt: coerceDate(raw.createdAt),
    updatedAt: coerceDate(raw.updatedAt),
  }
}

/** Parsea y valida un respaldo. Lanza Error con mensaje amigable si no lo es. */
export function parseVaultExport(text: string): VaultExportData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }
  if (!isRecord(raw) || raw.app !== 'WorkVault') {
    throw new Error('El archivo no parece un respaldo de WorkVault.')
  }

  const sections = records(raw.sections)
    .map(coerceSection)
    .filter((s): s is VaultSection => s !== null)
  const categories = records(raw.categories)
    .map(coerceCategory)
    .filter((c): c is Category => c !== null)
  const credentials = records(raw.credentials)
    .map(coerceCredential)
    .filter((c): c is Credential => c !== null)
  const links = records(raw.links)
    .map(coerceLink)
    .filter((l): l is LinkItem => l !== null)
  const notes = records(raw.notes)
    .map(coerceNote)
    .filter((n): n is Note => n !== null)

  if (
    sections.length === 0 &&
    categories.length === 0 &&
    credentials.length === 0 &&
    links.length === 0 &&
    notes.length === 0
  ) {
    throw new Error('El respaldo está vacío o no contiene datos reconocibles.')
  }

  return {
    app: 'WorkVault',
    version: 1,
    exportedAt: str(raw.exportedAt, new Date().toISOString()),
    sections,
    categories,
    credentials,
    links,
    notes,
  }
}