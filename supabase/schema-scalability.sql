-- ============================================================
-- Workvaul · Escalabilidad Supabase (idempotente)
-- Ejecutar DESPUÉS de schema-chat-v3.sql.
-- No contiene credenciales del Vault ni cambia políticas existentes.
-- ============================================================

-- ============================================================
-- 1) Índices compuestos para las consultas realmente ejecutadas
-- ============================================================

-- Lecturas del Vault ordenadas por user_id + fecha.
create index if not exists idx_sections_user_created
  on public.vault_sections (user_id, created_at, id);
create index if not exists idx_categories_user_created
  on public.vault_categories (user_id, created_at, id);
create index if not exists idx_credentials_user_updated
  on public.vault_credentials (user_id, updated_at desc, id desc);
create index if not exists idx_links_user_updated
  on public.vault_links (user_id, updated_at desc, id desc);
create index if not exists idx_notes_user_updated
  on public.vault_notes (user_id, updated_at desc, id desc);
create index if not exists idx_history_credential_changed
  on public.vault_password_history (credential_id, changed_at desc, id desc);

-- Equipos: listado del usuario y orden de elementos por espacio.
create index if not exists idx_ws_members_user_workspace
  on public.vault_workspace_members (user_id, workspace_id)
  where user_id is not null;
create index if not exists idx_ws_items_workspace_updated
  on public.vault_workspace_items (workspace_id, updated_at desc, id desc);

-- Chat: una entrada por participante y acceso a los últimos mensajes.
create index if not exists idx_chat_part_user_conversation
  on public.chat_conversation_participants (user_id, conversation_id);
create index if not exists idx_chat_msg_conversation_latest
  on public.chat_messages (conversation_id, created_at desc, id desc);
create index if not exists idx_chat_deletions_user_message
  on public.chat_message_deletions (user_id, message_id);
create index if not exists idx_chat_notifications_recipient_latest
  on public.chat_notifications (recipient_id, created_at desc, id desc);

-- ============================================================
-- 2) Presencia escalable con heartbeat + TTL
-- No hay un canal global al que se conecten todos los usuarios.
-- Cada cliente actualiza únicamente su fila; el TTL caduca estados antiguos.
-- ============================================================

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_user_presence_last_seen
  on public.user_presence (last_seen_at desc);

alter table public.user_presence enable row level security;
revoke all on table public.user_presence from public, anon, authenticated;

comment on table public.user_presence is
  'Heartbeat privado de presencia. Se consulta mediante RPC; nunca se concede acceso directo.';
comment on index public.idx_user_presence_last_seen is
  'Permite contar y filtrar usuarios conectados sin recorrer toda la tabla.';

create or replace function public.touch_user_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  visible_at timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.user_presence (user_id, last_seen_at)
  values (current_user_id, visible_at)
  on conflict (user_id)
  do update set last_seen_at = excluded.last_seen_at;

  return visible_at;
end;
$$;

-- Presencia de un conjunto acotado de usuarios. El cliente normal solo
-- solicita miembros visibles en el chat/equipo activo; nunca toda la plataforma.
create or replace function public.get_presence_snapshot(profile_ids uuid[])
returns table (
  user_id uuid,
  is_online boolean,
  last_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    true as is_online,
    p.last_seen_at
  from public.user_presence p
  where p.user_id = any (coalesce(profile_ids, '{}'::uuid[]))
    and p.last_seen_at >= now() - interval '90 seconds'
    and (
      p.user_id = auth.uid()
      or public.is_global_owner()
      or exists (
        select 1
        from public.vault_workspace_members mine
        join public.vault_workspace_members target
          on target.workspace_id = mine.workspace_id
        where mine.user_id = auth.uid()
          and target.user_id = p.user_id
      )
      or exists (
        select 1
        from public.chat_conversation_participants mine
        join public.chat_conversation_participants target
          on target.conversation_id = mine.conversation_id
        where mine.user_id = auth.uid()
          and target.user_id = p.user_id
      )
    )
  limit 200;
$$;

-- Contador global: la autorización se hace en servidor y el cliente solo lo
-- llama cuando is_global_owner() ya le devolvió true.
create or replace function public.get_global_presence_count()
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_global_owner() then
    return 0;
  end if;

  return (
    select count(*)
    from public.user_presence p
    where p.last_seen_at >= now() - interval '90 seconds'
  );
end;
$$;

revoke all on function public.touch_user_presence() from public, anon;
revoke all on function public.get_presence_snapshot(uuid[]) from public, anon;
revoke all on function public.get_global_presence_count() from public, anon;
grant execute on function public.touch_user_presence() to authenticated;
grant execute on function public.get_presence_snapshot(uuid[]) to authenticated;
grant execute on function public.get_global_presence_count() to authenticated;

-- ============================================================
-- 3) Snapshots atómicos: menos viajes HTTP, RLS intacto
-- SECURITY INVOKER (valor por defecto) hace que cada SELECT pase por las
-- políticas RLS del usuario llamante. No se conceden tablas adicionales.
-- ============================================================

-- OJO: get_vault_snapshot() NO se define aquí a propósito.
--
-- Antes este script traía una versión sin `encrypted_payload` ni `module`, y eso
-- rompía el Vault: al reejecutar schema-scalability.sql se sobrescribía la
-- versión correcta de schema-encryption.sql y el cliente se quedaba sin
-- ciphertext para descifrar y sin el módulo de las columnas.
--
-- La dueña de esa función es schema-encryption.sql, que se ejecuta después.

-- El snapshot anterior no se conserva: la app usa v2 y nunca necesita
-- descargar copias compartidas completas durante el arranque.
drop function if exists public.get_workspace_snapshot();

-- v2: mismo snapshot, pero sin secretos de credenciales compartidas.
-- La tabla sigue protegida por RLS; el JSON solo contiene referencias mínimas.
create or replace function public.get_workspace_snapshot_v2()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  return jsonb_build_object(
    'workspaces', coalesce(
      (select jsonb_agg(to_jsonb(w) order by w.created_at, w.id)
       from public.vault_workspaces w),
      '[]'::jsonb
    ),
    'members', coalesce(
      (select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
       from public.list_workspace_members() m),
      '[]'::jsonb
    ),
    'item_references', coalesce(
      (select jsonb_agg(to_jsonb(r) order by r.workspace_id, r.id)
       from (
         select i.id, i.workspace_id, i.item_kind, i.credential_id, i.link_id, i.note_id
         from public.vault_workspace_items i
       ) r),
      '[]'::jsonb
    )
  );
end;
$$;

-- Un RPC evita descargar hasta 500 mensajes solo para mostrar previews.
-- El historial completo se carga bajo demanda con el índice por conversación.
create or replace function public.get_chat_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with visible_conversations as (
    select c.id, c.created_at, c.is_group, c.team_id
    from public.chat_conversations c
    order by c.created_at desc, c.id desc
    limit 100
  ), latest_messages as (
    select distinct on (m.conversation_id)
      m.id, m.conversation_id, m.sender_id, m.content, m.created_at,
      m.edited_at, m.deleted_at, m.deleted_by
    from public.chat_messages m
    join visible_conversations vc on vc.id = m.conversation_id
    order by m.conversation_id, m.created_at desc, m.id desc
  )
  select jsonb_build_object(
    'conversations', coalesce(
      (select jsonb_agg(to_jsonb(vc) order by vc.created_at desc, vc.id desc)
       from visible_conversations vc),
      '[]'::jsonb
    ),
    'participants', coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.conversation_id, p.created_at, p.user_id)
       from public.chat_conversation_participants p
       join visible_conversations vc on vc.id = p.conversation_id),
      '[]'::jsonb
    ),
    'last_messages', coalesce(
      (select jsonb_agg(to_jsonb(lm) order by lm.conversation_id)
       from latest_messages lm),
      '[]'::jsonb
    ),
    'deleted_message_ids', coalesce(
      (select jsonb_agg(d.message_id order by d.message_id)
       from public.chat_message_deletions d
       join latest_messages lm on lm.id = d.message_id),
      '[]'::jsonb
    )
  );
$$;

-- Historial acotado de una conversación. La función conserva RLS y evita que
-- el cliente descargue todos los borrados privados del usuario.
create or replace function public.get_conversation_messages(
  target_conversation_id uuid,
  message_limit integer default 200
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  safe_limit integer := greatest(1, least(500, coalesce(message_limit, 200)));
begin
  if auth.uid() is null or not public.is_chat_participant(target_conversation_id) then
    raise exception 'Conversation not found';
  end if;

  return jsonb_build_object(
    'messages', coalesce(
      (select jsonb_agg(to_jsonb(m) order by m.created_at, m.id)
       from (
         select m.*
         from public.chat_messages m
         where m.conversation_id = target_conversation_id
         order by m.created_at desc, m.id desc
         limit safe_limit
       ) m),
      '[]'::jsonb
    ),
    'deleted_message_ids', coalesce(
      (select jsonb_agg(d.message_id order by d.message_id)
       from public.chat_message_deletions d
       join public.chat_messages m on m.id = d.message_id
       where m.conversation_id = target_conversation_id),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_vault_snapshot() from public, anon;
revoke all on function public.get_workspace_snapshot_v2() from public, anon;
revoke all on function public.get_chat_snapshot() from public, anon;
revoke all on function public.get_conversation_messages(uuid, integer) from public, anon;
grant execute on function public.get_vault_snapshot() to authenticated;
grant execute on function public.get_workspace_snapshot_v2() to authenticated;
grant execute on function public.get_chat_snapshot() to authenticated;
grant execute on function public.get_conversation_messages(uuid, integer) to authenticated;

notify pgr, 'reload schema';
