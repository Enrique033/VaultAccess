-- ============================================================
-- Workvaul · Cifrado de extremo a extremo
-- Ejecutar DESPUÉS de schema-scalability.sql.
-- No elimina datos: primero añade ciphertext y conserva las columnas
-- antiguas durante la migración de los datos existentes.
--
-- IMPORTANTE: ejecuta el archivo ENTERO, de la primera a la última línea, con
-- la versión más reciente. Si lo partes o usas una copia antigua, puede fallar
-- con "column archived_at does not exist": las columnas y la función que las
-- lee tienen que estar en la misma ejecución.
--
-- Este archivo NO lleva consultas de comprobación a propósito: cualquier
-- sentencia que falle aquí aborta la migración entera. Para revisar el estado
-- de la base antes de ejecutarlo, usa supabase/check-archive-schema.sql (sólo
-- SELECT, se puede lanzar cuando quieras y nunca rompe nada).
-- ============================================================

-- 1) Configuración criptográfica por usuario.
-- La clave privada se almacena cifrada con la clave AES derivada de la
-- frase maestra. Esta tabla nunca contiene la frase maestra.
create table if not exists public.vault_crypto_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1 check (version = 1),
  iterations integer not null check (iterations >= 100000),
  salt text not null,
  verifier text not null,
  public_key text not null,
  encrypted_private_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crypto_keys_user
  on public.vault_crypto_keys (user_id);

alter table public.vault_crypto_keys enable row level security;

drop policy if exists "own_crypto_keys_all" on public.vault_crypto_keys;
create policy "own_crypto_keys_all"
  on public.vault_crypto_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on table public.vault_crypto_keys from public, anon;
grant select, insert, update, delete on table public.vault_crypto_keys to authenticated;

-- 1-bis) Clave de recuperación (opcional, la crea el usuario).
--
-- Guardar la frase maestra en el servidor permitiría al dueño del proyecto leer
-- el Vault, así que NO se guarda. En su lugar se guarda una COPIA de la clave
-- AES del Vault, cifrada con una clave derivada de 12 palabras aleatorias que
-- sólo el usuario ve y anota.
--
-- El servidor almacena un sobre opaco: no conoce las palabras ni la frase
-- maestra. Si se pierde la frase, las palabras recuperan la clave AES y con
-- ella se abren los registros ya cifrados (no hay que re-cifrar nada).
--
-- Las columnas son nullable: las cuentas creadas antes de esta migración
-- siguen funcionando y simplemente aún no tienen clave de recuperación.
alter table public.vault_crypto_keys
  add column if not exists recovery_salt text;

alter table public.vault_crypto_keys
  add column if not exists recovery_iterations integer
  check (recovery_iterations is null or recovery_iterations >= 100000);

alter table public.vault_crypto_keys
  add column if not exists recovery_verifier text;

alter table public.vault_crypto_keys
  add column if not exists encrypted_recovery_key text;

comment on column public.vault_crypto_keys.encrypted_recovery_key is
  'Copia de la clave AES del Vault cifrada con una clave derivada de 12 palabras de recuperación. Vacía = la cuenta no tiene clave de recuperación.';

-- 2) Clave AES de cada espacio, envuelta con la clave pública RSA de cada
-- miembro. El propietario debe distribuir la clave al invitar o sincronizar.
create table if not exists public.vault_workspace_keys (
  workspace_id uuid not null references public.vault_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wrapped_key text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_keys_user
  on public.vault_workspace_keys (user_id, workspace_id);

alter table public.vault_workspace_keys enable row level security;

drop policy if exists "workspace_keys_select_own" on public.vault_workspace_keys;
drop policy if exists "workspace_keys_owner_manage" on public.vault_workspace_keys;

create policy "workspace_keys_select_own"
  on public.vault_workspace_keys for select
  using (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "workspace_keys_owner_manage"
  on public.vault_workspace_keys for all
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

revoke all on table public.vault_workspace_keys from public, anon;
grant select, insert, update, delete on table public.vault_workspace_keys to authenticated;

-- 3) Columnas de ciphertext para todo el contenido privado.
-- Las columnas en claro quedan nullable durante la transición; la app
-- escribe nuevas filas con encrypted_payload y limpia las columnas antiguas.
alter table public.vault_sections
  add column if not exists encrypted_payload text;
alter table public.vault_sections alter column name drop not null;

alter table public.vault_categories
  add column if not exists encrypted_payload text;
alter table public.vault_categories alter column name drop not null;

alter table public.vault_credentials
  add column if not exists encrypted_payload text;
alter table public.vault_credentials alter column title drop not null;
alter table public.vault_credentials alter column username drop not null;
alter table public.vault_credentials alter column password drop not null;

alter table public.vault_links
  add column if not exists encrypted_payload text;
alter table public.vault_links alter column title drop not null;
alter table public.vault_links alter column url drop not null;

alter table public.vault_notes
  add column if not exists encrypted_payload text;
alter table public.vault_notes alter column title drop not null;
alter table public.vault_notes alter column content drop not null;

alter table public.vault_password_history
  add column if not exists encrypted_payload text;
alter table public.vault_password_history alter column password drop not null;

alter table public.vault_workspace_items
  add column if not exists encrypted_payload text;
alter table public.vault_workspace_items alter column title drop not null;
alter table public.vault_workspace_items alter column username drop not null;
alter table public.vault_workspace_items alter column password drop not null;

alter table public.vault_categories
  add column if not exists parent_id uuid
    references public.vault_categories(id) on delete cascade;
alter table public.vault_categories
  add column if not exists sort_order integer not null default 0;

create index if not exists idx_categories_section_parent_sort
  on public.vault_categories (section_id, parent_id, sort_order, id);
-- =====================================================================
-- COLUMNAS INDEPENDIENTES POR MÓDULO
-- ---------------------------------------------------------------------
-- `vault_categories` era una única bolsa compartida por Access, Links y
-- Notas: renombrar una columna en Access la renombraba en los tres sitios.
-- Cada módulo (credential | link | note) tiene ahora sus propias columnas.
--
-- Idempotente: se puede reejecutar sin efectos.
-- =====================================================================

alter table public.vault_categories
  add column if not exists module text not null default 'credential';

-- Archivado de columnas: una columna archivada desaparece del tablero pero NO se
-- borra, y sus registros siguen apuntando a ella. Así, al restaurarla, vuelve
-- con todas sus tarjetas donde estaban. Sólo se gestionan desde el panel
-- «Archivados» (icono de cuenta): restaurar o eliminar.
--
-- `null` = columna activa. La fecha guarda cuándo se archivó, para poder
-- ordenarlas por antigüedad en ese panel.
alter table public.vault_categories
  add column if not exists archived_at timestamptz;

-- Las categorías existentes se asignan a Access, donde se crearon.
update public.vault_categories
   set module = 'credential'
 where module is null;

-- OJO: aquí NO se sueltan los enlaces y notas que apuntaran a una columna de
-- Access. Hacerlo con `auth.uid()` no funciona desde el SQL Editor de Supabase
-- (allí `auth.uid()` es NULL y el update no toca ninguna fila), y desde la app
-- tampoco hace falta: la propia aplicación ya impide que un registro se guarde
-- en una columna de otro tablero. La limpieza de los datos que quedaron mal
-- antes del arreglo está en supabase/fix-category-modules.sql.

create index if not exists idx_categories_module_sort
  on public.vault_categories (user_id, module, section_id, parent_id, sort_order);

-- Índice del panel de archivados: sólo las columnas con `archived_at` puesto.
create index if not exists idx_categories_archived
  on public.vault_categories (user_id, archived_at desc)
  where archived_at is not null;


comment on column public.vault_categories.parent_id is
  'Categoría padre; null para una raíz de la sección.';
comment on column public.vault_categories.sort_order is
  'Orden estable entre categorías hermanas.';
comment on column public.vault_categories.archived_at is
  'Fecha de archivado. No es un borrado: la columna y sus registros siguen ahí y se recuperan desde el panel de Archivados.';
comment on column public.vault_credentials.archived_at is
  'Fecha de archivado de la credencial. Se recupera o se elimina desde el panel de Archivados.';
comment on column public.vault_links.archived_at is
  'Fecha de archivado del enlace. Se recupera o se elimina desde el panel de Archivados.';
comment on column public.vault_notes.archived_at is
  'Fecha de archivado de la nota. Se recupera o se elimina desde el panel de Archivados.';

comment on table public.vault_crypto_keys is
  'Configuración E2EE por usuario. No contiene la frase maestra ni la clave AES en claro.';
comment on table public.vault_workspace_keys is
  'Claves AES de espacios cifradas con la clave pública RSA de cada miembro.';
comment on column public.vault_credentials.encrypted_payload is
  'Credencial completa cifrada en el navegador con AES-GCM.';

-- 4) Imágenes cifradas en Storage. El bucket es privado y cada objeto
-- vive bajo {auth.uid()}/<tipo>/<registro>/<id>.bin. El cliente guarda
-- únicamente metadata cifrada dentro de encrypted_payload.
insert into storage.buckets (id, name, public)
values ('vault-attachments', 'vault-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "vault_attachments_select_own" on storage.objects;
drop policy if exists "vault_attachments_insert_own" on storage.objects;
drop policy if exists "vault_attachments_delete_own" on storage.objects;

create policy "vault_attachments_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'vault-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vault_attachments_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'vault-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "vault_attachments_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'vault-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Las políticas de este bucket sólo se aplican a authenticated y a la carpeta
-- del usuario; no se modifican los permisos globales de otros buckets.

-- 5) Reconstruye el snapshot del Vault para incluir explícitamente el
-- ciphertext. Así el cliente puede descifrar filas nuevas aunque la función
-- originalmente se haya creado antes de schema-encryption.sql.
-- Archivado de REGISTROS: credenciales, enlaces y notas también se archivan,
-- no sólo las columnas. Una tarjeta archivada sale del tablero y se queda en el
-- panel «Archivados», sin perder su columna de origen ni sus adjuntos.
--
-- Al archivar una columna, sus registros se archivan con ella: así nada aparece
-- de golpe en «Sin categoría», que es lo que desconcierta. Al recuperarla,
-- vuelven los que sigan archivados, cada uno a la misma columna.
--
-- `null` = registro activo.
alter table public.vault_credentials add column if not exists archived_at timestamptz;
alter table public.vault_links       add column if not exists archived_at timestamptz;
alter table public.vault_notes       add column if not exists archived_at timestamptz;

create index if not exists idx_credentials_archived
  on public.vault_credentials (user_id, archived_at desc)
  where archived_at is not null;
create index if not exists idx_links_archived
  on public.vault_links (user_id, archived_at desc)
  where archived_at is not null;
create index if not exists idx_notes_archived
  on public.vault_notes (user_id, archived_at desc)
  where archived_at is not null;

-- Las credenciales viajan en el snapshot del Vault: sin `archived_at` aquí el
-- cliente no podría distinguirlas de las activas.
create or replace function public.get_vault_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'sections', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'user_id', v.user_id,
          'name', v.name,
          'encrypted_payload', v.encrypted_payload,
          'created_at', v.created_at
        ) order by v.created_at, v.id
      ) from public.vault_sections v),
      '[]'::jsonb
    ),
    'categories', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'user_id', c.user_id,
          'section_id', c.section_id,
          'parent_id', c.parent_id,
          'sort_order', c.sort_order,
          'module', c.module,
          -- Sin `archived_at` el cliente no sabría qué columnas están
          -- archivadas y las mostraría todas en el tablero.
          -- Igual que en credenciales: sin referencia directa para que la
          -- creación de la función no dependa del orden de ejecución.
          to_jsonb(c) ->> 'archived_at'       as archived_at,
          'name', c.name,
          'color', c.color,
          'encrypted_payload', c.encrypted_payload,
          'created_at', c.created_at
        ) order by c.created_at, c.id
      ) from public.vault_categories c),
      '[]'::jsonb
    ),
    'credentials', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', cr.id,
          'user_id', cr.user_id,
          'category_id', cr.category_id,
          'title', cr.title,
          'username', cr.username,
          'password', cr.password,
          'url', cr.url,
          'notes', cr.notes,
          'favorite', cr.favorite,
          -- `to_jsonb(cr) ->> 'archived_at'` en vez de `cr.archived_at`: la
          -- función se valida al crearse, y si esta consulta se ejecutara antes
          -- de añadir la columna (copia antigua del script, ejecución a medias)
          -- el CREATE FUNCTION fallaría y abortaría TODO el archivo. Con to_jsonb
          -- no hay referencia en tiempo de compilación: si la columna no está,
          -- devuelve NULL y el resto del script sigue adelante.
          to_jsonb(cr) ->> 'archived_at'      as archived_at,
          'encrypted_payload', cr.encrypted_payload,
          'created_at', cr.created_at,
          'updated_at', cr.updated_at
        ) order by cr.updated_at desc, cr.id desc
      ) from public.vault_credentials cr),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.get_vault_snapshot() from public, anon;
grant execute on function public.get_vault_snapshot() to authenticated;

-- 6) RPC pública: solo devuelve claves públicas, nunca material privado.
create or replace function public.get_vault_public_keys(target_user_ids uuid[])
returns table (user_id uuid, public_key text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return query
    select k.user_id, k.public_key
    from public.vault_crypto_keys k
    where k.user_id = any(coalesce(target_user_ids, '{}'::uuid[]));
end;
$$;

revoke all on function public.get_vault_public_keys(uuid[]) from public, anon;
grant execute on function public.get_vault_public_keys(uuid[]) to authenticated;

notify pgr, 'reload schema';

-- ======================================================================
-- FIN DE LA MIGRACIÓN
-- ----------------------------------------------------------------------
-- Este archivo es idempotente: se puede ejecutar entero, y todas las veces
-- que haga falta, sin efectos secundarios. NO contiene ningún borrado, así que
-- es seguro ejecutarlo tal cual (Supabase Dashboard -> SQL Editor -> New query).
--
-- Scripts opcionales, en archivos aparte para que nunca se ejecuten solos:
--   · supabase/fix-category-modules.sql -> devuelve a su tablero las columnas
--     que se crearon sin módulo (aparecían en Access) y suelta las tarjetas
--     que quedaron colgando de la columna equivocada.
--   · supabase/reset-columns.sql       -> vacía columnas y secciones.
--
