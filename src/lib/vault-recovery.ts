/**
 * Clave de recuperación del Vault: 12 palabras que permiten volver a obtener la
 * clave AES cuando ya no se recuerda la frase maestra.
 *
 * Idea: NO se guarda la frase maestra en el servidor (quien administra Supabase
 * podría leer el Vault). Se guarda una COPIA de la clave AES, cifrada con una
 * clave derivada de estas 12 palabras. Sólo quien las anota puede abrir ese
 * sobre, así que el servidor almacena algo tan inútil como un ciphertext.
 *
 * Es el mismo patrón que la frase de 12/24 palabras de una cartera BIP-39: las
 * palabras son tuyas, se anotan en papel y son la única copia que existe.
 *
 * Entropía: 12 palabras elegidas de una lista de 512 = 108 bits, y la clave se
 * deriva con PBKDF2-SHA-256 a 600 000 iteraciones, de modo que un ataque por
 * fuerza bruta sobre el sobre es inviable aunque la lista se publicara entera.
 *
 * La lista se escribe sin tildes ni "ñ" a propósito: así la comparación es
 * trivial y no depende de la normalización unicode del navegador, que es donde
 * más errores silenciosos aparecen en este tipo de funciones.
 */

/** Número de palabras que forman la clave de recuperación. */
export const RECOVERY_WORD_COUNT = 12

/** Iteraciones PBKDF2 para derivar la clave de recuperación. */
export const RECOVERY_ITERATIONS = 600_000

export const RECOVERY_WORDS = [
  'abeja','acabar','activo','agarrar','ahora','alarma','aldea','alma',
  'amigo','andar','apagar','arder','arpa','ascender','ataque','aula',
  'avanzar','averia','ayuda','azotea','bajar','bambu','bandera','base',
  'batalla','beca','beneficio','bici','billete','bloque','bocina','boina',
  'bomba','borrar','bota','brazo','brinco','broma','bucle','buho',
  'burbuja','caballo','cacao','caja','calamar','calle','calzada','camello',
  'campana','candado','cansado','capital','carbon','carga','carrera','casa',
  'caso','causa','caverna','celebrar','cena','centro','cerro','chaleco',
  'chico','choza','cima','cisne','civico','clima','codo','coger',
  'cola','collar','combate','comarca','compra','conga','contar','corcho',
  'coronel','correr','cosecha','costa','cruz','cuarto','cuento','cueva',
  'culpa','cupon','curva','dama','dardo','debutar','decorado','defensa',
  'degradar','delinear','deporte','derrota','descender','desear','desnudo','despensa',
  'destacar','destruir','detras','dialogo','diez','diluir','directo','diseno',
  'distrito','doce','domingo','dos','dulce','elaborar','embudo','empate',
  'enano','enclave','enlace','ensenar','envase','equipo','espalda','espina',
  'estilo','etapa','examen','exportar','exigir','facil','faltar','favor',
  'feliz','feroz','figura','filo','fino','flama','flor','fogata',
  'forma','forzar','frase','fresa','frio','fruta','fuera','fuga',
  'fundir','futbol','gaita','galeria','ganar','garza','gato','genero',
  'geranio','gesto','girar','gloria','golpe','gorra','goteo','grado',
  'grapa','grieta','gripe','grua','guardar','guino','hacha','harto',
  'hecho','herir','hervor','higiene','himno','hola','honra','horno',
  'hotel','huelga','huevo','humilde','hurto','idioma','igual','iman',
  'impulso','incidente','ingeniero','inmueble','interes','istmo','jazmin','jinete',
  'jugar','julio','jurado','juzgar','labio','lado','lago','lampara',
  'lapiz','lastima','lazo','lector','legumbre','lemon','lena','letra',
  'libro','lienzo','lima','lince','linge','lista','llave','llevar',
  'lobo','logica','losa','lucidar','lunes','maceta','maestro','mago',
  'malla','manga','manejar','manso','maquina','marea','marzo','mata',
  'matriz','mecha','medrar','melon','mendigo','mente','mercurio','meson',
  'metodo','miel','militar','mina','minuto','miseria','mitad','modelo',
  'molino','monja','morada','mosaico','mozo','multa','muro','nacer',
  'nadar','nariz','navegar','necesario','nido','ninez','noche','nordeste',
  'nube','nudo','nuez','nutria','objeto','observar','occidente','ocho',
  'odiar','ofender','ofrecer','oigo','ojo','olivo','ombligo','opera',
  'optar','oral','oreja','orgullo','orilla','ortiga','oscuro','ostia',
  'otro','oxido','ozono','pacto','pais','palco','paloma','panca',
  'pantera','parada','parir','parra','pasco','patata','pauta','peaton',
  'pedia','pelota','penumbra','pera','pergamino','permiso','pesca','petalo',
  'pezuna','pico','pierna','pilar','pino','pion','pisar','pista',
  'placa','plano','platano','pliegue','plural','poder','poeta','polvo',
  'pompa','posada','potro','precio','prensa','primavera','producto','promesa',
  'proteger','publico','puente','pulga','punta','purga','puta','quema',
  'quimica','quitar','rabo','radar','raiz','rancho','raqueta','raspa',
  'rayo','reaccion','rebano','rechazar','red','redondo','refugio','regreso',
  'reja','relleno','remojo','renta','repo','res','resto','retrato',
  'revista','rial','ritmo','roble','rocio','rojo','ron','rosado',
  'rotar','ruido','ruta','saber','sacudir','sala','salmon','saltar',
  'samba','sangre','santo','sardina','satira','saxofon','secreto','seis',
  'semana','senor','sepulo','sequia','seria','servicio','severo','sierra',
  'signo','silencio','simpa','sirena','sistematico','sobre','sobresaltar','sola',
  'soledad','sombra','sonata','sopa','sospecha','suave','submarino','sueldo',
  'sugerencia','sulfato','sumidero','sur','surgir','tabaco','taberna','tactico',
  'talco','talon','tanque','tapon','tarea','tarjeta','tasa','teatro',
  'tejido','televisor','templo','tenga','tercer','terrestre','testigo','tiburon',
  'tienta','tijeras','tinta','tipico','titulo','tobillo','toldo','tomar',
  'topo','torcer','torre','tostada','tracaso','traer','traje','trance',
  'tratar','treinta','trepar','trinar','trofeo','tropas','trufa','tuerta',
  'tumbar','turno','ubicar','unico','una','uribe','usado','usual',
  'utopia','vacio','vaina','valiente','vapor','vario','vehiculo','velero',
  'vendor','venir','ventilador','verbo','verja','vertedizo','vibrar','vidrio',
  'viernes','vinilo','viraje','vista','vivaz','volador','volumen','voraz',
  'vuelo','yacer','yema','yodo','zafiro','zarpa','zodiaco','zorro'
] as const

import {
  createVerifier,
  decryptBytes,
  deriveAesKeyFromSecret,
  encryptBytes,
  newSalt,
  verifyVaultKey,
} from './vault-crypto'

/**
 * Bits de entropía de una clave de recuperación: 12 valores de 9 bits (log2 512)
 * elegidos con muestreo por rechazo, sin sesgo de módulo.
 */
export const RECOVERY_ENTROPY_BITS = RECOVERY_WORD_COUNT * 9

const WORD_INDEX = new Map<string, number>(
  RECOVERY_WORDS.map((word, index) => [word, index]),
)

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Este navegador no admite Web Crypto. Actualiza el navegador para usar la clave de recuperación.',
    )
  }
  return globalThis.crypto
}

/** AAD propia: impide mover un sobre de recuperación entre usuarios. */
function recoveryAad(userId: string): string {
  return `workvaul:v1:recovery:${userId}`
}

/**
 * Normaliza lo que el usuario escribe: minúsculas, sin tildes y sin signos.
 *
 * La lista ya viene sin tildes, pero el usuario puede teclear «árbol» o pegarla
 * de un sitio con acentos; normalizar ambos lados evita el fallo clásico de
 * «la palabra correcta no la reconoce».
 */
function normalizeToken(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/**
 * Genera 12 palabras al azar.
 *
 * Usa muestreo por rechazo sobre enteros de 32 bits: si se hiciera
 * `byte % 512` las 256 primeras opciones sareían el doble de probables que las
 * restantes y la entropía real sería menor que la nominal.
 */
export function generateRecoveryWords(): string[] {
  const total = RECOVERY_WORDS.length
  // Mayor múltiplo de `total` que cabe en un uint32: por debajo no se acepta.
  const limit = Math.floor(0x1_0000_0000 / total) * total
  const chosen = new Set<number>()
  const pool = new Uint32Array(16)

  while (chosen.size < RECOVERY_WORD_COUNT) {
    getCrypto().getRandomValues(pool)
    for (const value of pool) {
      if (value >= limit) continue
      chosen.add(value % total)
      if (chosen.size === RECOVERY_WORD_COUNT) break
    }
  }

  return [...chosen]
    .map((index) => RECOVERY_WORDS[index]!)
    .sort((a, b) => WORD_INDEX.get(a)! - WORD_INDEX.get(b)!)
}

export interface RecoveryWrap {
  recovery_salt: string
  recovery_iterations: number
  recovery_verifier: string
  encrypted_recovery_key: string
}

/**
 * Envuelve la clave AES del Vault con la clave derivada de las 12 palabras.
 *
 * Devuelve las columnas que hay que guardar. NUNCA se devuelven las palabras
 * dentro de este objeto: se las queda el usuario.
 */
export async function wrapVaultKeyWithRecovery(
  vaultKeyBits: ArrayBuffer,
  words: string[],
  userId: string,
): Promise<RecoveryWrap> {
  if (words.length !== RECOVERY_WORD_COUNT) {
    throw new Error(
      `La clave de recuperación debe tener ${RECOVERY_WORD_COUNT} palabras.`,
    )
  }
  const salt = newSalt()
  const recoveryKey = await deriveAesKeyFromSecret(
    words.join(' '),
    salt,
    RECOVERY_ITERATIONS,
  )
  return {
    recovery_salt: salt,
    recovery_iterations: RECOVERY_ITERATIONS,
    recovery_verifier: await createVerifier(recoveryKey),
    encrypted_recovery_key: await encryptBytes(
      vaultKeyBits,
      recoveryKey,
      recoveryAad(userId),
    ),
  }
}

/** Desenvuelve la clave AES del Vault a partir de las 12 palabras. */
export async function unwrapVaultKeyWithRecovery(
  words: string[],
  row: {
    recovery_salt: string | null
    recovery_iterations: number | null
    recovery_verifier: string | null
    encrypted_recovery_key: string | null
  },
  userId: string,
): Promise<ArrayBuffer> {
  if (
    !row.recovery_salt ||
    !row.recovery_iterations ||
    !row.recovery_verifier ||
    !row.encrypted_recovery_key
  ) {
    throw new Error(
      'Esta cuenta todavía no tiene clave de recuperación. Créala desde el menú de tu cuenta.',
    )
  }
  const recoveryKey = await deriveAesKeyFromSecret(
    words.join(' '),
    row.recovery_salt,
    row.recovery_iterations,
  )
  // Verifica primero el verificador: así una palabra mal escrita da un error
  // claro en lugar de un fallo de descifrado opaco.
  await verifyVaultKey(recoveryKey, row.recovery_verifier)
  return decryptBytes(
    row.encrypted_recovery_key,
    recoveryKey,
    recoveryAad(userId),
  )
}

export interface ParsedRecoveryInput {
  words: string[]
  error: string | null
}

/** Valida y normaliza lo que el usuario escribe en el campo de recuperación. */
export function parseRecoveryInput(input: string): ParsedRecoveryInput {
  const tokens = input
    .split(/[\s,;.]+/)
    .map(normalizeToken)
    .filter(Boolean)

  if (tokens.length === 0) {
    return { words: [], error: 'Escribe las 12 palabras de recuperación.' }
  }
  if (tokens.length !== RECOVERY_WORD_COUNT) {
    return {
      words: tokens,
      error: `Faltan o sobran palabras: has escrito ${tokens.length} de ${RECOVERY_WORD_COUNT}.`,
    }
  }
  const unknown = tokens.filter((token) => !WORD_INDEX.has(token))
  if (unknown.length > 0) {
    return {
      words: tokens,
      error: `Estas palabras no existen: ${unknown.join(', ')}.`,
    }
  }
  if (new Set(tokens).size !== RECOVERY_WORD_COUNT) {
    return {
      words: tokens,
      error: 'Hay palabras repetidas. Las 12 deben ser distintas.',
    }
  }
  return { words: tokens, error: null }
}

/** Las 12 palabras como texto plano, listo para copiar o imprimir. */
export function formatRecoveryWords(words: string[]): string {
  return words
    .map((word, index) => `${index + 1}. ${word}`)
    .join('\n')
}

