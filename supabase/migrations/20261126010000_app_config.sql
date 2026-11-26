-- P0.2: the SQL clock (docs/PLAN.md Appendix A8, CLAUDE.md golden rule 2).
-- All server time checks call app_now(). It returns now() unless test mode is on, in which case it
-- returns app_config.fake_now, which tests and the simulator move forward.

create table public.app_config (
  -- Single-row table: the primary key can only ever be true.
  id boolean primary key default true check (id),
  test_mode boolean not null default false,
  fake_now timestamptz,
  constraint app_config_test_mode_needs_fake_now check (not test_mode or fake_now is not null)
);

comment on table public.app_config is
  'Single-row runtime config. test_mode must be false in production (pgTAP checks the default).';

insert into public.app_config default values;

-- Clients never touch config: RLS on with no policies, and no table grants.
alter table public.app_config enable row level security;
revoke all on table public.app_config from anon, authenticated;

create function public.app_now()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select c.fake_now from public.app_config c where c.test_mode),
    pg_catalog.now()
  );
$$;

comment on function public.app_now() is
  'The only clock for game logic: now(), or app_config.fake_now while test mode is on.';
