-- P0.5: database functions behind /sync and /api/sync-key/rotate (docs/PLAN.md Appendix A5, A9).
-- Service role only: Edge Functions call them; clients cannot (CLAUDE.md golden rule 5).
-- Every time check uses app_now() (golden rule 2). Lock times use AT TIME ZONE with the IANA home
-- zone, never offset math (golden rule 3).

-- A player's day for local_date locks at 12:00 PM the next day in their home zone (PLAN §4).
create function private.lock_instant(p_local_date date, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select ((p_local_date + 1)::timestamp + time '12:00') at time zone p_tz;
$$;

-- ---------------------------------------------------------------- sync_auth
-- Look up a sync key by its SHA-256 hash. No row means 401. rate_limited means the key synced less
-- than 30 seconds ago (429). server_now is app_now(), the clock for the rest of the request.
create function public.sync_auth(p_key_hash text)
returns table (user_id uuid, home_tz text, server_now timestamptz, rate_limited boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    k.user_id,
    -- Seasons arrive in a later prompt; until then the home zone is the profile zone.
    u.default_tz,
    public.app_now(),
    coalesce(k.last_used_at > public.app_now() - interval '30 seconds', false)
  from public.sync_keys k
  join public.users u on u.id = k.user_id
  where k.key_hash = p_key_hash;
$$;

-- ---------------------------------------------------------------- sync_apply
-- Write one sync in one transaction. Days, hours and source hours come from the engine (dedup.ts);
-- each hour row carries the home-zone local_date it belongs to.
--
-- 1. Claim the 30-second slot on the key (atomic, so two parallel syncs cannot both pass).
-- 2. Re-check which dates are still open: before their lock and not locked / under review / voided.
--    The Edge Function already dropped locked data; this closes the race with the lock job.
-- 3. Upsert hours, source_hours and daily_stats for open dates only. Unchanged rows are not
--    rewritten, so sending the same payload twice changes nothing.
--
-- Returns {"rate_limited": true} or {"rate_limited": false, "dates": [open dates written]}.
create function public.sync_apply(
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

  return jsonb_build_object('rate_limited', false, 'dates', to_jsonb(v_dates));
end;
$$;

-- ---------------------------------------------------------------- sync_key_rotate
-- Store a new key hash for the user (the old one stops working) and log it. The plaintext key never
-- reaches the database.
create function public.sync_key_rotate(p_user_id uuid, p_key_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sync_keys as k (user_id, key_hash, created_at, last_used_at)
  values (p_user_id, p_key_hash, public.app_now(), null)
  on conflict (user_id) do update
  set key_hash = excluded.key_hash, created_at = excluded.created_at, last_used_at = null;

  insert into public.audit_log (actor, action) values (p_user_id, 'sync_key.rotate');
end;
$$;

revoke all on function
  private.lock_instant(date, text),
  public.sync_auth(text),
  public.sync_apply(uuid, text, jsonb, jsonb, jsonb),
  public.sync_key_rotate(uuid, text)
from public, anon, authenticated;
grant execute on function
  public.sync_auth(text),
  public.sync_apply(uuid, text, jsonb, jsonb, jsonb),
  public.sync_key_rotate(uuid, text)
to service_role;
