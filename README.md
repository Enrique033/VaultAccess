# 🗄️ Workvaul

Espacio privado para gestionar **accesos, enlaces y notas** en un solo
lugar. SPA construida con React + Vite + Tailwind, autenticada con **Supabase
Auth** (Google OAuth) y protegida con **Row Level Security**.

## ✨ Características

- Acceso único con **Google OAuth**. No hay registro, login ni recuperación por
  correo/contraseña en la interfaz actual.
- **Secciones → categorías → credenciales**, con búsqueda (Ctrl+K), favoritos
  y orden.
- **Categorías jerárquicas**: las secciones agrupan categorías raíz y
  subcategorías anidadas, plegables, ordenables y movibles entre secciones
  (`parent_id` + `sort_order`, ver `supabase/schema-encryption.sql`).
- **Vista de tablero tipo Trello** en credenciales, enlaces y notas: una columna
  por categoría con desplazamiento vertical independiente. Las tarjetas se
  **arrastran entre columnas** para cambiar de categoría, sin tocar el cifrado
  ni los adjuntos. Alterna con la rejilla mediante el conmutador Rejilla/Tablero,
  que recuerda tu preferencia.
- **Columnas independientes por módulo**: Access, Links y Notas **no comparten
  nada**. Cada columna pertenece a un módulo (`vault_categories.module`) y el
  módulo es **obligatorio** al crearla, así que una columna escrita en Links nace
  en Links y sus tarjetas se quedan allí: renombrar o borrar una columna en Access
  no toca las de Links ni las de Notas, y ningún enlace o nota puede acabar
  dentro de una columna de otro tablero. Sólo el buscador ve los tres módulos y
  Equipos es quien reparte los registros.
- **Compartir en equipo desde cualquier lugar**: los 3 puntitos de cada tarjeta
  (Access, Links y Notas) incluyen «Compartir en equipo», el diálogo de edición
  tiene un botón directo, y al crear un registro nuevo se abre automáticamente
  el diálogo de compartir para no tener que ir a buscarlo al tablero.
- **Interfaz de tablero minimalista, al estilo Trello**: el encabezado de cada
  columna muestra **sólo el título (editable con un clic) y el contador**; los
  controles aparecen al pasar el cursor. El botón **«+» sólo se despliega en el
  hueco exacto entre dos tarjetas** y hay un **«+ Añade…» fijo al pie** de la
  columna. Las tarjetas muestran título, dato secundario y *badges*; todas las
  acciones (editar, copiar, abrir, compartir, eliminar) viven en el menú `⋯`,
  que aparece **sólo al pasar el cursor por la tarjeta**.
  No se muestra el filtro de categorías ni botones pesados.
- **Gestión de columnas desde el propio tablero**: cada columna es una lista con
  su título editable, contador y menú `⋯`. **«+ Añade otra lista»** al
  final abre un input en la propia columna: escribes el nombre, pulsas Enter y la
  columna nace lista para recibir tarjetas. Las columnas vacías **sí se muestran**,
  como en Trello. No hay selector «Anidada en» ni pestañas de sección, y la barra
  lateral queda sólo con la navegación (Access, Links, Notas, Equipos).
- **Archivar columnas y tarjetas sin perder nada**: el menú `⋯` ofrece
  **«Archivar columna»** y **«Archivar»** en cada credencial, enlace o nota.
  Archivar **no borra**: desaparece del tablero (`archived_at`) y se queda en el
  panel **icono de cuenta → Archivados**, con su columna de origen y sus
  imágenes. Al archivar una columna, sus tarjetas se archivan con ella: así nada
  aparece de golpe en «Sin categoría». Al recuperarla, vuelven a su sitio. El
  panel tiene dos secciones —**Columnas** y **Tarjetas**— y en ambas **Recuperar**
  (vuelve al tablero) y **Eliminar** (borrado de verdad, con confirmación). Los
  tableros avisan con un enlace directo cuando hay algo archivado. El cajón
  «Sin categoría» no se archiva porque no existe en la base: sólo se renombra, y
  al hacerlo se convierte en columna real.
- **Sin categorías de ejemplo**: la app ya no siembra secciones ni columnas al
  registrarte. Empiezas con el tablero vacío y creas las columnas que quieras. Si
  quieres tirar las que tienes, `supabase/reset-columns.sql` es un script aparte,
  **destructivo y opcional**: borra columnas y secciones y deja los registros sin
  columna, pero no borra credenciales, enlaces ni notas. Está en su propio archivo
  para que no se ejecute por accidente al aplicar las migraciones.
- **«Sin categoría» se comporta como las demás**: al renombrarla se convierte en
  una columna real —crea la categoría y traslada allí todo lo que estaba suelto— y
  a partir de ese momento es editable y eliminable como cualquier otra.
- **Sin botones «Nuevo» redundantes**: los registros se crean desde el `+` de la
  columna correspondiente o desde el `+` del pie, nunca desde un botón global.
- **Notas en dos paneles**: al editar una nota, la izquierda es el texto y la
  derecha las imágenes y los comentarios. Ambos lados son editables y las
  imágenes se ven como miniaturas reales (descifradas en memoria, nunca una URL
  pública), descargadas en paralelo y ampliables con un clic. **Las imágenes sólo
  existen en notas**, no en enlaces ni accesos.
- **Links y Notas** completos: tarjetas, CRUD, favoritos, búsqueda y filtros
  (tablas `vault_links` / `vault_notes` con RLS).
- **Generador de claves** (crypto.getRandomValues) con longitud 8–48,
  conjuntos de caracteres y exclusión de ambiguos.
- **Medidor de fuerza** de claves en las credenciales.
- **Historial de claves**: cada cambio guarda la versión anterior (las 20
  últimas) y puedes restaurarla desde el diálogo de la credencial
  (`supabase/schema-history.sql`).
- **Equipos (espacios compartidos)**: invita por correo con rol (_propietario_,
  _puede editar_, _solo lectura_) y comparte solo las credenciales que decidas.
  La persona invitada debe entrar con **Google usando exactamente ese correo**;
  la invitación se reclama automáticamente al cargar el espacio.
- **Chat interno en tiempo real**: panel claro/oscuro con pestañas **Equipo** y
  **Búsqueda**, conversaciones privadas, mensajes sanitizados y suscripción a
  `chat_messages` mediante Supabase Realtime (`supabase/schema-chat.sql`).
- **Presencia en tiempo real scalable**: heartbeat privado por usuario (TTL de 90 s),
  consulta por equipo/conversación visible y contador global únicamente para el
  owner autorizado. Durante la transición mantiene fallback al canal anterior.
- **Notificaciones de chat**: campana con contador persistente, avisos por
  mensaje y cambios del equipo; al abrir la lista se marcan como leídos y al
  hacer clic se abre la conversación relacionada.
- **Mensajes editables**: edición y eliminación para mí o para todos, con
  sincronización Realtime y marca `(editado)`.
- **Panel de KPIs** en la vista de accesos: total, favoritas, claves débiles
  (filtro de un clic) y compartidas en equipos.
- **Estados de carga con skeletons** y animaciones escalonadas en las rejillas.
- **Exportar a Excel (.xlsx)**: hoja _Dashboard_ con KPIs y barras por
  sección/categoría + hojas de detalle (credenciales, enlaces, notas) con
  filtros, desde el menú de usuario.
- **Auto-limpieza del portapapeles** 30 s tras copiar una clave.
- **Cierre de sesión por inactividad** (15 min) para equipos compartidos.
- **Diseño 100 % responsivo**: drawer en móvil/tablet, grid de 1→4 columnas,
  bottom-sheets en móvil, inputs anti-zoom iOS y targets táctiles.
- Tema claro/oscuro, toasts, formularios con `react-hook-form` + `zod`.
- RLS: cada usuario solo ve sus filas del Vault y solo las conversaciones donde
  participa; equipos y chat aplican políticas específicas (`supabase/schema.sql` +
  `supabase/schema-content.sql` + `supabase/schema-sharing.sql` +
  `supabase/schema-chat.sql`).

## 🛠 Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · React Router 7 · Zustand ·
Supabase (Postgres + Auth) · Radix UI · Zod · ESLint + Prettier

## 🚀 Arranque local

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env      # completa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
# Opcional en local: VITE_APP_URL=http://localhost:5173

# 3. Base de datos: ejecuta en Supabase Dashboard → SQL Editor → New query
#    1) supabase/schema.sql          (tablas principales + RLS)
#    2) supabase/schema-content.sql  (links y notas + RLS)
#    3) supabase/schema-history.sql  (historial de claves + RLS)
#    4) supabase/schema-sharing.sql  (equipos / espacios compartidos + RLS)
#    5) supabase/schema-chat.sql     (chat + presencia + RLS + Realtime)
#    6) supabase/schema-chat-v2.sql  (privacidad, notificaciones, editar/eliminar)
#    7) supabase/schema-chat-v3.sql  (búsqueda global de personas + refresh API)
#    8) supabase/schema-scalability.sql (índices, heartbeats y snapshots; ejecutar después de v3)
#    9) supabase/schema-encryption.sql  (E2EE + adjuntos/categorías; ejecutar al final)
#
# IMPORTANTE: si ya habías aplicado 4) y 8) antes de compartir enlaces y notas,
# vuelve a ejecutar schema-sharing.sql (añade item_kind, link_id y note_id) y
# después schema-scalability.sql (su RPC debe devolver esas columnas nuevas).
# schema-scalability.sql ya NO redefine get_vault_snapshot(): esa función es de
# schema-encryption.sql y sobrescribirla dejaba el Vault sin descifrar.

# Los 9 archivos anteriores son idempotentes y NO borran nada: se ejecutan
# enteros, sin miedo, y se pueden repetir. Los scripts de mantenimiento viven en
# archivos aparte para que nunca se ejecuten por accidente:
#
#   · supabase/fix-category-modules.sql  →  devuelve a su tablero las columnas
#     que se crearon sin módulo (te aparecían en Access) y suelta las tarjetas
#     que quedaron en la columna equivocada. Empieza por su consulta 1, un
#     diagnóstico, y comprueba el resultado antes de seguir. NO borra nada.
#   · supabase/reset-columns.sql        →  vacía columnas y secciones para
#     empezar de cero. DESTRUCTIVO: úsalo sólo si quieres tirar la
#     organización actual. Está aparte precisamente por eso.
#
# ¿Las columnas de Links o Notas te salen en Access? Ejecuta primero
# schema-encryption.sql ENTERO (su get_vault_snapshot() es la que devuelve
# `module` al cliente) y después fix-category-modules.sql.

# 4. Desarrollo
npm run dev               # http://localhost:5173
```

### Scripts

| Comando           | Descripción                                 |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Servidor de desarrollo (Vite)               |
| `npm run build`   | Type-check (`tsc -b`) + build de producción |
| `npm run lint`    | ESLint                                      |
| `npm run preview` | Vista previa del build                      |

## 🔐 Seguridad

Ver **[SECURITY.md](./SECURITY.md)** para el modelo completo. Resumen:

- **RLS activo** en todas las tablas de Vault y chat: `using`/`with check` con
  `auth.uid()` y la participación/rol que corresponda a cada tabla.
- **Imágenes cifradas sólo en notas**: las notas admiten imágenes adjuntas; los
  enlaces y los accesos no. Se cifran en el
  navegador antes de subirlas al bucket privado `vault-attachments`. Los bytes de
  la imagen en claro nunca se guardan en Supabase (sólo el sobre cifrado) y los
  metadatos (nombre, MIME, tamaño
  e ID opaco) viven dentro de `encrypted_payload`.
- **Categorías jerárquicas**: las secciones son grupos principales; las raíces
  y subcategorías se pueden crear, renombrar, mover, reordenar, plegar y
  eliminar. `parent_id` y `sort_order` son opcionales para las filas antiguas.
- El bucket de imágenes es privado y sus políticas sólo permiten operaciones de
  usuarios autenticados dentro de `{auth.uid()}/...`; no se usa
  `getPublicUrl` ni se expone una URL pública.
- Las filas antiguas se migran progresivamente al descifrarlas. Los adjuntos
  antiguos que no tengan metadata cifrada no se inventan ni se recuperan desde
  Storage: deben volver a adjuntarse.
- Si Storage está temporalmente indisponible al borrar un registro, la
  eliminación del registro continúa y el cliente registra el archivo huérfano;
  una limpieza posterior puede revisar las carpetas privadas del usuario.
- **Chat aislado**: `chat_conversations`, `chat_conversation_participants` y
  `chat_messages` no contienen credenciales; cada lectura/escritura exige ser
  participante y la creación de conversaciones directas pasa por una RPC
  `SECURITY DEFINER` validada. El texto se sanea en cliente y servidor.
- **Presencia**: heartbeat privado en Supabase con TTL; la UI solo consulta
  usuarios visibles del chat/equipo abierto. El contador global se muestra en el
  menú de cuenta únicamente después de que `is_global_owner()` confirme en
  Supabase el correo exacto `elvissebas39@gmail.com`. Hasta aplicar la migración
  de escalabilidad se conserva el fallback compatible al canal anterior.
- El contenido privado se cifra en el navegador con AES-256-GCM después de
  derivar la clave con PBKDF2 desde una frase maestra independiente de Google.
  La frase y las claves derivadas no se envían nunca a Supabase. Para no
  escribirla en cada recarga se cachea en `sessionStorage` (nunca en
  `localStorage`): el navegador la descarta al cerrar la pestaña, de modo que no
  queda una llave maestra en el disco. La clave AES que se vuelve a derivar es
  la misma, así que **las credenciales, enlaces, notas e imágenes ya cifrados se
  abren sin migración**. Ver el detalle del modelo en **[SECURITY.md](./SECURITY.md)**.
- Credenciales, enlaces, notas, historial y copias compartidas se almacenan
  en `encrypted_payload`. Para los equipos, la clave AES se envuelve con la
  clave pública RSA de cada miembro. Las claves privadas de usuario están
  cifradas con la clave AES del Vault.
- Las filas nuevas nacen cifradas; las filas antiguas se migran y limpian
  progresivamente cuando el usuario las abre después de desbloquear el Vault.
  Hasta esa migración, el propietario de Supabase todavía puede ver esas filas
  heredadas en claro.
- RLS sigue protegiendo qué filas puede consultar cada usuario. El propietario
  del proyecto Supabase puede ver el ciphertext y los metadatos (fechas,
  favoritos, categorías y relaciones), pero no la frase maestra ni las claves
  AES con las que se descifra.
- El modelo no protege contra malware, una extensión comprometida, una sesión
  ya robada o un dispositivo desbloqueado mientras se usa la aplicación. Si
  alguien controla también el hosting o el código frontend, podría publicar
  una versión maliciosa que capture la frase maestra; el cifrado protege los
  datos almacenados, no un frontend comprometido.
- Headers de seguridad en producción via `vercel.json`: CSP, HSTS,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- `robots.txt` con `Disallow: /` + `meta noindex` (contenido privado).
- `.env` ignorado por git; solo existe `.env.example` en el repo.
- **Portapapeles**: se limpia 30 s tras copiar una clave (si nadie la
  sobrescribió antes).
- **Inactividad**: la sesión se cierra a los 15 min sin interacción.

## ☁️ Despliegue (GitHub → Vercel)

Sin dominio propio no hay problema: Vercel da uno gratis `*.vercel.app`.

### 1. GitHub

```bash
git init
git add .
git commit -m "feat: Workvaul inicial"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/Workvaul.git
git push -u origin main
```

### 2. Vercel

1. [vercel.com/new](https://vercel.com/new) → _Import Git Repository_ → Workvaul.
2. Framework: **Vite** (detecta solo). Build: `npm run build` · Output: `dist`.
3. En **Settings → Environment Variables**, para **Production**:
   - `VITE_SUPABASE_URL` = `https://yugynaktiicspzzestdl.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<anon key pública>`
   - `VITE_APP_URL` = `https://workvaul.vercel.app` (también viene fijado en
     `vercel.json`; si usas otro dominio, cambia ambos o la variable).
4. Después de crear o cambiar variables, haz **Redeploy** (Deployments → ⋯ →
   Redeploy): Vite las incrusta en el build, no se leen en runtime.
5. El dominio público actual es `https://workvaul.vercel.app`.

> `VITE_APP_URL` fija el origen de todas las redirecciones de Supabase. Sin
> esta variable la app usa el origen desde el que se abrió, pero `vercel.json`
> la fija en producción para evitar depender de `localhost`. Los previews
> también usarán ese origen público; si necesitas que un preview funcione por
> separado, cambia temporalmente el valor y autoriza su URL en Supabase.

> **Cuidado con los valores**: un typo, comillas pegadas o una variable vacía
> rompe la conexión. Compáralos con **Supabase → Project Settings → API** y
> vuelve a desplegar después de cualquier corrección.

> `vercel.json` incluye el rewrite SPA: `/login` y `/workspaces` funcionan también
> al recargar o abrir la aplicación desde otro dispositivo.

### 3. Supabase: Google y URLs (corrige `localhost rechazado`)

En **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://workvaul.vercel.app`
- **Redirect URLs**:
  - `https://workvaul.vercel.app/login`
  - `https://workvaul.vercel.app/workspaces`
- Para desarrollo local: `http://localhost:5173/**`
- Para previews de Vercel: `https://workvaul-*.vercel.app/**`

En **Supabase → Authentication → Providers → Google**, activa el proveedor y
configura el `Client ID` y `Client Secret` del proyecto OAuth de Google Cloud.
Allí deben coincidir exactamente:

- **Authorized JavaScript origins**: `https://workvaul.vercel.app`
- **Authorized redirect URIs**:
  `https://yugynaktiicspzzestdl.supabase.co/auth/v1/callback`

El callback de Google siempre apunta a Supabase; después Supabase vuelve a
`/login` en Workvaul. Si Google termina en `localhost`, normalmente el **Site
URL** sigue en `localhost:3000` o falta `/login` en **Redirect URLs**. No escribas
`localhost` como destino público en producción.

### 4. Supabase: solo Google por ahora

El acceso público de Workvaul utiliza únicamente Google OAuth. No hay una interfaz
para crear cuentas, iniciar sesión con correo/contraseña ni recuperar contraseñas.

En **Supabase → Authentication → Providers → Email**, desactiva el proveedor
Email cuando quieras bloquear también el acceso directo por email desde cualquier
cliente. Esto no elimina las cuentas existentes; solo deja de ofrecer ese método
de acceso. La configuración SMTP queda reservada para una futura fase en la que
se vuelva a habilitar correo, si se necesita.

No pongas credenciales SMTP en `.env`, en VITE ni en Vercel: se configuran solo
en el panel de Supabase. Para esta etapa no son necesarias.

## 📈 Escalabilidad Supabase

La aplicación deja de depender de un canal global de presencia y de cargas
masivas al iniciar. La migración `supabase/schema-scalability.sql` añade:

- índices compuestos para Vault, Equipos, Chat e historial;
- `user_presence` con heartbeat individual y TTL de 90 segundos;
- consultas de presencia únicamente para usuarios visibles;
- snapshots RPC para Vault, Equipos, lista de conversaciones e historial;
- paginación lógica del historial a 200 mensajes por conversación;
- code-splitting de rutas, Chat y exportación Excel.

### Ejecutar la migración

1. Haz una copia de seguridad de la base de datos.
2. En Supabase abre **SQL Editor → New query**.
3. Ejecuta `supabase/schema-scalability.sql` después de `schema-chat-v3.sql`.
4. Confirma que termina sin errores y que Supabase muestra las funciones RPC
   nuevas en **Database → Functions**.
5. Ejecuta `supabase/schema-encryption.sql` **después de `schema-scalability.sql`**.
   Es el último script y es idempotente: añade las columnas de cifrado,
   `parent_id`/`sort_order`, el índice de categorías, el bucket privado
   `vault-attachments` y sus políticas `authenticated`, y las columnas de la
   clave de recuperación (`recovery_salt`, `recovery_iterations`,
   `recovery_verifier`, `encrypted_recovery_key`). No elimina filas.
   Al ser idempotente, si ya lo habías ejecutado, vuelve a lanzarlo para añadir
   esas cuatro columnas.
6. Vuelve a desplegar la aplicación y prueba el menú de cuenta, el chat y una
   conversación.

La migración es idempotente y no elimina datos. El cliente conserva un fallback
temporal al canal anterior si todavía no se ha aplicado, por lo que el
deployment y la migración pueden ordenarse sin dejar la app rota.

### Primera puesta en marcha del Vault cifrado

1. Cada usuario inicia sesión con Google.
2. En la primera pantalla crea una frase maestra de al menos 12 caracteres.
3. La frase no se envía a Google ni a Supabase.
4. Desde el menú de cuenta → **Clave de recuperación…** genera 12 palabras y
   anótalas fuera del ordenador. Sólo después de marcar la casilla se guarda en
   el servidor una copia de tu clave AES cifrada con ellas. Si pierdes la frase,
   introduces esas 12 palabras en «No recuerdo mi frase maestra».
5. Las filas antiguas se cifran de forma progresiva cuando el usuario las abre,
   siempre que la frase maestra siga disponible. No se puede migrar el
   contenido existente desde SQL porque el servidor no conoce esa clave.

### Qué sigue siendo una prioridad

- Para el uso local de aproximadamente 100 usuarios, la arquitectura queda
  preparada para clientes, Vault/chat bajo demanda y presencia acotada.
- No hay una garantía de capacidad hasta medir el plan de Supabase, el número de
  credenciales por cuenta, mensajes enviados y conexiones simultáneas.
- Probar la recuperación de la frase maestra, la migración progresiva de datos
  antiguos y el reparto de claves de equipo con usuarios reales antes de abrir
  el servicio ampliamente.
- Para más de 100–300 simultáneos, activa límites y alertas de Supabase, ejecuta
  pruebas k6/Artillery y considera Redis/colas solo cuando las métricas lo
  indiquen.

## 🗺 Roadmap (plus de seguridad)

- [x] **Cifrado cliente AES-256-GCM** con frase maestra, PBKDF2 y claves RSA
      para credenciales, enlaces, notas, historial y copias compartidas.
- [x] **Migración progresiva** de filas antiguas: el cliente cifra y limpia las
      columnas plaintext al abrirlas con la clave del Vault.
- [x] Cierre de sesión por inactividad (15 min sin interacción).
- [x] Importación de respaldos (Bitwarden, Chrome, 1Password, LastPass, .xlsx).
- [x] Historial de versiones de claves.
- [x] Espacios compartidos con roles: invitación por correo y reclamación
      automática al iniciar sesión con Google.
- [x] Chat interno en tiempo real con RLS, sanitización XSS, búsqueda de
      usuarios, historial bajo demanda y presencia con permisos.
- [x] Optimización de carga: snapshots atómicos, índices compuestos, carga
      diferida de Links/Notas/Chat y code-splitting de rutas.
- [x] Medidor de fuerza de claves (implementación propia en
      `src/lib/password-strength.ts`).
- [x] Limpieza automática del portapapeles al copiar una clave (30 s).

## 📁 Estructura

```
src/
├── app/          # App, rutas, AuthContext, RequireAuth
├── components/   # layout/, chat/, credentials/, links/, notes/, attachments/, import/, ui/
├── pages/        # Login, Credentials, Links, Notes, Workspaces
├── store/        # Zustand: vault, workspace, chat, search, ui
├── lib/          # supabase, sanitize, auth-errors, generator, vault-excel...
├── hooks/        # useClipboard, useIdleSignOut, usePresence
└── types/
supabase/
├── schema.sql            # tablas principales + RLS
├── schema-content.sql    # links y notas + RLS
├── schema-history.sql    # historial de claves + RLS
├── schema-sharing.sql    # equipos / espacios compartidos + RLS
├── schema-chat.sql       # chat, presencia, RLS y publicación Realtime
├── schema-chat-v2.sql    # privacidad, notificaciones y edición/eliminación
├── schema-chat-v3.sql     # búsqueda global de personas y refresco de PostgREST
├── schema-scalability.sql  # índices, presencia TTL y snapshots de lectura
└── schema-encryption.sql   # AES-GCM, PBKDF2, claves RSA y ciphertext
```
