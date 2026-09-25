import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileSpreadsheet, Loader2, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import type { VaultExcelInput } from '@/lib/vault-excel'
import {
  downloadSealedExport,
  exportFilenameBase,
  sealExport,
  triggerDownload,
} from '@/lib/vault-export'
import { toast } from '@/store/ui.store'

interface SecureExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rellena los datos ya descifrados en memoria. */
  collect: () => Promise<VaultExcelInput>
}

const MIN_PASSWORD_LENGTH = 8

/**
 * Exportación del Vault. El modo por defecto genera el .xlsx, lo cifra con una
 * contraseña que elige el usuario y descarga un sobre `.wvexport` opaco.
 *
 * El modo en texto plano existe, pero exige marcar una casilla de confirmación:
 * dejar un .xlsx con todas las claves en el disco era la mayor debilidad
 * práctica del Vault.
 */
export function SecureExportDialog({
  open,
  onOpenChange,
  collect,
}: SecureExportDialogProps) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [acceptPlain, setAcceptPlain] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPassword('')
    setConfirmation('')
    setAcceptPlain(false)
    setError(null)
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const wantsPlain = acceptPlain
    if (!wantsPlain) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(
          `Usa una contraseña de al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
        )
        return
      }
      if (password !== confirmation) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }

    setBusy(true)
    try {
      const input = await collect()
      /*
        ExcelJS pesa ~1 MB, así que se carga bajo demanda justo al exportar.
        Con un import estático entraría en el bundle inicial y lastraría cada
        visita, aunque el usuario nunca exporte.
      */
      const { buildVaultXlsx } = await import('@/lib/vault-excel')
      const bytes = await buildVaultXlsx(input)
      const base = exportFilenameBase('export')
      if (wantsPlain) {
        triggerDownload(
          new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `${base}.xlsx`,
        )
        toast.show(
          'Exportación en texto plano',
          'Borra el archivo cuando ya no lo necesites: contiene tus claves.',
        )
      } else {
        const sealed = await sealExport(bytes, password)
        downloadSealedExport(sealed, base)
        toast.success(
          'Copia cifrada descargada',
          'Sólo se abre desde Workvaul con esa contraseña.',
        )
      }
      reset()
      onOpenChange(false)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo generar la copia.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close} className="max-w-md">
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="size-4" /> Exportar copia de seguridad
          </DialogTitle>
          <DialogDescription>
            La copia sale cifrada con una contraseña que eliges tú. Si la
            olvidas, no hay forma de recuperarla.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="export-password">Contraseña de la copia</Label>
            <Input
              id="export-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="export-password-confirm">Repite la contraseña</Label>
            <Input
              id="export-password-confirm"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Repite la contraseña"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-elevated/40 p-3 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={acceptPlain}
              onChange={(e) => setAcceptPlain(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--c-primary)]"
            />
            <span>
              Descargar sin cifrar (archivo .xlsx legible).
              <span className="mt-1 flex items-start gap-1.5 text-danger">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                Contiene todas tus claves en texto plano.
              </span>
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger"
            >
              {error}
            </p>
          )}
        </DialogContent>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : acceptPlain ? (
              <FileSpreadsheet className="size-4" />
            ) : (
              <LockKeyhole className="size-4" />
            )}
            {busy
              ? 'Generando…'
              : acceptPlain
                ? 'Descargar sin cifrar'
                : 'Descargar cifrada'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}