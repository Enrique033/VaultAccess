create or replace function public.search_chat_users_v3(
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
      nullif(
        trim(
          coalesce(
            nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), ''),
            nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'given_name', u.raw_user_meta_data->>'family_name')), ''),
            nullif(trim(coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''))), '')
          )
        ),
        ''
      ) as registered_name
    from auth.users u
    where u.id <> auth.uid()
      and u.email is not null
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
  order by
    case
      when position(normalized in lower(coalesce(d.registered_name, ''))) > 0 then 0
      else 1
    end,
    lower(d.email)
  limit greatest(1, least(20, coalesce(limit_count, 20)));
end;
$$;

revoke all on function public.search_chat_users_v3(text, integer) from public, anon;
grant execute on function public.search_chat_users_v3(text, integer) to authenticated;

create or replace function public.search_chat_users_v2(
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
language sql
stable
security definer
set search_path = public
as $$
  select * from public.search_chat_users_v3(search_term, limit_count);
$$;

revoke all on function public.search_chat_users_v2(text, integer) from public, anon;
grant execute on function public.search_chat_users_v2(text, integer) to authenticated;

notify pgr, 'reload schema';
