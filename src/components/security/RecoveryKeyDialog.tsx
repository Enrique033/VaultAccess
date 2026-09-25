import { useState } from 'react'
import { Check, Copy, KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { Label } from '@/components/ui/Label'
import { useVaultKey } from '@/app/vault-key-context'
import { toast } from '@/store/ui.store'
import { copyToClipboard } from '@/lib/clipboard'
import {
  formatRecoveryWords,
  parseRecoveryInput,
  RECOVERY_WORD_COUNT,
} from '@/lib/vault-recovery'

const errorBox =
  'rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-xs text-danger'

interface RecoveryKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Clave de recuperación: 12 palabras que permiten recuperar el Vault si se
 * olvida la frase maestra.
 *
 * El patrón es el de una cartera BIP-39: la app genera las palabras, el
 * usuario las anota, y sólo después se guarda en el servidor una copia de la
 * clave AES cifrada con ellas. El servidor nunca ve las palabras.
 *
 * Se exige marcar la casilla de "ya las he anotado" porque ése es el único
 * punto en que el usuario tiene una copia. Si cierra antes, no queda nada
 * guardado y puede volver a generar otro juego sin perder nada.
 */
export function RecoveryKeyDialog({
  open,
  onOpenChange,
}: RecoveryKeyDialogProps) {
  const { prepareRecoveryKey, confirmRecoveryKey, cancelRecoveryKey } =
    useVaultKey()
  const [words, setWords] = useState<string[] | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setWords(null)
    setConfirmed(false)
    setCopied(false)
    setError(null)
    cancelRecoveryKey()
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      setWords(await prepareRecoveryKey())
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudieron generar las palabras.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleCopy = async () => {
    if (!words) return
    try {
      await copyToClipboard(formatRecoveryWords(words))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('No se pudo copiar. Anota las palabras a mano.')
    }
  }

  const save = async () => {
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      await confirmRecoveryKey()
      toast.success(
        'Clave de recuperación guardada',
        'Guárdala fuera del ordenador: si la pierdes, no habrá recuperación.',
      )
      close()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo guardar la clave.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      className="sm:max-w-md"
    >
      <div>
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>Clave de recuperación</DialogTitle>
              <DialogDescription>
                Si olvidas tu frase maestra, estas {RECOVERY_WORD_COUNT} palabras
                son la única forma de volver a abrir tu Vault.
              </DialogDescription>
            </div>
            <DialogCloseButton onClick={close} />
          </div>
        </DialogHeader>

        <DialogContent className="space-y-4">
          {!words ? (
            <>
              <p className="text-xs leading-relaxed text-muted">
                Anótalas en papel. Sin ellas no podrás volver a abrir el Vault.
              </p>

              {error && <p className={errorBox}>{error}</p>}

              <Button
                type="button"
                variant="primary"
                className="w-full"
                disabled={busy}
                onClick={() => void generate()}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <KeyRound className="size-4" />
                )}
                Generar mis {RECOVERY_WORD_COUNT} palabras
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-primary/25 bg-primary-soft/40 p-3">
                <p className="mb-2.5 text-xs font-semibold text-foreground">
                  Anota estas {RECOVERY_WORD_COUNT} palabras en orden:
                </p>
                <ol className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                  {words.map((word, index) => (
                    <li key={word} className="flex items-baseline gap-1.5 text-sm">
                      <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-muted">
                        {index + 1}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {word}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                <p className="text-xs leading-relaxed text-muted">
                  Esta pantalla es la{' '}
                  <strong className="text-foreground">única vez</strong> que
                  verás las palabras. Si las pierdes, nadie podrá recuperar tu
                  Vault. No las guardes junto a la frase maestra.
                </p>
              </div>

              {error && <p className={errorBox}>{error}</p>}
            </>
          )}
        </DialogContent>

        <DialogFooter>
          {words ? (
            <>
              <Button type="button" variant="ghost" onClick={handleCopy}>
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? 'Copiado' : 'Copiar palabras'}
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={!confirmed || busy}
                onClick={() => void save()}
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                Ya las he anotado, guardar
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={close}>
              Cerrar
            </Button>
          )}
        </DialogFooter>

        {words && (
          <div className="border-t border-border/80 bg-elevated/40 px-5 py-3 sm:px-6">
            <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--c-primary)]"
              />
              He anotado las {RECOVERY_WORD_COUNT} palabras fuera del ordenador.
            </label>
          </div>
        )}
      </div>
    </Dialog>
  )
}

interface RecoverWithWordsProps {
  onRecovered: () => void
}

/**
 * Formulario de recuperación con las 12 palabras.
 *
 * Se usa desde la pantalla de Vault bloqueado. No pide la frase maestra en
 * ningún momento: las palabras desenvuelven directamente la clave AES.
 */
export function RecoverWithWords({ onRecovered }: RecoverWithWordsProps) {
  const { recoverWithRecoveryWords } = useVaultKey()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    const { words, error: parseError } = parseRecoveryInput(input)
    if (parseError) {
      setError(parseError)
      return
    }
    setBusy(true)
    try {
      await recoverWithRecoveryWords(words)
      toast.success('Vault recuperado', 'Ya puedes ver tus credenciales.')
      onRecovered()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo recuperar el Vault con esas palabras.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="recovery-words">
          Tus {RECOVERY_WORD_COUNT} palabras de recuperación
        </Label>
        <Textarea
          id="recovery-words"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="abeja cuaderno sol … (separadas por espacios o comas)"
          rows={3}
          className="font-mono text-sm"
        />
      </div>

      {error && <p className={errorBox}>{error}</p>}

      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        Recuperar con estas palabras
      </Button>
    </div>
  )
}