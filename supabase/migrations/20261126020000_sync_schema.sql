-- P0.3: sync schema (docs/PLAN.md §13). Row-level security is in the next migration.
-- Timestamps default to app_now() (CLAUDE.md golden rule 2). Counts are integers (golden rule 1).

-- A zone is valid when Postgres knows it and it is an IANA Area/Location name (golden rule 3).
create schema if not exists private;
revoke all on schema private from public;

create function private.is_iana_zone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select tz like '%/%' and exists (select 1 from pg_catalog.pg_timezone_names n where n.name = tz);
$$;

-- ---------------------------------------------------------------- users
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  username text not null unique,
  avatar_url text,
  default_tz text not null check (private.is_iana_zone(default_tz)),
  created_at timestamptz not null default public.app_now(),
  -- Dev-only (seed.sql): free-text tester notes such as "Watch wearer". Never shown in the app.
  dev_note text
);
comment on column public.users.dev_note is 'Dev-only tester note from seed.sql (e.g. Watch wearer). Not product data.';

-- ---------------------------------------------------------------- crews
create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  commissioner_id uuid not null references public.users (id),
  -- The crew clock: the commissioner's zone, default Eastern (PLAN §4).
  crew_tz text not null default 'America/New_York' check (private.is_iana_zone(crew_tz))
);

create table public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default public.app_now(),
  status text not null default 'active',
  primary key (crew_id, user_id)
);
create index crew_members_user_id_idx on public.crew_members (user_id);

-- ---------------------------------------------------------------- sync keys
create table public.sync_keys (
  user_id uuid primary key references public.users (id) on delete cascade,
  -- SHA-256 of the key, hex encoded. The plaintext key is never stored.
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default public.app_now(),
  last_used_at timestamptz
);

-- ---------------------------------------------------------------- health totals
-- Per-source hourly totals. Temporary: deleted when the player's day locks (PLAN §12.2).
create table public.source_hours (
  user_id uuid not null references public.users (id) on delete cascade,
  hour_start_utc timestamptz not null check (extract(epoch from hour_start_utc)::bigint % 3600 = 0),
  source_name text not null,
  steps integer not null default 0 check (steps >= 0),
  flights integer not null default 0 check (flights >= 0),
  distance_m integer not null default 0 check (distance_m >= 0),
  primary key (user_id, hour_start_utc, source_name)
);

-- De-duplicated hourly totals. Kept after the lock.
create table public.hours (
  user_id uuid not null references public.users (id) on delete cascade,
  hour_start_utc timestamptz not null check (extract(epoch from hour_start_utc)::bigint % 3600 = 0),
  steps integer not null default 0 check (steps >= 0),
  flights integer not null default 0 check (flights >= 0),
  distance_m integer not null default 0 check (distance_m >= 0),
  primary key (user_id, hour_start_utc)
);

create type public.daily_status as enum ('live', 'finalizing', 'locked', 'review', 'voided');

-- One row per player per home-zone game day.
create table public.daily_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  local_date date not null,
  home_tz text not null check (private.is_iana_zone(home_tz)),
  steps integer not null default 0 check (steps >= 0),
  flights integer not null default 0 check (flights >= 0),
  distance_m integer not null default 0 check (distance_m >= 0),
  sources text[] not null default '{}',
  status public.daily_status not null default 'live',
  locked_at timestamptz,
  flags text[] not null default '{}',
  note text,
  unique (user_id, local_date)
);

-- ---------------------------------------------------------------- audit log
create table public.audit_log (
  id bigint generated always as identity primary key,
  -- seasons arrive in a later prompt; its foreign key is added then.
  season_id uuid,
  -- null when a server job (not a person) acted.
  actor uuid references public.users (id) on delete set null,
  action text not null,
  before jsonb,
  after jsonb,
  at timestamptz not null default public.app_now()
);
create index audit_log_season_id_idx on public.audit_log (season_id);
