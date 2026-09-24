-- ============================================================
-- VaultAccess · Links y Notas
-- Ejecutar DESPUÉS de schema.sql en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Tablas de contenido secundario (enlaces guardados y notas),
-- con el mismo modelo RLS por usuario que el resto del vault.
-- ============================================================

-- 1) Enlaces guardados
create table if not exists public.vault_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.vault_categories (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  url text not null check (char_length(url) between 1 and 2048),
  description text,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Notas
create table if not exists public.vault_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.vault_categories (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  content text not null default '',
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) updated_at automático (reutiliza la función creada en schema.sql)
drop trigger if exists trg_vault_links_updated on public.vault_links;
create trigger trg_vault_links_updated
  before update on public.vault_links
  for each row execute function public.set_updated_at();

drop trigger if exists trg_vault_notes_updated on public.vault_notes;
create trigger trg_vault_notes_updated
  before update on public.vault_notes
  for each row execute function public.set_updated_at();

-- 4) Índices
create index if not exists idx_links_user on public.vault_links (user_id);
create index if not exists idx_links_category on public.vault_links (category_id);
create index if not exists idx_notes_user on public.vault_notes (user_id);
create index if not exists idx_notes_category on public.vault_notes (category_id);

-- 5) RLS
alter table public.vault_links enable row level security;
alter table public.vault_notes enable row level security;

drop policy if exists "own_links_all" on public.vault_links;
drop policy if exists "own_notes_all" on public.vault_notes;

create policy "own_links_all"
  on public.vault_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own_notes_all"
  on public.vault_notes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);