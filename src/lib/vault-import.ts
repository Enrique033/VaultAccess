/**
 * Importación de respaldos de otros gestores (CSV) y del propio Excel de
 * Workvaul (.xlsx). Todo se procesa en el navegador: el archivo no se sube
 * a ningún servidor.
 */

export type ImportFormat =
  'workvaul' | 'bitwarden' | 'chrome' | 'onepassword' | 'lastpass' | 'generic'

/** Credencial leída de un respaldo, aún sin categoría de destino. */
export interface ImportEntry {
  title: string
  username: string
  password: string
  url?: string
  notes?: string
  /** Carpeta/grupo original (Bitwarden, LastPass, KeePass…). */
  folder?: string
}

export interface ParsedImport {
  format: ImportFormat
  entries: ImportEntry[]
  /** Filas del archivo sin datos utilizables (notas, tarjetas, identidades). */
  skipped: number
  /** Carpetas detectadas, en orden de aparición. */
  folders: string[]
}

/** Formatos admitidos, en el orden que se muestran en la UI. */
export const IMPORT_FORMATS: { value: ImportFormat; label: string }[] = [
  { value: 'bitwarden', label: 'Bitwarden (.csv)' },
  { value: 'chrome', label: 'Chrome / Edge / Brave (.csv)' },
  { value: 'onepassword', label: '1Password (.csv)' },
  { value: 'lastpass', label: 'LastPass (.csv)' },
  { value: 'workvaul', label: 'Workvaul (.xlsx)' },
  { value: 'generic', label: 'Otro CSV (título, usuario, clave)' },
]

/** Marcador de celda vacía que usa la exportación de Workvaul. */
const EMPTY_MARK = '—'

/** Parsea CSV (RFC 4180): comillas dobles, campos multilínea y BOM. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  const src = text.replace(/^\uFEFF/, '')
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i]!
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\r') {
      // Ignorado: los saltos se normalizan con '\n'.
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  row.push(field)
  rows.push(row)

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

/** Deduce el separador (coma, punto y coma o tabulador) de la cabecera. */
export function sniffDelimiter(text: string): string {
  const line =
    text
      .slice(0, 4000)
      .split(/\r?\n/)
      .find((l) => l.trim() !== '') ?? ''
  const candidates = [',', ';', '\t'].map((d) => ({
    d,
    count: line.split(d).length - 1,
  }))
  candidates.sort((a, b) => b.count - a.count)
  return candidates[0]!.count > 0 ? candidates[0]!.d : ','
}

/** Cabecera normalizada: sin acentos, espacios ni signos. */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Limpia una celda: quita espacios y el marcador de vacío del export. */
function clean(value: string | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed === EMPTY_MARK ? '' : trimmed
}

/** Host de una URL, usado como título de reserva. */
function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

/* ============================================================
   Columnas: se buscan por nombre, así funcionan los CSV de varios
   gestores (y los locales en español) sin mapeo manual.
   ============================================================ */
const TITLE_KEYS = [
  'title',
  'titulo',
  'name',
  'nombre',
  'nombredelelemento',
  'elemento',
]
const USER_KEYS = [
  'username',
  'usuario',
  'loginusername',
  'user',
  'nombredeusuario',
  'email',
  'correo',
  'correoelectronico',
  'cuenta',
]
const PASS_KEYS = ['password', 'clave', 'contrasena', 'loginpassword', 'pass']
const URL_KEYS = [
  'url',
  'loginuri',
  'website',
  'web',
  'sitioweb',
  'sitio',
  'uri',
]
const NOTES_KEYS = [
  'notes',
  'notas',
  'nota',
  'extra',
  'description',
  'descripcion',
  'comment',
  'comentario',
]
const FOLDER_KEYS = [
  'folder',
  'carpeta',
  'grouping',
  'group',
  'grupo',
  'categoria',
  'category',
  'coleccion',
]

/** Deduce el gestor de origen a partir de las cabeceras. */
export function detectFormat(headers: string[]): ImportFormat {
  const set = new Set(headers)
  const has = (...names: string[]) => names.some((name) => set.has(name))

  if (has('clave') && has('usuario')) return 'workvaul'
  if (has('loginuri', 'loginusername', 'loginpassword')) return 'bitwarden'
  if (has('extra') && has('grouping')) return 'lastpass'
  if (has('otp') || (has('title') && has('url') && has('username')))
    return 'onepassword'
  if (has('name') && has('url') && has('username') && has('password'))
    return 'chrome'
  return 'generic'
}

/**
 * Convierte filas en entradas de credencial. Las filas sin clave
 * (notas, tarjetas, identidades) se cuentan como omitidas.
 */
export function entriesFromRows(
  headers: string[],
  rows: string[][],
  format: ImportFormat,
): ParsedImport {
  const indexOf = (aliases: string[]) =>
    headers.findIndex((header) => aliases.includes(header))
  const titleAt = indexOf(TITLE_KEYS)
  const userAt = indexOf(USER_KEYS)
  const passAt = indexOf(PASS_KEYS)
  const urlAt = indexOf(URL_KEYS)
  const notesAt = indexOf(NOTES_KEYS)
  const folderAt = indexOf(FOLDER_KEYS)

  const at = (row: string[], index: number) =>
    index >= 0 ? clean(row[index]) : ''

  const entries: ImportEntry[] = []
  const folders: string[] = []
  let skipped = 0

  for (const row of rows) {
    const password = at(row, passAt)
    const rawUrl = at(row, urlAt)
    const username = at(row, userAt)
    const rawTitle = at(row, titleAt)

    if (!password || (!rawTitle && !rawUrl && !username)) {
      skipped += 1
      continue
    }

    // Solo se conservan URLs http(s); el resto pasa a notas para no perderlo.
    const isHttp = /^https?:\/\//i.test(rawUrl)
    const notesParts: string[] = []
    if (rawUrl && !isHttp) notesParts.push(`Enlace: ${rawUrl}`)
    const notes = at(row, notesAt)
    if (notes) notesParts.push(notes)

    const folder = at(row, folderAt) || undefined
    if (folder && !folders.includes(folder)) folders.push(folder)

    entries.push({
      title: (rawTitle || hostOf(rawUrl) || username || 'Sin título').slice(
        0,
        80,
      ),
      username: (username || 'Sin usuario').slice(0, 120),
      password,
      url: isHttp ? rawUrl : undefined,
      notes: notesParts.length > 0 ? notesParts.join('\n\n') : undefined,
      folder,
    })
  }

  return { format, entries, skipped, folders }
}

/** Parsea el texto de un CSV/TSV de respaldo. */
export function parseVaultText(
  text: string,
  formatHint?: ImportFormat,
): ParsedImport {
  const rows = parseCsv(text, sniffDelimiter(text))
  if (rows.length < 2) {
    return {
      format: formatHint ?? 'generic',
      entries: [],
      skipped: 0,
      folders: [],
    }
  }
  const [headerRow, ...body] = rows
  const headers = headerRow!.map(normalizeHeader)
  return entriesFromRows(headers, body, formatHint ?? detectFormat(headers))
}

/** Lee un respaldo (.csv/.txt/.xlsx/.xlsm) y devuelve las entradas. */
export async function readVaultFile(
  file: File,
  formatHint?: ImportFormat,
): Promise<ParsedImport> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xlsm'))
    return readWorkbook(file)
  return parseVaultText(await file.text(), formatHint)
}

/** Extrae la hoja "Credenciales" del Excel exportado por Workvaul. */
async function readWorkbook(file: File): Promise<ParsedImport> {
  // Carga diferida: ExcelJS solo se evalúa aquí (módulo compartido con la
  // exportación a Excel, así que no añade peso extra al bundle).
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const data = (await file.arrayBuffer()) as unknown as Parameters<
    typeof workbook.xlsx.load
  >[0]
  await workbook.xlsx.load(data)

  const empty: ParsedImport = {
    format: 'workvaul',
    entries: [],
    skipped: 0,
    folders: [],
  }
  const sheet = workbook.getWorksheet('Credenciales') ?? workbook.worksheets[0]
  if (!sheet) return empty

  const rows: string[][] = []
  sheet.eachRow((row) => {
    const cells: string[] = []
    for (let column = 1; column <= row.cellCount; column += 1) {
      const value = row.getCell(column).value
      cells.push(value === null || value === undefined ? '' : String(value))
    }
    rows.push(cells)
  })

  const [headerRow, ...body] = rows
  if (!headerRow) return empty
  return entriesFromRows(headerRow.map(normalizeHeader), body, 'workvaul')
}
