-- ============================================================
-- VaultAccess · Historial de claves (versiones anteriores)
-- Ejecutar DESPUÉS de supabase/schema.sql en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================
-- Guarda la clave ANTERIOR cada vez que se cambia la clave de una
-- credencial desde la app (por si un cambio fue un error).
-- El historial se borra en cascada al eliminar la credencial.
-- ============================================================

create table if not exists public.vault_password_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  credential_id uuid not null references public.vault_credentials (id) on delete cascade,
  -- NOTA: en texto claro por ahora, igual que vault_credentials.password.
  password text not null,
  changed_at timestamptz not null default now()
);

-- Índices: se consulta por credencial y se poda por antigüedad.
create index if not exists idx_history_credential
  on public.vault_password_history (credential_id, changed_at desc);
create index if not exists idx_history_user
  on public.vault_password_history (user_id);

-- ============================================================
-- RLS: cada usuario solo ve y toca su historial
-- ============================================================
alter table public.vault_password_history enable row level security;

drop policy if exists "own_history_all" on public.vault_password_history;

create policy "own_history_all"
  on public.vault_password_history for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
