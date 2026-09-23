/**
 * Generador de claves criptográficamente seguro (Web Crypto API).
 * Sin Math.random: usa getRandomValues con rejection sampling para
 * evitar sesgo de módulo.
 */

export interface PasswordGenOptions {
  length: number
  upper: boolean
  lower: boolean
  digits: boolean
  symbols: boolean
  /** Excluir caracteres ambiguos: I l 1 O 0. */
  excludeAmbiguous: boolean
}

export const DEFAULT_GEN_OPTIONS: PasswordGenOptions = {
  length: 20,
  upper: true,
  lower: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
}

const SETS: Record<
  'upper' | 'lower' | 'digits' | 'symbols',
  string
> = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{}:;,.?/~',
}

const AMBIGUOUS = 'Il1O0'

/** Índice aleatorio uniforme en [0, max) con rechazo de sesgo. */
function randomIndex(max: number): number {
  if (max <= 0) return 0
  const limit = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buf)
    value = buf[0]!
  } while (value >= limit)
  return value % max
}

function pick(chars: string): string {
  return chars[randomIndex(chars.length)]!
}

/** Genera una clave que contiene al menos un carácter de cada conjunto activo. */
export function generatePassword(
  options: PasswordGenOptions = DEFAULT_GEN_OPTIONS,
): string {
  const clean = (s: string) =>
    options.excludeAmbiguous
      ? [...s].filter((c) => !AMBIGUOUS.includes(c)).join('')
      : s

  const activeSets: string[] = []
  if (options.upper) activeSets.push(clean(SETS.upper))
  if (options.lower) activeSets.push(clean(SETS.lower))
  if (options.digits) activeSets.push(clean(SETS.digits))
  if (options.symbols) activeSets.push(clean(SETS.symbols))

  // Si el usuario desactivó todo (o todo quedó vacío), usamos minúsculas.
  const sets = activeSets.filter((s) => s.length > 0)
  const fallback = [SETS.lower]
  const pool = (sets.length > 0 ? sets : fallback).join('')
  const usedSets = sets.length > 0 ? sets : fallback

  const length = Math.max(4, Math.min(64, Math.round(options.length)))

  // Uno de cada tipo + relleno del pool, y barajado Fisher–Yates con crypto.
  const chars = usedSets.map((s) => pick(s))
  while (chars.length < length) chars.push(pick(pool))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    const tmp = chars[i]!
    chars[i] = chars[j]!
    chars[j] = tmp
  }
  return chars.slice(0, length).join('')
}