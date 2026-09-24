# 🗄️ WorkVault

Espacio privado para gestionar **accesos, enlaces y notas** en un solo
lugar. SPA construida con React + Vite + Tailwind, autenticada con **Supabase
Auth** (Google OAuth) y protegida con **Row Level Security**.

## ✨ Características

- Acceso único con **Google OAuth**. No hay registro, login ni recuperación por
  correo/contraseña en la interfaz actual.
- **Secciones → categorías → credenciales**, con búsqueda (Ctrl+K), favoritos
  y orden.
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
- **Chat aislado**: `chat_conversations`, `chat_conversation_participants` y
  `chat_messages` no contienen credenciales; cada lectura/escritura exige ser
  participante y la creación de conversaciones directas pasa por una RPC
  `SECURITY DEFINER` validada. El texto se sanea en cliente y servidor.
- **Presencia**: heartbeat privado en Supabase con TTL; la UI solo consulta
  usuarios visibles del chat/equipo abierto. El contador global se muestra en el
  menú de cuenta únicamente después de que `is_global_owner()` confirme en
  Supabase el correo exacto `elvissebas39@gmail.com`. Hasta aplicar la migración
  de escalabilidad se conserva el fallback compatible al canal anterior.
- La `anon key` es pública **por diseño**; la protección real es RLS.
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
git commit -m "feat: WorkVault inicial"
git branch -M main
git remote add origin https://github.com/<tu-usuario>/WorkVault.git
git push -u origin main
```

### 2. Vercel

1. [vercel.com/new](https://vercel.com/new) → _Import Git Repository_ → WorkVault.
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
`/login` en WorkVault. Si Google termina en `localhost`, normalmente el **Site
URL** sigue en `localhost:3000` o falta `/login` en **Redirect URLs**. No escribas
`localhost` como destino público en producción.

### 4. Supabase: solo Google por ahora

El acceso público de WorkVault utiliza únicamente Google OAuth. No hay una interfaz
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
5. Recarga la aplicación y prueba el menú de cuenta, el chat y una conversación.

La migración es idempotente y no elimina datos. El cliente conserva un fallback
temporal al canal anterior si todavía no se ha aplicado, por lo que el
deployment y la migración pueden ordenarse sin dejar la app rota.

### Qué sigue siendo una prioridad

- Para el uso local de aproximadamente 100 usuarios, la arquitectura queda
  preparada para clientes, Vault/chat bajo demanda y presencia acotada.
- No hay una garantía de capacidad hasta medir el plan de Supabase, el número de
  credenciales por cuenta, mensajes enviados y conexiones simultáneas.
- Antes de una apertura pública amplia, cifra las credenciales en cliente: hoy
  siguen almacenadas en texto plano aunque RLS proteja el acceso desde la app.
- Para más de 100–300 simultáneos, activa límites y alertas de Supabase, ejecuta
  pruebas k6/Artillery y considera Redis/colas solo cuando las métricas lo
  indiquen.

## 🗺 Roadmap (plus de seguridad)

- [ ] **Cifrado cliente AES-GCM** de las claves antes de sincronizar
      (fase 2 anotada en `schema.sql`).
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
├── components/   # layout/, chat/, credentials/, links/, notes/, import/, ui/
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
└── schema-scalability.sql  # índices, presencia TTL y snapshots de lectura
```
