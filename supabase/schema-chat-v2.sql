-- ============================================================
-- VaultAccess · Chat v2: identidad, notificaciones y edición
-- Ejecutar DESPUÉS de schema-sharing.sql y schema-chat.sql.
-- No contiene credenciales del Vault.
-- ============================================================

alter table public.chat_messages
  add column if not exists edited_at timestamptz;

alter table public.chat_messages
  add column if not exists deleted_at timestamptz;

alter table public.chat_messages
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

create table if not exists public.chat_message_deletions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists public.chat_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  conversation_id uuid references public.chat_conversations(id) on delete cascade,
  message_id uuid references public.chat_messages(id) on delete cascade,
  workspace_id uuid references public.vault_workspaces(id) on delete cascade,
  kind text not null check (kind in ('message', 'team_update')),
  preview text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create unique index if not exists uniq_chat_message_notification
  on public.chat_notifications (recipient_id, message_id)
  where message_id is not null;

create index if not exists idx_chat_notifications_recipient
  on public.chat_notifications (recipient_id, created_at desc);

create index if not exists idx_chat_notifications_conversation
  on public.chat_notifications (recipient_id, conversation_id)
  where conversation_id is not null;

create index if not exists idx_chat_notifications_workspace
  on public.chat_notifications (recipient_id, workspace_id)
  where workspace_id is not null;

-- RLS de datos auxiliares: el cliente solo puede ver sus propias acciones.
alter table public.chat_message_deletions enable row level security;
alter table public.chat_notifications enable row level security;

revoke all on public.chat_message_deletions from anon;
revoke all on public.chat_notifications from anon;
grant select on public.chat_message_deletions to authenticated;
grant select, update on public.chat_notifications to authenticated;

drop policy if exists "chat_deletions_select_own" on public.chat_message_deletions;
drop policy if exists "chat_deletions_delete_own" on public.chat_message_deletions;
drop policy if exists "chat_notifications_select_own" on public.chat_notifications;
drop policy if exists "chat_notifications_update_own" on public.chat_notifications;
drop policy if exists "chat_notifications_delete_own" on public.chat_notifications;

create policy "chat_deletions_select_own"
  on public.chat_message_deletions for select
  using (user_id = auth.uid());

create policy "chat_deletions_delete_own"
  on public.chat_message_deletions for delete
  using (user_id = auth.uid());

create policy "chat_notifications_select_own"
  on public.chat_notifications for select
  using (recipient_id = auth.uid());

create policy "chat_notifications_update_own"
  on public.chat_notifications for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "chat_notifications_delete_own"
  on public.chat_notifications for delete
  using (recipient_id = auth.uid());

-- Nombre registrado en auth.users; NULL si el usuario no registró uno.
create or replace function public.chat_registered_name(metadata jsonb)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    trim(coalesce(
      nullif(trim(concat_ws(' ', metadata->>'first_name', metadata->>'last_name')), ''),
      nullif(trim(concat_ws(' ', metadata->>'given_name', metadata->>'family_name')), ''),
      nullif(trim(coalesce(nullif(metadata->>'full_name', ''), nullif(metadata->>'name', ''))), '')
    )),
    ''
  );
$$;

-- El permiso global se mantiene en servidor; el cliente nunca lo decide.
create or replace function public.is_global_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and email = 'elvissebas39@gmail.com'
  );
$$;

revoke all on function public.chat_registered_name(jsonb) from public, anon;
revoke all on function public.is_global_owner() from public, anon;
grant execute on function public.chat_registered_name(jsonb) to authenticated;
grant execute on function public.is_global_owner() to authenticated;

-- Perfiles de chat con privacidad: el email solo se devuelve al owner global
-- o cuando el usuario no tiene un nombre registrado.
create or replace function public.get_chat_user_profiles(profile_ids uuid[])
returns table (
  id uuid,
  name text,
  email text,
  avatar_color text,
  is_online boolean,
  last_seen_at timestamptz,
  has_name boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  global_viewer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if profile_ids is null or cardinality(profile_ids) = 0 then
    return;
  end if;

  select public.is_global_owner() into global_viewer;
  return query
  select
    u.id,
    coalesce(public.chat_registered_name(u.raw_user_meta_data), u.email::text),
    case
      when global_viewer or public.chat_registered_name(u.raw_user_meta_data) is null
        then u.email::text
      else null
    end,
    null::text,
    false,
    null::timestamptz,
    public.chat_registered_name(u.raw_user_meta_data) is not null
  from auth.users u
  where u.id = any(profile_ids);
end;
$$;

revoke all on function public.get_chat_user_profiles(uuid[]) from public, anon;
grant execute on function public.get_chat_user_profiles(uuid[]) to authenticated;

-- Ruta de perfiles nueva para evitar que una versión/cache anterior del RPC
-- deje a los remitentes en el fallback "Usuario".
create or replace function public.get_chat_user_profiles_v2(
  profile_ids uuid[]
)
returns table (
  id uuid,
  name text,
  email text,
  avatar_color text,
  is_online boolean,
  last_seen_at timestamptz,
  has_name boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  global_viewer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if profile_ids is null or cardinality(profile_ids) = 0 then
    return;
  end if;

  select public.is_global_owner() into global_viewer;
  return query
  with directory as (
    select
      u.id,
      u.email::text,
      public.chat_registered_name(u.raw_user_meta_data) as registered_name
    from auth.users u
    where u.id = any(profile_ids)
  )
  select
    d.id,
    coalesce(d.registered_name, d.email),
    case
      when global_viewer or d.registered_name is null then d.email
      else null
    end,
    null::text,
    false,
    null::timestamptz,
    d.registered_name is not null
  from directory d;
end;
$$;

revoke all on function public.get_chat_user_profiles_v2(uuid[]) from public, anon;
grant execute on function public.get_chat_user_profiles_v2(uuid[]) to authenticated;

-- Búsqueda de usuarios: el servidor filtra el email según la privacidad.
create or replace function public.search_users(
  search_term text,
  limit_count integer default 20
)
returns table (
  id uuid,
  email text,
  name text,
  avatar_color text,
  is_online boolean,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
  global_viewer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  normalized := lower(trim(coalesce(search_term, '')));
  if char_length(normalized) < 2 then
    return;
  end if;
  select public.is_global_owner() into global_viewer;

  return query
  with directory as (
    select
      u.id,
      u.email::text,
      public.chat_registered_name(u.raw_user_meta_data) as registered_name
    from auth.users u
    where u.id <> auth.uid()
      and u.email::text is not null
  )
  select
    d.id,
    case
      when global_viewer or d.registered_name is null then d.email
      else null
    end,
    coalesce(d.registered_name, d.email),
    null::text,
    false,
    null::timestamptz
  from directory d
  where position(normalized in lower(d.email)) > 0
     or position(normalized in lower(coalesce(d.registered_name, ''))) > 0
  order by lower(d.email)
  limit greatest(1, least(20, coalesce(limit_count, 20)));
end;
$$;

revoke all on function public.search_users(text, integer) from public, anon;
grant execute on function public.search_users(text, integer) to authenticated;

-- Ruta de búsqueda dedicada para el chat. Usa un nombre de función nuevo para
-- evitar depender de una versión/cache anterior de search_users.
create or replace function public.search_chat_users(
  search_term text,
  limit_count integer default 20
)
returns table (
  id uuid,
  email text,
  name text,
  avatar_color text,
  is_online boolean,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  normalized text;
  global_viewer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  normalized := lower(trim(coalesce(search_term, '')));
  if char_length(normalized) < 2 then
    return;
  end if;
  select public.is_global_owner() into global_viewer;

  return query
  with directory as (
    select
      u.id,
      u.email::text,
      public.chat_registered_name(u.raw_user_meta_data) as registered_name
    from auth.users u
    where u.id <> auth.uid()
      and u.email::text is not null
  )
  select
    d.id,
    case
      when global_viewer or d.registered_name is null then d.email
      else null
    end,
    coalesce(d.registered_name, d.email),
    null::text,
    false,
    null::timestamptz
  from directory d
  where position(normalized in lower(d.email)) > 0
     or position(normalized in lower(split_part(d.email, '@', 1))) > 0
     or position(normalized in lower(coalesce(d.registered_name, ''))) > 0
  order by lower(d.email)
  limit greatest(1, least(20, coalesce(limit_count, 20)));
end;
$$;

revoke all on function public.search_chat_users(text, integer) from public, anon;
grant execute on function public.search_chat_users(text, integer) to authenticated;

-- Listado seguro de miembros para las pantallas de equipo. La tabla cruda ya
-- no se consulta para listar emails de otros miembros.
create or replace function public.list_workspace_members()
returns table (
  id uuid,
  workspace_id uuid,
  user_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  global_viewer boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select public.is_global_owner() into global_viewer;

  return query
  select
    m.id,
    m.workspace_id,
    m.user_id,
    case
      when global_viewer or public.chat_registered_name(u.raw_user_meta_data) is null
        then m.email
      else null
    end,
    coalesce(public.chat_registered_name(u.raw_user_meta_data), m.email),
    m.role,
    m.created_at
  from public.vault_workspace_members m
  left join auth.users u on u.id = m.user_id
  where public.is_workspace_member(m.workspace_id);
end;
$$;

revoke all on function public.list_workspace_members() from public, anon;
grant execute on function public.list_workspace_members() to authenticated;

-- La tabla cruda solo permite ver la propia fila; el listado se hace por RPC.
drop policy if exists "mem_select_own_or_member" on public.vault_workspace_members;
create policy "mem_select_own_or_member"
  on public.vault_workspace_members for select
  using (user_id = auth.uid());

-- Edición: solo el emisor y mientras el mensaje no esté eliminado para todos.
create or replace function public.edit_chat_message(
  target_message_id uuid,
  new_content text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_row public.chat_messages%rowtype;
  clean_content text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  clean_content := btrim(coalesce(new_content, ''));
  if char_length(clean_content) = 0 or char_length(clean_content) > 2000 then
    raise exception 'Message must contain between 1 and 2000 characters';
  end if;

  select * into target_row
  from public.chat_messages
  where id = target_message_id;

  if not found
     or target_row.sender_id <> auth.uid()
     or target_row.deleted_at is not null
     or not public.is_chat_participant(target_row.conversation_id) then
    raise exception 'Message cannot be edited';
  end if;

  update public.chat_messages
  set content = clean_content, edited_at = now()
  where id = target_message_id;

  update public.chat_notifications
  set preview = left(regexp_replace(btrim(clean_content), '[\r\n]+', ' ', 'g'), 160)
  where message_id = target_message_id;
end;
$$;

revoke all on function public.edit_chat_message(uuid, text) from public, anon;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;

-- Eliminar para todos conserva la fila/timestamp, pero elimina el contenido
-- original y muestra un placeholder común para todos los participantes.
create or replace function public.delete_chat_message_for_everyone(
  target_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_row public.chat_messages%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_row
  from public.chat_messages
  where id = target_message_id;

  if not found
     or target_row.sender_id <> auth.uid()
     or target_row.deleted_at is not null
     or not public.is_chat_participant(target_row.conversation_id) then
    raise exception 'Message cannot be deleted';
  end if;

  update public.chat_messages
  set content = '[Mensaje eliminado]',
      deleted_at = now(),
      deleted_by = auth.uid(),
      edited_at = null
  where id = target_message_id;

  update public.chat_notifications
  set preview = 'Mensaje eliminado'
  where message_id = target_message_id;
end;
$$;

revoke all on function public.delete_chat_message_for_everyone(uuid) from public, anon;
grant execute on function public.delete_chat_message_for_everyone(uuid) to authenticated;

-- Eliminar para mí solo crea una marca privada; no modifica el mensaje para
-- los demás participantes.
create or replace function public.delete_chat_message_for_me(
  target_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select conversation_id into target_conversation
  from public.chat_messages
  where id = target_message_id;

  if not found or not public.is_chat_participant(target_conversation) then
    raise exception 'Message not found';
  end if;

  insert into public.chat_message_deletions (message_id, user_id)
  values (target_message_id, auth.uid())
  on conflict (message_id, user_id) do nothing;

  delete from public.chat_notifications
  where recipient_id = auth.uid()
    and message_id = target_message_id;
end;
$$;

revoke all on function public.delete_chat_message_for_me(uuid) from public, anon;
grant execute on function public.delete_chat_message_for_me(uuid) to authenticated;

-- Notificación individual por cada mensaje recibido.
create or replace function public.notify_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null then
    return new;
  end if;

  insert into public.chat_notifications (
    recipient_id, actor_id, conversation_id, message_id, kind, preview
  )
  select
    p.user_id,
    new.sender_id,
    new.conversation_id,
    new.id,
    'message',
    left(regexp_replace(btrim(new.content), '[\r\n]+', ' ', 'g'), 160)
  from public.chat_conversation_participants p
  where p.conversation_id = new.conversation_id
    and p.user_id <> new.sender_id
    and not exists (
      select 1
      from public.chat_notifications n
      where n.recipient_id = p.user_id
        and n.message_id = new.id
    );
  return new;
end;
$$;

drop trigger if exists trg_chat_message_notify on public.chat_messages;
create trigger trg_chat_message_notify
  after insert on public.chat_messages
  for each row execute function public.notify_chat_message_insert();

-- Cambios de nombre del equipo.
create or replace function public.notify_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not public.is_workspace_owner(new.id) then
    return new;
  end if;

  insert into public.chat_notifications (
    recipient_id, actor_id, workspace_id, kind, preview
  )
  select
    m.user_id,
    actor,
    new.id,
    'team_update',
    'El propietario actualizó el nombre del equipo'
  from public.vault_workspace_members m
  where m.workspace_id = new.id
    and m.user_id is not null
    and m.user_id <> actor;
  return new;
end;
$$;

drop trigger if exists trg_workspace_notify_update on public.vault_workspaces;
create trigger trg_workspace_notify_update
  after update of name on public.vault_workspaces
  for each row execute function public.notify_workspace_update();

-- Cambios de membresía/roles. No se notifica al actor.
create or replace function public.notify_workspace_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  workspace_id_value uuid;
  label text;
begin
  if TG_OP = 'DELETE' then
    workspace_id_value := old.workspace_id;
  else
    workspace_id_value := new.workspace_id;
  end if;

  if actor is null or not public.is_workspace_owner(workspace_id_value) then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  label := case TG_OP
    when 'INSERT' then 'El propietario añadió un miembro al equipo'
    when 'DELETE' then 'El propietario retiró un miembro del equipo'
    else 'El propietario modificó un miembro del equipo'
  end;

  if TG_OP = 'DELETE' then
    if old.user_id is not null and old.user_id <> actor then
      insert into public.chat_notifications (
        recipient_id, actor_id, workspace_id, kind, preview
      ) values (old.user_id, actor, workspace_id_value, 'team_update', label);
    end if;
    return old;
  end if;

  insert into public.chat_notifications (
    recipient_id, actor_id, workspace_id, kind, preview
  )
  select m.user_id, actor, workspace_id_value, 'team_update', label
  from public.vault_workspace_members m
  where m.workspace_id = workspace_id_value
    and m.user_id is not null
    and m.user_id <> actor;

  -- Si el usuario fue reemplazado, también se avisa al anterior.
  if TG_OP = 'UPDATE' then
    if old.user_id is not null
       and old.user_id <> actor
       and old.user_id is distinct from new.user_id then
      insert into public.chat_notifications (
        recipient_id, actor_id, workspace_id, kind, preview
      ) values (old.user_id, actor, workspace_id_value, 'team_update', label);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_member_notify on public.vault_workspace_members;
create trigger trg_workspace_member_notify
  after insert or update or delete on public.vault_workspace_members
  for each row execute function public.notify_workspace_member_change();

-- Cambios en contenido compartido: el aviso nunca incluye la credencial.
create or replace function public.notify_workspace_item_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  workspace_id_value uuid;
  label text;
begin
  if TG_OP = 'DELETE' then
    workspace_id_value := old.workspace_id;
  else
    workspace_id_value := new.workspace_id;
  end if;

  if actor is null or not public.is_workspace_owner(workspace_id_value) then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;

  label := case TG_OP
    when 'INSERT' then 'El propietario añadió contenido al equipo'
    when 'DELETE' then 'El propietario retiró contenido del equipo'
    else 'El propietario actualizó contenido del equipo'
  end;

  insert into public.chat_notifications (
    recipient_id, actor_id, workspace_id, kind, preview
  )
  select m.user_id, actor, workspace_id_value, 'team_update', label
  from public.vault_workspace_members m
  where m.workspace_id = workspace_id_value
    and m.user_id is not null
    and m.user_id <> actor;

  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_workspace_item_notify on public.vault_workspace_items;
create trigger trg_workspace_item_notify
  after insert or update or delete on public.vault_workspace_items
  for each row execute function public.notify_workspace_item_change();

-- Realtime de mensajes y de notificaciones. La migración base ya puede haber
-- agregado chat_messages; el DO no duplica publicaciones.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_notifications'
    ) then
      alter publication supabase_realtime add table public.chat_notifications;
    end if;
  end if;
end;
$$;

-- FIN VaultAccess Chat v2