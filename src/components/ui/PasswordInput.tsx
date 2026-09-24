import { useState } from 'react'
import { Dices, Eye, EyeOff, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { evaluatePassword } from '@/lib/password-strength'
import {
  DEFAULT_GEN_OPTIONS,
  generatePassword,
  type PasswordGenOptions,
} from '@/lib/password-generator'

interface PasswordInputProps {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  autoFocus?: boolean
  required?: boolean
  minLength?: number
  disabled?: boolean
  /** Muestra la barra de fuerza de la clave. */
  showStrength?: boolean
  /** Habilita el generador con opciones (longitud / conjuntos de caracteres). */
  allowGenerate?: boolean
  className?: string
}

const SET_LABELS: Record<'upper' | 'lower' | 'digits' | 'symbols', string> = {
  upper: 'ABC',
  lower: 'abc',
  digits: '123',
  symbols: '#$%',
}

/**
 * Campo de clave con revelar/ocultar, generador opcional
 * (crypto.getRandomValues) y medidor de fuerza opcional.
 */
export function PasswordInput({
  id,
  name,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = '••••••••',
  autoFocus,
  required,
  minLength,
  disabled,
  showStrength = false,
  allowGenerate = false,
  className,
}: PasswordInputProps) {
  const [revealed, setRevealed] = useState(false)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [options, setOptions] =
    useState<PasswordGenOptions>(DEFAULT_GEN_OPTIONS)
  /** Última clave creada por el generador (para regenerar sin pisar texto manual). */
  const [lastGenerated, setLastGenerated] = useState<string | null>(null)

  const strength = evaluatePassword(value)
  const activeSets =
    Number(options.upper) +
    Number(options.lower) +
    Number(options.digits) +
    Number(options.symbols)

  const regenerate = (next: PasswordGenOptions) => {
    const password = generatePassword(next)
    setLastGenerated(password)
    onChange(password)
  }

  const applyOptions = (patch: Partial<PasswordGenOptions>) => {
    const next = { ...options, ...patch }
    setOptions(next)
    // Solo regenera si el valor actual lo creó el generador (no texto manual).
    if (lastGenerated !== null && lastGenerated === value) regenerate(next)
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          autoFocus={autoFocus}
          required={required}
          minLength={minLength}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-xl border border-border bg-surface px-3.5 text-base text-foreground shadow-sm placeholder:text-muted transition-all duration-150',
            'focus:border-primary/60 focus:outline-none focus:ring-4 focus:ring-primary/10',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'lg:h-9 lg:text-[13px]',
            allowGenerate ? 'pr-[4.75rem]' : 'pr-10',
          )}
        />
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
          {allowGenerate && (
            <>
              <button
                type="button"
                onClick={() => setOptionsOpen((p) => !p)}
                className={cn(
                  'rounded p-1.5 transition-colors duration-150',
                  optionsOpen
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:bg-surface hover:text-foreground',
                )}
                aria-label="Opciones del generador"
                title="Opciones del generador"
                disabled={disabled}
              >
                <Settings2 className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => regenerate(options)}
                className="rounded p-1.5 text-muted transition-colors duration-150 hover:bg-surface hover:text-foreground"
                aria-label="Generar clave"
                title="Generar clave"
                disabled={disabled}
              >
                <Dices className="size-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setRevealed((p) => !p)}
            className="rounded p-1.5 text-muted transition-colors duration-150 hover:bg-surface hover:text-foreground"
            aria-label={revealed ? 'Ocultar' : 'Mostrar'}
            title={revealed ? 'Ocultar' : 'Mostrar'}
            disabled={disabled}
          >
            {revealed ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Medidor de fuerza */}
      {showStrength && value.length > 0 && (
        <div className="flex items-center gap-2" aria-live="polite">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  'h-1 flex-1 rounded-full bg-border transition-colors',
                  i < strength.score && strength.barClass,
                )}
              />
            ))}
          </div>
          <span className="w-20 shrink-0 text-right text-[11px] text-muted">
            {strength.label}
          </span>
        </div>
      )}

      {/* Panel de opciones del generador */}
      {allowGenerate && optionsOpen && (
        <div className="animate-fade-in space-y-3 rounded-xl border border-border bg-surface p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${id ?? 'pw'}-length`}
              className="text-xs font-medium text-muted"
            >
              Longitud
            </label>
            <span className="font-mono text-xs font-semibold text-foreground">
              {options.length}
            </span>
          </div>
          <input
            id={`${id ?? 'pw'}-length`}
            type="range"
            min={8}
            max={48}
            step={1}
            value={options.length}
            onChange={(e) => applyOptions({ length: Number(e.target.value) })}
            className="w-full accent-primary"
          />

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {(Object.keys(SET_LABELS) as (keyof typeof SET_LABELS)[]).map(
              (key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 text-xs text-muted"
                >
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) => applyOptions({ [key]: e.target.checked })}
                    className="size-3.5 accent-primary"
                  />
                  <span className="font-mono">{SET_LABELS[key]}</span>
                </label>
              ),
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={options.excludeAmbiguous}
              onChange={(e) =>
                applyOptions({ excludeAmbiguous: e.target.checked })
              }
              className="size-3.5 accent-primary"
            />
            Excluir ambiguos (I, l, 1, O, 0)
          </label>

          {activeSets === 0 && (
            <p className="text-[11px] text-amber-500">
              Se usarán minúsculas: activa algún conjunto.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
