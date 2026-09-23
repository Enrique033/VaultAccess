# 🗄️ WorkVault

Bóveda privada para gestionar **credenciales, enlaces y notas** en un solo
lugar. SPA construida con React + Vite + Tailwind, autenticada con **Supabase
Auth** (email/password y Google OAuth) y protegida con **Row Level Security**.

## ✨ Características

- Auth completa: registro, login, **"¿Olvidaste tu contraseña?"** por email y
  login con **Google**.
- Secciones → categorías → credenciales, con búsqueda, favoritos y orden.
- Tema claro/oscuro, toasts (sonner), formularios con `react-hook-form` + `zod`.
- RLS: cada usuario solo ve **sus** filas (`supabase/schema.sql`).

## 🛠 Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · React Router 7 · Zustand ·
Supabase (Postgres + Auth) · Radix UI · Zod · ESLint + Prettier

## 🚀 Arranque local

```bash
# 1. Dependencias
npm install

# 2. Variables de entorno
cp .env.example .env      # y completa VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

# 3. Base de datos: ejecuta supabase/schema.sql en
#    Supabase Dashboard → SQL Editor → New query

# 4. Desarrollo
npm run dev               # http://localhost:5173
```

### Scripts

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Type-check (`tsc -b`) + build de producción |
| `npm run lint` | ESLint |
| `npm run preview` | Vista previa del build |

## 🔐 Seguridad

Ver **[SECURITY.md](./SECURITY.md)** para el modelo completo. Resumen:

- **RLS activo** en las 3 tablas: `using`/`with check` con `auth.uid() = user_id`.
- La `anon key` es pública **por diseño**; la protección real es RLS.
- Headers de seguridad en producción via `vercel.json`: CSP, HSTS,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- `robots.txt` con `Disallow: /` + `meta noindex` (bóveda privada).
- `.env` ignorado por git; solo existe `.env.example` en el repo.

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

1. [vercel.com/new](https://vercel.com/new) → *Import Git Repository* → WorkVault.
2. Framework: **Vite** (detecta solo). Build: `npm run build` · Output: `dist`.
3. **Environment Variables** (Settings → Environment Variables):
   - `VITE_SUPABASE_URL` = `https://tu-proyecto.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<anon key>`
4. Deploy → obtienes `https://workvault.vercel.app` (o similar).

> `vercel.json` ya incluye el rewrite SPA: recargar `/login` o
> `/reset-password` funciona sin 404.

### 3. Checklist Supabase para producción

Cuando ya tengas la URL de Vercel:

- [ ] **Authentication → URL Configuration → Site URL**: `https://<tu-app>.vercel.app`
- [ ] **Redirect URLs**: añadir `https://<tu-app>.vercel.app/login` y
      `https://<tu-app>.vercel.app/reset-password`
- [ ] **Providers → Google**: *Authorized JavaScript origins* +=
      `https://<tu-app>.vercel.app` (la redirect URI de Google **no** cambia:
      sigue siendo `https://<proyecto>.supabase.co/auth/v1/callback`)
- [ ] **Emails**: revisar plantilla de "Reset password" (opcional: traducirla)
- [ ] **Providers → Email**: "Confirm email" activado
- [ ] Tras cambiar Site URL, probar en producción: registro, login Google y
      reset password

## 🗺 Roadmap (plus de seguridad)

- [ ] **Cifrado cliente AES-GCM** de contraseñas antes de sincronizar
      (fase 2 anotada en `schema.sql`).
- [ ] Bloqueo de la bóveda por inactividad.
- [ ] Medidor de fuerza de contraseña (zxcvbn).
- [ ] Limpieza automática del portapapeles al copiar una contraseña.

## 📁 Estructura

```
src/
├── app/          # App, rutas, AuthContext, RequireAuth
├── components/   # layout/ (shell), credentials/, ui/ (primitivas)
├── pages/        # Login, ResetPassword, Credentials...
├── store/        # Zustand: vault, search, ui
├── lib/          # supabase, auth-errors, mappers...
└── types/
supabase/
└── schema.sql    # tablas + RLS
```

