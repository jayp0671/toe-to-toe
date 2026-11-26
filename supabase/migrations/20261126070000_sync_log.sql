-- P0.8: sync_log, one row per accepted sync (docs/PROMPTS.md P0.8, docs/PLAN.md §16 Phase 0).
--
-- The Phase 0 sync report asks, for every player-day, "did a sync arrive between the end of the day
-- and its noon lock?". sync_keys.last_used_at keeps only the latest sync, so it can't answer that for
-- past days. sync_apply now appends a row here each time it accepts a sync (after the 30-second
-- slot is claimed, in the same transaction). Rate-limited and rejected requests are not logged.
--
-- Server-written only (golden rule 5): no client grants, RLS on with no policies. The service role
-- (the /sync function and the report) reads it.

create table public.sync_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  synced_at timestamptz not null default public.app_now(),
  -- The open home-zone dates this sync wrote (may be empty: an empty sync still shows the Shortcut ran).
  dates date[] not null default '{}'
);
create index sync_log_user_synced_idx on public.sync_log (user_id, synced_at);

comment on table public.sync_log is
  'One row per accepted /sync (P0.8). Lets the sync report check per day whether a sync arrived before the lock.';

revoke all on table public.sync_log from anon, authenticated;
alter table public.sync_log enable row level security;

-- ---------------------------------------------------------------- sync_apply (P0.5 + log row)
-- Same body as 20261126050000_sync_functions.sql, plus step 4: append to sync_log.
create or replace function public.sync_apply(
  p_user_id uuid,
  p_home_tz text,
  p_days jsonb,
  p_hours jsonb,
  p_source_hours jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := public.app_now();
  v_dates date[];
begin
  update public.sync_keys k
  set last_used_at = v_now
  where k.user_id = p_user_id
    and (k.last_used_at is null or k.last_used_at <= v_now - interval '30 seconds');
  if not found then
    return jsonb_build_object('rate_limited', true);
  end if;

  select coalesce(array_agg(d.local_date order by d.local_date), '{}')
  into v_dates
  from jsonb_to_recordset(p_days) as d (local_date date)
  where v_now < private.lock_instant(d.local_date, p_home_tz)
    and not exists (
      select 1 from public.daily_stats s
      where s.user_id = p_user_id
        and s.local_date = d.local_date
        and s.status not in ('live', 'finalizing')
    );

  insert into public.hours as t (user_id, hour_start_utc, steps, flights, distance_m)
  select p_user_id, h.hour_start_utc, h.steps, h.flights, h.distance_m
  from jsonb_to_recordset(p_hours)
    as h (hour_start_utc timestamptz, local_date date, steps integer, flights integer, distance_m integer)
  where h.local_date = any (v_dates)
  on conflict (user_id, hour_start_utc) do update
  set steps = excluded.steps, flights = excluded.flights, distance_m = excluded.distance_m
  where (t.steps, t.flights, t.distance_m)
    is distinct from (excluded.steps, excluded.flights, excluded.distance_m);

  insert into public.source_hours as t (user_id, hour_start_utc, source_name, steps, flights, distance_m)
  select p_user_id, h.hour_start_utc, h.source_name, h.steps, h.flights, h.distance_m
  from jsonb_to_recordset(p_source_hours)
    as h (hour_start_utc timestamptz, local_date date, source_name text,
          steps integer, flights integer, distance_m integer)
  where h.local_date = any (v_dates)
  on conflict (user_id, hour_start_utc, source_name) do update
  set steps = excluded.steps, flights = excluded.flights, distance_m = excluded.distance_m
  where (t.steps, t.flights, t.distance_m)
    is distinct from (excluded.steps, excluded.flights, excluded.distance_m);

  insert into public.daily_stats as t (user_id, local_date, home_tz, steps, flights, distance_m, sources, status)
  select p_user_id, d.local_date, p_home_tz, d.steps, d.flights, d.distance_m, d.sources,
    d.status::public.daily_status
  from jsonb_to_recordset(p_days)
    as d (local_date date, steps integer, flights integer, distance_m integer, sources text[], status text)
  where d.local_date = any (v_dates)
    and d.status in ('live', 'finalizing')
  on conflict (user_id, local_date) do update
  set home_tz = excluded.home_tz, steps = excluded.steps, flights = excluded.flights,
    distance_m = excluded.distance_m, sources = excluded.sources, status = excluded.status
  where (t.home_tz, t.steps, t.flights, t.distance_m, t.sources, t.status)
    is distinct from (excluded.home_tz, excluded.steps, excluded.flights, excluded.distance_m,
                      excluded.sources, excluded.status);

  insert into public.sync_log (user_id, synced_at, dates) values (p_user_id, v_now, v_dates);

  return jsonb_build_object('rate_limited', false, 'dates', to_jsonb(v_dates));
end;
$$;

-- create or replace keeps the P0.5 grants; restate them so this file stands on its own.
revoke all on function public.sync_apply(uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.sync_apply(uuid, text, jsonb, jsonb, jsonb) to service_role;
