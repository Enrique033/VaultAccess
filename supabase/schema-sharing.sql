-- ============================================================
-- WorkVault · Equipos (espacios compartidos)
-- Ejecutar DESPUÉS de schema.sql y schema-content.sql en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Modelo:
--   vault_workspaces        → espacio (nombre + propietario)
--   vault_workspace_members → miembros por email con rol (owner/editor/viewer)
--   vault_workspace_items   → copia compartida de una credencial
-- Reglas:
--   · Solo los miembros ven las filas de su espacio (RLS).
--   · Compartir COPIA el dato: el espacio nunca da acceso a tu vault
--     personal ni a elementos que no hayas compartido.
--   · Las invitaciones por email se reclaman al iniciar sesión
--     (función public.claim_workspace_invites()).
-- ============================================================

-- 1) Espacios
create table if not exists public.vault_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- 2) Miembros (`user_id` nulo = invitación pendiente de reclamar)
create table if not exists public.vault_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.vault_workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 160),
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- 3) Elementos compartidos (copia del dato, no referencia viva)
create table if not exists public.vault_workspace_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.vault_workspaces (id) on delete cascade,
  -- Credencial de origen (permite "volver a compartir" para sincronizar).
  credential_id uuid references public.vault_credentials (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  username text not null check (char_length(username) between 1 and 120),
  -- NOTA: en texto claro por ahora, igual que vault_credentials.password.
  password text not null,
  url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un email solo puede aparecer una vez por espacio (sin distinguir mayúsculas).
create unique index if not exists uniq_ws_member_email
  on public.vault_workspace_members (workspace_id, lower(email));

create index if not exists idx_ws_owner on public.vault_workspaces (owner_id);
create index if not exists idx_ws_members_ws on public.vault_workspace_members (workspace_id);
create index if not exists idx_ws_members_user on public.vault_workspace_members (user_id);
create index if not exists idx_ws_items_ws on public.vault_workspace_items (workspace_id);
create index if not exists idx_ws_items_credential on public.vault_workspace_items (credential_id);

-- 4) updated_at automático (reutiliza la función creada en schema.sql)
drop trigger if exists trg_ws_items_updated on public.vault_workspace_items;
create trigger trg_ws_items_updated
  before update on public.vault_workspace_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5) Funciones auxiliares
-- SECURITY DEFINER a propósito: dentro de una política no se puede
-- consultar la misma tabla (daría "infinite recursion detected"),
-- y así tampoco dependemos de que el usuario pueda leer auth.users.
-- ============================================================
create or replace function public.current_email()
returns text
language sql stable security definer set search_path = public as $$
  select lower(coalesce(
    nullif(auth.jwt() ->> 'email', ''),
    (select u.email from auth.users u where u.id = auth.uid())
  ))
$$;

-- ¿El usuario autenticado (por id o por email invitado) pertenece al espacio?
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    exists (
      select 1 from public.vault_workspaces w
      where w.id = ws and w.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.vault_workspace_members m
      where m.workspace_id = ws
        and (
          m.user_id = auth.uid()
          or (m.user_id is null and lower(m.email) = public.current_email())
        )
    )
$$;

-- Rol del usuario en el espacio ('owner' | 'editor' | 'viewer' | null).
create or replace function public.workspace_role(ws uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select m.role from public.vault_workspace_members m
      where m.workspace_id = ws
        and (
          m.user_id = auth.uid()
          or (m.user_id is null and lower(m.email) = public.current_email())
        )
      order by case m.role when 'owner' then 1 when 'editor' then 2 else 3 end
      limit 1
    ),
    case
      when exists (
        select 1 from public.vault_workspaces w
        where w.id = ws and w.owner_id = auth.uid()
      ) then 'owner'
    end
  )
$$;

-- Puede crear/editar/borrar elementos del espacio.
create or replace function public.can_edit_workspace(ws uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.workspace_role(ws) in ('owner', 'editor')
$$;

-- Puede gestionar miembros (invitar, cambiar rol, expulsar).
create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.workspace_role(ws) = 'owner'
$$;

revoke all on function public.current_email() from public;
revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.workspace_role(uuid) from public;
revoke all on function public.can_edit_workspace(uuid) from public;
revoke all on function public.is_workspace_owner(uuid) from public;
grant execute on function public.current_email() to anon, authenticated;
grant execute on function public.is_workspace_member(uuid) to anon, authenticated;
grant execute on function public.workspace_role(uuid) to anon, authenticated;
grant execute on function public.can_edit_workspace(uuid) to anon, authenticated;
grant execute on function public.is_workspace_owner(uuid) to anon, authenticated;

-- Reclama las invitaciones pendientes del usuario autenticado (por email).
-- Se llama al iniciar sesión; solo puede fijar su propio user_id.
create or replace function public.claim_workspace_invites()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  claimed integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  update public.vault_workspace_members m
     set user_id = auth.uid()
   where m.user_id is null
     and lower(m.email) = public.current_email();

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.claim_workspace_invites() from public;
grant execute on function public.claim_workspace_invites() to authenticated;

-- ============================================================
-- 6) RLS
-- ============================================================
alter table public.vault_workspaces enable row level security;
alter table public.vault_workspace_members enable row level security;
alter table public.vault_workspace_items enable row level security;

-- Limpieza idempotente (por si se re-ejecuta el script)
drop policy if exists "ws_select_members" on public.vault_workspaces;
drop policy if exists "ws_select_own" on public.vault_workspaces;
drop policy if exists "ws_insert_self" on public.vault_workspaces;
drop policy if exists "ws_update_owner" on public.vault_workspaces;
drop policy if exists "ws_delete_owner" on public.vault_workspaces;
drop policy if exists "mem_select_own_or_member" on public.vault_workspace_members;
drop policy if exists "mem_insert_owner" on public.vault_workspace_members;
drop policy if exists "mem_update_owner" on public.vault_workspace_members;
drop policy if exists "mem_delete_owner" on public.vault_workspace_members;
drop policy if exists "item_select_member" on public.vault_workspace_items;
drop policy if exists "item_insert_editor" on public.vault_workspace_items;
drop policy if exists "item_update_editor" on public.vault_workspace_items;
drop policy if exists "item_delete_editor" on public.vault_workspace_items;

-- Espacios: los ve quien es miembro; los crea cada usuario para sí;
-- solo el propietario los renombra o los borra.
create policy "ws_select_members"
  on public.vault_workspaces for select
  using (public.is_workspace_member(id));

-- El propietario ve su espacio aunque la fila se acabe de crear en la misma
-- sentencia (`insert ... returning`). Necesario porque is_workspace_member() es
-- STABLE: evalúa con el snapshot de la sentencia que hace el INSERT y no puede
-- ver la fila nueva, así que Postgres abortaba el insert con
-- "new row violates row-level security policy for table vault_workspaces".
create policy "ws_select_own"
  on public.vault_workspaces for select
  using (owner_id = auth.uid());

create policy "ws_insert_self"
  on public.vault_workspaces for insert
  with check (owner_id = auth.uid());

create policy "ws_update_owner"
  on public.vault_workspaces for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "ws_delete_owner"
  on public.vault_workspaces for delete
  using (owner_id = auth.uid());

-- Miembros: cada uno ve su propia fila (invitación pendiente) y las del
-- espacio; solo el propietario invita, cambia roles o expulsa.
create policy "mem_select_own_or_member"
  on public.vault_workspace_members for select
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

create policy "mem_insert_owner"
  on public.vault_workspace_members for insert
  with check (public.is_workspace_owner(workspace_id));

create policy "mem_update_owner"
  on public.vault_workspace_members for update
  using (public.is_workspace_owner(workspace_id))
  with check (public.is_workspace_owner(workspace_id));

create policy "mem_delete_owner"
  on public.vault_workspace_members for delete
  using (public.is_workspace_owner(workspace_id));

-- Elementos: se leen siendo miembro; owner y editores escriben.
create policy "item_select_member"
  on public.vault_workspace_items for select
  using (public.is_workspace_member(workspace_id));

create policy "item_insert_editor"
  on public.vault_workspace_items for insert
  with check (public.can_edit_workspace(workspace_id) and created_by = auth.uid());

create policy "item_update_editor"
  on public.vault_workspace_items for update
  using (public.can_edit_workspace(workspace_id))
  with check (public.can_edit_workspace(workspace_id));

create policy "item_delete_editor"
  on public.vault_workspace_items for delete
  using (public.can_edit_workspace(workspace_id));
