import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { CategorySelect } from '@/components/credentials/CategorySelect'
import { useVaultStore } from '@/store/vault.store'
import { toast } from '@/store/ui.store'
import {
  IMPORT_FORMATS,
  readVaultFile,
  type ImportFormat,
  type ParsedImport,
} from '@/lib/vault-import'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormatChoice = 'auto' | ImportFormat

const optionRow = 'flex cursor-pointer items-center gap-2 text-xs text-muted'

/**
 * Importa credenciales desde un respaldo (Bitwarden, Chrome, 1Password,
 * LastPass o el propio Excel de Workvaul). Todo ocurre en el navegador.
 */
export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const allCategories = useVaultStore((s) => s.categories)
  const sections = useVaultStore((s) => s.sections)
  const addCategory = useVaultStore((s) => s.addCategory)
  const addSection = useVaultStore((s) => s.addSection)
  const importCredentials = useVaultStore((s) => s.importCredentials)

  /** La importación crea credenciales: sólo se reutilizan columnas de Access. */
  const categories = useMemo(
    () => allCategories.filter((category) => category.module === 'credential'),
    [allCategories],
  )

  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<FormatChoice>('auto')
  const [parsed, setParsed] = useState<ParsedImport | null>(null)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [createCategories, setCreateCategories] = useState(true)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    created: number
    skipped: number
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Cada vez que se cierra, el diálogo vuelve a nacer limpio.
  useEffect(() => {
    if (open) return
    setFile(null)
    setFormat('auto')
    setParsed(null)
    setError(null)
    setResult(null)
    setCategoryId('')
    setCreateCategories(true)
    setSkipDuplicates(true)
  }, [open])

  // Lectura del archivo (se repite si el usuario cambia el formato a mano).
  useEffect(() => {
    if (!file) return
    let cancelled = false
    setReading(true)
    setError(null)
    readVaultFile(file, format === 'auto' ? undefined : format)
      .then((data) => {
        if (cancelled) return
        setParsed(data)
        if (data.entries.length === 0) {
          setError(
            'No se encontraron credenciales utilizables. Prueba a elegir otro formato de origen.',
          )
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(
          'No se pudo leer el archivo. Revisa el formato e inténtalo de nuevo.',
        )
      })
      .finally(() => {
        if (!cancelled) setReading(false)
      })
    return () => {
      cancelled = true
    }
  }, [file, format])

  const handleFiles = (files: FileList | null) => {
    const next = files?.[0]
    if (!next) return
    setResult(null)
    setParsed(null)
    setFile(next)
  }

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
  }

  const detectedLabel =
    parsed && parsed.format !== 'generic'
      ? IMPORT_FORMATS.find((f) => f.value === parsed.format)?.label
      : undefined

  const handleImport = async () => {
    if (!parsed || parsed.entries.length === 0) return
    setImporting(true)
    try {
      // Carpetas del respaldo → categorías (creadas una sola vez por nombre).
      const folderToCategory = new Map<string, string>()
      if (createCategories && parsed.folders.length > 0) {
        for (const folder of parsed.folders) {
          const existing = categories.find(
            (c) => c.name.toLowerCase() === folder.toLowerCase(),
          )
          if (existing) {
            folderToCategory.set(folder, existing.id)
            continue
          }
          const sectionId =
            sections[0]?.id ?? (await addSection('Importado')).id
          // La importación es de credenciales, así que sus carpetas se crean
          // como columnas de Access y no se mezclan con Links ni Notas.
          const created = await addCategory({
            name: folder,
            sectionId,
            module: 'credential',
          })
          folderToCategory.set(folder, created.id)
        }
      }

      const items = parsed.entries.map((entry) => ({
        title: entry.title.trim(),
        username: entry.username.trim(),
        password: entry.password,
        url: entry.url,
        notes: entry.notes,
        categoryId:
          (entry.folder ? folderToCategory.get(entry.folder) : undefined) ??
          (categoryId || undefined),
      }))

      const res = await importCredentials(items, { skipDuplicates })
      setResult(res)
      toast.success(
        `${res.created} credencial${res.created === 1 ? '' : 'es'} importada${res.created === 1 ? '' : 's'}`,
        res.skipped > 0 ? `${res.skipped} omitidas por duplicadas.` : undefined,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogHeader>
        <div>
          <DialogTitle>Importar respaldo</DialogTitle>
          <DialogDescription>
            Sube un CSV de Bitwarden, Chrome, 1Password o LastPass, o el Excel
            exportado desde Workvaul. El archivo se procesa en tu navegador.
          </DialogDescription>
        </div>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
      </DialogHeader>

      <DialogContent className="space-y-4">
        {/* Zona de archivo (clic o arrastrar y soltar) */}
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-center transition-colors duration-150 hover:border-primary/40 hover:bg-elevated"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xlsm"
            onChange={onPick}
            className="hidden"
          />
          {file ? (
            <>
              <FileSpreadsheet className="size-5 text-primary" />
              <span className="max-w-full truncate text-[13px] font-medium text-foreground">
                {file.name}
              </span>
              <span className="text-[11px] text-muted">
                {reading
                  ? 'Leyendo archivo…'
                  : 'Pulsa para elegir otro archivo'}
              </span>
            </>
          ) : (
            <>
              <Upload className="size-5 text-muted" />
              <span className="text-[13px] font-medium text-foreground">
                Arrastra el archivo o pulsa para seleccionarlo
              </span>
              <span className="text-[11px] text-muted">.csv, .txt, .xlsx</span>
            </>
          )}
        </label>

        {/* Origen del respaldo */}
        <div className="space-y-1.5">
          <Label htmlFor="import-format">Origen del respaldo</Label>
          <Select
            id="import-format"
            value={format}
            onChange={(v) => setFormat(v as FormatChoice)}
            options={[
              { value: 'auto', label: 'Detectar automáticamente' },
              ...IMPORT_FORMATS.map((item) => ({
                value: item.value,
                label: item.label,
              })),
            ]}
          />
          {detectedLabel && (
            <p className="text-[11px] text-muted">Detectado: {detectedLabel}</p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {parsed && parsed.entries.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-md border border-border bg-elevated px-2 py-1">
                {parsed.entries.length} credencial
                {parsed.entries.length === 1 ? '' : 'es'}
              </span>
              {parsed.skipped > 0 && (
                <span className="rounded-md border border-border bg-elevated px-2 py-1">
                  {parsed.skipped} fila{parsed.skipped === 1 ? '' : 's'} sin
                  clave
                </span>
              )}
              {parsed.folders.length > 0 && (
                <span className="rounded-md border border-border bg-elevated px-2 py-1">
                  {parsed.folders.length} carpeta
                  {parsed.folders.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <ul className="max-h-40 overflow-y-auto rounded-xl border border-border">
              {parsed.entries.slice(0, 8).map((entry, index) => (
                <li
                  key={`${entry.title}-${index}`}
                  className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[13px] last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {entry.title}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {entry.username}
                  </span>
                </li>
              ))}
              {parsed.entries.length > 8 && (
                <li className="px-3 py-1.5 text-[11px] text-muted">
                  y {parsed.entries.length - 8} más…
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Opciones de importación */}
        {parsed && parsed.entries.length > 0 && !result && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="import-category">Categoría de destino</Label>
              <CategorySelect
                id="import-category"
                value={categoryId}
                onChange={setCategoryId}
                module="credential"
              />
              <p className="text-[11px] text-muted">
                Se aplica a lo que no traiga carpeta propia.
              </p>
            </div>

            <label className={optionRow}>
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="size-3.5 accent-primary"
              />
              Omitir duplicados (mismo título y usuario)
            </label>

            {parsed.folders.length > 0 && (
              <label className={optionRow}>
                <input
                  type="checkbox"
                  checked={createCategories}
                  onChange={(e) => setCreateCategories(e.target.checked)}
                  className="size-3.5 accent-primary"
                />
                Crear una categoría por carpeta del respaldo (
                {parsed.folders.length})
              </label>
            )}
          </div>
        )}

        {/* Resumen final */}
        {result && (
          <div className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-xs leading-relaxed text-success">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {result.created} credencial
              {result.created === 1 ? '' : 'es'} importada
              {result.created === 1 ? '' : 's'}
              {result.skipped > 0
                ? ` · ${result.skipped} duplicadas omitidas`
                : ''}
              .
            </span>
          </div>
        )}
      </DialogContent>

      <DialogFooter>
        {result ? (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setResult(null)
                setParsed(null)
                setFile(null)
                inputRef.current?.click()
              }}
            >
              Importar otro archivo
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              disabled={
                !parsed || parsed.entries.length === 0 || reading || importing
              }
              onClick={() => void handleImport()}
            >
              {importing
                ? 'Importando…'
                : `Importar ${parsed?.entries.length ?? 0}`}
            </Button>
          </>
        )}
      </DialogFooter>
    </Dialog>
  )
}
