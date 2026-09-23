-- ============================================================
-- WorkVault · Esquema Supabase con Row Level Security
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Cada usuario solo puede leer/escribir SUS propias filas
-- (auth.uid() = user_id). Sin login no se ve nada.
-- ============================================================

-- 1) Secciones (ej. Trabajo, Redes)
create table if not exists public.vault_sections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- 2) Categorías (pertenecen a una sección del mismo usuario)
create table if not exists public.vault_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  section_id uuid not null references public.vault_sections (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#8B5CF6',
  created_at timestamptz not null default now()
);

-- 3) Credenciales
create table if not exists public.vault_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid references public.vault_categories (id) on delete set null,
  title text not null check (char_length(title) between 1 and 80),
  username text not null check (char_length(username) between 1 and 120),
  -- NOTA: en texto claro por ahora. Fase 2 = cifrar en cliente (AES-GCM).
  password text not null,
  url text,
  notes text,
  favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vault_credentials_updated on public.vault_credentials;
create trigger trg_vault_credentials_updated
  before update on public.vault_credentials
  for each row execute function public.set_updated_at();

-- Índices para búsquedas del día a día
create index if not exists idx_sections_user on public.vault_sections (user_id);
create index if not exists idx_categories_user on public.vault_categories (user_id);
create index if not exists idx_categories_section on public.vault_categories (section_id);
create index if not exists idx_credentials_user on public.vault_credentials (user_id);
create index if not exists idx_credentials_category on public.vault_credentials (category_id);

-- ============================================================
-- 4) RLS: activar y crear políticas por usuario
-- ============================================================
alter table public.vault_sections enable row level security;
alter table public.vault_credentials enable row level security;
alter table public.vault_categories enable row level security;

-- Limpieza idempotente (por si se re-ejecuta el script)
drop policy if exists "own_sections_all" on public.vault_sections;
drop policy if exists "own_categories_all" on public.vault_categories;
drop policy if exists "own_credentials_all" on public.vault_credentials;

-- El usuario solo toca sus filas. Con `using` para leer y
-- `with check` para escribir nadie puede suplantar otro user_id.
create policy "own_sections_all"
  on public.vault_sections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own_categories_all"
  on public.vault_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own_credentials_all"
  on public.vault_credentials for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
