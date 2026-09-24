/**
 * Exportación de los datos a Excel (.xlsx) con ExcelJS.
 * El archivo contiene claves EN TEXTO PLANO: el usuario debe
 * guardarlo en un lugar seguro.
 */
import ExcelJS from 'exceljs'
import type { Row, Workbook } from 'exceljs'
import type {
  Category,
  Credential,
  LinkItem,
  Note,
  VaultSection,
} from '@/types'

/** Datos necesarios para generar el .xlsx. */
export interface VaultExcelInput {
  sections: VaultSection[]
  categories: Category[]
  credentials: Credential[]
  links: LinkItem[]
  notes: Note[]
}

const HEADER_FILL = 'FF2563EB'
const KPI_FILL = 'FFEFF6FF'
const MUTED = 'FF6B7280'
/** Marcador para celdas vacías. */
const EMPTY = '—'

/** Estiliza una fila como cabecera: fondo azul y texto blanco en negrita. */
function styleHeader(row: Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    }
  })
}

/** Hoja de detalle: columnas con ancho, cabecera congelada y autofiltro. */
function detailSheet(
  wb: Workbook,
  name: string,
  columns: { header: string; width: number }[],
  rows: (string | number | boolean)[][],
): void {
  const sheet = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }],
  })
  sheet.columns = columns.map((c) => ({ width: c.width }))
  const header = sheet.getRow(1)
  columns.forEach((c, i) => {
    header.getCell(i + 1).value = c.header
  })
  styleHeader(header)
  for (const values of rows) sheet.addRow(values)
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }
}

/** Genera el .xlsx y lo descarga al instante. */
export async function exportVaultToExcel(
  input: VaultExcelInput,
): Promise<void> {
  const { sections, categories, credentials, links, notes } = input

  const wb = new ExcelJS.Workbook()
  wb.creator = 'VaultAccess'
  wb.created = new Date()

  const catById = new Map(categories.map((c) => [c.id, c]))
  const secById = new Map(sections.map((s) => [s.id, s]))

  /** Texto o "—" cuando el valor viene vacío. */
  const place = (value: string | undefined): string => {
    const v = value?.trim() ?? ''
    return v.length > 0 ? v : EMPTY
  }
  /** Sección de la categoría del elemento ('' = sin sección). */
  const secIdOf = (categoryId: string | undefined): string =>
    (categoryId && catById.get(categoryId)?.sectionId) || ''
  /** Ordena por actualización descendente (lo más reciente primero). */
  const sorted = <T extends { updatedAt: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  /** Nombre de la sección o "Sin sección". */
  const bySec = (sectionId: string): string =>
    (sectionId && secById.get(sectionId)?.name) || 'Sin sección'

  // ---- Dashboard: KPIs + tablas por sección y por categoría ----
  const dash = wb.addWorksheet('Dashboard', {
    views: [{ state: 'frozen', ySplit: 3 }],
  })
  dash.columns = [
    { width: 30 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ]

  dash.mergeCells('A1:F1')
  const title = dash.getCell('A1')
  title.value = `VaultAccess — Dashboard · ${new Date().toLocaleDateString('es-ES')}`
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  title.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: HEADER_FILL },
  }
  title.alignment = { vertical: 'middle' }
  dash.getRow(1).height = 24

  const kpiLabels = [
    'Secciones',
    'Categorías',
    'Credenciales',
    'Enlaces',
    'Notas',
  ]
  const kpiValues = [
    sections.length,
    categories.length,
    credentials.length,
    links.length,
    notes.length,
  ]
  kpiLabels.forEach((label, i) => {
    const head = dash.getRow(2).getCell(i + 1)
    head.value = label
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    head.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    }
    head.alignment = { horizontal: 'center' }
    const value = dash.getRow(3).getCell(i + 1)
    value.value = kpiValues[i]
    value.font = { bold: true, size: 13 }
    value.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: KPI_FILL },
    }
    value.alignment = { horizontal: 'center' }
  })

  const inSection = (items: { categoryId?: string }[], secId: string): number =>
    items.filter((it) => secIdOf(it.categoryId) === secId).length
  const inCategory = (
    items: { categoryId?: string }[],
    catId: string,
  ): number => items.filter((it) => it.categoryId === catId).length
  const uncategorized = (items: { categoryId?: string }[]): number =>
    items.filter((it) => !it.categoryId).length

  let cursor = 5
  const subtitle = (text: string): void => {
    const cell = dash.getRow(cursor).getCell(1)
    cell.value = text
    cell.font = { bold: true, size: 12 }
    cursor += 1
  }
  const headRow = (headers: string[]): void => {
    const row = dash.getRow(cursor)
    headers.forEach((h, i) => {
      row.getCell(i + 1).value = h
    })
    styleHeader(row)
    cursor += 1
  }

  subtitle('Por sección')
  headRow(['Sección', 'Credenciales', 'Enlaces', 'Notas', 'Total'])
  for (const secId of [...sections.map((s) => s.id), '']) {
    const a = inSection(credentials, secId)
    const b = inSection(links, secId)
    const c = inSection(notes, secId)
    const row = dash.getRow(cursor)
    cursor += 1
    row.values = [bySec(secId), a, b, c, a + b + c]
    if (!secId) row.getCell(1).font = { italic: true, color: { argb: MUTED } }
  }

  cursor += 1
  subtitle('Por categoría')
  headRow(['Categoría', 'Sección', 'Credenciales', 'Enlaces', 'Notas'])

  const hexRe = /^#[0-9a-f]{6}$/i
  const argbOf = (hex: string): string =>
    hexRe.test(hex) ? 'FF' + hex.slice(1).toUpperCase() : HEADER_FILL
  const darkText = (hex: string): boolean => {
    if (!hexRe.test(hex)) return false
    const h = hex.slice(1)
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
  }
  for (const cat of categories) {
    const row = dash.getRow(cursor)
    cursor += 1
    row.values = [
      cat.name,
      bySec(cat.sectionId),
      inCategory(credentials, cat.id),
      inCategory(links, cat.id),
      inCategory(notes, cat.id),
    ]
    const cell = row.getCell(1)
    cell.font = {
      bold: true,
      color: { argb: darkText(cat.color) ? 'FF111827' : 'FFFFFFFF' },
    }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argbOf(cat.color) },
    }
  }
  const noCatRow = dash.getRow(cursor)
  noCatRow.values = [
    'Sin categoría',
    EMPTY,
    uncategorized(credentials),
    uncategorized(links),
    uncategorized(notes),
  ]
  noCatRow.getCell(1).font = { italic: true, color: { argb: MUTED } }

  // ---- Hojas de detalle: credenciales, enlaces y notas ----
  const fmtDate = (iso: string): string => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? EMPTY : d.toLocaleString('es-ES')
  }
  const catName = (categoryId?: string): string =>
    (categoryId && catById.get(categoryId)?.name) || EMPTY
  const yesNo = (value: boolean): string => (value ? 'Sí' : 'No')

  detailSheet(
    wb,
    'Credenciales',
    [
      { header: 'Título', width: 28 },
      { header: 'Usuario', width: 26 },
      { header: 'Clave', width: 24 },
      { header: 'URL', width: 36 },
      { header: 'Categoría', width: 18 },
      { header: 'Sección', width: 16 },
      { header: 'Notas', width: 40 },
      { header: 'Favorito', width: 10 },
      { header: 'Creada', width: 20 },
      { header: 'Actualizada', width: 20 },
    ],
    sorted(credentials).map((c) => [
      place(c.title),
      place(c.username),
      c.password,
      place(c.url),
      catName(c.categoryId),
      bySec(secIdOf(c.categoryId)),
      place(c.notes),
      yesNo(c.favorite),
      fmtDate(c.createdAt),
      fmtDate(c.updatedAt),
    ]),
  )

  detailSheet(
    wb,
    'Enlaces',
    [
      { header: 'Título', width: 28 },
      { header: 'URL', width: 44 },
      { header: 'Descripción', width: 40 },
      { header: 'Categoría', width: 18 },
      { header: 'Sección', width: 16 },
      { header: 'Favorito', width: 10 },
      { header: 'Creada', width: 20 },
      { header: 'Actualizada', width: 20 },
    ],
    sorted(links).map((l) => [
      place(l.title),
      place(l.url),
      place(l.description),
      catName(l.categoryId),
      bySec(secIdOf(l.categoryId)),
      yesNo(l.favorite),
      fmtDate(l.createdAt),
      fmtDate(l.updatedAt),
    ]),
  )

  detailSheet(
    wb,
    'Notas',
    [
      { header: 'Título', width: 28 },
      { header: 'Contenido', width: 60 },
      { header: 'Categoría', width: 18 },
      { header: 'Sección', width: 16 },
      { header: 'Favorito', width: 10 },
      { header: 'Creada', width: 20 },
      { header: 'Actualizada', width: 20 },
    ],
    sorted(notes).map((n) => [
      place(n.title),
      place(n.content),
      catName(n.categoryId),
      bySec(secIdOf(n.categoryId)),
      yesNo(n.favorite),
      fmtDate(n.createdAt),
      fmtDate(n.updatedAt),
    ]),
  )

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `vaultaccess-${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
