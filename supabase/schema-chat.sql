-- ============================================================
-- Workvaul · Chat Interno en Tiempo Real
-- Ejecutar DESPUÉS de schema-sharing.sql en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Tablas para chat interno con mensajería en tiempo real.
-- SEGURIDAD: las tablas chat_* no contienen ni cifran credenciales del
-- Vault. `team_id` solo referencia metadata de vault_workspaces para asociar
-- el equipo; nunca se consultan vault_credentials ni vault_workspace_items.
-- RLS estricto: un usuario solo puede leer/escribir en conversaciones donde
-- su user_id esté en conversation_participants.
-- ============================================================

-- 1) Conversaciones (privadas o de grupo)
create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  is_group boolean not null default false,
  team_id uuid references public.vault_workspaces (id) on delete cascade
);

-- 2) Participantes de cada conversación
create table if not exists public.chat_conversation_participants (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- 3) Mensajes
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Sanitización también en servidor para clientes que omitan la validación UI.
-- El renderer de React nunca usa dangerouslySetInnerHTML; esta trigger es una
-- segunda barrera: recorta el contenido y elimina delimitadores de etiquetas.
create or replace function public.sanitize_chat_message_content()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.content := left(regexp_replace(btrim(new.content), '[<>]', '', 'g'), 2000);
  if char_length(btrim(new.content)) = 0 then
    raise exception 'Message cannot be empty';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_chat_messages_sanitize on public.chat_messages;
create trigger trg_chat_messages_sanitize
  before insert or update of content on public.chat_messages
  for each row execute function public.sanitize_chat_message_content();

-- Índices para performance
create index if not exists idx_chat_conv_team on public.chat_conversations (team_id);
create index if not exists idx_chat_part_user on public.chat_conversation_participants (user_id);
create index if not exists idx_chat_msg_conv on public.chat_messages (conversation_id, created_at desc);
create index if not exists idx_chat_msg_sender on public.chat_messages (sender_id);

-- ============================================================
-- RLS: políticas estrictas por participante
-- ============================================================
-- Las funciones SECURITY DEFINER evitan que la política de conversaciones
-- tenga que consultar Participants (eso produciría recursión de RLS).
alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_participants enable row level security;
alter table public.chat_messages enable row level security;

-- El cliente solo necesita consultar las tres tablas y enviar mensajes.
-- La creación de conversaciones/participantes queda reservada a la RPC.
revoke all on public.chat_conversations from anon;
revoke all on public.chat_conversation_participants from anon;
revoke all on public.chat_messages from anon;
grant select on public.chat_conversations to authenticated;
grant select on public.chat_conversation_participants to authenticated;
grant select, insert on public.chat_messages to authenticated;
revoke insert, update, delete on public.chat_conversations from authenticated;
revoke insert, update, delete on public.chat_conversation_participants from authenticated;
revoke update, delete on public.chat_messages from authenticated;

-- Limpieza idempotente de políticas anteriores.
drop policy if exists "conv_select_participant" on public.chat_conversations;
drop policy if exists "conv_insert_direct" on public.chat_conversations;
drop policy if exists "part_select_own" on public.chat_conversation_participants;
drop policy if exists "part_select_participant" on public.chat_conversation_participants;
drop policy if exists "part_insert_self" on public.chat_conversation_participants;
drop policy if exists "msg_select_participant" on public.chat_messages;
drop policy if exists "msg_insert_sender" on public.chat_messages;

create or replace function public.is_chat_participant(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.chat_conversation_participants p
    where p.conversation_id = target_conversation
      and p.user_id = auth.uid()
  );
$$;

revoke all on function public.is_chat_participant(uuid) from public;
grant execute on function public.is_chat_participant(uuid) to authenticated;

-- Solo se listan conversaciones y participantes de las conversaciones propias.
create policy "conv_select_participant"
  on public.chat_conversations for select
  using (public.is_chat_participant(id));

create policy "part_select_participant"
  on public.chat_conversation_participants for select
  using (public.is_chat_participant(conversation_id));

-- El emisor debe ser el usuario autenticado y estar en la conversación.
create policy "msg_select_participant"
  on public.chat_messages for select
  using (public.is_chat_participant(conversation_id));

create policy "msg_insert_sender"
  on public.chat_messages for insert
  with check (
    sender_id = auth.uid()
    and public.is_chat_participant(conversation_id)
  );

-- No se permite crear conversaciones o participantes directamente desde el
-- cliente: se usa la RPC validada de conversación directa de abajo.

-- ============================================================
-- RPC: obtener o crear una conversación directa entre dos usuarios
-- ============================================================
create or replace function public.get_or_create_direct_conversation(
  other_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  conv_id uuid;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if other_user_id is null or other_user_id = current_user_id then
    raise exception 'A different user is required';
  end if;
  if not exists (select 1 from auth.users where id = other_user_id) then
    raise exception 'User not found';
  end if;

  -- Evita dos conversaciones directas simultáneas para la misma pareja.
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(current_user_id::text, other_user_id::text) || ':' ||
      greatest(current_user_id::text, other_user_id::text),
      0
    )
  );

  select c.id into conv_id
  from public.chat_conversations c
  where c.is_group = false
    and exists (
      select 1 from public.chat_conversation_participants p
      where p.conversation_id = c.id and p.user_id = current_user_id
    )
    and exists (
      select 1 from public.chat_conversation_participants p
      where p.conversation_id = c.id and p.user_id = other_user_id
    )
  order by c.created_at
  limit 1;

  if conv_id is null then
    insert into public.chat_conversations (is_group, team_id)
    values (false, null)
    returning id into conv_id;

    insert into public.chat_conversation_participants (conversation_id, user_id)
    values (conv_id, current_user_id), (conv_id, other_user_id);
  end if;

  return conv_id;
end;
$$;

revoke all on function public.get_or_create_direct_conversation(uuid) from public, anon;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- ============================================================
-- RPC: buscar usuarios de la plataforma por nombre o correo
-- ============================================================
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  normalized := lower(trim(coalesce(search_term, '')));
  if char_length(normalized) < 2 then
    return;
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(
        trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')),
        ''
      ),
      nullif(
        trim(coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''))),
        ''
      ),
      split_part(u.email::text, '@', 1)
    ),
    null::text,
    false,
    null::timestamptz
  from auth.users u
  where u.id <> auth.uid()
    and u.email::text is not null
    and (
      position(normalized in lower(u.email::text)) > 0
      or position(normalized in lower(split_part(u.email::text, '@', 1))) > 0
      or position(
        normalized in lower(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name'))
      ) > 0
      or position(
        normalized in lower(coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), ''))
      ) > 0
    )
  order by lower(u.email::text)
  limit greatest(1, least(20, coalesce(limit_count, 20)));
end;
$$;

revoke all on function public.search_users(text, integer) from public, anon;
grant execute on function public.search_users(text, integer) to authenticated;

-- ============================================================
-- Permiso especial: solo el correo exacto puede ver el contador global
-- ============================================================
-- Se elimina la versión antigua que recibía un user_id desde el cliente.
drop function if exists public.is_global_owner(uuid);

create or replace function public.is_global_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users
    where id = auth.uid()
      and email = 'elvissebas39@gmail.com'
  );
$$;

revoke all on function public.is_global_owner() from public, anon;
grant execute on function public.is_global_owner() to authenticated;

-- Postgres Changes de Supabase: solo chat_messages entra en Realtime.
-- La publicación ya puede existir; por eso el DO es idempotente.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'chat_messages'
     ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end;
$$;
