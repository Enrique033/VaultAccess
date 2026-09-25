# 🔒 Security Policy · Workvaul

## Modelo de seguridad

Workvaul es una SPA (React + Vite) con **Supabase** como backend. Entender el
modelo evita falsos positivos al reportar vulnerabilidades:

- **El contenido privado usa cifrado de extremo a extremo en el navegador.**
  El usuario crea una frase maestra independiente de Google; de ella se deriva
  con PBKDF2 una clave AES-256-GCM. La frase y las claves derivadas no se envían
  nunca a Supabase.
  - **Caché de sesión:** la frase se guarda en `sessionStorage` (nunca en
    `localStorage`) para no pedirla en cada recarga. `sessionStorage` pertenece a
    la pestaña y el navegador lo descarta al cerrarla, así que **no queda una
    llave maestra escrita en el disco del perfil**. Al recuperarla se vuelve a
    derivar la misma clave AES, por lo que **no requiere migración de los datos
    ya cifrados**: los AAD dependen de `user_id` e id de registro, que no cambian.
  - El bloqueo por inactividad, el cierre de sesión y el cambio de usuario borran
    esa caché.
  - **Riesgo asumido:** cualquier JavaScript que se ejecute en este origen
    (XSS o extensión con permiso de lectura sobre la pestaña) puede leer la
    frase cacheada mientras la pestaña está abierta. Es el mismo riesgo que tener
    la clave en memoria, y sigue sin exponerla al servidor ni a terceros.
- **Clave de recuperación (opcional):** 12 palabras que el usuario anota en papel
  permiten recuperar la clave AES si olvida la frase maestra.
  - Se guarda en `vault_crypto_keys.encrypted_recovery_key` una **copia de la
    clave AES** cifrada con una clave derivada de esas palabras (PBKDF2-SHA-256,
    600 000 iteraciones, sal propia). **Nunca se guardan la frase maestra ni las
    palabras.**
  - No es una puerta trasera al servidor: quien administre Supabase ve un
    ciphertext tan inútil como el de cualquier registro, porque sin las 12
    palabras no puede derivar la clave que lo abre. Tampoco ayuda quien controle
    la cuenta de Google, porque las palabras no se envían a ningún sitio.
  - Son 12 valores de 9 bits elegidos de una lista de 512 (**108 bits** de
    entropía) con muestreo por rechazo, sin sesgo de módulo. La lista se escribe
    sin tildes ni `ñ` y la entrada se normaliza, para que «árbol» se compare con
    «arbol».
  - El AAD incluye el `user_id`, así que un sobre no se puede reutilizar en otra
    cuenta. Antes de aceptar las palabras se valida su verificador y, tras
    desenvolver la clave, se comprueba contra el verificador del Vault: si la
    clave recuperada no fuese la correcta, el descifrado fallaría en vez de
    mostrar datos corruptos.
  - **Riesgo asumido:** es la misma nota de las 12 palabras de una cartera
    BIP-39. Si se anotan en el mismo ordenador o junto a la frase maestra,
    quien tenga acceso a ambos tiene el Vault. Anotarlas fuera del dispositivo y
    separadas de la frase es parte del modelo.
  - Al recuperar con las palabras **no** se cachea nada en `sessionStorage`: tras
    recargar volverá a pedirse la frase (o las palabras). Ver
    `src/lib/vault-recovery.ts`.
- **Copia local cifrada (modo sin conexión):** tras cada carga correcta se
  guarda en IndexedDB el `encrypted_payload` tal cual lo devuelve Supabase. Si el
  servidor no responde, la app descifra esa copia con la clave AES de la sesión y
  entra en **modo lectura**, con un aviso visible. Nunca se escriben claves en
  claro en el navegador y la copia se borra al cerrar sesión. Ver
  `src/lib/vault-offline.ts`.
- **Exportación cifrada:** la copia de seguridad ya **no** se descarga en texto
  plano por defecto. El `.xlsx` se genera en memoria, se cifra con AES-GCM
  (PBKDF2, 400 000 iteraciones) usando una contraseña que elige el usuario y se
  descarga un sobre opaco `.wvexport`. El modo plano sigue disponible, pero
  exige marcar una casilla de confirmación. Ver `src/lib/vault-export.ts`.
- **Bloqueo por pestaña en segundo plano:** tras 60 s fuera de foco el Vault se
  bloquea (sin cerrar la sesión de Google). Antes seguía desbloqueado con la
  ventana oculta, lo que bastaba para exponerlo en un equipo compartido.
- **Cabeceras:** `Cache-Control: no-store` evita que respuestas con datos
  descifrados queden en cachés del navegador o intermedias. La CSP añade
  `manifest-src`, `worker-src` y `upgrade-insecure-requests`.
- **No se implementó Trusted Types** (`require-trusted-types-for 'script'`) porque
  rompería `document.createElement` y `document.execCommand` que usa el portapapeles
  en navegadores sin soporte. Queda anotado como mejora pendiente.
- Si la caché se pierde o la pestaña se cierra, el Vault vuelve a pedirla.
- **RLS sigue activo** en las tablas del Vault, sharing, historial y chat:
  `using`/`with check` con `auth.uid()` y la participación/rol que corresponda.
  La `anon key` es pública por diseño; RLS y el cifrado son capas distintas.
- **Cifrado:** credenciales, enlaces, notas, historial y copias compartidas se
  almacenan en `encrypted_payload`. Las claves de equipo se envuelven con la
  clave pública RSA de cada miembro. El propietario de Supabase puede ver
  ciphertext y metadatos (fechas, favoritos, categorías y relaciones), pero no
  la frase maestra ni las claves AES con las que se descifra.
- **Transición:** las filas nuevas nacen cifradas. Las filas antiguas se migran y
  limpian progresivamente cuando el usuario las abre tras desbloquear el Vault;
  hasta entonces, el propietario de Supabase puede ver esas filas heredadas en
  claro.
- **Adjuntos cifrados (sólo notas):** las imágenes adjuntas a una nota se cifran
  con AES-GCM en el navegador antes de subirlas al bucket privado
  `vault-attachments`. Los enlaces y los accesos no admiten imágenes. Supabase
  almacena el sobre opaco, nunca los bytes de la imagen; nombre, MIME, tamaño e ID
  se guardan únicamente dentro del `encrypted_payload` del registro. La descarga
  requiere una sesión autenticada y se descifra en memoria; la UI usa un
  `Blob URL` temporal y lo revoca al cerrar. No se usa `getPublicUrl`.
- **Storage privado:** las políticas de `vault-attachments` sólo admiten
  `authenticated` y exige que la primera carpeta sea `{auth.uid()}`. No hay
  políticas públicas para imágenes. Si una eliminación de Storage falla, el
  registro se elimina igualmente y el cliente deja registrada la limpieza
  pendiente; una tarea posterior puede auditar carpetas privadas por usuario.
- **Categorías:** `parent_id` y `sort_order` permiten raíces, subcategorías y
  orden entre hermanos. El cliente rechaza padres de otra sección, ciclos y
  referencias inexistentes; al borrar una categoría se desvinculan sus
  descendientes y los registros quedan sin categoría, sin borrar contenido.
- **Limitación del modelo:** no protege contra malware, una extensión
  comprometida, una sesión ya robada o un dispositivo desbloqueado mientras se
  usa la aplicación. Si alguien controla también el hosting o el código del
  frontend, podría publicar una versión maliciosa que capture la frase maestra.
  La exportación a Excel genera deliberadamente un archivo local en texto plano.
- **Chat aislado:** `chat_conversations`, `chat_conversation_participants` y
  `chat_messages` no contienen credenciales; cada lectura/escritura exige ser
  participante. La creación de conversaciones directas pasa por una RPC
  `SECURITY DEFINER` validada y el texto se sanea en cliente y servidor.
- **Presencia:** heartbeat privado en Supabase con TTL; la UI solo consulta
  usuarios visibles del chat/equipo abierto. El contador global se muestra en el
  menú de cuenta únicamente después de que `is_global_owner()` confirme en
  Supabase el correo exacto `elvissebas39@gmail.com`.
- Headers de seguridad en producción via `vercel.json`: CSP, HSTS,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- `robots.txt` con `Disallow: /` + `meta noindex` (contenido privado).
- `.env` ignorado por git; solo existe `.env.example`.

## Controles implementados

| Capa           | Control                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datos          | RLS activo en las tablas del Vault, sharing, historial y `chat_conversations`, `chat_conversation_participants`, `chat_messages`; `vault-attachments` restringido a `authenticated` y rutas `{auth.uid()}/...`                                                                                |
| Cifrado        | AES-256-GCM en el navegador, PBKDF2 con frase maestra y claves RSA para compartir; Supabase almacena ciphertext, sal, verificadores y claves envueltas                                                    |
| Recuperación   | 12 palabras anotadas por el usuario (108 bits) permiten envolver una copia de la clave AES; el servidor sólo ve un sobre cifrado con ellas y nunca la frase maestra ni las palabras              |
| Privacidad     | `list_workspace_members()` y `get_chat_user_profiles()` ocultan el email a usuarios no globales cuando existe un nombre registrado; solo `elvissebas39@gmail.com` ve nombre + correo                            |
| Chat           | Las tablas `chat_*` están aisladas de credenciales; lectura y envío exigen ser participante. La creación de chats directos usa una RPC `SECURITY DEFINER` validada y el contenido se sanea antes de persistirse |
| Notificaciones | `chat_notifications` solo es legible por su destinatario; un registro por mensaje y avisos genéricos de cambios del equipo, sin copiar credenciales                                                             |
| Mensajes       | Editar/eliminar para todos requiere ser el emisor; “eliminar para mí” se registra en `chat_message_deletions` sin modificar el mensaje de los demás                                                             |
| Presencia      | Heartbeat privado con TTL y consultas solo a usuarios visibles; el contador global requiere `is_global_owner()` server-side para `elvissebas39@gmail.com`. El canal anterior queda como fallback temporal       |
| Equipos        | RLS por pertenencia: funciones `security definer` (`is_workspace_member`, `workspace_role`) evitan recursión y no exponen `auth.users`. Compartir **copia** el dato: nunca se da acceso al vault personal       |
| Invitaciones   | Roles (`owner`/`editor`/`viewer`); la invitación se reclama por el mismo correo al iniciar sesión con Google (`claim_workspace_invites()` solo puede fijar el propio `user_id`)                                 |
| Importación    | Los respaldos se leen en el navegador; el archivo no se sube a ningún servidor                                                                                                                                  |
| Portapapeles   | Limpieza automática 30 s tras copiar una clave (solo si el contenido sigue intacto)                                                                                                                             |
| Sesión         | Cierre automático por inactividad (15 min sin interacción)                                                                                                                                                      |
| Transporte     | HTTPS obligatorio (Supabase y Vercel) + HSTS                                                                                                                                                                    |
| Browser        | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (ver `vercel.json`)                                                                                                            |
| Secretos       | `.env` fuera de git (`.gitignore`); solo variables `VITE_*` (públicas)                                                                                                                                          |
| Auth           | Google OAuth como único acceso de la interfaz; el proveedor Email se desactiva en Supabase para esta etapa, sin exponer métodos de contraseña en el cliente                                                     |
| Indexación     | `robots.txt` con `Disallow: /` + `meta noindex`                                                                                                                                                                 |

## Versiones soportadas

Solo la versión desplegada en la rama `main` (producción) recibe correcciones.

## Reportar una vulnerabilidad

1. **No** abras un issue público.
2. Envía un correo a **[tu-email@example.com]** con: pasos de reproducción,
   impacto y ambiente (local/producción).
3. Respuesta objetivo: 72 horas. Confirma recepción y te mantengo informado
   hasta el fix y su despliegue.

## Fuera de alcance

- Fuerza bruta directa contra la API de Supabase (mitigada por rate-limits del
  proveedor).
- Compromiso de la cuenta de Google del usuario (2FA de Google).
- Acceso ADMIN al proyecto Supabase (infraestructura del proveedor).
