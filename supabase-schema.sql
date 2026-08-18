-- NLS / National Land Sliding
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  hazard_type text not null check (hazard_type in ('landslide','avalanche')),
  title text not null,
  location_name text not null,
  state_region text,
  country text,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  al_rating text not null check (al_rating in ('AL-0','AL-1','AL-2','AL-3','AL-4','AL-5','AL-6','AL-7')),
  estimated_volume text,
  estimated_mass text,
  speed text,
  runout_distance text,
  vertical_drop text,
  width text,
  slope_angle text,
  depth text,
  estimated_energy text,
  fatalities integer not null default 0 check (fatalities >= 0),
  injuries integer not null default 0 check (injuries >= 0),
  people_exposed integer not null default 0 check (people_exposed >= 0),
  evacuated integer not null default 0 check (evacuated >= 0),
  rescued integer not null default 0 check (rescued >= 0),
  buried integer not null default 0 check (buried >= 0),
  structures text,
  trigger text,
  avalanche_details text,
  landslide_details text,
  confidence text not null default 'medium' check (confidence in ('low','medium','high','verified')),
  source_count integer not null default 1 check (source_count >= 0),
  rating_notes text,
  source_url text,
  media_urls text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  product text not null,
  area text not null,
  headline text not null,
  details text,
  severity text not null check (severity in ('watch','warning','emergency')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.outlooks (
  id uuid primary key default gen_random_uuid(),
  day integer not null check (day between 1 and 3),
  hazard_type text not null check (hazard_type in ('landslide','avalanche','both')),
  probability integer not null check (probability between 0 and 100),
  label text,
  geometry jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.probabilities (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  hazard_type text not null check (hazard_type in ('landslide','avalanche')),
  valid_time timestamptz not null,
  probability integer not null check (probability between 0 and 100),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.events enable row level security;
alter table public.alerts enable row level security;
alter table public.outlooks enable row level security;
alter table public.probabilities enable row level security;

-- Everyone can read published NLS information.
create policy "public read events" on public.events for select using (true);
create policy "public read alerts" on public.alerts for select using (true);
create policy "public read outlooks" on public.outlooks for select using (true);
create policy "public read probabilities" on public.probabilities for select using (true);

-- Users may check whether THEIR OWN uid is an owner, but cannot enumerate owners.
create policy "owner can read own admin record" on public.admin_users for select to authenticated using (auth.uid() = user_id);

-- Only a UID listed in admin_users can create/change/delete public content.
create policy "owner insert events" on public.events for insert to authenticated with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner update events" on public.events for update to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner delete events" on public.events for delete to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "owner insert alerts" on public.alerts for insert to authenticated with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner update alerts" on public.alerts for update to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner delete alerts" on public.alerts for delete to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "owner insert outlooks" on public.outlooks for insert to authenticated with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner update outlooks" on public.outlooks for update to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner delete outlooks" on public.outlooks for delete to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "owner insert probabilities" on public.probabilities for insert to authenticated with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner update probabilities" on public.probabilities for update to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid())) with check (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "owner delete probabilities" on public.probabilities for delete to authenticated using (exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

-- Enable these four tables in Database -> Replication / Realtime in the Supabase dashboard
-- so connected NLS visitors receive owner changes immediately.


-- ===== NLS v3 migration for an existing database =====
-- Safe to run after the original schema. Existing installs need these columns.
alter table public.events add column if not exists estimated_mass text;
alter table public.events add column if not exists runout_distance text;
alter table public.events add column if not exists vertical_drop text;
alter table public.events add column if not exists width text;
alter table public.events add column if not exists slope_angle text;
alter table public.events add column if not exists depth text;
alter table public.events add column if not exists estimated_energy text;
alter table public.events add column if not exists people_exposed integer not null default 0;
alter table public.events add column if not exists evacuated integer not null default 0;
alter table public.events add column if not exists rescued integer not null default 0;
alter table public.events add column if not exists buried integer not null default 0;
alter table public.events add column if not exists trigger text;
alter table public.events add column if not exists avalanche_details text;
alter table public.events add column if not exists landslide_details text;
alter table public.events add column if not exists confidence text not null default 'medium';
alter table public.events add column if not exists source_count integer not null default 1;
