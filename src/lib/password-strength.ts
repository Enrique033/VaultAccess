/**
 * Evaluación de fuerza de claves sin dependencias externas.
 * Combina longitud, variedad de caracteres y detección de patrones
 * débiles (palabras comunes, secuencias, repeticiones).
 */

export type StrengthScore = 0 | 1 | 2 | 3 | 4

export interface PasswordStrength {
  score: StrengthScore
  label: string
  /** Clase Tailwind del color de barra (score > 0). */
  barClass: string
}

const LEVELS: { label: string; barClass: string }[] = [
  { label: 'Muy débil', barClass: 'bg-red-500' },
  { label: 'Débil', barClass: 'bg-red-400' },
  { label: 'Aceptable', barClass: 'bg-amber-500' },
  { label: 'Fuerte', barClass: 'bg-green-500' },
  { label: 'Muy fuerte', barClass: 'bg-green-600' },
]

const COMMON_PASSWORDS = [
  'password',
  'contrasena',
  '123456',
  '12345678',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  'admin',
  'iloveyou',
  'letmein',
  'workvaul',
  'abcdef',
  'monkey',
  'dragon',
  'football',
  'princess',
  'superman',
  'trustno1',
  'welcome',
]

/** Evalúa una clave y devuelve puntuación 0–4 con etiqueta. */
export function evaluatePassword(password: string): PasswordStrength {
  const empty: PasswordStrength = { score: 0, ...LEVELS[0]! }
  if (!password) return empty

  let points = 0

  // Longitud
  if (password.length >= 8) points += 1
  if (password.length >= 12) points += 1
  if (password.length >= 16) points += 1
  if (password.length >= 24) points += 1

  // Variedad de clases de caracteres (minúscula, mayúscula, dígito, símbolo)
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(password),
  ).length
  points += Math.max(0, classes - 1)

  const lower = password.toLowerCase()

  // Palabras/teclados comunes
  if (COMMON_PASSWORDS.some((c) => lower.includes(c))) points -= 2
  if (['qwe', 'asd', 'zxc', '123', '789'].some((k) => lower.includes(k)))
    points -= 1

  // Caracteres repetidos (aaa, 111…)
  if (/(.)\1{2,}/.test(password)) points -= 1

  // Secuencias alfabéticas numéricas de 4+ (abcd, 1234…)
  let run = 1
  for (let i = 1; i < password.length; i++) {
    const prev = password.charCodeAt(i - 1)
    const curr = password.charCodeAt(i)
    if (curr === prev + 1) {
      run += 1
      if (run >= 4) {
        points -= 1
        break
      }
    } else {
      run = 1
    }
  }

  let score: StrengthScore = 0
  if (points >= 6) score = 4
  else if (points >= 4) score = 3
  else if (points >= 2) score = 2
  else if (points >= 1) score = 1

  return {
    score,
    label: LEVELS[score]!.label,
    barClass: LEVELS[score]!.barClass,
  }
}
