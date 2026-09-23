# 🔒 Security Policy · WorkVault

## Modelo de seguridad

WorkVault es una SPA (React + Vite) con **Supabase** como backend. Entender el
modelo evita falsos positivos al reportar vulnerabilidades:

- **La `anon key` es pública por diseño.** Va embebida en el bundle
  (`VITE_SUPABASE_ANON_KEY`). No es una filtración: la protección real es
  **Row Level Security (RLS)** en cada tabla (`auth.uid() = user_id`,
  ver `supabase/schema.sql`). Solo el dueño de las filas puede leerlas o
  escribirlas.
- **No hay backend propio.** Toda la lógica de servidor vive en Supabase
  (Auth, Postgres + RLS).
- **Las contraseñas de las credenciales se guardan en texto plano en la base**
  (comentario "Fase 2" en `schema.sql`). El cifrado cliente (AES-GCM) está en
  el roadmap; hasta entonces, el riesgo asumido es: quien tenga acceso ADMIN a
  Supabase podría leerlas. El acceso desde la app está protegido por RLS.
- **Contraseñas de usuario y sesiones:** las gestiona Supabase Auth
  (hash bcrypt/argon2, tokens rotados). Google OAuth delega en Google.

## Controles implementados

| Capa | Control |
| --- | --- |
| Datos | RLS activo en `vault_sections`, `vault_categories`, `vault_credentials` |
| Transporte | HTTPS obligatorio (Supabase y Vercel) + HSTS |
| Browser | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (ver `vercel.json`) |
| Secretos | `.env` fuera de git (`.gitignore`); solo variables `VITE_*` (públicas) |
| Auth | Email/password + Google OAuth, reset por enlace con caducidad, validación de errores sin filtrar detalles |
| Indexación | `robots.txt` con `Disallow: /` + `meta noindex` |

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
