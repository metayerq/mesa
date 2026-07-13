-- Mesa — schéma multi-tenant initial : établissements, membres, RLS.
-- Isolation des données par établissement. Un compte (auth.users) peut être
-- membre de plusieurs établissements (chaînes / multi-sites).

-- ── Établissements ─────────────────────────────────────────────────────────
create table if not exists public.establishments (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  plan                text not null default 'free' check (plan in ('free', 'pro')),
  -- infos collectées dans le funnel (étapes 2-3)
  business_type       text,
  country             text not null default 'PT',
  city                text,
  seats               int,
  referral_source     text,
  -- connexion Vendus
  vendus_api_key_enc  text,          -- clé API Vendus chiffrée (AES-256-GCM), jamais en clair
  vendus_key_last4    text,          -- 4 derniers caractères, pour affichage
  vendus_connected_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Membres (lien utilisateur ↔ établissement + rôle) ──────────────────────
create table if not exists public.memberships (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  role             text not null default 'owner' check (role in ('owner', 'manager', 'staff')),
  created_at       timestamptz not null default now(),
  unique (user_id, establishment_id)
);

create index if not exists idx_memberships_user  on public.memberships(user_id);
create index if not exists idx_memberships_estab on public.memberships(establishment_id);

-- ── updated_at automatique ─────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_establishments_updated_at on public.establishments;
create trigger trg_establishments_updated_at
  before update on public.establishments
  for each row execute function public.set_updated_at();

-- ── Helper : l'utilisateur courant est-il membre de l'établissement ? ───────
-- SECURITY DEFINER pour éviter la récursion RLS quand les policies l'appellent.
create or replace function public.is_member(p_establishment uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.establishment_id = p_establishment
      and m.user_id = auth.uid()
  );
$$;

-- ── Privilèges de table (RLS filtre ensuite les lignes) ────────────────────
grant select, update on public.establishments to authenticated;
grant select          on public.memberships   to authenticated;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.establishments enable row level security;
alter table public.memberships   enable row level security;

-- Établissements : lisibles / modifiables uniquement par leurs membres.
create policy "establishments_select_members"
  on public.establishments for select
  using (public.is_member(id));

create policy "establishments_update_members"
  on public.establishments for update
  using (public.is_member(id))
  with check (public.is_member(id));
-- Note MVP : l'update autorise aussi la colonne `plan`. À restreindre plus tard
-- (le passage free→pro devra venir du webhook de facturation, pas du client).
-- Pas de policy INSERT/DELETE directe : la création passe par create_establishment().

-- Membres : chacun voit ses propres appartenances.
create policy "memberships_select_own"
  on public.memberships for select
  using (user_id = auth.uid());
-- Pas d'INSERT/UPDATE/DELETE client : géré via la RPC SECURITY DEFINER ci-dessous.

-- ── RPC : créer un établissement + rattacher l'utilisateur comme owner ──────
create or replace function public.create_establishment(
  p_name            text,
  p_business_type   text default null,
  p_country         text default 'PT',
  p_city            text default null,
  p_seats           int  default null,
  p_referral_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into public.establishments (name, business_type, country, city, seats, referral_source)
  values (p_name, p_business_type, p_country, p_city, p_seats, p_referral_source)
  returning id into v_id;

  insert into public.memberships (user_id, establishment_id, role)
  values (auth.uid(), v_id, 'owner');

  return v_id;
end;
$$;

revoke all     on function public.create_establishment(text, text, text, text, int, text) from public;
grant  execute on function public.create_establishment(text, text, text, text, int, text) to authenticated;
