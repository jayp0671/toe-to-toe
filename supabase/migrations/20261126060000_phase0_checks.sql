-- P0.7: data behind the /debug page (docs/PROMPTS.md P0.7, docs/PLAN.md §16 Phase 0, Appendix A9).
--
-- phase0_checks: the number the Health app shows for a day, typed in by the tester each morning.
-- The Phase 0 sync report (P0.8) compares it with the counted steps in daily_stats. It is the
-- tester's own input, not a result: each user reads and writes only their own rows. Only the
-- service role (the sync report) reads everyone's.
--
-- my_sync_status(): the caller's home zone, today and yesterday in that zone from app_now(), and
-- their last sync time. sync_keys stays closed to clients (A9); this returns only last_used_at,
-- only for the caller.

create table public.phase0_checks (
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  local_date date not null,
  -- Same bound as /sync's per-item count, so a typo can't overflow later maths.
  health_steps integer not null check (health_steps between 0 and 1000000),
  entered_at timestamptz not null default public.app_now(),
  primary key (user_id, local_date)
);

comment on table public.phase0_checks is
  'Phase 0 only: steps the Health app reported for a day, entered by the tester (P0.7, P0.8).';

-- A correction re-stamps entered_at, so the report can tell a same-morning entry from a late one.
create function private.phase0_checks_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.entered_at := public.app_now();
  return new;
end;
$$;

create trigger phase0_checks_stamp
  before update on public.phase0_checks
  for each row execute function private.phase0_checks_stamp();

revoke all on table public.phase0_checks from anon, authenticated;
alter table public.phase0_checks enable row level security;

grant select on table public.phase0_checks to authenticated;
-- entered_at is server-set. user_id and local_date are in the UPDATE grant only because PostgREST's
-- upsert sets every column it was sent; the policy below still pins user_id to the caller.
grant insert (user_id, local_date, health_steps) on table public.phase0_checks to authenticated;
grant update (user_id, local_date, health_steps) on table public.phase0_checks to authenticated;

create policy phase0_checks_select_own on public.phase0_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy phase0_checks_insert_own on public.phase0_checks
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy phase0_checks_update_own on public.phase0_checks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- my_sync_status
-- Home zone = users.default_tz until seasons exist, the same rule /sync uses (sync_auth).
-- No row when the caller has no profile yet.
create function public.my_sync_status()
returns table (home_tz text, today date, yesterday date, last_sync_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.default_tz,
    (public.app_now() at time zone u.default_tz)::date,
    (public.app_now() at time zone u.default_tz)::date - 1,
    k.last_used_at
  from public.users u
  left join public.sync_keys k on k.user_id = u.id
  where u.id = (select auth.uid());
$$;

revoke all on function public.my_sync_status() from public, anon;
grant execute on function public.my_sync_status() to authenticated;
revoke all on function private.phase0_checks_stamp() from public;
