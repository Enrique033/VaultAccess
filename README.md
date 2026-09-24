# 🗄️ WorkVault

Espacio privado para gestionar **accesos, enlaces y notas** en un solo
lugar. SPA construida con React + Vite + Tailwind, autenticada con **Supabase
Auth** (email/password y Google OAuth) y protegida con **Row Level Security**.

## ✨ Características

- Auth completa: registro, login, **"¿Olvidaste tu clave?"** por email y
  login con **Google**.
- **Secciones → categorías → credenciales**, con búsqueda (Ctrl+K), favoritos
  y orden.
- **Links y Notas** completos: tarjetas, CRUD, favoritos, búsqueda y filtros
  (tablas `vault_links` / `vault_notes` con RLS).
- **Generador de claves** (crypto.getRandomValues) con longitud 8–48,
  conjuntos de caracteres y exclusión de ambiguos.
- **Medidor de fuerza** en registro, reset, cambio de clave y credenciales.
- **Historial de claves**: cada cambio guarda la versión anterior (las 20
  últimas) y puedes restaurarla desde el diálogo de la credencial
  (`supabase/schema-history.sql`).
- **Equipos (espacios compartidos)**: invita por email con rol (_propietario_,
  _puede editar_, _solo lectura_) y comparte solo las credenciales que decidas.
  Al invitar se env�a al correo un enlace m�gico de acceso (requiere que el
  proveedor **Email** de Supabase est� activo) y, al abrirlo, el invitado reclama
  la invitaci�n autom�ticamente (`supabase/schema-sharing.sql`).
- **Chat interno en tiempo real**: panel claro/oscuro con pestañas **Equipo** y
  **Búsqueda**, conversaciones privadas, mensajes sanitizados y suscripción a
  `chat_messages` mediante Supabase Realtime (`supabase/schema-chat.sql`).
- **Presencia en tiempo real**: canal `online-users`, indicadores individual
  verde/gris y contador de equipo solo para propietarios. El contador global
  se habilita mediante una RPC server-side únicamente para
  `elvissebas39@gmail.com`.
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
- **Presencia**: el canal `online-users` solo muestra presencia; el badge global
  se renderiza únicamente después de que `is_global_owner()` confirme en
  Supabase el correo exacto `elvissebas39@gmail.com`. Los owners de equipo
  ven únicamente su contador `[Equipo Online: X/Y]`.
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

> `vercel.json` incluye el rewrite SPA: `/login`, `/reset-password` y
> `/workspaces` funcionan también al recargar o abrir un enlace de correo.

### 3. Supabase: Google y URLs (corrige `localhost rechazado`)

En **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://workvaul.vercel.app`
- **Redirect URLs**:
  - `https://workvaul.vercel.app/login`
  - `https://workvaul.vercel.app/reset-password`
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

### 4. Supabase: confirmación de correo (corrige “nunca llega”)

El SMTP incluido por defecto **no es para producción**: según la documentación
de Supabase, solo entrega a correos previamente autorizados del equipo y tiene
un límite best-effort de **2 correos por hora**. Por eso `signUp` puede crear la
cuenta aunque el correo de un usuario externo no llegue.

Para registro con correo a usuarios reales:

1. Contrata un SMTP compatible (Resend, AWS SES, Postmark, SendGrid, Brevo, etc.).
2. Verifica el dominio o el remitente que usarás.
3. En **Supabase → Authentication → SMTP Settings**, activa el SMTP personalizado
   y completa host, puerto, usuario, contraseña y remitente.
4. Mantén **Authentication → Email → Confirm email** activado.
5. Revisa **Authentication → Logs** y confirma que el remitente esté autorizado.
6. Prueba con una dirección externa a la organización y un registro nuevo.

No pongas credenciales SMTP en `.env`, en VITE ni en Vercel: se configuran solo
en el panel de Supabase. Mientras SMTP no esté configurado, **Continuar con
Google** puede usarse si el alta de Google marca el correo como verificado; el
registro por correo requiere un SMTP personalizado para producción.

## 🗺 Roadmap (plus de seguridad)

- [ ] **Cifrado cliente AES-GCM** de las claves antes de sincronizar
      (fase 2 anotada en `schema.sql`).
- [x] Cierre de sesión por inactividad (15 min sin interacción).
- [x] Importación de respaldos (Bitwarden, Chrome, 1Password, LastPass, .xlsx).
- [x] Historial de versiones de claves.
- [x] Espacios compartidos con roles: invitación por email con enlace mágico y
      reclamación automática al iniciar sesión.
- [x] Chat interno en tiempo real con RLS, sanitización XSS y búsqueda de
      usuarios; presencia individual y métricas con permisos.
- [x] Medidor de fuerza de claves (implementación propia en
      `src/lib/password-strength.ts`).
- [x] Limpieza automática del portapapeles al copiar una clave (30 s).

## 📁 Estructura

```
src/
├── app/          # App, rutas, AuthContext, RequireAuth
├── components/   # layout/, chat/, credentials/, links/, notes/, import/, ui/
├── pages/        # Login, ResetPassword, Credentials, Links, Notes, Workspaces
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
└── schema-chat-v3.sql    # búsqueda global de personas y refresco de PostgREST
```
