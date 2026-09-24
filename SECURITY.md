# 🔒 Security Policy · VaultAccess

## Modelo de seguridad

VaultAccess es una SPA (React + Vite) con **Supabase** como backend. Entender el
modelo evita falsos positivos al reportar vulnerabilidades:

- **La `anon key` es pública por diseño.** Va embebida en el bundle
  (`VITE_SUPABASE_ANON_KEY`). No es una filtración: la protección real es
  **Row Level Security (RLS)** en cada tabla (las políticas del Vault usan
  `auth.uid() = user_id`; las de chat usan participación explícita). Ver
  `supabase/schema.sql` y `supabase/schema-chat.sql`. En el Vault solo el dueño de
  las filas puede leerlas o escribirlas; en chat, solo los participantes.
- **No hay backend propio.** Toda la lógica de servidor vive en Supabase
  (Auth, Postgres + RLS).
- **Las claves de las cuentas se guardan en texto plano en la base**
  (comentario "Fase 2" en `schema.sql`). El cifrado cliente (AES-GCM) está en
  el roadmap; hasta entonces, el riesgo asumido es: quien tenga acceso ADMIN a
  Supabase podría leerlas. El acceso desde la app está protegido por RLS.
  Lo mismo aplica al **historial de claves** (`vault_password_history`) y a las
  **credenciales compartidas** (`vault_workspace_items`), que son copias del
  dato visible solo para los miembros del espacio.
- **Claves de usuario y sesiones:** las gestiona Supabase Auth
  (hash bcrypt/argon2, tokens rotados). Google OAuth delega en Google.

## Controles implementados

| Capa           | Control                                                                                                                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Datos          | RLS activo en las tablas del Vault, sharing, historial y `chat_conversations`, `chat_conversation_participants`, `chat_messages`                                                                                |
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
